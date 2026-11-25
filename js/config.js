// Game balance & content. All numbers in one place so they are easy to tune.

export const TOTAL_STONES = 5_000_000;

export const PILE = {
  N: 64,            // cells per side
  CELL: 0.5,        // metres per cell
  H_PER: 0.004,     // metres of height per stone
  RADIUS: 15.5,     // metres
  MAX_SLOPE: 150,   // max stone difference between neighbouring cells before it slides
};

export const WORLD = {
  craterFloor: 24,  // radius of flat crater floor
  botLimit: 29.5,
  dock: { x: 0, z: 19.5, r: 2.4 },
  gravity: 2.2,     // low artificial gravity on the deck
};

// Finds rolled per removed stone (rate = probability per stone).
export const FINDS = [
  { id: 'copper',   name: 'Kupferspule',        rate: 1 / 15,     value: 2,     color: '#ff9a5c' },
  { id: 'ice',      name: 'Eiskristall',        rate: 1 / 120,    value: 8,     color: '#9ff3ff' },
  { id: 'probe',    name: 'Sondenteil',         rate: 1 / 1500,   value: 60,    color: '#d6dbe6' },
  { id: 'platinum', name: 'Platin-Nugget',      rate: 1 / 8000,   value: 300,   color: '#e8ecf5' },
  { id: 'badge',    name: 'Pilotenabzeichen',   rate: 1 / 40000,  value: 1500,  color: '#7cf0b0' },
  { id: 'artifact', name: 'Alien-Artefakt',     rate: 1 / 400000, value: 20000, color: '#e58cff' },
];

// Nexus-Bot upgrades. Each track has levels; level 0 is the starting state.
export const BOT_UPGRADES = {
  hands: {
    title: 'Greifhände', unit: 'Teile pro Griff',
    levels: [
      { name: 'Standardhände',      value: 1,    cost: 0 },
      { name: 'Krallenhände',       value: 5,    cost: 20 },
      { name: 'Schaufelhände',      value: 25,   cost: 220 },
      { name: 'Schubschild',        value: 120,  cost: 2000 },
      { name: 'Gravitationsgreifer',value: 600,  cost: 25000 },
      { name: 'Nexus-Kran',         value: 3000, cost: 200000 },
    ],
  },
  speed: {
    title: 'Greiftempo', unit: 'Griffe pro Sekunde',
    levels: [
      { name: 'Servo I',   value: 3,   cost: 0 },
      { name: 'Servo II',  value: 4,   cost: 45 },
      { name: 'Servo III', value: 5.5, cost: 900 },
      { name: 'Servo IV',  value: 6.5, cost: 15000 },
      { name: 'Servo X',   value: 9,   cost: 120000 },
    ],
  },
  drive: {
    title: 'Antrieb', unit: 'm/s',
    levels: [
      { name: 'Raupen',        value: 3,   cost: 0 },
      { name: 'Sportraupen',   value: 4.5, cost: 120 },
      { name: 'Schwebeketten', value: 6.5, cost: 4000 },
      { name: 'Ionen-Gleiter', value: 9,   cost: 40000 },
    ],
  },
  cargo: {
    title: 'Laderaum', unit: 'Funde',
    levels: [
      { name: 'Brustfach',        value: 20,     cost: 0 },
      { name: 'Rucksack',         value: 100,    cost: 60 },
      { name: 'Frachtmodul',      value: 600,    cost: 2000 },
      { name: 'Containerrücken',  value: 4000,   cost: 20000 },
      { name: 'Taschendimension', value: 40000,  cost: 180000 },
    ],
  },
  scanner: {
    title: 'Kern-Scanner', unit: '',
    levels: [
      { name: 'Kein Scanner',     value: 0, cost: 0,      desc: 'Der Kern leuchtet nur auf, wenn er fast an der Oberfläche liegt.' },
      { name: 'Glitzerfilter',    value: 1, cost: 500,    desc: 'Das Leuchten des Kerns ist durch viel mehr Schrott hindurch zu sehen.' },
      { name: 'Resonanzscanner',  value: 2, cost: 12000,  desc: 'Anzeige heiß/kalt: Wie nah ist der Bot am Nexus-Kern?' },
      { name: 'Tiefenscanner',    value: 3, cost: 150000, desc: 'Zeigt zusätzlich, wie viele Teile noch über dem Kern liegen.' },
    ],
  },
  link: {
    title: 'Nexus-Link', unit: '',
    levels: [
      { name: 'Kein Link',  value: 0, cost: 0,     desc: 'Funde müssen zum Dock gebracht werden.' },
      { name: 'Nexus-Link', value: 1, cost: 60000, desc: 'Funde werden sofort zur Station gebeamt und verkauft.' },
    ],
  },
};

// Automation helpers (buy many; price grows per unit).
export const HELPERS = [
  { id: 'mini',   name: 'Mini-Nexus',        rate: 2,    cost: 80,     desc: 'Kleiner Helfer-Bot, sortiert mit.' },
  { id: 'drone',  name: 'Staubdrohne',       rate: 15,   cost: 2000,    desc: 'Saugt von oben, fliegt über den Haufen.' },
  { id: 'belt',   name: 'Förderband',        rate: 80,   cost: 20000,   desc: 'Schießt Schrott in den Recycler.' },
  { id: 'drill',  name: 'Kraterfräse',       rate: 500,  cost: 150000,  desc: 'Großer Bohrer, frisst sich durch.' },
  { id: 'orbit',  name: 'Orbit-Kran',        rate: 3000, cost: 1000000, desc: 'Greifarme vom Stationsring.' },
];
export const HELPER_COST_GROWTH = 1.15;

export function helperCost(h, owned) {
  return Math.round(h.cost * Math.pow(HELPER_COST_GROWTH, owned));
}

// Beginner's luck: the first grabs find much more, so the first upgrade comes quickly.
export const LUCK = { grabs: 60, factor: 3 };

export const fmt = (n) => Math.floor(n).toLocaleString('de-DE');

// Cosmetic skins for the Nexus-Bot.
export const SKINS = [
  { id: 'classic',  name: 'Klassik',      cost: 0,      body: 0xf3f4f2, ear: 0x2fc9a8, glow: 0x6ff3f0 },
  { id: 'night',    name: 'Mitternacht',  cost: 400,    body: 0x2b2f3a, ear: 0x6ff3f0, glow: 0x6ff3f0 },
  { id: 'coral',    name: 'Koralle',      cost: 1500,   body: 0xffd9cf, ear: 0xff6f61, glow: 0xffb3a7 },
  { id: 'mint',     name: 'Minze',        cost: 6000,   body: 0xd8fff0, ear: 0x1f9e86, glow: 0x7cf0b0 },
  { id: 'gold',     name: 'Sonnengold',   cost: 40000,  body: 0xffd36a, ear: 0xb8860b, glow: 0xfff2b0, metal: true },
  { id: 'holo',     name: 'Hologramm',    cost: 250000, body: 0x9ff8ff, ear: 0xb48cff, glow: 0xe58cff, holo: true },
];

// Achievements: checked regularly; reward in credits.
export const ACHIEVEMENTS = [
  { id: 'first',    name: 'Erster Griff',        desc: 'Sortiere dein erstes Schrottteil.',        check: (s) => s.stats.removed >= 1,        reward: 5 },
  { id: 'k1',       name: 'Tausendsassa',        desc: 'Sortiere 1.000 Teile.',                    check: (s) => s.stats.removed >= 1e3,      reward: 50 },
  { id: 'k10',      name: 'Schrottprofi',        desc: 'Sortiere 10.000 Teile.',                   check: (s) => s.stats.removed >= 1e4,      reward: 300 },
  { id: 'k100',     name: 'Aufräum-Maschine',    desc: 'Sortiere 100.000 Teile.',                  check: (s) => s.stats.removed >= 1e5,      reward: 3000 },
  { id: 'm1',       name: 'Millionär',           desc: 'Sortiere 1.000.000 Teile.',                check: (s) => s.stats.removed >= 1e6,      reward: 40000 },
  { id: 'clean',    name: 'Blitzblankes Deck',   desc: 'Räume alle 5.000.000 Teile weg.',          check: (s) => s.stats.removed >= 5e6,      reward: 500000 },
  { id: 'sell',     name: 'Erste Lieferung',     desc: 'Verkaufe Funde am Nexus-Markt.',           check: (s) => s.stats.earned >= 1,         reward: 10 },
  { id: 'rich',     name: 'Credit-Sammler',      desc: 'Verdiene insgesamt 10.000 ⬡.',             check: (s) => s.stats.earned >= 1e4,       reward: 1000 },
  { id: 'badge',    name: 'Abzeichen-Jäger',     desc: 'Finde ein Pilotenabzeichen.',              check: (s) => (s.stats.found.badge || 0) >= 1, reward: 500 },
  { id: 'artifact', name: 'Erstkontakt',         desc: 'Finde ein Alien-Artefakt.',                check: (s) => (s.stats.found.artifact || 0) >= 1, reward: 5000 },
  { id: 'capsule',  name: 'Kapselknacker',       desc: 'Öffne 10 Frachtkapseln.',                  check: (s) => (s.stats.capsules || 0) >= 10, reward: 800 },
  { id: 'helper',   name: 'Teamwork',            desc: 'Kaufe deinen ersten Helfer.',              check: (s) => Object.values(s.helpers).some((n) => n > 0), reward: 40 },
  { id: 'army',     name: 'Helfer-Armee',        desc: 'Besitze 25 Helfer.',                       check: (s) => Object.values(s.helpers).reduce((a, b) => a + b, 0) >= 25, reward: 8000 },
  { id: 'maxhands', name: 'Nexus-Kran',          desc: 'Rüste die Greifhände voll aus.',           check: (s) => s.levels.hands >= 5,         reward: 50000 },
  { id: 'style',    name: 'Stilbewusst',         desc: 'Kaufe einen neuen Skin.',                  check: (s) => (s.skins || []).length > 1,  reward: 100 },
  { id: 'core',     name: 'Herz der Station',    desc: 'Finde den Nexus-Kern.',                    check: (s) => s.coreFound,                 reward: 20000 },
];

export const CAPSULE = { max: 3, respawn: 40, reach: 2.6 };

// Decks (prestige): after finding the core you can move on to the next deck.
// Each star = +25 % find value and +10 % helper speed, permanently.
export const DECKS = [
  { name: 'Hangardeck 7',  title: 'Schrottberg',     base: [0.24, 0.22, 0.21], pebbles: [[1.9, 0.9, 0.5], [1.6, 1.1, 0.6], [1.4, 1.5, 1.65], [1.05, 1, 0.95]] },
  { name: 'Kühldeck 3',    title: 'Eiswrack',        base: [0.3, 0.36, 0.43],  pebbles: [[1.6, 2.1, 2.6], [2.2, 2.4, 2.6], [1.2, 1.5, 2.0], [1.4, 1.6, 1.8]] },
  { name: 'Frachtdeck 12', title: 'Goldmine',        base: [0.33, 0.26, 0.16], pebbles: [[2.6, 2.0, 0.7], [2.2, 1.4, 0.5], [1.6, 1.4, 1.2], [1.2, 0.9, 0.6]] },
  { name: 'Labordeck X',   title: 'Alienschrott',    base: [0.2, 0.17, 0.26],  pebbles: [[1.4, 0.8, 2.4], [0.7, 2.2, 1.3], [1.9, 1.0, 1.9], [1.0, 1.0, 1.2]] },
];
export const STAR_BONUS = { finds: 0.25, helpers: 0.1 };
export const TURBO = { duration: 8, cooldown: 40, factor: 2.5 };
