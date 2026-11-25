// Partikel, Sonar-Puls, Sternsplitter-Animation.
import * as THREE from 'three';

export class Particles {
  constructor(scene, max = 500) {
    this.max = max;
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const mat = new THREE.MeshLambertMaterial();
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.items = [];
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.s = new THREE.Vector3();
  }

  burst(pos, color, n = 4, speed = 4) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      if (this.items.length >= this.max) this.items.shift();
      this.items.push({
        p: pos.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)),
        v: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 1.2 + 1, (Math.random() - 0.5) * speed),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        life: 0.7 + Math.random() * 0.6,
        t: 0,
        c,
      });
    }
  }

  update(dt) {
    const out = [];
    for (const it of this.items) {
      it.t += dt;
      if (it.t > it.life) continue;
      it.v.y -= 14 * dt;
      it.p.addScaledVector(it.v, dt);
      out.push(it);
    }
    this.items = out;
    for (let i = 0; i < out.length; i++) {
      const it = out[i];
      const sc = 1 - it.t / it.life;
      this.e.set(it.r.x * it.t, it.r.y * it.t, it.r.z * it.t);
      this.q.setFromEuler(this.e);
      this.s.setScalar(Math.max(0.01, sc));
      this.m4.compose(it.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
      this.mesh.setColorAt(i, it.c);
    }
    this.mesh.count = out.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Halbtransparente Kugel, die ungefähr anzeigt, wo der Splitter liegt. */
export class SonarPing {
  constructor(scene) {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x7af0ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, wireframe: true }),
    );
    this.mesh.renderOrder = 10;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.t = 0;
    this.dur = 0;
  }
  show(pos, radius, dur = 4) {
    this.mesh.position.copy(pos);
    this.radius = radius;
    this.t = 0;
    this.dur = dur;
    this.mesh.visible = true;
  }
  update(dt) {
    if (!this.mesh.visible) return;
    this.t += dt;
    const k = this.t / this.dur;
    if (k >= 1) { this.mesh.visible = false; return; }
    const pulse = 0.85 + 0.15 * Math.sin(this.t * 8);
    this.mesh.scale.setScalar(this.radius * pulse);
    this.mesh.material.opacity = 0.55 * (1 - k);
    this.mesh.rotation.y += dt;
  }
}

/** Der Sternsplitter als leuchtender Kristall, der aufsteigt. */
export class StarShard {
  constructor(scene) {
    const geo = new THREE.OctahedronGeometry(0.75, 0);
    geo.scale(1, 1.6, 1);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xffe27a, emissive: 0xffb300, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.25, flatShading: true,
    }));
    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.mesh.add(this.halo);
    this.light = new THREE.PointLight(0xffc640, 0, 30, 1.5);
    this.mesh.add(this.light);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.active = false;
  }
  launch(from, toY, onDone) {
    this.mesh.position.copy(from);
    this.from = from.clone();
    this.toY = toY;
    this.t = 0;
    this.active = true;
    this.mesh.visible = true;
    this.onDone = onDone;
  }
  hide() { this.mesh.visible = false; this.active = false; this.light.intensity = 0; }
  update(dt) {
    if (!this.mesh.visible) return;
    this.t += dt;
    this.mesh.rotation.y += dt * 2.5;
    const k = Math.min(1, this.t / 2.2);
    const e = 1 - Math.pow(1 - k, 3);
    this.mesh.position.y = this.from.y + (this.toY - this.from.y) * e;
    this.light.intensity = 3 + Math.sin(this.t * 6) * 1;
    this.halo.scale.setScalar(1 + 0.15 * Math.sin(this.t * 5));
    if (k >= 1 && this.active) {
      this.active = false;
      this.onDone?.();
    }
  }
}
