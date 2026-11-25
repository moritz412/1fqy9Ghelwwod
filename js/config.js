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
  dock: { x: 0, z: 19.5, r: 2.4 },     // Nexus-Ablage (sell)
  shop: { x: -19.5, z: 0, r: 2.4 },    // Nexus-Shop (buy)
  pad: { x: 16.7, z: 19.9, r: 3.2 },   // landing pad for the lander
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
  { id: 'datacore', name: 'Datenkern',          rate: 1 / 3000,   value: 120,   color: '#7fb8ff' },
  { id: 'graviton', name: 'Gravitonperle',      rate: 1 / 150000, value: 6000,  color: '#ffe27a' },
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
      { name: 'Nexus-Link', value: 1, cost: 350000, desc: 'Funde werden sofort zur Station gebeamt und verkauft – mit 25 % Transportgebühr.' },
    ],
  },
};

// Automation helpers (buy many; price grows per unit).
export const HELPERS = [
  { id: 'mini',   name: 'Atomar Funke',    rate: 2,    cost: 80,      desc: 'Kleinste Atomar-Drohne, sortiert fleißig mit.' },
  { id: 'drone',  name: 'Atomar Sauger',   rate: 15,   cost: 2000,    desc: 'Saugt Schrott von oben weg.' },
  { id: 'belt',   name: 'Atomar Träger',   rate: 80,   cost: 20000,   desc: 'Schwerlast-Drohne, trägt ganze Stapel.' },
  { id: 'drill',  name: 'Atomar Fräse',    rate: 500,  cost: 150000,  desc: 'Bohrt sich mit Atomkraft durch den Berg.' },
  { id: 'orbit',  name: 'Atomar Orbital',  rate: 3000, cost: 1000000, desc: 'Riesen-Drohne direkt vom Stationsring.' },
];
// Atomar core: multiplies the speed of all Atomar drones.
export const ATOMAR_CORE = [
  { name: 'Atomar-Kern I',   mult: 1,    cost: 0 },
  { name: 'Atomar-Kern II',  mult: 1.25, cost: 1200 },
  { name: 'Atomar-Kern III', mult: 1.6,  cost: 15000 },
  { name: 'Atomar-Kern IV',  mult: 2.2,  cost: 150000 },
  { name: 'Atomar-Kern V',   mult: 3.2,  cost: 1200000 },
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
  { id: 'wheels',   name: 'Fahrgestell-Fan',     desc: 'Kaufe ein zweites Fahrwerk.',              check: (s) => (s.chassisOwned || []).length >= 2, reward: 100 },
  { id: 'spider',   name: 'Spinnenbot',          desc: 'Kaufe die Spinnenbeine.',                  check: (s) => (s.chassisOwned || []).includes('spider'), reward: 6000 },
  { id: 'toolbox',  name: 'Werkzeugkasten',      desc: 'Kaufe alle drei Werkzeuge.',               check: (s) => (s.toolsOwned || []).length >= 4, reward: 5000 },
  { id: 'builder',  name: 'Baumeister',          desc: 'Errichte deine erste Anlage.',             check: (s) => (s.sites || []).some(Boolean), reward: 300 },
  { id: 'industry', name: 'Industrie-Nexus',     desc: 'Betreibe 8 Anlagen gleichzeitig.',         check: (s) => (s.sites || []).filter(Boolean).length >= 8, reward: 15000 },
  { id: 'maxbuild', name: 'Ausgebaut',           desc: 'Bringe eine Anlage auf Stufe 5.',          check: (s) => (s.sites || []).some((b) => b && b.lvl >= 5), reward: 20000 },
  { id: 'module1',  name: 'Grundstein',          desc: 'Baue dein erstes Stationsmodul.',          check: (s) => (s.station || []).length >= 1, reward: 500 },
  { id: 'citadel',  name: 'Zitadelle',           desc: 'Erreiche Stationsrang Zitadelle (11 Module).', check: (s) => (s.station || []).length >= 11, reward: 30000 },
  { id: 'gravity',  name: 'Herr der Schwerkraft', desc: 'Baue den Gravitationskern.',               check: (s) => (s.station || []).some((m) => m.type === 'gravcore'), reward: 100000 },
  { id: 'tinker',   name: 'Bastler',             desc: 'Besitze 3 Module.',                        check: (s) => (s.modules || []).length >= 3, reward: 1500 },
  { id: 'fusion',   name: 'Kernfusion',          desc: 'Rüste den Atomar-Kern auf Stufe III.',     check: (s) => (s.atomarLv || 0) >= 2, reward: 4000 },
  { id: 'meteor',   name: 'Sternschnuppen-Fänger', desc: 'Sammle 10 Meteoriten.',                 check: (s) => (s.stats.meteors || 0) >= 10, reward: 2500 },
  { id: 'lv5',      name: 'Aufsteiger',          desc: 'Erreiche Nexus Level 5.',                  check: (s) => (s.level || 1) >= 5,          reward: 800 },
  { id: 'lv15',     name: 'Veteran',             desc: 'Erreiche Nexus Level 15.',                 check: (s) => (s.level || 1) >= 15,         reward: 25000 },
  { id: 'combo50',  name: 'Im Flow',             desc: 'Schaffe eine Kombo von 50.',               check: (s) => (s.bestCombo || 0) >= 50,     reward: 600 },
  { id: 'combo200', name: 'Greif-Maschine',      desc: 'Schaffe eine Kombo von 200.',              check: (s) => (s.bestCombo || 0) >= 200,    reward: 6000 },
  { id: 'craft',    name: 'Erfinder',            desc: 'Baue deinen ersten Gegenstand.',           check: (s) => (s.crafted || 0) >= 1,        reward: 200 },
  { id: 'contract', name: 'Zuverlässig',         desc: 'Erledige 5 Aufträge.',                     check: (s) => (s.contractsDone || 0) >= 5,  reward: 2000 },
];

export const CAPSULE = { max: 3, respawn: 40, reach: 2.6 };

// Decks (prestige): after finding the core you can move on to the next deck.
// Each star = +25 % find value and +10 % helper speed, permanently.
export const DECKS = [
  { name: 'Hangardeck 7',  title: 'Schrotthalde',    special: null,    mech: 'Das Übungsdeck: Lerne Greifen, Verkaufen und Aufrüsten.', goal: { label: 'Sortiere 250.000 Teile', key: 'removed', target: 250000 }, minutes: 25, boost: {}, perk: 'Normaler Schrott',     base: [0.24, 0.22, 0.21], pebbles: [[1.9, 0.9, 0.5], [1.6, 1.1, 0.6], [1.4, 1.5, 1.65], [1.05, 1, 0.95]] },
  { name: 'Kühldeck 3',    title: 'Eiswrack',        special: 'storm', mech: 'Schneestürme nehmen die Sicht, aber bringen seltene Funde.', goal: { label: 'Sammle 150 Eiskristalle', key: 'ice', target: 150 }, minutes: 30,        boost: { ice: 3, datacore: 1.5 }, perk: '3× Eiskristalle, mehr Datenkerne',        base: [0.3, 0.36, 0.43],  pebbles: [[1.6, 2.1, 2.6], [2.2, 2.4, 2.6], [1.2, 1.5, 2.0], [1.4, 1.6, 1.8]] },
  { name: 'Frachtdeck 12', title: 'Goldmine',        special: 'gold',  mech: 'Im Goldrausch ist jeder Fund doppelt so viel wert.', goal: { label: 'Finde 25 Platin-Nuggets', key: 'platinum', target: 25 }, minutes: 35,        boost: { platinum: 2.5, copper: 1.5, graviton: 2 }, perk: '2,5× Platin, doppelte Gravitonperlen',        base: [0.33, 0.26, 0.16], pebbles: [[2.6, 2.0, 0.7], [2.2, 1.4, 0.5], [1.6, 1.4, 1.2], [1.2, 0.9, 0.6]] },
  { name: 'Labordeck X',   title: 'Alienschrott',    special: 'swarm', mech: 'Alien-Schwärme huschen über den Haufen – fang sie!', goal: { label: 'Fange 12 Aliens', key: 'aliens', target: 12 }, minutes: 40,    boost: { artifact: 4, badge: 1.5 }, perk: '4× Alien-Artefakte, mehr Abzeichen',    base: [0.2, 0.17, 0.26],  pebbles: [[1.4, 0.8, 2.4], [0.7, 2.2, 1.3], [1.9, 1.0, 1.9], [1.0, 1.0, 1.2]] },
];
export const STAR_BONUS = { finds: 0.25, helpers: 0.1 };
export const TURBO = { duration: 8, cooldown: 40, factor: 2.5 };

// Chassis for the Nexus-Bot. speed: multiplier, slope: slow-down on climbs (lower = better), reach: extra grab reach.
export const CHASSIS = [
  { id: 'tracks', name: 'Raupen',       cost: 0,     speed: 1,    slope: 0.6,  reach: 0,   desc: 'Robust und zuverlässig.' },
  { id: 'wheels', name: 'Räder',        cost: 150,   speed: 1.45, slope: 1.1,  reach: 0,   desc: 'Flitzt über das Deck, quält sich am Hang.' },
  { id: 'feet',   name: 'Laufbeine',    cost: 1500,  speed: 1.1,  slope: 0.2,  reach: 0.3, desc: 'Stapft sicher den Schrottberg hinauf.' },
  { id: 'spider', name: 'Spinnenbeine', cost: 18000, speed: 1.35, slope: 0.03, reach: 0.8, desc: 'Klettert überall hin und greift weiter.' },
];

// Equippable modules (limited slots).
export const MODULES = [
  { id: 'auto',    icon: '🤖', name: 'Auto-Greifer',   cost: 300,    desc: 'Nexus greift von selbst, wenn er still am Haufen steht.' },
  { id: 'magnet',  icon: '🧲', name: 'Magnet',         cost: 600,    desc: '+40 % Kupferspulen, Platin und Sondenteile.' },
  { id: 'radar',   icon: '📡', name: 'Kapsel-Radar',   cost: 1500,   desc: 'Frachtkapseln kommen doppelt so oft.' },
  { id: 'reach',   icon: '🦾', name: 'Teleskoparme',   cost: 4000,   desc: 'Größerer Greifbereich und mehr Reichweite.' },
  { id: 'battery', icon: '🔋', name: 'Turbo-Akku',     cost: 6000,   desc: 'Turbo lädt 40 % schneller.' },
  { id: 'cooler',  icon: '❄️', name: 'Turbo-Kühlung',  cost: 9000,   desc: 'Turbo hält 60 % länger.' },
  { id: 'lure',    icon: '☄️', name: 'Meteor-Lockruf', cost: 20000,  desc: 'Ereignisse kommen fast doppelt so oft.' },
  { id: 'sense',   icon: '💎', name: 'Schatzsinn',     cost: 60000,  desc: 'Seltene Funde 50 % häufiger.' },
];
export const MODULE_SLOTS = [
  { slots: 1, cost: 0 },
  { slots: 2, cost: 2500 },
  { slots: 3, cost: 30000 },
  { slots: 4, cost: 400000 },
];

// Tool heads for the Nexus-Bot (bought once, switch freely).
// amount: x parts per grab, speed: x grabs per second, radius/reach: added metres, rare: x chance for rare finds, pickup: extra reach for capsules/meteors
export const TOOLS = [
  { id: 'arms',   icon: '🦾', name: 'Greifarme',   cost: 0,     amount: 1,    speed: 1,    radius: 0,    reach: 0,   rare: 1,    pickup: 0,   desc: 'Die guten alten Arme.' },
  { id: 'crane',  icon: '🏗️', name: 'Greifkran',   cost: 800,   amount: 1.6,  speed: 0.85, radius: 0.4,  reach: 1.2, rare: 1,    pickup: 0,   desc: 'Ausleger mit Greifklaue: mehr Teile pro Griff, etwas langsamer, mehr Reichweite.' },
  { id: 'vacuum', icon: '🌀', name: 'Staubsauger', cost: 3000,  amount: 0.8,  speed: 1.7,  radius: 0.6,  reach: 0.5, rare: 1,    pickup: 2.5, desc: 'Saugt viel schneller und zieht Kapseln und Meteoriten von weiter weg an.' },
  { id: 'drill',  icon: '🔩', name: 'Bohrer',      cost: 12000, amount: 1.35, speed: 1,    radius: -0.4, reach: 0,   rare: 1.35, pickup: 0,   desc: 'Bohrt tief in den Haufen: mehr Teile und 35 % mehr seltene Funde.' },
];

// ---- deck progression: every deck is bigger, richer and busier; after the 4th it repeats as "II", "III", ...
export const deckRound = (n) => Math.floor(n / DECKS.length);
export const deckDef = (n) => DECKS[n % DECKS.length];
export const deckName = (n) => `${deckDef(n).title}${deckRound(n) ? ' ' + 'I'.repeat(deckRound(n) + 1) : ''}`;
export const deckTotal = (n) => Math.round(TOTAL_STONES * Math.min(3, 1 + n * 0.5));
export const deckValueMult = (n) => 1 + n * 0.4;
export const deckEventSpeed = (n) => 1 + n * 0.15;
export const deckGoalTarget = (n) => Math.round(deckDef(n).goal.target * (1 + deckRound(n) * 0.8));
export const deckMinutes = (n) => Math.round(deckDef(n).minutes * (1 + deckRound(n) * 0.5));
