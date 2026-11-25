// Procedural surface textures (no downloads): hull panels, hazard stripes, vents, grime.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const cache = {};

function canvasTex(key, size, draw, repeat = 1) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache[key] = t;
  return t;
}

// Light hull panels: seams, rivets, small grime. Multiplied with material colour.
export function hullTexture() {
  return canvasTex('hull', 256, (g, S) => {
    const rnd = mulberry32(5);
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, S, S);
    // panels
    const cells = [[0, 0, 128, 96], [128, 0, 128, 96], [0, 96, 80, 160], [80, 96, 176, 80], [80, 176, 96, 80], [176, 176, 80, 80]];
    for (const [x, y, w, h] of cells) {
      const v = 232 + Math.floor(rnd() * 18);
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 2, y + 2, w - 4, h - 4);
      g.strokeStyle = 'rgba(70,75,85,0.55)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.fillStyle = 'rgba(90,95,105,0.6)';
      for (const [px, py] of [[6, 6], [w - 8, 6], [6, h - 8], [w - 8, h - 8]]) { g.beginPath(); g.arc(x + px, y + py, 1.8, 0, Math.PI * 2); g.fill(); }
    }
    // small vents and labels
    g.fillStyle = 'rgba(60,65,75,0.55)';
    for (let k = 0; k < 6; k++) g.fillRect(150, 20 + k * 7, 40, 3);
    g.fillStyle = 'rgba(47,201,168,0.8)'; g.fillRect(20, 120, 30, 5);
    g.fillStyle = 'rgba(255,179,71,0.85)'; g.fillRect(100, 200, 22, 5);
    // grime
    for (let k = 0; k < 120; k++) {
      g.fillStyle = `rgba(80,80,80,${0.03 + rnd() * 0.05})`;
      g.beginPath(); g.arc(rnd() * S, rnd() * S, 2 + rnd() * 10, 0, Math.PI * 2); g.fill();
    }
  });
}

// Dark metal with brushed lines and bolts.
export function metalTexture() {
  return canvasTex('metal', 256, (g, S) => {
    const rnd = mulberry32(8);
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { const v = 140 + Math.floor(rnd() * 40); g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(0, y, S, 1); }
    g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 2;
    g.strokeRect(2, 2, S - 4, S / 2 - 4); g.strokeRect(2, S / 2 + 2, S - 4, S / 2 - 4);
    g.fillStyle = 'rgba(40,40,40,0.8)';
    for (let x = 12; x < S; x += 40) for (const y of [8, S / 2 - 8, S / 2 + 8, S - 8]) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
  });
}

// Yellow/black hazard stripes.
export function hazardTexture() {
  return canvasTex('hazard', 128, (g, S) => {
    g.fillStyle = '#ffb000'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#1c1c1c';
    for (let k = -S; k < S * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k + 16 - S, S); g.lineTo(k - S, S); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let k = 0; k < 40; k++) g.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  });
}

// Vent grille.
export function ventTexture() {
  return canvasTex('vent', 128, (g, S) => {
    g.fillStyle = '#3a3e46'; g.fillRect(0, 0, S, S);
    for (let y = 6; y < S; y += 10) {
      g.fillStyle = '#16181c'; g.fillRect(8, y, S - 16, 5);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(8, y + 5, S - 16, 1);
    }
  });
}

// cached materials with the textures applied
const mats = {};
export function texMat(kind, color = 0xffffff, opts = {}) {
  const key = `${kind}-${color}-${JSON.stringify(opts)}`;
  if (mats[key]) return mats[key];
  const map = kind === 'hull' ? hullTexture() : kind === 'metal' ? metalTexture() : kind === 'hazard' ? hazardTexture() : ventTexture();
  mats[key] = new THREE.MeshStandardMaterial({ color, map, bumpMap: kind === 'hazard' ? null : map, bumpScale: 0.6, roughness: 0.5, metalness: kind === 'metal' ? 0.7 : 0.25, ...opts });
  return mats[key];
}
