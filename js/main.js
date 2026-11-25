import * as THREE from 'three';
import { TOTAL_STONES, WORLD, FINDS, BOT_UPGRADES, HELPERS, helperCost, fmt, LUCK, SKINS, ACHIEVEMENTS, DECKS, STAR_BONUS, TURBO, CHASSIS, MODULES, MODULE_SLOTS, ATOMAR_CORE, TOOLS, deckDef, deckName, deckTotal, deckValueMult, deckEventSpeed, deckGoalTarget, deckMinutes, EVOLUTION } from './config.js';
import { Events, EVENT_TYPES } from './events.js';
import { xpForLevel, LEVEL_BONUS, UNLOCKS, CONSUMABLES, RECIPES, makeContract, contractProgress, contractLabel } from './progression.js';
import { Capsules, Dust, floatLabel } from './extras.js';
import { StationView, MODULES_ST, RANKS, stationRank, moduleCost, stationBonus, freeCells, STATION_POS, TONS_PER_PART } from './station.js';
import { BaseView, BUILDINGS, baseStats, buildCost, SITE_COSTS, SITE_ANGLES, MAX_BLD_LEVEL, BUILD_UNLOCK_LEVEL, sitePos, bldValue } from './buildings.js';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { RoomEnvironment } from '../vendor/environments/RoomEnvironment.js';
import { Pile, PileView } from './pile.js';
import { NexusBot } from './bot.js';
import { buildEnvironment } from './scene.js';
import { initAudio, sfx, vibrate, setEngine, setSfx, setMusic, settings } from './audio.js';

// ================================================================ save state
const SAVE_KEY = 'nexus-schrottberg.v1';
const REC_KEY = 'nexus-schrottberg.records';

function freshState(mode = 'career') {
  return {
    mode, seed: (Math.random() * 2 ** 31) >>> 0,
    credits: 0, cargo: {}, cargoCount: 0,
    levels: { hands: 0, speed: 0, drive: 0, cargo: 0, scanner: 0, link: 0 },
    helpers: {},
    stats: { removed: 0, found: {}, earned: 0, time: 0, grabs: 0, capsules: 0, aliens: 0 },
    total: TOTAL_STONES, deckBase: { removed: 0, found: {}, time: 0, aliens: 0 },
    skins: ['classic'], skin: 'classic', achievements: [], deck: 0, stars: 0, daily: null,
    chassis: 'tracks', chassisOwned: ['tracks'], modules: [], equipped: [], slotLv: 0, atomarLv: 0, tool: 'arms', toolsOwned: ['arms'], sites: Array(13).fill(null), sitesUnlocked: 3, buffer: 0, fabT: 0, station: [], tonsSpent: 0, evo: 1,
    level: 1, xp: 0, vault: {}, keep: [], items: {}, contracts: [], contractsDone: 0, crafted: 0, bestCombo: 0,
    coreFound: false, coreTime: 0, lastSave: Date.now(), pile: null, tutorial: 0,
  };
}
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.pile ? s : null; } catch (e) { return null; }
}
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(REC_KEY)) || {}; } catch (e) { return {}; }
}
function saveRecords() { try { localStorage.setItem(REC_KEY, JSON.stringify(records)); } catch (e) { /* ignore */ } }

let S = null;           // current game state
let records = loadRecords();
let playing = false;

// ================================================================ renderer
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);
const env = buildEnvironment(scene, renderer);

// ---- image-based lighting: soft reflections on metal and plastic
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.12;
  pmrem.dispose();
}
// ---- bloom post-processing (only on the high quality level)
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.32, 0.4, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const gfx = { bloom: true };
try { const g = JSON.parse(localStorage.getItem('nexus-gfx')); if (g) Object.assign(gfx, g); } catch (e) { /* ignore */ }
function renderFrame() {
  if (gfx.bloom && quality.level === 2) composer.render();
  else renderer.render(scene, camera);
}

let pile = null, pileView = null;
const bot = new NexusBot();
scene.add(bot.group);
const contactShadow = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  return m;
})();
const capsules = new Capsules(scene);
const baseView = new BaseView(scene);
const stationView = new StationView(scene);
const dust = new Dust(scene);
let shake = 0;
const events = new Events(scene, {
  onImpact(pos) {
    dust.puff(pos.x, pos.y, pos.z, 8, 2.2, 0xff9a5c);
    spawnDebris(pos.x, pos.y, pos.z, 14, 0, 0, 1);
    const d = Math.hypot(pos.x - bot.group.position.x, pos.z - bot.group.position.z);
    shake = Math.max(shake, Math.max(0.05, 0.5 - d * 0.02));
    sfx.meteor(Math.max(0.2, 1 - d / 40));
    vibrate(30);
  },
  onStart(type) {
    const e = EVENT_TYPES[type];
    const el = $('event');
    el.style.setProperty('--c', e.color);
    el.querySelector('b').textContent = e.name;
    el.querySelector('small').textContent = e.desc;
    el.classList.remove('hidden');
    sfx.event();
    if (type === 'storm') env.setStorm(true);
    say({ meteor: 'Achtung, Meteoriten! Die sind voller Schätze! ☄️', luck: 'Ich spüre eine Glückswelle! Schnell greifen! ✨', storm: 'Schneesturm! Ich sehe kaum was – aber hier glitzert es! 🌨️', gold: 'GOLDRAUSCH! Jetzt zählt jeder Griff doppelt! 💰', swarm: 'Aliens! Fahr hin und schnapp sie dir! 👽' }[type], 4);
  },
  onEnd(type) { $('event').classList.add('hidden'); if (type === 'storm') env.setStorm(false); },
});

// ================================================================ debris
const DMAX = 400;
const debrisMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3, flatShading: true }), DMAX);
debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
debrisMesh.frustumCulled = false;
debrisMesh.castShadow = true;
debrisMesh.count = 0;
scene.add(debrisMesh);
const debris = [];
const DEBRIS_COLORS = [0x6b6560, 0x7d7368, 0x5a5f66, 0x9aa0a8, 0xa0623a, 0x4a4e55, 0xc0c4ca];
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();

function spawnDebris(x, y, z, n, dirX = 0, dirZ = 0, scale = 1) {
  for (let k = 0; k < n; k++) {
    if (debris.length >= DMAX) debris.shift();
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 2.5;
    debris.push({
      p: new THREE.Vector3(x + (Math.random() - 0.5) * 0.4, y + 0.1, z + (Math.random() - 0.5) * 0.4),
      v: new THREE.Vector3(Math.cos(a) * sp * 0.5 + dirX * 2.5, 3.5 + Math.random() * 3.5, Math.sin(a) * sp * 0.5 + dirZ * 2.5),
      r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      w: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
      s: (0.6 + Math.random() * 1.2) * scale, age: 0, life: 2.2 + Math.random(),
      c: DEBRIS_COLORS[Math.floor(Math.random() * DEBRIS_COLORS.length)],
    });
  }
}
function updateDebris(dt) {
  let n = 0;
  for (let k = debris.length - 1; k >= 0; k--) {
    const d = debris[k];
    d.age += dt;
    if (d.age > d.life) { debris.splice(k, 1); continue; }
    d.v.y -= WORLD.gravity * dt;
    d.p.addScaledVector(d.v, dt);
    d.r.addScaledVector(d.w, dt);
    const fade = d.age > d.life - 0.4 ? (d.life - d.age) / 0.4 : 1;
    tmpE.set(d.r.x, d.r.y, d.r.z);
    tmpQ.setFromEuler(tmpE);
    tmpS.setScalar(d.s * fade);
    tmpM.compose(d.p, tmpQ, tmpS);
    debrisMesh.setMatrixAt(n, tmpM);
    debrisMesh.setColorAt(n, tmpC.setHex(d.c));
    n++;
  }
  debrisMesh.count = n;
  debrisMesh.instanceMatrix.needsUpdate = true;
  if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;
}

// ================================================================ helper drones (visual)
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const droneGroup = new THREE.Group();
scene.add(droneGroup);
const DRONE_LOOK = {
  mini: { color: 0xf3f4f2, size: 0.9, h: 2.4 },
  drone: { color: 0x2fc9a8, size: 1.1, h: 3.2 },
  belt: { color: 0xffb347, size: 1.3, h: 4.2 },
  drill: { color: 0xff6b6b, size: 1.6, h: 5.2 },
  orbit: { color: 0xb48cff, size: 2.4, h: 8 },
};
const MAX_VISIBLE_DRONES = 6;
function rebuildDrones() {
  droneGroup.clear();
  if (!S) return;
  let idx = 0, shown = 0;
  // strongest types first, max 2 per type and 6 in total, so it stays calm
  for (const h of [...HELPERS].reverse()) {
    const n = Math.min(S.helpers[h.id] || 0, 2, MAX_VISIBLE_DRONES - shown);
    shown += n;
    const look = DRONE_LOOK[h.id];
    for (let k = 0; k < n; k++) {
      const d = makeDrone(look);
      d.userData = { ...d.userData, phase: idx * 1.7 + k * 2.1 + shown, r: 5 + ((idx * 3 + k * 5) % 9), h: look.h, speed: 0.15 + (k % 3) * 0.05, size: look.size };
      droneGroup.add(d);
    }
    idx++;
  }
}

// Atomar drone: quadcopter with spinning rotors, skids, camera eye and an atom emblem on top.
const droneMats = {
  white: new THREE.MeshStandardMaterial({ color: 0xf3f4f2, roughness: 0.4, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.5, metalness: 0.4 }),
  rotor: new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  eye: new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }),
};
function makeDrone(look) {
  const s = look.size;
  const d = new THREE.Group();
  const accent = new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.4, metalness: 0.3, emissive: look.color, emissiveIntensity: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 0.16, s * 0.6), droneMats.white);
  const top = new THREE.Mesh(new THREE.BoxGeometry(s * 0.36, s * 0.08, s * 0.4), accent);
  top.position.y = s * 0.11;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.07, 12, 8), droneMats.eye);
  eye.position.set(0, -s * 0.02, s * 0.31);
  body.castShadow = true;
  d.add(body, top, eye);
  const rotors = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(s * 0.06, s * 0.05, s * 0.55), droneMats.dark);
    arm.position.set(sx * s * 0.28, 0, sz * s * 0.28);
    arm.rotation.y = sx * sz > 0 ? -Math.PI / 4 : Math.PI / 4;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.07, s * 0.1, 10), accent);
    motor.position.set(sx * s * 0.45, s * 0.05, sz * s * 0.45);
    const rotor = new THREE.Group();
    rotor.position.set(sx * s * 0.45, s * 0.11, sz * s * 0.45);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(s * 0.26, 20), droneMats.rotor);
    disc.rotation.x = -Math.PI / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 0.01, s * 0.05), droneMats.dark);
    const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2;
    rotor.add(disc, blade, blade2);
    const led = new THREE.Mesh(new THREE.SphereGeometry(s * 0.025, 6, 4), new THREE.MeshBasicMaterial({ color: sz > 0 ? 0xffffff : 0xff4040 }));
    led.position.set(sx * s * 0.45, -s * 0.02, sz * s * 0.45);
    d.add(arm, motor, rotor, led);
    rotors.push(rotor);
  }
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(s * 0.03, s * 0.03, s * 0.55), droneMats.dark);
    skid.position.set(sx * s * 0.18, -s * 0.2, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(s * 0.03, s * 0.14, s * 0.03), droneMats.dark);
    leg.position.set(sx * s * 0.18, -s * 0.13, 0);
    d.add(skid, leg);
  }
  // atom emblem on top (the "Atomar" brand)
  const atom = new THREE.Group();
  atom.position.y = s * 0.24;
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(s * 0.05, 10, 8), new THREE.MeshBasicMaterial({ color: look.color }));
  atom.add(nucleus);
  for (let r = 0; r < 3; r++) {
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(s * 0.11, s * 0.008 + 0.004, 4, 20), droneMats.eye);
    orbit.rotation.set(Math.PI / 2 + r * 1.05, r * 0.6, 0);
    atom.add(orbit);
  }
  d.add(atom);
  // suction beam
  const beam = new THREE.Mesh(new THREE.ConeGeometry(s * 0.35, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x6ff3f0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = -0.5;
  d.add(beam);
  d.userData = { beam, rotor: atom, rotors };
  return d;
}

function updateDrones(dt, t) {
  for (const d of droneGroup.children) {
    const u = d.userData;
    const a = t * u.speed + u.phase;
    const x = Math.cos(a) * u.r, z = Math.sin(a) * u.r;
    const ground = Math.max(0, pile.heightAt(x, z));
    d.position.set(x, ground + u.h + Math.sin(t * 2 + u.phase) * 0.2, z);
    d.rotation.y = -a;
    if (u.rotor) u.rotor.children.forEach((o, i) => { if (i) o.rotation.z += dt * (2 + i); });
    if (u.rotors) u.rotors.forEach((r, i) => { r.rotation.y += dt * (i % 2 ? 38 : -38); });
    d.rotation.z = Math.sin(t * 1.7 + u.phase) * 0.06;
    const suck = (Math.sin(t * 1.3 + u.phase * 3) + 1) / 2;
    u.beam.material.opacity = suck > 0.5 ? (suck - 0.5) * 0.12 : 0;   // subtle, no flashing
    u.beam.scale.y = u.h;
    u.beam.position.y = -u.h / 2;
    if (suck > 0.85 && Math.random() < dt * 10 && pile.total > 0) { spawnDebris(x, ground, z, 1, 0, 0, 0.8); dust.puff(x, ground, z, 1, 0.7); }
  }
}

// ================================================================ HUD helpers
const $ = (id) => document.getElementById(id);
const hud = $('hud');

// find messages are collected and shown as one calm line per ~1.5 s
const feedAgg = { items: new Map(), t: 0 };
function feedFind(f, k) {
  const cur = feedAgg.items.get(f.id) || { f, k: 0 };
  cur.k += k;
  feedAgg.items.set(f.id, cur);
}
function flushFeed(dt) {
  feedAgg.t -= dt;
  if (feedAgg.t > 0 || !feedAgg.items.size) return;
  feedAgg.t = 1.5;
  const list = [...feedAgg.items.values()].sort((a, b) => b.f.value - a.f.value);
  feedAgg.items.clear();
  const text = list.slice(0, 3).map((q) => `+${fmt(q.k)} ${q.f.name}`).join(' · ') + (list.length > 3 ? ' …' : '');
  feed(text, list[0].f.color);
}
function feed(text, color = '#6ff3f0') {
  const el = document.createElement('div');
  el.className = 'feed-item';
  el.style.setProperty('--c', color);
  el.textContent = text;
  const f = $('feed');
  f.prepend(el);
  while (f.children.length > 3) f.lastChild.remove();
  setTimeout(() => el.remove(), 3100);
}
let hintTimer = 0;
function hint(text, color = '#fff') {
  const h = $('hint');
  h.textContent = text; h.style.color = color;
  h.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.remove('show'), 1600);
}

const lv = (k) => BOT_UPGRADES[k].levels[S.levels[k]].value;
let SB = stationBonus([]);
const refreshStationBonus = () => { SB = stationBonus(S.station || []); };
const cargoCap = () => Math.round(lv('cargo') * (1 + SB.cargo));
const tonsAvail = () => Math.max(0, S.stats.removed * TONS_PER_PART - (S.tonsSpent || 0));
const starMult = () => 1 + (S.stars || 0) * STAR_BONUS.finds;
const valueOf = (f) => Math.round(f.value * starMult() * (1 + ((S.level || 1) - 1) * LEVEL_BONUS) * deckValueMult(S.deck || 0) * events.valueFactor * (1 + SB.value + SB.all));
const helperRate = () => HELPERS.reduce((a, h) => a + (S.helpers[h.id] || 0) * h.rate, 0) * (1 + (S.stars || 0) * STAR_BONUS.helpers) * ATOMAR_CORE[S.atomarLv || 0].mult * (1 + (S.sites ? baseStats(S.sites).hangar : 0) / 100) * (1 + SB.drones + SB.all);
const hasMod = (id) => S.equipped && S.equipped.includes(id);
const chassisDef = () => CHASSIS.find((c) => c.id === S.chassis) || CHASSIS[0];
const toolDef = () => TOOLS.find((x) => x.id === (S.tool || 'arms')) || TOOLS[0];
const grabRadius = () => Math.max(0, GRAB_RADIUS[S.levels.hands] + (hasMod('reach') ? 1 : 0) + toolDef().radius);
const reachDist = () => 2.2 + grabRadius() * 0.5 + chassisDef().reach + (hasMod('reach') ? 0.8 : 0) + toolDef().reach;
const turboDur = () => TURBO.duration * (hasMod('cooler') ? 1.6 : 1);
const turboCd = () => TURBO.cooldown * (hasMod('battery') ? 0.6 : 1);

let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }

function updateHud() {
  setText('remaining', fmt(pile.total));
  const pct = (((S.total || TOTAL_STONES) - pile.total) / (S.total || TOTAL_STONES)) * 100;
  setText('progress', `${pct.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %`);
  setText('deck-line', `${deckDef(S.deck || 0).name} · ${deckName(S.deck || 0)}${S.stars ? ` · ⭐ ${S.stars}` : ''}`);
  setText('credits', fmt(S.credits));
  setText('level', `${S.level}`);
  $('xp-fill').style.width = `${Math.min(100, (S.xp / xpForLevel(S.level)) * 100)}%`;
  $('level-chip').classList.toggle('hidden', S.mode === 'pure');
  const ready = S.level >= UNLOCKS.contracts ? contractsReady() : 0;
  $('btn-archive').classList.toggle('badge', ready > 0);
  $('btn-build').classList.toggle('hidden', S.mode === 'pure' || S.level < BUILD_UNLOCK_LEVEL);
  $('btn-station').classList.toggle('hidden', S.mode === 'pure');
  $('btn-station').classList.toggle('badge', tonsAvail() >= 8 && S.station.length === 0);
  const anyB = S.sites && S.sites.some(Boolean);
  $('base-chip').classList.toggle('hidden', !anyB);
  if (anyB) setText('base-inc', `${fmt(baseIncome)}/s${baseCache.eff < 1 ? ' ⚡!' : ''}`);
  if (!$('build').classList.contains('hidden') && Math.random() < 0.05) renderBuild();
  const cap = cargoCap();
  setText('cargo', S.levels.link ? 'Nexus-Link' : `${fmt(S.cargoCount)}/${fmt(cap)}`);
  $('cargo-chip').classList.toggle('full', !S.levels.link && S.cargoCount >= cap);
  const rate = helperRate();
  $('rate-chip').classList.toggle('hidden', rate === 0);
  setText('rate', fmt(rate));
  const amt = lv('hands');
  setText('grab-amt', amt === 1 ? '1 Teil' : `${fmt(amt)} Teile`);
  $('credits-chip').classList.toggle('hidden', S.mode === 'pure');
  $('scanner').classList.toggle('hidden', S.levels.scanner < 2 || S.coreFound);
}

// ================================================================ finds & economy
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function poisson(l) {
  if (l <= 0) return 0;
  if (l < 30) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
  return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
}
function rollFinds(n, luck = 1) {
  const out = [];
  FINDS.forEach((f, tier) => {
    let m = tier < 3 ? luck : 1;
    if (S && hasMod('magnet') && ['copper', 'platinum', 'probe'].includes(f.id)) m *= 1.4;
    if (S && hasMod('sense') && f.value >= 300) m *= 1.5;
    if (S && f.value >= 300) m *= toolDef().rare * events.rareFactor * (1 + SB.rare);
    if (S) m *= (DECKS[(S.deck || 0) % DECKS.length].boost || {})[f.id] || 1;
    const k = poisson(n * f.rate * m);
    if (k) out.push({ f, k, tier: Math.min(5, tier) });
  });
  return out;
}

let fullWarnT = 0;
function handleFinds(list, byPlayer) {
  if (!list.length) return;
  let best = -1;
  for (const { f, k, tier } of list) {
    S.stats.found[f.id] = (S.stats.found[f.id] || 0) + k;
    if (!byPlayer || S.levels.link || S.mode === 'pure') {
      if (byPlayer && S.levels.link && S.keep.includes(f.id)) { S.vault[f.id] = (S.vault[f.id] || 0) + k; feed(`+${fmt(k)} ${f.name} → Lager`, f.color); best = Math.max(best, tier); continue; }
      const fee = byPlayer && S.levels.link ? 0.75 : 1;
      if (S.mode !== 'pure') { const v = Math.round(valueOf(f) * k * fee); S.credits += v; S.stats.earned += v; }
      if (byPlayer) { feedFind(f, k); best = Math.max(best, tier); }
      else if (tier >= 3) feed(`Helfer: ${f.name}!`, f.color);
      continue;
    }
    const cap = cargoCap();
    const space = Math.max(0, cap - S.cargoCount);
    const take = Math.min(space, k);
    if (take > 0) {
      S.cargo[f.id] = (S.cargo[f.id] || 0) + take;
      S.cargoCount += take;
      feedFind(f, take);
      best = Math.max(best, tier);
    }
    if (take < k && fullWarnT <= 0) {
      fullWarnT = 3;
      hint('Laderaum voll! Ab zur Nexus-Ablage', '#ff6b6b');
      bot.setMood('sad', 2.5);
      say(pick(LINES.full));
      sfx.full();
    }
  }
  if (best >= 0) {
    if (best >= 3) say(pick(LINES.rare));
    else if (best >= 2 && Math.random() < 0.5) say(pick(LINES.find));
    sfx.find(best);
    if (best >= 2) { bot.setMood('happy', 1.5); vibrate(20); }
  }
}

function cargoValue(onlySold = false) {
  return FINDS.reduce((a, f) => a + ((onlySold && S.keep.includes(f.id)) ? 0 : (S.cargo[f.id] || 0) * valueOf(f)), 0);
}
// At the Ablage: kept finds go to the vault (Lager), the rest is sold.
function sellCargo() {
  if (!S.cargoCount) return 0;
  let stored = 0;
  for (const f of FINDS) {
    const n = S.cargo[f.id] || 0;
    if (n && S.keep.includes(f.id)) { S.vault[f.id] = (S.vault[f.id] || 0) + n; stored += n; }
  }
  const v = cargoValue(true);
  S.credits += v; S.stats.earned += v;
  S.cargo = {}; S.cargoCount = 0;
  sfx.sell();
  bot.setMood('happy', 2);
  if (v) feed(`Verkauft: +${fmt(v)} ⬡`, '#6ff3f0');
  if (stored) feed(`${fmt(stored)} Funde ins Lager`, '#ffb347');
  addXp(Math.round(v / 15));
  updateHud();
  save();
  return v;
}

// ================================================================ XP / level
function addXp(n) {
  if (!n || S.mode === 'pure') return;
  S.xp += n * (1 + SB.xp + SB.all);
  let need = xpForLevel(S.level);
  while (S.xp >= need) {
    S.xp -= need;
    S.level++;
    need = xpForLevel(S.level);
    const unlock = S.level === UNLOCKS.crafting ? ' · Fabrikator im Shop freigeschaltet!' : S.level === UNLOCKS.contracts ? ' · Aufträge im Archiv freigeschaltet!' : S.level === BUILD_UNLOCK_LEVEL ? ' · 🏗️ Bauen freigeschaltet!' : '';
    achvQueue.push({ kicker: 'Level-Up!', name: `⭐ Nexus Level ${S.level}`, desc: `+${Math.round(LEVEL_BONUS * 100)} % Fundwert${unlock}`, reward: 0 });
    bot.setMood('love', 3);
    say(pick(['Level-Up! Ich werde immer besser! 🚀', 'Neues Level! 💪', `Level ${S.level}! Weiter so!`]), 3);
    vibrate([20, 30, 40]);
    if (S.level >= UNLOCKS.contracts) ensureContracts();
  }
}

// ================================================================ combo
const combo = { n: 0, t: 0 };
function bumpCombo() {
  combo.n = combo.t > 0 ? combo.n + 1 : 1;
  combo.t = 1.3 + 1 / lv('speed');
  if (combo.n > S.bestCombo) S.bestCombo = combo.n;
  if ([25, 50, 100, 200].includes(combo.n)) {
    sfx.find(Math.min(5, combo.n / 40 + 1));
    say(combo.n >= 100 ? `KOMBO ${combo.n}! Unaufhaltsam! 🔥` : `Kombo ${combo.n}! 🔥`, 1.6);
    addXp(combo.n / 5);
  }
}
const comboLuck = () => 1 + Math.min(combo.n, 100) / 200;   // up to ×1.5
function updateCombo(dt) {
  combo.t -= dt;
  if (combo.t <= 0) combo.n = 0;
  const el = $('combo');
  if (combo.n >= 5) {
    el.classList.remove('hidden');
    setText('combo-n', `${combo.n}`);
    setText('combo-m', `Glück ×${comboLuck().toLocaleString('de-DE', { maximumFractionDigits: 2 })}`);
    el.style.setProperty('--h', `${Math.max(0, 40 - combo.n / 2.5)}`);
  } else el.classList.add('hidden');
}

// ================================================================ consumables
const pulse = { t: 0, group: null };
function giveItem(id, n = 1) { S.items[id] = (S.items[id] || 0) + n; renderItems(); }
function renderItems() {
  const bar = $('items');
  bar.innerHTML = '';
  for (const c of CONSUMABLES) {
    const n = S.items[c.id] || 0;
    if (!n) continue;
    const b = document.createElement('button');
    b.className = 'item-btn';
    b.innerHTML = `<span>${c.icon}</span><b>${n}</b>`;
    b.title = c.name;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); useItem(c.id); });
    bar.appendChild(b);
  }
}
function useItem(id) {
  if (!playing || !(S.items[id] > 0)) return;
  const c = CONSUMABLES.find((x) => x.id === id);
  if (id === 'bomb') {
    const [x, z] = frontPoint();
    const amount = Math.max(2500, lv('hands') * 25);
    const res = pile.grab(x, z, amount, 4.5);
    if (!res.removed && !res.ring) { hint('Hier ist nichts zum Sprengen'); return; }
    S.stats.removed += res.removed;
    const h = Math.max(0, pile.heightAt(x, z));
    spawnDebris(x, h, z, 60, 0, 0, 1.6);
    dust.puff(x, h, z, 14, 3, 0xffa040);
    shake = 0.9;
    sfx.meteor(1);
    vibrate([60, 30, 60]);
    handleFinds(rollFinds(res.removed, events.luckFactor), true);
    floatLabel(camera, tmpV2.set(x, h + 1.5, z), `💥 ${fmt(res.removed)} Teile`, '#ffb347', true);
    if (res.ring) coreFound(true);
  } else if (id === 'pulse') {
    showPulse();
  } else if (id === 'cell') {
    turbo.cd = 0; useTurbo();
  } else if (id === 'bait') {
    for (let k = 0; k < 3; k++) { capsules.list.length < 6 && capsules.spawn(pile); }
    say('Kapseln im Anflug! 🎁');
  } else if (id === 'spark') {
    if (events.active) { hint('Gerade läuft schon ein Ereignis'); return; }
    events.start('luck', pile);
  }
  S.items[id]--;
  sfx.turbo();
  feed(`${c.icon} ${c.name} benutzt`, '#ffb347');
  renderItems();
  save();
}
function showPulse() {
  if (S.coreFound) { hint('Der Kern ist schon gefunden'); return; }
  if (pulse.group) scene.remove(pulse.group);
  const rp = pile.ringPosition();
  const a = Math.random() * Math.PI * 2, d = Math.random() * 2.5;
  const cx = rp.x + Math.cos(a) * d, cz = rp.z + Math.sin(a) * d;
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 60, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x6ff3f0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 30;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.08, 8, 64), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
  ring.rotation.x = Math.PI / 2;
  g.add(beam, ring);
  g.position.set(cx, 0, cz);
  g.userData.ring = ring;
  scene.add(g);
  pulse.group = g; pulse.t = 30;
  say('Kernpuls! Der Kern liegt irgendwo im Lichtkegel! 📡', 4);
  sfx.event();
}
function updatePulse(dt, t) {
  if (!pulse.group) return;
  pulse.t -= dt;
  const g = pulse.group;
  g.userData.ring.position.y = Math.max(0, pile.heightAt(g.position.x, g.position.z)) + 0.2;
  g.userData.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
  if (pulse.t <= 0 || S.coreFound) { scene.remove(g); pulse.group = null; }
}

// ================================================================ contracts
function ensureContracts() {
  if (S.mode === 'pure' || S.level < UNLOCKS.contracts) return;
  while (S.contracts.length < 3) {
    const c = makeContract(S);
    if (c.kind === 'deliver' && !S.keep.includes(c.find)) S.keep.push(c.find);
    S.contracts.push(c);
  }
}
function claimContract(id) {
  const c = S.contracts.find((x) => x.id === id);
  if (!c || contractProgress(S, c) < c.n) return;
  if (c.kind === 'deliver') S.vault[c.find] -= c.n;
  S.credits += c.reward; S.stats.earned += c.reward;
  S.contracts = S.contracts.filter((x) => x.id !== id);
  S.contractsDone++;
  addXp(c.xp);
  sfx.achievement();
  floatLabel(camera, tmpV2.copy(bot.group.position).setY(bot.group.position.y + 2), `📋 +${fmt(c.reward)} ⬡`, '#7cf0b0', true);
  say(pick(['Auftrag erledigt! ✅', 'Die Station ist zufrieden!', 'Bonus kassiert!']));
  ensureContracts();
  renderArchive(); updateHud(); save();
}
function contractsReady() {
  return S.contracts.filter((c) => contractProgress(S, c) >= c.n).length;
}

// ================================================================ next goal widget
function nextGoal() {
  if (S.mode === 'pure') return null;
  const opts = [];
  for (const [key, up] of Object.entries(BOT_UPGRADES)) {
    const nx = up.levels[S.levels[key] + 1];
    if (nx) opts.push({ name: `${up.title}: ${nx.name}`, cost: nx.cost });
  }
  for (const c of CHASSIS) if (!S.chassisOwned.includes(c.id)) opts.push({ name: `Fahrwerk: ${c.name}`, cost: c.cost });
  for (const m of MODULES) if (!S.modules.includes(m.id)) opts.push({ name: `${m.icon} ${m.name}`, cost: m.cost });
  opts.sort((a, b) => a.cost - b.cost);
  // aim for the cheapest thing that isn't trivially cheap compared to credits, or the next one
  return opts.find((o) => o.cost > S.credits) ? (opts.filter((o) => o.cost <= S.credits)[0] || opts.find((o) => o.cost > S.credits)) : opts[0];
}
function updateGoal() {
  const g = nextGoal();
  const el = $('goal');
  if (!g || S.tutorial < 5) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const ready = S.credits >= g.cost;
  el.classList.toggle('ready', ready);
  setText('goal-name', ready ? `${g.name} – kaufbar!` : g.name);
  setText('goal-cost', ready ? 'Ab zum Shop 🛒' : `${fmt(S.credits)} / ${fmt(g.cost)} ⬡`);
  $('goal-fill').style.width = `${Math.min(100, (S.credits / g.cost) * 100)}%`;
}

// ================================================================ grabbing
const grabState = { holding: false, timer: 0 };
const GRAB_RADIUS = [0, 0.8, 1.3, 1.9, 2.7, 3.8];

function frontPoint() {
  const a = bot.group.rotation.y;
  return [bot.group.position.x + Math.sin(a) * 1.0, bot.group.position.z + Math.cos(a) * 1.0];
}

function doGrab(x, z) {
  if (!playing) return;
  initAudio();
  const evoMul = 1 + ((S.evo || 1) >= 2 ? 0.15 : 0);
  const dbl = (S.evo || 1) >= 5 && Math.random() < 0.25;
  const amount = Math.max(1, Math.round(lv('hands') * toolDef().amount * evoMul * (dbl ? 2 : 1)));
  if (dbl && Math.random() < 0.15) say('Doppelgriff! 🙌', 1);
  const radius = grabRadius();
  const pickR = 2.6 + toolDef().pickup;
  const cap = S.mode !== 'pure' && capsules.take(x, z, pickR);
  if (cap) openCapsule(cap.position);
  const met = events.take(x, z, pickR);
  if (met) openMeteor(met);
  const al = events.catchAlien(x, z, pickR + 0.4);
  if (al) catchAlien(al);
  const res = pile.grab(x, z, amount, Math.max(radius, 0.8));
  bot.grab();
  if ((cap || met || al) && !res.removed) return;
  S.stats.grabs++;
  if (!res.removed && !res.ring) {
    sfx.empty();
    hint('Hier liegt nichts – fahr näher an den Haufen');
    return;
  }
  S.stats.removed += res.removed;
  bumpCombo();
  addXp(1);
  const size = Math.min(5, S.levels.hands);
  sfx.grab(size);
  if (S.levels.hands === 0 && Math.random() < 0.15) bot.setMood('work', 0.6);
  const h = Math.max(0, pile.heightAt(x, z));
  const a = bot.group.rotation.y;
  spawnDebris(x, h, z, Math.min(2 + size * 3, Math.max(1, Math.round(res.removed / 3))), -Math.sin(a) * 0.4, -Math.cos(a) * 0.4, 1 + size * 0.15);
  dust.puff(x, h, z, 1 + Math.min(4, size), 0.8 + size * 0.25);
  const lucky = S.stats.grabs <= LUCK.grabs ? LUCK.factor : 1;
  const finds = rollFinds(res.removed, lucky * events.luckFactor * comboLuck());
  // guaranteed early highlights
  if (S.stats.grabs === 3) finds.push({ f: FINDS[1], k: 1, tier: 1 });
  if (S.stats.grabs === 25) finds.push({ f: FINDS[2], k: 1, tier: 2 });
  handleFinds(finds, true);
  const worth = finds.reduce((a, q) => a + valueOf(q.f) * q.k, 0);
  if (worth) addXp(Math.max(1, Math.round(worth / 20)));
  if (worth && S.mode !== 'pure' && (worth >= 20 || performance.now() - lastFloat > 700)) {
    lastFloat = performance.now();
    const best = finds.reduce((a, q) => (q.tier > a.tier ? q : a), finds[0]);
    floatLabel(camera, tmpV2.set(x, h + 0.8, z), `+${fmt(worth)} ⬡`, best.f.color, worth >= 60);
  }
  if (S.stats.grabs === 3) say('Ein Eiskristall – gleich beim dritten Griff! ❄️');
  if (S.stats.grabs === 25) say('Ein Sondenteil! Das bringt 60 Credits!');
  if (res.ring) coreFound(true);
  scannerPing();
}

const tmpV2 = new THREE.Vector3();
let lastFloat = 0;
function capsuleReward() {
  const perSec = lv('hands') * lv('speed') * 0.37 + helperRate() * 0.37;
  return Math.max(25, Math.round(perSec * 25));
}
function openMeteor(pos) {
  const list = [{ f: FINDS[3], k: 1 + Math.floor(Math.random() * 3), tier: 3 }];
  if (Math.random() < 0.3) list.push({ f: FINDS[4], k: 1, tier: 4 });
  if (Math.random() < 0.03) list.push({ f: FINDS[5], k: 1, tier: 5 });
  handleFinds(list, true);
  const worth = list.reduce((a, q) => a + valueOf(q.f) * q.k, 0);
  floatLabel(camera, tmpV2.copy(pos).setY(pos.y + 1), `☄️ +${fmt(worth)} ⬡`, '#ff9a5c', true);
  dust.puff(pos.x, pos.y, pos.z, 6, 1.5, 0xff9a5c);
  spawnDebris(pos.x, pos.y, pos.z, 10, 0, 0, 0.8);
  S.stats.meteors = (S.stats.meteors || 0) + 1;
  addXp(25);
  bot.setMood('love', 1.5);
}
function catchAlien(pos) {
  S.stats.aliens = (S.stats.aliens || 0) + 1;
  const list = Math.random() < 0.3 ? [{ f: FINDS[5], k: 1, tier: 5 }] : [{ f: FINDS.find((f) => f.id === 'datacore'), k: 2, tier: 3 }];
  handleFinds(list, true);
  addXp(20);
  sfx.capsule();
  vibrate(25);
  bot.setMood('love', 1.5);
  say(pick(['Hab dich! 👽', 'Gefangen!', 'Der war flink!']), 1.4);
  floatLabel(camera, tmpV2.copy(pos).setY(pos.y + 1), '👽 gefangen!', '#7cff9a', true);
  dust.puff(pos.x, pos.y, pos.z, 6, 1.2, 0x7cff9a);
}
function openCapsule(pos) {
  const reward = capsuleReward();
  S.credits += reward; S.stats.earned += reward;
  S.stats.capsules++;
  addXp(15);
  sfx.capsule();
  vibrate(25);
  bot.setMood('happy', 2);
  say(pick(['Eine Frachtkapsel! 🎁', 'Bonus-Credits!', 'Kapsel geknackt!']));
  floatLabel(camera, tmpV2.copy(pos).setY(pos.y + 1), `+${fmt(reward)} ⬡`, '#ffb347', true);
  spawnDebris(pos.x, pos.y, pos.z, 12, 0, 0, 0.6);
  dust.puff(pos.x, pos.y, pos.z, 6, 1.4, 0xffc070);
  updateHud();
}

// ================================================================ base building: production chain
let baseCache = baseStats([]);
let baseFlow = 0;               // sorted parts per second (smoothed, for visuals/HUD)
let baseIncome = 0;             // credits per second (smoothed)
const baseAcc = { ex: 0, so: 0, exIdx: 0 };
function refreshBase() {
  baseCache = baseStats(S.sites || []);
  baseCache.supply *= 1 + SB.power;
  baseCache.eff = baseCache.demand ? Math.min(1, baseCache.supply / baseCache.demand) : 1;
  baseView.sync(S);
}
function baseTick(dt) {
  if (!S.sites || S.mode === 'pure') return;
  const st = baseCache;
  if (!st.extract && !st.sort && !st.fabTime) { baseFlow = 0; return; }
  // 1) extract raw scrap from the heap into the buffer
  const space = Math.max(0, st.buffer - S.buffer);
  baseAcc.ex += Math.min(st.extract * st.eff * dt, space);
  if (baseAcc.ex >= 1 && pile.total > 0) {
    const want = Math.floor(baseAcc.ex);
    baseAcc.ex -= want;
    const exSites = S.sites.map((b, i) => (b && b.type === 'extractor' ? i : -1)).filter((i) => i >= 0);
    const i = exSites[baseAcc.exIdx++ % exSites.length];
    const p = sitePos(i, 14.5);
    let r = pile.grab(p.x, p.z, want, 3);
    let got = r.removed, ring = r.ring;
    if (got < want) { const r2 = pile.removeRandom(want - got); got += r2.removed; ring = ring || r2.ring; }
    S.buffer += got;
    S.stats.removed += got;
    if (ring) coreFound(false);
  }
  // 2) sort the buffer into finds
  baseAcc.so += Math.min(st.sort * st.eff * dt, S.buffer);
  let earned = 0;
  if (baseAcc.so >= 1) {
    const n = Math.floor(baseAcc.so);
    baseAcc.so -= n;
    S.buffer -= n;
    const labMult = 1 + st.lab / 100;
    for (const { f, k, tier } of rollFinds(n, events.luckFactor)) {
      S.stats.found[f.id] = (S.stats.found[f.id] || 0) + k;
      if (S.keep.includes(f.id)) S.vault[f.id] = (S.vault[f.id] || 0) + k;
      else { const v = Math.round(valueOf(f) * k * labMult); S.credits += v; S.stats.earned += v; earned += v; }
      if (tier >= 4) feed(`Sortieranlage: ${f.name}!`, f.color);
    }
    baseFlow = baseFlow * 0.9 + (n / Math.max(dt, 0.016)) * 0.1;
  } else baseFlow *= 0.98;
  baseIncome = baseIncome * 0.95 + (earned / Math.max(dt, 0.016)) * 0.05;
  // 3) auto-fabricator
  if (st.fabTime) {
    S.fabT += dt * st.eff;
    if (S.fabT >= st.fabTime) {
      S.fabT = 0;
      const r = RECIPES.find((rc) => S.credits >= rc.credits && Object.entries(rc.need).every(([id, n]) => (S.vault[id] || 0) >= n));
      if (r) {
        S.credits -= r.credits;
        for (const [id, n] of Object.entries(r.need)) S.vault[id] -= n;
        giveItem(r.out, r.n);
        S.crafted++;
        const c = CONSUMABLES.find((x) => x.id === r.out);
        feed(`Auto-Fabrikator: ${c.icon} ${c.name}`, '#ffb347');
      }
    }
  }
}

let buildSel = -1;
function openBuild() {
  if (S.mode === 'pure') { hint('Im Modus „Pur“ wird nicht gebaut'); return; }
  if (S.level < BUILD_UNLOCK_LEVEL) { hint(`Bauen ab Nexus Level ${BUILD_UNLOCK_LEVEL}`); return; }
  $('build').classList.remove('hidden');
  grabState.holding = false;
  renderBuild();
}
function closeBuild() { $('build').classList.add('hidden'); buildSel = -1; save(); }
$('build-close').addEventListener('click', closeBuild);
$('btn-build').addEventListener('click', () => { initAudio(); openBuild(); });
$('btn-site').addEventListener('click', () => { initAudio(); buildSel = Number($('btn-site').dataset.site); openBuild(); });

function renderBuild() {
  const st = baseCache;
  $('build-credits').textContent = fmt(S.credits);
  const pw = $('build-power');
  pw.innerHTML = `
    <div class="bstat ${st.eff < 1 ? 'warn' : ''}"><small>⚡ Strom</small><b>${fmt(st.supply)} / ${fmt(st.demand)}</b><span>${st.eff < 1 ? `nur ${Math.round(st.eff * 100)} % Leistung!` : 'ausreichend'}</span></div>
    <div class="bstat"><small>🌀 Absaugen</small><b>${fmt(st.extract * st.eff)}/s</b><span>Teile aus dem Berg</span></div>
    <div class="bstat"><small>⚙️ Sortieren</small><b>${fmt(st.sort * st.eff)}/s</b><span>${st.lab ? `+${st.lab} % Wert (Labor)` : 'Teile zu Funden'}</span></div>
    <div class="bstat"><small>🛢️ Rohschrott</small><b>${fmt(S.buffer)} / ${fmt(st.buffer)}</b><span>${fmt(baseIncome)} ⬡/s Ertrag</span></div>`;
  const list = $('build-list');
  list.innerHTML = '';
  if (buildSel >= 0) {
    const i = buildSel;
    const b = S.sites[i];
    const back = document.createElement('button');
    back.className = 'ghost'; back.textContent = '← Alle Bauplätze';
    back.onclick = () => { buildSel = -1; renderBuild(); };
    list.appendChild(back);
    if (!b) {
      const h = document.createElement('p'); h.className = 'lead small'; h.textContent = `Bauplatz ${i + 1}: Was soll hier entstehen?`; list.appendChild(h);
      for (const [type, d] of Object.entries(BUILDINGS)) {
        const cost = buildCost(type, 0);
        shopItem(list, {
          title: `${d.icon} ${d.name}`, desc: `${d.desc}<br>Stufe 1: ${fmt(d.values[0])} ${d.stat}${d.power ? ` · ⚡ ${d.power}` : ''}`,
          btn: `${fmt(cost)} ⬡`, disabled: S.credits < cost,
          onBuy: () => {
            if (!pay(cost)) return;
            S.sites[i] = { type, lvl: 1 };
            refreshBase();
            sfx.upgrade(); vibrate(30);
            say(pick([`${d.name} gebaut! 🏗️`, 'Die Station wächst!', 'Neue Anlage online!']));
            feed(`Gebaut: ${d.icon} ${d.name}`, '#ffb347');
            buildSel = -1; renderBuild(); updateHud(); save();
          },
        });
      }
    } else {
      const d = BUILDINGS[b.type];
      const next = b.lvl < MAX_BLD_LEVEL ? buildCost(b.type, b.lvl) : 0;
      shopItem(list, {
        title: `${d.icon} ${d.name} · Stufe ${b.lvl}`,
        desc: `${d.desc}<br>${fmt(bldValue(b))} ${d.stat}${next ? ` → <b>${fmt(d.values[b.lvl])} ${d.stat}</b>` : ''}${d.power ? ` · ⚡ ${d.power * b.lvl}${next ? ` → ${d.power * (b.lvl + 1)}` : ''}` : ''}`,
        levels: dots(MAX_BLD_LEVEL, b.lvl),
        btn: next ? `${fmt(next)} ⬡` : 'MAX', disabled: !next || S.credits < next,
        onBuy: () => {
          if (!next || !pay(next)) return;
          b.lvl++;
          refreshBase();
          sfx.upgrade(); vibrate(30);
          feed(`${d.name} → Stufe ${b.lvl}`, '#ffb347');
          renderBuild(); updateHud(); save();
        },
      });
      const refund = Math.round(Array.from({ length: b.lvl }, (_, k) => buildCost(b.type, k)).reduce((a, c) => a + c, 0) * 0.5);
      const del = document.createElement('button');
      del.className = 'ghost'; del.style.color = '#ff9a8a';
      del.textContent = `Abreißen (+${fmt(refund)} ⬡)`;
      del.onclick = () => { S.sites[i] = null; S.credits += refund; refreshBase(); sfx.click(); buildSel = -1; renderBuild(); updateHud(); save(); };
      list.appendChild(del);
    }
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'site-grid';
  for (let i = 0; i < SITE_ANGLES.length; i++) {
    const b = S.sites[i];
    const unlocked = i < S.sitesUnlocked;
    const el = document.createElement('button');
    el.className = 'site' + (b ? ' built' : unlocked ? ' free' : ' locked');
    if (b) { const d = BUILDINGS[b.type]; el.innerHTML = `<span class="ico">${d.icon}</span><b>${d.name}</b><small>Stufe ${b.lvl}</small>`; }
    else if (unlocked) el.innerHTML = '<span class="ico">➕</span><b>Bauplatz frei</b><small>tippen zum Bauen</small>';
    else if (i === S.sitesUnlocked) el.innerHTML = `<span class="ico">🔒</span><b>Bauplatz kaufen</b><small>${fmt(SITE_COSTS[i])} ⬡</small>`;
    else el.innerHTML = '<span class="ico">🔒</span><b>gesperrt</b><small>&nbsp;</small>';
    el.onclick = () => {
      if (b || unlocked) { buildSel = i; sfx.click(); renderBuild(); return; }
      if (i !== S.sitesUnlocked) return;
      if (!pay(SITE_COSTS[i])) return;
      S.sitesUnlocked++;
      refreshBase(); sfx.upgrade(); feed('Neuer Bauplatz frei!', '#6ff3f0');
      renderBuild(); updateHud(); save();
    };
    grid.appendChild(el);
  }
  list.appendChild(grid);
  const tip = document.createElement('p');
  tip.className = 'lead small';
  tip.innerHTML = 'Kette: <b>Schrottsauger</b> holt Rohschrott → <b>Silo</b> puffert → <b>Sortieranlage</b> macht Funde und Credits. Alle Anlagen brauchen <b>Strom</b> vom <b>Reaktor</b>. Die Anlage arbeitet auch, wenn du offline bist (bis 2 h).';
  list.appendChild(tip);
}

// ================================================================ Nexus Prime: modular space station (meta progression)
let stationMode = false, stSel = null, teleT = 45;
const stCam = { yaw: 0.7, pitch: 0.35, dist: 52 };
function openStation() {
  if (S.mode === 'pure') { hint('Im Modus „Pur“ gibt es keine Station'); return; }
  stationMode = true; stSel = null;
  grabState.holding = false;
  hud.classList.add('hidden');
  $('station-panel').classList.remove('hidden');
  stationView.sync(S.station, true, null);
  sfx.event();
  renderStation();
}
function closeStation() {
  stationMode = false; stSel = null;
  $('station-panel').classList.add('hidden');
  hud.classList.remove('hidden');
  stationView.sync(S.station, false, null);
  save();
}
$('btn-station').addEventListener('click', () => { initAudio(); openStation(); });
$('station-close').addEventListener('click', closeStation);
function stationCamera(dt) {
  const c = stationView.root.position;
  const cp = Math.cos(stCam.pitch);
  tmpV.set(c.x + Math.sin(stCam.yaw) * cp * stCam.dist, c.y + Math.sin(stCam.pitch) * stCam.dist, c.z + Math.cos(stCam.yaw) * cp * stCam.dist);
  camera.position.lerp(tmpV, Math.min(1, dt * 3));
  camera.lookAt(c.x, c.y - stCam.dist * 0.28, c.z);   // keep the station in the upper half, above the panel
}
function stationTap(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...stationView.markers.children, ...stationView.modules.children], true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.free && !o.userData.cell && o.parent) o = o.parent;
    if (o && o.userData.free) { stSel = { free: o.userData.free }; break; }
    if (o && o.userData.cell) { stSel = { mod: o.userData.cell }; break; }
  }
  sfx.click();
  stationView.sync(S.station, true, stSel && stSel.free);
  renderStation();
}
function stationTick(dt) {
  if ((S.evo || 1) >= 4 && !stationMode) {
    const p = bot.group.position;
    const cap = S.mode !== 'pure' && capsules.take(p.x, p.z, 5);
    if (cap) openCapsule(cap.position);
    const met = events.take(p.x, p.z, 5);
    if (met) openMeteor(met);
    const al = events.catchAlien(p.x, p.z, 5);
    if (al) catchAlien(al);
  }
  if (SB.teleport && S.cargoCount > 0 && !S.levels.link) {
    teleT -= dt;
    if (teleT <= 0) { teleT = 45; const v = sellCargo(); feed(`🌀 Teleport-Relais: +${fmt(v)} ⬡`, '#b48cff'); }
  }
}
function canPayModule(type, lvl) {
  const [tons, cr] = moduleCost(type, lvl);
  const rare = lvl === 0 ? (MODULES_ST[type].rare || {}) : {};
  const rareOk = Object.entries(rare).every(([id, n]) => (S.vault[id] || 0) >= n);
  return { tons, cr, rare, ok: tonsAvail() >= tons && S.credits >= cr && rareOk };
}
function rareText(rare) {
  return Object.entries(rare).map(([id, n]) => `${n}× ${FINDS.find((f) => f.id === id).name} (Lager ${S.vault[id] || 0})`).join(', ');
}
function renderStation() {
  const mods = S.station;
  const rank = stationRank(mods);
  const next = RANKS[rank + 1];
  $('st-title').textContent = `Nexus Prime · ${RANKS[rank].name}`;
  $('st-res').innerHTML = `🧱 <b>${fmt(tonsAvail())} t</b> Schrott · ⬡ <b>${fmt(S.credits)}</b> · ${mods.length} Module${next ? ` · nächster Rang ab ${next.modules}` : ''}`;
  const list = $('st-list');
  list.innerHTML = '';
  if (!stSel) {
    const b = SB;
    const parts = [];
    if (b.value || b.all) parts.push(`+${Math.round((b.value + b.all) * 100)} % Fundwert`);
    if (b.xp) parts.push(`+${Math.round(b.xp * 100)} % XP`);
    if (b.power) parts.push(`+${Math.round(b.power * 100)} % Strom`);
    if (b.cargo) parts.push(`+${Math.round(b.cargo * 100)} % Laderaum`);
    if (b.drones) parts.push(`+${Math.round(b.drones * 100)} % Drohnen`);
    if (b.events) parts.push(`+${Math.round(b.events * 100)} % Ereignisse`);
    if (b.rare) parts.push(`+${Math.round(b.rare * 100)} % seltene Funde`);
    if (b.teleport) parts.push('Teleport-Relais aktiv');
    list.innerHTML = `<p class="lead small">Tippe eine <b style="color:#6ff3f0">leuchtende Anbauposition</b> an, um ein Modul zu bauen, oder ein Modul, um es auszubauen. Ziehen dreht die Ansicht. Baumaterial: 1 t Schrott je 1.000 weggeräumte Teile.</p>
      <p class="lead small"><b>Stations-Boni (dauerhaft, alle Decks):</b><br>${parts.length ? parts.join(' · ') : 'noch keine – bau dein erstes Modul!'}</p>`;
    return;
  }
  if (stSel.free) {
    const c = stSel.free;
    const h = document.createElement('p'); h.className = 'lead small'; h.textContent = `Anbauposition (${c.x}, ${c.y}, ${c.z}): Welches Modul?`; list.appendChild(h);
    for (const [type, d] of Object.entries(MODULES_ST)) {
      const built = mods.filter((m) => m.type === type).length;
      if (d.max === 1 && type !== 'corridor' && built >= 1) continue;
      const pay = canPayModule(type, 0);
      const locked = rank < d.rank;
      shopItem(list, {
        title: `${d.icon} ${d.name}${built ? ` <span style="color:var(--muted)">× ${built}</span>` : ''}`,
        desc: `${d.desc}<br>🧱 ${fmt(pay.tons)} t · ⬡ ${fmt(pay.cr)}${Object.keys(pay.rare).length ? ` · ${rareText(pay.rare)}` : ''}`,
        btn: locked ? `🔒 ${RANKS[d.rank].name}` : 'Bauen', disabled: locked || !pay.ok, cls: locked ? 'locked' : '',
        onBuy: () => {
          const p2 = canPayModule(type, 0);
          if (locked || !p2.ok) return;
          const rankBefore = stationRank(S.station);
          S.tonsSpent += p2.tons; S.credits -= p2.cr;
          for (const [id, n] of Object.entries(p2.rare)) S.vault[id] -= n;
          S.station.push({ type, x: c.x, y: c.y, z: c.z, lvl: 1 });
          stationChanged(rankBefore, `${d.icon} ${d.name} angebaut!`);
        },
      });
    }
  } else if (stSel.mod) {
    const m = stSel.mod;
    const d = MODULES_ST[m.type];
    const can = (m.lvl || 1) < d.max;
    const pay = can ? canPayModule(m.type, m.lvl) : null;
    shopItem(list, {
      title: `${d.icon} ${d.name} · Stufe ${m.lvl || 1}`,
      desc: `${d.desc}${can ? `<br>Ausbau: 🧱 ${fmt(pay.tons)} t · ⬡ ${fmt(pay.cr)}` : ''}`,
      levels: dots(d.max, m.lvl || 1),
      btn: can ? 'Ausbauen' : 'MAX', disabled: !can || !pay.ok,
      onBuy: () => {
        const p2 = canPayModule(m.type, m.lvl);
        if (!p2.ok) return;
        S.tonsSpent += p2.tons; S.credits -= p2.cr;
        m.lvl = (m.lvl || 1) + 1;
        stationChanged(stationRank(S.station), `${d.icon} ${d.name} → Stufe ${m.lvl}`);
      },
    });
  }
  const back = document.createElement('button');
  back.className = 'ghost'; back.textContent = '← Übersicht';
  back.onclick = () => { stSel = null; stationView.sync(S.station, true, null); renderStation(); };
  list.appendChild(back);
}
function stationChanged(rankBefore, text) {
  refreshStationBonus();
  refreshBase();
  stSel = null;
  stationView.sync(S.station, true, null);
  sfx.upgrade(); vibrate(30);
  feed(text, '#6ff3f0');
  const r = stationRank(S.station);
  if (r > rankBefore) achvQueue.push({ kicker: 'Stationsrang!', name: `🛰️ ${RANKS[r].name}`, desc: 'Neue Module freigeschaltet!', reward: 0 });
  renderStation(); updateHud(); save();
}

// ================================================================ confetti (DOM, light-weight)
function confetti(n = 60) {
  const layer = $('confetti');
  const cols = ['#6ff3f0', '#ffb347', '#ffd34d', '#7cf0b0', '#e58cff', '#ffffff'];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('i');
    c.style.left = `${50 + (Math.random() - 0.5) * 40}%`;
    c.style.background = cols[k % cols.length];
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}vw`);
    c.style.setProperty('--dy', `${40 + Math.random() * 60}vh`);
    c.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    c.style.animationDuration = `${1.4 + Math.random() * 1.2}s`;
    c.style.width = `${6 + Math.random() * 6}px`; c.style.height = `${8 + Math.random() * 8}px`;
    layer.appendChild(c);
    setTimeout(() => c.remove(), 2800);
  }
}

// ================================================================ milestones: every 10 % of a deck
function checkMilestones() {
  if (S.mode === 'pure') return;
  const total = S.total || TOTAL_STONES;
  const pct = Math.floor(((total - pile.total) / total) * 100);
  const reached = Math.floor(pct / 10) * 10;
  S.milestone = S.milestone || 0;
  if (reached > S.milestone && reached > 0) {
    S.milestone = reached;
    const reward = Math.round((300 + reached * 40) * deckValueMult(S.deck || 0) * (1 + (S.level || 1) * 0.1));
    S.credits += reward;
    addXp(25 + reached);
    achvQueue.push({ kicker: 'Meilenstein!', name: `🏁 ${reached} % geschafft`, desc: `Bonus: +${fmt(reward)} ⬡`, reward: 0 });
    say(pick([`${reached} %! Wir sind ein super Team! 🎉`, `Schon ${reached} % – weiter so! 💪`, `${reached} % sortiert! Ich bin stolz auf uns! 🤖`]), 3);
  }
}

// ================================================================ deck stars (3 per deck)
function totalStars() {
  const ds = records.deckStars || {};
  return Object.values(ds).reduce((a, b) => a + (b & 1 ? 1 : 0) + (b & 2 ? 1 : 0) + (b & 4 ? 1 : 0), 0);
}
function deckGoalProgress(st = S) {
  const g = deckDef(st.deck || 0).goal, b = st.deckBase || { removed: 0, found: {}, aliens: 0 };
  if (g.key === 'removed') return st.stats.removed - (b.removed || 0);
  if (g.key === 'aliens') return (st.stats.aliens || 0) - (b.aliens || 0);
  return (st.stats.found[g.key] || 0) - ((b.found || {})[g.key] || 0);
}
const deckTime = () => (S.coreFound ? S.coreTime : S.stats.time) - ((S.deckBase && S.deckBase.time) || 0);
function deckStarBits() {
  let bits = 0;
  if (S.coreFound) bits |= 1;
  if (S.coreFound && deckTime() <= deckMinutes(S.deck || 0) * 60) bits |= 2;
  if (deckGoalProgress() >= deckGoalTarget(S.deck || 0)) bits |= 4;
  return bits;
}
function checkDeckStars() {
  if (S.mode === 'pure') return;
  records.deckStars = records.deckStars || {};
  const n = S.deck || 0;
  const had = records.deckStars[n] || 0;
  const now = had | deckStarBits();
  if (now === had) return;
  records.deckStars[n] = now;
  saveRecords();
  S.stars = totalStars();
  const names = { 1: 'Nexus-Kern gefunden', 2: `Kern in unter ${deckMinutes(n)} Minuten`, 4: deckDef(n).goal.label.replace('Sortiere', 'Sortiert').replace('Sammle', 'Gesammelt:').replace('Finde', 'Gefunden:').replace('Fange', 'Gefangen:') };
  for (const bit of [1, 2, 4]) {
    if ((now & bit) && !(had & bit)) achvQueue.push({ kicker: `Deck-Stern · ${deckName(n)}`, name: '⭐ ' + names[bit], desc: `Jetzt ${S.stars} Sterne = +${S.stars * 25} % Fundwert`, reward: 0 });
  }
}

// ================================================================ achievements
let achvT = 1;
const achvQueue = [];
function checkAchievements(dt) {
  achvT -= dt;
  if (achvT > 0) return;
  achvT = 1;
  for (const a of ACHIEVEMENTS) {
    if (S.achievements.includes(a.id) || !a.check(S)) continue;
    S.achievements.push(a.id);
    if (S.mode !== 'pure') { S.credits += a.reward; }
    achvQueue.push(a);
  }
  if (achvQueue.length && !$('achv').classList.contains('show')) showAchievement(achvQueue.shift());
}
function showAchievement(a) {
  confetti(a.kicker && a.kicker.startsWith('Meilenstein') ? 40 : 70);
  const el = $('achv');
  el.innerHTML = `<small>${a.kicker || 'Erfolg freigeschaltet'}</small><b>${a.kicker ? '' : '🏆 '}${a.name}</b><span>${a.desc}${S.mode !== 'pure' && a.reward ? ` · +${fmt(a.reward)} ⬡` : ''}</span>`;
  el.classList.add('show');
  sfx.achievement();
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { if (achvQueue.length) showAchievement(achvQueue.shift()); }, 400);
  }, 3200);
  save();
}

function scannerPing() {
  if (S.levels.scanner < 2 || S.coreFound) return;
  const heat = scannerHeat();
  sfx.ping(heat);
  if (heat > 0.85) { bot.setMood('love', 1); if (chatter.t <= 0 && Math.random() < 0.08) say(pick(LINES.hot)); }
  else if (heat > 0.6 && bot.mood === 'normal') bot.setMood('curious', 1);
}
function scannerHeat() {
  const rp = pile.ringPosition();
  const d = Math.hypot(rp.x - bot.group.position.x, rp.z - bot.group.position.z);
  const h = Math.max(0, Math.min(1, 1 - d / 22));
  return h * h * (3 - 2 * h);
}
function updateScannerHud() {
  if (S.levels.scanner < 2 || S.coreFound) return;
  const heat = scannerHeat();
  const fill = $('heat-fill');
  fill.style.width = `${Math.round(heat * 100)}%`;
  fill.style.backgroundColor = `hsl(${200 - heat * 200}, 90%, 55%)`;
  const words = ['eiskalt', 'kalt', 'kühl', 'lauwarm', 'warm', 'heiß', 'glühend!'];
  let txt = words[Math.min(words.length - 1, Math.floor(heat * words.length))];
  if (S.levels.scanner >= 3) {
    const rp = pile.ringPosition();
    const d = Math.hypot(rp.x - bot.group.position.x, rp.z - bot.group.position.z);
    if (d < 3) txt += ` · noch ${fmt(pile.stonesAboveRing())} Teile darüber`;
  }
  setText('heat-text', txt);
}

// ================================================================ turbo ability
const turbo = { t: 0, cd: 0 };
function useTurbo() {
  if (!playing || turbo.cd > 0) { if (turbo.cd > 0) sfx.deny(); return; }
  initAudio();
  turbo.t = turboDur();
  turbo.cd = turboCd();
  sfx.turbo();
  vibrate(40);
  bot.setMood('work', turboDur());
  say('TURBO! 💨', 1.5);
  grabState.holding = true; grabState.timer = 0;
  setTimeout(() => { if (!grabBtn.classList.contains('active')) grabState.holding = false; }, turboDur() * 1000);
}
function updateTurbo(dt) {
  turbo.t = Math.max(0, turbo.t - dt);
  turbo.cd = Math.max(0, turbo.cd - dt);
  const btn = $('btn-turbo');
  const frac = turbo.t > 0 ? turbo.t / turboDur() : 1 - turbo.cd / turboCd();
  btn.style.setProperty('--p', `${Math.round(frac * 360)}deg`);
  btn.classList.toggle('active', turbo.t > 0);
  btn.classList.toggle('ready', turbo.t <= 0 && turbo.cd <= 0);
  bot.glowMat.color.setHex(turbo.t > 0 ? 0xffb347 : (bot.linkGlow ? 0xb48cff : (bot.skinGlow || 0x6ff3f0)));
}

// ================================================================ automation
let autoAcc = 0;
function automationTick(dt) {
  const rate = helperRate();
  if (!rate || pile.total === 0) return;
  autoAcc += rate * dt;
  if (autoAcc < 1) return;
  const take = Math.floor(autoAcc);
  autoAcc -= take;
  const r = pile.removeRandom(take);
  S.stats.removed += r.removed;
  handleFinds(rollFinds(r.removed, events.luckFactor), false);
  if (r.ring) coreFound(false);
}

function offlineProgress() {
  baseCache = baseStats(S.sites || []);
  const baseRate = S.mode === 'pure' ? 0 : Math.min(baseCache.extract, baseCache.sort) * baseCache.eff;
  const rate = helperRate() + baseRate;
  if (!rate || !S.lastSave) return;
  const secs = Math.min((Date.now() - S.lastSave) / 1000, 2 * 3600);
  if (secs < 30) return;
  let amount = Math.floor(rate * secs);
  const before = pile.total;
  let ring = false, guard = 0;
  while (amount > 0 && pile.total > 0 && guard++ < 40000) {
    const r = pile.removeRandom(Math.min(amount, 2000));
    amount -= Math.max(1, r.removed);
    if (r.ring) ring = true;
  }
  for (let p = 0; p < 300 && pile.dirty.size; p++) pile.relaxStep();
  const removed = before - pile.total;
  S.stats.removed += removed;
  let credits = 0;
  for (const { f, k } of rollFinds(removed)) { S.stats.found[f.id] = (S.stats.found[f.id] || 0) + k; credits += valueOf(f) * k; }
  S.credits += credits; S.stats.earned += credits;
  showMessage('Willkommen zurück!',
    `<p class="lead">Deine Helfer haben in <b>${Math.round(secs / 60)} Minuten</b> weitergearbeitet.</p>
     <div class="stats"><span>Sortierte Teile</span><span>${fmt(removed)}</span><span>Erlös</span><span>+${fmt(credits)} ⬡</span></div>`,
    'Weiter', () => { if (ring) coreFound(false); });
}

// ================================================================ core found / win
function coreFound(byPlayer) {
  if (S.coreFound) return;
  S.coreFound = true;
  S.coreTime = S.stats.time;
  pile.ring.found = true;
  records.cores = (records.cores || 0) + 1;
  records.deckTimes = records.deckTimes || {};
  const dt0 = S.stats.time - ((S.deckBase && S.deckBase.time) || S.deckStart || 0);
  if (!records.fastest || dt0 < records.fastest) records.fastest = dt0;
  if (!records.deckTimes[S.deck || 0] || dt0 < records.deckTimes[S.deck || 0]) records.deckTimes[S.deck || 0] = dt0;
  saveRecords();
  sfx.core();
  vibrate([40, 60, 120]);
  bot.setMood('love', 6);
  const p = bot.group.position;
  for (let k = 0; k < 4; k++) setTimeout(() => spawnDebris(p.x, p.y + 1, p.z, 25, 0, 0, 0.6), k * 200);
  save();
  setTimeout(() => {
    showMessage('💠 Nexus-Kern gefunden!',
      `<p class="lead">${byPlayer ? 'Dein Nexus-Bot hat' : 'Einer deiner Helfer hat'} den Kern aus dem Schrott gezogen. Die Station läuft wieder auf voller Leistung!</p>
       <div class="stats">
         <span>Zeit auf diesem Deck</span><span>${formatTime(deckTime())} ${deckTime() <= deckMinutes(S.deck || 0) * 60 ? '⭐' : `(Ziel ${deckMinutes(S.deck || 0)} min)`}</span>
         <span>${deckDef(S.deck || 0).goal.label.replace(/\d[\d.]*/, fmt(deckGoalTarget(S.deck || 0)))}</span><span>${fmt(Math.min(deckGoalProgress(), deckGoalTarget(S.deck || 0)))} / ${fmt(deckGoalTarget(S.deck || 0))}</span>
         <span>Davon übrig</span><span>${fmt(pile.total)}</span>
         <span>Sterne gesamt</span><span>⭐ ${totalStars()}</span>
       </div>
       <p class="lead">Weiter aufräumen (fehlende Sterne holen) – oder ab zum nächsten Deck: <b>${deckName((S.deck || 0) + 1)}</b>, ${Math.round((deckTotal((S.deck || 0) + 1) / 1e6) * 10) / 10} Mio. Teile, Funde +${Math.round((deckValueMult((S.deck || 0) + 1) - 1) * 100)} % wert. Du nimmst <b>alles</b> mit: Credits, Upgrades, Drohnen, Anlagen, Station.</p>`,
      'Weiter aufräumen', () => {},
      S.mode === 'pure' ? 'Neues Spiel' : `Nächstes Deck ▶ ${deckName((S.deck || 0) + 1)}`,
      () => (S.mode === 'pure' ? newGame('pure') : nextDeck()));
  }, 1600);
}

function formatTime(s) {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h} h ${m} min` : `${m} min ${sec} s`;
}

// ================================================================ shop
let shopTab = 'bot', archTab = 'deck';
function openShop() {
  if (S.mode === 'pure') { hint('Im Modus „Pur“ gibt es keinen Shop'); return; }
  $('shop').classList.remove('hidden');
  grabState.holding = false;
  renderShop();
}
function closeShop() { $('shop').classList.add('hidden'); save(); }
function openArchive() { $('archive').classList.remove('hidden'); grabState.holding = false; renderArchive(); }
function closeArchive() { $('archive').classList.add('hidden'); }
$('shop-close').addEventListener('click', closeShop);
$('archive-close').addEventListener('click', closeArchive);
$('btn-dock').addEventListener('click', () => { initAudio(); openShop(); });
$('btn-archive').addEventListener('click', () => { initAudio(); openArchive(); });
document.querySelectorAll('#shop .tab').forEach((t) => t.addEventListener('click', () => {
  shopTab = t.dataset.tab;
  document.querySelectorAll('#shop .tab').forEach((x) => x.classList.toggle('active', x === t));
  renderShop();
}));
document.querySelectorAll('#archive .tab').forEach((t) => t.addEventListener('click', () => {
  archTab = t.dataset.tab;
  document.querySelectorAll('#archive .tab').forEach((x) => x.classList.toggle('active', x === t));
  renderArchive();
}));

// generic shop row
function shopItem(list, { title, desc, levels = null, btn, disabled = false, cls = '', onBuy = null, extra = '' }) {
  const el = document.createElement('div');
  el.className = 'item ' + cls;
  el.innerHTML = `<div class="t">${title}</div><div class="d">${desc}</div>${levels ? `<div class="lv">${levels}</div>` : ''}${extra}`;
  const b = document.createElement('button');
  b.className = 'buy' + (btn === 'MAX' || btn === 'AKTIV' || btn === 'AUSGERÜSTET' ? ' max' : '');
  b.textContent = btn;
  b.disabled = disabled;
  if (onBuy) b.onclick = onBuy;
  el.appendChild(b);
  list.appendChild(el);
}
function pay(cost) {
  if (S.credits < cost) { sfx.deny(); return false; }
  S.credits -= cost;
  return true;
}
function bought(text) {
  bot.setMood('happy', 2.5);
  sfx.upgrade();
  vibrate(30);
  feed(text, '#ffb347');
  renderShop(); updateHud(); save();
}
const dots = (n, cur) => Array.from({ length: n }, (_, i) => `<i class="${i < cur ? 'on' : ''}"></i>`).join('');

function renderShop() {
  $('shop-credits').textContent = fmt(S.credits);
  const v = cargoValue();
  $('shop-note').textContent = v
    ? `Im Laderaum: ${fmt(S.cargoCount)} Funde (${fmt(v)} ⬡) – verkaufen an der Nexus-Ablage (türkiser Strahl).`
    : (S.levels.link ? 'Nexus-Link aktiv: Funde werden sofort verkauft.' : 'Funde verkaufst du an der Nexus-Ablage (türkiser Strahl).');
  const list = $('shop-list');
  list.innerHTML = '';

  if (shopTab === 'bot') {
    for (const [key, up] of Object.entries(BOT_UPGRADES)) {
      const cur = S.levels[key];
      const next = up.levels[cur + 1];
      const curL = up.levels[cur];
      const desc = next ? (next.desc || `${fmt(curL.value)} → <b>${fmt(next.value)}</b> ${up.unit}`) : (curL.desc || `${fmt(curL.value)} ${up.unit}`);
      shopItem(list, {
        title: `${up.title}: ${next ? next.name : curL.name}`, desc, levels: dots(up.levels.length - 1, cur),
        btn: next ? `${fmt(next.cost)} ⬡` : 'MAX', disabled: !next || S.credits < next.cost,
        onBuy: () => {
          if (!next || !pay(next.cost)) return;
          S.levels[key]++;
          bot.applyUpgrades(S.levels);
          say(pick(LINES.upgrade));
          bought(`Upgrade: ${next.name}`);
        },
      });
    }
  } else if (shopTab === 'chassis') {
    const intro = document.createElement('p');
    intro.className = 'lead small';
    intro.textContent = 'Fahrwerke einmal kaufen, danach jederzeit kostenlos wechseln. Der Antrieb (Nexus-Bot-Tab) wirkt auf jedes Fahrwerk.';
    list.appendChild(intro);
    for (const c of CHASSIS) {
      const owned = S.chassisOwned.includes(c.id);
      const active = S.chassis === c.id;
      const stats = `Tempo ×${c.speed.toLocaleString('de-DE')} · Hang ${c.slope < 0.1 ? 'kein Problem' : c.slope < 0.4 ? 'gut' : c.slope < 0.8 ? 'mittel' : 'schwer'}${c.reach ? ` · Reichweite +${c.reach.toLocaleString('de-DE')} m` : ''}`;
      shopItem(list, {
        title: `${{ tracks: '🛞', wheels: '⚙️', feet: '🦿', spider: '🕷️' }[c.id]} ${c.name}`, desc: `${c.desc}<br>${stats}`,
        btn: active ? 'AKTIV' : owned ? 'Ausrüsten' : `${fmt(c.cost)} ⬡`,
        disabled: active || (!owned && S.credits < c.cost),
        cls: active ? 'got' : '',
        onBuy: () => {
          if (!owned) { if (!pay(c.cost)) return; S.chassisOwned.push(c.id); }
          S.chassis = c.id;
          bot.setChassis(c.id);
          say(pick({ wheels: ['Wrrrumm! 🛞', 'Räder! Ab geht’s!'], feet: ['Ich kann laufen! 🦿', 'Schritt für Schritt…'], spider: ['Acht… nein, sechs Beine! 🕷️', 'Jetzt klettere ich überall hoch!'], tracks: ['Gute alte Raupen.'] }[c.id]));
          bought(`Fahrwerk: ${c.name}`);
        },
      });
    }
  } else if (shopTab === 'evo') {
    const cur = EVOLUTION[(S.evo || 1) - 1], next = EVOLUTION[S.evo || 1];
    const intro = document.createElement('p');
    intro.className = 'lead small';
    intro.innerHTML = `Aktuell: <b>${cur.name}</b>. Evolutionen bleiben über alle Decks erhalten und verändern Nexus sichtbar.`;
    list.appendChild(intro);
    for (const ev of EVOLUTION.slice(1)) {
      const have = (S.evo || 1) >= ev.mk;
      const isNext = next && next.mk === ev.mk;
      const okLv = (S.level || 1) >= ev.level, okT = tonsAvail() >= ev.tons, okC = S.credits >= ev.credits;
      shopItem(list, {
        title: `🤖 ${ev.name}`,
        desc: `${ev.perk}<br><span class="recipe"><span class="${okLv || have ? 'ok' : 'miss'}">Level ${ev.level}</span> · <span class="${okT || have ? 'ok' : 'miss'}">🧱 ${fmt(ev.tons)} t</span> · <span class="${okC || have ? 'ok' : 'miss'}">${fmt(ev.credits)} ⬡</span></span>`,
        btn: have ? 'ERREICHT' : isNext ? 'Entwickeln' : '🔒', disabled: have || !isNext || !(okLv && okT && okC), cls: have ? 'got' : '',
        onBuy: () => {
          if (!(isNext && okLv && okT && okC)) return;
          S.credits -= ev.credits; S.tonsSpent += ev.tons; S.evo = ev.mk;
          bot.setEvolution(ev.mk);
          dust.puff(bot.group.position.x, bot.group.position.y + 0.5, bot.group.position.z, 12, 1.8, 0x6ff3f0);
          sfx.core(); vibrate([40, 40, 80]);
          bot.setMood('love', 4);
          say(`Ich bin jetzt ${ev.name}! ✨`, 4);
          achvQueue.push({ kicker: 'Evolution!', name: `🤖 ${ev.name}`, desc: ev.perk, reward: 0 });
          bought(`Evolution: ${ev.name}`);
        },
      });
    }
  } else if (shopTab === 'tools') {
    const intro = document.createElement('p');
    intro.className = 'lead small';
    intro.textContent = 'Werkzeuge ersetzen oder ergänzen Nexus’ Arme. Einmal kaufen, dann jederzeit wechseln.';
    list.appendChild(intro);
    for (const tl of TOOLS) {
      const owned = S.toolsOwned.includes(tl.id);
      const active = S.tool === tl.id;
      const stats = [tl.amount !== 1 ? `Teile ×${tl.amount.toLocaleString('de-DE')}` : '', tl.speed !== 1 ? `Tempo ×${tl.speed.toLocaleString('de-DE')}` : '', tl.rare !== 1 ? `Seltene ×${tl.rare.toLocaleString('de-DE')}` : '', tl.pickup ? `Anziehen +${tl.pickup.toLocaleString('de-DE')} m` : ''].filter(Boolean).join(' · ');
      shopItem(list, {
        title: `${tl.icon} ${tl.name}`, desc: `${tl.desc}${stats ? `<br>${stats}` : ''}`,
        btn: active ? 'AKTIV' : owned ? 'Ausrüsten' : `${fmt(tl.cost)} ⬡`,
        disabled: active || (!owned && S.credits < tl.cost), cls: active ? 'got' : '',
        onBuy: () => {
          if (!owned) { if (!pay(tl.cost)) return; S.toolsOwned.push(tl.id); }
          S.tool = tl.id;
          bot.setTool(tl.id);
          say(pick({ crane: ['Kran ausgefahren! 🏗️'], vacuum: ['Schlürf! 🌀', 'Staubsauger an!'], drill: ['Brrrrr! 🔩', 'Ich bohre mich durch!'], arms: ['Zurück zu den Wurzeln.'] }[tl.id]));
          bought(`Werkzeug: ${tl.name}`);
        },
      });
    }
  } else if (shopTab === 'modules') {
    const slots = MODULE_SLOTS[S.slotLv].slots + ((S.evo || 1) >= 3 ? 1 : 0);
    const nextSlot = MODULE_SLOTS[S.slotLv + 1];
    shopItem(list, {
      title: `🔧 Modul-Slots: ${S.equipped.length}/${slots} belegt`,
      desc: nextSlot ? `Erweitern auf ${nextSlot.slots} Slots` : 'Maximale Anzahl Slots',
      levels: dots(MODULE_SLOTS.length - 1, S.slotLv),
      btn: nextSlot ? `${fmt(nextSlot.cost)} ⬡` : 'MAX', disabled: !nextSlot || S.credits < nextSlot.cost,
      onBuy: () => { if (!nextSlot || !pay(nextSlot.cost)) return; S.slotLv++; bought(`${nextSlot.slots} Modul-Slots`); },
    });
    for (const m of MODULES) {
      const owned = S.modules.includes(m.id);
      const on = S.equipped.includes(m.id);
      shopItem(list, {
        title: `${m.icon} ${m.name}`, desc: m.desc,
        btn: on ? 'Ablegen' : owned ? (S.equipped.length >= slots ? 'Slots voll' : 'Ausrüsten') : `${fmt(m.cost)} ⬡`,
        disabled: !on && (owned ? S.equipped.length >= slots : S.credits < m.cost),
        cls: on ? 'got' : '',
        onBuy: () => {
          if (on) { S.equipped = S.equipped.filter((x) => x !== m.id); sfx.click(); renderShop(); save(); return; }
          if (!owned) { if (!pay(m.cost)) return; S.modules.push(m.id); }
          if (S.equipped.length < slots) S.equipped.push(m.id);
          say(`${m.name} installiert! ${m.icon}`);
          bought(`Modul: ${m.name}`);
        },
      });
    }
  } else if (shopTab === 'helpers') {
    const core = ATOMAR_CORE[S.atomarLv], nextCore = ATOMAR_CORE[S.atomarLv + 1];
    shopItem(list, {
      title: `⚛️ ${nextCore ? nextCore.name : core.name}`,
      desc: nextCore ? `Alle Atomar-Drohnen ×${core.mult.toLocaleString('de-DE')} → <b>×${nextCore.mult.toLocaleString('de-DE')}</b>` : `Alle Atomar-Drohnen ×${core.mult.toLocaleString('de-DE')}`,
      levels: dots(ATOMAR_CORE.length - 1, S.atomarLv),
      btn: nextCore ? `${fmt(nextCore.cost)} ⬡` : 'MAX', disabled: !nextCore || S.credits < nextCore.cost,
      onBuy: () => { if (!nextCore || !pay(nextCore.cost)) return; S.atomarLv++; rebuildDrones(); bought(nextCore.name); },
    });
    for (const h of HELPERS) {
      const owned = S.helpers[h.id] || 0;
      const cost = helperCost(h, owned);
      shopItem(list, {
        title: `⚛️ ${h.name} <span style="color:var(--muted)">× ${owned}</span>`,
        desc: `${h.desc} · ${fmt(h.rate * ATOMAR_CORE[S.atomarLv].mult)} Teile/s pro Drohne`,
        btn: `${fmt(cost)} ⬡`, disabled: S.credits < cost,
        onBuy: () => {
          if (!pay(cost)) return;
          S.helpers[h.id] = owned + 1;
          rebuildDrones();
          say(pick([`${h.name} meldet sich zum Dienst! ⚛️`, 'Verstärkung ist da!', 'Noch ein Atomar im Team!']));
          bought(`Atomar-Drohne: ${h.name}`);
        },
      });
    }
    const info = document.createElement('p');
    info.className = 'lead small';
    info.textContent = 'Atomar-Drohnen arbeiten auch, wenn das Spiel geschlossen ist (bis zu 2 Stunden). Ihre Funde werden direkt verkauft.';
    list.appendChild(info);
  } else if (shopTab === 'craft') {
    if (S.level < UNLOCKS.crafting) {
      const p = document.createElement('p'); p.className = 'lead';
      p.innerHTML = `🔒 Der Fabrikator wird ab <b>Nexus Level ${UNLOCKS.crafting}</b> freigeschaltet.`;
      list.appendChild(p);
    } else {
      const intro = document.createElement('p');
      intro.className = 'lead small';
      intro.innerHTML = 'Der Fabrikator baut Gegenstände aus Funden in deinem <b>Lager</b>. Tipp auf „Zutaten sammeln“ – dann bringt Nexus diese Funde an der Ablage ins Lager, statt sie zu verkaufen.';
      list.appendChild(intro);
      for (const r of RECIPES) {
        const c = CONSUMABLES.find((x) => x.id === r.out);
        const parts = Object.entries(r.need).map(([id, n]) => {
          const f = FINDS.find((x) => x.id === id);
          const have = S.vault[id] || 0;
          return `<span class="${have >= n ? 'ok' : 'miss'}">${fmt(Math.min(have, n))}/${n} ${f.name}${S.keep.includes(id) ? ' 🔒' : ''}</span>`;
        }).join(' · ');
        const can = Object.entries(r.need).every(([id, n]) => (S.vault[id] || 0) >= n) && S.credits >= r.credits;
        const allKept = Object.keys(r.need).every((id) => S.keep.includes(id));
        shopItem(list, {
          title: `${c.icon} ${c.name} <span style="color:var(--muted)">(hast ${S.items[c.id] || 0})</span>`,
          desc: `${c.desc}<br><span class="recipe">${parts} · ${fmt(r.credits)} ⬡</span>`,
          extra: allKept ? '' : `<button class="mini-btn" data-keep="${Object.keys(r.need).join(',')}">Zutaten sammeln</button>`,
          btn: can ? 'Bauen' : 'Fehlt was', disabled: !can,
          onBuy: () => {
            if (!can) return;
            S.credits -= r.credits;
            for (const [id, n] of Object.entries(r.need)) S.vault[id] -= n;
            giveItem(r.out, r.n);
            S.crafted++;
            addXp(10);
            bought(`Gebaut: ${c.icon} ${c.name}`);
          },
        });
      }
      list.querySelectorAll('[data-keep]').forEach((b) => b.addEventListener('click', () => {
        for (const id of b.dataset.keep.split(',')) if (!S.keep.includes(id)) S.keep.push(id);
        sfx.click(); feed('Zutaten werden jetzt gesammelt 🔒', '#ffb347'); renderShop(); save();
      }));
    }
  } else if (shopTab === 'skins') {
    for (const sk of SKINS) {
      const owned = S.skins.includes(sk.id);
      const sw = (c) => `<i class="sw" style="background:#${c.toString(16).padStart(6, '0')}"></i>`;
      shopItem(list, {
        title: `${sw(sk.body)}${sw(sk.ear)} ${sk.name}`,
        desc: S.skin === sk.id ? 'Aktiv' : owned ? 'Gekauft – tippen zum Anziehen' : 'Neuer Look für deinen Nexus-Bot',
        btn: S.skin === sk.id ? 'AKTIV' : owned ? 'Anziehen' : `${fmt(sk.cost)} ⬡`,
        disabled: S.skin === sk.id || (!owned && S.credits < sk.cost),
        onBuy: () => {
          if (!owned) { if (!pay(sk.cost)) return; S.skins.push(sk.id); }
          S.skin = sk.id;
          bot.setSkin(sk);
          say(pick(['Steht mir gut, oder?', 'Neuer Look! ✨', 'Ich fühle mich schick!']));
          bought(`Skin: ${sk.name}`);
        },
      });
    }
  }
}

function renderArchive() {
  const list = $('archive-list');
  list.innerHTML = '';
  if (archTab === 'cargo') {
    const cap = cargoCap();
    const head = document.createElement('p');
    head.className = 'lead';
    head.innerHTML = S.levels.link ? 'Nexus-Link aktiv: alle Funde gehen direkt zur Station.' : `Laderaum: <b>${fmt(S.cargoCount)} / ${fmt(cap)}</b> Funde · Wert <b>${fmt(cargoValue())} ⬡</b>`;
    list.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'cargo-grid';
    grid.innerHTML = FINDS.map((f) => {
      const n = S.cargo[f.id] || 0;
      return `<div class="cargo-cell ${n ? '' : 'empty'}" style="--c:${f.color}"><b>${fmt(n)}</b><span>${f.name}</span><small>${fmt(valueOf(f))} ⬡</small></div>`;
    }).join('');
    list.appendChild(grid);
    const eq = document.createElement('p');
    eq.className = 'lead small';
    const ch = CHASSIS.find((c) => c.id === S.chassis);
    eq.innerHTML = `Fahrwerk: <b>${ch.name}</b> · Module: ${S.equipped.length ? S.equipped.map((id) => { const m = MODULES.find((x) => x.id === id); return `${m.icon} ${m.name}`; }).join(', ') : 'keine'}`;
    list.appendChild(eq);
  } else if (archTab === 'deck') {
    const n = S.deck || 0, d = deckDef(n);
    const bits = ((records.deckStars || {})[n] || 0) | deckStarBits();
    const gp = Math.min(deckGoalProgress(), deckGoalTarget(n));
    const tm = deckMinutes(n) * 60, tnow = deckTime();
    const el = document.createElement('div');
    el.innerHTML = `<p class="lead"><b>${d.name} · ${deckName(n)}</b><br>${d.mech}</p>
      <div class="stats">
        <span>Schrott auf diesem Deck</span><span>${fmt(S.total || TOTAL_STONES)}</span>
        <span>Fundwert-Bonus</span><span>+${Math.round((deckValueMult(n) - 1) * 100)} %</span>
        <span>Sterne gesamt</span><span>⭐ ${totalStars()} (+${totalStars() * 25} % Fundwert)</span>
      </div>`;
    list.appendChild(el);
    const goals = [
      [1, '💠 Finde den Nexus-Kern', S.coreFound ? 1 : 0, 1, S.coreFound ? 'gefunden' : 'verschollen'],
      [2, `⏱ Kern in unter ${deckMinutes(n)} Minuten`, S.coreFound && tnow <= tm ? 1 : 0, 1, S.coreFound ? formatTime(tnow) : `${formatTime(tnow)} / ${deckMinutes(n)} min`],
      [4, `🎯 ${d.goal.label.replace(/\d[\d.]*/, fmt(deckGoalTarget(n)))}`, gp, deckGoalTarget(n), `${fmt(gp)} / ${fmt(deckGoalTarget(n))}`],
    ];
    for (const [bit, label, prog, max, txt] of goals) {
      const it = document.createElement('div');
      it.className = 'item' + (bits & bit ? ' got' : '');
      it.innerHTML = `<div class="t">${bits & bit ? '⭐' : '☆'} ${label}</div><div class="pbar"><i style="width:${Math.min(100, (prog / max) * 100)}%"></i><span>${txt}</span></div>`;
      list.appendChild(it);
    }
    const tip = document.createElement('p');
    tip.className = 'lead small';
    tip.textContent = 'Jeder Stern gibt dauerhaft +25 % Fundwert. Fehlende Sterne kannst du später holen: Im Startmenü lassen sich alle freigespielten Decks erneut spielen.';
    list.appendChild(tip);
  } else if (archTab === 'vault') {
    const head = document.createElement('p');
    head.className = 'lead small';
    head.innerHTML = 'Tippe auf ein Fach: 🔒 = <b>behalten</b> (kommt an der Ablage ins Lager), sonst wird es verkauft. Das Lager braucht der Fabrikator und für Aufträge.';
    list.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'cargo-grid';
    grid.innerHTML = FINDS.map((f) => {
      const n = S.vault[f.id] || 0;
      const k = S.keep.includes(f.id);
      return `<button class="cargo-cell keep-cell ${k ? 'kept' : ''}" data-id="${f.id}" style="--c:${f.color}"><b>${fmt(n)}</b><span>${f.name}</span><small>${k ? '🔒 behalten' : '⬡ verkaufen'}</small></button>`;
    }).join('');
    list.appendChild(grid);
    grid.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.id;
      S.keep = S.keep.includes(id) ? S.keep.filter((x) => x !== id) : [...S.keep, id];
      sfx.click(); renderArchive(); save();
    }));
    const sellAll = document.createElement('p');
    sellAll.className = 'lead small';
    sellAll.textContent = `Lagerwert: ${fmt(FINDS.reduce((a, f) => a + (S.vault[f.id] || 0) * valueOf(f), 0))} ⬡`;
    list.appendChild(sellAll);
  } else if (archTab === 'contracts') {
    if (S.level < UNLOCKS.contracts || S.mode === 'pure') {
      const p = document.createElement('p'); p.className = 'lead';
      p.innerHTML = S.mode === 'pure' ? 'Im Modus „Pur“ gibt es keine Aufträge.' : `🔒 Aufträge gibt es ab <b>Nexus Level ${UNLOCKS.contracts}</b>.`;
      list.appendChild(p);
    } else {
      ensureContracts();
      for (const c of S.contracts) {
        const prog = contractProgress(S, c);
        const done = prog >= c.n;
        const el = document.createElement('div');
        el.className = 'item' + (done ? ' got' : '');
        el.innerHTML = `<div class="t">📋 ${contractLabel(c)}</div>
          <div class="d">Belohnung: <b>${fmt(c.reward)} ⬡</b> · ${fmt(c.xp)} XP${c.kind === 'deliver' ? ' · aus dem Lager' : ''}</div>
          <div class="pbar"><i style="width:${Math.min(100, (prog / c.n) * 100)}%"></i><span>${fmt(prog)} / ${fmt(c.n)}</span></div>`;
        const b = document.createElement('button');
        b.className = 'buy';
        b.textContent = done ? 'Abholen' : 'Läuft…';
        b.disabled = !done;
        b.onclick = () => claimContract(c.id);
        el.appendChild(b);
        list.appendChild(el);
      }
      const rr = document.createElement('button');
      rr.className = 'ghost';
      rr.textContent = 'Aufträge neu würfeln (50 ⬡)';
      rr.disabled = S.credits < 50;
      rr.onclick = () => { if (!pay(50)) return; S.contracts = []; ensureContracts(); sfx.click(); renderArchive(); updateHud(); save(); };
      list.appendChild(rr);
      const done = document.createElement('p');
      done.className = 'lead small';
      done.textContent = `Erledigte Aufträge: ${S.contractsDone}`;
      list.appendChild(done);
    }
  } else if (archTab === 'achv') {
    const head = document.createElement('p');
    head.className = 'lead';
    head.textContent = `${S.achievements.length} von ${ACHIEVEMENTS.length} Erfolgen freigeschaltet`;
    list.appendChild(head);
    for (const a of ACHIEVEMENTS) {
      const got = S.achievements.includes(a.id);
      const el = document.createElement('div');
      el.className = 'item' + (got ? ' got' : ' locked');
      el.innerHTML = `<div class="t">${got ? '🏆' : '🔒'} ${a.name}</div><div class="d">${a.desc}</div><div class="reward">+${fmt(a.reward)} ⬡</div>`;
      list.appendChild(el);
    }
  } else {
    const el = document.createElement('div');
    el.className = 'stats';
    el.innerHTML = FINDS.map((f) => `<span style="color:${f.color}">${f.name} <small style="color:var(--muted)">(${fmt(valueOf(f))} ⬡)</small></span><span>${fmt(S.stats.found[f.id] || 0)}</span>`).join('') +
      `<span>Sortierte Teile</span><span>${fmt(S.stats.removed)}</span>
       <span>Griffe</span><span>${fmt(S.stats.grabs)}</span>
       <span>Verdient gesamt</span><span>${fmt(S.stats.earned)} ⬡</span>
       <span>Spielzeit</span><span>${formatTime(S.stats.time)}</span>
       <span>Frachtkapseln</span><span>${fmt(S.stats.capsules)}</span>
       <span>Meteoriten</span><span>${fmt(S.stats.meteors || 0)}</span>
       <span>Nexus-Level</span><span>${S.level} (${fmt(S.xp)}/${fmt(xpForLevel(S.level))} XP)</span>
       <span>Beste Kombo</span><span>${fmt(S.bestCombo)}</span>
       <span>Gebaute Gegenstände</span><span>${fmt(S.crafted)}</span>
       <span>Aufträge</span><span>${fmt(S.contractsDone)}</span>
       <span>Atomar-Drohnen</span><span>${fmt(Object.values(S.helpers).reduce((a, b) => a + b, 0))}</span>
       <span>Nexus-Kern</span><span>${S.coreFound ? '✔ gefunden' : 'verschollen'}</span>
       <span>Sterne</span><span>⭐ ${S.stars || 0} (+${(S.stars || 0) * 25} % Fundwert)</span>`;
    list.appendChild(el);
    if (S.coreFound && S.mode !== 'pure') {
      const b = document.createElement('button');
      b.className = 'big'; b.style.marginTop = '12px';
      b.textContent = 'Zum nächsten Deck ⭐';
      b.onclick = () => { closeArchive(); nextDeck(); };
      list.appendChild(b);
    }
  }
}

// ================================================================ overlays & flow
function showMessage(title, body, btn, onBtn, btn2, onBtn2) {
  $('msg-title').innerHTML = title;
  $('msg-body').innerHTML = body;
  $('msg-btn').textContent = btn;
  $('msg-btn').onclick = () => { $('overlay-msg').classList.add('hidden'); onBtn && onBtn(); };
  const b2 = $('msg-btn2');
  if (btn2) { b2.classList.remove('hidden'); b2.textContent = btn2; b2.onclick = () => { $('overlay-msg').classList.add('hidden'); onBtn2 && onBtn2(); }; }
  else b2.classList.add('hidden');
  $('overlay-msg').classList.remove('hidden');
}

function save() {
  if (!S || !pile || !playing) return;
  S.pile = pile.serialize();
  S.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ }
}

function setupWorld(state) {
  S = state;
  if (pileView) pileView.dispose(scene);
  capsules.clear();
  events.clear();
  $('event').classList.add('hidden');
  env.setStorm(false);
  pile = new Pile(S.seed, S.pile, S.total || TOTAL_STONES);
  if (S.coreFound) pile.ring.found = true;
  pileView = new PileView(pile, scene, DECKS[(S.deck || 0) % DECKS.length]);
  env.setTheme(S.deck || 0);
  bot.setSkin(SKINS.find((k) => k.id === S.skin) || SKINS[0]);
  bot.applyUpgrades(S.levels);
  bot.setChassis(S.chassis || 'tracks');
  bot.setTool(S.tool || 'arms');
  bot.setEvolution(S.evo || 1);
  if (!S.sites) S.sites = Array(13).fill(null);
  refreshStationBonus();
  refreshBase();
  stationView.sync(S.station || [], false, null);
  { const sp = spawnPos(), d = PAD_DIR(); bot.group.position.copy(sp); bot.group.rotation.y = Math.atan2(d.x, d.z); }
  cam.yaw = Math.atan2(-PAD_DIR().x, -PAD_DIR().z); cam.pitch = 0.42; cam.dist = 7;
  rebuildDrones();
  hudCache = {};
}

function startGame(state, offline) {
  if (state.tutorial === undefined) state.tutorial = state.stats.grabs > 30 ? 99 : 0;
  state.skins = state.skins || ['classic'];
  state.skin = state.skin || 'classic';
  state.achievements = state.achievements || [];
  state.stats.capsules = state.stats.capsules || 0;
  state.deck = state.deck || 0; state.stars = state.stars || 0;
  state.chassis = state.chassis || 'tracks'; state.chassisOwned = state.chassisOwned || ['tracks'];
  state.modules = state.modules || []; state.equipped = state.equipped || [];
  state.slotLv = state.slotLv || 0; state.atomarLv = state.atomarLv || 0;
  state.level = state.level || 1; state.xp = state.xp || 0; state.vault = state.vault || {}; state.keep = state.keep || [];
  state.items = state.items || {}; state.contracts = state.contracts || []; state.contractsDone = state.contractsDone || 0;
  state.crafted = state.crafted || 0; state.bestCombo = state.bestCombo || 0;
  state.tool = state.tool || 'arms'; state.toolsOwned = state.toolsOwned || ['arms'];
  state.total = state.total || TOTAL_STONES;
  state.station = state.station || []; state.tonsSpent = state.tonsSpent || 0; state.evo = state.evo || 1;
  state.deckBase = state.deckBase || { removed: 0, found: {}, time: 0, aliens: 0 };
  state.stats.aliens = state.stats.aliens || 0;
  records.deckStars = records.deckStars || {};
  for (let i = 0; i < (state.deck || 0); i++) records.deckStars[i] = (records.deckStars[i] || 0) | 1;   // old saves: earlier decks were finished
  state.stars = totalStars();
  state.sites = state.sites || Array(13).fill(null); state.sitesUnlocked = state.sitesUnlocked || 3; state.buffer = state.buffer || 0; state.fabT = state.fabT || 0;
  setupWorld(state);
  beginPlay(offline);
}
function beginPlay(offline) {
  $('overlay-start').classList.add('hidden');
  hud.classList.remove('hidden');
  playing = true;
  updateHud();
  dailyBonus();
  ensureContracts();
  renderItems();
  if (offline) offlineProgress();
  else if (S.stats.grabs === 0) {
    setTimeout(() => bot.setMood('curious', 2), 400);
    if (S.mode === 'pure') say('Modus Pur: nur wir zwei und 5 Millionen Teile. Los geht’s!', 5);
  }
  save();
}

function newGame(mode = 'career') { startGame(freshState(mode), false); }

function dailyBonus() {
  if (S.mode === 'pure') return;
  const today = new Date().toDateString();
  if (S.daily && S.daily.date === today) return;
  const yesterday = new Date(Date.now() - 864e5).toDateString();
  const streak = S.daily && S.daily.date === yesterday ? Math.min(7, S.daily.streak + 1) : 1;
  const first = !S.daily;
  S.daily = { date: today, streak };
  if (first) return; // no bonus on the very first day of a save
  const reward = Math.max(50, capsuleReward()) * streak;
  S.credits += reward;
  achvQueue.push({ kicker: `Tagesbonus · Serie ${streak}/7`, name: `+${fmt(reward)} ⬡`, desc: streak < 7 ? 'Komm morgen wieder, der Bonus wächst!' : 'Maximale Serie – stark!', reward: 0 });
}

function makeDeckState(n, old) {
  const st = freshState('career');
  Object.assign(st, {
    deck: n, stars: totalStars(),
    skins: old.skins, skin: old.skin, achievements: old.achievements, daily: old.daily,
    tool: old.tool, toolsOwned: old.toolsOwned, sitesUnlocked: old.sitesUnlocked, station: old.station || [], tonsSpent: old.tonsSpent || 0, evo: old.evo || 1,
    chassis: old.chassis, chassisOwned: old.chassisOwned, modules: old.modules, equipped: old.equipped, slotLv: old.slotLv,
    level: old.level, xp: old.xp, items: old.items, contractsDone: old.contractsDone, crafted: old.crafted, bestCombo: old.bestCombo, keep: old.keep,
    stats: { ...old.stats, grabs: Math.max(old.stats.grabs, LUCK.grabs + 1) }, tutorial: 99,
    // nothing is lost when changing decks: upgrades, drones, buildings, vault and credits travel along
    levels: { ...old.levels }, helpers: { ...old.helpers }, atomarLv: old.atomarLv || 0,
    sites: (old.sites || []).map((b) => (b ? { ...b } : null)), vault: { ...(old.vault || {}) },
    skinsOwned: old.skinsOwned, contracts: old.contracts || [],
  });
  st.total = deckTotal(n);
  st.deckBase = { removed: st.stats.removed, found: { ...st.stats.found }, time: st.stats.time, aliens: st.stats.aliens || 0 };
  st.deckStart = st.stats.time;
  st.credits = (old.credits || 0) + 150 * (n + 1) + stationBonus(st.station).start;   // keep credits + a welcome bonus
  records.maxDeck = Math.max(records.maxDeck || 0, n);
  saveRecords();
  return st;
}
function welcomeDeck(n) {
  const d = deckDef(n);
  say(`Willkommen auf ${d.name}: ${deckName(n)}! ${d.mech}`, 7);
  setTimeout(() => say(`Ziele: Kern finden · unter ${deckMinutes(n)} Min · ${d.goal.label.replace(/\d[\d.]*/, fmt(deckGoalTarget(n)))}`, 6), 7500);
}
function nextDeck() {
  const st = makeDeckState((S.deck || 0) + 1, S);
  transferCutscene(st, () => setTimeout(() => welcomeDeck(st.deck), 300));
}
function playDeck(n) {
  const base = loadState() || S;
  const st = makeDeckState(n, base);
  startGame(st, false);
  setTimeout(() => welcomeDeck(n), 500);
}

// ================================================================ cutscenes
const cine = { active: false, t: 0, dur: 0, update: null, onEnd: null, subs: [], moving: false };
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const seg = (t, a, b) => ease((t - a) / (b - a));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);
const shuttle = env.shuttle;
const DOCK_V = () => V(WORLD.dock.x, 0, WORLD.dock.z);

function runCutscene({ dur, update, subs = [], onEnd }) {
  Object.assign(cine, { active: true, t: 0, dur, update, onEnd, subs: subs.slice() });
  hud.classList.add('hidden');
  $('cinema').classList.remove('hidden');
  $('cine-sub').textContent = '';
  grabState.holding = false;
  setEngine(0);
}
function endCutscene() {
  if (!cine.active) return;
  cine.active = false;
  $('cinema').classList.add('hidden');
  $('fade').classList.remove('on');
  shuttle.visible = false;
  shuttle.userData.thrust = 0;
  bot.group.visible = true;
  const cb = cine.onEnd; cine.onEnd = null;
  if (cb) cb();
}
function updateCutscene(dt) {
  cine.t += dt;
  cine.update(cine.t, dt);
  while (cine.subs.length && cine.t >= cine.subs[0][0]) {
    const el = $('cine-sub');
    el.classList.remove('show'); void el.offsetWidth;
    el.textContent = cine.subs.shift()[1];
    el.classList.add('show');
  }
  if (cine.t >= cine.dur) endCutscene();
}
$('cine-skip').addEventListener('click', () => { initAudio(); endCutscene(); });

function placeShuttle(pos, lookTo = null, rotY = Math.PI) {
  shuttle.position.copy(pos);
  if (lookTo) { const d = lookTo.clone().sub(pos); shuttle.rotation.set(0, Math.atan2(d.x, d.z), 0); }
  else shuttle.rotation.set(0, rotY, 0);
}

const PAD = () => V(WORLD.pad.x, 0, WORLD.pad.z);
const PAD_DIR = () => V(-WORLD.pad.x, 0, -WORLD.pad.z).normalize();          // from pad towards deck centre
const PAD_SIDE = () => { const d = PAD_DIR(); return V(d.z, 0, -d.x); };
const padRot = () => Math.atan2(-WORLD.pad.x, -WORLD.pad.z);
const spawnPos = () => PAD().add(PAD_DIR().multiplyScalar(6.5));
let lastDust = 0;
function landerDust(t, strength) {
  if (t - lastDust < 0.12) return;
  lastDust = t;
  const p = PAD();
  for (let k = 0; k < 2; k++) {
    const a = Math.random() * Math.PI * 2;
    dust.puff(p.x + Math.cos(a) * 2.5, 0.1, p.z + Math.sin(a) * 2.5, 2, 1.6 * strength, 0xb0b4bc);
  }
}
// lander descent from high above to the pad; returns thrust
function landerDescent(t, t0, t1, from) {
  const pad = PAD();
  const mid = pad.clone().add(V(0, 9, 0));
  const k = (t - t0) / (t1 - t0);
  let pos, thrust;
  if (k < 0.55) { pos = lerpV(from, mid, ease(k / 0.55)); thrust = 1; }
  else { const k2 = (k - 0.55) / 0.45; pos = lerpV(mid, pad, 1 - Math.pow(1 - Math.min(1, k2), 2)); thrust = 0.95 - k2 * 0.6; }
  shuttle.position.copy(pos);
  shuttle.rotation.set(0, padRot(), 0);
  return Math.max(0, thrust);
}

// Intro when the page opens: the lander comes down on its pad, Nexus rolls out.
function introCutscene(onDone) {
  const pad = PAD(), dir = PAD_DIR(), side = PAD_SIDE();
  const from = pad.clone().add(V(-18, 42, -10));
  const rampTop = pad.clone().add(dir.clone().multiplyScalar(1.4)).setY(1.0);
  const rampEnd = pad.clone().add(dir.clone().multiplyScalar(3.4));
  const botTo = spawnPos();
  let landed = false;
  shuttle.visible = true;
  bot.group.visible = false;
  sfx.event();
  runCutscene({
    dur: 15,
    subs: [[0.4, 'Nexus-Raumstation · Hangardeck 7'], [4.2, 'Ein Frachter hat 5.000.000 Teile Weltraumschrott abgeladen …'], [8.6, '… und irgendwo darin steckt der Nexus-Kern.'], [12, 'Zeit für Nexus.']],
    update(t) {
      if (t < 9.5) {
        const th = landerDescent(t, 0, 9.5, from);
        shuttle.userData.thrust = th;
        setEngine(th, 3);
        if (t > 7.5) landerDust(t, 1);
      } else {
        shuttle.position.copy(pad); shuttle.userData.thrust = 0; setEngine(0);
        if (!landed) { landed = true; sfx.meteor(0.45); shake = 0.25; dust.puff(pad.x, 0.2, pad.z, 10, 2.4, 0xb0b4bc); }
      }
      if (t > 10) {
        bot.group.visible = true;
        const k = seg(t, 10, 13.2);
        bot.group.position.copy(k < 0.3 ? lerpV(rampTop, rampEnd, k / 0.3) : lerpV(rampEnd, botTo, (k - 0.3) / 0.7));
        bot.group.rotation.y = Math.atan2(dir.x, dir.z);
        cine.moving = t < 13.2;
        if (t > 13.3) bot.setMood('happy', 1);
      }
      let cp, look;
      if (t < 6) { cp = pad.clone().add(side.clone().multiplyScalar(34)).add(dir.clone().multiplyScalar(14)).setY(14 + t * 0.5); look = shuttle.position.clone().add(V(0, 2, 0)); }
      else if (t < 10) { cp = lerpV(pad.clone().add(side.clone().multiplyScalar(34)).add(dir.clone().multiplyScalar(14)).setY(17), pad.clone().add(dir.clone().multiplyScalar(11)).add(side.clone().multiplyScalar(6)).setY(4.5), seg(t, 6, 10)); look = shuttle.position.clone().add(V(0, 2, 0)); }
      else { cp = lerpV(pad.clone().add(dir.clone().multiplyScalar(11)).add(side.clone().multiplyScalar(6)).setY(4.5), botTo.clone().add(dir.clone().multiplyScalar(4.5)).add(side.clone().multiplyScalar(1.6)).setY(2.2), seg(t, 10, 14.5)); look = lerpV(shuttle.position.clone().add(V(0, 1.5, 0)), bot.group.position.clone().add(V(0, 1, 0)), seg(t, 10, 12)); }
      camera.position.copy(cp); camera.lookAt(look);
    },
    onEnd() {
      setEngine(0);
      bot.group.position.copy(botTo);
      bot.group.rotation.y = Math.atan2(dir.x, dir.z);
      cine.moving = false;
      try { sessionStorage.setItem('nexus-intro', '1'); } catch (e) { /* ignore */ }
      onDone && onDone();
    },
  });
}

// Deck change: Nexus boards the lander, lifts off, lands on the new deck.
function transferCutscene(newState, onDone) {
  const pad = PAD(), dir = PAD_DIR(), side = PAD_SIDE();
  const botStart = spawnPos(), botIn = pad.clone().add(dir.clone().multiplyScalar(1.6));
  const away = pad.clone().add(V(40, 80, -70));
  const nd = DECKS[newState.deck % DECKS.length];
  let swapped = false, landed = false, lifted = false;
  shuttle.visible = true;
  shuttle.position.copy(pad); shuttle.rotation.set(0, padRot(), 0);
  bot.group.position.copy(botStart);
  bot.group.rotation.y = Math.atan2(-dir.x, -dir.z);
  playing = false;
  runCutscene({
    dur: 16,
    subs: [[0.3, 'Der Nexus-Kern ist geborgen!'], [3.4, `Nächstes Ziel: ${nd.name} – ${nd.title}`], [9.2, nd.perk]],
    update(t) {
      // 0.3-3 Nexus drives into the lander
      if (t < 3.2) { bot.group.position.copy(lerpV(botStart, botIn, seg(t, 0.3, 3))); cine.moving = t < 3; }
      else if (!swapped) { bot.group.visible = false; cine.moving = false; }
      // 3.5-7.5 lift-off
      if (t >= 3.5 && t < 8 && !swapped) {
        const k = seg(t, 3.5, 7.5);
        const p = k < 0.4 ? lerpV(pad, pad.clone().add(V(0, 9, 0)), ease(k / 0.4)) : lerpV(pad.clone().add(V(0, 9, 0)), away, Math.pow((k - 0.4) / 0.6, 2));
        shuttle.position.copy(p); shuttle.userData.thrust = 1; setEngine(1, 3);
        if (!lifted) { lifted = true; sfx.turbo(); }
        if (t < 5) landerDust(t, 1.2);
      }
      if (t > 7.4 && t < 8.7) $('fade').classList.add('on');
      if (t >= 8 && !swapped) {
        swapped = true;
        setupWorld(newState);
        bot.group.visible = false;
        shuttle.visible = true;
      }
      if (t >= 8.7) $('fade').classList.remove('on');
      // 8.7-12.5 descent on the new deck
      if (swapped) {
        if (t < 12.5) { const th = landerDescent(t, 8.7, 12.5, pad.clone().add(V(-14, 34, -8))); shuttle.userData.thrust = th; setEngine(th, 3); if (t > 11) landerDust(t, 1); }
        else { shuttle.position.copy(pad); shuttle.userData.thrust = 0; setEngine(0); if (!landed) { landed = true; sfx.meteor(0.45); shake = 0.25; dust.puff(pad.x, 0.2, pad.z, 10, 2.4, 0xb0b4bc); } }
        if (t > 12.8) {
          bot.group.visible = true;
          bot.group.position.copy(lerpV(botIn, botStart, seg(t, 12.9, 15.2)));
          bot.group.rotation.y = Math.atan2(dir.x, dir.z);
          cine.moving = t < 15.2;
        }
      }
      // camera
      let cp, look;
      if (t < 8) {
        cp = pad.clone().add(dir.clone().multiplyScalar(13)).add(side.clone().multiplyScalar(7)).setY(5 + Math.max(0, t - 3.5) * 2.5);
        look = t < 3.5 ? bot.group.position.clone().add(V(0, 1, 0)) : shuttle.position.clone().add(V(0, 2, 0));
      } else {
        cp = lerpV(pad.clone().add(side.clone().multiplyScalar(26)).add(dir.clone().multiplyScalar(12)).setY(15), botStart.clone().add(dir.clone().multiplyScalar(4.5)).add(side.clone().multiplyScalar(1.6)).setY(2.2), seg(t, 9, 15.5));
        look = t < 12.8 ? shuttle.position.clone().add(V(0, 2, 0)) : bot.group.position.clone().add(V(0, 1, 0));
      }
      camera.position.copy(cp); camera.lookAt(look);
    },
    onEnd() {
      setEngine(0);
      if (!swapped) setupWorld(newState);
      bot.group.position.copy(botStart);
      bot.group.rotation.y = Math.atan2(dir.x, dir.z);
      cine.moving = false;
      beginPlay(false);
      onDone && onDone();
    },
  });
}

function showStart() {
  save();
  playing = false;
  hud.classList.add('hidden');
  $('shop').classList.add('hidden');
  $('archive').classList.add('hidden');
  const ex = loadState();
  $('btn-start').textContent = ex ? 'Weiterspielen ▶' : 'Spiel starten ▶';
  $('btn-new').classList.toggle('hidden', !ex);
  const deckIdx = ex ? (ex.deck || 0) : 0;
  const d = DECKS[deckIdx % DECKS.length];
  if (ex) {
    const left = ex.pile.counts.reduce((a, b) => a + b, 0);
    const pct = (((ex.total || TOTAL_STONES) - left) / (ex.total || TOTAL_STONES)) * 100;
    $('cont-kicker').textContent = ex.mode === 'pure' ? 'Modus Pur' : 'Dein Spielstand';
    $('cont-title').textContent = `${d.name} · ${d.title}`;
    $('cont-level').innerHTML = ex.mode === 'pure' ? '' : `Lv ${ex.level || 1}${ex.stars ? `<br>⭐ ${ex.stars}` : ''}`;
    $('cont-fill').style.width = `${Math.max(1, pct)}%`;
    $('cont-meta').textContent = `${pct.toLocaleString('de-DE', { maximumFractionDigits: 2 })} % sortiert · ${fmt(ex.credits)} ⬡ · ${ex.coreFound ? 'Kern gefunden ✔' : 'Kern verschollen'}`;
  } else {
    $('cont-kicker').textContent = 'Neues Abenteuer';
    $('cont-title').textContent = `${d.name} · ${d.title}`;
    $('cont-level').innerHTML = '';
    $('cont-fill').style.width = '0%';
    $('cont-meta').textContent = 'Finde den Nexus-Kern in 5.000.000 Schrottteilen.';
  }
  // decks: unlocked up to the furthest one ever reached
  const maxDeck = Math.max(records.maxDeck || 0, deckIdx);
  const cols = [['#2a3140', '#4a3a30'], ['#1a3a5a', '#4a7aa0'], ['#4a2a0a', '#a0601a'], ['#2a0a3a', '#1a5a3a']];
  const shown = Math.max(DECKS.length, maxDeck + 2);
  $('deck-list').innerHTML = Array.from({ length: shown }, (_, i) => {
    const dd = DECKS[i % DECKS.length];
    const round = Math.floor(i / DECKS.length);
    const unlocked = i <= maxDeck;
    const cur = ex && i === deckIdx;
    const best = (records.deckTimes || {})[i];
    const c = cols[i % cols.length];
    const bits = (records.deckStars || {})[i] || 0;
    const stars = [1, 2, 4].map((b) => (bits & b ? '★' : '☆')).join('');
    return `<button class="deck-card ${cur ? 'current' : ''} ${unlocked ? '' : 'locked'}" data-deck="${i}" style="--c1:${c[0]};--c2:${c[1]}">
      <span class="st">${cur ? '▶' : unlocked ? '' : '🔒'}</span>
      <b>${deckName(i)}</b>
      <small>${dd.name}</small>
      <span class="stars">${unlocked ? stars : ''}</span>
      <small>${unlocked ? (best ? `Kern in ${formatTime(best)}` : dd.mech) : 'Noch gesperrt'}</small>
    </button>`;
  }).join('');
  document.querySelectorAll('#deck-list .deck-card').forEach((el) => el.addEventListener('click', () => {
    const i = Number(el.dataset.deck);
    if (i > maxDeck) return;
    if (ex && i === deckIdx) { $('btn-start').click(); return; }
    initAudio();
    showMessage(`${deckName(i)} spielen?`,
      `<p class="lead">${deckDef(i).mech}</p><div class="stats"><span>Schrott</span><span>${fmt(deckTotal(i))}</span><span>Fundwert</span><span>+${Math.round((deckValueMult(i) - 1) * 100)} %</span><span>Ziele</span><span>Kern · ${deckMinutes(i)} min · ${fmt(deckGoalTarget(i))}</span></div><p class="lead small">Du nimmst alles mit: Credits, Upgrades, Drohnen, Anlagen, Station und Skins. Nur der Schrottberg ist neu.</p>`,
      'Los geht’s ▶', () => { $('overlay-start').classList.add('hidden'); playDeck(i); }, 'Abbrechen', () => {});
  }));
  const r = records;
  const best = [
    ['💠', r.cores || 0, 'Kerne gefunden'],
    ['⏱', r.fastest ? formatTime(r.fastest) : '–', 'schnellster Kern'],
    ['⭐', `${totalStars()}/${Math.max(4, maxDeck + 1) * 3}`, 'Deck-Sterne'],
    ['🔥', ex ? fmt(ex.bestCombo || 0) : 0, 'beste Kombo'],
    ['🏆', ex ? `${(ex.achievements || []).length}/${ACHIEVEMENTS.length}` : `0/${ACHIEVEMENTS.length}`, 'Erfolge'],
    ['♻️', ex ? fmt(ex.stats.removed) : 0, 'Teile sortiert'],
  ];
  $('records').innerHTML = best.map(([i, v, l]) => `<div class="best"><b>${i} ${v}</b><small>${l}</small></div>`).join('');
  $('overlay-start').classList.remove('hidden');
}

$('btn-start').addEventListener('click', () => {
  initAudio();
  const existing = loadState();
  if (existing) startGame(existing, true); else newGame('career');
});
$('btn-new').addEventListener('click', () => {
  initAudio();
  showMessage('Neues Spiel?', '<p class="lead">Dein aktueller Fortschritt wird überschrieben.</p>', 'Ja, neu starten', () => newGame('career'), 'Abbrechen', () => {});
});
$('btn-pure').addEventListener('click', () => {
  initAudio();
  showMessage('Modus „Pur“', '<p class="lead">Keine Upgrades, kein Markt, keine Helfer. 5.000.000 Teile, ein Bot, ein Kern. Ein vorhandener Spielstand wird überschrieben.</p>', 'Los geht’s', () => newGame('pure'), 'Abbrechen', () => {});
});
$('btn-menu').addEventListener('click', () => {
  save();
  showMessage('Pause',
    `<p class="lead">Dein Fortschritt wird automatisch gespeichert.</p>
     <div class="toggles">
       <button class="toggle ${settings.music ? 'on' : ''}" id="tg-music">🎵 Musik</button>
       <button class="toggle ${settings.sfx ? 'on' : ''}" id="tg-sfx">🔊 Effekte</button>
     </div>`,
    'Weiter', () => {},
  );
  $('tg-music').onclick = (e) => { initAudio(); setMusic(!settings.music); e.currentTarget.classList.toggle('on', settings.music); };
  $('tg-sfx').onclick = (e) => { initAudio(); setSfx(!settings.sfx); e.currentTarget.classList.toggle('on', settings.sfx); sfx.click(); };
  const share = document.createElement('button');
  share.className = 'big share-btn';
  share.textContent = '🔗 Spiel teilen';
  share.onclick = shareGame;
  $('msg-body').appendChild(share);
  const test = document.createElement('button');
  test.className = 'ghost';
  test.textContent = '🔈 Ton testen';
  test.onclick = () => { initAudio(); setTimeout(() => sfx.upgrade(), 50); };
  $('msg-body').appendChild(test);
  const tip = document.createElement('p');
  tip.className = 'lead'; tip.style.fontSize = '12px'; tip.style.margin = '8px 0 0';
  tip.textContent = 'Kein Ton? iPhone-Lautstärke hochdrehen. Ab iOS 17 klappt es auch im Lautlos-Modus, bei älteren iOS-Versionen den Lautlos-Schalter ausschalten.';
  $('msg-body').appendChild(tip);
  const extra = document.createElement('button');
  extra.className = 'ghost';
  extra.textContent = 'Hauptmenü';
  extra.onclick = () => { $('overlay-msg').classList.add('hidden'); showStart(); };
  $('msg-body').appendChild(extra);
});

// ---- share link (iOS/Android share sheet, otherwise copy to clipboard)
const GAME_URL = location.origin + location.pathname.replace(/index\.html$/, '');
async function shareGame() {
  initAudio();
  let text = 'NEXUS CORE: Hilf dem Nexus-Bot, den Nexus-Kern in 5.000.000 Schrottteilen zu finden! 🤖';
  if (S && S.stats && S.stats.removed > 0 && S.mode !== 'pure') {
    const pct = (((S.total || TOTAL_STONES) - pile.total) / (S.total || TOTAL_STONES)) * 100;
    text = `Ich bin Nexus Level ${S.level} und habe schon ${fmt(S.stats.removed)} Schrottteile sortiert (${pct.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %). Schaffst du mehr? 🤖`;
  }
  const data = { title: 'NEXUS CORE', text, url: GAME_URL };
  try {
    if (navigator.share) { await navigator.share(data); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // user closed the share sheet
  }
  try {
    await navigator.clipboard.writeText(`${text} ${GAME_URL}`);
    hint('Link kopiert! 📋', '#6ff3f0');
    feed('Link in die Zwischenablage kopiert', '#6ff3f0');
  } catch (e) {
    showMessage('Spiel teilen', `<p class="lead">Kopiere diesen Link:</p><p class="share-url">${GAME_URL}</p>`, 'OK', () => {});
  }
}
$('btn-share-start').addEventListener('click', shareGame);
$('btn-intro').addEventListener('click', () => { initAudio(); $('overlay-start').classList.add('hidden'); introCutscene(() => showStart()); });

setInterval(() => { if (playing) save(); }, 10000);
// iOS only unlocks audio on touchend/click – listen globally, every time (cheap if already running)
['touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, () => initAudio(), { passive: true, capture: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) initAudio(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) save(); });

// ================================================================ input
const input = { jx: 0, jy: 0, keys: new Set() };
const cam = { yaw: 0, pitch: 0.42, dist: 7 };

// joystick
const joy = $('joystick'), stick = $('stick');
let joyId = null;
function joyMove(e) {
  const r = joy.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy;
  const max = r.width / 2 - 10;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx *= max / len; dy *= max / len; }
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  input.jx = dx / max; input.jy = dy / max;
}
joy.addEventListener('pointerdown', (e) => { initAudio(); joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; input.jx = input.jy = 0; stick.style.transform = ''; };
joy.addEventListener('pointerup', joyEnd);
joy.addEventListener('pointercancel', joyEnd);

// grab button
const grabBtn = $('btn-grab');
grabBtn.addEventListener('pointerdown', (e) => {
  initAudio();
  grabBtn.setPointerCapture(e.pointerId);
  grabState.holding = true;
  grabState.timer = 0;
  grabBtn.classList.add('active');
});
const grabEnd = () => { grabState.holding = false; grabBtn.classList.remove('active'); };
$('btn-turbo').addEventListener('pointerdown', (e) => { e.preventDefault(); useTurbo(); });
grabBtn.addEventListener('pointerup', grabEnd);
grabBtn.addEventListener('pointercancel', grabEnd);

// camera drag / pinch / tap on canvas
const canvas = renderer.domElement;
const ptrs = new Map();
let tapInfo = null, pinchDist = 0, lastCamDrag = 0;
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) tapInfo = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  else { tapInfo = null; const [a, b] = [...ptrs.values()]; pinchDist = Math.hypot(a.x - b.x, a.y - b.y); }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1 && stationMode) {
    stCam.yaw -= dx * 0.006;
    stCam.pitch = Math.max(-0.6, Math.min(1.3, stCam.pitch + dy * 0.005));
    if (tapInfo && Math.hypot(e.clientX - tapInfo.x, e.clientY - tapInfo.y) > 10) tapInfo.moved = true;
  } else if (ptrs.size === 1) {
    lastCamDrag = performance.now();
    cam.yaw -= dx * 0.006;
    cam.pitch = Math.max(0.08, Math.min(1.35, cam.pitch + dy * 0.005));
    if (tapInfo && Math.hypot(e.clientX - tapInfo.x, e.clientY - tapInfo.y) > 10) tapInfo.moved = true;
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist && stationMode) stCam.dist = Math.max(18, Math.min(110, stCam.dist * (pinchDist / d)));
    else if (pinchDist) cam.dist = Math.max(3, Math.min(30, cam.dist * (pinchDist / d)));
    pinchDist = d;
  }
});
function ptrEnd(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinchDist = 0;
  if (e.type === 'pointerup' && tapInfo && !tapInfo.moved && performance.now() - tapInfo.t < 350 && ptrs.size === 0) tapGrab(e.clientX, e.clientY);
  if (ptrs.size === 0) tapInfo = null;
}
canvas.addEventListener('pointerup', ptrEnd);
canvas.addEventListener('pointercancel', ptrEnd);
canvas.addEventListener('wheel', (e) => { if (stationMode) { stCam.dist = Math.max(18, Math.min(110, stCam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); return; } cam.dist = Math.max(3, Math.min(30, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function tapGrab(cx, cy) {
  if (!playing) return;
  if (stationMode) { stationTap(cx, cy); return; }
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = [pileView.mesh];
  if (pileView.ringMesh.visible) targets.push(pileView.ringMesh);
  const hit = raycaster.intersectObjects(targets, true)[0];
  if (!hit) return;
  const bp = bot.group.position;
  const d = Math.hypot(hit.point.x - bp.x, hit.point.z - bp.z);
  const reach = reachDist();
  if (d > reach) { hint('Zu weit weg – fahr näher heran'); return; }
  bot.group.rotation.y = Math.atan2(hit.point.x - bp.x, hit.point.z - bp.z);
  doGrab(hit.point.x, hit.point.z);
}

window.addEventListener('keydown', (e) => {
  input.keys.add(e.code);
  if (e.code === 'Space') { grabState.holding = true; e.preventDefault(); }
  if (e.code === 'KeyT') useTurbo();
  if (e.code === 'KeyE' && playing && nearShop()) openShop();
  if (e.code === 'KeyI' && playing) openArchive();
  if (e.code === 'Escape') closeShop();
});
window.addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
  if (e.code === 'Space') grabState.holding = false;
});

function nearShop() {
  const p = bot.group.position;
  return Math.hypot(p.x - WORLD.shop.x, p.z - WORLD.shop.z) < WORLD.shop.r + 0.6;
}
function nearDock() {
  const p = bot.group.position;
  return Math.hypot(p.x - WORLD.dock.x, p.z - WORLD.dock.z) < WORLD.dock.r + 0.6;
}

// ================================================================ Nexus speaks (tutorial & chatter)
const TUTORIAL = [
  { text: 'Hallo! Ich bin Nexus. 👋 Fahr mich mit dem Stick links zum Schrottberg.',
    done: () => Math.hypot(bot.group.position.x, bot.group.position.z) < 15 || pile.heightAt(bot.group.position.x, bot.group.position.z) > 0.2 },
  { text: 'Halte jetzt GREIFEN gedrückt – ich sortiere Teil für Teil!', done: () => S.stats.grabs >= 12 },
  { text: 'Funde landen in meinem Laderaum (▣ oben links). Sammle Funde für 20 ⬡!', done: () => cargoValue() >= 20 || S.credits >= 20 },
  { text: 'Fahr zur Nexus-Ablage (türkiser Lichtstrahl) – dort verkaufe ich die Funde automatisch.', done: () => S.stats.earned > 0 },
  { text: 'Jetzt zum Nexus-Shop (oranger Lichtstrahl) und kauf mir Krallenhände!', done: () => S.levels.hands >= 1 },
  { text: 'Danke! 💚 Irgendwo hier ist der Nexus-Kern. Wenn es türkis aufblitzt: dort graben!', done: () => tutorialShown > 6 },
];
let tutorialShown = 0;
const bubbleEl = $('bubble'), bubbleText = $('bubble-text');
let chatter = { text: '', t: 0 }, idleChat = 25;
const LINES = {
  find: ['Oh, was Glänzendes!', 'Das gibt Credits!', 'Ich liebe Schrott. 🤖', 'Ein guter Fund!', 'Ab in den Laderaum!'],
  rare: ['WOW! Schau dir das an!', 'Selten! Sehr selten!', 'Meine Sensoren kribbeln!'],
  full: ['Mein Laderaum ist voll… 😟', 'Ich passe nichts mehr rein!'],
  upgrade: ['Ich fühle mich stärker!', 'Neues Teil – danke!', 'Upgrade installiert ✔'],
  idle: ['Noch ein paar Millionen…', 'Irgendwo hier muss der Kern sein.', 'Schrott, Schrott, Schrott…', 'Ich habe Zeit. Viel Zeit.', 'Schon den Shop besucht? Da gibt’s Spinnenbeine!'],
  hot: ['Ich spüre etwas… ganz nah!', 'Hier! Hier muss er sein!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function say(text, dur = 2.6) { chatter = { text, t: dur }; idleChat = 30 + Math.random() * 30; }

function updateDockArrow() {
  let target = null, label = '';
  const full = !S.levels.link && S.cargoCount >= cargoCap();
  if (S.mode !== 'pure') {
    if ((S.tutorial === 3 || full) && !nearDock()) { target = WORLD.dock; label = 'Ablage'; }
    else if (S.tutorial === 4 && !nearShop()) { target = WORLD.shop; label = 'Shop'; }
  }
  $('dock-chip').classList.toggle('hidden', !target);
  if (!target) return;
  const p = bot.group.position;
  const dx = target.x - p.x, dz = target.z - p.z;
  const fwd = Math.atan2(-Math.sin(cam.yaw), -Math.cos(cam.yaw));
  const dir = Math.atan2(dx, dz);
  const rel = Math.atan2(Math.sin(fwd - dir), Math.cos(fwd - dir));
  $('dock-arrow').style.transform = `rotate(${(-90 + rel * 180 / Math.PI).toFixed(0)}deg)`;
  setText('dock-label', label);
  setText('dock-dist', fmt(Math.hypot(dx, dz)));
  $('dock-chip').style.color = label === 'Shop' ? '#ffb347' : '#6ff3f0';
  $('dock-chip').style.borderColor = label === 'Shop' ? '#ffb347' : '#6ff3f0';
}

function updateBubble(dt) {
  let text = '', tut = false;
  if (S.tutorial < TUTORIAL.length && S.mode !== 'pure') {
    const step = TUTORIAL[S.tutorial];
    if (S.tutorial === TUTORIAL.length - 1) tutorialShown += dt;
    if (step.done()) { S.tutorial++; tutorialShown = 0; bot.setMood('happy', 1); save(); }
    else if ($('shop').classList.contains('hidden')) { text = `<span class="step">Schritt ${S.tutorial + 1}/${TUTORIAL.length}</span>${step.text}`; tut = true; }
  }
  if (!text) {
    idleChat -= dt;
    if (idleChat <= 0) say(pick(LINES.idle));
    if (chatter.t > 0) { chatter.t -= dt; text = chatter.text; }
  }
  if (!text || !$('overlay-msg').classList.contains('hidden')) { bubbleEl.classList.add('hidden'); return; }
  if (bubbleText.innerHTML !== text) bubbleText.innerHTML = text;
  bubbleEl.classList.toggle('tut', tut);
  // shop open: show bubble at top of screen instead of over the bot
  if (!$('shop').classList.contains('hidden')) { bubbleEl.classList.add('hidden'); return; }
  const v = tmpV.copy(bot.group.position);
  v.y += 2.3;
  v.project(camera);
  if (v.z > 1) { bubbleEl.classList.add('hidden'); return; }
  const x = Math.max(150, Math.min(window.innerWidth - 150, (v.x * 0.5 + 0.5) * window.innerWidth));
  const y = Math.max(160, (-v.y * 0.5 + 0.5) * window.innerHeight);
  bubbleEl.style.left = `${x}px`;
  bubbleEl.style.top = `${y}px`;
  bubbleEl.classList.remove('hidden');
}

// ================================================================ adaptive quality
const quality = { level: 2, t: 0, frames: 0, checks: 0, warm: 5, low: 0 };
function adaptQuality(dt) {
  if (quality.checks >= 8) return;
  if (quality.warm > 0) { quality.warm -= dt; return; } // skip shader-compile hiccups after start
  quality.t += dt; quality.frames++;
  if (quality.t < 3) return;
  const fps = quality.frames / quality.t;
  quality.t = 0; quality.frames = 0; quality.checks++;
  quality.low = fps < (quality.level === 2 ? 42 : 30) ? quality.low + 1 : 0;
  if (quality.low < 2) return;
  quality.low = 0;
  if (quality.level === 2) {
    quality.level = 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    onResize();
  } else if (quality.level === 1) {
    quality.level = 0;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
    });
    onResize();
  }
}

// ================================================================ main loop
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  camera.fov = w < h ? 68 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
const tmpV = new THREE.Vector3();
let demoT = 0;
let autoGrabT = 0;
let wasInAblage = false;

function updateBot(dt) {
  let jx = input.jx, jy = input.jy;
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) jy = -1;
  if (k.has('KeyS') || k.has('ArrowDown')) jy = 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) jx = -1;
  if (k.has('KeyD') || k.has('ArrowRight')) jx = 1;
  const mag = Math.min(1, Math.hypot(jx, jy));
  const moving = mag > 0.12 && playing && $('shop').classList.contains('hidden');
  const p = bot.group.position;
  if (moving) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = fx * -jy + rx * jx, mz = fz * -jy + rz * jx;
    const ml = Math.hypot(mx, mz) || 1;
    const ch = chassisDef();
    const speed = lv('drive') * ch.speed * mag;
    // climbing the heap is slower
    const ahead = pile.heightAt(p.x + (mx / ml) * 0.4, p.z + (mz / ml) * 0.4);
    const slope = Math.max(0, (ahead - Math.max(0, pile.heightAt(p.x, p.z))) / 0.4);
    const slow = 1 / (1 + slope * ch.slope);
    p.x += (mx / ml) * speed * slow * dt;
    p.z += (mz / ml) * speed * slow * dt;
    const r = Math.hypot(p.x, p.z);
    if (r > WORLD.botLimit) { p.x *= WORLD.botLimit / r; p.z *= WORLD.botLimit / r; }
    const target = Math.atan2(mx, mz);
    // gently swing the camera behind the bot while driving forward
    if (jy < -0.3 && performance.now() - lastCamDrag > 1500) {
      let dy = (bot.group.rotation.y + Math.PI) - cam.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      cam.yaw += dy * Math.min(1, dt * 1.2);
    }
    let diff = target - bot.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    bot.group.rotation.y += diff * Math.min(1, dt * 10);
  }
  const ground = Math.max(0, pile.heightAt(p.x, p.z));
  p.y += (ground - p.y) * Math.min(1, dt * 12);
  bot.update(dt, moving);
  setEngine(moving ? mag : 0, S.levels.drive);
  if (moving && ground > 0.05 && Math.random() < dt * 10) {
    const a = bot.group.rotation.y;
    dust.puff(p.x - Math.sin(a) * 0.4, p.y, p.z - Math.cos(a) * 0.4, 1, 0.6);
  }

  // auto-grabber module: grabs by itself while standing at the heap
  if (hasMod('auto') && !moving && !grabState.holding && playing && $('shop').classList.contains('hidden')) {
    autoGrabT -= dt;
    if (autoGrabT <= 0) {
      autoGrabT = 1.6 / lv('speed');
      const [x, z] = frontPoint();
      const c = pile.cellAt(x, z);
      if (c >= 0 && pile.counts[c] > 0) doGrab(x, z);
    }
  }
  // hold-to-grab
  if (grabState.holding && playing) {
    grabState.timer -= dt;
    if (grabState.timer <= 0) {
      grabState.timer = 1 / (lv('speed') * toolDef().speed * ((S.evo || 1) >= 2 ? 1.1 : 1) * (turbo.t > 0 ? TURBO.factor : 1));
      const [x, z] = frontPoint();
      doGrab(x, z);
    }
  }
}

function updateCamera(dt) {
  { const p = bot.group.position; env.followShadow(Math.round(p.x / 2) * 2, Math.round(p.z / 2) * 2); }
  const p = bot.group.position;
  camTarget.lerp(tmpV.set(p.x, p.y + 1.2, p.z), Math.min(1, dt * 8));
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * cp * cam.dist,
    camTarget.y + Math.sin(cam.pitch) * cam.dist,
    camTarget.z + Math.cos(cam.yaw) * cp * cam.dist,
  );
  const floor = Math.max(0, pile.heightAt(camera.position.x, camera.position.z)) + 0.5;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(camTarget);
  const o = window.__camOverride;
  if (o) { camera.position.set(...o.pos); camera.lookAt(...o.look); }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  env.update(dt, t);

  if (pile && cine.active) {
    updateCutscene(dt);
    bot.update(dt, cine.moving);
    pile.relaxStep();
    pileView.sync();
    updateDrones(dt, t);
  } else if (pile) {
    if (playing) {
      S.stats.time += dt;
      fullWarnT -= dt;
      automationTick(dt);
      if (stationMode) stationCamera(dt); else { updateBot(dt); updateCamera(dt); }
      stationTick(dt);
      $('btn-dock').classList.toggle('hidden', !nearShop() || S.mode === 'pure');
      // standing on a build site?
      let nearSite = -1;
      if (S.mode !== 'pure' && S.level >= BUILD_UNLOCK_LEVEL) {
        const bp = bot.group.position;
        for (let i = 0; i < SITE_ANGLES.length; i++) {
          if (i >= S.sitesUnlocked && !S.sites[i]) continue;
          const sp = sitePos(i);
          if (Math.hypot(bp.x - sp.x, bp.z - sp.z) < 2.6) { nearSite = i; break; }
        }
      }
      $('btn-site').classList.toggle('hidden', nearSite < 0);
      $('btn-site').dataset.site = nearSite;
      if (nearSite >= 0) setText('btn-site', S.sites[nearSite] ? `🏗️ ${BUILDINGS[S.sites[nearSite].type].name}` : '🏗️ HIER BAUEN');
      const inA = nearDock();
      if (inA && !wasInAblage && S.mode !== 'pure') {
        if (S.cargoCount > 0) {
          const v = sellCargo();
          floatLabel(camera, tmpV2.copy(bot.group.position).setY(bot.group.position.y + 2), v ? `+${fmt(v)} ⬡` : '→ Lager', '#6ff3f0', true);
          dust.puff(WORLD.dock.x, 0.2, WORLD.dock.z, 6, 1.2, 0x6ff3f0);
        } else if (S.stats.grabs > 0) hint('Nexus-Ablage: Laderaum ist leer', '#6ff3f0');
      }
      wasInAblage = inA;
      updateHud();
      updateScannerHud();
      updateBubble(dt);
      updateDockArrow();
      checkAchievements(dt);
      flushFeed(dt);
      if (achvT > 0.95) { checkDeckStars(); checkMilestones(); }
      baseTick(dt);
      updateCombo(dt);
      updatePulse(dt, t);
      updateGoal();
      capsules.speed = (hasMod('radar') ? 2 : 1) * (1 + baseCache.beacon / 100);
      events.speed = (hasMod('lure') ? 1.8 : 1) * deckEventSpeed(S.deck || 0) * (1 + SB.events);
      events.special = deckDef(S.deck || 0).special;
      if (S.mode !== 'pure') capsules.update(dt, t, pile);
      events.update(dt, t, pile, camera);
      updateTurbo(dt);
      if (events.active) setText('event-t', `${Math.ceil(events.active.t)} s`);
      adaptQuality(dt);
    } else {
      bubbleEl.classList.add('hidden');
      setEngine(0);
      // title screen: slow orbit
      demoT += dt;
      bot.update(dt, false);
      camera.position.set(Math.sin(demoT * 0.08) * 34, 16, Math.cos(demoT * 0.08) * 34);
      camera.lookAt(0, 4, 0);
    }
    pile.relaxStep();
    pileView.sync();
    pileView.updateRing(dt, (S && S.levels.scanner >= 1 ? 400 : 25) + SB.glitter * 200);
    updateDrones(dt, t);
  }
  if (S) baseView.update(dt, t, baseFlow, baseCache.eff, (S.buffer || 0) / Math.max(1, baseCache.buffer));
  stationView.update(dt, t);
  { const p = bot.group.position; contactShadow.position.set(p.x, Math.max(0, pile.heightAt(p.x, p.z)) + 0.03, p.z); contactShadow.visible = bot.group.visible; }
  updateDebris(dt);
  dust.update(dt);
  let shaken = false;
  if (shake > 0 && playing) {
    shaken = true;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  renderFrame();
  requestAnimationFrame(animate);
}

// ---- boot: show the title over the saved (or a demo) heap
const boot = loadState();
setupWorld(boot || freshState());
animate();
let introSeen = false;
try { introSeen = sessionStorage.getItem('nexus-intro') === '1'; } catch (e) { /* ignore */ }
if (introSeen) showStart();
else $('splash').classList.remove('hidden');
$('splash').addEventListener('click', () => {
  initAudio();
  $('splash').classList.add('hidden');
  introCutscene(() => showStart());
});

// test hook
window.__nx = { freeCellsTest: () => freeCells(S.station), selectFree: (c) => { stSel = { free: c }; renderStation(); }, checkDeckStars, totalStars, cineJump: (t) => { cine.t = t; cine.update(t, 0.02); }, bloom, gfx, rebuildDrones, env, renderer, scene, camera, renderItems, quality, setLow: () => { quality.level = 1; quality.low = 5; quality.warm = 0; quality.t = 3; quality.frames = 1; }, get S() { return S; }, get pile() { return pile; }, openArchive, doGrab, coreFound, openShop, sellCargo, bot, capsules, events, nextDeck, useTurbo };
