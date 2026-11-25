// Voxel world: data, procedural generation, visibility rules.
import { mulberry32, makeNoise3 } from './noise.js';

export const T = {
  AIR: 0, SAND: 1, CLAY: 2, RUIN: 3, STONE: 4, BASALT: 5,
  COIN: 6, RELIC: 7, FOSSIL: 8, CRYSTAL: 9,
};

export const INFO = {
  [T.SAND]:    { name: 'Dünensand',      hp: 1, color: 0xe8c27a },
  [T.CLAY]:    { name: 'Karawanen-Lehm', hp: 2, color: 0xc98a4b },
  [T.RUIN]:    { name: 'Bronze-Ruinen',  hp: 3, color: 0xb0583c },
  [T.STONE]:   { name: 'Urstein',        hp: 4, color: 0x7d8a99 },
  [T.BASALT]:  { name: 'Glutbasalt',     hp: 6, color: 0x5a2b2b },
  [T.COIN]:    { name: 'Händlermünze',   hp: 1, color: 0xffd34d, item: true },
  [T.RELIC]:   { name: 'Bronze-Relikt',  hp: 2, color: 0x3fbfa4, item: true },
  [T.FOSSIL]:  { name: 'Fossil',         hp: 2, color: 0xf4ecd8, item: true },
  [T.CRYSTAL]: { name: 'Zeitkristall',   hp: 1, color: 0x66e6ff, item: true },
};

export const LAYER_NAMES = [
  [0, 'Dünensand'], [4, 'Karawanen-Lehm'], [10, 'Bronze-Ruinen'],
  [18, 'Urstein'], [28, 'Glutbasalt'],
];

export function layerName(d) {
  let n = LAYER_NAMES[0][1];
  for (const [min, name] of LAYER_NAMES) if (d >= min) n = name;
  return n;
}

export function levelParams(level) {
  const W = Math.min(10 + level * 2, 20);
  const H = Math.min(18 + level * 6, 60);
  return {
    W, D: W, H,
    stamina: 55 + level * 30,
    bombs: 1 + Math.floor(level / 2),
  };
}

export class World {
  constructor(level, seed) {
    const p = levelParams(level);
    this.level = level;
    this.W = p.W; this.D = p.D; this.H = p.H;
    const n = this.W * this.D * this.H;
    this.type = new Uint8Array(n);
    this.host = new Uint8Array(n);   // material shown while an item is hidden
    this.hp = new Float32Array(n);
    this.shade = new Float32Array(n); // per-block color variation
    this.generate(seed);
  }

  idx(x, d, z) { return x + z * this.W + d * this.W * this.D; }
  inside(x, d, z) { return x >= 0 && z >= 0 && d >= 0 && x < this.W && z < this.D && d < this.H; }
  get(x, d, z) { return this.inside(x, d, z) ? this.type[this.idx(x, d, z)] : -1; }
  coords(i) {
    const x = i % this.W;
    const z = Math.floor(i / this.W) % this.D;
    const d = Math.floor(i / (this.W * this.D));
    return [x, d, z];
  }

  generate(seed) {
    const rnd = mulberry32(seed);
    const noise = makeNoise3(seed * 7 + 13);
    const { W, D, H } = this;
    for (let d = 0; d < H; d++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const i = this.idx(x, d, z);
      const e = d + (noise(x * 0.22, d * 0.18, z * 0.22) - 0.5) * 5;
      let t = T.SAND;
      if (e >= 4) t = T.CLAY;
      if (e >= 10) t = T.RUIN;
      if (e >= 18) t = T.STONE;
      if (e >= 28) t = T.BASALT;
      this.host[i] = t;
      const r = rnd();
      let item = 0;
      if (t === T.CLAY && r < 0.025) item = T.COIN;
      else if (t === T.CLAY && r < 0.032) item = T.FOSSIL;
      else if (t === T.RUIN && r < 0.018) item = T.RELIC;
      else if (t === T.RUIN && r < 0.03) item = T.COIN;
      else if ((t === T.STONE || t === T.BASALT) && r < 0.03) item = T.FOSSIL;
      else if ((t === T.STONE || t === T.BASALT) && r < 0.04) item = T.RELIC;
      this.type[i] = item || t;
      this.hp[i] = INFO[this.type[i]].hp;
      this.shade[i] = 0.9 + rnd() * 0.2;
    }
    // The needle: one crystal, away from the walls, at a level-dependent depth.
    const minD = Math.floor(H * 0.3), maxD = Math.floor(H * 0.75);
    const cx = 2 + Math.floor(rnd() * (W - 4));
    const cz = 2 + Math.floor(rnd() * (D - 4));
    const cd = minD + Math.floor(rnd() * (maxD - minD + 1));
    const ci = this.idx(cx, cd, cz);
    this.type[ci] = T.CRYSTAL;
    this.hp[ci] = INFO[T.CRYSTAL].hp;
    this.crystal = { x: cx, d: cd, z: cz, i: ci };
  }

  touchesAir(x, d, z) {
    return this.get(x + 1, d, z) === 0 || this.get(x - 1, d, z) === 0 ||
           this.get(x, d + 1, z) === 0 || this.get(x, d - 1, z) === 0 ||
           this.get(x, d, z + 1) === 0 || this.get(x, d, z - 1) === 0;
  }

  touchesOutside(x, d, z) {
    return x === 0 || z === 0 || x === this.W - 1 || z === this.D - 1 || d === 0 || d === this.H - 1;
  }

  // Items are only recognisable once a neighbour has been dug out.
  revealed(x, d, z) { return this.touchesAir(x, d, z); }

  diggable(x, d, z, cut) {
    const t = this.get(x, d, z);
    if (t <= 0 || d < cut) return false;
    return d === 0 || this.touchesAir(x, d, z);
  }

  visible(x, d, z, cut) {
    const t = this.get(x, d, z);
    if (t <= 0 || d < cut) return false;
    return d === cut || this.touchesOutside(x, d, z) || this.touchesAir(x, d, z);
  }

  remove(x, d, z) { this.type[this.idx(x, d, z)] = T.AIR; }

  distToCrystal(x, d, z) {
    const c = this.crystal;
    return Math.hypot(x - c.x, d - c.d, z - c.z);
  }
}
