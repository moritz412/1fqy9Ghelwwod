// Environment: Nexus station hangar deck, space backdrop, market dock.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32 } from './noise.js';
import { texMat } from './textures.js';

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
  const starCol = new Float32Array(2500 * 3);
  for (let k = 0; k < 2500; k++) {
    const t = rnd();
    const c = t < 0.15 ? [0.7, 0.8, 1] : t < 0.25 ? [1, 0.85, 0.7] : [1, 1, 1];
    const b = 0.5 + rnd() * 0.5;
    starCol.set([c[0] * b, c[1] * b, c[2] * b], k * 3);
  }
  sg.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ vertexColors: true, size: 1.6, sizeAttenuation: false, fog: false })));
  // a few big bright stars
  const bigStars = new THREE.BufferGeometry();
  bigStars.setAttribute('position', new THREE.BufferAttribute(starPos.slice(0, 120 * 3), 3));
  scene.add(new THREE.Points(bigStars, new THREE.PointsMaterial({ color: 0xdfeaff, size: 3, sizeAttenuation: false, fog: false })));

  // ---- nebula clouds (soft additive sprites far away)
  const nebTex = softTexture();
  const nebulae = [
    [0x6a2c9a, -120, 120, -380, 260], [0x1f5fa0, 160, 90, -360, 220], [0xa03a5a, 300, 160, 100, 240],
    [0x2a7a8a, -330, 140, 120, 280], [0x5a2a8a, 60, 220, 330, 300],
  ];
  const nebSprites = [];
  for (const [col, x, y, z, size] of nebulae) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebTex, color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set(x, y, z);
    sp.scale.set(size, size * 0.6, 1);
    scene.add(sp);
    nebSprites.push(sp);
  }
  // ---- the sun: glowing disc in the direction of the key light
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebTex, color: 0xfff1d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunGlow.position.set(30, 40, 18).normalize().multiplyScalar(380);
  sunGlow.scale.set(90, 90, 1);
  const sunCore = sunGlow.clone();
  sunCore.material = sunGlow.material.clone();
  sunCore.material.color.setHex(0xffffff);
  sunCore.scale.set(24, 24, 1);
  scene.add(sunGlow, sunCore);

  // ---- gas giant
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(110, 48, 32),
    new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: 1, emissive: 0x2a1030, emissiveIntensity: 0.25 }),
  );
  planet.position.set(-260, 40, -330);
  planet.material.fog = false;
  planet.rotation.z = 0.35;
  scene.add(planet);

  // ---- hangar deck (round platform)
  const deckTopMat = new THREE.MeshStandardMaterial({ map: deckTexture(), metalness: 0.35, roughness: 0.65 });
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(32, 33, 2, 64),
    [new THREE.MeshStandardMaterial({ color: 0x8a909c, metalness: 0.6, roughness: 0.5 }),
     deckTopMat,
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
  station.visible = false;   // replaced by the player-built Nexus Prime (station.js)
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

  // ---- small outposts scattered around the deck edge (decor, some animated)
  const outposts = buildOutposts(scene, { white, dark, glow, postMat });

  // ---- landing pad for the lander
  {
    const padG = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.pad.r, WORLD.pad.r + 0.3, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x4a505c, metalness: 0.5, roughness: 0.5 }));
    base.position.y = 0.08; base.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(WORLD.pad.r - 0.35, 0.06, 6, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.18;
    const markMat = new THREE.MeshBasicMaterial({ color: 0xeef1f5 });
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 1.8), markMat); h1.position.set(-0.6, 0.17, 0);
    const h2 = h1.clone(); h2.position.x = 0.6;
    const h3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.25), markMat); h3.position.y = 0.17;
    padG.add(base, ring, h1, h2, h3);
    for (let k = 0; k < 8; k++) {
      const a2 = (k / 8) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffb347 : 0xffffff }));
      l.position.set(Math.cos(a2) * (WORLD.pad.r + 0.1), 0.2, Math.sin(a2) * (WORLD.pad.r + 0.1));
      padG.add(l);
    }
    padG.position.set(WORLD.pad.x, 0, WORLD.pad.z);
    padG.rotation.y = Math.atan2(-WORLD.pad.x, -WORLD.pad.z);
    scene.add(padG);
  }

  // ---- shuttle (used in cutscenes), parked out of sight by default
  const shuttle = makeShuttle();
  shuttle.visible = false;
  scene.add(shuttle);

  // ---- depth fog (deck far edge fades slightly)
  scene.fog = new THREE.Fog(0x070a14, 45, 140);

  // ---- floating dust motes in the hangar
  const MOTES = 260;
  const motePos = new Float32Array(MOTES * 3);
  const moteSeed = new Float32Array(MOTES);
  for (let k = 0; k < MOTES; k++) {
    motePos.set([(rnd() - 0.5) * 56, rnd() * 14, (rnd() - 0.5) * 56], k * 3);
    moteSeed[k] = rnd() * 100;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: nebTex, color: 0xcfe9ff, size: 0.18, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(motes);
  let moteDir = 0.12;
  let baseMoteSize = 0.18;

  // ---- blinking position lights on the dome ring
  const blinkMat = new THREE.MeshBasicMaterial({ color: 0xff4040 });
  const blinkGeo = new THREE.SphereGeometry(0.18, 8, 6);
  const blinkers = [];
  for (let k = 0; k < 12; k++) {
    const a2 = (k / 12) * Math.PI * 2;
    const b = new THREE.Mesh(blinkGeo, k % 2 ? blinkMat : new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
    b.position.set(Math.cos(a2) * 32.2, 0.35, Math.sin(a2) * 32.2);
    scene.add(b);
    blinkers.push(b);
  }

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

  // ---- deck themes (scenery per deck)
  const decoGroups = {};
  const THEMES = [
    { bg: 0x02030a, fog: 0x070a14, hemi: [0x9fb8ff, 0x1a1c24], sun: 0xfff3e0, deck: 0xffffff, motes: 0xcfe9ff, moteSize: 0.18, moteDir: 0.12,
      neb: [0x6a2c9a, 0x1f5fa0, 0xa03a5a, 0x2a7a8a, 0x5a2a8a], planet: ['#c97a5a', '#e0a476', '#8f5a7a', '#5a3d6b', '#d98c5f', '#f0c49a', '#7a4a6a'], sunGlow: 0xfff1d0 },
    { bg: 0x020814, fog: 0x0a1a2a, hemi: [0xbfe6ff, 0x1a2a3a], sun: 0xe8f4ff, deck: 0xd8ecff, motes: 0xffffff, moteSize: 0.26, moteDir: -0.6,
      neb: [0x1f5fa0, 0x2a8ab0, 0x6ab0e0, 0x1a4a8a, 0x3a7ac0], planet: ['#cfeaff', '#9fd0f0', '#6aa8d8', '#e8f6ff', '#4a88c0', '#b0dcf8'], sunGlow: 0xdff2ff, deco: 'ice' },
    { bg: 0x0d0702, fog: 0x1a0f05, hemi: [0xffd8a0, 0x2a1a0a], sun: 0xffc070, deck: 0xffe8c8, motes: 0xffc040, moteSize: 0.14, moteDir: 0.5,
      neb: [0xa05a1a, 0xc07a2a, 0x8a3a1a, 0xd09a3a, 0x6a2a0a], planet: ['#d9822b', '#f0b050', '#a04a1a', '#ffd080', '#7a3a10', '#c86a20'], sunGlow: 0xffd090, deco: 'rock' },
    { bg: 0x05020a, fog: 0x0f0518, hemi: [0xc0a0ff, 0x0a1a10], sun: 0xe0ffe0, deck: 0xe0d0ff, motes: 0x7cff9a, moteSize: 0.2, moteDir: 0.25,
      neb: [0x2a8a4a, 0x7a2aa0, 0x1a6a5a, 0xa03ac0, 0x3aa06a], planet: ['#3a9a5a', '#8a4ac0', '#5ad08a', '#2a1a4a', '#b07ae0', '#1a6a4a'], sunGlow: 0xd0ffd8, deco: 'alien' },
  ];
  function buildDeco(kind) {
    const g = new THREE.Group();
    const rr = mulberry32(kind.length * 31);
    if (kind === 'ice') {
      const mat = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x2a8ab0, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true });
      for (let k = 0; k < 26; k++) {
        const a = rr() * Math.PI * 2, r = 25.5 + rr() * 5;
        const h = 1.5 + rr() * 4.5;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.4 + rr() * 0.7, h, 5), mat);
        c.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
        c.rotation.set((rr() - 0.5) * 0.5, rr() * 6, (rr() - 0.5) * 0.5);
        c.castShadow = true;
        g.add(c);
      }
    } else if (kind === 'rock') {
      const mat = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.9, flatShading: true });
      const gold = new THREE.MeshStandardMaterial({ color: 0xffc040, metalness: 1, roughness: 0.25, emissive: 0x402000 });
      for (let k = 0; k < 18; k++) {
        const a = rr() * Math.PI * 2, r = 45 + rr() * 40;
        const s2 = 2 + rr() * 6;
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s2, 0), mat);
        m.position.set(Math.cos(a) * r, 5 + rr() * 30, Math.sin(a) * r);
        m.rotation.set(rr() * 6, rr() * 6, 0);
        m.userData.spin = (rr() - 0.5) * 0.2;
        const vein = new THREE.Mesh(new THREE.OctahedronGeometry(s2 * 0.35, 0), gold);
        vein.position.set(s2 * 0.8, 0, 0);
        m.add(vein);
        g.add(m);
      }
      for (let k = 0; k < 14; k++) {
        const a = rr() * Math.PI * 2, r = 26 + rr() * 4;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.6 + rr(), 2 + rr() * 3, 6), mat);
        sp.position.set(Math.cos(a) * r, 1.2, Math.sin(a) * r);
        sp.castShadow = true;
        g.add(sp);
      }
    } else if (kind === 'alien') {
      const stem = new THREE.MeshStandardMaterial({ color: 0x2a4a3a, roughness: 0.8 });
      for (let k = 0; k < 22; k++) {
        const a = rr() * Math.PI * 2, r = 25.5 + rr() * 5;
        const h = 1.5 + rr() * 3.5;
        const plant = new THREE.Group();
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, h, 6), stem);
        st.position.y = h / 2;
        st.rotation.z = (rr() - 0.5) * 0.4;
        const col = rr() < 0.5 ? 0x7cff9a : 0xc07aff;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25 + rr() * 0.35, 12, 8), new THREE.MeshBasicMaterial({ color: col }));
        bulb.position.y = h;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebTex, color: col, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.setScalar(2.2);
        glow.position.y = h;
        plant.add(st, bulb, glow);
        plant.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        plant.userData.sway = rr() * 6;
        g.add(plant);
      }
    }
    g.userData.kind = kind;
    scene.add(g);
    return g;
  }
  let currentDeco = null;
  let stormTarget = 0, storm = 0;
  function setTheme(i) {
    const th = THEMES[i % THEMES.length];
    scene.background = new THREE.Color(th.bg);
    scene.fog.color.setHex(th.fog);
    hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]);
    sun.color.setHex(th.sun);
    deckTopMat.color.setHex(th.deck);
    motes.material.color.setHex(th.motes);
    motes.material.size = th.moteSize;
    baseMoteSize = th.moteSize;
    moteDir = th.moteDir;
    nebSprites.forEach((sp, k) => sp.material.color.setHex(th.neb[k % th.neb.length]));
    sunGlow.material.color.setHex(th.sunGlow);
    planet.material.map = planetTexture(th.planet);
    planet.material.needsUpdate = true;
    for (const g of Object.values(decoGroups)) g.visible = false;
    currentDeco = null;
    if (th.deco) {
      if (!decoGroups[th.deco]) decoGroups[th.deco] = buildDeco(th.deco);
      decoGroups[th.deco].visible = true;
      currentDeco = decoGroups[th.deco];
    }
  }

  return {
    setTheme,
    setStorm(on) { stormTarget = on ? 1 : 0; },
    shuttle,
    update(dt, t) {
      station.rotation.y += dt * 0.02;
      planet.rotation.y += dt * 0.004;
      ablage.ring.material.color.setHSL(0.5, 1, 0.55 + Math.sin(t * 3) * 0.1);
      ablage.beam.material.opacity = 0.1 + Math.sin(t * 2) * 0.03;
      shopSt.ring.material.color.setHSL(0.09, 1, 0.6 + Math.sin(t * 3 + 1) * 0.1);
      shopSt.beam.material.opacity = 0.1 + Math.sin(t * 2 + 1) * 0.03;
      ship.position.y = 26 + Math.sin(t * 0.4) * 0.6;
      guide.material.color.setHSL(0.5, 1, 0.45 + Math.sin(t * 2.5) * 0.15);
      const mp = moteGeo.attributes.position;
      for (let k = 0; k < MOTES; k++) {
        const sd = moteSeed[k];
        mp.setX(k, mp.getX(k) + Math.sin(t * 0.2 + sd) * dt * 0.25);
        let ny = mp.getY(k) + dt * (moteDir - storm * 2.5) * (0.5 + (sd % 1));
        if (storm > 0.05) mp.setX(k, mp.getX(k) + dt * storm * 6);
        if (mp.getX(k) > 28) mp.setX(k, -28);
        if (ny > 14) ny -= 14; if (ny < 0) ny += 14;
        mp.setY(k, ny);
        mp.setZ(k, mp.getZ(k) + Math.cos(t * 0.17 + sd) * dt * 0.25);
      }
      mp.needsUpdate = true;
      blinkers.forEach((b, i) => { b.scale.setScalar(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 0.9))); });
      sunCore.material.opacity = 0.9 + Math.sin(t * 0.7) * 0.1;
      storm += (stormTarget - storm) * Math.min(1, dt * 0.8);
      scene.fog.near = 45 - storm * 40;
      scene.fog.far = 140 - storm * 105;
      motes.material.size = baseMoteSize * (1 + storm * 1.5);
      motes.material.opacity = 0.55 + storm * 0.3;
      outposts.update(dt, t);
      shuttle.userData.update(dt, t);
      if (currentDeco) {
        for (const c of currentDeco.children) {
          if (c.userData.spin) c.rotation.y += dt * c.userData.spin;
          if (c.userData.sway !== undefined) c.rotation.z = Math.sin(t * 0.8 + c.userData.sway) * 0.08;
        }
      }
      // keep shadows centred on the action
    },
    sun,
  };
}

function planetTexture(cols0) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const rnd = mulberry32(9);
  const cols = cols0 || ['#c97a5a', '#e0a476', '#8f5a7a', '#5a3d6b', '#d98c5f', '#f0c49a', '#7a4a6a'];
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

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ outposts
function buildOutposts(scene, m) {
  const anim = [];
  const tankMat = texMat('hull', 0xd8dde4, { metalness: 0.45 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff8a3a, metalness: 0.3, roughness: 0.5 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x2fc9a8, metalness: 0.3, roughness: 0.45 });
  const cont = [0x2f6fa0, 0xb04a3a, 0xd0a030, 0x3a8a5a, 0x6a6f7a].map((c) => texMat('metal', c, { metalness: 0.35, roughness: 0.6 }));
  const place = (g, angle, r) => { g.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r); g.rotation.y = -angle + Math.PI / 2; scene.add(g); return g; };
  const shadowAll = (g) => g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // 1) radar mast with rotating dish
  {
    const g = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 5, 8), m.postMat); mast.position.y = 2.5;
    const head = new THREE.Group(); head.position.y = 5.1;
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), new THREE.MeshStandardMaterial({ color: 0xeef1f5, metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide }));
    dish.rotation.x = -1.2;
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), m.dark); feed.position.set(0, 0.3, 0.45); feed.rotation.x = 1.2;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4040 })); lamp.position.y = 5.6;
    head.add(dish, feed);
    g.add(mast, head, lamp);
    shadowAll(g);
    place(g, 0.55, 27);
    anim.push((dt, t) => { head.rotation.y += dt * 0.6; lamp.scale.setScalar(0.7 + 0.3 * Math.sin(t * 1.2)); });
  }
  // 2) fuel tank farm
  {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 2.2, 6, 16), tankMat);
      tank.position.set(k * 1.9 - 1.9, 1.9, 0);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.06, 6, 24), orange);
      band.rotation.x = Math.PI / 2; band.position.set(k * 1.9 - 1.9, 1.6 + k * 0.3, 0);
      g.add(tank, band);
    }
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8), m.dark); pipe.rotation.z = Math.PI / 2; pipe.position.y = 0.4;
    g.add(pipe);
    shadowAll(g);
    place(g, 4.75, 27.5);
  }
  // 3) container stacks
  {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(2.6, 1.1, 1.1);
    let k = 0;
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3 - x % 2; y++) {
      const c = new THREE.Mesh(geo, cont[(k++ * 3) % cont.length]);
      c.position.set(x * 1.25 - 1.3, 0.55 + y * 1.1, (y % 2) * 0.2);
      c.rotation.y = (x + y) % 2 ? Math.PI / 2 : 0;
      g.add(c);
    }
    shadowAll(g);
    place(g, 2.35, 27);
  }
  // 4) cargo crane with moving arm
  {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), orange); tower.position.y = 3.5;
    const top = new THREE.Group(); top.position.y = 7;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 0.35), orange); jib.position.x = 2.5;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), m.white); cab.position.set(0, -0.4, 0);
    const trolley = new THREE.Group(); trolley.position.x = 4;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 4), m.dark); rope.position.y = -1.5;
    const hook = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.2), cont[0]); hook.position.y = -3.2;
    trolley.add(rope, hook);
    top.add(jib, cab, trolley);
    g.add(tower, top);
    shadowAll(g);
    place(g, 3.4, 28);
    anim.push((dt, t) => { top.rotation.y = Math.sin(t * 0.15) * 1.2; trolley.position.x = 3 + Math.sin(t * 0.3) * 1.6; });
  }
  // 5) repair bay with idle mini-bot
  {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 3), m.dark); floor.position.y = 0.06;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 24, Math.PI), teal); arch.position.y = 0.1;
    const arm = new THREE.Group(); arm.position.set(1.4, 0, -0.8);
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8), m.postMat); a1.position.y = 0.8;
    const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), m.postMat); a2.position.set(-0.4, 1.6, 0); a2.rotation.z = 1.1;
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe080 })); spark.position.set(-0.9, 1.35, 0);
    arm.add(a1, a2, spark);
    const mini = new THREE.Group();
    const mb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5), m.white); mb.position.y = 0.35;
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.35), m.white); mh.position.y = 0.8;
    const ms = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.25), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 })); ms.position.set(0, 0.8, 0.18);
    mini.add(mb, mh, ms);
    g.add(floor, arch, arm, mini);
    shadowAll(g);
    place(g, 4.3, 26.5);
    anim.push((dt, t) => { spark.scale.setScalar(0.7 + 0.3 * Math.sin(t * 2.5)); arm.rotation.y = Math.sin(t * 1.5) * 0.3; mh.rotation.y = Math.sin(t * 0.7) * 0.4; });
  }
  // 6) beacon pylons with pulsing lights
  for (const [ang, col] of [[5.2, 0x6ff3f0], [5.75, 0xffb347], [0.05, 0xb48cff]]) {
    const g = new THREE.Group();
    const pyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 3, 6), m.white); pyl.position.y = 1.5;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: col })); orb.position.y = 3.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 24), new THREE.MeshBasicMaterial({ color: col })); ring.position.y = 3.2;
    g.add(pyl, orb, ring);
    shadowAll(g);
    place(g, ang, 28.5);
    anim.push((dt, t) => { ring.rotation.x += dt * 1.5; ring.rotation.y += dt; orb.scale.setScalar(1 + Math.sin(t * 3 + ang) * 0.15); });
  }
  // 7) solar panel array
  {
    const g = new THREE.Group();
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1b2a5a, metalness: 0.8, roughness: 0.25, emissive: 0x0a1030 });
    for (let k = 0; k < 4; k++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), m.postMat); leg.position.set(k * 1.6 - 2.4, 0.6, 0);
      const pan = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.8), panelMat); pan.position.set(k * 1.6 - 2.4, 1.25, 0); pan.rotation.x = -0.5;
      g.add(leg, pan);
    }
    shadowAll(g);
    place(g, 3.9, 28.5);
  }
  return { update(dt, t) { anim.forEach((f) => f(dt, t)); } };
}

// ------------------------------------------------------------------ lander for cutscenes (lunar-module style)
export function makeShuttle() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a040, metalness: 0.9, roughness: 0.35, emissive: 0x2a1800 });
  const foil = new THREE.MeshStandardMaterial({ color: 0xb08030, metalness: 1, roughness: 0.55 });
  const white = texMat('hull', 0xe8eaee, { flatShading: true });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8a909a, metalness: 0.6, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.7, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a2a3a, metalness: 0.9, roughness: 0.05, emissive: 0x0a4a5a, emissiveIntensity: 0.6 });

  // descent stage: octagonal gold-foil box
  const descent = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.3, 8), gold);
  descent.position.y = 1.65;
  descent.rotation.y = Math.PI / 8;
  const foilBand = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.35, 8), foil);
  foilBand.position.y = 1.4; foilBand.rotation.y = Math.PI / 8;
  g.add(descent, foilBand);
  // engine bell under the descent stage + flame
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 0.7, 16, 1, true), dark);
  bell.position.y = 0.75;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = Math.PI;
  flame.position.y = -0.85;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.rotation.x = Math.PI; core.position.y = -0.2;
  g.add(bell, flame, core);
  // four splayed legs with foot pads
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const leg = new THREE.Group();
    leg.rotation.y = -a;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), grey);
    strut.position.set(2.0, 1.1, 0); strut.rotation.z = 0.55;
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), grey);
    brace.position.set(1.65, 1.6, 0); brace.rotation.z = -0.9;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.1, 16), grey);
    pad.position.set(2.55, 0.05, 0);
    leg.add(strut, brace, pad);
    g.add(leg);
  }
  // ascent stage: angular cabin
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 1.5, 6), white);
  cabin.position.y = 3.05;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.15, 0.45, 6), white);
  roof.position.y = 4.02;
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.12), grey);
  hatch.position.set(0, 2.75, 1.25);
  const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.08), glass); win1.position.set(-0.42, 3.45, 1.12); win1.rotation.y = -0.25; win1.rotation.x = -0.3;
  const win2 = win1.clone(); win2.position.x = 0.42; win2.rotation.y = 0.25;
  g.add(cabin, roof, hatch, win1, win2);
  // antenna dish + mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), grey);
  mast.position.set(-0.6, 4.55, -0.3);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0xeef1f5, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.3 }));
  dish.position.set(-0.6, 5.0, -0.3); dish.rotation.set(-0.9, 0.6, 0);
  g.add(mast, dish);
  // RCS thruster quads on the cabin corners
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const q = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), grey);
    q.position.set(Math.cos(a) * 1.3, 3.5, Math.sin(a) * 1.3);
    g.add(q);
  }
  // nexus stripe + beacon light
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0x6ff3f0 }));
  stripe.rotation.x = Math.PI / 2; stripe.position.y = 2.4; stripe.rotation.z = Math.PI / 6;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  beacon.position.y = 4.3;
  g.add(stripe, beacon);
  // ramp (folds down at the front)
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.9), grey);
  ramp.position.set(0, 1.15, 2.2);
  ramp.rotation.x = 0.55;
  g.add(ramp);

  g.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  g.userData.thrust = 0;
  g.userData.ramp = ramp;
  g.userData.update = (dt, t) => {
    const th = g.userData.thrust;
    flame.visible = core.visible = th > 0.05;
    flame.scale.set(1, 0.2 + th * (1 + Math.sin(t * 45) * 0.12), 1);
    flame.material.opacity = 0.3 + th * 0.55;
    core.scale.set(1, 0.3 + th * (1 + Math.sin(t * 60) * 0.2), 1);
    beacon.scale.setScalar(0.7 + 0.3 * Math.sin(t * 2));
  };
  return g;
}
