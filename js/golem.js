// The Scrap Golem: a big, slow, friendly-looking heap of scrap that Nexus dismantles piece by piece.
import * as THREE from 'three';
import { texMat } from './textures.js';

export class Golem {
  constructor(scene) {
    this.scene = scene;
    this.g = null;
    this.active = false;
  }

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
