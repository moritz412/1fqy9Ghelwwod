// Sternsplitter – Hauptspiel: Szene, Steuerung, Spiellogik, UI.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { World, M, MATS } from './world.js';
import { TOOLS, MAX_LEVEL, starLevel, deepLevel } from './levels.js';
import { Particles, SonarPing, StarShard } from './effects.js';
import { initAudio, sfx, haptic, setMuted, isMuted } from './audio.js';
import { makeRng } from './noise.js';

// ---------- Speicherstand ----------
const SAVE_KEY = 'sternsplitter.v1';
const save = loadSave();
function loadSave() {
  const def = { unlocked: 1, stars: {}, bestDepth: 0, muted: false };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return def; }
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* privat */ } }

// ---------- Renderer & Szene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x7a4a36, 1.6));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.2);
sun.position.set(30, 60, 20);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9a8cff, 0.6);
fill.position.set(-30, 10, -25);
scene.add(fill);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enablePan = false;
controls.minDistance = 6;
controls.maxPolarAngle = Math.PI * 0.49;
controls.rotateSpeed = 0.7;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

const particles = new Particles(scene);
const sonar = new SonarPing(scene);
const shard = new StarShard(scene);
let pedestal = null;

// ---------- Spielzustand ----------
const G = {
  world: null, p: null, mode: 'star',
  energy: 0, dynamite: 0, score: 0, depth: 0,
  tool: 'shovel', over: true, won: false,
  focus: new THREE.Vector3(), rng: makeRng(1),
  sandTimer: 0,
};

function startLevel(p) {
  if (G.world) { scene.remove(G.world.group); G.world.dispose(); }
  if (pedestal) { scene.remove(pedestal); pedestal.geometry.dispose(); }
  shard.hide();
  G.p = p; G.mode = p.mode;
  G.world = new World(p);
  scene.add(G.world.group);
  G.energy = p.energy; G.dynamite = p.dynamite; G.score = 0; G.depth = 0;
  G.over = false; G.won = false; G.rng = makeRng(p.seed + 5);
  G.surfaceY = p.surface;

  pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(p.W + 1.2, 1.2, p.D + 1.2),
    new THREE.MeshLambertMaterial({ color: 0x2a1e3a }),
  );
  pedestal.position.y = -0.6;
  scene.add(pedestal);

  const top = G.world.topY;
  G.focus.set(0, top - 3, 0);
  controls.target.copy(G.focus);
  const dist = Math.max(p.W, p.D) * 1.55 + 6;
  camera.position.set(dist * 0.62, top + dist * 0.62, dist * 0.78);
  controls.maxDistance = Math.max(80, dist * 2.2);
  controls.update();

  setTool('shovel');
  document.getElementById('pill-level').classList.toggle('hidden', p.mode !== 'star');
  document.getElementById('heat').style.visibility = p.mode === 'star' ? 'visible' : 'hidden';
  setHeat(null, p.mode === 'star' ? 'Tippe auf den Sand, um zu graben' : '');
  show('hud'); show('toolbar');
  hide('menu'); hide('result'); hide('help');
  updateHud();
  toast(p.mode === 'star' ? `Level ${p.level}` : 'Tiefenrausch – grab so tief du kannst!');
}

// ---------- Werkzeuge ----------
function setTool(t) {
  G.tool = t;
  document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
}

function useTool(hit, ray) {
  const w = G.world;
  const tool = TOOLS[G.tool];
  if (G.tool === 'dynamite') {
    if (G.dynamite <= 0) { toast('Kein Dynamit mehr'); return; }
  } else if (G.energy < tool.cost) { toast('Zu wenig Energie ⚡'); sfx.fail(); return; }

  const c = new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  let removed;
  if (G.tool === 'shovel') {
    removed = w.digSphere(c.x, c.y, c.z, tool.radius, tool.power);
    G.energy -= tool.cost;
  } else if (G.tool === 'drill') {
    const start = hit.point.clone().addScaledVector(ray.direction, -0.3);
    removed = w.digTunnel(start, ray.direction, tool.length, tool.radius, tool.power);
    G.energy -= tool.cost;
    sfx.drill();
    c.copy(start).addScaledVector(ray.direction, tool.length * 0.6);
  } else {
    removed = w.digSphere(c.x, c.y, c.z, tool.radius, tool.power);
    G.dynamite--;
    sfx.boom(); haptic(40);
    shakeT = 0.45;
  }
  afterDig(removed, c);
}

function afterDig(removed, center) {
  const w = G.world;
  const off = w.group.position;
  let hardest = 0, cracked = 0, broke = 0;
  const pickupMsgs = [];
  for (let k = 0; k < removed.length; k++) {
    const r = removed[k];
    const mat = MATS[r.m];
    if (r.cracked) { cracked++; continue; }
    broke++;
    hardest = Math.max(hardest, mat.hard);
    if (k % 2 === 0 || removed.length < 12) {
      particles.burst(new THREE.Vector3(r.x + 0.5 + off.x, r.y + 0.5, r.z + 0.5 + off.z), mat.color, 2, 4);
    }
    const depth = G.surfaceY - r.y;
    if (depth > G.depth) G.depth = depth;
    if (r.m === M.GEM) { G.energy += 3; G.score += 50; pickupMsgs.push('💎 +3⚡'); sfx.gem(); }
    else if (r.m === M.FOSSIL) { G.score += 100; pickupMsgs.push('🦴 Fossil +100'); sfx.fossil(); }
    else if (r.m === M.AMBER) { G.score += 40; G.energy += 1; pickupMsgs.push('🟠 Bernstein +1⚡'); sfx.gem(); }
  }
  if (broke) { if (G.tool === 'shovel') sfx.dig(hardest); haptic(8); }
  else if (cracked) { sfx.clank(); haptic(15); toast('Zu hart – nochmal schlagen oder Bohrer nehmen'); }
  if (pickupMsgs.length) toast(pickupMsgs.slice(0, 2).join('  '));
  G.score += broke;

  // Kamera folgt dem Grabungsort
  G.focus.set(center.x + off.x, Math.min(center.y, w.topY), center.z + off.z);

  if (G.mode === 'star') updateHeat(center);
  w.flush();
  updateHud();
  checkState();
}

function updateHeat(center) {
  const s = G.world.star;
  const d = Math.hypot(center.x - (s.x + 0.5), center.y - (s.y + 0.5), center.z - (s.z + 0.5));
  const ref = Math.max(G.p.W, G.p.D) * 0.75 + G.p.starDepth[1] * 0.5;
  const heat = Math.max(0, Math.min(1, 1 - d / ref));
  const labels = [
    [0.15, '🧊 Eiskalt'], [0.35, '❄️ Kalt'], [0.55, '🌤️ Lauwarm'],
    [0.72, '☀️ Warm'], [0.86, '🔥 Heiß!'], [2, '🌟 Glühend heiß!!'],
  ];
  const label = labels.find(([v]) => heat < v)[1];
  setHeat(heat, `${label} · ${Math.round(d)} m entfernt`);
  const h = document.getElementById('heat');
  h.classList.remove('pulse'); void h.offsetWidth; h.classList.add('pulse');
}

function setHeat(v, label) {
  document.getElementById('heat-fill').style.width = v == null ? '100%' : `${(1 - v) * 100}%`;
  document.getElementById('heat-label').textContent = label;
}

function useSonar() {
  if (G.over || G.mode !== 'star') { toast('Sonar gibt es nur in der Sternsuche'); return; }
  if (G.energy < TOOLS.sonar.cost) { toast('Zu wenig Energie ⚡'); sfx.fail(); return; }
  G.energy -= TOOLS.sonar.cost;
  const s = G.world.star, off = G.world.group.position;
  const j = () => (G.rng() - 0.5) * 6;
  const pos = new THREE.Vector3(s.x + 0.5 + off.x + j(), s.y + 0.5 + j() * 0.6, s.z + 0.5 + off.z + j());
  sonar.show(pos, 4.5, 4.5);
  sfx.sonar(); haptic(20);
  toast('📡 Signal empfangen!');
  updateHud();
  checkState();
}

function checkState() {
  if (G.over) return;
  const w = G.world;
  if (G.mode === 'star' && w.starExposed()) { win(); return; }
  const outOfMoves = G.energy < TOOLS.shovel.cost && G.dynamite <= 0;
  if (outOfMoves) {
    // kurz warten, Sand könnte noch etwas freilegen
    setTimeout(() => {
      if (G.over) return;
      if (G.mode === 'star' && w.starExposed()) { win(); return; }
      if (G.energy < TOOLS.shovel.cost && G.dynamite <= 0) lose();
    }, 900);
  }
}

function win() {
  G.over = true; G.won = true;
  const w = G.world, s = w.star, off = w.group.position;
  w.set(s.x, s.y, s.z, M.AIR);
  w.flush();
  const from = new THREE.Vector3(s.x + 0.5 + off.x, s.y + 0.5, s.z + 0.5 + off.z);
  G.focus.set(from.x, from.y, from.z);
  sfx.star(); haptic(60);
  toast('✦ Sternsplitter gefunden! ✦');
  shard.launch(from, w.topY + 4, () => {
    const ratio = G.energy / G.p.energy;
    const stars = ratio >= 0.45 ? 3 : ratio >= 0.2 ? 2 : 1;
    const bonus = 500 + G.energy * 25;
    G.score += bonus;
    const lv = G.p.level;
    save.stars[lv] = Math.max(save.stars[lv] || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(MAX_LEVEL, lv + 1));
    persist();
    showResult({
      icon: '✦', title: 'Sternsplitter geborgen!', stars,
      text: `Tiefe ${s ? G.surfaceY - s.y : 0} m · Restenergie ${G.energy}⚡ · ${G.score} Punkte`,
      next: lv < MAX_LEVEL ? `Level ${lv + 1}` : null,
    });
  });
  G.focus.y = w.topY + 2;
}

function lose() {
  G.over = true;
  sfx.fail();
  if (G.mode === 'deep') {
    const rec = G.depth > save.bestDepth;
    if (rec) { save.bestDepth = G.depth; persist(); }
    showResult({
      icon: '⬇', title: rec ? 'Neuer Tiefenrekord!' : 'Energie verbraucht',
      text: `Du hast ${G.depth} m tief gegraben. Rekord: ${save.bestDepth} m · ${G.score} Punkte`,
      next: null,
    });
  } else {
    const s = G.world.star;
    // Splitter kurz zeigen
    sonar.show(new THREE.Vector3(s.x + 0.5 + G.world.group.position.x, s.y + 0.5, s.z + 0.5 + G.world.group.position.z), 1.5, 3);
    showResult({
      icon: '☾', title: 'Die Energie ist aus',
      text: `Der Splitter lag ${G.surfaceY - s.y} m tief. Der blaue Ring zeigt, wo.`,
      next: null,
    });
  }
}

function showResult({ icon, title, text, stars, next }) {
  document.getElementById('res-icon').textContent = icon;
  document.getElementById('res-title').textContent = title;
  document.getElementById('res-text').textContent = text;
  const sr = document.getElementById('res-stars');
  sr.innerHTML = stars ? [1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('') : '';
  const nb = document.getElementById('res-next');
  nb.classList.toggle('hidden', !next);
  if (next) nb.textContent = `▶ ${next}`;
  setTimeout(() => show('result'), G.mode === 'star' && !G.won ? 1800 : 300);
}

// ---------- HUD ----------
function updateHud() {
  document.getElementById('energy').textContent = G.energy;
  document.getElementById('energy').parentElement.classList.toggle('low', G.energy <= 3 && !G.over);
  document.getElementById('depth').textContent = G.depth;
  document.getElementById('score').textContent = G.score;
  document.getElementById('level').textContent = G.p ? G.p.level : 1;
  document.getElementById('dyn-count').textContent = `×${G.dynamite}`;
  document.querySelector('.tool[data-tool="dynamite"]').disabled = G.dynamite <= 0;
  document.getElementById('btn-sonar').classList.toggle('hidden', G.mode !== 'star');
}

let toastTimer = 0;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}
const show = (id) => document.getElementById(id).classList.remove('hidden');
const hide = (id) => document.getElementById(id).classList.add('hidden');

// ---------- Eingabe: Tippen vs. Drehen ----------
const pointers = new Map();
let multiTouch = false;
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  if (pointers.size > 1) multiTouch = true;
});
const endPointer = (e, cancelled) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!cancelled && p && !multiTouch) {
    const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (moved < 12 && performance.now() - p.t < 500) onTap(e.clientX, e.clientY);
  }
  if (pointers.size === 0) multiTouch = false;
};
canvas.addEventListener('pointerup', (e) => endPointer(e, false));
canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

const raycaster = new THREE.Raycaster();
function onTap(cx, cy) {
  if (G.over || !G.world) return;
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = G.world.raycast(raycaster.ray.origin, raycaster.ray.direction);
  if (!hit) return;
  useTool(hit, raycaster.ray);
}

// ---------- Buttons ----------
document.querySelectorAll('.tool[data-tool]').forEach((b) => b.addEventListener('click', () => { initAudio(); sfx.tick(); setTool(b.dataset.tool); }));
document.getElementById('btn-sonar').addEventListener('click', () => { initAudio(); useSonar(); });
document.getElementById('btn-menu').addEventListener('click', () => openMenu());
document.getElementById('btn-sound').addEventListener('click', (e) => {
  setMuted(!isMuted()); save.muted = isMuted(); persist();
  e.currentTarget.textContent = isMuted() ? '🔇' : '🔊';
});
document.getElementById('btn-continue').addEventListener('click', () => { initAudio(); startLevel(starLevel(save.unlocked)); });
document.getElementById('btn-deep').addEventListener('click', () => { initAudio(); startLevel(deepLevel()); });
document.getElementById('btn-help').addEventListener('click', () => show('help'));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => hide('help')));
document.getElementById('btn-levels').addEventListener('click', () => {
  const g = document.getElementById('levelgrid');
  g.classList.toggle('hidden');
  g.innerHTML = '';
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const b = document.createElement('button');
    const st = save.stars[i] || 0;
    b.innerHTML = `${i}<small>${'★'.repeat(st)}</small>`;
    b.disabled = i > save.unlocked;
    b.addEventListener('click', () => { initAudio(); startLevel(starLevel(i)); });
    g.appendChild(b);
  }
});
document.getElementById('res-next').addEventListener('click', () => startLevel(starLevel(G.p.level + 1)));
document.getElementById('res-retry').addEventListener('click', () => startLevel(G.mode === 'star' ? starLevel(G.p.level) : deepLevel()));
document.getElementById('res-menu').addEventListener('click', () => openMenu());

function openMenu() {
  document.getElementById('menu-level').textContent = save.unlocked;
  document.getElementById('menu-record').textContent = save.bestDepth ? `· Rekord ${save.bestDepth} m` : '';
  document.getElementById('btn-continue').firstChild.textContent = G.world && !G.over && G.mode === 'star' ? '▶ Neu starten · Level ' : '▶ Sternsuche · Level ';
  hide('result');
  show('menu');
}

// ---------- Größe & Loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Hochformat (Handy): etwas weiteres Sichtfeld
  camera.fov = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let shakeT = 0;
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (G.world) {
    // Sand rieseln lassen
    G.sandTimer += dt;
    if (G.sandTimer > 0.06) {
      G.sandTimer = 0;
      if (G.world.stepSand(G.rng)) {
        G.world.flush();
        if (!G.over && G.mode === 'star' && G.world.starExposed()) win();
      }
    }
    // Kamera-Ziel sanft zum Grabungsort verschieben
    tmp.copy(G.focus).sub(controls.target).multiplyScalar(Math.min(1, dt * 3));
    controls.target.add(tmp);
    camera.position.add(tmp);
  }

  controls.autoRotate = !document.getElementById('menu').classList.contains('hidden');
  controls.autoRotateSpeed = 0.6;
  controls.update();
  particles.update(dt);
  sonar.update(dt);
  shard.update(dt);

  if (shakeT > 0) {
    shakeT -= dt;
    const s = shakeT * 0.6;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// Startbildschirm: Hintergrundwelt zeigen
setMuted(!!save.muted);
document.getElementById('btn-sound').textContent = save.muted ? '🔇' : '🔊';
startLevel(starLevel(save.unlocked));
G.over = true;
hide('hud'); hide('toolbar');
openMenu();
requestAnimationFrame(loop);

// Für Tests/Debugging
window.__G = G;
window.__digAt = (x, y, z, r = 2, pw = 9) => afterDig(G.world.digSphere(x, y, z, r, pw), new THREE.Vector3(x, y, z));
