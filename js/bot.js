// The Nexus-Bot: player character, built from primitives after the reference design
// (white rounded body, screen face with cyan eyes, teal ears & hands, grey tracks, cyan light bar).
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const WHITE = 0xf3f4f2, TEAL = 0x2fc9a8, GREY = 0x5d6168, DARK = 0x2c2f35, CYAN = 0x6ff3f0;

export class NexusBot {
  constructor() {
    const g = this.group = new THREE.Group();
    const white = this.bodyMat = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.55, metalness: 0.05 });
    this.earMat = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.5 });
    const teal = this.tealMat = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.5 });
    const grey = this.greyMat = new THREE.MeshStandardMaterial({ color: GREY, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.6 });
    const glow = this.glowMat = new THREE.MeshBasicMaterial({ color: CYAN });
    const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
    const up = this.upper = new THREE.Group();   // everything above the chassis
    g.add(up);

    // ---- base with tracks
    const base = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.3, 0.5, 4, 0.08), white));
    base.position.y = 0.2;
    up.add(base);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.01), glow);
    bar.position.set(0, 0.16, 0.255);
    up.add(bar);

    // ---- chassis variants
    this.chassis = {};
    // tracks
    const tracksG = this.chassis.tracks = new THREE.Group();
    this.tracks = [];
    for (const s of [-1, 1]) {
      const tr = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.26, 0.58, 4, 0.08), grey));
      tr.position.set(s * 0.36, 0.13, 0);
      tracksG.add(tr);
      this.tracks.push(tr);
    }
    // wheels
    const wheelsG = this.chassis.wheels = new THREE.Group();
    this.wheels = [];
    const tyre = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 20);
    const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.13, 12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Group();
      const t = shadow(new THREE.Mesh(tyre, grey));
      const h = new THREE.Mesh(hubGeo, teal);
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.2, 0.03), dark);
      t.rotation.z = Math.PI / 2; h.rotation.z = Math.PI / 2; spoke.rotation.z = Math.PI / 2;
      w.add(t, h, spoke);
      w.position.set(sx * 0.37, 0.14, sz * 0.19);
      wheelsG.add(w);
      this.wheels.push(w);
    }
    // walking legs (feet)
    const feetG = this.chassis.feet = new THREE.Group();
    this.legs2 = [];
    const thighG = new THREE.CylinderGeometry(0.055, 0.05, 0.2, 10);
    const shinG = new THREE.CylinderGeometry(0.05, 0.045, 0.2, 10);
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.17, 0.47, 0);
      const jh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), grey);
      const thigh = shadow(new THREE.Mesh(thighG, white)); thigh.position.y = -0.1;
      const knee = new THREE.Group(); knee.position.y = -0.2;
      const jk = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), grey);
      const shin = shadow(new THREE.Mesh(shinG, white)); shin.position.y = -0.1;
      const foot = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.06, 0.24, 2, 0.025), teal)); foot.position.set(0, -0.21, 0.04);
      knee.add(jk, shin, foot);
      hip.add(jh, thigh, knee);
      feetG.add(hip);
      this.legs2.push({ hip, knee, side: sx });
    }
    // spider legs
    const spiderG = this.chassis.spider = new THREE.Group();
    this.legs6 = [];
    const upperG = new THREE.CylinderGeometry(0.035, 0.03, 0.34, 8); upperG.translate(0, 0.17, 0);
    const lowerG = new THREE.CylinderGeometry(0.03, 0.012, 0.62, 8); lowerG.translate(0, -0.31, 0);
    let li = 0;
    for (const sx of [-1, 1]) for (const zz of [-0.17, 0, 0.17]) {
      const root = new THREE.Group();
      root.position.set(sx * 0.26, 0.42, zz);
      root.rotation.y = sx * (Math.PI / 2) - sx * zz * 2.2;   // point outward, fanned
      const hip = new THREE.Group();
      const seg1 = shadow(new THREE.Mesh(upperG, grey));
      seg1.rotation.x = 0.9;                                  // up and out
      const knee = new THREE.Group();
      knee.position.set(0, Math.cos(0.9) * 0.34, Math.sin(0.9) * 0.34);
      const kj = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), teal);
      const seg2 = shadow(new THREE.Mesh(lowerG, dark));
      seg2.rotation.x = -0.25;
      knee.add(kj, seg2);
      hip.add(seg1, knee);
      root.add(hip);
      spiderG.add(root);
      this.legs6.push({ root, hip, base: root.rotation.y, phase: (li % 2) * Math.PI + (sx > 0 ? Math.PI : 0) });
      li++;
    }
    for (const k of Object.keys(this.chassis)) { this.chassis[k].visible = k === 'tracks'; g.add(this.chassis[k]); }
    this.lift = 0;
    this.walk = 0;
    const plate = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.05, 0.4, 2, 0.02), white));
    plate.position.y = 0.38;
    up.add(plate);

    // ---- torso
    const torso = this.torso = new THREE.Group();
    torso.position.y = 0.4;
    up.add(torso);
    const body = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.32, 0.4, 4, 0.1), white));
    body.position.y = 0.2;
    torso.add(body);
    const holeGeo = new THREE.CircleGeometry(0.014, 10);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
      const h = new THREE.Mesh(holeGeo, dark);
      h.position.set(-0.08 + c * 0.04, 0.23 - r * 0.045, 0.201);
      torso.add(h);
    }

    // ---- arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.3, 0.24, 0);
      torso.add(shoulder);
      const joint = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16), grey));
      joint.rotation.z = Math.PI / 2;
      shoulder.add(joint);
      const upper = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), white));
      upper.position.set(s * 0.04, -0.08, 0);
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.set(s * 0.04, -0.16, 0);
      shoulder.add(elbow);
      const lower = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.16, 12), white));
      lower.position.y = -0.08;
      elbow.add(lower);
      const hand = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), teal));
      hand.position.y = -0.18;
      elbow.add(hand);
      this.arms.push({ shoulder, elbow, hand, side: s });
    }

    // ---- neck & head
    const neck = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.08, 0.1, 2, 0.02), new THREE.MeshStandardMaterial({ color: 0xcfd2d4, roughness: 0.6 })));
    neck.position.y = 0.4;
    torso.add(neck);
    const head = this.head = new THREE.Group();
    head.position.y = 0.62;
    torso.add(head);
    const shell = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.46, 0.34, 5, 0.09), white));
    head.add(shell);
    // face screen
    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 256; this.faceCanvas.height = 176;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.34), new THREE.MeshBasicMaterial({ map: this.faceTex }));
    screen.position.set(0, -0.02, 0.172);
    head.add(screen);
    const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16), dark);
    cam.rotation.x = Math.PI / 2;
    cam.position.set(0, 0.185, 0.17);
    head.add(cam);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    led.position.set(0.05, 0.185, 0.172);
    head.add(led);
    for (const s of [-1, 1]) {
      const ear = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.2, 0.12, 3, 0.02), this.earMat));
      ear.position.set(s * 0.345, 0, 0);
      head.add(ear);
    }

    // ---- upgrade attachments
    this.antenna = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), grey);
    stick.position.y = 0.09;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), glow);
    tip.position.y = 0.19;
    this.antenna.add(stick, tip);
    this.antenna.position.set(0.22, 0.23, 0);
    this.antenna.visible = false;
    head.add(this.antenna);
    this.dish = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), new THREE.MeshStandardMaterial({ color: 0xdde3ea, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.3 }));
    this.dish.position.set(-0.2, 0.28, 0);
    this.dish.rotation.x = -0.6;
    this.dish.visible = false;
    head.add(this.dish);

    this.pack = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.34, 0.2, 3, 0.05), new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.5 })));
    this.pack.position.set(0, 0.2, -0.28);
    this.pack.visible = false;
    torso.add(this.pack);
    const packLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.01), glow);
    packLight.position.set(0, 0.08, -0.105);
    this.pack.add(packLight);

    this.hover = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.04, 24), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.hover.position.y = 0.02;
    this.hover.visible = false;
    g.add(this.hover);

    // ---- tool heads
    this.tools = {};
    const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.7, roughness: 0.3 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xffb347, metalness: 0.3, roughness: 0.45 });
    // crane: post on the back, boom over the head, claw hanging in front
    {
      const c = this.tools.crane = new THREE.Group();
      const post = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.07), orange)); post.position.set(0.2, 0.55, -0.24);
      const boom = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), orange)); boom.position.set(0.2, 0.93, 0.18);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), dark); cable.position.set(0.2, 0.93, 0.6);
      const claw = new THREE.Group(); claw.position.set(0.2, 0.35, 0.6);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), metal);
      claw.add(hub);
      const fingers = [];
      for (let k = 0; k < 3; k++) {
        const f = new THREE.Group(); f.rotation.y = (k / 3) * Math.PI * 2;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.025), metal); seg.position.set(0, -0.07, 0.05);
        f.add(seg); claw.add(f); fingers.push(seg);
      }
      c.add(post, boom, cable, claw);
      c.userData = { claw, cable, fingers };
      torso.add(c);
    }
    // vacuum: tank on the back, hose to a nozzle at the front
    {
      const v = this.tools.vacuum = new THREE.Group();
      const tank = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 16), orange)); tank.position.set(0, 0.2, -0.32);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 16), metal); cap.position.set(0, 0.42, -0.32);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.12, 0.1, -0.32), new THREE.Vector3(0.36, 0.08, -0.12), new THREE.Vector3(0.38, -0.08, 0.25), new THREE.Vector3(0.16, -0.22, 0.5),
      ]);
      const hose = shadow(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8, false), dark));
      const nozzle = new THREE.Group(); nozzle.position.set(0.14, -0.24, 0.52);
      const cone = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.11, 0.16, 14, 1, true), metal)); cone.rotation.x = 0.9;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 20), glow); ring.position.set(0, -0.05, 0.06); ring.rotation.x = 0.9 + Math.PI / 2;
      nozzle.add(cone, ring);
      v.add(tank, cap, hose, nozzle);
      v.userData = { nozzle, ring };
      torso.add(v);
    }
    // drill: replaces the right hand
    {
      const d = this.tools.drill = new THREE.Group();
      const bit = new THREE.Group();
      const cone = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 14), metal)); cone.rotation.x = Math.PI; cone.position.y = -0.28;
      for (let k = 0; k < 4; k++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.1 - k * 0.02, 0.016, 6, 16), orange);
        r.rotation.x = Math.PI / 2; r.position.y = -0.08 - k * 0.1;
        bit.add(r);
      }
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12), orange);
      bit.add(cone);
      d.add(collar, bit);
      d.position.y = -0.18;
      d.userData = { bit };
      this.arms[1].elbow.add(d);
    }
    for (const t of Object.values(this.tools)) t.visible = false;
    this.toolId = 'arms';
    this.toolT = 0;

    g.scale.setScalar(1.25);

    // ---- animation state
    this.mood = 'normal';
    this.moodTimer = 0;
    this.blink = 0;
    this.nextBlink = 2;
    this.grabT = 0;
    this.time = 0;
    this.lookX = 0;
    this.drawFace();
  }

  // Visual changes for upgrades.
  applyUpgrades(lv) {
    const handScale = [1, 1.25, 1.5, 1.8, 2.1, 2.5][lv.hands] || 1;
    const handColor = [TEAL, 0x2fc9a8, 0x34b3e0, 0xffb347, 0xb48cff, 0x66e6ff][lv.hands] || TEAL;
    this.arms.forEach((a) => { a.hand.scale.setScalar(handScale); a.hand.material.color.setHex(handColor); });
    const trackColor = [GREY, 0x3e4a5a, 0x2a6f8a, 0x1fb3c9][lv.drive] || GREY;
    this.greyMat.color.setHex(trackColor);
    this.hover.visible = lv.drive >= 2;
    this.pack.visible = lv.cargo >= 1;
    this.pack.scale.setScalar(1 + lv.cargo * 0.18);
    this.antenna.visible = lv.scanner >= 1;
    this.dish.visible = lv.scanner >= 3;
    this.linkGlow = !!lv.link;
    this.glowMat.color.setHex(lv.link ? 0xb48cff : (this.skinGlow || CYAN));
  }

  setTool(id) {
    for (const [k, t] of Object.entries(this.tools)) t.visible = k === id;
    this.toolId = id;
    this.arms[1].hand.visible = id !== 'drill';
  }

  setChassis(id) {
    for (const k of Object.keys(this.chassis)) this.chassis[k].visible = k === id;
    this.chassisId = id;
    this.lift = { tracks: 0, wheels: 0.03, feet: 0.36, spider: 0.22 }[id] || 0;
    this.upper.position.y = this.lift;
  }

  setSkin(sk) {
    this.bodyMat.color.setHex(sk.body);
    this.bodyMat.metalness = sk.metal ? 0.8 : 0.05;
    this.bodyMat.roughness = sk.metal ? 0.25 : 0.55;
    this.bodyMat.emissive.setHex(sk.holo ? 0x2a8a9a : 0x000000);
    this.bodyMat.transparent = !!sk.holo;
    this.bodyMat.opacity = sk.holo ? 0.75 : 1;
    this.bodyMat.needsUpdate = true;
    this.earMat.color.setHex(sk.ear);
    this.skinGlow = sk.glow;
    this.eyeColor = '#' + new THREE.Color(sk.glow).getHexString();
    if (!this.linkGlow) this.glowMat.color.setHex(sk.glow);
    this.drawFace();
  }

  setMood(m, duration = 1.5) {
    if (this.mood !== m) { this.mood = m; this.drawFace(); }
    this.moodTimer = duration;
  }

  drawFace() {
    const c = this.faceCanvas.getContext('2d');
    const W = 256, H = 176;
    c.fillStyle = '#05070a';
    c.fillRect(0, 0, W, H);
    c.fillStyle = this.eyeColor || '#6ff3f0';
    c.strokeStyle = this.eyeColor || '#6ff3f0';
    c.lineCap = 'round';
    const lx = 88 + this.lookX * 14, rx = 168 + this.lookX * 14, ey = 92;
    const eye = (x, h) => {
      const w = 34;
      c.beginPath();
      c.roundRect(x - w / 2, ey - h / 2, w, h, w / 2);
      c.fill();
    };
    if (this.blink > 0) {
      c.lineWidth = 8;
      c.beginPath(); c.moveTo(lx - 18, ey); c.lineTo(lx + 18, ey); c.moveTo(rx - 18, ey); c.lineTo(rx + 18, ey); c.stroke();
    } else if (this.mood === 'happy') {
      c.lineWidth = 10;
      c.beginPath(); c.arc(lx, ey + 10, 18, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.beginPath(); c.arc(rx, ey + 10, 18, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else if (this.mood === 'love') {
      for (const x of [lx, rx]) {
        c.beginPath();
        c.moveTo(x, ey + 22);
        c.bezierCurveTo(x - 34, ey - 4, x - 14, ey - 30, x, ey - 10);
        c.bezierCurveTo(x + 14, ey - 30, x + 34, ey - 4, x, ey + 22);
        c.fill();
      }
    } else if (this.mood === 'work') {
      c.lineWidth = 9;
      c.beginPath(); c.moveTo(lx - 16, ey - 12); c.lineTo(lx + 8, ey); c.lineTo(lx - 16, ey + 12); c.stroke();
      c.beginPath(); c.moveTo(rx + 16, ey - 12); c.lineTo(rx - 8, ey); c.lineTo(rx + 16, ey + 12); c.stroke();
    } else if (this.mood === 'sad') {
      eye(lx, 40); eye(rx, 40);
      c.fillStyle = '#05070a';
      c.fillRect(lx - 20, ey - 26, 40, 16); c.fillRect(rx - 20, ey - 26, 40, 16);
    } else if (this.mood === 'curious') {
      eye(lx, 64); eye(rx, 52);
      c.lineWidth = 8;
      c.beginPath(); c.moveTo(rx - 22, ey - 44); c.lineTo(rx + 26, ey - 40); c.stroke();
    } else {
      eye(lx, 64); eye(rx, 64);
    }
    this.faceTex.needsUpdate = true;
  }

  // Trigger a grab animation.
  grab() { this.grabT = 0.28; this.toolT = 0.35; }

  update(dt, moving) {
    this.time += dt;
    const t = this.time;

    // face
    this.nextBlink -= dt;
    if (this.blink > 0) { this.blink -= dt; if (this.blink <= 0) this.drawFace(); }
    else if (this.nextBlink <= 0) { this.blink = 0.12; this.nextBlink = 2 + Math.random() * 3; this.drawFace(); }
    if (this.moodTimer > 0) { this.moodTimer -= dt; if (this.moodTimer <= 0 && this.mood !== 'normal') { this.mood = 'normal'; this.drawFace(); } }

    // body bob & arms
    const bob = moving ? Math.sin(t * 14) * 0.012 : Math.sin(t * 2) * 0.006;
    this.torso.position.y = 0.4 + bob;
    this.head.rotation.z = moving ? Math.sin(t * 7) * 0.03 : Math.sin(t * 1.3) * 0.02;
    this.grabT = Math.max(0, this.grabT - dt);
    const g = this.grabT > 0 ? Math.sin((this.grabT / 0.28) * Math.PI) : 0;
    for (const a of this.arms) {
      const idle = moving ? Math.sin(t * 10 + a.side) * 0.35 : Math.sin(t * 1.6 + a.side) * 0.08;
      a.shoulder.rotation.x = -g * 1.6 + idle;
      a.elbow.rotation.x = -g * 0.9 - 0.25;
      a.shoulder.rotation.z = a.side * (0.12 + g * 0.1);
      if (this.toolId === 'drill' && a === this.arms[1]) {
        a.shoulder.rotation.x = -1.25 - g * 0.35 + idle * 0.2;   // hold the drill forward
        a.elbow.rotation.x = -0.15;
      }
    }
    for (const tr of this.tracks) tr.position.y = 0.13 + (moving ? Math.abs(Math.sin(t * 20)) * 0.006 : 0);
    // tool animations
    this.toolT = Math.max(0, this.toolT - dt);
    const tk = this.toolT > 0 ? Math.sin((this.toolT / 0.35) * Math.PI) : 0;
    if (this.toolId === 'crane') {
      const u = this.tools.crane.userData;
      const drop = 0.35 - tk * 0.45;
      u.claw.position.y = drop;
      u.cable.scale.y = 0.93 - drop;
      u.cable.position.y = (0.93 + drop) / 2;
      u.fingers.forEach((f) => { f.rotation.x = -0.4 + tk * 0.7; });
      u.claw.rotation.y += dt * 0.5;
    } else if (this.toolId === 'vacuum') {
      const u = this.tools.vacuum.userData;
      u.nozzle.position.x = 0.14 + Math.sin(t * 40) * 0.004 * (tk * 4 + 0.3);
      u.ring.scale.setScalar(1 + tk * 0.5);
    } else if (this.toolId === 'drill') {
      this.tools.drill.userData.bit.rotation.y += dt * (4 + tk * 60);
    }
    if (moving) this.walk += dt * (this.chassisId === 'spider' ? 14 : this.chassisId === 'feet' ? 9 : 12);
    const w = this.walk;
    if (this.chassisId === 'wheels') for (const wh of this.wheels) wh.rotation.x = w * 1.4;
    if (this.chassisId === 'feet') {
      for (const L of this.legs2) {
        const ph = w + (L.side > 0 ? Math.PI : 0);
        L.hip.rotation.x = moving ? Math.sin(ph) * 0.55 : 0;
        L.knee.rotation.x = moving ? Math.max(0, -Math.sin(ph)) * 0.9 : 0;
      }
      this.upper.position.y = this.lift + (moving ? Math.abs(Math.cos(w)) * 0.03 : 0);
    }
    if (this.chassisId === 'spider') {
      for (const L of this.legs6) {
        const ph = w + L.phase;
        L.root.rotation.y = L.base + (moving ? Math.sin(ph) * 0.35 : Math.sin(t * 1.5 + L.phase) * 0.04);
        L.hip.rotation.x = moving ? Math.max(0, Math.sin(ph)) * -0.35 : 0;
      }
      this.upper.position.y = this.lift + (moving ? Math.sin(w * 2) * 0.012 : Math.sin(t * 2) * 0.006);
    }
    if (this.hover.visible) this.hover.material.opacity = 0.25 + Math.sin(t * 6) * 0.1;
  }
}
