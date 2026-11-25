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
  hit(hardness) { noise(0.08, 2200 - hardness * 280, 0.5); tone(140 - hardness * 12, 0.07, 0.15, 'triangle'); },
  breakBlock(hardness) { noise(0.22, 1600 - hardness * 200, 0.6); },
  ping(heat) { tone(260 + heat * 900, 0.18, 0.08 + heat * 0.08, 'sine'); },
  coin() { tone(988, 0.08, 0.2, 'square'); tone(1319, 0.25, 0.2, 'square', 0.08); },
  relic() { [523, 659, 784].forEach((f, k) => tone(f, 0.3, 0.15, 'triangle', k * 0.07)); },
  fossil() { [392, 494, 587, 784].forEach((f, k) => tone(f, 0.35, 0.13, 'sine', k * 0.06)); },
  crystal() { [523, 659, 784, 1047, 1319, 1568].forEach((f, k) => tone(f, 0.6, 0.14, 'sine', k * 0.09)); },
  bomb() { noise(0.9, 400, 0.9); tone(90, 0.6, 0.5, 'sine', 0, 30); },
  deny() { tone(150, 0.15, 0.12, 'sawtooth'); },
  gameOver() { [392, 330, 262, 196].forEach((f, k) => tone(f, 0.4, 0.15, 'triangle', k * 0.18)); },
};

export function vibrate(ms) {
  if (!muted && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
}
