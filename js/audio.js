// All sound is synthesized with WebAudio: effects, generative space music, engine and station hum.
let ctx = null;
let master = null, sfxBus = null, musicBus = null, ambBus = null;
let noiseBuf = null;
let engine = null;
let musicTimer = null;

const SETTINGS_KEY = 'nexus-audio';
export const settings = (() => {
  try { return { music: true, sfx: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
  catch (e) { return { music: true, sfx: true }; }
})();
function persist() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }

// kept for older callers
export let muted = !settings.sfx && !settings.music;

// iOS: with the ring/silent switch on "silent", Web Audio is muted unless the page
// declares itself as media playback. audioSession (Safari 17+) does that directly;
// on older iOS a looping silent <audio> element switches the session to playback.
let mediaEl = null;
function silentWavUrl() {
  const rate = 8000, n = rate / 2;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function unlockMediaSession() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
  try {
    if (!mediaEl) {
      mediaEl = document.createElement('audio');
      mediaEl.src = silentWavUrl();
      mediaEl.loop = true;
      mediaEl.setAttribute('playsinline', '');
      mediaEl.volume = 0.01;
    }
    if (mediaEl.paused) { const p = mediaEl.play(); if (p && p.catch) p.catch(() => {}); }
  } catch (e) { /* ignore */ }
}

// App in the background / closed: everything goes quiet (iOS would otherwise keep the 'playback' session alive).
export function pauseAudio() {
  try { if (mediaEl && !mediaEl.paused) mediaEl.pause(); } catch (e) { /* ignore */ }
  try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) { /* ignore */ }
  try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) { /* ignore */ }
}

// Call from every user gesture (touchend / click): creates or resumes audio.
export function initAudio() {
  unlockMediaSession();
  if (ctx) {
    if (ctx.state !== 'running') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  // play one silent sample inside the gesture: required by older iOS to unlock
  try {
    const b = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0);
  } catch (e) { /* ignore */ }
  if (ctx.state !== 'running') ctx.resume();
  master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? 0.7 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? 0.32 : 0; musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = settings.sfx ? 0.5 : 0; ambBus.connect(master);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  startAmbience();
  startEngine();
  startMusic();
  setAmbience(ambKind);
}

export function setSfx(on) {
  settings.sfx = on; persist();
  if (sfxBus) { sfxBus.gain.value = on ? 0.7 : 0; ambBus.gain.value = on ? 0.5 : 0; }
  muted = !settings.sfx && !settings.music;
}
export function setMusic(on) {
  settings.music = on; persist();
  if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.3);
  muted = !settings.sfx && !settings.music;
}
export function setMuted(m) { setSfx(!m); setMusic(!m); }

// ---------------------------------------------------------------- primitives
function noise(dur, freq, vol, type = 'lowpass', bus = sfxBus) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(bus);
  src.start(t, Math.random() * 1.2); src.stop(t + dur);
}

function tone(freq, dur, vol = 0.2, type = 'sine', delay = 0, slideTo = null, bus = sfxBus) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}

// ---------------------------------------------------------------- ambience & engine
function startAmbience() {
  // low station hum + air conditioning hiss
  for (const [f, v] of [[55, 0.05], [82.5, 0.025], [110, 0.012]]) {
    const o = ctx.createOscillator(); o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = v;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.1;
    const lg = ctx.createGain(); lg.gain.value = v * 0.4;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(ambBus); o.start(); lfo.start();
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4;
  const g = ctx.createGain(); g.gain.value = 0.018;
  src.connect(f).connect(g).connect(ambBus); src.start();
}

function startEngine() {
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 48;
  const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 72;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400;
  const g = ctx.createGain(); g.gain.value = 0;
  const og2 = ctx.createGain(); og2.gain.value = 0.3;
  const ng = ctx.createGain(); ng.gain.value = 0.5;
  o.connect(f); o2.connect(og2).connect(f); src.connect(nf).connect(ng).connect(f);
  f.connect(g).connect(sfxBus);
  o.start(); o2.start(); src.start();
  engine = { o, o2, f, g };
}

// v = 0..1 speed, kind = drive level (pitch)
export function setEngine(v, level = 0) {
  if (!engine) return;
  const t = ctx.currentTime;
  engine.g.gain.setTargetAtTime(v > 0.05 ? 0.05 + v * 0.07 : 0, t, 0.08);
  const base = 44 + level * 10;
  engine.o.frequency.setTargetAtTime(base + v * 30, t, 0.1);
  engine.o2.frequency.setTargetAtTime((base + v * 30) * 1.5, t, 0.1);
  engine.f.frequency.setTargetAtTime(220 + v * 500 + level * 120, t, 0.1);
}

// ---------------------------------------------------------------- generative music (one mood per deck)
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
let delayIn = null, hall = null;
// Orchestral space score: strings, brass motifs, timpani, harp and choir, all synthesised.
// chords: midi triads (root first); motifs: [semitones above chord root, length in 16ths] (null = rest)
const HERO = [[[0, 3], [7, 3], [12, 8], [11, 1], [9, 1]], [[7, 4], [12, 2], [14, 2], [16, 6], [null, 2]], [[12, 6], [7, 2], [9, 2], [7, 2], [4, 4]], [[0, 2], [4, 2], [7, 4], [12, 8]]];
const MARCH = [[[0, 3], [0, 1], [0, 3], [0, 1], [3, 4], [7, 4]], [[7, 3], [8, 1], [7, 3], [5, 1], [3, 8]], [[0, 2], [3, 2], [7, 2], [12, 6], [11, 2], [null, 2]]];
const MYSTIC = [[[0, 6], [2, 2], [4, 8]], [[7, 4], [6, 4], [4, 8]], [[12, 8], [11, 4], [7, 4]]];
const SERENE = [[[0, 4], [4, 4], [7, 8]], [[9, 6], [7, 2], [4, 8]], [[12, 12], [null, 4]], [[7, 4], [11, 4], [12, 8]]];
const THEMES = {
  hangar:  { chords: [[48, 52, 55], [44, 48, 51], [46, 50, 53], [48, 52, 55]], motifs: HERO, bar: 4.2, brass: 0.75, harp: 0.5, choir: 0, perc: 0.15 },
  ice:     { chords: [[50, 54, 57], [52, 56, 59], [50, 54, 57], [47, 50, 54]], motifs: SERENE, bar: 5, brass: 0.3, harp: 0.9, choir: 0.4, perc: 0, bell: true },
  gold:    { chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], motifs: MARCH, bar: 4, brass: 0.85, harp: 0.3, choir: 0, perc: 0.5 },
  alien:   { chords: [[48, 52, 56], [50, 54, 58], [46, 50, 54], [52, 56, 60]], motifs: MYSTIC, bar: 5, brass: 0.35, harp: 0.6, choir: 0.6, perc: 0.1 },
  lava:    { chords: [[43, 46, 50], [39, 43, 46], [43, 46, 50], [38, 42, 45]], motifs: MARCH, bar: 4.4, brass: 0.8, harp: 0.15, choir: 0.3, perc: 0.6 },
  crystal: { chords: [[52, 56, 59], [54, 58, 61], [49, 52, 56], [57, 61, 64]], motifs: SERENE, bar: 5, brass: 0.35, harp: 1, choir: 0.5, perc: 0, bell: true },
  station: { chords: [[48, 52, 55], [53, 57, 60], [43, 47, 50], [48, 52, 55]], motifs: HERO, bar: 5.5, brass: 0.5, harp: 0.5, choir: 0.8, perc: 0.05 },
};
let theme = THEMES.hangar, nextTheme = null, intensity = 0;
export function setMusicTheme(name) { if (THEMES[name] && THEMES[name] !== theme) nextTheme = THEMES[name]; }
export function setMusicIntensity(v) { intensity = v; }

function makeHall() {
  const len = Math.floor(ctx.sampleRate * 3.2);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  const cv = ctx.createConvolver(); cv.buffer = buf;
  const wet = ctx.createGain(); wet.gain.value = 0.5;
  cv.connect(wet).connect(musicBus);
  const inp = ctx.createGain(); inp.connect(cv); inp.connect(musicBus);
  return inp;
}

function startMusic() {
  hall = makeHall();
  delayIn = hall;
  let bar = 0;
  let next = ctx.currentTime + 0.3;
  const schedule = () => {
    while (next < ctx.currentTime + 1.5) {
      if (nextTheme && bar % 4 === 0) { theme = nextTheme; nextTheme = null; }
      const T = theme, BAR = T.bar, st = BAR / 16;
      const chord = T.chords[bar % T.chords.length];
      strings(chord, next, BAR);
      if (bar % 2 === 0) bass(midi(chord[0] - 12), next, BAR);
      // phrase structure: 8 bars; brass speaks in bars 2-3 and 6-7, harp fills the rest
      const ph = bar % 8;
      if ((ph === 2 || ph === 3 || ph === 6 || ph === 7) && Math.random() < T.brass + intensity * 0.3) {
        const motif = T.motifs[(Math.floor(bar / 2) + (ph >= 6 ? 1 : 0)) % T.motifs.length];
        let s = 0;
        const root = chord[0] + 12;
        for (const [iv, len] of motif) {
          if (iv !== null) brass(midi(root + iv), next + s * st, len * st, ph >= 6 ? 0.05 : 0.04);
          s += len;
        }
      } else if (Math.random() < T.harp) {
        const notes = [...chord.map((m) => m + 12), ...chord.map((m) => m + 24)];
        for (let k = 0; k < notes.length; k++) harp(midi(notes[k]), next + k * st * 2, T.bell);
      }
      if (T.choir && (ph === 0 || ph === 4) && Math.random() < T.choir) choir(chord, next, BAR * 2);
      const perc = Math.min(1, T.perc + intensity * 0.8);
      timpani(midi(chord[0] - 12), next, BAR, perc, ph === 7);
      next += BAR;
      bar++;
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 500);
}

// string section: three detuned saws per note, slow swell, gentle vibrato
function strings(chord, t, dur) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; f.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.016, t + 1.2);
  g.gain.linearRampToValueAtTime(0.013, t + dur - 0.4);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.2);
  f.connect(g).connect(hall);
  const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.value = 6; vib.connect(vg);
  vib.start(t); vib.stop(t + dur + 1.3);
  const voices = [...chord, chord[0] + 12, chord[1] + 12];
  for (const m of voices) for (const det of [-9, 0, 9]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = midi(m); o.detune.value = det; vg.connect(o.detune);
    o.connect(f); o.start(t); o.stop(t + dur + 1.3);
  }
}
// brass: saw + square, filter opens with the swell, slight scoop into the note
function brass(freq, t, len, vol) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(2200, t + 0.12); f.frequency.linearRampToValueAtTime(1300, t + Math.max(0.2, len));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.08);
  g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.1, len - 0.08));
  g.gain.linearRampToValueAtTime(0.0001, t + len + 0.35);
  f.connect(g).connect(hall);
  for (const [type, mul, det] of [['sawtooth', 1, -5], ['sawtooth', 1, 5], ['square', 0.5, 0]]) {
    const o = ctx.createOscillator(); o.type = type; o.detune.value = det;
    o.frequency.setValueAtTime(freq * mul * 0.985, t); o.frequency.linearRampToValueAtTime(freq * mul, t + 0.07);
    o.connect(f); o.start(t); o.stop(t + len + 0.4);
  }
}
// harp / celesta: plucked arpeggios
function harp(freq, t, bell) {
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * (bell ? 4 : 2);
  const g = ctx.createGain(); const len = bell ? 2.4 : 1.6;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const g2 = ctx.createGain(); g2.gain.value = bell ? 0.3 : 0.12;
  o.connect(g); o2.connect(g2).connect(g); g.connect(hall);
  o.start(t); o2.start(t); o.stop(t + len + 0.1); o2.stop(t + len + 0.1);
}
// wordless choir: saws through two vowel formants
function choir(chord, t, dur) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 2.5); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1);
  g.connect(hall);
  for (const fq of [700, 1150]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 6;
    bp.connect(g);
    for (const m of chord) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(m + 12); o.detune.value = det;
      o.connect(bp); o.start(t); o.stop(t + dur + 1.1);
    }
  }
}
function bass(freq, t, dur) {
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.6);
  g.gain.linearRampToValueAtTime(0.0001, t + dur * 2);
  o.connect(f).connect(g).connect(hall);
  o.start(t); o.stop(t + dur * 2 + 0.1);
}
function timpHit(freq, t, vol) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq * 1.5, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(g).connect(hall); o.start(t); o.stop(t + 1.2);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
  const ng = ctx.createGain(); ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  src.connect(lp).connect(ng).connect(hall); src.start(t, Math.random()); src.stop(t + 0.2);
}
// timpani on the downbeat; with more intensity a march pattern, roll into the next phrase
function timpani(freq, t0, dur, density, roll) {
  if (density < 0.05) return;
  const q = dur / 4;
  timpHit(freq, t0, 0.14 * density + 0.03);
  if (density > 0.4) { timpHit(freq * 1.5, t0 + q * 2, 0.08 * density); timpHit(freq, t0 + q * 3, 0.06 * density); }
  if (density > 0.7) {
    for (let k = 0; k < 4; k++) { // snare-like march taps
      const th = t0 + q * k + q / 2;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.025 * density, th); g.gain.exponentialRampToValueAtTime(0.0001, th + 0.09);
      src.connect(bp).connect(g).connect(hall); src.start(th, Math.random()); src.stop(th + 0.1);
    }
  }
  if (roll) for (let k = 0; k < 10; k++) timpHit(freq, t0 + dur - q + (k / 10) * q, 0.015 + k * 0.006 * density);
}

// ---------------------------------------------------------------- deck ambience
let ambKind = 'hangar', ambTimer = null, windGain = null;
export function setAmbience(kind) {
  ambKind = kind;
  if (!ctx) return;
  if (!windGain) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 1.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 300;
    lfo.connect(lg).connect(f.frequency);
    windGain = ctx.createGain(); windGain.gain.value = 0;
    src.connect(f).connect(windGain).connect(ambBus); src.start(); lfo.start();
  }
  windGain.gain.setTargetAtTime(kind === 'ice' ? 0.05 : kind === 'storm' ? 0.16 : 0, ctx.currentTime, 1);
  if (!ambTimer) ambTimer = setInterval(ambienceTick, 1000);
}
function ambienceTick() {
  if (!ctx || document.hidden) return;
  const r = Math.random();
  if (ambKind === 'gold' && r < 0.18) { // distant machinery clank
    tone(180 + Math.random() * 120, 0.25, 0.03, 'square', 0, null, ambBus);
    noise(0.15, 1200, 0.04, 'bandpass', ambBus);
  } else if (ambKind === 'alien' && r < 0.22) { // alien chirps
    const f = 900 + Math.random() * 900;
    tone(f, 0.12, 0.025, 'sine', 0, f * 1.6, ambBus);
    tone(f * 1.3, 0.1, 0.02, 'sine', 0.14, f * 0.8, ambBus);
  } else if (ambKind === 'lava' && r < 0.2) { // bubbling lava
    noise(0.4, 300, 0.05, 'lowpass', ambBus); tone(60 + Math.random() * 30, 0.4, 0.03, 'sine', 0, 40, ambBus);
  } else if (ambKind === 'crystal' && r < 0.2) { // singing crystals
    const f = [1319, 1568, 1760, 2093][Math.floor(Math.random() * 4)];
    tone(f, 1.6, 0.012, 'sine', 0, null, ambBus); tone(f * 1.5, 1.4, 0.008, 'sine', 0.1, null, ambBus);
  } else if (ambKind === 'ice' && r < 0.12) { // ice creak
    tone(300 + Math.random() * 200, 0.6, 0.015, 'triangle', 0, 120, ambBus);
  } else if (ambKind === 'hangar' && r < 0.08) { // station announcement chime
    tone(660, 0.3, 0.02, 'sine', 0, null, ambBus); tone(880, 0.4, 0.02, 'sine', 0.25, null, ambBus);
  }
}

// ---------------------------------------------------------------- effects
export const sfx = {
  grab(size) {
    noise(0.1 + size * 0.05, 1900 - size * 250, 0.35 + size * 0.06, 'bandpass');
    // little metallic clinks
    const n = 1 + Math.min(3, size);
    for (let k = 0; k < n; k++) tone(1800 + Math.random() * 2200, 0.06, 0.025, 'triangle', 0.03 + Math.random() * 0.12);
    tone(170 - size * 15, 0.08, 0.06, 'triangle');
  },
  empty() { tone(220, 0.08, 0.05, 'sine'); },
  find(tier) {
    const base = [880, 988, 1175, 1319, 1568, 1760][tier] || 880;
    tone(base, 0.09, 0.1 + tier * 0.02, 'square');
    if (tier >= 1) tone(base * 1.5, 0.18, 0.1, 'square', 0.07);
    if (tier >= 3) [1, 1.25, 1.5, 2].forEach((m, k) => tone(base * m, 0.3, 0.1, 'triangle', 0.15 + k * 0.07));
  },
  sell() { [660, 880, 1320, 1760].forEach((f, k) => tone(f, 0.12, 0.1, 'square', k * 0.05)); noise(0.3, 6000, 0.08, 'highpass'); },
  upgrade() { [392, 523, 659, 784, 1047].forEach((f, k) => tone(f, 0.25, 0.12, 'triangle', k * 0.06)); },
  full() { tone(196, 0.2, 0.12, 'sawtooth'); tone(147, 0.25, 0.12, 'sawtooth', 0.15); },
  ping(heat) { tone(260 + heat * 900, 0.12, 0.05 + heat * 0.06, 'sine'); },
  core() { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, k) => tone(f, 0.8, 0.12, 'sine', k * 0.11)); noise(1.2, 3000, 0.15, 'highpass'); },
  deny() { tone(150, 0.15, 0.1, 'sawtooth'); },
  capsule() { tone(523, 0.1, 0.12, 'square'); tone(784, 0.1, 0.12, 'square', 0.08); tone(1047, 0.35, 0.12, 'square', 0.16); noise(0.4, 2500, 0.15, 'bandpass'); },
  achievement() { [784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.4, 0.1, 'triangle', k * 0.09)); tone(392, 0.8, 0.08, 'sine', 0); },
  meteor(vol = 1) {
    noise(0.9, 800, 0.5 * vol, 'lowpass');
    tone(110, 0.7, 0.25 * vol, 'sine', 0, 35);
    noise(0.25, 3000, 0.15 * vol, 'highpass');
  },
  event() { [0, 0.25, 0.5].forEach((d) => { tone(880, 0.15, 0.08, 'square', d); tone(660, 0.15, 0.08, 'square', d + 0.12); }); },
  turbo() { tone(200, 0.5, 0.15, 'sawtooth', 0, 900); noise(0.5, 2000, 0.2, 'bandpass'); },
  step() { noise(0.06, 500, 0.08, 'lowpass'); tone(70, 0.06, 0.05, 'sine'); },
  skitter() { tone(2400 + Math.random() * 800, 0.025, 0.02, 'square'); },
  ui() { tone(900, 0.04, 0.03, 'sine'); },
  milestone() { [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.25, 0.09, 'triangle', k * 0.08)); },
  click() { tone(1200, 0.03, 0.04, 'square'); },
  beep() { tone(1400, 0.05, 0.04, 'sine'); tone(1800, 0.05, 0.03, 'sine', 0.06); },
};

export function audioState() { return ctx ? ctx.state : 'none'; }

export function vibrate(ms) {
  if (settings.sfx && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
}
