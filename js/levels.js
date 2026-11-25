// Level-Definitionen für beide Spielmodi.

export const TOOLS = {
  shovel:   { id: 'shovel',   name: 'Schaufel', icon: '🪏', cost: 1, radius: 1.7, power: 2 },
  drill:    { id: 'drill',    name: 'Bohrer',   icon: '🔩', cost: 2, radius: 0.85, power: 4, length: 5 },
  dynamite: { id: 'dynamite', name: 'Dynamit',  icon: '🧨', cost: 0, radius: 3.3, power: 5 },
  sonar:    { id: 'sonar',    name: 'Sonar',    icon: '📡', cost: 3 },
};

export const MAX_LEVEL = 20;

/** Sternsuche – Level n (1-basiert) */
export function starLevel(n) {
  const size = Math.min(16 + 2 * n, 36);
  const H = Math.min(26 + 3 * n, 64);
  const surface = H - 5;
  const minD = Math.min(4 + 2 * n, surface - 6);
  const maxD = Math.min(8 + 3 * n, surface - 3);
  return {
    mode: 'star',
    level: n,
    seed: 1000 + n * 7919,
    W: size, D: size, H,
    surface, duneAmp: 2 + Math.min(n, 4),
    layers: [5, 11, 18, 27].map((v) => v * (1 + n * 0.04)),
    caves: n >= 3,
    gemRate: 0.006,
    fossilRate: 0.004,
    amberRate: 0.003,
    hasStar: true,
    starDepth: [minD, maxD],
    energy: 22 + 4 * n,
    dynamite: 1 + Math.floor(n / 3),
  };
}

/** Tiefenrausch – möglichst tief graben */
export function deepLevel(seed = Date.now() % 100000) {
  const H = 128;
  return {
    mode: 'deep',
    level: 0,
    seed,
    W: 13, D: 13, H,
    surface: H - 4, duneAmp: 2,
    layers: [10, 26, 46, 76],
    caves: false,
    gemRate: 0.016,
    fossilRate: 0.006,
    amberRate: 0.01,
    hasStar: false,
    starDepth: [0, 0],
    energy: 30,
    dynamite: 2,
  };
}
