// Consistent line-icon set (sci-fi, single colour). Emojis anywhere in the UI are swapped for these icons
// automatically (MutationObserver), and decorative emoticons are removed.

const P = {
  coin: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><path d="M12 8l3.5 2v4L12 16l-3.5-2v-4z"/>',
  crate: '<rect x="4" y="6" width="16" height="13" rx="1.5"/><path d="M4 10h16M9 6v4M15 6v4"/>',
  ingot: '<path d="M5 14l2-4h10l2 4z"/><path d="M3 19l2-4h14l2 4z"/>',
  factory: '<path d="M3 20V10l5 3V10l5 3V6h3v14z"/><path d="M17 20V4h3v16"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  pad: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  crane: '<path d="M6 21V5h12M6 9l4-4M14 5v6"/><path d="M12 11h4v3h-4z"/><path d="M3 21h8"/>',
  station: '<circle cx="12" cy="12" r="3"/><path d="M12 4v5M12 15v5"/><rect x="2" y="9.5" width="6" height="5" rx=".5"/><rect x="16" y="9.5" width="6" height="5" rx=".5"/><path d="M8 12h1M15 12h1"/>',
  rocket: '<path d="M12 3c3 2 5 5 5 9l-2 4H9l-2-4c0-4 2-7 5-9z"/><circle cx="12" cy="10" r="1.6"/><path d="M9 16l-2 4M15 16l2 4M12 17v4"/>',
  ship: '<ellipse cx="12" cy="14" rx="9" ry="3"/><path d="M7 13c0-3 2-6 5-6s5 3 5 6"/><path d="M6 19l-1 2M18 19l1 2"/>',
  atom: '<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
  vortex: '<path d="M12 12a2 2 0 1 1 2-2 4 4 0 1 1-4-4 6 6 0 1 1-6 6"/>',
  flame: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 2 3 2 0-3-1-5 0-7z"/>',
  ring: '<ellipse cx="12" cy="12" rx="9" ry="4"/><circle cx="12" cy="12" r="2"/><path d="M12 8v2M12 14v2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  scope: '<path d="M4 15l12-7 2 4-12 7z"/><path d="M10 15l-2 6M12 14l2 7M18 9l2-1"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  galaxy: '<path d="M12 12c-4-2-3-7 1-7s7 4 5 8-8 6-11 3-2-8 2-9"/><circle cx="12" cy="12" r="1"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1"/><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1"/>',
  core: '<path d="M12 2l6 10-6 10-6-10z"/><path d="M6 12h12"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor"/>',
  starO: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  bomb: '<circle cx="11" cy="14" r="6"/><path d="M15 9l2-2M17 5l1 1M19 4v2M20 5h-2"/>',
  radar: '<path d="M4 18a10 10 0 0 1 16 0"/><path d="M8 18a5 5 0 0 1 8 0"/><path d="M12 18l4-8"/><circle cx="12" cy="18" r="1"/>',
  capsule: '<rect x="3" y="9" width="18" height="7" rx="3.5"/><path d="M12 9v7"/>',
  spark: '<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>',
  comet: '<circle cx="16" cy="8" r="3"/><path d="M13.5 10.5L4 20M14 13l-6 6M11 9l-6 6"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M10 5l2 2 2-2M10 19l2-2 2 2"/>',
  coins: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3 3 7 3s7-1.3 7-3v-5"/>',
  alien: '<path d="M12 3c-5 0-8 3-8 7 0 5 5 10 8 11 3-1 8-6 8-11 0-4-3-7-8-7z"/><path d="M8 11c1 0 3 1 3 3-2 0-3-1-3-3zM16 11c-1 0-3 1-3 3 2 0 3-1 3-3z" fill="currentColor"/>',
  volcano: '<path d="M3 21l6-10h6l6 10z"/><path d="M10 7c0-2 1-3 2-4 1 1 2 2 2 4"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 16 3-16"/>',
  pick: '<path d="M3 8c5-5 13-5 18 0"/><path d="M12 5l-7 16"/>',
  arm: '<circle cx="6" cy="18" r="2"/><path d="M7.5 16.5L12 9l5 2"/><circle cx="12" cy="9" r="1.6"/><path d="M17 11l2-3M17 11l3 1"/>',
  drill: '<path d="M4 12h6l2-2h4l5 2-5 2h-4l-2-2"/><path d="M14 10l1 4M17 10.7l.6 2.6"/>',
  wheel: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v5.5M12 14.5V20M4 12h5.5M14.5 12H20"/>',
  leg: '<path d="M10 3h4v7l-1 4 3 6h-6l1-6-1-4z"/>',
  spider: '<circle cx="12" cy="12" r="3"/><path d="M9 11l-4-4-2 1M9 13l-4 3-2-1M15 11l4-4 2 1M15 13l4 3 2-1M10 10L8 5M14 10l2-5"/>',
  robot: '<rect x="5" y="7" width="14" height="10" rx="2"/><path d="M9 11v2M15 11v2M12 3v4M3 11v3M21 11v3M9 20h6"/>',
  magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 8h3M15 8h3M9 4v8a3 3 0 0 0 6 0V4"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4M7 10v4M10 10v4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8 11h8M8 15h6"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5l-2 4M13 5l-2 4M18 5l-2 4"/>',
  calm: '<circle cx="12" cy="12" r="8.5"/><path d="M8 13c1.3 1.6 2.6 2 4 2s2.7-.4 4-2"/>',
  refresh: '<path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M20 4v5h-5M4 20v-5h5"/>',
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10"/>',
  music: '<path d="M9 18V5l10-2v13"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>',
  stick: '<circle cx="12" cy="7" r="3"/><path d="M12 10v6M6 20h12l-2-4H8z"/>',
  hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 14"/>',
  recycle: '<path d="M7 19H4l3-5M17 19h3l-3-5M12 4l-2 3h4z"/><path d="M8 17l4-7 4 7z"/>',
  silo: '<ellipse cx="12" cy="5" rx="6" ry="2"/><path d="M6 5v13c0 1.1 2.7 2 6 2s6-.9 6-2V5"/><path d="M6 11c0 1.1 2.7 2 6 2s6-.9 6-2"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-3.8M8.2 13l7.6 3.8"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  storm: '<path d="M6 15a4 4 0 0 1 1-8 5 5 0 0 1 9.5 1A3.5 3.5 0 0 1 17 15z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>',
  arrow: '<path d="M5 12h12M13 7l5 5-5 5"/>',
};

// emoji -> icon name (null = remove)
const MAP = {
  '⬡': 'coin', '▣': 'crate', '🧱': 'ingot', '🏭': 'factory', '⚙️': 'gear', '⚙': 'gear', '☰': 'menu', '📖': 'pad',
  '🏗️': 'crane', '🏗': 'crane', '🛰️': 'station', '🛰': 'station', '🚀': 'rocket', '🛸': 'ship', '⚛️': 'atom', '⚛': 'atom',
  '🌀': 'vortex', '🔥': 'flame', '🏠': 'ring', '☀️': 'sun', '📦': 'crate', '🔭': 'scope', '🧪': 'flask', '🌌': 'galaxy',
  '🔗': 'link', '💠': 'core', '⭐': 'star', '★': 'star', '☆': 'starO', '🏆': 'trophy', '🔒': 'lock', '✓': 'check', '✔': 'check',
  '▶': 'play', '💨': 'wind', '💣': 'bomb', '📡': 'radar', '⚡': 'bolt', '🎁': 'capsule', '✨': 'spark', '☄️': 'comet', '☄': 'comet',
  '🌨️': 'storm', '🌨': 'storm', '💰': 'coins', '👽': 'alien', '🌋': 'volcano', '💎': 'gem', '❄️': 'snow', '❄': 'snow', '⛏️': 'pick', '⛏': 'pick',
  '🦾': 'arm', '🔩': 'drill', '🛞': 'wheel', '🦿': 'leg', '🕷️': 'spider', '🕷': 'spider', '🤖': 'robot', '🧲': 'magnet',
  '🔋': 'battery', '🎯': 'target', '⏱': 'clock', '🏁': 'flag', '📋': 'clip', '🎬': 'film', '🧘': 'calm', '↺': 'refresh',
  '🔈': 'speaker', '🔊': 'speaker', '🎵': 'music', '🕹': 'stick', '✋': 'hand', '♻️': 'recycle', '♻': 'recycle', '🛢️': 'silo', '🛢': 'silo',
  '🔬': 'flask', '☄️': 'comet', '🌑': 'core', '➤': 'arrow', '➕': 'plus', '📍': 'pin', '🛒': 'crate', '💥': 'bomb', '🙌': null,
  '👋': null, '💪': null, '🎉': null, '😟': null, '🙂': null, '💚': null, '🐾': null, '🚧': 'crane',
};
const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
const RE = new RegExp(`(${KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\uFE0F?`, 'gu');
const LEFTOVER = /\p{Extended_Pictographic}️?/gu;

export function iconSvg(name) {
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

function processText(node) {
  const t = node.nodeValue;
  RE.lastIndex = 0;
  if (!RE.test(t) && !LEFTOVER.test(t)) return;
  RE.lastIndex = 0; LEFTOVER.lastIndex = 0;
  const parent = node.parentNode;
  if (!parent || parent.closest && parent.closest('script,style,svg')) return;
  const frag = document.createDocumentFragment();
  let last = 0;
  const parts = t.replace(RE, '\u0000$1\u0000');
  for (const piece of parts.split('\u0000')) {
    if (!piece) continue;
    const name = MAP[piece] !== undefined ? MAP[piece] : MAP[piece.replace('️', '')];
    if (name !== undefined) {
      if (name) { const span = document.createElement('span'); span.className = 'icw'; span.innerHTML = iconSvg(name); frag.appendChild(span); }
    } else {
      frag.appendChild(document.createTextNode(piece.replace(LEFTOVER, '')));
    }
  }
  last = 0;
  parent.replaceChild(frag, node);
}
export function iconize(root) {
  if (!root) return;
  if (root.nodeType === 3) { processText(root); return; }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(processText);
}
export function startIconObserver() {
  iconize(document.body);
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') processText(m.target);
      m.addedNodes && m.addedNodes.forEach((n) => iconize(n));
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
}
