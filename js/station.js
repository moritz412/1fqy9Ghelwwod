// Nexus Prime: the player's own modular space station, built from scrap. Long-term (meta) progression.
import * as THREE from 'three';
import { texMat } from './textures.js';

export const STATION_POS = new THREE.Vector3(0, 78, -70);
export const CELL = 9;                       // spacing between module cells
export const TONS_PER_PART = 1 / 1000;

// bonus: per level; req: rank needed; rare: extra find costs (from the Lager)
export const MODULES_ST = {
  corridor: { icon: '🔗', name: 'Verbindungsgang', cost: [8, 0], bonus: null, desc: 'Verbindet Module, schafft neue Anbauplätze.', rank: 0, max: 1 },
  refinery: { icon: '🔥', name: 'Raffinerie',      cost: [25, 2000], bonus: { value: 0.08 }, desc: '+8 % Fundwert je Stufe.', rank: 0, max: 3 },
  habitat:  { icon: '🏠', name: 'Wohnring',        cost: [20, 1500], bonus: { xp: 0.15 }, desc: '+15 % XP je Stufe.', rank: 0, max: 3 },
  solar:    { icon: '☀️', name: 'Solarflügel',      cost: [18, 1200], bonus: { power: 0.2 }, desc: '+20 % Strom für alle Anlagen je Stufe.', rank: 0, max: 3 },
  dock:     { icon: '📦', name: 'Frachtdock',      cost: [30, 3000], bonus: { cargo: 0.5, start: 500 }, desc: '+50 % Laderaum und +500 ⬡ Startkapital pro Deck je Stufe.', rank: 1, max: 3 },
  drones:   { icon: '🛸', name: 'Drohnenwerft',    cost: [40, 6000], bonus: { drones: 0.25 }, desc: '+25 % Tempo für Atomar-Drohnen je Stufe.', rank: 1, max: 3 },
  observ:   { icon: '🔭', name: 'Observatorium',   cost: [50, 9000], bonus: { events: 0.2, glitter: 1 }, desc: 'Ereignisse 20 % häufiger, Kern leuchtet durch mehr Schrott.', rank: 1, max: 3 },
  teleport: { icon: '🌀', name: 'Teleport-Relais', cost: [90, 25000], rare: { artifact: 1 }, bonus: { teleport: 1 }, desc: 'Beamt den Laderaum alle 45 s gebührenfrei zur Ablage.', rank: 2, max: 1 },
  lab:      { icon: '🧪', name: 'Forschungsdeck',  cost: [70, 18000], rare: { datacore: 5 }, bonus: { rare: 0.15 }, desc: '+15 % seltene Funde je Stufe.', rank: 2, max: 3 },
  gravcore: { icon: '🌌', name: 'Gravitationskern', cost: [250, 120000], rare: { graviton: 2, artifact: 1 }, bonus: { all: 0.25 }, desc: '+25 % auf Fundwert, XP und Drohnen.', rank: 3, max: 1 },
};
export const RANKS = [
  { name: 'Außenposten', modules: 0 },
  { name: 'Station', modules: 5 },
  { name: 'Zitadelle', modules: 11 },
  { name: 'Megastation', modules: 18 },
];
export const stationRank = (mods) => { let r = 0; RANKS.forEach((k, i) => { if (mods.length >= k.modules) r = i; }); return r; };
// Cost grows with the station size and with every module of the same type, so stacking one bonus gets pricey.
export const moduleCost = (type, lvl, mods = []) => {
  const c = MODULES_ST[type].cost;
  const size = lvl === 0 ? Math.pow(1.18, mods.length) : 1;
  const same = lvl === 0 ? Math.pow(1.6, mods.filter((m) => m.type === type).length) : 1;
  const f = size * same;
  return [Math.round(c[0] * Math.pow(2.6, lvl) * f), Math.round(c[1] * Math.pow(3, lvl) * f)];
};

export function stationBonus(mods) {
  const b = { value: 0, xp: 0, power: 0, cargo: 0, start: 0, drones: 0, events: 0, glitter: 0, teleport: 0, rare: 0, all: 0 };
  for (const m of mods) {
    const def = MODULES_ST[m.type];
    if (!def.bonus) continue;
    for (const [k, v] of Object.entries(def.bonus)) b[k] += v * (m.lvl || 1);
  }
  return b;
}

const key = (x, y, z) => `${x},${y},${z}`;
export function freeCells(mods) {
  const occ = new Set([key(0, 0, 0), ...mods.map((m) => key(m.x, m.y, m.z))]);
  const out = [];
  const seen = new Set();
  const all = [{ x: 0, y: 0, z: 0 }, ...mods];
  for (const m of all) {
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
      const x = m.x + dx, y = m.y + dy, z = m.z + dz;
      const k = key(x, y, z);
      if (occ.has(k) || seen.has(k) || Math.abs(x) > 3 || Math.abs(z) > 3 || Math.abs(y) > 1) continue;
      seen.add(k);
      out.push({ x, y, z });
    }
  }
  return out;
}

// ------------------------------------------------------------------ 3D
function moduleMesh(type, lvl) {
  const g = new THREE.Group();
  const hull = texMat('hull', 0xeef1f5);
  const metal = texMat('metal', 0xb8bec8);
  const glow = new THREE.MeshBasicMaterial({ color: 0x6ff3f0 });
  const s = 1 + (lvl - 1) * 0.15;
  const add = (m) => { g.add(m); return m; };
  if (type === 'hub') {
    add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), hull));
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.35, 10, 40), metal)); ring.rotation.x = Math.PI / 2;
    const band = add(new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.08, 6, 40), glow)); band.rotation.x = Math.PI / 2;
    for (let k = 0; k < 8; k++) { const w = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), glow)); const a = k / 8 * Math.PI * 2; w.position.set(Math.cos(a) * 2.55, 0.9, Math.sin(a) * 2.55); w.lookAt(0, 0.9, 0); }
    g.userData.spin = ring;
  } else if (type === 'corridor') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.5, 12), hull)).rotation.z = Math.PI / 2;
    for (const x of [-1.5, 1.5]) { const r = add(new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.12, 6, 20), metal)); r.rotation.y = Math.PI / 2; r.position.x = x; }
    const strip = add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.1), glow)); strip.position.set(0, 0.6, 0.85);
  } else if (type === 'refinery') {
    add(new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), hull));
    for (const [x, z] of [[-1, -1], [1, 1], [1, -1]]) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.5, 10), metal)); c.position.set(x, 2.6, z); }
    const fire = add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8a3a }))); fire.position.set(0, 0, 2.05); fire.scale.z = 0.2;
    g.userData.pulse = fire;
  } else if (type === 'habitat') {
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.9, 12, 40), hull)); ring.rotation.x = Math.PI / 2;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2, 12), metal));
    for (let k = 0; k < 4; k++) { const sp = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.2, 6), metal)); sp.rotation.z = Math.PI / 2; sp.rotation.y = k * Math.PI / 4; }
    for (let k = 0; k < 16; k++) { const w = add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.05), glow)); const a = k / 16 * Math.PI * 2; w.position.set(Math.cos(a) * 4.1, 0, Math.sin(a) * 4.1); w.lookAt(0, 0, 0); }
    g.userData.spin = ring;
  } else if (type === 'solar') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 8), metal)).rotation.z = Math.PI / 2;
    const panel = new THREE.MeshStandardMaterial({ color: 0x1b2a6a, metalness: 0.8, roughness: 0.25, emissive: 0x0a1440 });
    for (const x of [-3, 3]) for (const zz of [-1.6, 1.6]) { const p = add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 2.8), panel)); p.position.set(x, 0, zz); }
    add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), hull));
  } else if (type === 'dock') {
    const frame = texMat('metal', 0xffb347);
    for (const [x, y] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 5), frame)); b.position.set(x, y, 0); }
    const cols = [0x2f6fa0, 0xb04a3a, 0xd0a030];
    for (let k = 0; k < 3; k++) { const c = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), texMat('metal', cols[k]))); c.position.set(-1 + k, -0.8 + (k % 2) * 1.2, -1 + k); }
  } else if (type === 'drones') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.6, 6), hull));
    const door = add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.65, 6), new THREE.MeshStandardMaterial({ color: 0x16181c }))); door.position.y = 0.01;
    const lights = add(new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.08, 6, 6), glow)); lights.rotation.x = Math.PI / 2; lights.position.y = 0.85;
    const mini = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.7), texMat('hull', 0xffb347))); mini.position.y = 1.4;
    g.userData.bob = mini;
  } else if (type === 'observ') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 2, 12), hull));
    const dome = add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.5, metalness: 0.3, roughness: 0.05 }))); dome.position.y = 1;
    const tele = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 2, 10), metal)); tele.position.set(0, 1.8, 0); tele.rotation.z = 0.7;
    const dish = add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), new THREE.MeshStandardMaterial({ color: 0xeef1f5, side: THREE.DoubleSide }))); dish.position.set(0, -1.6, 0); dish.rotation.x = Math.PI;
    g.userData.spin2 = tele;
  } else if (type === 'teleport') {
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.4, 12, 40), metal));
    const portal = add(new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })));
    g.userData.pulse = portal; g.userData.spin = ring;
  } else if (type === 'lab') {
    add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3.4), hull));
    const core = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshBasicMaterial({ color: 0x7cff9a }))); core.position.y = 2;
    const ant = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), metal)); ant.position.set(1.2, 2.3, 1.2);
    g.userData.spin = core;
  } else if (type === 'gravcore') {
    add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshStandardMaterial({ color: 0x6a2aa0, emissive: 0x9a4aff, emissiveIntensity: 1.4, roughness: 0.2 })));
    for (let k = 0; k < 3; k++) { const r = add(new THREE.Mesh(new THREE.TorusGeometry(3.2 + k * 0.5, 0.12, 8, 48), metal)); r.rotation.set(k * 0.9, k * 0.5, 0); }
    g.userData.spinAll = true;
  }
  g.scale.setScalar(s);
  return g;
}

export class StationView {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.position.copy(STATION_POS);
    this.root.rotation.x = 0.25;
    scene.add(this.root);
    this.modules = new THREE.Group();
    this.markers = new THREE.Group();
    this.root.add(this.modules, this.markers);
    this.key = '';
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0x6ff3f0, transparent: true, opacity: 0.18, depthWrite: false });
    this.markerSel = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.7, depthWrite: false });
    this.strutMat = texMat('metal', 0x9aa0a8);
  }
  sync(mods, showMarkers, selected) {
    const k = JSON.stringify(mods) + showMarkers + (selected ? `${selected.x},${selected.y},${selected.z}` : '');
    if (k === this.key) return;
    this.key = k;
    this.modules.clear();
    const hub = moduleMesh('hub', 1);
    this.modules.add(hub);
    const all = [{ x: 0, y: 0, z: 0, type: 'hub' }, ...mods];
    for (const m of mods) {
      const mesh = moduleMesh(m.type, m.lvl || 1);
      mesh.position.set(m.x * CELL, m.y * CELL, m.z * CELL);
      mesh.userData.cell = m;
      this.modules.add(mesh);
    }
    // struts between neighbours
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) !== 1) continue;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, CELL - 4, 10), this.strutMat);
      strut.position.set((a.x + b.x) / 2 * CELL, (a.y + b.y) / 2 * CELL, (a.z + b.z) / 2 * CELL);
      if (a.x !== b.x) strut.rotation.z = Math.PI / 2;
      if (a.z !== b.z) strut.rotation.x = Math.PI / 2;
      this.modules.add(strut);
    }
    this.markers.clear();
    if (showMarkers) {
      for (const c of freeCells(mods)) {
        const sel = selected && selected.x === c.x && selected.y === c.y && selected.z === c.z;
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), sel ? this.markerSel : this.markerMat);
        m.position.set(c.x * CELL, c.y * CELL, c.z * CELL);
        m.userData.free = c;
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: sel ? 0xffb347 : 0x6ff3f0 }));
        m.add(edge);
        this.markers.add(m);
      }
    }
  }
  update(dt, t) {
    this.root.rotation.y += dt * (this.markers.children.length ? 0 : 0.02);
    for (const g of this.modules.children) {
      const u = g.userData;
      if (u.spin) u.spin.rotation.z += dt * 0.3;
      if (u.spin2) u.spin2.rotation.y += dt * 0.4;
      if (u.spinAll) g.rotation.y += dt * 0.5;
      if (u.pulse) u.pulse.scale.setScalar(0.95 + Math.sin(t * 0.6) * 0.05);
      if (u.bob) u.bob.position.y = 1.4 + Math.sin(t * 1.2) * 0.4;
    }
    for (const m of this.markers.children) m.rotation.y += dt * 0.6;
  }
  worldOf(cell) { return this.root.localToWorld(new THREE.Vector3(cell.x * CELL, cell.y * CELL, cell.z * CELL)); }
}

// ------------------------------------------------------------------ expeditions & traders
export const EXPEDITIONS = [
  { id: 'belt',   icon: '☄️', name: 'Asteroidenring',  minutes: 5,   cost: 500,    rank: 0, reward: { tons: 12, credits: 1500, finds: { probe: 3 } } },
  { id: 'aurora', icon: '🛰️', name: 'Wrack der Aurora', minutes: 20,  cost: 3000,   rank: 0, reward: { tons: 40, credits: 6000, finds: { datacore: 3, badge: 1 } } },
  { id: 'nebula', icon: '🌌', name: 'Kessa-Nebel',      minutes: 60,  cost: 15000,  rank: 1, reward: { tons: 120, credits: 30000, finds: { artifact: 1, datacore: 6 } } },
  { id: 'deep',   icon: '🕳️', name: 'Tiefer Raum',      minutes: 240, cost: 80000,  rank: 2, reward: { tons: 500, credits: 200000, finds: { graviton: 2, artifact: 2 } } },
];
export const expSlots = (mods) => 1 + Math.min(2, mods.filter((m) => m.type === 'dock').length);

// trader deals: give -> get (finds from the Lager or credits)
export function makeTraderDeals(level, rnd = Math.random) {
  const pool = [
    { give: { copper: 30 }, get: { datacore: 1 }, text: 'Kupfer gegen Datenkern' },
    { give: { ice: 15 }, get: { credits: 600 }, text: 'Eiskristalle zum Sonderpreis' },
    { give: { platinum: 3 }, get: { credits: 2500 }, text: 'Platin zum Spitzenpreis' },
    { give: { probe: 6 }, get: { badge: 1 }, text: 'Sondenteile gegen Abzeichen' },
    { give: { credits: 8000 + level * 500 }, get: { artifact: 1 }, text: 'Alien-Artefakt kaufen' },
    { give: { credits: 20000 + level * 2000 }, get: { graviton: 1 }, text: 'Gravitonperle kaufen' },
    { give: { datacore: 4 }, get: { tons: 40 }, text: 'Datenkerne gegen Baumaterial' },
    { give: { credits: 3000 + level * 300 }, get: { tons: 25 }, text: 'Schrott-Tonnen kaufen' },
  ];
  const out = [];
  while (out.length < 3) {
    const d = pool[Math.floor(rnd() * pool.length)];
    if (!out.includes(d)) out.push(d);
  }
  return out.map((d) => ({ ...d, done: false }));
}
