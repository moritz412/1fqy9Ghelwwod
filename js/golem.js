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
    const mats = [texMat('metal', 0x8a8f98), texMat('metal', 0xa0623a), texMat('hull', 0xcfd3d8), texMat('metal', 0x5a5f66)];
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
    // torso made of stacked scrap
    for (let k = 0; k < 9; k++) box(0.6 + Math.random() * 0.8, 0.5 + Math.random() * 0.4, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2, 2.0 + Math.floor(k / 3) * 0.55, (Math.random() - 0.5) * 0.6, k);
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
    const ring = texMat('metal', 0x9a7a5a, { roughness: 0.45 });
    const ring2 = texMat('metal', 0x6d737c, { roughness: 0.5 });
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
    const link = texMat('metal', 0x8a6a52, { roughness: 0.45 });
    const link2 = texMat('metal', 0x5f656e, { roughness: 0.5 });
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
