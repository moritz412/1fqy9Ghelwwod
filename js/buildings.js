// Base building: build sites around the heap, production chain (extract -> buffer -> sort), power grid.
import * as THREE from 'three';
import { texMat } from './textures.js';
import { mergeStatic } from './merge.js';

export const SITE_ANGLES = [15, 32, 72, 112, 135, 158, 202, 225, 248, 275, 300, 325, 345].map((d) => (d * Math.PI) / 180);
export const SITE_R = 21;
export const SITE_COSTS = [0, 0, 0, 2500, 6000, 15000, 35000, 80000, 180000, 400000, 900000, 2000000, 4500000];
export const BASE_BUFFER = 2000;
export const BUILD_UNLOCK_LEVEL = 4;

// cost of level L (0-based) = cost * growth^L
export const BUILDINGS = {
  extractor: { icon: '🌀', name: 'Schrottsauger',   cost: 1200, growth: 3.0, power: 2, desc: 'Saugt Rohschrott aus dem Berg.', stat: 'Teile/s', values: [20, 50, 120, 300, 800] },
  sorter:    { icon: '⚙️', name: 'Sortieranlage',   cost: 1800, growth: 3.0, power: 3, desc: 'Sortiert Rohschrott zu Funden und Credits.', stat: 'Teile/s', values: [30, 80, 200, 500, 1300] },
  silo:      { icon: '🛢️', name: 'Schrottsilo',     cost: 700,  growth: 2.6, power: 0, desc: 'Puffert Rohschrott, wenn die Sortierung nicht nachkommt.', stat: 'Platz', values: [5000, 12000, 30000, 80000, 200000] },
  reactor:   { icon: '⚛️', name: 'Reaktor',         cost: 1500, growth: 2.8, power: 0, desc: 'Liefert Strom für alle Anlagen.', stat: 'Strom', values: [10, 18, 30, 50, 80] },
  lab:       { icon: '🔬', name: 'Analyselabor',    cost: 6000, growth: 3.2, power: 4, desc: 'Mehr Wert für jedes sortierte Teil.', stat: '% Wert', values: [15, 30, 50, 75, 110] },
  fab:       { icon: '🏭', name: 'Auto-Fabrikator', cost: 9000, growth: 3.0, power: 3, desc: 'Baut automatisch Gegenstände aus dem Lager.', stat: 's pro Teil', values: [180, 120, 90, 60, 40] },
  hangar:    { icon: '🛸', name: 'Drohnenhangar',   cost: 5000, growth: 3.0, power: 2, desc: 'Atomar-Drohnen arbeiten schneller.', stat: '% Tempo', values: [25, 50, 80, 120, 170] },
  beacon:    { icon: '📡', name: 'Kapsel-Leitstand', cost: 3000, growth: 2.8, power: 1, desc: 'Frachtkapseln kommen häufiger.', stat: '% öfter', values: [30, 60, 100, 150, 220] },
};
export const MAX_BLD_LEVEL = 5;
export const buildCost = (type, lvl) => Math.round(BUILDINGS[type].cost * Math.pow(BUILDINGS[type].growth, lvl));
export const bldValue = (b) => BUILDINGS[b.type].values[b.lvl - 1];

export function sitePos(i, r = SITE_R) {
  const a = SITE_ANGLES[i];
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
}

// Totals for a list of sites (null = empty).
export function baseStats(sites) {
  const t = { supply: 0, demand: 0, extract: 0, sort: 0, buffer: BASE_BUFFER, lab: 0, fabTime: 0, hangar: 0, beacon: 0 };
  for (const b of sites) {
    if (!b) continue;
    const v = bldValue(b);
    t.demand += BUILDINGS[b.type].power * b.lvl;
    if (b.type === 'reactor') t.supply += v;
    if (b.type === 'extractor') t.extract += v;
    if (b.type === 'sorter') t.sort += v;
    if (b.type === 'silo') t.buffer += v;
    if (b.type === 'lab') t.lab += v;
    if (b.type === 'fab') t.fabTime = t.fabTime ? Math.min(t.fabTime, v) : v;
    if (b.type === 'hangar') t.hangar += v;
    if (b.type === 'beacon') t.beacon += v;
  }
  t.eff = t.demand ? Math.min(1, t.supply / t.demand) : 1;
  return t;
}

// ------------------------------------------------------------------ 3D
const M = {
  white: texMat('hull', 0xeef1f5),
  grey: texMat('metal', 0x9aa0a8),
  dark: new THREE.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.6, roughness: 0.35 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x2fc9a8, metalness: 0.3, roughness: 0.45 }),
  glow: new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }),
  hot: new THREE.MeshBasicMaterial({ color: 0x7cff9a }),
  pad: new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.5, roughness: 0.5 }),
};

const STRIP = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
const ACCENT = {
  extractor: 0xffb347, sorter: 0x7cc7ff, silo: 0xc9a0ff, reactor: 0x7cff9a,
  lab: 0x6ff3f0, fab: 0xff8f70, hangar: 0xffd36a, beacon: 0x9fb8ff,
};
const accentMats = {};
const accentMat = (type) => accentMats[type] || (accentMats[type] = new THREE.MeshStandardMaterial({ color: ACCENT[type], metalness: 0.3, roughness: 0.4 }));

// small helpers for space-hull details
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function cyl(rt, rb, h, seg, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return m; }
// rounded hull block: box body with a chamfer band, an accent stripe and light strips on the front
function hullBlock(w, h, d, type) {
  const g = new THREE.Group();
  g.add(box(w, h * 0.82, d, M.white, 0, h * 0.41, 0));
  g.add(box(w * 0.92, h * 0.18, d * 0.92, M.white, 0, h * 0.91, 0));
  g.add(box(w + 0.04, 0.12, d + 0.04, accentMat(type), 0, h * 0.62, 0));
  g.add(box(w * 0.6, 0.05, 0.02, STRIP, 0, h * 0.3, d / 2 + 0.01));
  g.add(box(0.02, 0.05, d * 0.6, STRIP, w / 2 + 0.01, h * 0.3, 0));
  g.add(box(w + 0.06, 0.08, d + 0.06, M.dark, 0, 0.04, 0));
  g.userData.static = true;
  return g;
}
// radiator fin panels (space stations dump heat through these)
function radiator(len, mat) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) g.add(box(0.03, 0.5, len, mat, k * 0.12 - 0.12, 0, 0));
  return g;
}
const finMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ef, metalness: 0.5, roughness: 0.35 });

function model(type, lvl) {
  const g = new THREE.Group();
  const anim = {};
  const s = 0.85 + lvl * 0.08;
  const acc = accentMat(type);
  if (type === 'extractor') {
    g.add(hullBlock(1.8, 1.4, 1.8, type));
    const turret = cyl(0.55, 0.7, 0.45, 16, M.white, 0, 1.6, 0);
    const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.dark); sensor.position.y = 1.82;
    const spin = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 24), STRIP); spin.rotation.x = Math.PI / 2; spin.position.y = 1.6;
    // articulated arm reaching towards the heap (local -z faces the heap)
    const boom = new THREE.Group(); boom.position.set(0, 1.8, -0.6);
    const seg1 = cyl(0.16, 0.2, 2.2, 10, M.white, 0, -0.3, -1.0); seg1.rotation.x = Math.PI / 2 - 0.25;
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M.dark); joint.position.set(0, -0.55, -2.05);
    const seg2 = cyl(0.14, 0.17, 2.0, 10, M.white, 0, -0.95, -2.95); seg2.rotation.x = Math.PI / 2 - 0.45;
    const band = cyl(0.19, 0.19, 0.12, 10, acc, 0, -0.75, -2.5); band.rotation.x = Math.PI / 2 - 0.45;
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.2, 0.45, 14, 1, true), M.dark); mouth.position.set(0, -1.38, -3.9); mouth.rotation.x = -0.45;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 6, 20), STRIP); ring.position.set(0, -1.48, -4.02); ring.rotation.x = Math.PI / 2 - 0.45;
    boom.add(seg1, joint, seg2, band, mouth, ring);
    g.add(turret, sensor, spin, boom);
    anim.update = (dt, t, on) => { boom.rotation.y = Math.sin(t * 0.5) * 0.22; spin.rotation.z += dt * (on ? 1.5 : 0.2); };
  } else if (type === 'sorter') {
    g.add(hullBlock(2.4, 0.8, 1.6, type));
    // glass separation drum with rotating energy rings
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.9, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.32, metalness: 0.2, roughness: 0.05, side: THREE.DoubleSide }));
    drum.rotation.z = Math.PI / 2; drum.position.y = 1.5;
    const caps = new THREE.Group();
    for (const x of [-1.0, 1.0]) { const c = cyl(0.7, 0.7, 0.14, 20, M.white, x, 1.5, 0); c.rotation.z = Math.PI / 2; caps.add(c); }
    const ribs = new THREE.Group();
    for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 6, 20), k % 2 ? STRIP : acc); r.rotation.y = Math.PI / 2; r.position.x = -0.6 + k * 0.4; ribs.add(r); }
    ribs.position.y = 1.5;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 8), M.dark); core.rotation.z = Math.PI / 2; core.position.y = 1.5;
    const port = box(0.5, 0.4, 0.9, M.white, 1.35, 0.7, 0);
    const portGlow = box(0.02, 0.24, 0.6, STRIP, 1.61, 0.7, 0);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M.hot); lamp.position.set(-1.0, 0.95, 0.7);
    g.add(drum, caps, ribs, core, port, portGlow, lamp);
    anim.update = (dt, t, on) => { ribs.rotation.x += dt * (on ? 2.5 : 0); };
  } else if (type === 'silo') {
    // pressurised cargo tank on landing struts
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 2.2, 8, 20), M.white); tank.position.y = 2.15;
    const bands = new THREE.Group(); bands.userData.static = true;
    for (const y of [1.25, 2.15, 3.05]) bands.add(cyl(0.97, 0.97, 0.12, 24, y === 2.15 ? acc : M.grey, 0, y, 0));
    const legs = new THREE.Group(); legs.userData.static = true;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.78;
      const l = cyl(0.06, 0.08, 1.1, 6, M.grey, Math.cos(a) * 0.85, 0.5, Math.sin(a) * 0.85); l.rotation.z = Math.cos(a) * 0.25; l.rotation.x = -Math.sin(a) * 0.25;
      const foot = cyl(0.18, 0.2, 0.06, 10, M.dark, Math.cos(a) * 0.98, 0.03, Math.sin(a) * 0.98);
      legs.add(l, foot);
    }
    const valve = cyl(0.12, 0.12, 0.3, 10, M.dark, 0, 4.2, 0);
    const gauge = box(0.2, 2.6, 0.05, M.dark, 0, 2.15, 0.97);
    const fill = box(0.14, 1, 0.06, STRIP, 0, 0.85, 0.99);
    g.add(tank, bands, legs, valve, gauge, fill);
    anim.update = (dt, t, on, fillLevel) => { const f = Math.max(0.02, fillLevel || 0); fill.scale.y = f * 2.5; fill.position.y = 0.85 + (f * 2.5) / 2; };
  } else if (type === 'reactor') {
    const base = cyl(1.3, 1.5, 0.6, 8, M.dark, 0, 0.3, 0);
    const deck = cyl(1.25, 1.3, 0.1, 8, acc, 0, 0.62, 0);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), new THREE.MeshStandardMaterial({ color: 0x7cff9a, emissive: 0x3aff7a, emissiveIntensity: 1.6, roughness: 0.2 }));
    core.position.y = 1.55;
    const cage = new THREE.Group(); cage.position.y = 1.55;
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.05, 8, 32), k === 1 ? STRIP : M.white); r.rotation.set(Math.PI / 2 + k * 1.05, k * 0.6, 0); cage.add(r); }
    const pylons = new THREE.Group(); pylons.userData.static = true;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      pylons.add(box(0.22, 2.6, 0.22, M.white, Math.cos(a) * 1.25, 1.3, Math.sin(a) * 1.25));
      pylons.add(box(0.04, 1.6, 0.04, STRIP, Math.cos(a) * 1.13, 1.4, Math.sin(a) * 1.13));
      const fin = radiator(0.9, finMat); fin.position.set(Math.cos(a + 0.78) * 1.6, 0.9, Math.sin(a + 0.78) * 1.6); fin.rotation.y = -(a + 0.78);
      pylons.add(fin);
    }
    const cap = cyl(1.35, 1.35, 0.12, 8, M.white, 0, 2.65, 0);
    g.add(base, deck, core, cage, pylons, cap);
    anim.update = (dt) => { cage.rotation.y += dt * 0.5; cage.rotation.x += dt * 0.2; };
  } else if (type === 'lab') {
    g.add(hullBlock(2.2, 1.5, 1.8, type));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.4, metalness: 0.2, roughness: 0.05 }));
    dome.position.y = 1.5;
    const domeRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.05, 6, 28), M.white); domeRing.rotation.x = Math.PI / 2; domeRing.position.y = 1.5;
    const probe = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), M.hot); probe.position.y = 1.9;
    const mast = cyl(0.03, 0.04, 1.2, 6, M.grey, 0.8, 2.1, -0.6);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: 0xeef1f5, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.3 }));
    dish.position.set(0.8, 2.7, -0.6); dish.rotation.x = -0.6;
    // small solar wings
    const wing = new THREE.MeshStandardMaterial({ color: 0x1d3c78, metalness: 0.6, roughness: 0.25, emissive: 0x0a1a3a, emissiveIntensity: 0.5 });
    const w1 = box(0.9, 0.03, 0.6, wing, -1.65, 1.2, 0), w2 = box(0.9, 0.03, 0.6, wing, 1.65, 1.2, 0.4);
    g.add(dome, domeRing, probe, mast, dish, w1, w2);
    anim.update = (dt, t, on) => { probe.rotation.y += dt * (on ? 1.2 : 0.3); probe.position.y = 1.9 + Math.sin(t * 1.2) * 0.06; dish.rotation.z += dt * 0.3; };
  } else if (type === 'fab') {
    g.add(hullBlock(2.4, 1.8, 2, type));
    // heat radiators instead of a chimney
    const rad = radiator(1.4, finMat); rad.position.set(0.75, 2.15, -0.2);
    const radGlow = box(0.4, 0.03, 1.4, STRIP, 0.75, 1.88, -0.2);
    // print bay window
    const bay = box(1.3, 0.6, 0.04, new THREE.MeshStandardMaterial({ color: 0x0e1622, emissive: 0x1a3a55, emissiveIntensity: 0.8, roughness: 0.2 }), -0.3, 1.0, 1.01);
    // robot arm with tool head
    const arm = new THREE.Group(); arm.position.set(-0.6, 1.8, 0.4);
    const base = cyl(0.18, 0.22, 0.14, 12, M.dark, 0, 0.07, 0);
    const a1 = box(0.12, 0.7, 0.12, M.white, 0, 0.45, 0);
    const j = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), acc); j.position.y = 0.82;
    const a2 = box(0.7, 0.1, 0.1, M.white, 0.32, 0.82, 0);
    const head = cyl(0.06, 0.1, 0.18, 8, M.dark, 0.66, 0.72, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), STRIP); tip.position.set(0.66, 0.61, 0);
    arm.add(base, a1, j, a2, head, tip);
    g.add(rad, radGlow, bay, arm);
    anim.update = (dt, t, on) => { arm.rotation.y = on ? Math.sin(t * 1.2) * 1.0 : 0; };
  } else if (type === 'hangar') {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 20, 1, false, 0, Math.PI), M.white); shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; shell.position.y = 0.05;
    const door = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20, 0, Math.PI), M.dark); door.position.set(0, 0.05, 1.31);
    const doorRim = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.04, 6, 24, Math.PI), STRIP); doorRim.position.set(0, 0.05, 1.32);
    const ribs = new THREE.Group();
    for (const z of [-0.8, 0, 0.8]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 6, 20, Math.PI), z === 0 ? acc : M.grey); r.position.z = z; ribs.add(r); }
    ribs.position.y = 0.05;
    const pad = cyl(0.6, 0.6, 0.05, 16, M.dark, 0, 1.45, 0);
    const padRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 4, 20), STRIP); padRing.rotation.x = Math.PI / 2; padRing.position.y = 1.48;
    // little drone: body + four glowing rotors
    const mini = new THREE.Group();
    mini.add(box(0.3, 0.1, 0.3, M.white, 0, 0, 0));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; const r = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 4, 12), STRIP); r.rotation.x = Math.PI / 2; r.position.set(Math.cos(a) * 0.24, 0.02, Math.sin(a) * 0.24); mini.add(r); }
    mini.position.y = 1.65;
    g.add(shell, door, doorRim, ribs, pad, padRing, mini);
    anim.update = (dt, t, on) => { mini.position.y = 1.65 + (on ? (1 - Math.cos(t * 0.9)) * 0.4 : 0); mini.rotation.y += dt * 0.8; };
  } else if (type === 'beacon') {
    const foot = cyl(0.5, 0.6, 0.3, 8, M.dark, 0, 0.15, 0);
    const mast = cyl(0.1, 0.22, 3.8, 10, M.white, 0, 2.1, 0);
    const bands = new THREE.Group();
    for (const y of [1.2, 2.4]) bands.add(cyl(0.2, 0.2, 0.1, 10, acc, 0, y, 0));
    const strip = box(0.03, 2.8, 0.03, STRIP, 0, 2.0, 0.17);
    const head = new THREE.Group(); head.position.y = 4.1;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0xeef1f5, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.3 }));
    dish.rotation.x = -0.9;
    const feed = cyl(0.02, 0.02, 0.7, 6, M.grey, 0, 0.25, 0.25); feed.rotation.x = -0.9;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), STRIP); orb.position.set(0, 0.5, 0.5);
    head.add(dish, feed, orb);
    g.add(foot, mast, bands, strip, head);
    anim.update = (dt, t, on) => { head.rotation.y += dt * (on ? 0.5 : 0.1); };
  }
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh && !(o.material && o.material.transparent) && o.material !== STRIP) o.castShadow = true; });
  const statics = []; g.traverse((o) => { if (o.userData.static) statics.push(o); });
  statics.forEach(mergeStatic);
  g.userData.anim = anim;
  return g;
}

export class BaseView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sites = [];
    // site pads
    for (let i = 0; i < SITE_ANGLES.length; i++) {
      const p = sitePos(i);
      const site = new THREE.Group();
      site.position.copy(p);
      site.rotation.y = Math.atan2(-p.x, -p.z);          // local +z faces the heap
      site.rotation.y += Math.PI;                         // so local -z faces the heap
      const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 0.12, 6), M.pad);
      padMesh.position.y = 0.06; padMesh.receiveShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.04, 4, 6), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.14;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.1, 0.1, 6, 1, true), M.white);
      rim.position.y = 0.05;
      // landing-pad marker lights at the corners instead of hazard stripes
      const dots = new THREE.Group();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const d = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 8), STRIP); d.position.set(Math.cos(a) * 1.7, 0.135, Math.sin(a) * 1.7); dots.add(d); }
      site.add(padMesh, ring, rim, dots);
      mergeStatic(dots);
      this.group.add(site);
      this.sites.push({ site, ring, building: null, key: '' });
    }
    // conveyor ring around the heap
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const g2 = c.getContext('2d'); g2.fillStyle = '#262a31'; g2.fillRect(0, 0, 64, 16);
    g2.fillStyle = '#353b45'; for (let x = 0; x < 64; x += 16) g2.fillRect(x, 3, 1, 10);
    g2.fillStyle = '#9fe8ff'; g2.fillRect(0, 7, 64, 2);
    g2.fillStyle = '#d9dee6'; g2.fillRect(0, 0, 64, 2); g2.fillRect(0, 14, 64, 2);
    this.beltTex = new THREE.CanvasTexture(c);
    this.beltTex.wrapS = this.beltTex.wrapT = THREE.RepeatWrapping;
    this.beltTex.repeat.set(60, 1);
    const belt = new THREE.Mesh(new THREE.RingGeometry(17.6, 18.4, 128, 1), new THREE.MeshStandardMaterial({ map: this.beltTex, metalness: 0.4, roughness: 0.6 }));
    belt.rotation.x = -Math.PI / 2; belt.position.y = 0.05;
    // RingGeometry UVs are planar; rebuild them to run along the ring
    const uv = belt.geometry.attributes.uv, pos = belt.geometry.attributes.position;
    for (let k = 0; k < uv.count; k++) {
      const x = pos.getX(k), y = pos.getY(k);
      const r = Math.hypot(x, y);
      uv.setXY(k, (k % 129) / 128, (r - 17.6) / 0.8);   // index-based u: no seam where the ring closes
    }
    belt.receiveShadow = true;
    belt.visible = false;
    this.belt = belt;
    this.group.add(belt);
    // items travelling on the belt
    this.items = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.11, 0.22, 4, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.4, metalness: 0.4 }), 48);
    this.items.visible = false;
    this.group.add(this.items);
    this.tmp = new THREE.Matrix4();
    this.flow = 0;
  }

  sync(S) {
    const unlocked = S.sitesUnlocked || 3;
    let any = false;
    for (let i = 0; i < this.sites.length; i++) {
      const s = this.sites[i];
      const b = S.sites ? S.sites[i] : null;
      s.site.visible = i < unlocked || !!b;
      s.ring.material.color.setHex(b ? 0x2fc9a8 : i < unlocked ? 0x6ff3f0 : 0x555a66);
      const key = b ? `${b.type}:${b.lvl}` : '';
      if (key !== s.key) {
        if (s.building) s.site.remove(s.building);
        s.building = b ? model(b.type, b.lvl) : null;
        if (s.building) s.site.add(s.building);
        s.key = key;
      }
      if (b) any = true;
    }
    this.belt.visible = any;
    this.items.visible = any;
  }

  update(dt, t, flowRate, eff, fill) {
    for (const s of this.sites) {
      if (!s.building) continue;
      const a = s.building.userData.anim;
      if (a.update) a.update(dt, t, eff > 0.05 && flowRate > 0, fill);
    }
    if (!this.belt.visible) return;
    const speed = flowRate > 0 ? 0.04 + Math.min(0.12, flowRate / 4000) : 0;
    this.beltTex.offset.x -= dt * speed;
    this.flow = (this.flow + dt * speed) % 1;
    for (let k = 0; k < 48; k++) {
      const a = ((k / 48) + this.flow) * Math.PI * 2;
      const show = flowRate > 0 && (k % (flowRate > 500 ? 1 : flowRate > 100 ? 2 : 4) === 0);
      this.tmp.makeRotationY(-a - Math.PI / 2).setPosition(Math.cos(a) * 18, show ? 0.3 : -5, Math.sin(a) * 18);
      this.items.setMatrixAt(k, this.tmp);
    }
    this.items.instanceMatrix.needsUpdate = true;
  }
}
