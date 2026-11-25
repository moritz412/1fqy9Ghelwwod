// Environment: Nexus station hangar deck, space backdrop, market dock.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32 } from './noise.js';

export function buildEnvironment(scene, renderer) {
  scene.background = new THREE.Color(0x02030a);

  // ---- lights: harsh sun + cool station fill
  const hemi = new THREE.HemisphereLight(0x9fb8ff, 0x1a1c24, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.2);
  sun.position.set(30, 40, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0x66e6ff, 0.6);
  rim.position.set(-25, 12, -20);
  scene.add(rim);

  // ---- stars
  const rnd = mulberry32(4242);
  const starPos = new Float32Array(2500 * 3);
  for (let k = 0; k < 2500; k++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 400;
    const s = Math.sqrt(1 - u * u);
    starPos[k * 3] = r * s * Math.cos(th); starPos[k * 3 + 1] = Math.abs(r * u) * 0.9 + 10; starPos[k * 3 + 2] = r * s * Math.sin(th);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false })));

  // ---- gas giant
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(110, 48, 32),
    new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: 1, emissive: 0x2a1030, emissiveIntensity: 0.25 }),
  );
  planet.position.set(-260, 40, -330);
  planet.rotation.z = 0.35;
  scene.add(planet);

  // ---- hangar deck (round platform)
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(32, 33, 2, 64),
    [new THREE.MeshStandardMaterial({ color: 0x8a909c, metalness: 0.6, roughness: 0.5 }),
     new THREE.MeshStandardMaterial({ map: deckTexture(), metalness: 0.35, roughness: 0.65 }),
     new THREE.MeshStandardMaterial({ color: 0x30343d })],
  );
  deck.position.y = -1;
  deck.receiveShadow = true;
  scene.add(deck);

  // glowing edge
  const edge = new THREE.Mesh(new THREE.TorusGeometry(32, 0.12, 8, 128), new THREE.MeshBasicMaterial({ color: 0x66e6ff }));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.02;
  scene.add(edge);

  // railing posts
  const postGeo = new THREE.BoxGeometry(0.25, 1.4, 0.25);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe9edf2, metalness: 0.3, roughness: 0.4 });
  const posts = new THREE.InstancedMesh(postGeo, postMat, 48);
  const m = new THREE.Matrix4();
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * 31.4, 0.7, Math.sin(a) * 31.4);
    posts.setMatrixAt(k, m);
  }
  posts.castShadow = true;
  scene.add(posts);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(31.4, 0.08, 6, 128), postMat);
  rail.rotation.x = Math.PI / 2; rail.position.y = 1.4;
  scene.add(rail);

  // hangar lamp posts with glowing heads
  const lampPost = new THREE.CylinderGeometry(0.12, 0.16, 4, 8);
  const lampHead = new THREE.BoxGeometry(0.9, 0.25, 0.5);
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const post = new THREE.Mesh(lampPost, postMat);
    post.position.set(Math.cos(a) * 28, 2, Math.sin(a) * 28);
    post.castShadow = true;
    const head = new THREE.Mesh(lampHead, lampGlow);
    head.position.set(Math.cos(a) * 27.6, 4, Math.sin(a) * 27.6);
    head.lookAt(0, 4, 0);
    scene.add(post, head);
  }
  // floor guide lights leading to the market
  const guide = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.04, 0.18), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }), 10);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    m.makeRotationY(a).setPosition(Math.cos(a) * 23.5, 0.03, Math.sin(a) * 23.5);
    guide.setMatrixAt(k, m);
  }
  scene.add(guide);

  // dome ribs (glass dome suggested by thin arcs)
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, metalness: 0.5, roughness: 0.3, transparent: true, opacity: 0.35 });
  for (let k = 0; k < 8; k++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(33, 0.15, 6, 64, Math.PI), ribMat);
    rib.rotation.y = (k / 8) * Math.PI;
    scene.add(rib);
  }

  // ---- the station structure around/above the deck
  const station = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f5, metalness: 0.2, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.5, roughness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x66e6ff });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(90, 6, 16, 120), white);
  ring.rotation.x = Math.PI / 2;
  station.add(ring);
  const windows = new THREE.Mesh(new THREE.TorusGeometry(90, 6.1, 4, 240, Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0x66e6ff, wireframe: true, transparent: true, opacity: 0.25 }));
  windows.rotation.x = Math.PI / 2;
  station.add(windows);
  for (let k = 0; k < 6; k++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 84, 10), dark);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = (k / 6) * Math.PI;
    spoke.position.y = 0;
    station.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 16, 24), white);
  station.add(hub);
  const hubGlow = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.4, 8, 48), glow);
  hubGlow.rotation.x = Math.PI / 2;
  station.add(hubGlow);
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 14), new THREE.MeshStandardMaterial({ color: 0x1b2a5a, metalness: 0.7, roughness: 0.25, emissive: 0x0a1030 }));
    panel.position.set(s * 45, 30, 0);
    station.add(panel);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 30, 8), dark);
    mast.position.set(s * 12, 22, 0);
    mast.rotation.z = s * -0.6;
    station.add(mast);
  }
  station.position.set(0, 70, -40);
  station.rotation.x = 0.35;
  scene.add(station);

  // ---- two stations: Nexus-Ablage (sell) and Nexus-Shop (buy)
  function makeStation(pos, color, title, sub, extra) {
    const g = new THREE.Group();
    const r = pos.r;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.2, 0.18, 40), new THREE.MeshStandardMaterial({ color: 0xe9edf2, metalness: 0.3, roughness: 0.35 }));
    pad.position.y = 0.09;
    pad.receiveShadow = true;
    const ringMat = new THREE.MeshBasicMaterial({ color });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.3, 0.07, 8, 64), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.2;
    // terminal on the outer side, facing the deck centre
    const out = Math.atan2(pos.x, pos.z);
    const tx = Math.sin(out) * (r + 0.7), tz = Math.cos(out) * (r + 0.7);
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.6), white);
    terminal.position.set(tx, 1.1, tz);
    terminal.rotation.y = out;
    terminal.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshBasicMaterial({ map: labelTexture(title, sub, color) }));
    screen.position.set(Math.sin(out) * (r + 0.39), 1.4, Math.cos(out) * (r + 0.39));
    screen.rotation.y = out + Math.PI;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.6, 40, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = 20;
    g.add(pad, ring, terminal, screen, beam);
    if (extra) extra(g, out, r);
    g.position.set(pos.x, 0, pos.z);
    scene.add(g);
    return { ring, beam };
  }
  const ablage = makeStation(WORLD.dock, 0x6ff3f0, 'NEXUS', 'ABLAGE', (g, out, r) => {
    // recycler funnel
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.35, 1.1, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a909c, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
    funnel.position.set(-Math.sin(out + 0.9) * (r + 0.4), 1.6, -Math.cos(out + 0.9) * (r + 0.4));
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 8), dark);
    leg.position.set(funnel.position.x, 0.55, funnel.position.z);
    g.add(funnel, leg);
  });
  const shopSt = makeStation(WORLD.shop, 0xffb347, 'NEXUS', 'SHOP', (g, out, r) => {
    // workshop arch
    const archMat = new THREE.MeshStandardMaterial({ color: 0xffb347, metalness: 0.3, roughness: 0.4 });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 0.1, 0.12, 8, 40, Math.PI), archMat);
    arch.rotation.y = out + Math.PI / 2;
    arch.position.y = 0.1;
    arch.castShadow = true;
    g.add(arch);
  });

  // freighter that dumped the scrap (decor)
  const ship = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 5), dark);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 4), white);
  nose.rotation.z = -Math.PI / 2; nose.rotation.x = Math.PI / 4; nose.position.x = 9.4;
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 2, 12), new THREE.MeshBasicMaterial({ color: 0xff9a5c }));
  eng.rotation.z = Math.PI / 2; eng.position.x = -7.8;
  ship.add(body, nose, eng);
  ship.position.set(40, 26, 30);
  ship.rotation.y = -0.7;
  scene.add(ship);

  return {
    update(dt, t) {
      station.rotation.y += dt * 0.02;
      planet.rotation.y += dt * 0.004;
      ablage.ring.material.color.setHSL(0.5, 1, 0.55 + Math.sin(t * 3) * 0.1);
      ablage.beam.material.opacity = 0.1 + Math.sin(t * 2) * 0.03;
      shopSt.ring.material.color.setHSL(0.09, 1, 0.6 + Math.sin(t * 3 + 1) * 0.1);
      shopSt.beam.material.opacity = 0.1 + Math.sin(t * 2 + 1) * 0.03;
      ship.position.y = 26 + Math.sin(t * 0.4) * 0.6;
      guide.material.color.setHSL(0.5, 1, 0.45 + Math.sin(t * 2.5) * 0.15);
      // keep shadows centred on the action
    },
    sun,
  };
}

function planetTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const rnd = mulberry32(9);
  const cols = ['#c97a5a', '#e0a476', '#8f5a7a', '#5a3d6b', '#d98c5f', '#f0c49a', '#7a4a6a'];
  let y = 0;
  while (y < 256) {
    const h = 6 + rnd() * 26;
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    g.fillRect(0, y, 512, h + 1);
    y += h;
  }
  g.globalAlpha = 0.25;
  for (let k = 0; k < 40; k++) {
    g.fillStyle = cols[Math.floor(rnd() * cols.length)];
    g.beginPath();
    g.ellipse(rnd() * 512, rnd() * 256, 20 + rnd() * 60, 3 + rnd() * 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 0.8;
  g.fillStyle = '#b5504a';
  g.beginPath(); g.ellipse(330, 150, 26, 12, 0, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function deckTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#8b919c';
  g.fillRect(0, 0, 1024, 1024);
  const rnd = mulberry32(3);
  const step = 64;
  for (let y = 0; y < 1024; y += step) for (let x = 0; x < 1024; x += step) {
    const v = 130 + Math.floor(rnd() * 22);
    g.fillStyle = `rgb(${v},${v + 4},${v + 12})`;
    g.fillRect(x + 2, y + 2, step - 4, step - 4);
    g.fillStyle = 'rgba(40,44,52,0.6)';
    for (const [px, py] of [[6, 6], [step - 8, 6], [6, step - 8], [step - 8, step - 8]]) g.fillRect(x + px, y + py, 3, 3);
  }
  // hazard ring + markings
  g.strokeStyle = 'rgba(255,190,60,0.85)';
  g.lineWidth = 10;
  g.setLineDash([40, 30]);
  g.beginPath(); g.arc(512, 512, 410, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(102,230,255,0.5)';
  g.lineWidth = 4;
  g.beginPath(); g.arc(512, 512, 490, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function labelTexture(a, b, color = 0x66e6ff) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 188;
  const g = c.getContext('2d');
  g.fillStyle = '#05070c'; g.fillRect(0, 0, 256, 188);
  g.fillStyle = '#' + new THREE.Color(color).getHexString();
  g.font = 'bold 56px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(a, 128, 86);
  g.font = 'bold 34px system-ui, sans-serif';
  g.fillStyle = '#ffffff';
  g.fillText(b, 128, 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
