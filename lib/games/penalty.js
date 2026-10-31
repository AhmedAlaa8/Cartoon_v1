/* ================================================================
   «تحدي العروسة» — the wedding penalty challenge, its own small
   three.js scene (loaded only when the game opens, disposed on exit).
   Abeer takes five penalties; the guest is Ahmed in goal and dives
   with a swipe (left / right / up) or the three buttons. A dive to
   the shot's side saves it. Abeer's glance during the run-up gives
   the shot away — most of the time.
   Events to the HUD: round { n }, result { n, saved }, end { saves }.
================================================================ */
import * as THREE from 'three';
import { bloomGeometry, softClusterGeometry } from '@/lib/cinematic/world';
import { radialTexture } from '@/lib/cinematic/textures';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = t => 1 - Math.pow(1 - t, 3);
const clamp01 = t => Math.max(0, Math.min(1, t));

export const SHOTS = 5;
const GOAL_W = 3.0, GOAL_H = 1.5, SPOT_Z = 4.2, BALL_R = 0.16;
const RUN = 1.05, FLIGHT = 0.68, AFTER = 2.5;     // seconds: run-up, ball flight, celebration
const RUN_FROM = V(-0.75, 0, SPOT_Z + 1.5), RUN_TO = V(-0.32, 0, SPOT_Z + 0.42), BALL_SPOT = V(0, BALL_R, SPOT_Z);

// the invitation's own quality tiers (lib/cinematic/scene.js): the game never draws more pixels than the world it opens over
const QUALITY = { desktop: { dpr: 1.5, aa: true, fps: 60 }, mobile: { dpr: 1.25, aa: true, fps: 60 }, low: { dpr: 1, aa: false, fps: 30 } };

/* ---------- textures ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const skyTex = () => canvasTex(4, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#050a1c'); grd.addColorStop(0.55, '#0e1a40'); grd.addColorStop(0.85, '#2a335f'); grd.addColorStop(1, '#3a2f55');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});
const grassTex = () => {
  const t = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#1f3a22' : '#24432a'; g.fillRect(0, (i * h) / 8, w, h / 8); }
    for (let k = 0; k < 2400; k++) { g.fillStyle = `rgba(${40 + Math.random() * 30},${70 + Math.random() * 40},${40 + Math.random() * 20},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
};
const ballTex = () => canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#16244f';
  const patch = (x, y, r) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r); } g.closePath(); g.fill(); };
  for (let k = 0; k < 5; k++) { patch((k + 0.5) * w / 5, h * 0.5, h * 0.11); patch(k * w / 5, h * 0.17, h * 0.07); patch(k * w / 5, h * 0.83, h * 0.07); }
});
const heartSpriteTex = () => canvasTex(64, 64, g => {
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(32, 54);
  g.bezierCurveTo(4, 36, 6, 10, 22, 10); g.bezierCurveTo(28, 10, 31, 15, 32, 19);
  g.bezierCurveTo(33, 15, 36, 10, 42, 10); g.bezierCurveTo(58, 10, 60, 36, 32, 54); g.fill();
});

/* ---------- the two cartoon characters ---------- */
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });

function face(head, r, { lashes = false, blush = 0.35 }) {
  const ink = std(0x1b1410, { roughness: 0.3 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 16, 12), ink);
    eye.scale.set(1, 1.25, 0.6);
    eye.position.set(s * r * 0.36, r * 0.08, r * 0.9);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.045, 8, 6), shine);
    glint.position.set(s * r * 0.36 + r * 0.04, r * 0.15, r * 0.98);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.03, r * 0.2, 4, 8).rotateZ(Math.PI / 2 + s * 0.12), ink);
    brow.position.set(s * r * 0.36, r * 0.36, r * 0.86);
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(r * 0.15, 20), new THREE.MeshBasicMaterial({ color: 0xf29aa9, transparent: true, opacity: blush }));
    cheek.position.set(s * r * 0.55, -r * 0.18, r * 0.84);
    cheek.lookAt(cheek.position.clone().multiplyScalar(2));
    head.add(eye, glint, brow, cheek);
    if (lashes) {
      const lash = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.018, r * 0.08, 3, 6).rotateZ(s * 0.9), ink);
      lash.position.set(s * r * 0.5, r * 0.22, r * 0.86);
      head.add(lash);
    }
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(r * 0.2, r * 0.035, 8, 20, Math.PI).rotateZ(Math.PI), std(0x8e3b3b));
  smile.position.set(0, -r * 0.2, r * 0.93);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(r * 0.08, 10, 8), std(0xe8b48f));
  nose.position.set(0, -r * 0.02, r);
  head.add(smile, nose);
  return smile;
}

function limb(len, rad, mat) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 6, 12), mat);
  m.position.y = -len / 2 - rad * 0.5;
  pivot.add(m);
  return pivot;
}

function buildAhmed() {
  const skin = std(0xf0c39d), suit = std(0x16224a, { roughness: 0.6 }), shirt = std(0xf8f2e6), gold = std(0xd9b062, { metalness: 0.8, roughness: 0.3 });
  const glove = std(0xfffaf0, { roughness: 0.45 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const legs = [-1, 1].map(s => {
    const l = limb(0.4, 0.085, suit);
    l.position.set(s * 0.12, 0.6, 0);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), std(0x0d0d10, { roughness: 0.3 }));
    shoe.scale.set(1, 0.55, 1.5);
    shoe.position.set(0, -0.56, 0.05);
    l.add(shoe);
    body.add(l);
    return l;
  });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.3, 8, 16), suit);
  torso.position.y = 0.96;
  torso.scale.z = 0.8;
  const v = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 3).rotateZ(Math.PI), shirt);
  v.position.set(0, 1.08, 0.19);
  v.scale.z = 0.3;
  const tie = new THREE.Group();
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 4).rotateZ(s * Math.PI / 2), gold); w.position.x = s * 0.045; tie.add(w); }
  tie.position.set(0, 1.21, 0.215);
  body.add(torso, v, tie);
  const arms = [-1, 1].map(s => {
    const a = limb(0.34, 0.07, suit);
    a.position.set(s * 0.31, 1.18, 0);
    a.rotation.z = s * 0.35;
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), glove);
    g.scale.set(1, 1.15, 0.7);
    g.position.y = -0.52;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 16).rotateX(Math.PI / 2), gold);
    cuff.position.y = -0.42;
    a.add(g, cuff);
    body.add(a);
    return a;
  });
  const head = new THREE.Group();
  head.position.y = 1.5;
  const R = 0.26;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(R, 24, 18), skin));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), std(0x24160f, { roughness: 0.5 }));
  hair.rotation.x = -0.25;
  const quiff = new THREE.Mesh(new THREE.SphereGeometry(R * 0.45, 14, 10), std(0x2e1d14, { roughness: 0.5 }));
  quiff.scale.set(1.5, 0.6, 1);
  quiff.position.set(R * 0.15, R * 0.82, R * 0.35);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), skin); ear.position.set(s * R * 0.98, 0, 0); ear.scale.z = 0.6; head.add(ear); }
  const beard = new THREE.Mesh(new THREE.TorusGeometry(R * 0.78, R * 0.05, 6, 24, Math.PI).rotateZ(Math.PI), new THREE.MeshBasicMaterial({ color: 0x3a2a20, transparent: true, opacity: 0.35 }));
  beard.position.set(0, -R * 0.12, R * 0.3);
  beard.rotation.x = -0.35;
  head.add(hair, quiff, beard);
  const smile = face(head, R, { blush: 0.2 });
  body.add(head);
  return { root, body, legs, arms, head, smile };
}

function buildAbeer() {
  const skin = std(0xf3cba8), ivory = std(0xfbf4e8, { roughness: 0.65 }), gold = std(0xd9b062, { metalness: 0.8, roughness: 0.3 });
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  // the gown: a full skirt to the ground with a blush sash
  const skirt = new THREE.Mesh(new THREE.LatheGeometry([
    [0.0, 0.0], [0.52, 0.0], [0.5, 0.06], [0.42, 0.3], [0.3, 0.58], [0.19, 0.8], [0.0, 0.82],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 32), ivory);
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 28).rotateX(Math.PI / 2), std(0xeaa9b7));
  sash.position.y = 0.8;
  const bodice = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.2, 8, 16), ivory);
  bodice.position.y = 0.98;
  bodice.scale.z = 0.8;
  body.add(skirt, sash, bodice);
  // one leg peeks out to kick
  const kickLeg = limb(0.36, 0.06, ivory);
  kickLeg.position.set(0.1, 0.45, 0.05);
  const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), std(0xe9c47c, { metalness: 0.6, roughness: 0.35 }));
  shoe.scale.set(1, 0.55, 1.5);
  shoe.position.set(0, -0.46, 0.04);
  kickLeg.add(shoe);
  kickLeg.visible = false;
  body.add(kickLeg);
  const arms = [-1, 1].map(s => {
    const a = limb(0.3, 0.055, ivory);
    a.position.set(s * 0.2, 1.12, 0);
    a.rotation.z = s * 0.3;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skin);
    hand.position.y = -0.42;
    a.add(hand);
    body.add(a);
    return a;
  });
  const head = new THREE.Group();
  head.position.y = 1.4;
  const R = 0.24;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(R, 24, 18), skin));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), std(0x3b2418, { roughness: 0.5 }));
  hair.rotation.x = -0.35;
  const bun = new THREE.Mesh(new THREE.SphereGeometry(R * 0.42, 14, 10), std(0x3b2418, { roughness: 0.5 }));
  bun.position.set(0, R * 0.55, -R * 0.75);
  // the veil falls from the crown down the back
  const veil = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.85, 0.55, 1.15, 28, 1, true, Math.PI * 0.5, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false }));
  veil.position.set(0, -0.42, -R * 0.35);
  veil.rotation.x = 0.12;
  const tiara = new THREE.Mesh(new THREE.TorusGeometry(R * 0.7, 0.014, 6, 24, Math.PI).rotateX(-0.5), gold);
  tiara.position.set(0, R * 0.62, R * 0.1);
  head.add(hair, bun, veil, tiara);
  for (let i = 0; i < 5; i++) {
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), std(0xfff6ea, { roughness: 0.2 }));
    const a = Math.PI * (0.15 + i * 0.175);
    pearl.position.set(Math.cos(a) * R * 0.7, R * 0.62 + Math.sin(a) * R * 0.2 + 0.02, R * 0.1 + Math.sin(a) * R * 0.32);
    head.add(pearl);
  }
  const smile = face(head, R, { lashes: true, blush: 0.4 });
  body.add(head);
  return { root, body, arms, head, kickLeg, smile };
}

/* ---------- a small CPU particle burst (gold sparks or blush hearts) ---------- */
function burstSystem(scene, map, count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.16, map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  // a spark's colour is parsed once when it is born, not every frame
  const parts = Array.from({ length: count }, () => ({ alive: false, color: new THREE.Color() }));
  let live = 0;
  return {
    emit(at, n, palette, speed = 3, up = 2) {
      let k = 0;
      for (const p of parts) {
        if (p.alive) continue;
        if (k++ >= n) break;
        Object.assign(p, { alive: true, x: at.x, y: at.y, z: at.z, vx: (Math.random() - 0.5) * speed, vy: Math.random() * up + 1, vz: (Math.random() - 0.5) * speed * 0.6, life: 1.2 + Math.random() * 0.8, age: 0 });
        p.color.set(palette[(Math.random() * palette.length) | 0]);
        live++;
      }
    },
    update(dt) {
      // nothing in the air: no work and nothing sent to the GPU (the pass where the last one dies clears it)
      if (!live) return;
      live = 0;
      for (let i = 0; i < count; i++) {
        const p = parts[i], j = i * 3;
        if (p.alive) {
          p.age += dt;
          p.vy -= 3.2 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          if (p.age > p.life) p.alive = false;
        }
        if (p.alive) {
          live++;
          const f = 1 - p.age / p.life;
          pos[j] = p.x; pos[j + 1] = p.y; pos[j + 2] = p.z;
          col[j] = p.color.r * f; col[j + 1] = p.color.g * f; col[j + 2] = p.color.b * f;
        } else {
          pos[j] = 0; pos[j + 1] = -50; pos[j + 2] = 0;
          col[j] = col[j + 1] = col[j + 2] = 0;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
    get active() { return live > 0; },
  };
}

/* ---------- the game ---------- */
export function createPenalty(canvas, { onEvent, reducedMotion = false, tier = Math.min(window.innerWidth, window.innerHeight) < 700 ? 'mobile' : 'desktop' } = {}) {
  const quality = QUALITY[tier] || QUALITY.mobile;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.aa, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, quality.dpr);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const disposables = [];
  const keep = t => { disposables.push(t); return t; };
  scene.background = keep(skyTex());
  scene.fog = new THREE.Fog(0x141c3c, 16, 40);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

  /* lights: moonlight from behind, a warm key from the lamps */
  scene.add(new THREE.HemisphereLight(0x5f72a8, 0x2a1d10, 1.1));
  const key = new THREE.DirectionalLight(0xffd9a0, 1.6);
  key.position.set(3, 6, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4ff, 0.9);
  rim.position.set(-4, 5, -6);
  scene.add(rim);

  /* the little garden pitch */
  const ground = new THREE.Mesh(new THREE.CircleGeometry(18, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: keep(grassTex()), roughness: 1 }));
  scene.add(ground);
  const chalk = new THREE.MeshBasicMaterial({ color: 0xf4eadd, transparent: true, opacity: 0.75 });
  [[0, 0.005, 0.02, GOAL_W + 2.6, 0.06], [-(GOAL_W / 2 + 1.3), 0.005, 1.4, 0.06, 2.8], [GOAL_W / 2 + 1.3, 0.005, 1.4, 0.06, 2.8], [0, 0.005, 2.8, GOAL_W + 2.6, 0.06]].forEach(([x, y, z, w, d]) => {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), chalk);
    l.position.set(x, y, z);
    scene.add(l);
  });
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16).rotateX(-Math.PI / 2), chalk);
  spot.position.set(0, 0.006, SPOT_Z);
  scene.add(spot);

  /* the goal, its net and a garland on the crossbar */
  const white = std(0xf6eee2, { roughness: 0.4 });
  const goal = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_H, 12), white); p.position.set(s * GOAL_W / 2, GOAL_H / 2, 0); goal.add(p); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_W + 0.12, 12).rotateZ(Math.PI / 2), white);
  bar.position.y = GOAL_H;
  goal.add(bar);
  const NX = 16, NY = 8, DEPTH = 0.9;
  const netGeo = new THREE.PlaneGeometry(GOAL_W, GOAL_H, NX, NY);
  netGeo.translate(0, GOAL_H / 2, -DEPTH);
  const netBase = netGeo.attributes.position.array.slice();
  const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: 0xf4eadd, wireframe: true, transparent: true, opacity: 0.4 }));
  goal.add(net);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, GOAL_H, 5, NY).rotateY(Math.PI / 2), net.material);
    side.position.set(s * GOAL_W / 2, GOAL_H / 2, -DEPTH / 2);
    goal.add(side);
  }
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_W, DEPTH, NX, 5).rotateX(Math.PI / 2), net.material);
  roof.position.set(0, GOAL_H, -DEPTH / 2);
  goal.add(roof);
  const bloom = bloomGeometry(), cluster = softClusterGeometry(1);
  const garland = new THREE.InstancedMesh(cluster, std(0x2c4426, { roughness: 0.85 }), 22);
  const flowers = new THREE.InstancedMesh(bloom, std(0xffffff, { emissive: 0x2a2420, side: THREE.DoubleSide }), 22);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), blush = [new THREE.Color('#f7f1e8'), new THREE.Color('#efbcc6')];
  for (let i = 0; i < 22; i++) {
    const t = i / 21, x = -GOAL_W / 2 + t * GOAL_W, sag = Math.sin(t * Math.PI * 4) * 0.04;
    garland.setMatrixAt(i, m4.compose(V(x, GOAL_H + 0.04 + sag, 0.05), q.identity(), V(0.12, 0.09, 0.09)));
    flowers.setMatrixAt(i, m4.compose(V(x + 0.04, GOAL_H + 0.08 + sag, 0.13), q.setFromUnitVectors(V(0, 1, 0), V(0, 0.4, 1).normalize()), V(0.08, 0.08, 0.08)));
    flowers.setColorAt(i, blush[i % 3 === 0 ? 1 : 0]);
  }
  goal.add(garland, flowers);
  scene.add(goal);

  /* the garden around: hedges with jasmine behind the goal, lamp posts, a string of lights */
  const hedge = new THREE.InstancedMesh(cluster, std(0x24391f, { roughness: 0.9 }), 26);
  for (let i = 0; i < 26; i++) {
    const x = -7 + i * 0.56, r = 0.55 + Math.random() * 0.3;
    hedge.setMatrixAt(i, m4.compose(V(x, r * 0.6, -2.6 - Math.random() * 0.5), q.identity(), V(r, r * 0.8, r)));
  }
  scene.add(hedge);
  const glowTex = keep(radialTexture([[0, 'rgba(255,230,180,1)'], [0.3, 'rgba(255,200,120,.4)'], [1, 'rgba(255,180,90,0)']]));
  const glow = (p, s, o = 0.9) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.copy(p); sp.scale.setScalar(s); scene.add(sp); return sp; };
  const iron = std(0x17120d, { metalness: 0.6, roughness: 0.45 });
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 8), iron);
    pole.position.set(s * (GOAL_W / 2 + 1.1), 1.3, -0.4);
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd08a }));
    lamp.position.set(s * (GOAL_W / 2 + 1.1), 2.66, -0.4);
    scene.add(lamp);
    glow(lamp.position, 1.6);
    const l = new THREE.PointLight(0xffb565, 6, 0, 1.8);
    l.position.copy(lamp.position);
    scene.add(l);
  }
  const fairy = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, x = -(GOAL_W / 2 + 1.1) + t * (GOAL_W + 2.2), y = 2.55 - Math.sin(t * Math.PI) * 0.45;
    fairy.push(glow(V(x, y, -0.4), 0.28, 0.85));
  }
  // stars and a crescent
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 260; i++) { const a = Math.random() * Math.PI - Math.PI, e = 0.12 + Math.random() * 0.9; sp.push(Math.cos(a) * Math.cos(e) * 60, Math.sin(e) * 60, Math.sin(a) * Math.cos(e) * 60); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6e0, size: 0.18, map: glowTex, transparent: true, depthWrite: false, fog: false })));
  glow(V(-14, 16, -40), 9, 0.5).material.fog = false;

  /* the cast */
  const ahmed = buildAhmed();
  scene.add(ahmed.root);
  const abeer = buildAbeer();
  scene.add(abeer.root);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), new THREE.MeshStandardMaterial({ map: keep(ballTex()), roughness: 0.45 }));
  scene.add(ball);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  scene.add(shadow);
  const sparks = burstSystem(scene, glowTex, 160);
  const hearts = burstSystem(scene, keep(heartSpriteTex()), 90);

  /* ---------- the round's state ---------- */
  let clock = 0, raf = 0, last = 0, frames = 0, slowFrames = 0, running = false, disposed = false;
  const state = { n: 0, saves: 0, phase: 'idle', t0: 0, target: null, dive: null, saved: false, tell: 0, bounce: null };

  function resetPositions() {
    abeer.root.position.copy(RUN_FROM);
    abeer.root.rotation.set(0, Math.PI, 0);       // facing the goal, her back to us
    abeer.body.rotation.set(0, 0, 0);
    abeer.kickLeg.visible = false;
    abeer.arms.forEach((a, i) => { a.rotation.set(0, 0, (i ? 1 : -1) * 0.3); });
    ahmed.root.position.set(0, 0, 0.25);
    ahmed.root.rotation.set(0, 0, 0);
    ahmed.arms.forEach((a, i) => { a.rotation.set(0, 0, (i ? 1 : -1) * 0.55); });
    ball.position.copy(BALL_SPOT);
    ball.rotation.set(0, 0, 0);
    netGeo.attributes.position.array.set(netBase);
    netGeo.attributes.position.needsUpdate = true;
  }

  function startRound() {
    if (state.n >= SHOTS) return;
    state.n++;
    state.phase = 'run';
    state.t0 = clock;
    state.dive = null;
    state.saved = false;
    state.bounce = null;
    const col = [-1, 0, 1][(Math.random() * 3) | 0], high = Math.random() < 0.45;
    state.target = { col, high, point: V(col * (GOAL_W / 2 - 0.42) + (Math.random() - 0.5) * 0.2, high ? GOAL_H - 0.38 : 0.32, 0) };
    // her glance during the run-up: true two times in three
    state.tell = Math.random() < 0.67 ? col : [-1, 0, 1][(Math.random() * 3) | 0];
    resetPositions();
    onEvent?.({ type: 'round', n: state.n });
  }

  /* the guest's dive: 'left' | 'right' | 'up' (and the high diagonals) */
  function input(dir) {
    if (state.phase !== 'run' && state.phase !== 'flight') return;
    if (state.dive) return;
    const kickAt = state.t0 + RUN;
    if (clock > kickAt + FLIGHT - 0.08) return;              // too late: the ball is in
    const col = dir.includes('left') ? -1 : dir.includes('right') ? 1 : 0;
    state.dive = { col, high: dir.includes('up') || dir === 'up', t: clock };
  }

  /* ---------- per-frame choreography ---------- */
  const tmp = new THREE.Vector3(), above = new THREE.Vector3();
  function step(dt) {
    const t = clock - state.t0;
    // Ahmed sways on his line, ready
    if (!state.dive && (state.phase === 'run' || state.phase === 'flight' || state.phase === 'idle')) {
      ahmed.root.position.x = Math.sin(clock * 2.4) * 0.14;
      ahmed.root.position.y = Math.abs(Math.sin(clock * 4.8)) * 0.05;
      ahmed.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.55 + Math.sin(clock * 4.8) * 0.06); });
    }
    if (state.dive && state.phase !== 'after') {
      const k = out(clamp01((clock - state.dive.t) / 0.42));
      const x = state.dive.col * 1.05;
      ahmed.root.position.x = THREE.MathUtils.lerp(ahmed.root.position.x, x, k);
      ahmed.root.position.y = Math.sin(k * Math.PI) * (state.dive.high ? 0.6 : 0.3) + (state.dive.col === 0 ? k * 0.35 : 0);
      ahmed.root.rotation.z = -state.dive.col * 1.15 * k;
      ahmed.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * THREE.MathUtils.lerp(0.55, 2.9, k); });
    }

    if (state.phase === 'run') {
      // the run-up: a bouncy approach, a glance towards her corner, then the kick
      const k = clamp01(t / RUN);
      abeer.root.position.lerpVectors(RUN_FROM, RUN_TO, ease(k));
      abeer.root.position.y = Math.abs(Math.sin(k * Math.PI * 4)) * 0.06;
      abeer.head.rotation.y = -state.tell * 0.45 * Math.sin(clamp01((k - 0.25) / 0.5) * Math.PI);
      abeer.arms.forEach((a, i) => { a.rotation.x = Math.sin(k * Math.PI * 4 + i * Math.PI) * 0.5; });
      // the kicking leg: back-swing, then through the ball
      if (k > 0.82) { abeer.kickLeg.visible = true; abeer.kickLeg.rotation.x = 1.2 - ((k - 0.82) / 0.18) * 2.0; }
      if (t >= RUN) { state.phase = 'flight'; state.kickT = clock; }
    } else if (state.phase === 'flight') {
      const k = clamp01((clock - state.kickT) / FLIGHT);
      tmp.lerpVectors(BALL_SPOT, state.target.point, ease(k) * 0.4 + k * 0.6);
      tmp.y += Math.sin(k * Math.PI) * (state.target.high ? 0.35 : 0.18);
      ball.position.copy(tmp);
      ball.rotation.x -= dt * 14;
      abeer.kickLeg.rotation.x = THREE.MathUtils.lerp(-0.8, 0, k);
      if (k >= 1) resolve();
    } else if (state.phase === 'after') {
      after(dt, clock - state.t1);
    }
    shadow.position.set(ball.position.x, 0.004, ball.position.z);
    shadow.material.opacity = 0.3 * Math.max(0.2, 1 - ball.position.y);
  }

  function resolve() {
    const keeperCol = state.dive ? state.dive.col : 0;
    state.saved = keeperCol === state.target.col;
    if (state.saved) state.saves++;
    state.phase = 'after';
    state.t1 = clock;
    if (state.saved) {
      state.bounce = { v: V(-state.target.col * 1.6 + (Math.random() - 0.5), 2.6, 3.2), p: ball.position.clone() };
      sparks.emit(ball.position, reducedMotion ? 20 : 60, ['#ffd27a', '#fff3d6', '#f1d6a5'], 3.2, 2.4);
    } else {
      const from = ball.position.clone();
      state.bounce = { into: true, from, to: V(from.x * 0.95, Math.max(BALL_R, from.y - 0.1), -DEPTH + 0.2) };
    }
    onEvent?.({ type: 'result', n: state.n, saved: state.saved });
  }

  function after(dt, t) {
    // the ball: off the gloves and bouncing away, or into the net
    if (state.bounce?.into) {
      const k = clamp01(t / 0.35);
      ball.position.lerpVectors(state.bounce.from, state.bounce.to, out(k));
      if (t > 0.35) ball.position.y = Math.max(BALL_R, ball.position.y - dt * 2.4);
      // the net bulges where the ball went in, then settles
      const arr = netGeo.attributes.position.array, bulge = Math.sin(clamp01(t / 0.9) * Math.PI) * 0.35;
      for (let i = 0; i < arr.length; i += 3) {
        const d = Math.hypot(netBase[i] - state.bounce.from.x, netBase[i + 1] - state.bounce.from.y);
        arr[i + 2] = netBase[i + 2] - bulge * Math.exp(-d * d * 3);
      }
      netGeo.attributes.position.needsUpdate = true;
    } else if (state.bounce) {
      const b = state.bounce;
      b.v.y -= 9.8 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < BALL_R) { b.p.y = BALL_R; b.v.y = Math.abs(b.v.y) * 0.5; b.v.x *= 0.8; b.v.z *= 0.8; }
      ball.position.copy(b.p);
      ball.rotation.z += dt * 8;
    }
    const hop = reducedMotion ? 0 : Math.abs(Math.sin(t * 7));
    if (state.saved) {
      // Ahmed gets up and celebrates; Abeer stamps her foot and shakes her head
      const up = out(clamp01((t - 0.45) / 0.4));
      ahmed.root.rotation.z *= 1 - up;
      ahmed.root.position.y = t > 0.85 ? hop * 0.35 : ahmed.root.position.y * (1 - up);
      ahmed.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (2.7 + Math.sin(t * 14) * 0.25); });
      if (t > 0.85 && Math.random() < 0.25) sparks.emit(above.copy(ahmed.root.position).setY(ahmed.root.position.y + 2), 3, ['#ffd27a', '#fff3d6']);
      abeer.head.rotation.y = Math.sin(t * 9) * 0.35 * (1 - clamp01((t - 1.6) / 0.5));
      abeer.body.rotation.x = -0.15 * Math.min(1, t * 2);
    } else {
      // Abeer turns to us, jumps for joy among hearts; Ahmed lies there, then sits up shaking his head
      abeer.root.rotation.y = THREE.MathUtils.lerp(Math.PI, 0.2, out(clamp01(t / 0.5)));
      abeer.root.position.y = t > 0.5 ? hop * 0.3 : 0;
      abeer.kickLeg.visible = false;
      abeer.arms.forEach((a, i) => { a.rotation.set(0, 0, (i ? 1 : -1) * (2.6 + Math.sin(t * 12) * 0.2)); });
      if (t > 0.5 && t < 2.0 && Math.random() < 0.35) hearts.emit(above.copy(abeer.root.position).setY(abeer.root.position.y + 1.9), 2, ['#f7c9d2', '#e9b5c1', '#fff0e6'], 2.2, 1.6);
      if (t > 1.1) ahmed.head.rotation.y = Math.sin(t * 8) * 0.4;
    }
    if (t >= AFTER) {
      ahmed.head.rotation.y = 0;
      abeer.head.rotation.y = 0;
      if (state.n >= SHOTS) { state.phase = 'done'; onEvent?.({ type: 'end', saves: state.saves }); }
      else { state.phase = 'wait'; onEvent?.({ type: 'next', n: state.n }); }
    }
  }

  /* ---------- size, loop ---------- */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const portrait = camera.aspect < 0.8;
    camera.fov = portrait ? 62 : camera.aspect < 1.2 ? 54 : 44;
    // high enough behind Abeer to see the whole goal over her veil
    camera.position.set(portrait ? 0.8 : 1.2, portrait ? 3.0 : 2.5, portrait ? 10.6 : 9.4);
    camera.lookAt(0, portrait ? 0.9 : 0.85, 0.8);
    camera.updateProjectionMatrix();
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    // calm = only Ahmed's sway behind the intro or the final card: 30 fps is as good there on a phone,
    // as in the invitation's own loop
    const calm = (state.phase === 'idle' || state.phase === 'done') && !sparks.active && !hearts.active;
    const fps = calm && tier !== 'desktop' ? 30 : quality.fps;
    const ms = last ? now - last : 16;
    if (fps < 60 && last && ms < 1000 / fps - 2) return;
    last = now;
    // adaptive quality: when many of 60 frames miss their budget, draw fewer pixels
    frames++;
    if (ms > (1000 / fps) * 1.5) slowFrames++;
    if (frames === 60) {
      if (slowFrames > 24 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
      }
      frames = slowFrames = 0;
    }
    const dt = Math.min(0.05, ms / 1000);
    clock += dt;
    step(dt);
    sparks.update(dt);
    hearts.update(dt);
    fairy.forEach((f, i) => { f.material.opacity = 0.65 + 0.25 * Math.sin(clock * 3 + i * 1.3); });
    renderer.render(scene, camera);
  }
  function play() { if (!running && !disposed) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function pause() { running = false; cancelAnimationFrame(raf); }
  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', resize);

  /* swipes on the pitch: left / right / up (with the high diagonals) */
  let down = null;
  const onDown = e => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    down = null;
    if (Math.hypot(dx, dy) < 28) return;
    const horiz = Math.abs(dx) > Math.abs(dy) * 0.6 ? (dx < 0 ? 'left' : 'right') : '';
    const up = dy < -28 && Math.abs(dy) > Math.abs(dx) * 0.45;
    // a straight swipe up (or down) stays in the middle and jumps
    input(horiz ? (up ? `up-${horiz}` : horiz) : 'up');
  };
  const onCancel = () => { down = null; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  resize();
  resetPositions();
  // every shader (the sparks and hearts too) is compiled before the first frame, while the HUD still
  // says «جارٍ التحضير…» — compiling on the first frame froze the page as the game opened
  const ready = renderer.compileAsync(scene, camera).catch(() => { /* compiled on first use instead */ }).then(() => { if (!disposed) play(); });

  return {
    ready,
    start() { state.n = 0; state.saves = 0; startRound(); },
    next() { if (state.phase === 'wait') startRound(); },
    input,
    get state() { return { n: state.n, saves: state.saves, phase: state.phase }; },
    dispose() {
      disposed = true;
      pause();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      scene.traverse(o => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (!m) return; for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); });
      });
      disposables.forEach(d => d.dispose?.());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
