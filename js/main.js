import * as THREE from 'three';
import { TOTAL_STONES, WORLD, FINDS, BOT_UPGRADES, HELPERS, helperCost, fmt } from './config.js';
import { Pile, PileView } from './pile.js';
import { NexusBot } from './bot.js';
import { buildEnvironment } from './scene.js';
import { initAudio, sfx, vibrate, setMuted, muted } from './audio.js';

// ================================================================ save state
const SAVE_KEY = 'nexus-schrottberg.v1';
const REC_KEY = 'nexus-schrottberg.records';

function freshState(mode = 'career') {
  return {
    mode, seed: (Math.random() * 2 ** 31) >>> 0,
    credits: 0, cargo: {}, cargoCount: 0,
    levels: { hands: 0, speed: 0, drive: 0, cargo: 0, scanner: 0, link: 0 },
    helpers: {},
    stats: { removed: 0, found: {}, earned: 0, time: 0, grabs: 0 },
    coreFound: false, coreTime: 0, lastSave: Date.now(), pile: null,
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
      const body = new THREE.Mesh(new THREE.SphereGeometry(look.size * 0.5, 16, 12), new THREE.MeshStandardMaterial({ color: look.color, roughness: 0.4, metalness: 0.2 }));
      body.scale.y = 0.6;
      const eye = new THREE.Mesh(new THREE.BoxGeometry(look.size * 0.5, look.size * 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
      eye.position.set(0, 0, look.size * 0.5);
      const rotor = new THREE.Mesh(new THREE.TorusGeometry(look.size * 0.6, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
      rotor.rotation.x = Math.PI / 2;
      rotor.position.y = look.size * 0.25;
      const beam = new THREE.Mesh(new THREE.ConeGeometry(look.size * 0.5, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x6ff3f0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.y = -0.5;
      d.add(body, eye, rotor, beam);
      d.userData = { phase: idx * 1.7 + k * 2.1, r: 4 + ((idx * 3 + k * 5) % 10), h: look.h, speed: 0.15 + (k % 3) * 0.05, beam, size: look.size };
      body.castShadow = true;
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
const helperRate = () => HELPERS.reduce((a, h) => a + (S.helpers[h.id] || 0) * h.rate, 0);

let hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }

function updateHud() {
  setText('remaining', fmt(pile.total));
  const pct = ((TOTAL_STONES - pile.total) / TOTAL_STONES) * 100;
  setText('progress', `${pct.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %`);
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
function rollFinds(n) {
  const out = [];
  FINDS.forEach((f, tier) => { const k = poisson(n * f.rate); if (k) out.push({ f, k, tier }); });
  return out;
}

let fullWarnT = 0;
function handleFinds(list, byPlayer) {
  if (!list.length) return;
  let best = -1;
  for (const { f, k, tier } of list) {
    S.stats.found[f.id] = (S.stats.found[f.id] || 0) + k;
    if (!byPlayer || S.levels.link || S.mode === 'pure') {
      if (S.mode !== 'pure') { S.credits += f.value * k; S.stats.earned += f.value * k; }
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
      hint('Laderaum voll! Ab zum Nexus-Markt', '#ff6b6b');
      bot.setMood('sad', 2.5);
      sfx.full();
    }
  }
  if (best >= 0) {
    sfx.find(best);
    if (best >= 2) { bot.setMood('happy', 1.5); vibrate(20); }
  }
}

function cargoValue() {
  return FINDS.reduce((a, f) => a + (S.cargo[f.id] || 0) * f.value, 0);
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
  const radius = GRAB_RADIUS[S.levels.hands];
  const res = pile.grab(x, z, amount, Math.max(radius, 0.8));
  bot.grab();
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
  handleFinds(rollFinds(res.removed), true);
  if (res.ring) coreFound(true);
  scannerPing();
}

function scannerPing() {
  if (S.levels.scanner < 2 || S.coreFound) return;
  const heat = scannerHeat();
  sfx.ping(heat);
  if (heat > 0.85) bot.setMood('love', 1);
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
  handleFinds(rollFinds(r.removed), false);
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
  for (const { f, k } of rollFinds(removed)) { S.stats.found[f.id] = (S.stats.found[f.id] || 0) + k; credits += f.value * k; }
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
       <p class="lead">Du kannst weiter sortieren, bis das Deck komplett leer ist.</p>`,
      'Weiter aufräumen', () => {},
      'Neues Spiel', () => newGame(S.mode));
  }, 1600);
}

function formatTime(s) {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h} h ${m} min` : `${m} min ${sec} s`;
}

// ================================================================ shop
let shopTab = 'bot';
function openShop() {
  if (S.mode === 'pure') { hint('Im Modus „Pur“ gibt es keinen Markt'); return; }
  $('shop').classList.remove('hidden');
  grabState.holding = false;
  renderShop();
}
function closeShop() { $('shop').classList.add('hidden'); save(); }
$('shop-close').addEventListener('click', closeShop);
$('btn-dock').addEventListener('click', () => { initAudio(); openShop(); });
$('btn-sell').addEventListener('click', sellCargo);
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  shopTab = t.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  renderShop();
}));

function renderShop() {
  $('shop-credits').textContent = fmt(S.credits);
  const v = cargoValue();
  const sell = $('btn-sell');
  sell.disabled = !v;
  sell.textContent = v ? `Ladung verkaufen: +${fmt(v)} ⬡ (${fmt(S.cargoCount)} Funde)` : (S.levels.link ? 'Nexus-Link verkauft automatisch' : 'Laderaum ist leer');
  const list = $('shop-list');
  list.innerHTML = '';
  if (shopTab === 'bot') {
    for (const [key, up] of Object.entries(BOT_UPGRADES)) {
      const cur = S.levels[key];
      const next = up.levels[cur + 1];
      const curL = up.levels[cur];
      const el = document.createElement('div');
      el.className = 'item';
      const desc = next ? (next.desc || `${fmt(curL.value)} → <b>${fmt(next.value)}</b> ${up.unit}`) : (curL.desc || `${fmt(curL.value)} ${up.unit}`);
      el.innerHTML = `<div class="t">${up.title}: ${next ? next.name : curL.name}</div>
        <div class="d">${desc}</div>
        <div class="lv">${up.levels.slice(1).map((_, i) => `<i class="${i < cur ? 'on' : ''}"></i>`).join('')}</div>`;
      const b = document.createElement('button');
      b.className = 'buy' + (next ? '' : ' max');
      if (next) {
        b.textContent = `${fmt(next.cost)} ⬡`;
        b.disabled = S.credits < next.cost;
        b.onclick = () => {
          if (S.credits < next.cost) return;
          S.credits -= next.cost;
          S.levels[key]++;
          bot.applyUpgrades(S.levels);
          bot.setMood('happy', 2.5);
          sfx.upgrade();
          vibrate(30);
          feed(`Upgrade: ${next.name}`, '#ffb347');
          renderShop(); updateHud(); save();
        };
      } else { b.textContent = 'MAX'; b.disabled = true; }
      el.appendChild(b);
      list.appendChild(el);
    }
  } else if (shopTab === 'helpers') {
    for (const h of HELPERS) {
      const owned = S.helpers[h.id] || 0;
      const cost = helperCost(h, owned);
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `<div class="t">${h.name} <span style="color:var(--muted)">× ${owned}</span></div>
        <div class="d">${h.desc} · ${fmt(h.rate)} Teile/s pro Stück</div>`;
      const b = document.createElement('button');
      b.className = 'buy';
      b.textContent = `${fmt(cost)} ⬡`;
      b.disabled = S.credits < cost;
      b.onclick = () => {
        if (S.credits < cost) return;
        S.credits -= cost;
        S.helpers[h.id] = owned + 1;
        rebuildDrones();
        sfx.upgrade();
        feed(`Neuer Helfer: ${h.name}`, '#ffb347');
        renderShop(); updateHud(); save();
      };
      el.appendChild(b);
      list.appendChild(el);
    }
    const info = document.createElement('p');
    info.className = 'lead';
    info.style.fontSize = '13px';
    info.textContent = 'Helfer arbeiten auch, wenn das Spiel geschlossen ist (bis zu 2 Stunden). Ihre Funde werden direkt verkauft.';
    list.appendChild(info);
  } else {
    const el = document.createElement('div');
    el.className = 'stats';
    el.innerHTML = FINDS.map((f) => `<span style="color:${f.color}">${f.name} <small style="color:var(--muted)">(${fmt(f.value)} ⬡)</small></span><span>${fmt(S.stats.found[f.id] || 0)}</span>`).join('') +
      `<span>Sortierte Teile</span><span>${fmt(S.stats.removed)}</span>
       <span>Griffe</span><span>${fmt(S.stats.grabs)}</span>
       <span>Verdient gesamt</span><span>${fmt(S.stats.earned)} ⬡</span>
       <span>Spielzeit</span><span>${formatTime(S.stats.time)}</span>
       <span>Nexus-Kern</span><span>${S.coreFound ? '✔ gefunden' : 'verschollen'}</span>`;
    list.appendChild(el);
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
  if (pileView) {
    scene.remove(pileView.mesh, pileView.pebbles, pileView.ringMesh, pileView.glitter);
    pileView.mesh.geometry.dispose();
  }
  pile = new Pile(S.seed, S.pile);
  if (S.coreFound) pile.ring.found = true;
  pileView = new PileView(pile, scene);
  bot.applyUpgrades(S.levels);
  bot.group.position.set(WORLD.dock.x, 0, WORLD.dock.z - 1);
  bot.group.rotation.y = Math.PI;
  cam.yaw = 0; cam.pitch = 0.42; cam.dist = 7;
  rebuildDrones();
  hudCache = {};
}

function startGame(state, offline) {
  setupWorld(state);
  $('overlay-start').classList.add('hidden');
  hud.classList.remove('hidden');
  playing = true;
  updateHud();
  if (offline) offlineProgress();
  else if (S.stats.grabs === 0) {
    setTimeout(() => bot.setMood('curious', 2), 400);
    hint(S.mode === 'pure' ? 'Modus Pur: nur du, deine Hände und 5 Millionen Teile.' : 'Fahr zum Schrottberg und halte GREIFEN!', '#6ff3f0');
  }
  save();
}

function newGame(mode = 'career') { startGame(freshState(mode), false); }

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
    `<p class="lead">Dein Fortschritt wird automatisch gespeichert.</p>`,
    'Weiter', () => {},
    muted ? 'Ton einschalten' : 'Ton ausschalten', () => { setMuted(!muted); },
  );
  const extra = document.createElement('button');
  extra.className = 'ghost';
  extra.textContent = 'Hauptmenü';
  extra.onclick = () => { $('overlay-msg').classList.add('hidden'); showStart(); };
  $('msg-body').appendChild(extra);
});

setInterval(() => { if (playing) save(); }, 10000);
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
grabBtn.addEventListener('pointerup', grabEnd);
grabBtn.addEventListener('pointercancel', grabEnd);

// camera drag / pinch / tap on canvas
const canvas = renderer.domElement;
const ptrs = new Map();
let tapInfo = null, pinchDist = 0;
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
  const reach = 2.2 + GRAB_RADIUS[S.levels.hands] * 0.5;
  if (d > reach) { hint('Zu weit weg – fahr näher heran'); return; }
  bot.group.rotation.y = Math.atan2(hit.point.x - bp.x, hit.point.z - bp.z);
  doGrab(hit.point.x, hit.point.z);
}

window.addEventListener('keydown', (e) => {
  input.keys.add(e.code);
  if (e.code === 'Space') { grabState.holding = true; e.preventDefault(); }
  if (e.code === 'KeyE' && playing && nearDock()) openShop();
  if (e.code === 'Escape') closeShop();
});
window.addEventListener('keyup', (e) => {
  input.keys.delete(e.code);
  if (e.code === 'Space') grabState.holding = false;
});

function nearDock() {
  const p = bot.group.position;
  return Math.hypot(p.x - WORLD.dock.x, p.z - WORLD.dock.z) < WORLD.dock.r + 0.6;
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
    const speed = lv('drive') * mag;
    // climbing the heap is slower
    const ahead = pile.heightAt(p.x + (mx / ml) * 0.4, p.z + (mz / ml) * 0.4);
    const slope = Math.max(0, (ahead - Math.max(0, pile.heightAt(p.x, p.z))) / 0.4);
    const slow = 1 / (1 + slope * 0.6);
    p.x += (mx / ml) * speed * slow * dt;
    p.z += (mz / ml) * speed * slow * dt;
    const r = Math.hypot(p.x, p.z);
    if (r > WORLD.botLimit) { p.x *= WORLD.botLimit / r; p.z *= WORLD.botLimit / r; }
    const target = Math.atan2(mx, mz);
    let diff = target - bot.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    bot.group.rotation.y += diff * Math.min(1, dt * 10);
  }
  const ground = Math.max(0, pile.heightAt(p.x, p.z));
  p.y += (ground - p.y) * Math.min(1, dt * 12);
  bot.update(dt, moving);

  // hold-to-grab
  if (grabState.holding && playing) {
    grabState.timer -= dt;
    if (grabState.timer <= 0) {
      grabState.timer = 1 / lv('speed');
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
      $('btn-dock').classList.toggle('hidden', !nearDock() || S.mode === 'pure');
      updateHud();
      updateScannerHud();
    } else {
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
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---- boot: show the title over the saved (or a demo) heap
const boot = loadState();
setupWorld(boot || freshState());
showStart();
animate();

// test hook
window.__nx = { get S() { return S; }, get pile() { return pile; }, doGrab, coreFound, openShop, sellCargo, bot };
