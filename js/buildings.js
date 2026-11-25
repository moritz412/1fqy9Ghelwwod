// Base building: build sites around the heap, production chain (extract -> buffer -> sort), power grid.
import * as THREE from 'three';

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
  white: new THREE.MeshStandardMaterial({ color: 0xeef1f5, metalness: 0.25, roughness: 0.4 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x7a808a, metalness: 0.6, roughness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.6, roughness: 0.35 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xffb347, metalness: 0.3, roughness: 0.45 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x2fc9a8, metalness: 0.3, roughness: 0.45 }),
  glow: new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }),
  hot: new THREE.MeshBasicMaterial({ color: 0x7cff9a }),
  pad: new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.5, roughness: 0.5 }),
};

function model(type, lvl) {
  const g = new THREE.Group();
  const anim = {};
  const s = 0.85 + lvl * 0.08;
  if (type === 'extractor') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), M.white); body.position.y = 0.7;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.6, 12), M.orange); top.position.y = 1.7;
    // boom reaching towards the heap (local -z faces the heap)
    const boom = new THREE.Group(); boom.position.set(0, 1.8, -0.6);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.2, 10), M.grey); pipe.rotation.x = Math.PI / 2 - 0.35; pipe.position.set(0, -0.6, -1.9);
    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.2, 0.5, 12, 1, true), M.dark); mouth.position.set(0, -1.35, -3.9); mouth.rotation.x = -0.35;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 6, 18), M.glow); ring.position.set(0, -1.45, -4.05); ring.rotation.x = Math.PI / 2 - 0.35;
    boom.add(pipe, mouth, ring);
    g.add(body, top, boom);
    anim.update = (dt, t, on) => { boom.rotation.y = Math.sin(t * 0.6) * 0.25; ring.visible = on; top.rotation.y += dt * (on ? 3 : 0.3); };
  } else if (type === 'sorter') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.6), M.white); base.position.y = 0.4;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.0, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a909a, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide, wireframe: false }));
    drum.rotation.z = Math.PI / 2; drum.position.y = 1.5;
    const ribs = new THREE.Group();
    for (let k = 0; k < 5; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.05, 6, 20), M.orange); r.rotation.y = Math.PI / 2; r.position.x = -0.8 + k * 0.4; ribs.add(r); }
    ribs.position.y = 1.5;
    const chute = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 1.2), M.grey); chute.position.set(1.4, 0.9, 0); chute.rotation.z = -0.5;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), M.hot); lamp.position.set(-1.1, 1.0, 0.8);
    g.add(base, drum, ribs, chute, lamp);
    anim.update = (dt, t, on) => { drum.rotation.x += dt * (on ? 4 : 0); ribs.rotation.x += dt * (on ? 4 : 0); lamp.visible = on ? Math.sin(t * 6) > -0.3 : false; };
  } else if (type === 'silo') {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.2, 20), M.white); tank.position.y = 1.9;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 0.6, 20), M.white); cone.position.y = 3.8;
    const legs = new THREE.Group();
    for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), M.grey); const a = k * Math.PI / 2 + 0.78; l.position.set(Math.cos(a) * 0.8, 0.4, Math.sin(a) * 0.8); legs.add(l); }
    const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.05), M.dark); gauge.position.set(0, 1.9, 1.02);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.06), M.glow); fill.position.set(0, 0.45, 1.04);
    g.add(tank, cone, legs, gauge, fill);
    anim.update = (dt, t, on, fillLevel) => { const f = Math.max(0.02, fillLevel || 0); fill.scale.y = f * 2.9; fill.position.y = 0.45 + (f * 2.9) / 2; };
  } else if (type === 'reactor') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.6, 8), M.dark); base.position.y = 0.3;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 20, 14), new THREE.MeshStandardMaterial({ color: 0x7cff9a, emissive: 0x3aff7a, emissiveIntensity: 2, roughness: 0.2 }));
    core.position.y = 1.5;
    const cage = new THREE.Group(); cage.position.y = 1.5;
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 32), M.grey); r.rotation.set(Math.PI / 2 + k * 1.05, k * 0.6, 0); cage.add(r); }
    const pylons = new THREE.Group();
    for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), M.white); const a = k * Math.PI / 2; p.position.set(Math.cos(a) * 1.25, 1.3, Math.sin(a) * 1.25); pylons.add(p); }
    g.add(base, core, cage, pylons);
    anim.update = (dt, t) => { cage.rotation.y += dt * 0.8; cage.rotation.x += dt * 0.3; core.scale.setScalar(1 + Math.sin(t * 3) * 0.06); };
  } else if (type === 'lab') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 1.8), M.white); body.position.y = 0.75;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9ff3ff, transparent: true, opacity: 0.45, metalness: 0.2, roughness: 0.05 }));
    dome.position.y = 1.5;
    const probe = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), M.hot); probe.position.y = 1.9;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), M.grey); ant.position.set(0.8, 2.1, -0.6);
    g.add(body, dome, probe, ant);
    anim.update = (dt, t, on) => { probe.rotation.y += dt * (on ? 2 : 0.3); probe.position.y = 1.9 + Math.sin(t * 2) * 0.08; };
  } else if (type === 'fab') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2), M.white); body.position.y = 0.9;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.2), M.orange); roof.position.y = 1.9;
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 10), M.grey); chimney.position.set(0.7, 2.5, -0.5);
    const arm = new THREE.Group(); arm.position.set(-0.6, 2.0, 0.4);
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), M.teal); a1.position.y = 0.4;
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.1), M.teal); a2.position.set(0.3, 0.8, 0);
    arm.add(a1, a2);
    g.add(body, roof, chimney, arm);
    anim.update = (dt, t, on) => { arm.rotation.y = on ? Math.sin(t * 2) * 1.2 : 0; };
  } else if (type === 'hangar') {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 16, 1, false, 0, Math.PI), M.white); shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; shell.position.y = 0.05;
    const door = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16, 0, Math.PI), M.dark); door.position.set(0, 0.05, 1.31);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 16), M.glow); pad.position.set(0, 1.45, 0);
    const mini = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), M.orange); mini.position.set(0, 1.7, 0);
    g.add(shell, door, pad, mini);
    anim.update = (dt, t, on) => { mini.position.y = 1.7 + (on ? Math.abs(Math.sin(t * 1.2)) * 0.8 : 0); mini.rotation.y += dt * 2; };
  } else if (type === 'beacon') {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 4, 8), M.white); mast.position.y = 2;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0xffb347, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.3 }));
    dish.position.y = 4.1; dish.rotation.x = -0.9;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), M.glow); orb.position.y = 4.4;
    g.add(mast, dish, orb);
    anim.update = (dt, t, on) => { dish.rotation.z += dt * (on ? 1.2 : 0.2); orb.visible = Math.sin(t * 4) > 0; };
  }
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh && !(o.material && o.material.transparent)) o.castShadow = true; });
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
      site.add(padMesh, ring);
      this.group.add(site);
      this.sites.push({ site, ring, building: null, key: '' });
    }
    // conveyor ring around the heap
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const g2 = c.getContext('2d'); g2.fillStyle = '#2c2f35'; g2.fillRect(0, 0, 64, 16);
    g2.fillStyle = '#4a505c'; for (let x = 0; x < 64; x += 8) g2.fillRect(x, 0, 3, 16);
    g2.fillStyle = '#ffb347'; g2.fillRect(0, 0, 64, 2); g2.fillRect(0, 14, 64, 2);
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
      uv.setXY(k, (Math.atan2(y, x) / (Math.PI * 2) + 0.5), (r - 17.6) / 0.8);
    }
    belt.receiveShadow = true;
    belt.visible = false;
    this.belt = belt;
    this.group.add(belt);
    // items travelling on the belt
    this.items = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 0.7, metalness: 0.3 }), 48);
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
      this.tmp.makeRotationY(-a + k).setPosition(Math.cos(a) * 18, show ? 0.15 : -5, Math.sin(a) * 18);
      this.items.setMatrixAt(k, this.tmp);
    }
    this.items.instanceMatrix.needsUpdate = true;
  }
}
