// Visual & gameplay extras: bonus capsules on the heap, dust puffs, floating screen labels.
import * as THREE from 'three';
import { CAPSULE } from './config.js';

// ---------------------------------------------------------------- capsules
export class Capsules {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.timer = 6;
    const body = new THREE.CylinderGeometry(0.28, 0.28, 0.7, 16);
    body.rotateZ(Math.PI / 2);
    this.bodyGeo = body;
    this.capGeo = new THREE.SphereGeometry(0.28, 16, 10);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xffb347, metalness: 0.4, roughness: 0.35, emissive: 0x6a3000, emissiveIntensity: 0.4 });
    this.capMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f2, metalness: 0.3, roughness: 0.4 });
    this.bandMat = new THREE.MeshBasicMaterial({ color: 0x6ff3f0 });
    this.darkMat = new THREE.MeshStandardMaterial({ color: 0x2c2f35, metalness: 0.6, roughness: 0.4 });
    this.ringGeo = new THREE.TorusGeometry(0.285, 0.025, 6, 20).rotateY(Math.PI / 2);
    this.finGeo = new THREE.BoxGeometry(0.18, 0.02, 0.14);
    this.nozGeo = new THREE.CylinderGeometry(0.08, 0.13, 0.12, 12).rotateZ(Math.PI / 2);
    this.handleGeo = new THREE.TorusGeometry(0.08, 0.015, 4, 10, Math.PI);
    this.winGeo = new THREE.BoxGeometry(0.1, 0.06, 0.02);
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }

  spawn(pile) {
    if (this.list.length >= CAPSULE.max || pile.total < 1000) return;
    // pick a random surface spot on the heap
    let x = 0, z = 0;
    for (let t = 0; t < 40; t++) {
      x = (Math.random() - 0.5) * 28; z = (Math.random() - 0.5) * 28;
      const c = pile.cellAt(x, z);
      if (c >= 0 && pile.counts[c] > 200) break;
    }
    const g = new THREE.Group();
    const b = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    const c1 = new THREE.Mesh(this.capGeo, this.capMat); c1.position.x = 0.35; c1.scale.x = 0.5;
    const c2 = c1.clone(); c2.position.x = -0.35;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.03, 6, 20), this.bandMat); band.rotation.y = Math.PI / 2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 8, 12, 1, true), this.beamMat);
    beam.position.y = 4;
    b.castShadow = true;
    g.add(b, c1, c2, band, beam);
    // detail: dark ribs, stabiliser fins and a nozzle at the tail, a carry handle and lit windows
    for (const x of [-0.22, 0.22]) { const r = new THREE.Mesh(this.ringGeo, this.darkMat); r.position.x = x; g.add(r); }
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(this.finGeo, this.capMat); const a = k * Math.PI / 2; f.position.set(-0.46, Math.sin(a) * 0.2, Math.cos(a) * 0.2); f.rotation.x = a; g.add(f); }
    const noz = new THREE.Mesh(this.nozGeo, this.darkMat); noz.position.x = -0.55; g.add(noz);
    const hd = new THREE.Mesh(this.handleGeo, this.darkMat); hd.position.set(0, 0.28, 0); g.add(hd);
    for (const x of [-0.1, 0.1]) { const w = new THREE.Mesh(this.winGeo, this.bandMat); w.position.set(x, 0.05, 0.28); g.add(w); }
    g.userData = { x, z, phase: Math.random() * 6, age: 0 };
    g.rotation.y = Math.random() * Math.PI;
    this.scene.add(g);
    this.list.push(g);
  }

  update(dt, t, pile) {
    this.timer -= dt * (this.speed || 1);
    if (this.timer <= 0) { this.timer = CAPSULE.respawn * (0.6 + Math.random() * 0.8); this.spawn(pile); }
    for (const g of this.list) {
      const u = g.userData;
      u.age += dt;
      const h = Math.max(0, pile.heightAt(u.x, u.z));
      const drop = Math.max(0, 6 - u.age * 8); // falls in from above
      g.position.set(u.x, h + 0.3 + drop + Math.sin(t * 2 + u.phase) * 0.06, u.z);
      g.children[0].rotation.x += dt * 0.5;
    }
  }

  // returns the capsule within reach of (x,z), removed from the scene
  take(x, z, reach = CAPSULE.reach) {
    for (let k = 0; k < this.list.length; k++) {
      const g = this.list[k];
      if (Math.hypot(g.position.x - x, g.position.z - z) < reach) {
        this.list.splice(k, 1);
        this.scene.remove(g);
        return g;
      }
    }
    return null;
  }

  clear() { this.list.forEach((g) => this.scene.remove(g)); this.list = []; this.timer = 6; }
}

// ---------------------------------------------------------------- dust puffs
export class Dust {
  constructor(scene) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    this.tex = new THREE.CanvasTexture(c);
    this.pool = [];
    for (let k = 0; k < 60; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: 0x9a948c, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      this.pool.push({ s, age: 1, life: 1, v: new THREE.Vector3() });
    }
    this.i = 0;
  }
  puff(x, y, z, n = 3, size = 1, color = 0x9a948c) {
    for (let k = 0; k < n; k++) {
      const p = this.pool[this.i++ % this.pool.length];
      p.s.position.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6);
      p.v.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
      p.age = 0; p.life = 0.8 + Math.random() * 0.8; p.size = (0.5 + Math.random() * 0.6) * size;
      p.s.material.color.setHex(color);
      p.s.visible = true;
    }
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.s.visible) continue;
      p.age += dt;
      if (p.age >= p.life) { p.s.visible = false; continue; }
      const k = p.age / p.life;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.size * (0.6 + k * 1.6));
      p.s.material.opacity = 0.55 * (1 - k);
    }
  }
}

// ---------------------------------------------------------------- floating labels (DOM)
const layer = document.createElement('div');
layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;overflow:hidden';
document.body.appendChild(layer);
const tmp = new THREE.Vector3();

export function floatLabel(camera, pos, text, color = '#6ff3f0', big = false) {
  tmp.copy(pos).project(camera);
  if (tmp.z > 1) return;
  const el = document.createElement('div');
  el.className = 'float-label' + (big ? ' big' : '');
  el.textContent = text;
  el.style.color = color;
  el.style.left = `${(tmp.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 30}px`;
  el.style.top = `${(-tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
