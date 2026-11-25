// The heap: 5,000,000 moon stones stored as a count per column.
// Only the surface is drawn (deformable terrain + instanced pebbles).
import * as THREE from 'three';
import { PILE, TOTAL_STONES } from './config.js';
import { mulberry32, makeNoise3 } from './noise.js';

const { N, CELL, H_PER, RADIUS, MAX_SLOPE } = PILE;
const HALF = (N * CELL) / 2;

export class Pile {
  constructor(seed, saved = null) {
    this.counts = new Uint32Array(N * N);
    this.dirty = new Set();     // cells that may need to slide
    this.changed = new Set();   // cells whose visuals need an update
    this.rnd = mulberry32(seed ^ 0x9e3779b9);
    this.ring = { c: 0, k: 0, found: true }; // placeholder until generated
    if (saved) {
      this.counts.set(saved.counts);
      this.ring = { ...saved.ring };
    } else {
      this.generate(seed);
    }
    this.total = this.counts.reduce((a, b) => a + b, 0);
  }

  // ---------------------------------------------------------- helpers
  idx(i, j) { return i + j * N; }
  cellAt(x, z) {
    const i = Math.floor((x + HALF) / CELL), j = Math.floor((z + HALF) / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return -1;
    return this.idx(i, j);
  }
  cellCenter(c) {
    const i = c % N, j = Math.floor(c / N);
    return [-HALF + (i + 0.5) * CELL, -HALF + (j + 0.5) * CELL];
  }
  cellHeight(c) { return this.counts[c] * H_PER; }

  // Height of a terrain vertex (a, b in 0..N): average of its neighbour cells.
  vertexHeight(a, b) {
    let s = 0, n = 0, any = 0;
    for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
      const i = a + di, j = b + dj;
      if (i < 0 || j < 0 || i >= N || j >= N) { n++; continue; }
      const c = this.counts[this.idx(i, j)];
      s += c; n++; if (c > 0) any++;
    }
    return any ? (s / n) * H_PER : -0.03;
  }

  // Surface height at world position (bilinear over vertices, like the mesh).
  heightAt(x, z) {
    const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    if (fx < 0 || fz < 0 || fx >= N || fz >= N) return -1;
    const a = Math.floor(fx), b = Math.floor(fz);
    const tx = fx - a, tz = fz - b;
    const h00 = this.vertexHeight(a, b), h10 = this.vertexHeight(a + 1, b);
    const h01 = this.vertexHeight(a, b + 1), h11 = this.vertexHeight(a + 1, b + 1);
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  // ---------------------------------------------------------- generation
  generate(seed) {
    const noise = makeNoise3(seed);
    const w = new Float64Array(N * N);
    let sum = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const [x, z] = this.cellCenter(this.idx(i, j));
      const r = Math.hypot(x, z) / RADIUS;
      if (r >= 1) continue;
      const n = 0.75 + noise(x * 0.18, 0, z * 0.18) * 0.5 + noise(x * 0.5, 3, z * 0.5) * 0.15;
      const v = Math.pow(1 - r * r, 0.9) * n;
      w[this.idx(i, j)] = v; sum += v;
    }
    let assigned = 0;
    for (let c = 0; c < N * N; c++) {
      this.counts[c] = Math.floor((w[c] / sum) * TOTAL_STONES);
      assigned += this.counts[c];
    }
    // distribute the remainder onto the centre
    this.counts[this.idx(N / 2, N / 2)] += TOTAL_STONES - assigned;

    // let it settle completely
    for (let c = 0; c < N * N; c++) if (this.counts[c]) this.dirty.add(c);
    for (let pass = 0; pass < 400 && this.dirty.size; pass++) this.relaxStep(true);
    this.dirty.clear();

    // hide the ring: a uniformly random stone of all 5,000,000
    let s = Math.floor(this.rnd() * TOTAL_STONES);
    let c = 0;
    for (; c < N * N; c++) { if (s < this.counts[c]) break; s -= this.counts[c]; }
    this.ring = { c, k: s, found: false };
  }

  // ---------------------------------------------------------- ring helpers
  stonesAboveRing() { return Math.max(0, this.counts[this.ring.c] - this.ring.k); }
  ringExposed() { return !this.ring.found && this.stonesAboveRing() === 0; }
  ringPosition(out = new THREE.Vector3()) {
    const [x, z] = this.cellCenter(this.ring.c);
    return out.set(x, this.ring.k * H_PER, z);
  }

  // ---------------------------------------------------------- removal
  // Remove up to `amount` stones from the top of one cell.
  // Returns { removed, ring } where ring === true if the ring was taken.
  removeFromCell(c, amount) {
    const have = this.counts[c];
    const r = Math.min(have, amount);
    let ring = false;
    if (r > 0) {
      if (!this.ring.found && c === this.ring.c && have - r < this.ring.k && have >= this.ring.k) {
        // we dug past the ring's level -> it's ours
        ring = true;
      }
      this.counts[c] = have - r;
      this.total -= r;
      this.markChanged(c);
    }
    return { removed: r, ring };
  }

  // Grab `amount` stones around a world position, top-down within `radius` cells.
  grab(x, z, amount, radius) {
    const c0 = this.cellAt(x, z);
    if (c0 < 0) return { removed: 0, ring: false, cells: [] };
    const i0 = c0 % N, j0 = Math.floor(c0 / N);
    const R = Math.ceil(radius);
    const disc = [];
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      if (di * di + dj * dj > radius * radius + 0.5) continue;
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= N || j >= N) continue;
      disc.push(this.idx(i, j));
    }
    let ring = false;
    if (this.ringExposed() && disc.includes(this.ring.c)) ring = true;

    let left = amount, removed = 0;
    const chunk = Math.max(1, Math.ceil(amount / 24));
    while (left > 0) {
      let best = -1, bh = 0;
      for (const c of disc) if (this.counts[c] > bh) { bh = this.counts[c]; best = c; }
      if (best < 0) break;
      const r = this.removeFromCell(best, Math.min(chunk, left));
      removed += r.removed; left -= r.removed;
      if (r.ring) ring = true;
    }
    if (ring) this.ring.found = true;
    return { removed, ring, cells: disc };
  }

  // Remove stones from random surface spots (automation).
  removeRandom(amount) {
    let removed = 0, ring = false, tries = 0;
    while (removed < amount && tries < 12 && this.total > 0) {
      tries++;
      const c = Math.floor(this.rnd() * N * N);
      if (!this.counts[c]) continue;
      const r = this.removeFromCell(c, Math.min(this.counts[c], Math.ceil((amount - removed) / 2)));
      removed += r.removed;
      if (r.ring) ring = true;
    }
    if (!this.ring.found && this.total === 0) ring = true;
    if (ring) this.ring.found = true;
    return { removed, ring };
  }

  markChanged(c) {
    this.dirty.add(c);
    this.changed.add(c);
  }

  // One sliding pass: stones on too-steep slopes move to lower neighbours.
  relaxStep(silent = false) {
    if (!this.dirty.size) return;
    const list = [...this.dirty];
    this.dirty.clear();
    for (const c of list) {
      const i = c % N, j = Math.floor(c / N);
      const nb = [];
      if (i > 0) nb.push(c - 1);
      if (i < N - 1) nb.push(c + 1);
      if (j > 0) nb.push(c - N);
      if (j < N - 1) nb.push(c + N);
      for (const n of nb) {
        const diff = this.counts[c] - this.counts[n];
        if (diff <= MAX_SLOPE) continue;
        const m = Math.floor((diff - MAX_SLOPE) / 2) + 1;
        this.counts[c] -= m;
        this.counts[n] += m;
        if (!this.ring.found && c === this.ring.c && this.counts[c] < this.ring.k) this.ring.k = this.counts[c];
        this.dirty.add(c); this.dirty.add(n);
        if (!silent) { this.changed.add(c); this.changed.add(n); }
      }
    }
  }

  serialize() {
    return { counts: Array.from(this.counts), ring: this.ring };
  }
}

// ------------------------------------------------------------------ view
export class PileView {
  constructor(pile, scene) {
    this.pile = pile;
    this.scene = scene;

    const size = N * CELL;
    const geo = new THREE.PlaneGeometry(size, size, N, N);
    geo.rotateX(-Math.PI / 2);
    // PlaneGeometry rows run from -z to +z after rotation? Map explicitly.
    const pos = geo.attributes.position;
    this.vmap = new Int32Array(pos.count * 2);
    for (let v = 0; v < pos.count; v++) {
      const a = Math.round((pos.getX(v) + HALF) / CELL);
      const b = Math.round((pos.getZ(v) + HALF) / CELL);
      this.vmap[v * 2] = a; this.vmap[v * 2 + 1] = b;
    }
    this.vertsByAB = new Map();
    for (let v = 0; v < pos.count; v++) {
      const key = this.vmap[v * 2] + this.vmap[v * 2 + 1] * (N + 1);
      if (!this.vertsByAB.has(key)) this.vertsByAB.set(key, []);
      this.vertsByAB.get(key).push(v);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
    this.tint = new Float32Array(pos.count);
    const rnd = mulberry32(77);
    for (let v = 0; v < pos.count; v++) this.tint[v] = 0.85 + rnd() * 0.3;
    this.geo = geo;

    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, metalness: 0, flatShading: true,
    }));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    for (let v = 0; v < pos.count; v++) this.updateVertex(v);
    geo.computeVertexNormals();

    // Pebbles for surface detail
    this.PEB = 7000;
    const pg = new THREE.IcosahedronGeometry(1, 0);
    this.pebbles = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.35, flatShading: true }), this.PEB);
    this.pebbles.receiveShadow = true;
    this.pebData = [];
    this.pebByCell = new Map();
    const col = new THREE.Color();
    for (let k = 0; k < this.PEB; k++) {
      let c, x, z;
      for (let t = 0; t < 30; t++) {
        x = (rnd() - 0.5) * 2 * RADIUS; z = (rnd() - 0.5) * 2 * RADIUS;
        c = pile.cellAt(x, z);
        if (c >= 0 && pile.counts[c] > 0) break;
      }
      const s = 0.05 + rnd() * rnd() * 0.2;
      const d = { x, z, c, s, rx: rnd() * 6, ry: rnd() * 6 };
      this.pebData.push(d);
      if (!this.pebByCell.has(c)) this.pebByCell.set(c, []);
      this.pebByCell.get(c).push(k);
      const g = 0.16 + rnd() * 0.22;
      const kind = rnd();
      if (kind < 0.18) col.setRGB(g * 1.9, g * 0.9, g * 0.5);        // rust
      else if (kind < 0.3) col.setRGB(g * 1.6, g * 1.1, g * 0.6);    // copper
      else if (kind < 0.45) col.setRGB(g * 1.4, g * 1.5, g * 1.65);  // steel
      else col.setRGB(g * 1.05, g, g * 0.95);                         // rock
      this.pebbles.setColorAt(k, col);
      this.updatePebble(k);
    }
    scene.add(this.pebbles);

    // The Nexus core (only visible when exposed) + glitter sprite
    this.ringMesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: 0x9ff8ff, emissive: 0x33d6e6, emissiveIntensity: 1.6, roughness: 0.1, flatShading: true }));
    core.scale.y = 1.4;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
    halo.rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0x6ff3f0, 6, 5);
    this.ringMesh.add(core, halo, light);
    this.ringMesh.visible = false;
    scene.add(this.ringMesh);

    this.glitter = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeSparkleTexture(), color: 0x8ff6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glitter.scale.setScalar(0.9);
    this.glitter.visible = false;
    scene.add(this.glitter);
    this.glitterT = 0;
  }

  updateVertex(v) {
    const a = this.vmap[v * 2], b = this.vmap[v * 2 + 1];
    const h = this.pile.vertexHeight(a, b);
    this.geo.attributes.position.setY(v, h);
    const t = this.tint[v];
    const col = this.geo.attributes.color;
    if (h < 0) col.setXYZ(v, 0.45 * t, 0.47 * t, 0.5 * t);           // exposed crater floor
    else {
      const k = Math.min(1, h / 12);
      col.setXYZ(v, (0.24 - k * 0.04) * t, (0.22 - k * 0.04) * t, (0.21 - k * 0.02) * t);
    }
  }

  updatePebble(k) {
    const d = this.pebData[k];
    const m = new THREE.Matrix4();
    const cnt = d.c >= 0 ? this.pile.counts[d.c] : 0;
    if (cnt < 4) {
      m.makeScale(0, 0, 0);
    } else {
      const y = this.pile.heightAt(d.x, d.z);
      m.makeRotationFromEuler(new THREE.Euler(d.rx, d.ry, 0));
      m.scale(new THREE.Vector3(d.s, d.s * 0.7, d.s));
      m.setPosition(d.x, y + d.s * 0.3, d.z);
    }
    this.pebbles.setMatrixAt(k, m);
  }

  // Apply visual changes for cells touched since the last frame.
  sync() {
    const changed = this.pile.changed;
    if (!changed.size) return;
    const verts = new Set();
    const pebCells = new Set();
    for (const c of changed) {
      const i = c % N, j = Math.floor(c / N);
      for (let b = j; b <= j + 1; b++) for (let a = i; a <= i + 1; a++) {
        const list = this.vertsByAB.get(a + b * (N + 1));
        if (list) list.forEach((v) => verts.add(v));
      }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < N && jj < N) pebCells.add(ii + jj * N);
      }
    }
    changed.clear();
    for (const v of verts) this.updateVertex(v);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    for (const c of pebCells) {
      const list = this.pebByCell.get(c);
      if (list) list.forEach((k) => this.updatePebble(k));
    }
    this.pebbles.instanceMatrix.needsUpdate = true;
  }

  updateRing(dt, glitterDepth) {
    const p = this.pile;
    if (p.ring.found) { this.ringMesh.visible = false; this.glitter.visible = false; return; }
    const above = p.stonesAboveRing();
    const [x, z] = p.cellCenter(p.ring.c);
    if (above === 0) {
      this.ringMesh.visible = true;
      this.ringMesh.position.set(x, Math.max(0.05, p.heightAt(x, z)) + 0.35 + Math.sin(performance.now() / 300) * 0.05, z);
      this.ringMesh.rotation.y += dt * 1.5;
    } else this.ringMesh.visible = false;

    // occasional glitter flash through the stones
    this.glitterT -= dt;
    if (above <= glitterDepth && this.glitterT <= 0) {
      this.glitterT = 1.2 + Math.random() * 2.5;
      this.glitterLife = 0.45;
    }
    if (this.glitterLife > 0) {
      this.glitterLife -= dt;
      this.glitter.visible = true;
      this.glitter.position.set(x, p.heightAt(x, z) + 0.25, z);
      const s = Math.sin((this.glitterLife / 0.45) * Math.PI);
      this.glitter.scale.setScalar(0.2 + s * 1.1);
      this.glitter.material.rotation += dt * 3;
    } else this.glitter.visible = false;
  }
}

export function makeSparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,240,180,0.8)');
  grad.addColorStop(1, 'rgba(255,240,180,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.moveTo(32, 0); g.lineTo(35, 29); g.lineTo(64, 32); g.lineTo(35, 35);
  g.lineTo(32, 64); g.lineTo(29, 35); g.lineTo(0, 32); g.lineTo(29, 29);
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
