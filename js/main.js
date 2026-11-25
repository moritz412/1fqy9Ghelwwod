import * as THREE from 'three';
import { TOTAL_STONES, WORLD, FINDS, BOT_UPGRADES, HELPERS, helperCost, fmt, LUCK, SKINS, ACHIEVEMENTS, DECKS, STAR_BONUS, TURBO, CHASSIS, MODULES, MODULE_SLOTS, ATOMAR_CORE } from './config.js';
import { Events, EVENT_TYPES } from './events.js';
import { Capsules, Dust, floatLabel } from './extras.js';
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
    stats: { removed: 0, found: {}, earned: 0, time: 0, grabs: 0, capsules: 0 },
    skins: ['classic'], skin: 'classic', achievements: [], deck: 0, stars: 0, daily: null,
    chassis: 'tracks', chassisOwned: ['tracks'], modules: [], equipped: [], slotLv: 0, atomarLv: 0,
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

let pile = null, pileView = null;
const bot = new NexusBot();
scene.add(bot.group);
const capsules = new Capsules(scene);
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
    say(type === 'meteor' ? 'Achtung, Meteoriten! Die sind voller Schätze! ☄️' : 'Ich spüre eine Glückswelle! Schnell greifen! ✨', 4);
  },
  onEnd() { $('event').classList.add('hidden'); },
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
const droneGroup = new THREE.Group();
scene.add(droneGroup);
const DRONE_LOOK = {
  mini: { color: 0xf3f4f2, size: 0.35, h: 1.2 },
  drone: { color: 0x2fc9a8, size: 0.45, h: 3 },
  belt: { color: 0xffb347, size: 0.6, h: 4 },
  drill: { color: 0xff6b6b, size: 0.8, h: 5 },
  orbit: { color: 0xb48cff, size: 1.2, h: 9 },
};
function rebuildDrones() {
  droneGroup.clear();
  if (!S) return;
  let idx = 0;
  for (const h of HELPERS) {
    const n = Math.min(S.helpers[h.id] || 0, 3);
    const look = DRONE_LOOK[h.id];
    for (let k = 0; k < n; k++) {
      const d = new THREE.Group();
      // Atomar look: glowing nucleus with three electron orbits
      const body = new THREE.Mesh(new THREE.SphereGeometry(look.size * 0.28, 16, 12), new THREE.MeshStandardMaterial({ color: look.color, emissive: look.color, emissiveIntensity: 0.6, roughness: 0.3 }));
      const eye = new THREE.Mesh(new THREE.SphereGeometry(look.size * 0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      eye.position.set(0, 0, look.size * 0.27);
      const rotor = new THREE.Group();
      for (let r = 0; r < 3; r++) {
        const orbit = new THREE.Mesh(new THREE.TorusGeometry(look.size * 0.55, 0.018 + look.size * 0.015, 6, 32), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
        orbit.rotation.set(Math.PI / 2 + r * 1.05, r * 0.6, 0);
        const electron = new THREE.Mesh(new THREE.SphereGeometry(look.size * 0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        electron.position.x = look.size * 0.55;
        orbit.add(electron);
        rotor.add(orbit);
      }
      const beam = new THREE.Mesh(new THREE.ConeGeometry(look.size * 0.5, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x6ff3f0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.y = -0.5;
      d.add(body, eye, rotor, beam);
      d.userData = { phase: idx * 1.7 + k * 2.1, r: 4 + ((idx * 3 + k * 5) % 10), h: look.h, speed: 0.15 + (k % 3) * 0.05, beam, size: look.size };
      body.castShadow = true;
      d.userData.rotor = rotor;
      droneGroup.add(d);
    }
    idx++;
  }
}
function updateDrones(dt, t) {
  for (const d of droneGroup.children) {
    const u = d.userData;
    const a = t * u.speed + u.phase;
    const x = Math.cos(a) * u.r, z = Math.sin(a) * u.r;
    const ground = Math.max(0, pile.heightAt(x, z));
    d.position.set(x, ground + u.h + Math.sin(t * 2 + u.phase) * 0.2, z);
    d.rotation.y = -a;
    if (u.rotor) u.rotor.children.forEach((o, i) => { o.rotation.z += dt * (2 + i); });
    const suck = (Math.sin(t * 1.3 + u.phase * 3) + 1) / 2;
    u.beam.material.opacity = suck > 0.7 ? (suck - 0.7) * 0.8 : 0;
    u.beam.scale.y = u.h;
    u.beam.position.y = -u.h / 2;
    if (suck > 0.95 && Math.random() < dt * 8 && pile.total > 0) spawnDebris(x, ground, z, 1, 0, 0, 0.7);
  }
}

// ================================================================ HUD helpers
const $ = (id) => document.getElementById(id);
const hud = $('hud');

function feed(text, color = '#6ff3f0') {
  const el = document.createElement('div');
  el.className = 'feed-item';
  el.style.setProperty('--c', color);
  el.textContent = text;
  const f = $('feed');
  f.prepend(el);
  while (f.children.length > 5) f.lastChild.remove();
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
const starMult = () => 1 + (S.stars || 0) * STAR_BONUS.finds;
const valueOf = (f) => Math.round(f.value * starMult());
const helperRate = () => HELPERS.reduce((a, h) => a + (S.helpers[h.id] || 0) * h.rate, 0) * (1 + (S.stars || 0) * STAR_BONUS.helpers) * ATOMAR_CORE[S.atomarLv || 0].mult;
const hasMod = (id) => S.equipped && S.equipped.includes(id);
const chassisDef = () => CHASSIS.find((c) => c.id === S.chassis) || CHASSIS[0];
const grabRadius = () => GRAB_RADIUS[S.levels.hands] + (hasMod('reach') ? 1 : 0);
const reachDist = () => 2.2 + grabRadius() * 0.5 + chassisDef().reach + (hasMod('reach') ? 0.8 : 0);
const turboDur = () => TURBO.duration * (hasMod('cooler') ? 1.6 : 1);
const turboCd = () => TURBO.cooldown * (hasMod('battery') ? 0.6 : 1);

let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }

function updateHud() {
  setText('remaining', fmt(pile.total));
  const pct = ((TOTAL_STONES - pile.total) / TOTAL_STONES) * 100;
  setText('progress', `${pct.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %`);
  setText('deck-line', `${DECKS[(S.deck || 0) % DECKS.length].name}${S.stars ? ` · ⭐ ${S.stars}` : ''}`);
  setText('credits', fmt(S.credits));
  const cap = lv('cargo');
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
      if (S.mode !== 'pure') { S.credits += valueOf(f) * k; S.stats.earned += valueOf(f) * k; }
      if (byPlayer) { feed(`+${fmt(k)} ${f.name}`, f.color); best = Math.max(best, tier); }
      else if (tier >= 3) feed(`Helfer: ${f.name}!`, f.color);
      continue;
    }
    const cap = lv('cargo');
    const space = Math.max(0, cap - S.cargoCount);
    const take = Math.min(space, k);
    if (take > 0) {
      S.cargo[f.id] = (S.cargo[f.id] || 0) + take;
      S.cargoCount += take;
      feed(`+${fmt(take)} ${f.name}`, f.color);
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

function cargoValue() {
  return FINDS.reduce((a, f) => a + (S.cargo[f.id] || 0) * valueOf(f), 0);
}
function sellCargo() {
  const v = cargoValue();
  if (!v) return;
  S.credits += v; S.stats.earned += v;
  S.cargo = {}; S.cargoCount = 0;
  sfx.sell();
  bot.setMood('happy', 2);
  feed(`Verkauft: +${fmt(v)} ⬡`, '#6ff3f0');
  renderShop();
  updateHud();
  save();
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
  const amount = lv('hands');
  const radius = grabRadius();
  const cap = S.mode !== 'pure' && capsules.take(x, z);
  if (cap) openCapsule(cap.position);
  const met = events.take(x, z);
  if (met) openMeteor(met);
  const res = pile.grab(x, z, amount, Math.max(radius, 0.8));
  bot.grab();
  if ((cap || met) && !res.removed) return;
  S.stats.grabs++;
  if (!res.removed && !res.ring) {
    sfx.empty();
    hint('Hier liegt nichts – fahr näher an den Haufen');
    return;
  }
  S.stats.removed += res.removed;
  const size = Math.min(5, S.levels.hands);
  sfx.grab(size);
  if (S.levels.hands === 0 && Math.random() < 0.15) bot.setMood('work', 0.6);
  const h = Math.max(0, pile.heightAt(x, z));
  const a = bot.group.rotation.y;
  spawnDebris(x, h, z, Math.min(2 + size * 3, Math.max(1, Math.round(res.removed / 3))), -Math.sin(a) * 0.4, -Math.cos(a) * 0.4, 1 + size * 0.15);
  dust.puff(x, h, z, 1 + Math.min(4, size), 0.8 + size * 0.25);
  const lucky = S.stats.grabs <= LUCK.grabs ? LUCK.factor : 1;
  const finds = rollFinds(res.removed, lucky * events.luckFactor);
  // guaranteed early highlights
  if (S.stats.grabs === 3) finds.push({ f: FINDS[1], k: 1, tier: 1 });
  if (S.stats.grabs === 25) finds.push({ f: FINDS[2], k: 1, tier: 2 });
  handleFinds(finds, true);
  const worth = finds.reduce((a, q) => a + valueOf(q.f) * q.k, 0);
  if (worth && S.mode !== 'pure') {
    const best = finds.reduce((a, q) => (q.tier > a.tier ? q : a), finds[0]);
    floatLabel(camera, tmpV2.set(x, h + 0.8, z), `+${fmt(worth)} ⬡`, best.f.color, worth >= 60);
  }
  if (S.stats.grabs === 3) say('Ein Eiskristall – gleich beim dritten Griff! ❄️');
  if (S.stats.grabs === 25) say('Ein Sondenteil! Das bringt 60 Credits!');
  if (res.ring) coreFound(true);
  scannerPing();
}

const tmpV2 = new THREE.Vector3();
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
  bot.setMood('love', 1.5);
}
function openCapsule(pos) {
  const reward = capsuleReward();
  S.credits += reward; S.stats.earned += reward;
  S.stats.capsules++;
  sfx.capsule();
  vibrate(25);
  bot.setMood('happy', 2);
  say(pick(['Eine Frachtkapsel! 🎁', 'Bonus-Credits!', 'Kapsel geknackt!']));
  floatLabel(camera, tmpV2.copy(pos).setY(pos.y + 1), `+${fmt(reward)} ⬡`, '#ffb347', true);
  spawnDebris(pos.x, pos.y, pos.z, 12, 0, 0, 0.6);
  dust.puff(pos.x, pos.y, pos.z, 6, 1.4, 0xffc070);
  updateHud();
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
  const rate = helperRate();
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
  if (!records.fastest || S.stats.time < records.fastest) records.fastest = S.stats.time;
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
         <span>Spielzeit</span><span>${formatTime(S.stats.time)}</span>
         <span>Sortierte Teile</span><span>${fmt(S.stats.removed)}</span>
         <span>davon übrig</span><span>${fmt(pile.total)}</span>
         <span>Griffe</span><span>${fmt(S.stats.grabs)}</span>
         <span>Verdient</span><span>${fmt(S.stats.earned)} ⬡</span>
       </div>
       <p class="lead">Weiter aufräumen – oder mit einem Stern auf das nächste Deck wechseln. Skins und Erfolge nimmst du mit, Upgrades und Helfer beginnen neu.</p>`,
      'Weiter aufräumen', () => {},
      S.mode === 'pure' ? 'Neues Spiel' : `Nächstes Deck ⭐ (+${Math.round(STAR_BONUS.finds * 100)} % Fundwert)`,
      () => (S.mode === 'pure' ? newGame('pure') : nextDeck()));
  }, 1600);
}

function formatTime(s) {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h} h ${m} min` : `${m} min ${sec} s`;
}

// ================================================================ shop
let shopTab = 'bot', archTab = 'cargo';
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
  } else if (shopTab === 'modules') {
    const slots = MODULE_SLOTS[S.slotLv].slots;
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
    const cap = lv('cargo');
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
  pile = new Pile(S.seed, S.pile);
  if (S.coreFound) pile.ring.found = true;
  pileView = new PileView(pile, scene, DECKS[(S.deck || 0) % DECKS.length]);
  bot.setSkin(SKINS.find((k) => k.id === S.skin) || SKINS[0]);
  bot.applyUpgrades(S.levels);
  bot.setChassis(S.chassis || 'tracks');
  bot.group.position.set(WORLD.dock.x, 0, WORLD.dock.z - 1);
  bot.group.rotation.y = Math.PI;
  cam.yaw = 0; cam.pitch = 0.42; cam.dist = 7;
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
  setupWorld(state);
  $('overlay-start').classList.add('hidden');
  hud.classList.remove('hidden');
  playing = true;
  updateHud();
  dailyBonus();
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

function nextDeck() {
  const old = S;
  const st = freshState('career');
  Object.assign(st, {
    deck: (old.deck || 0) + 1, stars: (old.stars || 0) + 1,
    skins: old.skins, skin: old.skin, achievements: old.achievements, daily: old.daily,
    chassis: old.chassis, chassisOwned: old.chassisOwned, modules: old.modules, equipped: old.equipped, slotLv: old.slotLv,
    stats: { ...old.stats, grabs: Math.max(old.stats.grabs, LUCK.grabs + 1) }, tutorial: 99,
  });
  st.credits = 100 * st.stars;
  startGame(st, false);
  const d = DECKS[st.deck % DECKS.length];
  setTimeout(() => say(`Willkommen auf ${d.name}: ${d.title}! ⭐ ${st.stars} = +${st.stars * 25} % Fundwert.`, 6), 600);
}

function showStart() {
  save();
  playing = false;
  hud.classList.add('hidden');
  $('shop').classList.add('hidden');
  const existing = loadState();
  $('btn-start').textContent = existing ? 'Weiter sortieren' : 'Spiel starten';
  $('btn-new').classList.toggle('hidden', !existing);
  const r = [];
  if (existing) r.push(`Fortschritt: <b>${(((TOTAL_STONES - existing.pile.counts.reduce((a, b) => a + b, 0)) / TOTAL_STONES) * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %</b> sortiert`);
  if (records.cores) r.push(`Kerne gefunden: <b>${records.cores}</b> · schnellste Suche: <b>${formatTime(records.fastest)}</b>`);
  $('records').innerHTML = r.join('<br>');
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
  if (ptrs.size === 1) {
    lastCamDrag = performance.now();
    cam.yaw -= dx * 0.006;
    cam.pitch = Math.max(0.08, Math.min(1.35, cam.pitch + dy * 0.005));
    if (tapInfo && Math.hypot(e.clientX - tapInfo.x, e.clientY - tapInfo.y) > 10) tapInfo.moved = true;
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) cam.dist = Math.max(3, Math.min(30, cam.dist * (pinchDist / d)));
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
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(3, Math.min(30, cam.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function tapGrab(cx, cy) {
  if (!playing) return;
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
  const full = !S.levels.link && S.cargoCount >= lv('cargo');
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
      grabState.timer = 1 / (lv('speed') * (turbo.t > 0 ? TURBO.factor : 1));
      const [x, z] = frontPoint();
      doGrab(x, z);
    }
  }
}

function updateCamera(dt) {
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
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  env.update(dt, t);

  if (pile) {
    if (playing) {
      S.stats.time += dt;
      fullWarnT -= dt;
      automationTick(dt);
      updateBot(dt);
      updateCamera(dt);
      $('btn-dock').classList.toggle('hidden', !nearShop() || S.mode === 'pure');
      const inA = nearDock();
      if (inA && !wasInAblage && S.mode !== 'pure') {
        if (cargoValue() > 0) {
          const v = cargoValue();
          sellCargo();
          floatLabel(camera, tmpV2.copy(bot.group.position).setY(bot.group.position.y + 2), `+${fmt(v)} ⬡`, '#6ff3f0', true);
          dust.puff(WORLD.dock.x, 0.2, WORLD.dock.z, 6, 1.2, 0x6ff3f0);
        } else if (S.stats.grabs > 0) hint('Nexus-Ablage: Laderaum ist leer', '#6ff3f0');
      }
      wasInAblage = inA;
      updateHud();
      updateScannerHud();
      updateBubble(dt);
      updateDockArrow();
      checkAchievements(dt);
      capsules.speed = hasMod('radar') ? 2 : 1;
      events.speed = hasMod('lure') ? 1.8 : 1;
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
    pileView.updateRing(dt, S && S.levels.scanner >= 1 ? 400 : 25);
    updateDrones(dt, t);
  }
  updateDebris(dt);
  dust.update(dt);
  let shaken = false;
  if (shake > 0 && playing) {
    shaken = true;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---- boot: show the title over the saved (or a demo) heap
const boot = loadState();
setupWorld(boot || freshState());
showStart();
animate();

// test hook
window.__nx = { quality, setLow: () => { quality.level = 1; quality.low = 5; quality.warm = 0; quality.t = 3; quality.frames = 1; }, get S() { return S; }, get pile() { return pile; }, openArchive, doGrab, coreFound, openShop, sellCargo, bot, capsules, events, nextDeck, useTurbo };
