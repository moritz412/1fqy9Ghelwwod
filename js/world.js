// Voxel-Welt: Daten, Generierung, Chunk-Meshing, Graben, Sandphysik, Raycast.
import * as THREE from 'three';
import { makeRng, hash3, fbm3 } from './noise.js';

export const M = {
  AIR: 0, SAND: 1, DUNE: 2, EARTH: 3, CLAY: 4, STONE: 5, BASALT: 6,
  BEDROCK: 7, GEM: 8, FOSSIL: 9, STAR: 10, AMBER: 11,
};

// hard: benötigte Werkzeugkraft · falls: rieselt wie Sand · glow: unbeleuchtet hell
export const MATS = [
  null,
  { name: 'Sand',          color: 0xeac07a, hard: 1, falls: true },
  { name: 'Dünensand',     color: 0xdca35a, hard: 1, falls: true },
  { name: 'Erde',          color: 0x8e5d3a, hard: 1 },
  { name: 'Lehm',          color: 0xb8653a, hard: 2 },
  { name: 'Stein',         color: 0x7f838e, hard: 3 },
  { name: 'Basalt',        color: 0x44465a, hard: 4 },
  { name: 'Grundgestein',  color: 0x1f1d28, hard: 99 },
  { name: 'Edelstein',     color: 0x41dcff, hard: 1, glow: true },
  { name: 'Fossil',        color: 0xf3e7cb, hard: 1 },
  { name: 'Sternsplitter', color: 0xffd23a, hard: 99, glow: true },
  { name: 'Bernstein',     color: 0xff9d1e, hard: 1, glow: true },
];

export const CHUNK = 16;

const FACES = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { dir: [1, 0, 0],  corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { dir: [0, 1, 0],  corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, 0, 1],  corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] },
];
const AO_LEVELS = [0.52, 0.7, 0.86, 1.0];
// Seitenflächen etwas dunkler – betont den Schichten-Look
const FACE_SHADE = [0.86, 0.86, 0.6, 1.0, 0.78, 0.92];

export class World {
  /**
   * @param {object} p  Parameter (siehe levels.js)
   */
  constructor(p) {
    this.p = p;
    this.W = p.W; this.H = p.H; this.D = p.D;
    this.vox = new Uint8Array(this.W * this.H * this.D);
    this.dmg = new Uint8Array(this.W * this.H * this.D);
    this.group = new THREE.Group();
    this.group.position.set(-this.W / 2, 0, -this.D / 2);
    this.chunks = new Map();
    this.dirty = new Set();
    this.sandActive = false;
    this.seed = p.seed | 0;
    this.star = null;
    this.matSolid = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.matGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.generate();
    this.buildAll();
  }

  idx(x, y, z) { return x + this.W * (z + this.D * y); }
  inside(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.W && y < this.H && z < this.D;
  }
  get(x, y, z) { return this.inside(x, y, z) ? this.vox[this.idx(x, y, z)] : M.AIR; }
  solid(x, y, z) { return this.get(x, y, z) !== M.AIR; }
  set(x, y, z, v) {
    const i = this.idx(x, y, z);
    this.vox[i] = v;
    this.dmg[i] = 0;
    this.markDirty(x, y, z);
  }
  markDirty(x, y, z) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(`${cx},${cy},${cz}`);
    // Nachbar-Chunks bei Randvoxeln (Flächen + AO)
    const lx = x - cx * CHUNK, ly = y - cy * CHUNK, lz = z - cz * CHUNK;
    if (lx === 0) this.dirty.add(`${cx - 1},${cy},${cz}`);
    if (lx === CHUNK - 1) this.dirty.add(`${cx + 1},${cy},${cz}`);
    if (ly === 0) this.dirty.add(`${cx},${cy - 1},${cz}`);
    if (ly === CHUNK - 1) this.dirty.add(`${cx},${cy + 1},${cz}`);
    if (lz === 0) this.dirty.add(`${cx},${cy},${cz - 1}`);
    if (lz === CHUNK - 1) this.dirty.add(`${cx},${cy},${cz + 1}`);
  }

  surfaceHeight(x, z) {
    const p = this.p;
    const n = fbm3(x * 0.07, 0, z * 0.07, this.seed + 7, 3);
    return Math.max(4, Math.min(this.H - 1, Math.round(p.surface + (n - 0.5) * 2 * p.duneAmp)));
  }

  // ---------- Generierung ----------
  generate() {
    const { W, H, D, p } = this;
    const rng = makeRng(this.seed * 9973 + 17);
    const L = p.layers; // Grenzen (Tiefe unter Oberfläche): [sand, erde, lehm, stein]
    this.heights = new Int16Array(W * D);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const h = this.surfaceHeight(x, z);
      this.heights[x + z * W] = h;
      for (let y = 0; y < H; y++) {
        if (y > h) continue;
        let m;
        const d = h - y;
        const wob = (fbm3(x * 0.15, y * 0.15, z * 0.15, this.seed + 3, 2) - 0.5) * 5;
        const dd = d + wob;
        if (y === 0) m = M.BEDROCK;
        else if (dd < L[0]) m = (hash3(x, y, z, this.seed) < 0.35 || (d < 2 && ((x + Math.floor(z * 0.5)) % 4 === 0))) ? M.DUNE : M.SAND;
        else if (dd < L[1]) m = M.EARTH;
        else if (dd < L[2]) m = M.CLAY;
        else if (dd < L[3]) m = M.STONE;
        else m = M.BASALT;

        // Höhlen in der Tiefe
        if (p.caves && d > L[1] && y > 2 && fbm3(x * 0.12, y * 0.16, z * 0.12, this.seed + 11, 2) > 0.7) m = M.AIR;

        if (m !== M.AIR && m !== M.BEDROCK && d > 3) {
          const r = rng();
          if (m >= M.CLAY && r < p.gemRate) m = M.GEM;
          else if ((m === M.EARTH || m === M.CLAY) && r < p.gemRate + p.fossilRate) m = M.FOSSIL;
          else if (m === M.SAND && d > 4 && r < p.amberRate) m = M.AMBER;
        }
        this.vox[this.idx(x, y, z)] = m;
      }
    }

    // Sternsplitter platzieren
    if (p.hasStar) {
      const margin = Math.min(3, Math.floor(W / 4));
      const sx = margin + Math.floor(rng() * (W - 2 * margin));
      const sz = margin + Math.floor(rng() * (D - 2 * margin));
      const h = this.heights[sx + sz * W];
      const depth = p.starDepth[0] + Math.floor(rng() * (p.starDepth[1] - p.starDepth[0] + 1));
      const sy = Math.max(2, h - depth);
      // Umgebung füllen, damit der Splitter nicht schon in einer Höhle offen liegt
      for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = sx + dx, y = sy + dy, z = sz + dz;
        if (this.inside(x, y, z) && this.get(x, y, z) === M.AIR) this.vox[this.idx(x, y, z)] = M.STONE;
      }
      this.vox[this.idx(sx, sy, sz)] = M.STAR;
      this.star = { x: sx, y: sy, z: sz };
    }
    this.topY = Math.max(...this.heights) + 1;
  }

  starExposed() {
    if (!this.star) return false;
    const { x, y, z } = this.star;
    for (const f of FACES) {
      const [dx, dy, dz] = f.dir;
      if (this.get(x + dx, y + dy, z + dz) === M.AIR) return true;
    }
    return false;
  }

  // ---------- Meshing ----------
  buildAll() {
    const nx = Math.ceil(this.W / CHUNK), ny = Math.ceil(this.H / CHUNK), nz = Math.ceil(this.D / CHUNK);
    for (let cy = 0; cy < ny; cy++) for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) {
      this.dirty.add(`${cx},${cy},${cz}`);
    }
    this.flush();
  }

  flush() {
    for (const key of this.dirty) {
      const [cx, cy, cz] = key.split(',').map(Number);
      if (cx < 0 || cy < 0 || cz < 0 || cx * CHUNK >= this.W || cy * CHUNK >= this.H || cz * CHUNK >= this.D) continue;
      this.meshChunk(cx, cy, cz, key);
    }
    this.dirty.clear();
  }

  meshChunk(cx, cy, cz, key) {
    const solid = { pos: [], nor: [], col: [], idx: [] };
    const glow = { pos: [], nor: [], col: [], idx: [] };
    const col = new THREE.Color();
    const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;
    const x1 = Math.min(this.W, x0 + CHUNK), y1 = Math.min(this.H, y0 + CHUNK), z1 = Math.min(this.D, z0 + CHUNK);

    for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const i = this.idx(x, y, z);
      const m = this.vox[i];
      if (m === M.AIR) continue;
      const mat = MATS[m];
      const target = mat.glow ? glow : solid;
      const jitter = 0.9 + 0.12 * hash3(x, y, z, 99);
      const crack = this.dmg[i] ? 0.72 - 0.08 * this.dmg[i] : 1;
      for (let f = 0; f < 6; f++) {
        const face = FACES[f];
        const [dx, dy, dz] = face.dir;
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (this.solid(nx, ny, nz)) continue;
        // Boden der Welt nie zeichnen
        if (ny < 0) continue;
        const base = target.pos.length / 3;
        const ao = [];
        for (const c of face.corners) {
          target.pos.push(x + c[0], y + c[1], z + c[2]);
          target.nor.push(dx, dy, dz);
          // Ambient Occlusion: Nachbarn in der Ebene vor der Fläche prüfen
          const o = [];
          for (let a = 0; a < 3; a++) o.push(face.dir[a] !== 0 ? 0 : (c[a] ? 1 : -1));
          let s1, s2, cn;
          if (dx !== 0) {
            s1 = this.solid(nx, ny + o[1], nz); s2 = this.solid(nx, ny, nz + o[2]); cn = this.solid(nx, ny + o[1], nz + o[2]);
          } else if (dy !== 0) {
            s1 = this.solid(nx + o[0], ny, nz); s2 = this.solid(nx, ny, nz + o[2]); cn = this.solid(nx + o[0], ny, nz + o[2]);
          } else {
            s1 = this.solid(nx + o[0], ny, nz); s2 = this.solid(nx, ny + o[1], nz); cn = this.solid(nx + o[0], ny + o[1], nz);
          }
          const a = (s1 && s2) ? 0 : 3 - (s1 + s2 + cn);
          ao.push(a);
          const shade = mat.glow ? 1 : AO_LEVELS[a] * FACE_SHADE[f] * jitter * crack;
          col.setHex(mat.color);
          target.col.push(col.r * shade, col.g * shade, col.b * shade);
        }
        if (ao[0] + ao[3] > ao[1] + ao[2]) {
          target.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
        } else {
          target.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }

    let entry = this.chunks.get(key);
    if (!entry) {
      entry = {
        solid: new THREE.Mesh(new THREE.BufferGeometry(), this.matSolid),
        glow: new THREE.Mesh(new THREE.BufferGeometry(), this.matGlow),
      };
      this.group.add(entry.solid, entry.glow);
      this.chunks.set(key, entry);
    }
    this.fillGeom(entry.solid, solid);
    this.fillGeom(entry.glow, glow);
  }

  fillGeom(mesh, d) {
    const g = new THREE.BufferGeometry();
    if (d.pos.length) {
      g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(d.col, 3));
      g.setIndex(d.idx);
      g.computeBoundingSphere();
    }
    mesh.geometry.dispose();
    mesh.geometry = g;
    mesh.visible = d.pos.length > 0;
  }

  // ---------- Graben ----------
  /**
   * Gräbt eine Kugel. Liefert entfernte Voxel (für Partikel/Funde).
   */
  digSphere(cx, cy, cz, r, power, out = []) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (!this.inside(x, y, z)) continue;
          const ddx = x + 0.5 - cx, ddy = y + 0.5 - cy, ddz = z + 0.5 - cz;
          if (ddx * ddx + ddy * ddy + ddz * ddz > r2) continue;
          const i = this.idx(x, y, z);
          const m = this.vox[i];
          if (m === M.AIR) continue;
          const hard = MATS[m].hard;
          if (hard >= 99) continue;
          if (power + this.dmg[i] >= hard) {
            out.push({ x, y, z, m });
            this.set(x, y, z, M.AIR);
          } else {
            this.dmg[i]++;
            this.markDirty(x, y, z);
            out.push({ x, y, z, m, cracked: true });
          }
        }
    this.sandActive = true;
    return out;
  }

  /** Tunnel entlang einer Richtung (Bohrer) */
  digTunnel(start, dir, length, r, power) {
    const out = [];
    const step = r * 0.8;
    for (let t = 0; t <= length; t += step) {
      this.digSphere(start.x + dir.x * t, start.y + dir.y * t, start.z + dir.z * t, r, power, out);
    }
    return out;
  }

  // ---------- Sandphysik ----------
  /** Ein Schritt rieselnder Sand. Gibt true zurück, wenn sich etwas bewegt hat. */
  stepSand(rng) {
    if (!this.sandActive) return false;
    const { W, H, D } = this;
    let moved = false;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 1; y < H; y++) {
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        const i = this.idx(x, y, z);
        const m = this.vox[i];
        if (m === M.AIR || !MATS[m].falls) continue;
        if (this.vox[i - W * D] === M.AIR) {
          this.move(x, y, z, x, y - 1, z, m);
          moved = true;
          continue;
        }
        // seitlich abrutschen (Schüttwinkel)
        const k = Math.floor(rng() * 4);
        for (let j = 0; j < 4; j++) {
          const [ox, oz] = dirs[(k + j) & 3];
          const ax = x + ox, az = z + oz;
          if (!this.inside(ax, y, az)) continue;
          if (this.get(ax, y, az) === M.AIR && this.get(ax, y - 1, az) === M.AIR && rng() < 0.6) {
            this.move(x, y, z, ax, y - 1, az, m);
            moved = true;
            break;
          }
        }
      }
    }
    if (!moved) this.sandActive = false;
    return moved;
  }

  move(x, y, z, x2, y2, z2, m) {
    this.set(x, y, z, M.AIR);
    this.set(x2, y2, z2, m);
  }

  // ---------- Raycast (Voxel-DDA) ----------
  /** origin/dir in Welt-Koordinaten. Liefert {x,y,z,normal,point} oder null. */
  raycast(origin, dir, maxDist = 300) {
    const o = origin.clone().sub(this.group.position);
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = sx !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tdy = sy !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tdz = sz !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tmx = sx > 0 ? (x + 1 - o.x) * tdx : sx < 0 ? (o.x - x) * tdx : Infinity;
    let tmy = sy > 0 ? (y + 1 - o.y) * tdy : sy < 0 ? (o.y - y) * tdy : Infinity;
    let tmz = sz > 0 ? (z + 1 - o.z) * tdz : sz < 0 ? (o.z - z) * tdz : Infinity;
    let t = 0;
    const normal = new THREE.Vector3();
    while (t < maxDist) {
      if (this.inside(x, y, z) && this.vox[this.idx(x, y, z)] !== M.AIR) {
        const point = o.clone().addScaledVector(dir, t);
        return { x, y, z, normal: normal.clone(), point, m: this.vox[this.idx(x, y, z)] };
      }
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; normal.set(-sx, 0, 0); }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; normal.set(0, -sy, 0); }
      else { z += sz; t = tmz; tmz += tdz; normal.set(0, 0, -sz); }
    }
    return null;
  }

  dispose() {
    for (const e of this.chunks.values()) { e.solid.geometry.dispose(); e.glow.geometry.dispose(); }
    this.matSolid.dispose(); this.matGlow.dispose();
  }
}
