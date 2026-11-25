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

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
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

// ---------------------------------------------------------------- generative music
const CHORDS = [
  [57, 60, 64, 67, 71],   // Am9
  [53, 57, 60, 64, 67],   // Fmaj9
  [48, 55, 59, 62, 64],   // Cmaj9
  [55, 59, 62, 66, 69],   // G(add)
];
const SCALE = [69, 71, 72, 74, 76, 79, 81, 83, 84, 86, 88];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
let delayIn = null;

function startMusic() {
  // stereo-ish delay for the arpeggios
  const d = ctx.createDelay(1.5); d.delayTime.value = 0.42;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
  d.connect(lp).connect(fb).connect(d);
  lp.connect(musicBus);
  delayIn = ctx.createGain(); delayIn.gain.value = 0.6;
  delayIn.connect(d); delayIn.connect(musicBus);

  let bar = 0;
  let next = ctx.currentTime + 0.3;
  const BAR = 8;
  const schedule = () => {
    while (next < ctx.currentTime + 1.5) {
      const chord = CHORDS[bar % CHORDS.length];
      pad(chord, next, BAR);
      // sparse arpeggio
      const steps = 16;
      for (let s = 0; s < steps; s++) {
        if (Math.random() < 0.35) {
          const note = SCALE[Math.floor(Math.random() * SCALE.length)];
          pluck(midi(note), next + s * (BAR / steps), 0.05 + Math.random() * 0.04);
        }
      }
      if (bar % 2 === 0) bass(midi(chord[0] - 12), next, BAR);
      next += BAR;
      bar++;
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 500);
}

function pad(chord, t, dur) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 2.5);
  g.gain.linearRampToValueAtTime(0.04, t + dur - 1.5);
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
  f.connect(g).connect(musicBus);
  for (const m of chord.slice(0, 4)) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = midi(m); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 1.6);
  }
}
function pluck(freq, t, vol) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
  const g2 = ctx.createGain(); g2.gain.value = 0.15;
  o.connect(g); o2.connect(g2).connect(g);
  g.connect(delayIn);
  o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3);
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
  click() { tone(1200, 0.03, 0.04, 'square'); },
  beep() { tone(1400, 0.05, 0.04, 'sine'); tone(1800, 0.05, 0.03, 'sine', 0.06); },
};

export function vibrate(ms) {
  if (settings.sfx && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
}
