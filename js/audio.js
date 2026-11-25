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
let delayIn = null;
// chords: midi notes; scale: melody notes; bar: seconds per chord; pluck/pad timbres; perc: base drum density
const THEMES = {
  hangar:  { chords: [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [48, 55, 59, 62, 64], [55, 59, 62, 66, 69]], scale: [69, 71, 72, 74, 76, 79, 81, 83, 84, 86, 88], bar: 8, pad: 'triangle', pluck: 'sine', density: 0.35, perc: 0 },
  ice:     { chords: [[50, 57, 62, 66, 69], [55, 59, 62, 66, 71], [52, 59, 64, 68, 71], [57, 61, 64, 68, 73]], scale: [74, 76, 78, 81, 83, 86, 88, 90, 93], bar: 9, pad: 'sine', pluck: 'sine', density: 0.28, perc: 0, bell: true },
  gold:    { chords: [[50, 57, 60, 65, 69], [48, 55, 58, 62, 67], [46, 53, 57, 62, 65], [45, 52, 57, 60, 64]], scale: [62, 64, 65, 67, 69, 72, 74, 76, 77], bar: 6, pad: 'sawtooth', pluck: 'triangle', density: 0.42, perc: 0.6 },
  alien:   { chords: [[48, 54, 58, 62, 66], [50, 56, 60, 64, 68], [46, 52, 56, 60, 64], [52, 58, 62, 66, 70]], scale: [60, 62, 64, 66, 68, 70, 72, 74, 76, 78], bar: 7, pad: 'square', pluck: 'sine', density: 0.33, perc: 0.25, wobble: true },
  lava:    { chords: [[45, 52, 55, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 58, 62], [40, 47, 52, 55, 59]], scale: [57, 59, 60, 62, 64, 67, 69, 72], bar: 6, pad: 'sawtooth', pluck: 'triangle', density: 0.3, perc: 0.5 },
  crystal: { chords: [[52, 59, 64, 68, 71], [57, 61, 64, 69, 73], [54, 61, 66, 69, 73], [59, 63, 66, 71, 75]], scale: [76, 78, 80, 83, 85, 88, 90, 92, 95], bar: 9, pad: 'sine', pluck: 'sine', density: 0.32, perc: 0, bell: true },
  station: { chords: [[48, 55, 60, 64, 67], [53, 57, 60, 65, 69], [55, 59, 62, 67, 71], [52, 55, 60, 64, 67]], scale: [72, 74, 76, 79, 81, 84, 86, 88], bar: 10, pad: 'triangle', pluck: 'sine', density: 0.2, perc: 0, choir: true },
};
let theme = THEMES.hangar, nextTheme = null, intensity = 0;
export function setMusicTheme(name) { if (THEMES[name] && THEMES[name] !== theme) nextTheme = THEMES[name]; }
export function setMusicIntensity(v) { intensity = v; }

function startMusic() {
  const d = ctx.createDelay(1.5); d.delayTime.value = 0.42;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
  d.connect(lp).connect(fb).connect(d);
  lp.connect(musicBus);
  delayIn = ctx.createGain(); delayIn.gain.value = 0.6;
  delayIn.connect(d); delayIn.connect(musicBus);

  let bar = 0;
  let next = ctx.currentTime + 0.3;
  const schedule = () => {
    while (next < ctx.currentTime + 1.5) {
      if (nextTheme && bar % 2 === 0) { theme = nextTheme; nextTheme = null; }
      const T = theme, BAR = T.bar;
      const chord = T.chords[bar % T.chords.length];
      pad(chord, next, BAR, T);
      const steps = 16;
      for (let s = 0; s < steps; s++) {
        if (Math.random() < T.density * (1 + intensity * 0.6)) {
          const note = T.scale[Math.floor(Math.random() * T.scale.length)];
          pluck(midi(note), next + s * (BAR / steps), 0.05 + Math.random() * 0.04, T);
        }
      }
      if (bar % 2 === 0) bass(midi(chord[0] - 12), next, BAR);
      const perc = Math.min(1, T.perc + intensity);
      if (perc > 0.05) drums(next, BAR, perc);
      next += BAR;
      bar++;
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 500);
}

function pad(chord, t, dur, T) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = T.pad === 'sawtooth' ? 700 : T.pad === 'square' ? 600 : 900; f.Q.value = 0.7;
  const g = ctx.createGain();
  const vol = T.pad === 'triangle' || T.pad === 'sine' ? 0.05 : 0.022;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 2.5);
  g.gain.linearRampToValueAtTime(vol * 0.8, t + dur - 1.5);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
  f.connect(g).connect(musicBus);
  if (T.wobble) { const l = ctx.createOscillator(); l.frequency.value = 0.35; const lg = ctx.createGain(); lg.gain.value = 300; l.connect(lg).connect(f.frequency); l.start(t); l.stop(t + dur + 1.6); }
  for (const m of chord.slice(0, 4)) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(); o.type = T.pad;
    o.frequency.value = midi(T.choir ? m + 12 : m); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 1.6);
  }
}
function pluck(freq, t, vol, T) {
  const o = ctx.createOscillator(); o.type = T.pluck; o.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * (T.bell ? 2.76 : 2);
  const g = ctx.createGain();
  const len = T.bell ? 2.2 : 1.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const g2 = ctx.createGain(); g2.gain.value = T.bell ? 0.35 : 0.15;
  o.connect(g); o2.connect(g2).connect(g);
  if (T.wobble) { o.frequency.setValueAtTime(freq * 0.97, t); o.frequency.linearRampToValueAtTime(freq, t + 0.15); }
  g.connect(delayIn);
  o.start(t); o2.start(t); o.stop(t + len + 0.1); o2.stop(t + len + 0.1);
}
function bass(freq, t, dur) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t + dur * 2);
  o.connect(g).connect(musicBus);
  o.start(t); o.stop(t + dur * 2 + 0.1);
}
// soft drums: kick on beats, hats in between (density 0..1)
function drums(t0, dur, density) {
  const beats = Math.round(dur * 2);           // ~120 bpm feel
  const step = dur / beats;
  for (let b = 0; b < beats; b++) {
    const t = t0 + b * step;
    if (b % 2 === 0 || density > 0.7) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * density, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.32);
    }
    if (density > 0.3) {
      const th = t + step / 2;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.03 * density, th); g.gain.exponentialRampToValueAtTime(0.0001, th + 0.05);
      src.connect(f).connect(g).connect(musicBus); src.start(th, Math.random()); src.stop(th + 0.06);
    }
  }
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
