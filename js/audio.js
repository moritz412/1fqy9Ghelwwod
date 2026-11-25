// Tiny synthesized sound effects (no audio files needed).
let ctx = null;
let master = null;
let noiseBuf = null;
export let muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.6;
}

function noise(dur, freq, vol, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur);
}

function tone(freq, dur, vol = 0.2, type = 'sine', delay = 0, slideTo = null) {
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
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  grab(size) { noise(0.12 + size * 0.05, 1800 - size * 250, 0.25 + size * 0.06, 'bandpass'); tone(180 - size * 15, 0.08, 0.06, 'triangle'); },
  empty() { tone(220, 0.08, 0.05, 'sine'); },
  find(tier) {
    const base = [880, 988, 1175, 1319, 1568, 1760][tier] || 880;
    tone(base, 0.09, 0.1 + tier * 0.02, 'square');
    if (tier >= 1) tone(base * 1.5, 0.18, 0.1, 'square', 0.07);
    if (tier >= 3) [1, 1.25, 1.5, 2].forEach((m, k) => tone(base * m, 0.3, 0.1, 'triangle', 0.15 + k * 0.07));
  },
  sell() { [660, 880, 1320].forEach((f, k) => tone(f, 0.12, 0.12, 'square', k * 0.06)); },
  upgrade() { [392, 523, 659, 784, 1047].forEach((f, k) => tone(f, 0.25, 0.12, 'triangle', k * 0.06)); },
  full() { tone(196, 0.2, 0.12, 'sawtooth'); tone(147, 0.25, 0.12, 'sawtooth', 0.15); },
  ping(heat) { tone(260 + heat * 900, 0.12, 0.05 + heat * 0.06, 'sine'); },
  core() { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, k) => tone(f, 0.8, 0.12, 'sine', k * 0.11)); noise(1.2, 3000, 0.15, 'highpass'); },
  deny() { tone(150, 0.15, 0.1, 'sawtooth'); },
};

export function vibrate(ms) {
  if (!muted && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
}
