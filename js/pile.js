// The heap: 5,000,000 moon stones stored as a count per column.
// Only the surface is drawn (deformable terrain + instanced pebbles).
import * as THREE from 'three';
import { PILE, TOTAL_STONES } from './config.js';
import { mulberry32, makeNoise3 } from './noise.js';
import { texMat } from './textures.js';

const { N, CELL, H_PER, RADIUS, MAX_SLOPE } = PILE;
const HALF = (N * CELL) / 2;

export class Pile {
  constructor(seed, saved = null, target = TOTAL_STONES) {
    this.target = target;
    // bigger decks: each part is 'thinner' so the heap keeps the same shape and size
    this.hPer = H_PER * TOTAL_STONES / target;
    this.maxSlope = Math.round(MAX_SLOPE * target / TOTAL_STONES);
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
  cellHeight(c) { return this.counts[c] * this.hPer; }

  // Height of a terrain vertex (a, b in 0..N): average of its neighbour cells.
  vertexHeight(a, b) {
    let s = 0, n = 0, any = 0;
    for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
      const i = a + di, j = b + dj;
      if (i < 0 || j < 0 || i >= N || j >= N) { n++; continue; }
      const c = this.counts[this.idx(i, j)];
      s += c; n++; if (c > 0) any++;
    }
    return any ? (s / n) * this.hPer : -0.03;
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
      this.counts[c] = Math.floor((w[c] / sum) * this.target);
      assigned += this.counts[c];
    }
    // distribute the remainder onto the centre
    this.counts[this.idx(N / 2, N / 2)] += this.target - assigned;

    // let it settle completely
    for (let c = 0; c < N * N; c++) if (this.counts[c]) this.dirty.add(c);
    for (let pass = 0; pass < 400 && this.dirty.size; pass++) this.relaxStep(true);
    this.dirty.clear();

    // hide the ring: a uniformly random stone of all 5,000,000
    let s = Math.floor(this.rnd() * this.target);
    let c = 0;
    for (; c < N * N; c++) { if (s < this.counts[c]) break; s -= this.counts[c]; }
    this.ring = { c, k: s, found: false };
  }

  // ---------------------------------------------------------- ring helpers
  stonesAboveRing() { return Math.max(0, this.counts[this.ring.c] - this.ring.k); }
  ringExposed() { return !this.ring.found && this.stonesAboveRing() === 0; }
  ringPosition(out = new THREE.Vector3()) {
    const [x, z] = this.cellCenter(this.ring.c);
    return out.set(x, this.ring.k * this.hPer, z);
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
        if (diff <= this.maxSlope) continue;
        const m = Math.floor((diff - this.maxSlope) / 2) + 1;
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
  constructor(pile, scene, theme = null) {
    this.pile = pile;
    this.theme = theme || { base: [0.24, 0.22, 0.21], pebbles: [[1.9, 0.9, 0.5], [1.6, 1.1, 0.6], [1.4, 1.5, 1.65], [1.05, 1, 0.95]] };
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

    const detail = scrapDetailTexture();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.92, metalness: 0.08, flatShading: true,
      map: detail, bumpMap: detail, bumpScale: 1.2,
    }));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    for (let v = 0; v < pos.count; v++) this.updateVertex(v);
    geo.computeVertexNormals();

    // Pebbles for surface detail
    this.PEB = 7000;
    // three kinds of scrap: rock chunks, bent plates, pipes
    const shapes = [
      { geo: new THREE.IcosahedronGeometry(1, 0), share: 0.55, metal: 0.25 },
      { geo: new THREE.BoxGeometry(1.6, 0.18, 1.1), share: 0.25, metal: 0.6 },
      { geo: new THREE.CylinderGeometry(0.28, 0.28, 2.2, 7), share: 0.2, metal: 0.7 },
    ];
    this.pebMeshes = shapes.map((sh) => {
      const m = new THREE.InstancedMesh(sh.geo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: sh.metal, flatShading: true }), this.PEB);
      m.receiveShadow = true;
      m.count = 0;
      return m;
    });
    this.pebbles = this.pebMeshes[0];
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
      const r = rnd();
      const type = r < 0.55 ? 0 : r < 0.8 ? 1 : 2;
      const mesh = this.pebMeshes[type];
      const s = (0.05 + rnd() * rnd() * 0.2) * (type ? 0.8 : 1);
      const d = { x, z, c, s, rx: type ? (rnd() - 0.5) * 0.8 : rnd() * 6, ry: rnd() * 6, rz: type === 2 ? Math.PI / 2 + (rnd() - 0.5) * 0.6 : (rnd() - 0.5) * 0.6, type, i: mesh.count++ };
      this.pebData.push(d);
      if (!this.pebByCell.has(c)) this.pebByCell.set(c, []);
      this.pebByCell.get(c).push(k);
      const g = 0.16 + rnd() * 0.22;
      const kind = rnd();
      const pal = this.theme.pebbles;
      const tint = kind < 0.18 ? pal[0] : kind < 0.3 ? pal[1] : kind < 0.45 ? pal[2] : pal[3];
      col.setRGB(g * tint[0], g * tint[1], g * tint[2]);
      mesh.setColorAt(d.i, col);
      this.updatePebble(k);
    }
    this.pebMeshes.forEach((m) => scene.add(m));
    this.buildJunk(pile, rnd);

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

  // Large, recognisable scrap lying on top of the heap: gears, barrels, tyres, girders, panels.
  buildJunk(pile, rnd) {
    const gear = (() => {
      const sh = new THREE.Shape(); const teeth = 10, r0 = 0.78, r1 = 1;
      for (let k = 0; k < teeth * 2; k++) {
        const a0 = (k / (teeth * 2)) * Math.PI * 2, a1 = ((k + 1) / (teeth * 2)) * Math.PI * 2, r = k % 2 ? r0 : r1;
        if (k === 0) sh.moveTo(Math.cos(a0) * r, Math.sin(a0) * r); else sh.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
        sh.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      }
      const hole = new THREE.Path(); hole.absarc(0, 0, 0.28, 0, Math.PI * 2, true); sh.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 6 });
      g.rotateX(Math.PI / 2); g.center(); return g;
    })();
    const beam = (() => {
      const sh = new THREE.Shape(); const w = 0.5, h = 0.6, t = 0.1;
      sh.moveTo(-w, -h); sh.lineTo(w, -h); sh.lineTo(w, -h + t); sh.lineTo(t / 2, -h + t); sh.lineTo(t / 2, h - t); sh.lineTo(w, h - t); sh.lineTo(w, h); sh.lineTo(-w, h); sh.lineTo(-w, h - t); sh.lineTo(-t / 2, h - t); sh.lineTo(-t / 2, -h + t); sh.lineTo(-w, -h + t); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 3.2, bevelEnabled: false }); g.center(); return g;
    })();
    const barrel = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 14, 3);
    { // rims on the barrel
      const p = barrel.attributes.position;
      for (let v = 0; v < p.count; v++) { const y = p.getY(v); if (Math.abs(Math.abs(y) - 0.25) < 0.01) { p.setX(v, p.getX(v) * 1.06); p.setZ(v, p.getZ(v) * 1.06); } }
      barrel.computeVertexNormals();
    }
    const tyre = new THREE.TorusGeometry(0.75, 0.3, 8, 18);
    const panel = new THREE.BoxGeometry(2.2, 0.12, 1.4, 1, 1, 1);
    const kinds = [
      { geo: gear,   mat: texMat('metal', 0xffffff, { roughness: 0.45, metalness: 0.8 }), n: 170, s: [0.28, 0.6], cols: [[0.75, 0.62, 0.45], [0.6, 0.62, 0.66], [0.8, 0.5, 0.3]] },
      { geo: barrel, mat: texMat('hull', 0xffffff, { roughness: 0.5, metalness: 0.4 }),   n: 130, s: [0.28, 0.5], cols: [[0.75, 0.3, 0.2], [0.2, 0.4, 0.6], [0.85, 0.7, 0.25], [0.35, 0.5, 0.35]] },
      { geo: tyre,   mat: new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }), n: 100, s: [0.28, 0.52], cols: [[0.12, 0.12, 0.13]] },
      { geo: beam,   mat: texMat('metal', 0xffffff, { roughness: 0.55, metalness: 0.75 }), n: 130, s: [0.22, 0.42], cols: [[0.7, 0.45, 0.3], [0.55, 0.57, 0.6]] },
      { geo: panel,  mat: texMat('hull', 0xffffff, { roughness: 0.55, metalness: 0.35 }), n: 150, s: [0.3, 0.62], cols: [[0.8, 0.82, 0.85], [0.5, 0.55, 0.6], [0.75, 0.6, 0.3]] },
    ];
    this.junk = []; this.junkByCell = new Map();
    const col = new THREE.Color();
    this.junkMeshes = kinds.map((kd, type) => {
      const m = new THREE.InstancedMesh(kd.geo, kd.mat, kd.n);
      m.castShadow = true; m.receiveShadow = true;
      for (let i = 0; i < kd.n; i++) {
        let x = 0, z = 0, c = -1;
        for (let t = 0; t < 30; t++) {
          x = (rnd() - 0.5) * 2 * RADIUS * 0.95; z = (rnd() - 0.5) * 2 * RADIUS * 0.95;
          c = pile.cellAt(x, z);
          if (c >= 0 && pile.counts[c] > 0) break;
        }
        const s = kd.s[0] + rnd() * rnd() * (kd.s[1] - kd.s[0]);
        const d = { x, z, c, s, type, i, rx: (rnd() - 0.5) * 1.1, ry: rnd() * 6.3, rz: (rnd() - 0.5) * 1.1, sink: 0.15 + rnd() * 0.35 };
        if (type === 2) d.rx += Math.PI / 2;                 // tyres lie flat-ish
        if (type === 1 && rnd() < 0.5) d.rz += Math.PI / 2;  // some barrels toppled
        const k = this.junk.length; this.junk.push(d);
        if (!this.junkByCell.has(c)) this.junkByCell.set(c, []);
        this.junkByCell.get(c).push(k);
        const cc = kd.cols[Math.floor(rnd() * kd.cols.length)], g = 0.75 + rnd() * 0.4;
        col.setRGB(cc[0] * g, cc[1] * g, cc[2] * g);
        m.setColorAt(i, col);
      }
      return m;
    });
    for (let k = 0; k < this.junk.length; k++) this.updateJunk(k);
    this.junkMeshes.forEach((m) => this.scene.add(m));
  }

  updateJunk(k) {
    const d = this.junk[k];
    const m = this._jm || (this._jm = new THREE.Matrix4());
    const cnt = d.c >= 0 ? this.pile.counts[d.c] : 0;
    if (cnt < 40) m.makeScale(0, 0, 0);
    else {
      const y = this.pile.heightAt(d.x, d.z);
      m.makeRotationFromEuler(new THREE.Euler(d.rx, d.ry, d.rz));
      m.scale(new THREE.Vector3(d.s, d.s, d.s));
      m.setPosition(d.x, y - d.s * d.sink, d.z);
    }
    this.junkMeshes[d.type].setMatrixAt(d.i, m);
  }

  updateVertex(v) {
    const a = this.vmap[v * 2], b = this.vmap[v * 2 + 1];
    const h = this.pile.vertexHeight(a, b);
    this.geo.attributes.position.setY(v, h);
    // cavity shading: points lower than their surroundings get darker (fake ambient occlusion)
    let ao = 1;
    if (h > 0) {
      const nb = (this.pile.vertexHeight(a - 1, b) + this.pile.vertexHeight(a + 1, b) + this.pile.vertexHeight(a, b - 1) + this.pile.vertexHeight(a, b + 1)) / 4;
      ao = Math.max(0.55, Math.min(1.12, 1 + (h - nb) * 0.9));
    }
    const t = this.tint[v] * ao;
    const col = this.geo.attributes.color;
    if (h < 0) col.setXYZ(v, 0.45 * t, 0.47 * t, 0.5 * t);           // exposed crater floor
    else {
      const k = Math.min(1, h / 12);
      const b = this.theme.base;
      col.setXYZ(v, (b[0] - k * 0.04) * t, (b[1] - k * 0.04) * t, (b[2] - k * 0.02) * t);
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
      m.makeRotationFromEuler(new THREE.Euler(d.rx, d.ry, d.rz));
      m.scale(new THREE.Vector3(d.s, d.type ? d.s : d.s * 0.7, d.s));
      m.setPosition(d.x, y + d.s * 0.3, d.z);
    }
    this.pebMeshes[d.type].setMatrixAt(d.i, m);
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
      const jl = this.junkByCell.get(c);
      if (jl) jl.forEach((k) => this.updateJunk(k));
    }
    this.pebMeshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    this.junkMeshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }

  dispose(scene) {
    scene.remove(this.mesh, this.ringMesh, this.glitter, ...this.pebMeshes, ...this.junkMeshes);
    this.mesh.geometry.dispose();
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

// Tileable detail texture for the heap: rubble speckles, plates and scratches (multiplied with vertex colours).
function scrapDetailTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rnd = mulberry32(99);
  g.fillStyle = '#d8d8d8';
  g.fillRect(0, 0, S, S);
  const wrap = (fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) fn(dx, dy); };
  // blotches
  for (let k = 0; k < 260; k++) {
    const x = rnd() * S, y = rnd() * S, r = 2 + rnd() * 10, v = 150 + rnd() * 105;
    g.fillStyle = `rgb(${v},${v},${v})`;
    wrap((dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill(); });
  }
  // little plates / chunks
  for (let k = 0; k < 120; k++) {
    const x = rnd() * S, y = rnd() * S, w = 3 + rnd() * 12, h = 2 + rnd() * 7, a = rnd() * Math.PI, v = 120 + rnd() * 135;
    wrap((dx, dy) => {
      g.save(); g.translate(x + dx, y + dy); g.rotate(a);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2, h / 2 - 1, w, 1);
      g.restore();
    });
  }
  // scratches
  g.lineWidth = 1;
  for (let k = 0; k < 90; k++) {
    const x = rnd() * S, y = rnd() * S, l = 4 + rnd() * 18, a = rnd() * Math.PI;
    const v = rnd() < 0.5 ? 90 : 250;
    g.strokeStyle = `rgba(${v},${v},${v},0.7)`;
    wrap((dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); });
  }
  // fine grain
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 34;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
