// Progression systems: Nexus level (XP), crafting recipes & consumables, station contracts.
import { FINDS } from './config.js';

// ---------------------------------------------------------------- level / XP
export const xpForLevel = (lv) => Math.round(40 * Math.pow(lv, 1.7));   // XP needed to go from lv to lv+1
export const LEVEL_BONUS = 0.03;   // +3 % find value per level above 1
export const UNLOCKS = {
  crafting: 2,     // Fabrikator
  contracts: 3,    // Aufträge
};

// ---------------------------------------------------------------- consumables & recipes
export const CONSUMABLES = [
  { id: 'bomb',  icon: '💣', name: 'Schrottsprengung', desc: 'Sprengt einen großen Krater in den Haufen vor Nexus.' },
  { id: 'pulse', icon: '📡', name: 'Kernpuls',         desc: 'Markiert 30 Sekunden lang die Gegend, in der der Nexus-Kern liegt.' },
  { id: 'cell',  icon: '⚡', name: 'Turbozelle',       desc: 'Startet sofort einen Turbo – auch während der Abklingzeit.' },
  { id: 'bait',  icon: '🎁', name: 'Kapselköder',      desc: 'Lockt sofort drei Frachtkapseln auf den Haufen.' },
  { id: 'spark', icon: '✨', name: 'Glücksfunke',      desc: 'Löst sofort eine Glückswelle aus.' },
];

// ingredients: find id -> amount; credits: extra cost
export const RECIPES = [
  { out: 'cell',  n: 1, credits: 40,   need: { ice: 8 } },
  { out: 'bomb',  n: 1, credits: 100,  need: { copper: 20, probe: 2 } },
  { out: 'bait',  n: 1, credits: 150,  need: { probe: 4, ice: 4 } },
  { out: 'pulse', n: 1, credits: 600,  need: { datacore: 2, platinum: 1 } },
  { out: 'spark', n: 1, credits: 800,  need: { badge: 1, datacore: 1 } },
];

// ---------------------------------------------------------------- contracts
const DELIVER_POOL = [
  { find: 'copper',   min: 15, max: 45, minLv: 1 },
  { find: 'ice',      min: 6,  max: 18, minLv: 1 },
  { find: 'probe',    min: 2,  max: 6,  minLv: 2 },
  { find: 'datacore', min: 1,  max: 3,  minLv: 4 },
  { find: 'platinum', min: 1,  max: 3,  minLv: 5 },
  { find: 'badge',    min: 1,  max: 1,  minLv: 8 },
];
const TASK_POOL = [
  { kind: 'capsules', label: (n) => `Öffne ${n} Frachtkapseln`,       min: 2, max: 4,  stat: (S) => S.stats.capsules || 0, unit: 260 },
  { kind: 'meteors',  label: (n) => `Sammle ${n} Meteoriten`,          min: 2, max: 5,  stat: (S) => S.stats.meteors || 0, unit: 500 },
  { kind: 'removed',  label: (n) => `Sortiere ${n.toLocaleString('de-DE')} Teile`, min: 1, max: 1, stat: (S) => S.stats.removed, unit: 0 },
  { kind: 'grabs',    label: (n) => `Greife ${n}-mal zu`,              min: 80, max: 200, stat: (S) => S.stats.grabs, unit: 1.2 },
];

export function makeContract(S, rnd = Math.random) {
  const lv = S.level || 1;
  const findById = (id) => FINDS.find((f) => f.id === id);
  if (rnd() < 0.6) {
    const pool = DELIVER_POOL.filter((d) => d.minLv <= lv);
    const d = pool[Math.floor(rnd() * pool.length)];
    const n = d.min + Math.floor(rnd() * (d.max - d.min + 1) * (1 + lv * 0.08));
    const f = findById(d.find);
    return { id: Date.now() + Math.floor(rnd() * 1e6), kind: 'deliver', find: d.find, n, reward: Math.round(n * f.value * 3 + 30), xp: 20 + Math.round(n * f.value / 4) };
  }
  const t = TASK_POOL[Math.floor(rnd() * TASK_POOL.length)];
  let n = t.min + Math.floor(rnd() * (t.max - t.min + 1));
  let reward = Math.round(n * t.unit);
  if (t.kind === 'removed') {
    // scale with the player's current grab power
    const base = Math.max(300, Math.round((S.stats.removed || 0) * 0.15 / 100) * 100);
    n = Math.min(base, 500000);
    reward = Math.round(n * 0.12) + 50;
  }
  return { id: Date.now() + Math.floor(rnd() * 1e6), kind: t.kind, n, start: t.stat(S), reward, xp: 30 + Math.round(reward / 10) };
}

export function contractProgress(S, c) {
  if (c.kind === 'deliver') return Math.min(c.n, (S.vault[c.find] || 0));
  const t = TASK_POOL.find((x) => x.kind === c.kind);
  return Math.min(c.n, t.stat(S) - c.start);
}
export function contractLabel(c) {
  if (c.kind === 'deliver') {
    const f = FINDS.find((x) => x.id === c.find);
    return `Liefere ${c.n.toLocaleString('de-DE')} × ${f.name}`;
  }
  return TASK_POOL.find((x) => x.kind === c.kind).label(c.n);
}
