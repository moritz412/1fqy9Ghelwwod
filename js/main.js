import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { World, T, INFO, levelParams, layerName } from './world.js';
import { initAudio, sfx, vibrate } from './audio.js';

// ---------------------------------------------------------------- state
const STORE_KEY = 'tiefenzeit.v1';
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { best: 0, deepest: 0, crystals: 0 }; }
  catch (e) { return { best: 0, deepest: 0, crystals: 0 }; }
}
function saveRecords(r) { try { localStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch (e) { /* ignore */ } }

const records = loadRecords();
const game = {
  level: 1, score: 0, stamina: 0, maxStamina: 1, bombs: 0,
  tool: 'shovel', cut: 0, deepest: 0, finds: { coin: 0, relic: 0, fossil: 0 },
  state: 'menu', // menu | play | won | lost
};
let world = null;

// ---------------------------------------------------------------- three setup
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a2618);
scene.fog = new THREE.Fog(0x3a2618, 60, 140);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.minDistance = 6;
controls.maxDistance = 90;
controls.maxPolarAngle = Math.PI * 0.62;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.rotateSpeed = 0.7;

scene.add(new THREE.HemisphereLight(0xfff1d6, 0x4a2c1a, 1.4));
const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
sun.position.set(18, 30, 12);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8fb6ff, 0.35);
fill.position.set(-15, 5, -10);
scene.add(fill);

// Decorative dunes far below the diorama.
const duneGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
duneGeo.rotateX(-Math.PI / 2);
{
  const p = duneGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, Math.sin(x * 0.08) * 1.6 + Math.cos(z * 0.06 + x * 0.03) * 2.2);
  }
  duneGeo.computeVertexNormals();
}
const dunes = new THREE.Mesh(duneGeo, new THREE.MeshLambertMaterial({ color: 0x9b6a3c }));
scene.add(dunes);

// Block meshes
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const blockMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
let blocks = null;           // InstancedMesh
let instToIndex = [];        // instanceId -> world index
let frame = null;            // outline of the whole dig site
let crystalMesh = null;
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();

function blockPos(x, d, z, out = new THREE.Vector3()) {
  return out.set(x - world.W / 2 + 0.5, -d, z - world.D / 2 + 0.5);
}

function buildWorldMeshes() {
  if (blocks) { scene.remove(blocks); blocks.dispose(); }
  if (frame) { scene.remove(frame); frame.geometry.dispose(); }
  if (crystalMesh) scene.remove(crystalMesh);

  blocks = new THREE.InstancedMesh(boxGeo, blockMat, world.W * world.D * world.H);
  blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blocks.count = 0;
  scene.add(blocks);

  const fg = new THREE.EdgesGeometry(new THREE.BoxGeometry(world.W, world.H, world.D));
  frame = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.25 }));
  frame.position.set(0, -world.H / 2 + 0.5, 0);
  scene.add(frame);

  crystalMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0x66e6ff, emissive: 0x1aa6d6, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.1, flatShading: true }),
  );
  const glow = new THREE.PointLight(0x66e6ff, 10, 7);
  crystalMesh.add(glow);
  crystalMesh.visible = false;
  blockPos(world.crystal.x, world.crystal.d, world.crystal.z, crystalMesh.position);
  scene.add(crystalMesh);

  dunes.position.y = -world.H - 4;
  refreshBlocks();
}

function blockColor(i, x, d, z, out) {
  const t = world.type[i];
  const showItem = INFO[t].item && world.revealed(x, d, z);
  const shownType = showItem ? t : world.host[i];
  out.setHex(INFO[shownType].color);
  let k = world.shade[i];
  if (!showItem) {
    k *= 1 - Math.min(d / world.H, 1) * 0.25;  // deeper = darker
    const maxHp = INFO[t].hp;
    const dmg = 1 - world.hp[i] / maxHp;
    k *= 1 - dmg * 0.45;                         // cracked = darker
  }
  out.multiplyScalar(k);
  return out;
}

function refreshBlocks() {
  const { W, D, H } = world;
  let n = 0;
  instToIndex.length = 0;
  const pos = new THREE.Vector3();
  for (let d = game.cut; d < H; d++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (!world.visible(x, d, z, game.cut)) continue;
    const i = world.idx(x, d, z);
    if (world.type[i] === T.CRYSTAL && world.revealed(x, d, z)) continue; // drawn as gem
    blockPos(x, d, z, pos);
    tmpM.makeTranslation(pos.x, pos.y, pos.z);
    blocks.setMatrixAt(n, tmpM);
    blocks.setColorAt(n, blockColor(i, x, d, z, tmpC));
    instToIndex[n] = i;
    n++;
  }
  blocks.count = n;
  blocks.instanceMatrix.needsUpdate = true;
  if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
  blocks.computeBoundingSphere();

  const c = world.crystal;
  crystalMesh.visible = (game.state === 'lost') ||
    (world.type[c.i] === T.CRYSTAL && c.d >= game.cut && world.revealed(c.x, c.d, c.z));
}

// ---------------------------------------------------------------- particles & effects
const PMAX = 160;
const particles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshLambertMaterial(), PMAX);
particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particles.frustumCulled = false;
particles.count = 0;
scene.add(particles);
const pData = [];

function burst(pos, color, count = 10, power = 1) {
  for (let k = 0; k < count; k++) {
    if (pData.length >= PMAX) pData.shift();
    pData.push({
      p: pos.clone().add(new THREE.Vector3((Math.random() - .5) * .6, (Math.random() - .5) * .6, (Math.random() - .5) * .6)),
      v: new THREE.Vector3((Math.random() - .5) * 4 * power, (2 + Math.random() * 4) * power, (Math.random() - .5) * 4 * power),
      life: 0.6 + Math.random() * 0.5, age: 0,
      c: new THREE.Color(color).multiplyScalar(0.8 + Math.random() * 0.4),
    });
  }
}

function updateParticles(dt) {
  let n = 0;
  for (let k = pData.length - 1; k >= 0; k--) {
    const q = pData[k];
    q.age += dt;
    if (q.age >= q.life) { pData.splice(k, 1); continue; }
    q.v.y -= 14 * dt;
    q.p.addScaledVector(q.v, dt);
    const s = 1 - q.age / q.life;
    tmpM.makeScale(s, s, s).setPosition(q.p);
    particles.setMatrixAt(n, tmpM);
    particles.setColorAt(n, q.c);
    n++;
  }
  particles.count = n;
  particles.instanceMatrix.needsUpdate = true;
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
}

const rings = [];
const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
ringGeo.rotateX(-Math.PI / 2);
function pulseRing(pos, color) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  m.position.copy(pos).y += 0.52;
  m.userData.age = 0;
  scene.add(m);
  rings.push(m);
}
function updateRings(dt) {
  for (let k = rings.length - 1; k >= 0; k--) {
    const r = rings[k];
    r.userData.age += dt;
    const t = r.userData.age / 0.8;
    if (t >= 1) { scene.remove(r); r.material.dispose(); rings.splice(k, 1); continue; }
    const s = 0.4 + t * 3.2;
    r.scale.set(s, 1, s);
    r.material.opacity = 0.9 * (1 - t);
  }
}

let shake = 0;

// ---------------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const hud = $('hud');
const toastEl = $('toast');
let toastTimer = 0;

function toast(text, color = '#fff') {
  toastEl.textContent = text;
  toastEl.style.color = color;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1100);
}

function heatColor(h) {
  return new THREE.Color().setHSL(0.6 - h * 0.6, 0.9, 0.55);
}

function setHeat(h) {
  const fillEl = $('heat-fill');
  fillEl.style.width = `${Math.round(h * 100)}%`;
  fillEl.style.backgroundColor = `#${heatColor(h).getHexString()}`;
  const words = ['eiskalt', 'kalt', 'kühl', 'lauwarm', 'warm', 'heiß', 'glühend!'];
  $('heat-text').textContent = words[Math.min(words.length - 1, Math.floor(h * words.length))];
  const det = $('detector');
  det.classList.remove('pulse'); void det.offsetWidth; det.classList.add('pulse');
}

function updateHud() {
  $('stamina-val').textContent = game.stamina;
  const f = $('stamina-fill');
  f.style.width = `${Math.max(0, game.stamina / game.maxStamina) * 100}%`;
  f.classList.toggle('low', game.stamina <= game.maxStamina * 0.2);
  $('score-val').textContent = game.score;
  $('depth-val').textContent = `${game.deepest} m`;
  $('level-val').textContent = game.level;
  $('bomb-count').textContent = game.bombs;
  $('cut-val').textContent = `${game.cut} m`;
  $('layer-name').textContent = `Ebene ${game.cut} m · ${layerName(game.cut)}`;
  document.querySelector('[data-tool="bomb"]').disabled = game.bombs <= 0;
  if (game.tool === 'bomb' && game.bombs <= 0) selectTool('shovel');
}

function selectTool(tool) {
  game.tool = tool;
  document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
}
document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => { initAudio(); selectTool(b.dataset.tool); }));

function setCut(c, moveCam = true) {
  c = Math.max(0, Math.min(world.H - 1, c));
  if (c === game.cut) return;
  game.cut = c;
  refreshBlocks();
  if (moveCam) camTargetY = -c;
  updateHud();
}
$('btn-up').addEventListener('click', () => setCut(game.cut - 2));
$('btn-down').addEventListener('click', () => setCut(game.cut + 2));

// ---------------------------------------------------------------- game flow
let camTargetY = 0;

function startLevel(level) {
  const p = levelParams(level);
  game.level = level;
  game.maxStamina = p.stamina;
  game.stamina = p.stamina;
  game.bombs = p.bombs;
  game.cut = 0;
  game.state = 'play';
  controls.autoRotate = false;
  world = new World(level, (Date.now() ^ (level * 99991)) >>> 0);
  buildWorldMeshes();
  camTargetY = 0;
  const r = Math.max(world.W, 12) * 1.45;
  camera.position.set(r * 0.75, r * 0.85, r * 0.95);
  controls.target.set(0, 0, 0);
  controls.update();
  selectTool('shovel');
  setHeat(0);
  $('heat-text').textContent = 'Grabe, um zu messen';
  updateHud();
  hud.classList.remove('hidden');
  toast(`Feld ${level}`, '#ffd08a');
}

function newGame() {
  game.score = 0;
  game.deepest = 0;
  game.finds = { coin: 0, relic: 0, fossil: 0 };
  startLevel(1);
}

function showMessage(title, bodyHtml, btn, onBtn, btn2, onBtn2) {
  $('msg-title').innerHTML = title;
  $('msg-body').innerHTML = bodyHtml;
  $('msg-btn').textContent = btn;
  $('msg-btn').onclick = () => { $('overlay-msg').classList.add('hidden'); onBtn(); };
  const b2 = $('msg-btn2');
  if (btn2) {
    b2.classList.remove('hidden');
    b2.textContent = btn2;
    b2.onclick = () => { $('overlay-msg').classList.add('hidden'); onBtn2(); };
  } else b2.classList.add('hidden');
  $('overlay-msg').classList.remove('hidden');
}

function commitRecords() {
  records.best = Math.max(records.best, game.score);
  records.deepest = Math.max(records.deepest, game.deepest);
  saveRecords(records);
}

function winLevel() {
  game.state = 'won';
  const bonus = game.stamina * 10 + world.crystal.d * 20;
  game.score += bonus;
  records.crystals = (records.crystals || 0) + 1;
  commitRecords();
  updateHud();
  sfx.crystal();
  vibrate([30, 40, 60]);
  setTimeout(() => {
    showMessage('💎 Zeitkristall geborgen!',
      `<div class="stats">
        <span>Fundtiefe</span><span>${world.crystal.d} m</span>
        <span>Restausdauer × 10</span><span>+${game.stamina * 10}</span>
        <span>Tiefenbonus</span><span>+${world.crystal.d * 20}</span>
        <span>Punkte gesamt</span><span>${game.score}</span>
      </div>
      <p class="lead">Das nächste Feld ist größer und tiefer.</p>`,
      `Weiter zu Feld ${game.level + 1}`, () => startLevel(game.level + 1),
      'Hauptmenü', () => showStart());
  }, 1300);
}

function loseLevel() {
  game.state = 'lost';
  commitRecords();
  // Show where the crystal was hiding.
  setCut(Math.max(0, world.crystal.d - 3));
  refreshBlocks();
  sfx.gameOver();
  setTimeout(() => {
    showMessage('Expedition beendet',
      `<p class="lead">Deine Ausdauer ist aufgebraucht. Der Kristall lag in <b>${world.crystal.d} m</b> Tiefe und leuchtet jetzt auf.</p>
      <div class="stats">
        <span>Erreichtes Feld</span><span>${game.level}</span>
        <span>Tiefste Grabung</span><span>${game.deepest} m</span>
        <span>Münzen · Relikte · Fossilien</span><span>${game.finds.coin} · ${game.finds.relic} · ${game.finds.fossil}</span>
        <span>Punkte</span><span>${game.score}</span>
        <span>Bestwert</span><span>${records.best}</span>
      </div>`,
      'Neue Expedition', () => newGame(),
      'Hauptmenü', () => showStart());
  }, 1500);
}

function showStart() {
  game.state = 'menu';
  controls.autoRotate = true;
  hud.classList.add('hidden');
  $('records').innerHTML = records.best > 0
    ? `Bestwert <b>${records.best}</b> · Tiefenrekord <b>${records.deepest} m</b> · Kristalle <b>${records.crystals || 0}</b>`
    : '';
  $('overlay-start').classList.remove('hidden');
}

$('btn-start').addEventListener('click', () => {
  initAudio();
  $('overlay-start').classList.add('hidden');
  newGame();
});
$('btn-menu').addEventListener('click', () => {
  showMessage('Pause', '<p class="lead">Die Grabung wartet auf dich.</p>',
    'Weitergraben', () => {}, 'Expedition abbrechen', () => { commitRecords(); showStart(); });
});

// ---------------------------------------------------------------- digging
function collect(t, pos) {
  if (t === T.COIN) { game.score += 25; game.finds.coin++; sfx.coin(); toast('+25 Münze', '#ffd34d'); burst(pos, 0xffd34d, 14, 1.2); }
  else if (t === T.RELIC) { game.score += 100; game.finds.relic++; sfx.relic(); toast('+100 Relikt', '#3fbfa4'); burst(pos, 0x3fbfa4, 18, 1.2); }
  else if (t === T.FOSSIL) {
    game.score += 50; game.finds.fossil++;
    game.stamina = Math.min(game.maxStamina, game.stamina + 8);
    sfx.fossil(); toast('Fossil! +8 Ausdauer', '#f4ecd8'); burst(pos, 0xf4ecd8, 18, 1.2);
  }
}

function measure(x, d, z, pos) {
  const dist = world.distToCrystal(x, d, z);
  const h = Math.max(0, Math.min(1, 1 - dist / 16));
  const heat = h * h * (3 - 2 * h);
  setHeat(heat);
  sfx.ping(heat);
  pulseRing(pos, heatColor(heat));
}

function breakBlock(x, d, z, pos) {
  const i = world.idx(x, d, z);
  const t = world.type[i];
  if (t === T.CRYSTAL) {
    world.remove(x, d, z);
    crystalFly = { t: 0, from: crystalMesh.position.clone() };
    burst(pos, 0x66e6ff, 30, 1.5);
    winLevel();
    return;
  }
  const hostColor = INFO[world.host[i]].color;
  world.remove(x, d, z);
  burst(pos, hostColor, 10);
  if (INFO[t].item) collect(t, pos);
  if (d + 1 > game.deepest) game.deepest = d + 1;
}

function dig(x, d, z) {
  const i = world.idx(x, d, z);
  const t = world.type[i];
  const pos = blockPos(x, d, z);
  const tool = game.tool;

  if (t === T.CRYSTAL && world.revealed(x, d, z)) { breakBlock(x, d, z, pos); refreshBlocks(); return; }

  if (tool === 'bomb') {
    if (game.bombs <= 0 || game.stamina < 4) { sfx.deny(); toast('Zu wenig Ausdauer', '#ff6b4a'); return; }
    game.bombs--; game.stamina -= 4;
    sfx.bomb(); vibrate(80); shake = 0.6;
    for (let dd = -1; dd <= 1; dd++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const bx = x + dx, bd = d + dd, bz = z + dz;
      const bt = world.get(bx, bd, bz);
      if (bt <= 0 || bt === T.CRYSTAL) continue;
      breakBlock(bx, bd, bz, blockPos(bx, bd, bz));
    }
    burst(pos, 0xffa040, 30, 2);
    measure(x, d, z, pos);
  } else {
    const power = tool === 'pick' ? 3 : 1;
    const cost = tool === 'pick' ? 2 : 1;
    if (game.stamina < cost) { sfx.deny(); return; }
    game.stamina -= cost;
    world.hp[i] -= power;
    const hard = INFO[world.host[i]].hp;
    if (world.hp[i] <= 0) {
      sfx.breakBlock(hard); vibrate(15);
      breakBlock(x, d, z, pos);
    } else {
      sfx.hit(hard); vibrate(6);
      burst(pos, INFO[world.host[i]].color, 3, 0.6);
      shake = Math.max(shake, 0.08);
    }
    measure(x, d, z, pos);
  }

  // Follow the dig downward.
  if (d >= game.cut + 7) setCut(d - 4);
  refreshBlocks();
  updateHud();

  if (game.state === 'play' && game.stamina <= 0) loseLevel();
}

// ---------------------------------------------------------------- input (tap vs. drag)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map();
let gesture = null;

renderer.domElement.addEventListener('pointerdown', (e) => {
  initAudio();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) gesture = { x: e.clientX, y: e.clientY, t: performance.now(), multi: false, moved: false, button: e.button };
  else if (gesture) gesture.multi = true;
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!gesture || !pointers.has(e.pointerId)) return;
  if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 10) gesture.moved = true;
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size > 0 || !gesture) return;
  const g = gesture; gesture = null;
  if (e.type === 'pointercancel' || g.multi || g.moved || g.button !== 0) return;
  if (performance.now() - g.t > 450) return;
  handleTap(e.clientX, e.clientY);
}
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);

function handleTap(cx, cy) {
  if (game.state !== 'play') return;
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);

  if (crystalMesh.visible) {
    const hitC = raycaster.intersectObject(crystalMesh, false)[0];
    const hitB = raycaster.intersectObject(blocks, false)[0];
    if (hitC && (!hitB || hitC.distance < hitB.distance + 0.3)) {
      const c = world.crystal;
      dig(c.x, c.d, c.z);
      return;
    }
  }
  const hit = raycaster.intersectObject(blocks, false)[0];
  if (!hit || hit.instanceId === undefined) return;
  const i = instToIndex[hit.instanceId];
  const [x, d, z] = world.coords(i);
  if (!world.diggable(x, d, z, game.cut)) {
    sfx.deny();
    toast(d === game.cut ? 'Erst von oben freilegen' : 'Hier kommst du nicht ran', '#ffb347');
    return;
  }
  dig(x, d, z);
}

// ---------------------------------------------------------------- loop
let crystalFly = null;
const clock = new THREE.Clock();

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < h ? 58 : 45; // portrait phones need a wider view
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (world) {
    // Smoothly follow the current cut plane.
    const dy = camTargetY - controls.target.y;
    if (Math.abs(dy) > 0.01) {
      const step = dy * Math.min(1, dt * 4);
      controls.target.y += step;
      camera.position.y += step;
    }
    if (crystalMesh) {
      crystalMesh.rotation.y += dt * 1.5;
      if (crystalFly) {
        crystalFly.t += dt;
        crystalMesh.visible = true;
        crystalMesh.position.y = crystalFly.from.y + crystalFly.t * crystalFly.t * 6;
        crystalMesh.scale.setScalar(1 + crystalFly.t * 1.5);
        if (crystalFly.t > 1.4) { crystalFly = null; crystalMesh.visible = false; crystalMesh.scale.setScalar(1); }
      } else {
        crystalMesh.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
      }
    }
  }
  controls.update();
  updateParticles(dt);
  updateRings(dt);

  const saved = camera.position.clone();
  if (shake > 0) {
    const s = shake * 0.4;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    shake = Math.max(0, shake - dt * 2.5);
  }
  renderer.render(scene, camera);
  camera.position.copy(saved);
  requestAnimationFrame(animate);
}

// Show the title screen over a demo field.
world = new World(1, 12345);
buildWorldMeshes();
camera.position.set(22, 20, 26);
controls.target.set(0, -3, 0);
controls.autoRotateSpeed = 0.6;
showStart();
animate();

// Debug/test hook
window.__tz = { game, get world() { return world; }, dig };
