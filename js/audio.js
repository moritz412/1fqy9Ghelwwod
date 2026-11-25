// Prozedurale Sounds über WebAudio – keine Audiodateien nötig.
let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.6;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.6;
}
export const isMuted = () => muted;

function noise(dur, freq, q = 1, vol = 0.5, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur);
}

function tone(freq, dur, type = 'sine', vol = 0.25, delay = 0, slideTo = null) {
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
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  dig(hard = 1) { noise(0.18 + hard * 0.03, 500 + hard * 700, 0.8, 0.45); },
  clank() { tone(900, 0.12, 'square', 0.08); noise(0.08, 3000, 2, 0.2, 'bandpass'); },
  drill() { tone(120, 0.35, 'sawtooth', 0.12, 0, 260); noise(0.35, 1800, 1, 0.25); },
  boom() { noise(0.9, 180, 0.7, 0.9); tone(70, 0.6, 'sine', 0.5, 0, 35); },
  gem() { [1318, 1760, 2093].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, i * 0.06)); },
  fossil() { [523, 659].forEach((f, i) => tone(f, 0.2, 'triangle', 0.15, i * 0.08)); },
  sonar() { tone(1200, 0.6, 'sine', 0.2, 0, 600); tone(1200, 0.6, 'sine', 0.08, 0.35, 600); },
  star() { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.5, 'triangle', 0.18, i * 0.1)); },
  fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sine', 0.18, i * 0.18)); },
  tick() { tone(1500, 0.04, 'square', 0.04); },
};

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch { /* iOS ohne Vibration */ }
}
