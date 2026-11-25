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
