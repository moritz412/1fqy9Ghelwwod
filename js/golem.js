// The Scrap Golem: a big, slow, friendly-looking heap of scrap that Nexus dismantles piece by piece.
import * as THREE from 'three';
import { texMat } from './textures.js';

export class Golem {
  constructor(scene) {
    this.scene = scene;
    this.g = null;
    this.active = false;
    this.falling = null;
    this.name = 'Schrottgolem';
  }

  get exposed() { return this.active && this.falling === null; }
  get reach() { return 4.5; }

  spawn(pile, hp) {
    this.remove();
    const g = new THREE.Group();
    const BO = { metalness: 0.35, roughness: 0.55, emissive: 0x1a1c20 };   // bosses: less metallic so the shadow side doesn't turn black
    const mats = [texMat('metal', 0x9aa0a8, BO), texMat('metal', 0xb0703f, BO), texMat('hull', 0xd6dade, BO), texMat('metal', 0x6e747c, BO)];
    const chunks = [];
    const box = (w, h, d, x, y, z, m, parent = g) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[m % mats.length]);
      b.position.set(x, y, z);
      b.rotation.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
      b.castShadow = true;
      parent.add(b);
      chunks.push(b);
      return b;
    };
    // legs
    this.legs = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sx * 0.7, 1.6, 0);
      box(0.8, 0.9, 0.8, 0, -0.4, 0, 0, leg); box(0.7, 0.8, 0.7, 0, -1.2, 0.1, 3, leg);
      g.add(leg); this.legs.push(leg);
    }
    // torso made of stacked scrap: crates, barrels, tyres and gears
    const tyreM = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.9 });
    const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
      const b = new THREE.Mesh(geo, mat); b.position.set(x, y, z); b.rotation.set(rx + (Math.random() - 0.5) * 0.3, Math.random() * 6, rz + (Math.random() - 0.5) * 0.3);
      b.castShadow = true; g.add(b); chunks.push(b); return b;
    };
    for (let k = 0; k < 9; k++) {
      const x = (Math.random() - 0.5) * 1.2, y = 2.0 + Math.floor(k / 3) * 0.55, z = (Math.random() - 0.5) * 0.6;
      const r = k % 4;
      if (r === 0) box(0.6 + Math.random() * 0.8, 0.5 + Math.random() * 0.4, 0.6 + Math.random() * 0.6, x, y, z, k);
      else if (r === 1) add(new THREE.CylinderGeometry(0.32, 0.32, 0.75, 12), mats[k % 2 ? 1 : 0], x, y, z, 0, Math.PI / 2);
      else if (r === 2) add(new THREE.TorusGeometry(0.34, 0.14, 8, 16), tyreM, x, y, z + 0.25, 0.2);
      else add(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 10), mats[3], x, y, z + 0.3, Math.PI / 2);
    }
    // glowing reactor core in the chest (steady, no flicker)
    const coreM = new THREE.MeshStandardMaterial({ color: 0x331a05, emissive: 0xff9a3a, emissiveIntensity: 1.4, roughness: 0.4 });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), coreM); core.position.set(0, 2.55, 0.42); g.add(core);
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 6, 14), mats[3]); cage.position.copy(core.position); cage.position.z += 0.05; g.add(cage);
    this.core = core;
    // head with glowing eyes
    const head = new THREE.Group(); head.position.set(0, 3.9, 0.05);
    box(1.1, 0.8, 0.9, 0, 0, 0, 2, head);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), eyeM); e.position.set(sx * 0.25, 0.05, 0.46); head.add(e); }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), mats[3]); ant.position.set(0.3, 0.6, 0); ant.rotation.z = -0.3; head.add(ant);
    g.add(head); this.head = head;
    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sx * 1.2, 3.1, 0);
      box(0.5, 0.9, 0.5, 0, -0.4, 0, 1, arm); box(0.45, 0.8, 0.45, 0, -1.2, 0.1, 0, arm); box(0.6, 0.5, 0.6, 0, -1.8, 0.15, 3, arm);
      g.add(arm); this.arms.push(arm);
    }
    this.chunks = chunks.sort(() => Math.random() - 0.5);
    this.maxHp = hp; this.hp = hp;
    this.g = g;
    this.t = 0; this.rise = 0;
    this.tx = 0; this.tz = 0;
    this.pos = new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
    this.falling = null;
    g.scale.setScalar(1.15);
    this.scene.add(g);
    this.active = true;
    this.update(0, 0, pile);
  }

  hit(dust) {
    if (!this.active || this.falling !== null) return false;
    this.hp--;
    this.flinch = 0.25;
    // knock loose a chunk proportional to damage
    const shouldRemain = Math.ceil((this.hp / this.maxHp) * this.chunks.length);
    while (this.chunks.filter((c) => c.visible).length > Math.max(3, shouldRemain)) {
      const c = this.chunks.find((x) => x.visible);
      if (!c) break;
      c.visible = false;
      if (dust) { const p = c.getWorldPosition(new THREE.Vector3()); dust(p); }
    }
    if (this.hp <= 0) { this.falling = 0; return true; }
    return false;
  }

  update(dt, t, pile) {
    if (!this.g) return;
    this.t += dt;
    const g = this.g;
    if (this.falling !== null) {
      this.falling += dt;
      g.rotation.x = Math.min(1.4, this.falling * 1.2);
      g.position.y -= dt * 1.5;
      g.scale.setScalar(Math.max(0.01, 1.15 * (1 - this.falling / 2)));
      if (this.falling > 2) this.remove();
      return;
    }
    // rise out of the heap
    this.rise = Math.min(1, this.rise + dt * 0.4);
    // slow wandering on the heap
    const p = this.pos;
    if (Math.hypot(this.tx - p.x, this.tz - p.z) < 0.5) { this.tx = (Math.random() - 0.5) * 18; this.tz = (Math.random() - 0.5) * 18; }
    const dx = this.tx - p.x, dz = this.tz - p.z, d = Math.hypot(dx, dz) || 1;
    const sp = this.rise < 1 ? 0 : 0.6;
    p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt;
    const ground = Math.max(0, pile.heightAt(p.x, p.z));
    g.position.set(p.x, ground - (1 - this.rise) * 5, p.z);
    g.rotation.y += (Math.atan2(dx, dz) - g.rotation.y) * Math.min(1, dt * 1.5);
    const walk = sp > 0 ? Math.sin(t * 2.4) : 0;
    this.legs[0].rotation.x = walk * 0.4; this.legs[1].rotation.x = -walk * 0.4;
    this.arms[0].rotation.x = -walk * 0.3 + Math.sin(t * 0.7) * 0.1; this.arms[1].rotation.x = walk * 0.3 - Math.sin(t * 0.7) * 0.1;
    this.head.rotation.y = Math.sin(t * 0.5) * 0.4;
    if (this.core) this.core.rotation.y += dt * 0.6;
    if (this.flinch > 0) { this.flinch -= dt; g.position.x += Math.sin(t * 60) * 0.05; }
  }

  get position() { return this.g ? this.g.position : null; }

  remove() {
    if (this.g) this.scene.remove(this.g);
    this.g = null;
    this.active = false;
    this.falling = null;
  }
}

// The Scrap Worm: a long chain of scrap rings that arcs in and out of the heap.
// It can only be hit while its head is above the surface.
export class Worm {
  constructor(scene) {
    this.scene = scene;
    this.g = null;
    this.active = false;
    this.falling = null;
    this.name = 'Schrottwurm';
  }

  spawn(pile, hp) {
    this.remove();
    const g = new THREE.Group();
    const ring = texMat('metal', 0x9a7a5a, { roughness: 0.5, metalness: 0.4, emissive: 0x16140f });
    const ring2 = texMat('metal', 0x6d737c, { roughness: 0.55, metalness: 0.4, emissive: 0x121418 });
    const plate = texMat('hull', 0xd7dade);
    this.segs = [];
    const N = 14;
    for (let k = 0; k < N; k++) {
      const s = new THREE.Group();
      const r = 0.62 - (k / N) * 0.3;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.55, 12), k % 2 ? ring : ring2);
      body.rotation.x = Math.PI / 2; body.castShadow = true; s.add(body);
      const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.06, 6, 16), ring2);
      s.add(band);
      if (k % 3 === 1) for (const sx of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.35), plate); fin.position.set(sx * r, r * 0.6, 0); fin.rotation.z = sx * 0.5; s.add(fin); }
      g.add(s); this.segs.push(s);
    }
    // head
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), plate);
    skull.scale.set(1, 0.85, 1.2); skull.castShadow = true; head.add(skull);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), eyeM); e.position.set(sx * 0.32, 0.22, 0.72); head.add(e);
      const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 6), ring2); jaw.position.set(sx * 0.3, -0.25, 0.85); jaw.rotation.x = Math.PI / 2; jaw.rotation.z = sx * 0.3; head.add(jaw);
    }
    g.add(head); this.head = head;
    this.trail = [];
    this.maxHp = hp; this.hp = hp;
    this.alive = N;
    this.g = g;
    this.t = 0; this.rise = 0;
    this.ang = Math.random() * Math.PI * 2; this.rad = 6 + Math.random() * 4;
    this.falling = null;
    this.flinch = 0;
    this.headPos = new THREE.Vector3();
    this.scene.add(g);
    this.active = true;
    this.update(0, 0, pile);
  }

  // head above the heap? only then the worm can be grabbed
  get exposed() { return this.active && this.falling === null && this.above > -0.1; }
  get reach() { return 3.2; }

  hit(dust) {
    if (!this.exposed) return false;
    this.hp--;
    this.flinch = 0.3;
    const shouldRemain = Math.max(2, Math.ceil((this.hp / this.maxHp) * this.segs.length));
    while (this.alive > shouldRemain) {
      const s = this.segs[this.alive - 1];
      s.visible = false; this.alive--;
      if (dust) dust(s.getWorldPosition(new THREE.Vector3()));
    }
    if (this.hp <= 0) { this.falling = 0; return true; }
    return false;
  }

  update(dt, t, pile) {
    if (!this.g) return;
    this.t += dt;
    if (this.falling !== null) {
      this.falling += dt;
      this.segs.forEach((s, k) => { s.position.y -= dt * (1 + k * 0.2); s.rotation.z += dt * (k % 2 ? 2 : -2); });
      this.head.position.y += dt * (2 - this.falling * 4);
      this.head.rotation.x += dt * 3;
      if (this.falling > 1.8) this.remove();
      return;
    }
    this.rise = Math.min(1, this.rise + dt * 0.5);
    const sp = this.flinch > 0 ? 0.25 : 0.32;
    this.ang += dt * sp;
    this.rad = 7 + Math.sin(this.t * 0.13) * 3.5;
    const x = Math.cos(this.ang) * this.rad, z = Math.sin(this.ang) * this.rad;
    const ground = Math.max(0, pile.heightAt(x, z));
    // arcs: long time above the surface, short dives
    const wave = Math.sin(this.t * 0.55);
    this.above = (wave + 0.35) * 1.8 * this.rise - (1 - this.rise) * 3;
    const y = ground + this.above;
    this.headPos.set(x, y, z);
    this.trail.unshift(this.headPos.clone());
    if (this.trail.length > 400) this.trail.pop();
    this.head.position.copy(this.headPos);
    const dx = -Math.sin(this.ang), dz = Math.cos(this.ang);
    this.head.rotation.set(-Math.cos(this.t * 0.55) * 0.5, Math.atan2(dx, dz), 0);
    if (this.flinch > 0) { this.flinch -= dt; this.head.position.x += Math.sin(t * 60) * 0.06; }
    // body follows the head along its trail, spaced by distance
    let idx = 0, acc = 0;
    for (let k = 0; k < this.segs.length; k++) {
      const want = 0.62 * (k + 1);
      while (idx < this.trail.length - 1 && acc < want) { acc += this.trail[idx].distanceTo(this.trail[idx + 1]); idx++; }
      const p = this.trail[Math.min(idx, this.trail.length - 1)];
      const s = this.segs[k];
      s.position.copy(p);
      const q = this.trail[Math.max(0, idx - 2)];
      s.lookAt(q);
      // segments below the surface are hidden by the heap itself; hide deep ones to avoid poking through the deck
      s.visible = k < this.alive && p.y > -0.6;
    }
  }

  get position() { return this.g ? this.headPos : null; }

  remove() {
    if (this.g) this.scene.remove(this.g);
    this.g = null;
    this.active = false;
    this.falling = null;
  }
}

// The Scrap Kraken: sits on top of the heap with six tentacles made of scrap links.
// Every grab knocks the tip off the nearest tentacle; once all are gone the head can be taken apart.
export class Kraken {
  constructor(scene) {
    this.scene = scene;
    this.g = null;
    this.active = false;
    this.falling = null;
    this.name = 'Schrott-Krake';
  }

  spawn(pile, hp) {
    this.remove();
    const g = new THREE.Group();
    const shell = texMat('hull', 0xc9ccd2);
    const link = texMat('metal', 0x8a6a52, { roughness: 0.5, metalness: 0.4, emissive: 0x16110c });
    const link2 = texMat('metal', 0x5f656e, { roughness: 0.55, metalness: 0.4, emissive: 0x111317 });
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    // head: dome with plates and a big eye
    const head = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), shell);
    dome.scale.y = 1.25; dome.castShadow = true; head.add(dome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.12, 8, 24), link2); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; head.add(ring);
    for (let k = 0; k < 8; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.7), link2); const a = (k / 8) * Math.PI * 2; pl.position.set(Math.cos(a) * 0.75, 1.35, Math.sin(a) * 0.75); pl.rotation.set(0, -a, 0.55); head.add(pl); }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), eyeM); eye.position.set(0, 0.95, 1.0); head.add(eye);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 16), link2); lid.position.copy(eye.position); lid.position.z += 0.02; head.add(lid);
    g.add(head); this.head = head;
    // tentacles
    this.tents = [];
    const T = 6, L = 7;
    for (let k = 0; k < T; k++) {
      const a = (k / T) * Math.PI * 2 + 0.3;
      const root = new THREE.Group(); root.position.set(Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1); root.rotation.y = -a + Math.PI / 2;
      g.add(root);
      const segs = []; let parent = root;
      for (let s = 0; s < L; s++) {
        const r = 0.34 - s * 0.035;
        const seg = new THREE.Group(); seg.position.z = s === 0 ? 0 : 0.62;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.62, 10), s % 2 ? link : link2);
        m.rotation.x = Math.PI / 2; m.position.z = 0.31; m.castShadow = true; seg.add(m);
        const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 0.04, 5, 12), link2); band.position.z = 0.05; seg.add(band);
        parent.add(seg); segs.push(seg); parent = seg;
      }
      this.tents.push({ root, segs, alive: L, a, ph: Math.random() * 6 });
    }
    this.segTotal = T * L;
    this.headHp = Math.max(6, Math.round(hp / 4));
    this.maxHp = this.segTotal + this.headHp; this.hp = this.maxHp;
    this.g = g;
    this.t = 0; this.rise = 0;
    this.falling = null; this.flinch = 0;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.scene.add(g);
    this.active = true;
    this.update(0, 0, pile);
  }

  get exposed() { return this.active && this.falling === null && this.rise >= 1; }
  get reach() { return this.armsLeft ? 2.6 : 4.2; }
  get armsLeft() { return this.tents.reduce((n, t) => n + t.alive, 0); }

  // world position of the closest thing to grab (a tentacle tip, or the head once all are gone)
  targetNear(x, z) {
    if (!this.g) return null;
    if (this.armsLeft === 0) return this.g.position;
    let best = null, bd = 1e9;
    const v = new THREE.Vector3();
    for (const t of this.tents) {
      if (!t.alive) continue;
      for (let s = 0; s < t.alive; s++) {
        t.segs[s].getWorldPosition(v);
        const d = Math.hypot(v.x - x, v.z - z);
        if (d < bd) { bd = d; best = t; }
      }
    }
    if (!best) return this.g.position;
    this._near = best;
    return best.segs[best.alive - 1].getWorldPosition(new THREE.Vector3());
  }

  hit(dust) {
    if (!this.exposed) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.flinch = 0.3;
    if (this.armsLeft > 0) {
      const t = this._near && this._near.alive ? this._near : this.tents.find((q) => q.alive);
      const seg = t.segs[t.alive - 1];
      if (dust) dust(seg.getWorldPosition(new THREE.Vector3()));
      seg.visible = false; t.alive--;
      return false;
    }
    if (dust) dust(this.head.getWorldPosition(new THREE.Vector3()));
    this.head.scale.setScalar(0.55 + 0.45 * this.hp / this.headHp);
    if (this.hp <= 0) { this.falling = 0; return true; }
    return false;
  }

  update(dt, t, pile) {
    if (!this.g) return;
    this.t += dt;
    const g = this.g;
    if (this.falling !== null) {
      this.falling += dt;
      g.position.y -= dt * 2.5;
      g.rotation.y += dt * 2;
      g.scale.setScalar(Math.max(0.01, 1 - this.falling / 1.8));
      if (this.falling > 1.8) this.remove();
      return;
    }
    this.rise = Math.min(1, this.rise + dt * 0.35);
    const ground = Math.max(0, pile.heightAt(this.pos.x, this.pos.z));
    g.position.set(this.pos.x, ground - 0.4 - (1 - this.rise) * 4, this.pos.z);
    this.head.rotation.y = Math.sin(this.t * 0.3) * 0.6;
    this.head.position.y = Math.sin(this.t * 0.9) * 0.08;
    // slow, calm tentacle waves that curl down the heap
    for (const tn of this.tents) {
      tn.segs.forEach((s, k) => {
        s.rotation.x = 0.16 + Math.sin(this.t * 0.8 + tn.ph + k * 0.6) * 0.12 + (k === 0 ? 0.1 : 0);
        s.rotation.y = Math.sin(this.t * 0.5 + tn.ph + k * 0.4) * 0.14;
      });
    }
    if (this.flinch > 0) { this.flinch -= dt; g.position.x += Math.sin(t * 60) * 0.05; }
  }

  get position() { return this.g ? this.g.position : null; }

  remove() {
    if (this.g) this.scene.remove(this.g);
    this.g = null;
    this.active = false;
    this.falling = null;
  }
}

// ------------------------------------------------------------------ Wächter-Sonde: hovering alien probe with orbiting shield plates.
// Cruises above the heap and sinks down to scan every few seconds - only then it can be grabbed.
export class Sentinel {
  constructor(scene) {
    this.scene = scene;
    this.g = null;
    this.active = false;
    this.falling = null;
    this.name = 'Wächter-Sonde';
  }

  spawn(pile, hp) {
    this.remove();
    const g = new THREE.Group();
    const chrome = new THREE.MeshStandardMaterial({ color: 0x7a8090, metalness: 0.85, roughness: 0.28 });
    const hull = texMat('hull', 0xdfe3ea, { metalness: 0.4 });
    const glow = new THREE.MeshBasicMaterial({ color: 0xb48cff });
    const body = new THREE.Group(); g.add(body); this.body = body;
    // core sphere with an equator band and a calm violet eye ring
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.0, 28, 18), chrome); core.castShadow = true; body.add(core);
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.1, 8, 36), hull); band.rotation.x = Math.PI / 2; body.add(band);
    // panel seams: thin dark rings at latitudes and a few meridians
    const seamM = new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.6, roughness: 0.4 });
    for (const y of [0.5, -0.5]) { const r = Math.sqrt(1 - y * y); const sm = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.02, 4, 32), seamM); sm.rotation.x = Math.PI / 2; sm.position.y = y; body.add(sm); }
    for (let k = 0; k < 4; k++) { const sm = new THREE.Mesh(new THREE.TorusGeometry(1.005, 0.02, 4, 40), seamM); sm.rotation.y = (k / 4) * Math.PI; body.add(sm); }
    const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 24), glow); eyeRing.rotation.x = Math.PI / 2; eyeRing.position.y = -0.92; body.add(eyeRing);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0xe8dcff })); eye.rotation.x = Math.PI / 2; eye.position.y = -0.97; body.add(eye);
    // top antenna crown
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 6), hull);
      sp.position.set(Math.cos(a) * 0.35, 1.2, Math.sin(a) * 0.35); sp.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); body.add(sp);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow); tip.position.set(Math.cos(a) * 0.5, 1.63, Math.sin(a) * 0.5); body.add(tip);
    }
    // scan beam (only visible while it hovers low)
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = -2.1; g.add(beam); this.beam = beam;
    // orbiting hexagonal shield plates
    this.shields = new THREE.Group(); g.add(this.shields);
    this.plates = [];
    const plateGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 6);
    const N = 8;
    for (let k = 0; k < N; k++) {
      const p = new THREE.Group();
      const a = (k / N) * Math.PI * 2;
      p.position.set(Math.cos(a) * 2.0, (k % 2 ? 0.35 : -0.35), Math.sin(a) * 2.0);
      p.lookAt(0, p.position.y, 0);
      const m = new THREE.Mesh(plateGeo, hull); m.rotation.x = Math.PI / 2; m.castShadow = true; p.add(m);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 4, 6), glow); rim.position.z = -0.05; p.add(rim);
      this.shields.add(p);
      this.plates.push({ p, hp: 2 });
    }
    this.shieldHp = N * 2;
    this.coreHp = Math.max(8, Math.round(hp / 2));
    this.maxHp = this.shieldHp + this.coreHp; this.hp = this.maxHp;
    this.g = g;
    this.t = 0; this.cycle = 0; this.low = 0; this.enter = 0;
    this.falling = null; this.flinch = 0;
    this.scene.add(g);
    this.active = true;
    this.update(0, 0, pile);
  }

  // hover phases: 7 s cruising high, 1.5 s sinking, 5.5 s low (scanning), 1.5 s rising
  get exposed() { return this.active && this.falling === null && this.low > 0.75; }
  get reach() { return 3.6; }
  get platesLeft() { return this.plates.reduce((n, q) => n + (q.hp > 0 ? 1 : 0), 0); }

  targetNear(x, z) {
    if (!this.g) return null;
    if (!this.platesLeft) return this.g.position;
    let best = null, bd = 1e9;
    const v = new THREE.Vector3();
    for (const q of this.plates) {
      if (q.hp <= 0) continue;
      q.p.getWorldPosition(v);
      const d = Math.hypot(v.x - x, v.z - z);
      if (d < bd) { bd = d; best = q; }
    }
    this._near = best;
    return best ? best.p.getWorldPosition(new THREE.Vector3()) : this.g.position;
  }

  hit(dust) {
    if (!this.exposed) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.flinch = 0.3;
    if (this.platesLeft) {
      const q = this._near && this._near.hp > 0 ? this._near : this.plates.find((r) => r.hp > 0);
      q.hp--;
      if (dust) dust(q.p.getWorldPosition(new THREE.Vector3()));
      if (q.hp <= 0) q.p.visible = false; else q.p.scale.setScalar(0.75);
      return false;
    }
    if (dust) dust(this.g.position.clone());
    this.body.scale.setScalar(0.6 + 0.4 * this.hp / this.coreHp);
    if (this.hp <= 0) { this.falling = 0; return true; }
    return false;
  }

  update(dt, t, pile) {
    if (!this.g) return;
    this.t += dt;
    const g = this.g;
    if (this.falling !== null) {
      this.falling += dt;
      g.position.y -= dt * 3;
      g.rotation.z += dt * 1.5;
      g.scale.setScalar(Math.max(0.01, 1 - this.falling / 1.8));
      this.beam.material.opacity = 0;
      if (this.falling > 1.8) this.remove();
      return;
    }
    this.enter = Math.min(1, this.enter + dt * 0.4);
    // slow lissajous drift over the heap; it holds still while scanning
    const P = 15.5;
    this.cycle = (this.cycle + dt) % P;
    const c = this.cycle;
    const low = c < 7 ? 0 : c < 8.5 ? (c - 7) / 1.5 : c < 14 ? 1 : 1 - (c - 14) / 1.5;
    this.low = low * low * (3 - 2 * low);
    this.drift = (this.drift || 0) + dt * (1 - this.low) * 0.18;
    const x = Math.sin(this.drift * 1.3) * 6.5, z = Math.sin(this.drift * 2.0 + 0.6) * 5.5;
    const ground = Math.max(0, pile.heightAt(x, z));
    const hi = ground + 6.5, lo = ground + 1.9;
    g.position.set(x, hi + (lo - hi) * this.low + (1 - this.enter) * 14 + Math.sin(this.t * 1.1) * 0.12, z);
    this.shields.rotation.y += dt * (0.5 - this.low * 0.3);
    this.body.rotation.y += dt * 0.25;
    this.beam.material.opacity = 0.1 * this.low;
    this.beam.scale.set(1, 1, 1);
    if (this.flinch > 0) { this.flinch -= dt; g.position.x += Math.sin(t * 60) * 0.05; }
  }

  get position() { return this.g ? this.g.position : null; }

  remove() {
    if (this.g) this.scene.remove(this.g);
    this.g = null;
    this.active = false;
    this.falling = null;
  }
}

// ------------------------------------------------------------------ Schrott-Hydra: three heads take turns rising out of the heap.
export class Hydra {
  constructor(scene) {
    this.scene = scene;
    this.g = null;
    this.active = false;
    this.falling = null;
    this.name = 'Schrott-Hydra';
  }

  spawn(pile, hp) {
    this.remove();
    const g = new THREE.Group();
    const plate = texMat('metal', 0xa8b4a2, { roughness: 0.5, metalness: 0.35, emissive: 0x141a14 });
    const plate2 = texMat('metal', 0x7e8a7a, { roughness: 0.55, metalness: 0.35, emissive: 0x141a14 });
    const visorM = new THREE.MeshBasicMaterial({ color: 0x7cff9a });
    this.heads = [];
    const per = Math.max(6, Math.round(hp / 4) + 3);
    const off = Math.random() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const a = off + (k / 3) * Math.PI * 2;
      const r = 5.5 + Math.random() * 2;
      const root = new THREE.Group(); root.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      root.rotation.y = Math.PI / 2 - a;        // face and lean outwards
      g.add(root);
      // neck: stacked plated rings
      const neck = new THREE.Group(); root.add(neck);
      const N = 7;
      for (let s = 0; s < N; s++) {
        const rad = 0.55 - s * 0.04;
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.92, rad, 0.5, 10), s % 2 ? plate : plate2);
        seg.position.y = s * 0.48; seg.castShadow = true; neck.add(seg);
      }
      // head: wedge skull with jaw and a glowing visor
      const head = new THREE.Group(); head.position.y = N * 0.48 + 0.2; neck.add(head);
      const skull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.4), plate); skull.position.z = 0.25; skull.castShadow = true;
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.7), plate2); snout.position.set(0, -0.05, 1.15);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 1.2), plate2); jaw.position.set(0, -0.42, 0.55);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 0.5), visorM); visor.position.set(0, 0.12, 0.75);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.9), plate2); fin.position.set(0, 0.45, 0.0);
      head.add(skull, snout, jaw, visor, fin);
      this.heads.push({ root, neck, head, jaw, hp: per, max: per, up: 0, ph: Math.random() * 6 });
    }
    this.maxHp = per * 3; this.hp = this.maxHp;
    this.g = g;
    this.t = 0; this.turn = 0; this.turnT = 0;
    this.falling = null; this.flinch = 0;
    this.scene.add(g);
    this.active = true;
    this.update(0, 0, pile);
  }

  get cur() { return this.heads[this.turn]; }
  get exposed() { return this.active && this.falling === null && this.cur && this.cur.up > 0.8; }
  get reach() { return 3.4; }

  targetNear() {
    const h = this.cur;
    return h ? h.head.getWorldPosition(new THREE.Vector3()) : null;
  }

  hit(dust) {
    if (!this.exposed) return false;
    const h = this.cur;
    h.hp--; this.hp = Math.max(0, this.hp - 1);
    this.flinch = 0.3;
    if (dust) dust(h.head.getWorldPosition(new THREE.Vector3()));
    h.head.scale.setScalar(0.6 + 0.4 * h.hp / h.max);
    if (h.hp <= 0) this.turnT = 99;              // this head is done - next one rises
    if (this.hp <= 0) { this.falling = 0; return true; }
    return false;
  }

  update(dt, t, pile) {
    if (!this.g) return;
    this.t += dt;
    if (this.falling !== null) {
      this.falling += dt;
      for (const h of this.heads) { h.root.position.y -= dt * 3; h.root.scale.setScalar(Math.max(0.01, 1 - this.falling / 1.8)); }
      if (this.falling > 1.8) this.remove();
      return;
    }
    // a head stays up 7 s, then the next living head takes over
    this.turnT += dt;
    if (this.turnT > 7 || this.cur.hp <= 0) {
      const alive = this.heads.map((h, i) => (h.hp > 0 ? i : -1)).filter((i) => i >= 0);
      if (alive.length) {
        const next = alive.find((i) => i > this.turn);
        this.turn = next !== undefined ? next : alive[0];
      }
      this.turnT = 0;
    }
    this.heads.forEach((h, i) => {
      const want = i === this.turn && h.hp > 0 ? 1 : 0;
      h.up += (want - h.up) * Math.min(1, dt * 1.6);
      const ground = Math.max(0, pile.heightAt(h.root.position.x, h.root.position.z));
      h.root.position.y = ground - 3.9 + h.up * 3.6;
      h.neck.rotation.x = 0.25 + Math.sin(this.t * 0.7 + h.ph) * 0.08;
      h.neck.rotation.z = Math.sin(this.t * 0.5 + h.ph) * 0.1;
      h.head.rotation.x = -0.35 + Math.sin(this.t * 0.9 + h.ph) * 0.06;
      h.jaw.rotation.x = Math.max(0, Math.sin(this.t * 1.3 + h.ph)) * 0.25;
    });
    if (this.flinch > 0) { this.flinch -= dt; this.cur.root.position.x += Math.sin(t * 60) * 0.04; }
  }

  get position() { return this.g ? this.targetNear() : null; }

  remove() {
    if (this.g) this.scene.remove(this.g);
    this.g = null;
    this.active = false;
    this.falling = null;
  }
}
