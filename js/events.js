// Random station events: meteor showers and luck waves.
import * as THREE from 'three';

export const EVENT_TYPES = {
  meteor: { name: '☄️ Meteoritenschauer', desc: 'Meteoriten schlagen ein – greif sie dir!', duration: 22, color: '#ff9a5c' },
  luck:   { name: '✨ Glückswelle',        desc: 'Doppelte Funde für kurze Zeit!',         duration: 30, color: '#e58cff' },
};

export class Events {
  constructor(scene, hooks) {
    this.scene = scene;
    this.hooks = hooks;          // { onImpact(pos), onStart(type), onEnd(type) }
    this.next = 75;              // seconds until the first event
    this.active = null;          // { type, t }
    this.meteors = [];           // falling or lying meteors
    this.spawnT = 0;

    this.rockGeo = new THREE.IcosahedronGeometry(0.32, 0);
    this.rockMat = new THREE.MeshStandardMaterial({ color: 0x3a2a24, emissive: 0xff5a1f, emissiveIntensity: 1.1, roughness: 0.6, flatShading: true });
    const c = document.createElement('canvas');
    c.width = 32; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,240,200,0)');
    grad.addColorStop(0.7, 'rgba(255,150,60,0.7)');
    grad.addColorStop(1, 'rgba(255,255,230,1)');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(10, 0); g.lineTo(22, 0); g.lineTo(32, 128); g.lineTo(0, 128); g.fill();
    this.trailTex = new THREE.CanvasTexture(c);
    this.trailGeo = new THREE.CylinderGeometry(0.04, 0.35, 8, 10, 1, true);
    this.trailGeo.translate(0, 4, 0);
    this.trailMat = new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }

  get luckFactor() { return this.active && this.active.type === 'luck' ? 2 : 1; }

  start(type, pile) {
    this.active = { type, t: EVENT_TYPES[type].duration };
    this.spawnT = 0.5;
    this.hooks.onStart(type);
  }

  spawnMeteor(pile) {
    let x = 0, z = 0;
    for (let t = 0; t < 30; t++) {
      x = (Math.random() - 0.5) * 26; z = (Math.random() - 0.5) * 26;
      const cell = pile.cellAt(x, z);
      if (cell >= 0 && pile.counts[cell] > 50) break;
    }
    const mesh = new THREE.Mesh(this.rockGeo, this.rockMat);
    mesh.castShadow = true;
    const trail = new THREE.Mesh(this.trailGeo, this.trailMat);
    const light = new THREE.PointLight(0xff8a3a, 4, 6);
    const grp = new THREE.Group();
    grp.add(mesh, trail, light);
    const from = new THREE.Vector3(x + 18, 45, z - 10);
    grp.position.copy(from);
    trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(18, 45, -10).normalize());
    this.scene.add(grp);
    this.meteors.push({ grp, mesh, trail, light, from, x, z, t: 0, fall: 1.4 + Math.random() * 0.4, landed: false, life: 35 });
  }

  update(dt, t, pile, camera) {
    // schedule
    if (!this.active) {
      this.next -= dt * (this.speed || 1);
      if (this.next <= 0) {
        this.next = 100 + Math.random() * 80;
        this.start(Math.random() < 0.55 ? 'meteor' : 'luck', pile);
      }
    } else {
      this.active.t -= dt;
      if (this.active.type === 'meteor') {
        this.spawnT -= dt;
        if (this.spawnT <= 0 && this.active.t > 3) { this.spawnT = 1.6 + Math.random() * 1.6; this.spawnMeteor(pile); }
      }
      if (this.active.t <= 0) { const type = this.active.type; this.active = null; this.hooks.onEnd(type); }
    }

    // meteors
    for (let k = this.meteors.length - 1; k >= 0; k--) {
      const m = this.meteors[k];
      const ground = Math.max(0, pile.heightAt(m.x, m.z)) + 0.25;
      if (!m.landed) {
        m.t += dt;
        const f = Math.min(1, m.t / m.fall);
        const target = new THREE.Vector3(m.x, ground, m.z);
        m.grp.position.lerpVectors(m.from, target, f * f);
        if (f >= 1) {
          m.landed = true;
          m.trail.visible = false;
          m.light.intensity = 2;
          this.hooks.onImpact(m.grp.position.clone());
        }
      } else {
        m.life -= dt;
        m.grp.position.y = ground + Math.sin(t * 3 + k) * 0.03;
        m.mesh.rotation.y += dt * 0.6;
        this.rockMat.emissiveIntensity = 0.8 + Math.sin(t * 5) * 0.3;
        if (m.life <= 0) { this.scene.remove(m.grp); this.meteors.splice(k, 1); }
      }
    }
  }

  // take a landed meteor within reach
  take(x, z, reach = 2.6) {
    for (let k = 0; k < this.meteors.length; k++) {
      const m = this.meteors[k];
      if (m.landed && Math.hypot(m.grp.position.x - x, m.grp.position.z - z) < reach) {
        this.meteors.splice(k, 1);
        this.scene.remove(m.grp);
        return m.grp.position.clone();
      }
    }
    return null;
  }

  clear() {
    this.meteors.forEach((m) => this.scene.remove(m.grp));
    this.meteors = [];
    this.active = null;
    this.next = 75;
  }
}
