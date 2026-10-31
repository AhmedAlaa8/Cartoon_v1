/* ================================================================
   Cinematic preview (?theme=cinematic) — one world, six stations.
   No scrolling: the camera travels between chapters along curved
   paths (CatmullRom through hand-placed waypoints) while its gaze
   turns smoothly (quaternion slerp). The first transition is the
   door sequence: unlock → light → leaves swing → walk to the lake.

   Stage 1 reuses the night world (forked into lib/cinematic) as a
   stand-in; the art pass comes in Stage 2.
================================================================ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, easeInOut, easeOut, range } from './phases';
import { HS, glowTexture } from './geometry';
import { bloomGeometry, buildWorld, HINGE_Z, softClusterGeometry, SHORE_Z, T, withRim } from './world';
import { bridePortrait, fontsReady, groomPortrait, heartShape, ribbonTexture, sampleHeart, sampleText } from './shapes';
import { createFireflies, createFireworks, createGlowPoints, createNameWriter, createSkyLanterns, createStars, WATER_Y } from './particles';
import { crescentTexture, radialTexture, skyLanternTexture } from './textures';

export const CHAPTERS = ['door', 'names', 'countdown', 'couple', 'rsvp', 'sky'];

const EYE_Y = 1.7;
const NAMES_AT_DOOR = 1.6;     // s into the door leg: the first rockets rise while the leaves swing
const MAX_ANGLE = THREE.MathUtils.degToRad(100);
// the crescent hangs high over the far shore — chapter three climbs towards it
const MOON = new THREE.Vector3(-30, 110, -190);
const GRAND = new THREE.Vector3(-6.6, 0, -17.4);   // the chandelier tree (lib/cinematic/world.js)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* where the camera stands and what it looks at, per chapter
   (the door's distance is fitted to the screen in resize()) */
// a gaze from `from` aimed `down` degrees below `target`, so the target sits high in the frame
function gazeBelow(from, target, down) {
  const d = target.clone().sub(from);
  const yaw = Math.atan2(d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) - THREE.MathUtils.degToRad(down);
  return from.clone().add(V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(50));
}
const gaze = (from, yawDeg, pitchDeg) => gazeBelow(from, from.clone().add(V(Math.sin(THREE.MathUtils.degToRad(yawDeg)), 0, -Math.cos(THREE.MathUtils.degToRad(yawDeg)))), -pitchDeg);

const STATIONS = {
  // outside, square to the door
  door: { pos: V(0, EYE_Y, 8), look: V(0, EYE_Y, -100) },
  // the end of the aisle: the arch, the lake and the open sky where the names will be written
  names: { pos: V(0, 1.8, -12.8), look: V(0, 14, -62) },
  // risen above the shore, the crescent high in the frame, the countdown in the sky beneath it
  countdown: { pos: V(0, 9, -21), look: null },
  // beside the grand tree, its lanterns and chandelier overhead, the lake behind
  couple: { pos: V(-2.6, 1.6, -8.4), look: V(GRAND.x + 0.4, 4.9, GRAND.z) },
  // at the floral arch, eye level
  rsvp: { pos: V(0, 2.0, -14.2), look: V(0, 0.9, -19.1) },
  // high over the water, looking up among the lanterns and stars
  sky: { pos: V(0, 6.2, -26), look: null },
};
STATIONS.countdown.look = gazeBelow(STATIONS.countdown.pos, MOON, 12);
STATIONS.sky.look = gaze(STATIONS.sky.pos, -6, 44);

/* the road between neighbouring stations: waypoints + duration (s) */
const LEGS = {
  // through the door and down the aisle between the lanterns
  'door>names': { via: [V(0, EYE_Y, 1.6), V(0, EYE_Y, -0.6), V(0, EYE_Y, -3.2), V(0.12, 1.72, -8.2)], duration: 7.6, door: true },
  // rise over the arch towards the moon
  'names>countdown': { via: [V(0, 3.4, -15.2), V(0, 6.4, -18.6)], duration: 2.4 },
  // drift down to the grand tree
  'countdown>couple': { via: [V(-0.6, 7.2, -18.0), V(-1.6, 3.8, -11.8)], duration: 2.2 },
  // glide across the lawn to the arch
  'couple>rsvp': { via: [V(-1.2, 1.85, -11.0)], duration: 1.6 },
  // up over the arch and out above the water
  'rsvp>sky': { via: [V(0, 3.4, -18.4), V(0, 4.8, -22)], duration: 2.2 },
};

function detectTier() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (small && (cores <= 4 || memory <= 3)) return 'low';
  return small ? 'mobile' : 'desktop';
}

const NAME_POINTS = { desktop: [2600, 1100], mobile: [1700, 760], low: [1000, 460] };   // per name, heart

const TIERS = {
  desktop: { dpr: 1.5, fps: 60, fw: 30000, trail: 6, spark: 1, lanterns: 10, distant: 26, stars: 1600, gardenLights: 3 },
  mobile: { dpr: 1.25, fps: 60, fw: 14000, trail: 4, spark: 0.7, lanterns: 6, distant: 16, stars: 1000, gardenLights: 2 },
  low: { dpr: 1, fps: 30, fw: 7000, trail: 3, spark: 0.45, lanterns: 3, distant: 8, stars: 600, gardenLights: 1 },
};

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const SKY_FRAG = /* glsl */`
  uniform vec3 uTop, uMid, uHorizon, uRose;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
    c = mix(c, uTop, smoothstep(0.2, 0.75, h));
    c += uRose * exp(-pow((h - 0.015) / 0.06, 2.0)) * 0.55;
    if (h < 0.0) c = uHorizon * 0.55;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;
const WATER_VERT = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const WATER_FRAG = /* glsl */`
  uniform vec3 uCam, uMoon, uDeep, uHorizon, uFog;
  uniform float uTime;
  varying vec3 vWorld;
  void main() {
    vec3 V = normalize(uCam - vWorld);
    vec2 q = vWorld.xz;
    vec3 N = normalize(vec3(
      (sin(q.x * 1.7 + uTime * 0.9) + 0.5 * sin(q.x * 3.1 - q.y * 2.3 + uTime * 1.3)) * 0.03 + sin(q.y * 0.8 + uTime * 0.5) * 0.02,
      1.0,
      (sin(q.y * 2.2 - uTime * 1.1) + 0.5 * sin(q.x * 2.7 + q.y * 1.9 + uTime * 0.7)) * 0.03));
    float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
    vec3 col = mix(uDeep, uHorizon, clamp(fres * 1.15, 0.0, 1.0));
    vec3 R = reflect(-V, N);
    float m = max(dot(R, normalize(uMoon - vWorld)), 0.0);
    col += vec3(1.0, 0.95, 0.84) * (pow(m, 1200.0) * 5.0 + pow(m, 80.0) * 0.18);
    float d = length(uCam - vWorld);
    col = mix(col, uFog, smoothstep(30.0, 260.0, d));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createCinematicScene(canvas, { onContextLost, onCue, reducedMotion = false, start = 'door', slowmo = 1, debug = false, photos = {}, games = false, foundHearts = [] } = {}) {
  const tier = detectTier();
  const cfg = TIERS[tier];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, cfg.dpr);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e1936, 40, 260);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.2;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 600);

  /* ---------- sky, moon, stars ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color('#050a1c') }, uMid: { value: new THREE.Color('#0b1638') },
      uHorizon: { value: new THREE.Color('#22335f') }, uRose: { value: new THREE.Color('#3a2f55') },
    },
  }));
  sky.renderOrder = -3;
  const stars = createStars(scene, cfg.stars);
  const skyGroup = new THREE.Group();
  skyGroup.add(sky, ...stars.objects);
  scene.add(skyGroup);

  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: crescentTexture(7), fog: false, toneMapped: false, transparent: true, depthWrite: false }));
  moon.position.copy(MOON);
  moon.scale.setScalar(26);
  const haloTex = radialTexture([[0, 'rgba(230,236,255,.35)'], [0.3, 'rgba(180,195,240,.1)'], [1, 'rgba(150,170,230,0)']]);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }));
  halo.position.copy(MOON);
  halo.scale.setScalar(95);
  const moonReflection = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6 }));
  moonReflection.position.set(MOON.x, 2 * WATER_Y - MOON.y * 0.35, MOON.z);
  moonReflection.scale.set(18, 70, 1);
  scene.add(moon, halo, moonReflection);

  /* ---------- the lake ---------- */
  const waterUniforms = {
    uCam: { value: new THREE.Vector3() }, uMoon: { value: MOON }, uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#050b1c') }, uHorizon: { value: new THREE.Color('#1e2d55') }, uFog: { value: new THREE.Color('#0e1936') },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 420).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: waterUniforms, depthWrite: false }),
  );
  water.position.set(0, WATER_Y, SHORE_Z - 210);
  water.renderOrder = -2;
  scene.add(water);

  /* ---------- the world ---------- */
  const anisotropy = Math.min(tier === 'desktop' ? 8 : 4, renderer.capabilities.getMaxAnisotropy());
  const world = buildWorld(scene, { tier, anisotropy });
  const glow = createGlowPoints(scene, world.glows, { mirror: true });
  const lanterns = createSkyLanterns(scene, { count: cfg.lanterns, distant: cfg.distant, map: skyLanternTexture(), mirror: true });
  const fireworks = createFireworks(scene, { capacity: cfg.fw, trail: cfg.trail, sparkScale: cfg.spark, mirror: true });
  const [perName, perHeart] = NAME_POINTS[tier];
  const names = createNameWriter(scene, { capacity: perName * 2 + perHeart });
  // the names' glow lying on the lake while they hang in the sky
  const namesGlow = new THREE.Mesh(new THREE.PlaneGeometry(26, 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(255,214,140,.55)'], [0.45, 'rgba(255,190,110,.16)'], [1, 'rgba(255,170,90,0)']]),
    transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  namesGlow.position.set(0, WATER_Y + 0.02, -52);
  namesGlow.renderOrder = -1;
  scene.add(namesGlow);
  let namesGlowUntil = 0, namesGlowFrom = 0;

  const leakMat = new THREE.MeshBasicMaterial({
    map: glowTexture([[0, 'rgba(255,247,224,1)'], [0.25, 'rgba(255,214,140,.55)'], [1, 'rgba(255,190,90,0)']]),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
  });
  const leak = new THREE.Mesh(new THREE.PlaneGeometry(0.5, HS + 1.4), leakMat);
  leak.position.set(0, (HS + 1) / 2, HINGE_Z + T / 2 + 0.03);
  scene.add(leak);

  /* ---------- where things sit in front of a station's camera ---------- */
  function basisOf(name) {
    const st = STATIONS[name], q = qLook(st.pos, st.look);
    return { pos: st.pos, right: V(1, 0, 0).applyQuaternion(q), up: V(0, 1, 0).applyQuaternion(q), fwd: V(0, 0, -1).applyQuaternion(q), q };
  }
  // NDC (−1…1) at a distance from a station → a world point; half sizes of the view at that distance
  function viewAt(name, dist) {
    const b = basisOf(name), hh = dist * Math.tan(THREE.MathUtils.degToRad(fovFor(name) / 2)), hw = hh * camera.aspect;
    return { ...b, hh, hw, at: (nx, ny) => b.pos.clone().addScaledVector(b.fwd, dist).addScaledVector(b.right, nx * hw).addScaledVector(b.up, ny * hh) };
  }

  /* ---------- chapter four: two medallions hanging from the chandelier tree ---------- */
  const couple = { group: new THREE.Group(), items: [], heart: null, built: false };
  scene.add(couple.group);
  const enamel = new THREE.MeshStandardMaterial({ color: 0x111d45, roughness: 0.35, metalness: 0.2 });
  const roseMat = new THREE.MeshStandardMaterial({ color: 0xf1b8c4, roughness: 0.55, emissive: 0x2a1418, side: THREE.DoubleSide });
  async function buildCouple() {
    const family = await fontsReady(['العريس أحمد', 'العروس عبير']);
    const { brass, bloomMat, leafGreen } = world.materials;
    const bloom = bloomGeometry(), cluster = softClusterGeometry();
    const make = (portrait, label) => {
      const pivot = new THREE.Group(), body = new THREE.Group();
      pivot.add(body);
      const tex = new THREE.CanvasTexture(portrait);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.96, 72), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.62, roughness: 0.6 }));
      const back = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.08, 72).rotateX(Math.PI / 2), enamel);
      back.position.z = -0.05;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.075, 20, 96), brass);
      const beads = new THREE.Mesh(new THREE.TorusGeometry(1.13, 0.026, 10, 96), brass);
      beads.position.z = -0.01;
      // the crown of flowers on top of the medallion
      const crown = new THREE.InstancedMesh(bloom, bloomMat, 7), roses = new THREE.InstancedMesh(bloom, roseMat, 3), leaves = new THREE.InstancedMesh(cluster, leafGreen, 9);
      const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
      const onArc = (a, r) => pv.set(Math.cos(a) * r, Math.sin(a) * r, 0.08);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.32 + i * 0.045);
        leaves.setMatrixAt(i, m.compose(onArc(a, 1.06), qq.identity(), sv.set(0.13, 0.11, 0.1)));
        leaves.setColorAt(i, new THREE.Color(['#24391f', '#2c4426', '#33492a'][i % 3]));
      }
      for (let i = 0; i < 7; i++) {
        qq.setFromUnitVectors(V(0, 1, 0), V((i - 3) * 0.12, 0.5, 1).normalize());
        crown.setMatrixAt(i, m.compose(onArc(Math.PI * (0.33 + i * 0.056), 1.1).setZ(0.16), qq, sv.setScalar(0.085)));
      }
      for (let i = 0; i < 3; i++) {
        qq.setFromUnitVectors(V(0, 1, 0), V(0, 0.4, 1).normalize());
        roses.setMatrixAt(i, m.compose(onArc(Math.PI * (0.42 + i * 0.08), 1.14).setZ(0.2), qq, sv.setScalar(0.1)));
      }
      // cords up into the canopy, and the name ribbon below
      const cords = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 6, 5).translate(0, 4.05, -0.02), brass);
      const rib = new THREE.PlaneGeometry(2.5, 0.62, 24, 1);
      const rp = rib.attributes.position;
      for (let i = 0; i < rp.count; i++) { const x = rp.getX(i); rp.setZ(i, 0.12 - 0.07 * x * x); rp.setY(i, rp.getY(i) + 0.05 * x * x); }
      rib.computeVertexNormals();
      const rtex = ribbonTexture(label, family);
      const ribbon = new THREE.Mesh(rib, new THREE.MeshStandardMaterial({ map: rtex, emissiveMap: rtex, emissive: 0xffffff, emissiveIntensity: 0.5, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, roughness: 0.7 }));
      ribbon.position.set(0, -1.32, 0.05);
      body.add(back, face, rim, beads, crown, roses, leaves, cords, ribbon);
      couple.group.add(pivot);
      return { pivot, body, phase: Math.random() * 6 };
    };
    // a real photo (public/assets/groom.jpg …) replaces the cartoon portrait, cropped to a square
    const photo = url => new Promise(res => {
      if (!url) return res(null);
      const img = new Image();
      img.onload = () => {
        const S = 768, c = document.createElement('canvas'), k = Math.max(S / img.width, S / img.height);
        c.width = c.height = S;
        c.getContext('2d').drawImage(img, (S - img.width * k) / 2, (S - img.height * k) / 2, img.width * k, img.height * k);
        res(c);
      };
      img.onerror = () => res(null);
      img.src = url;
    });
    const [gp, bp] = await Promise.all([photo(photos.groom), photo(photos.bride)]);
    couple.items = [make(gp || groomPortrait(), 'العريس أحمد'), make(bp || bridePortrait(), 'العروس عبير')];
    const heartGeo = new THREE.ExtrudeGeometry(heartShape(1), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 5, curveSegments: 24 });
    heartGeo.center();
    couple.heart = new THREE.Mesh(heartGeo, withRim(new THREE.MeshPhysicalMaterial({
      color: 0xe9a9b8, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15, emissive: 0x5a1e2c, emissiveIntensity: 0.6,
    }), '#ffd9e1', 0.6));
    couple.group.add(couple.heart);
    couple.built = true;
    layoutCouple();
  }
  // the pair scales and spreads to the screen: side by side, the heart between
  function layoutCouple() {
    if (!couple.built) return;
    const v = viewAt('couple', 4.2), portrait = camera.aspect < 1;
    const R = Math.min(v.hw * 0.33, v.hh * 0.27);
    const gap = R * (portrait ? 1.42 : 1.55);
    couple.items.forEach((it, i) => {
      // RTL: the groom on the right, the bride on the left
      const c = v.at(0, portrait ? -0.06 : -0.02).addScaledVector(v.right, (i === 0 ? 1 : -1) * gap);
      it.pivot.position.copy(c);
      it.pivot.quaternion.copy(v.q);
      it.pivot.scale.setScalar(R);
      it.center = c.clone();
      it.radius = R * 1.3;
    });
    couple.heart.position.copy(v.at(0, portrait ? -0.1 : -0.06));
    couple.heart.quaternion.copy(v.q);
    couple.heart.userData.base = R * 0.42;
    couple.heart.scale.setScalar(R * 0.42);
  }

  /* ---------- chapter two: the names, written by fireworks ---------- */
  let quietUntil = 0;
  async function playNames({ still = false } = {}) {
    const family = await fontsReady(['أحمد', 'عبير']);
    const v = viewAt('names', 36), portrait = camera.aspect < 1;
    const fit = (shape, height, maxWidth) => {
      const xs = shape.pts.map(p => p[0]), ys = shape.pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const k = Math.min(height / (y1 - y0), maxWidth / (x1 - x0));
      return { k, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: (x1 - x0) * k, h: (y1 - y0) * k, pts: shape.pts };
    };
    const A = sampleText('أحمد', family, perName), B = sampleText('عبير', family, perName), H = sampleHeart(perHeart);
    // mobile: stacked أحمد / ♥ / عبير in the open sky above the arch; wide screens: one line
    const slots = portrait
      ? [[A, 0, 0.63, 0.26, 1.7], [H, 0, 0.355, 0.17, 0.5], [B, 0, 0.1, 0.26, 1.7]]
      : [[A, 0.43, 0.44, 0.36, 0.8], [H, 0, 0.44, 0.24, 0.3], [B, -0.43, 0.44, 0.36, 0.8]];
    const T0 = clock;
    const plan = still ? [-20, -20, -20] : [1.5, 2.9, 4.5];          // when each shell bursts
    const groups = slots.map(([shape, nx, ny, hNdc, wNdc], i) => {
      const f = fit(shape, hNdc * v.hh, wNdc * v.hw);
      const origin = v.at(nx, ny);
      const points = f.pts.map(([x, y]) => origin.clone().addScaledVector(v.right, (x - f.cx) * f.k).addScaledVector(v.up, (y - f.cy) * f.k));
      const heart = shape === H;
      const size = Math.sqrt((f.w * f.h * (heart ? 0.55 : 0.32)) / points.length) * (heart ? 1.7 : 1.9);
      return {
        points, burst: origin.clone(), tBurst: T0 + plan[i], tSettle: T0 + plan[i] + 0.35, settleDur: heart ? 1.5 : 1.9,
        palette: heart ? ['#f7c9d2', '#e9b5c1', '#f1d6a5', '#fff0e6'] : ['#f1d6a5', '#ffd27a', '#fff3d6', '#d6ad69'],
        kind: heart ? 1 : 0, size, speed: Math.max(f.w, f.h) * 1.15,
      };
    });
    const dissolve = still ? 1e9 : T0 + 13;
    names.write(groups, dissolve);
    namesGlowFrom = T0 + (still ? -20 : 2);
    namesGlowUntil = dissolve + 2;
    if (still) return;
    groups.forEach((g, i) => {
      at(plan[i] - 1.3, () => fireworks.rocket(V(g.burst.x, WATER_Y, g.burst.z), g.burst, clock, 1.3));
      at(plan[i], () => fireworks.flash(g.burst, clock));
    });
    // sparks falling from the letters while they hang there, and quiet far fireworks
    for (let t = 6.6; t < 12.6; t += 0.22) {
      at(t, () => {
        const g = groups[(Math.random() * 3) | 0], p = g.points[(Math.random() * g.points.length) | 0];
        fireworks.sparks([[p, V((Math.random() - 0.5) * 0.3, -0.4, 0), 1.6, Math.random() < 0.5 ? '#ffd27a' : '#fff3d6', g.size * 1.4]], clock);
      });
    }
    at(8.2, () => burstAt('bloom', -70, 16, -150));
    at(10.4, () => burstAt('willow', 75, 18, -160));
    at(6.6, () => onCue?.('names-formed'));
    at(16.4, () => onCue?.('names-done'));
    quietUntil = T0 + 17;
    nextBurst = Math.max(nextBurst, quietUntil + 2);
  }

  /* ---------- games preview (?games=1): hidden hearts and the game entrances, loaded on demand ---------- */
  let garden = null;
  const gardenReady = games
    ? Promise.all([import('./garden'), fontsReady(['تحدي العروسين', 'تحدي العروسة', 'اكتب أمنيتك', 'افتح الرسالة'])]).then(([m, family]) => {
      garden = m.createGarden(scene, {
        materials: world.materials, bloom: bloomGeometry(), family, found: foundHearts, moon: MOON,
        door: { left: world.leftHinge, right: world.rightHinge }, canopy: world.canopy,
      });
    })
    : Promise.resolve();

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(0x3b4c7a, 0x20160c, 0.55);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xaec0ff, 0.7);
  moonLight.position.copy(MOON);
  scene.add(moonLight);
  const spill = new THREE.PointLight(0xffb565, 0, 0, 2);
  spill.position.set(0, 1.3, 0.6);
  scene.add(spill);
  [[0, 0.8, -6.5], [0, 0.8, -12.5], [0, 0.8, -17.5]].slice(0, cfg.gardenLights).forEach(([x, y, z]) => {
    const l = new THREE.PointLight(0xffb36a, 2.4, 0, 1.8);
    l.position.set(x, y, z);
    scene.add(l);
  });
  const archLight = new THREE.PointLight(0xffd59a, 5, 0, 1.8);
  archLight.position.set(0, 1.6, world.archZ + 1.2);
  scene.add(archLight);
  const treeLight = new THREE.PointLight(0xffc27a, 7, 0, 1.7);
  treeLight.position.set(GRAND.x + 0.8, 3.4, GRAND.z + 1.4);
  scene.add(treeLight);
  if (tier === 'desktop') {
    const l = new THREE.PointLight(0xffc27a, 3.2, 0, 1.8);
    l.position.set(1.8, 4.7, -9.2);
    scene.add(l);
  }

  /* ---------- atmosphere: mist layers over the lake, fireflies over the lawn ---------- */
  const mistTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 128, 0, 0);
    grd.addColorStop(0, 'rgba(255,255,255,.9)');
    grd.addColorStop(0.35, 'rgba(255,255,255,.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(c);
  })();
  [[-25, 0.1], [-36, 0.12], [-52, 0.14], [-84, 0.16]].forEach(([z, o]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(300, 6), new THREE.MeshBasicMaterial({
      map: mistTex, color: 0x9fb2e0, transparent: true, opacity: o, depthWrite: false, fog: false,
    }));
    m.position.set(0, 2.9, z);
    scene.add(m);
  });
  const fireflies = createFireflies(scene, { desktop: 70, mobile: 45, low: 20 }[tier], { x0: -9, x1: 9, z0: -3, z1: -19 });

  /* ---------- the camera rig ---------- */
  const rig = {
    index: CHAPTERS.indexOf(start) < 0 ? 0 : CHAPTERS.indexOf(start),
    leg: null,               // { curve, qFrom, qTo, t0, duration, door, reverse, resolve }
    unlock: 0,
    swing: 0,
    fovGarden: 46,
    namesOnDoor: false,      // write the names as the next door leg opens the door
  };
  const qLook = (pos, look) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, look, new THREE.Vector3(0, 1, 0)));
  const stationPos = name => STATIONS[name].pos;

  function fovFor(name) { return name === 'door' ? 40 : rig.fovGarden; }

  function setPose(name) {
    camera.position.copy(stationPos(name));
    camera.quaternion.copy(qLook(stationPos(name), STATIONS[name].look));
    camera.fov = fovFor(name);
  }

  function legBetween(fromIdx, toIdx) {
    const forward = toIdx > fromIdx;
    const a = CHAPTERS[forward ? fromIdx : toIdx], b = CHAPTERS[forward ? toIdx : fromIdx];
    const spec = LEGS[`${a}>${b}`];
    const pts = [stationPos(a).clone(), ...spec.via.map(v => v.clone()), stationPos(b).clone()];
    if (!forward) pts.reverse();
    return {
      curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'),
      qFrom: camera.quaternion.clone(),
      qTo: qLook(stationPos(CHAPTERS[toIdx]), STATIONS[CHAPTERS[toIdx]].look),
      fovFrom: camera.fov, fovTo: fovFor(CHAPTERS[toIdx]),
      // walking back out through the door is quicker than the entrance
      duration: spec.door && !forward ? 3.4 : spec.duration,
      door: !!spec.door, forward, toIdx,
    };
  }

  /* one leg of travel; the door leg carries its own choreography */
  function advance(leg, t) {
    if (leg.door && leg.forward) {
      // 0–14 % unlock and light, 10–48 % the leaves swing, from 20 % the walk
      rig.unlock = easeOut(range(t, 0, 0.14));
      rig.swing = easeInOut(range(t, 0.1, 0.48));
      const walk = easeInOut(range(t, 0.2, 1));
      camera.position.copy(leg.curve.getPointAt(walk));
      camera.quaternion.slerpQuaternions(leg.qFrom, leg.qTo, easeInOut(range(t, 0.62, 1)));
      camera.fov = THREE.MathUtils.lerp(leg.fovFrom, leg.fovTo, easeInOut(range(t, 0.25, 0.75)));
    } else if (leg.door) {
      const walk = easeInOut(t);
      camera.position.copy(leg.curve.getPointAt(walk));
      camera.quaternion.slerpQuaternions(leg.qFrom, leg.qTo, easeInOut(range(t, 0, 0.4)));
      camera.fov = THREE.MathUtils.lerp(leg.fovFrom, leg.fovTo, easeInOut(range(t, 0.4, 0.9)));
      rig.swing = 1 - easeInOut(range(t, 0.7, 1));
      rig.unlock = 1 - range(t, 0.9, 1);
    } else {
      const e = easeInOut(t);
      camera.position.copy(leg.curve.getPointAt(e));
      camera.quaternion.slerpQuaternions(leg.qFrom, leg.qTo, e);
      camera.fov = THREE.MathUtils.lerp(leg.fovFrom, leg.fovTo, e);
    }
  }

  /* exploration (games preview): the camera flies to one overlook — just inside the door, above the
     head of the aisle — and the guest looks around from there: all the way round, up to the moon
     (where the countdown and the verse hang while exploring) and down to the lawn, and zooms in on
     anything far. Only the head turns and the lens narrows at the overlook, so it can never pass
     through anything. Measured with __cine.sight / clearance / obstruction over 150 points by the
     door: from here nothing solid stands between the eye and any garden heart, game entrance, the
     moon or the two sky signs; leaves fill under a tenth of the frame; the nearest surface is 2.75 m away. */
  const OVERLOOK = { pos: V(-1.2, 3.8, -7.5), yaw: THREE.MathUtils.degToRad(-8), pitch: THREE.MathUtils.degToRad(-12), wider: 12, moon: 0.8 };
  const PITCH_MIN = THREE.MathUtils.degToRad(-60), PITCH_MAX = THREE.MathUtils.degToRad(45), ZOOM_MAX = 4;
  const look = { on: false, yaw: 0, target: 0, pitch: 0, pitchTarget: 0, zoom: 1, zoomTarget: 1, hop: null };
  const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const overlookQ = (yaw, pitch, q = new THREE.Quaternion()) => q.setFromEuler(lookEuler.set(pitch, -yaw, 0, 'YXZ'));
  const overlookFov = zoom => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(rig.fovGarden + OVERLOOK.wider) / 2) / zoom));
  function overlookPose(dt) {
    const k = Math.min(1, dt * 9), near = (a, b) => Math.abs(a - b) < 1e-4;
    look.yaw += (look.target - look.yaw) * k;
    look.pitch += (look.pitchTarget - look.pitch) * k;
    look.zoom += (look.zoomTarget - look.zoom) * k;
    if (near(look.yaw, look.target)) look.yaw = look.target;
    if (near(look.pitch, look.pitchTarget)) look.pitch = look.pitchTarget;
    if (near(look.zoom, look.zoomTarget)) look.zoom = look.zoomTarget;
    camera.position.copy(OVERLOOK.pos);
    overlookQ(look.yaw, look.pitch, camera.quaternion);
    camera.fov = overlookFov(look.zoom);
  }
  // a little more moonlight while exploring, so the far corners read; eased in and out
  function lightForLook(dt) {
    const want = look.on ? OVERLOOK.moon : 0.55;
    hemi.intensity += (want - hemi.intensity) * Math.min(1, dt * 3);
    if (Math.abs(want - hemi.intensity) < 1e-3) hemi.intensity = want;
  }
  // the flight between a chapter's station and the overlook, lifted a little in the middle
  const hopTo = new THREE.Quaternion(), hopMid = new THREE.Vector3(), hopPos = new THREE.Vector3();
  function advanceHop(hop) {
    const t = clamp((clock - hop.t0) / hop.duration), e = easeInOut(t);
    const station = STATIONS[CHAPTERS[rig.index]];
    const toPos = hop.on ? OVERLOOK.pos : station.pos;
    if (hop.on) overlookQ(OVERLOOK.yaw, OVERLOOK.pitch, hopTo); else hopTo.copy(qLook(station.pos, station.look));
    hopMid.lerpVectors(hop.from, toPos, 0.5).y += 0.8;
    // quadratic Bézier: from → lifted middle → to
    hopPos.copy(hop.from).multiplyScalar((1 - e) * (1 - e)).addScaledVector(hopMid, 2 * (1 - e) * e).addScaledVector(toPos, e * e);
    camera.position.copy(hopPos);
    camera.quaternion.slerpQuaternions(hop.q, hopTo, e);
    camera.fov = THREE.MathUtils.lerp(hop.fov, hop.on ? overlookFov(1) : fovFor(CHAPTERS[rig.index]), e);
    return t >= 1;
  }
  // while exploring, every unfound heart carries a soft glow ~46 px across whatever the distance or zoom
  // (the zoom and the camera also tell the garden when to let the verse and the countdown show through the trees)
  const beacon = () => ({ from: camera.position, metresPerPx: (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / (renderer.domElement.clientHeight || window.innerHeight), px: 46, zoom: look.zoom, camera });
  // reduced motion draws on demand: bring the garden (and its explore beacons) up to date first
  const renderStill = () => { hemi.intensity = look.on ? OVERLOOK.moon : 0.55; garden?.update(clock, true, look.on ? beacon() : null); render(); };
  const turning = () => look.yaw !== look.target || look.pitch !== look.pitchTarget || look.zoom !== look.zoomTarget || !!look.hop || hemi.intensity !== (look.on ? OVERLOOK.moon : 0.55);
  function aimHome() {
    look.yaw = look.target = OVERLOOK.yaw;
    look.pitch = look.pitchTarget = OVERLOOK.pitch;
    look.zoom = look.zoomTarget = 1;
  }
  function settleLook(on) {
    look.hop = null;
    look.on = on;
    aimHome();
    // the hanging medallions belong to the couple's own view; from the overlook they would float in the air
    couple.group.visible = !on;
  }

  /* a gentle breath while the camera rests, so the world never freezes */
  const idle = new THREE.Quaternion(), idleEuler = new THREE.Euler();
  function breathe(t) {
    if (reducedMotion) return;
    idleEuler.set(Math.sin(t * 0.31) * 0.004, Math.sin(t * 0.23) * 0.006, 0);
    camera.quaternion.multiply(idle.setFromEuler(idleEuler));
    camera.position.y += Math.sin(t * 0.4) * 0.015;
  }

  /* ---------- the show ---------- */
  let clock = 0, nextBurst = Infinity;
  const timeline = [];
  const at = (delay, fn) => timeline.push({ t: clock + delay, fn });
  const burstAt = (kind, x, y, z) => {
    const p = new THREE.Vector3(x, y, z);
    fireworks.launch(kind, p, clock, { rocketFrom: new THREE.Vector3(x, WATER_Y, z), camera });
  };
  const calmBurst = () => {
    burstAt(Math.random() < 0.65 ? 'willow' : 'bloom', (Math.random() - 0.5) * 50, 18 + Math.random() * 10, -62 - Math.random() * 14);
    nextBurst = clock + 8 + Math.random() * 4;
  };
  /* three shells in whatever sky the camera is looking at (RSVP, the finale) */
  function celebrate() {
    if (reducedMotion) return;
    [['willow', 0, 0.6], ['bloom', -0.5, 0.48], ['bloom', 0.5, 0.52]].forEach(([kind, nx, ny], i) => at(i * 0.7, () => {
      const p = ndcPoint(nx, ny, 58);
      p.y = Math.max(p.y, 9);
      fireworks.launch(kind, p, clock, { rocketFrom: V(p.x, WATER_Y, p.z), camera });
    }));
  }
  const onCelebrate = () => celebrate();
  window.addEventListener('wedding:celebrate', onCelebrate);

  /* a guest's wish (final chapter only): tap empty sky → a star */
  const ndcPoint = (nx, ny, dist) => {
    const dir = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    return camera.position.clone().addScaledVector(dir, dist);
  };
  const raycaster = new THREE.Raycaster(), hit = new THREE.Vector3(), lakePlane = new THREE.Plane(V(0, 1, 0), -WATER_Y);
  const HOTSPOTS = [
    { id: 'countdown', sphere: new THREE.Sphere(MOON, 22) },
    { id: 'couple', sphere: new THREE.Sphere(V(GRAND.x, 4.6, GRAND.z), 4.2) },
    { id: 'rsvp', sphere: new THREE.Sphere(V(0, 1.4, world.archZ), 1.9) },
    { id: 'names', sphere: new THREE.Sphere(V(0, 1.6, 0.2), 1.5) },
  ];
  /* what is under a screen point: the chapter it belongs to, or null */
  function pick(clientX, clientY) {
    raycaster.setFromCamera({ x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 }, camera);
    const ray = raycaster.ray;
    let best = null, bestD = Infinity;
    const test = (id, sphere) => {
      if (ray.intersectSphere(sphere, hit)) {
        const d = hit.distanceTo(ray.origin);
        if (d < bestD) { bestD = d; best = id; }
      }
    };
    HOTSPOTS.forEach(h => test(h.id, h.sphere));
    if (couple.built) couple.items.forEach(it => test('couple', new THREE.Sphere(it.center, it.radius)));
    if (best) return best;
    if (ray.direction.y < 0 && ray.intersectPlane(lakePlane, hit) && hit.z < SHORE_Z - 0.5) return 'names';
    if (ray.direction.y > 0.42) return 'sky';
    return null;
  }

  /* a heart or a game entrance under a screen point (games preview), or null */
  function interact(clientX, clientY) {
    if (!garden || rig.leg || look.hop) return null;
    return garden.pick(clientX, clientY, camera, window.innerWidth, window.innerHeight);
  }
  function collectHeart(id) {
    const h = garden?.collect(id, clock);
    if (!h) return false;
    if (!reducedMotion) {
      const c = h.group.position.clone().add(h.mesh.position), d = c.distanceTo(camera.position);
      const list = [];
      for (let i = 0; i < 46; i++) {
        const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(h.size * (2 + Math.random() * 3));
        list.push([c, v, 0.9 + Math.random() * 0.8, ['#ffd27a', '#fff3d6', '#f1d6a5', '#f7c9d2'][i % 4], d * 0.011]);
      }
      fireworks.sparks(list, clock);
      fireworks.flash(c, clock);
    } else { garden.update(clock, true); render(); }
    return true;
  }
  /* all five hearts (the guest is brought to the names' own sky first): golden shells, then the names again */
  function heartsFinale() {
    if (reducedMotion) return;
    ['willow', 'willow', 'willow', 'willow'].forEach((kind, i) => at(0.2 + i * 0.55, () => {
      const p = ndcPoint([-0.55, 0.5, 0, -0.2][i], [0.55, 0.62, 0.72, 0.5][i], 60);
      p.y = Math.max(p.y, 10);
      fireworks.launch(kind, p, clock, { rocketFrom: V(p.x, WATER_Y, p.z), camera });
    }));
    at(2.4, () => playNames());
  }
  /* a guest's written wish rises as a golden star into the sky in front of them */
  function wishStar() {
    if (reducedMotion) return;
    const p = ndcPoint((Math.random() - 0.5) * 0.5, 0.62, 48);
    p.y = Math.max(p.y, camera.position.y + 8);
    fireworks.wish(p, clock);
  }

  function wish(clientX, clientY) {
    if (reducedMotion || rig.leg || CHAPTERS[rig.index] !== 'sky') return false;
    const p = ndcPoint((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, 48);
    if (p.y < camera.position.y + 3) return false;
    fireworks.wish(p, clock);
    return true;
  }

  /* ---------- size ---------- */
  const tmpV2 = new THREE.Vector2();
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(20));
    const halfW = camera.aspect > 1 ? 3.3 : 1.55;
    STATIONS.door.pos.z = Math.max(2.1 / t, halfW / (t * camera.aspect));
    rig.fovGarden = camera.aspect < 0.8 ? 62 : camera.aspect < 1.2 ? 54 : 46;
    if (!rig.leg) setPose(CHAPTERS[rig.index]);
    layoutCouple();
  }

  /* ---------- loop ---------- */
  const t0 = performance.now();
  let raf = 0, last = 0, frames = 0, slowFrames = 0, running = false;

  function render() {
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    skyGroup.position.copy(camera.position);
    const px = renderer.getDrawingBufferSize(tmpV2).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    for (const u of [fireworks.uniforms, glow.uniforms, lanterns.uniforms, fireflies.uniforms, names.uniforms]) u.uPx.value = px;
    stars.uniforms.uScale.value = pixelRatio;
    waterUniforms.uCam.value.copy(camera.position);
    showInterior(!(CHAPTERS[rig.index] === 'door' && !rig.leg && rig.swing === 0));
    world.latch.rotation.z = rig.unlock * Math.PI / 2;
    namesGlow.material.opacity = clamp((clock - namesGlowFrom) / 3) * (1 - clamp((clock - namesGlowUntil + 3) / 3)) * 0.85;
    if (couple.built) {
      couple.items.forEach(it => { it.body.rotation.z = reducedMotion ? 0 : Math.sin(clock * 0.55 + it.phase) * 0.035; });
      couple.heart.scale.setScalar(couple.heart.userData.base * (reducedMotion ? 1 : 1 + 0.05 * Math.sin(clock * 2.4)));
    }
    world.leftHinge.rotation.y = rig.swing * MAX_ANGLE;
    world.rightHinge.rotation.y = -rig.swing * MAX_ANGLE;
    leakMat.opacity = rig.unlock * (1 - rig.swing) * 0.9;
    spill.intensity = 3.5 * rig.unlock + 2 * rig.swing;
    world.glassMat.color.setScalar(0.85 + 0.45 * rig.unlock);
    for (const u of [fireworks.uniforms, glow.uniforms, lanterns.uniforms, stars.uniforms, waterUniforms, fireflies.uniforms, names.uniforms]) u.uTime.value = clock;
    renderer.render(scene, camera);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // calm = the camera rests and no shell is in the air: candles and stars are as good at 30 fps,
    // and a phone spends half the battery and heat on them
    const calm = !rig.leg && clock >= fireworks.aliveUntil && clock >= names.aliveUntil && !turning() && !garden?.animating();
    const fps = calm && tier !== 'desktop' ? 30 : cfg.fps;
    const dt = now - last;
    if (fps < 60 && dt < 1000 / fps - 2) return;
    last = now;

    // adaptive quality: when many of 60 frames miss their budget, draw fewer pixels
    frames++;
    if (dt > (1000 / fps) * 1.5) slowFrames++;
    if (frames === 60) {
      if (slowFrames > 24 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
      }
      frames = slowFrames = 0;
    }

    const prevClock = clock;
    clock = (now - t0) / 1000 / slowmo;
    const leg = rig.leg;
    if (leg) {
      const t = clamp((clock - leg.t0) / leg.duration);
      advance(leg, t);
      if (t >= 1) {
        rig.leg = null;
        rig.index = leg.toIdx;
        setPose(CHAPTERS[rig.index]);
        leg.resolve();
      }
    } else if (look.hop) {
      if (advanceHop(look.hop)) { const { on, resolve } = look.hop; settleLook(on); resolve(); }
    } else if (look.on) {
      overlookPose(clock - prevClock);
      breathe(clock);
    } else {
      setPose(CHAPTERS[rig.index]);
      breathe(clock);
    }
    lightForLook(clock - prevClock);
    garden?.update(clock, false, look.on && !look.hop ? beacon() : null);
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].t <= clock) { const { fn } = timeline[i]; timeline.splice(i, 1); fn(); }
    }
    if (clock >= nextBurst && clock >= quietUntil) calmBurst();
    // particle systems with nothing alive are not drawn at all (~30 000 points on a phone)
    const fwLive = clock < fireworks.aliveUntil, nLive = clock < names.aliveUntil;
    fireworks.objects.forEach(o => { o.visible = fwLive; });
    names.objects.forEach(o => { o.visible = nLive; });
    render();
  }

  let suspended = false;           // a game is open over the invitation: draw nothing until it closes
  function play() { if (!running && !reducedMotion && !suspended) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function pause() { running = false; cancelAnimationFrame(raf); }
  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onVisibility);

  const lost = e => { e.preventDefault(); pause(); onContextLost?.(); };
  canvas.addEventListener('webglcontextlost', lost);

  /* ---------- start ---------- */
  if (rig.index > 0) { rig.unlock = rig.swing = 1; nextBurst = 1.5; }
  resize();
  /* everything inside the walls: not drawn while the door is shut (the first screen) */
  const interior = [];
  function collectInterior() {
    const sph = new THREE.Sphere();
    scene.updateMatrixWorld(true);
    scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh) || o === water || o === namesGlow) return;
      if (o.isInstancedMesh) { o.computeBoundingSphere(); sph.copy(o.boundingSphere); }
      else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); sph.copy(o.geometry.boundingSphere); }
      sph.applyMatrix4(o.matrixWorld);
      if (sph.center.z + sph.radius < -0.9 && !world.leftHinge.getObjectById(o.id) && !world.rightHinge.getObjectById(o.id)) interior.push(o);
    });
  }
  let interiorShown = true;
  function showInterior(on) {
    if (on === interiorShown) return;
    interiorShown = on;
    interior.forEach(o => { o.visible = on; });
  }

  /* compile every shader before the first frame — including the garden behind the closed door and
     the fireworks and names that are hidden until they fly — so nothing compiles mid-animation
     (on phones that was a visible hitch as the door opened and the first rockets rose) */
  async function prewarm() {
    const hidden = [];
    scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try { await renderer.compileAsync(scene, camera); } catch { /* compiled on first use instead */ }
    hidden.forEach(o => { o.visible = false; });
  }
  const ready = Promise.all([world.ready, buildCouple(), gardenReady]).then(async () => {
    await prewarm();
    collectInterior();
    if (reducedMotion) {
      clock = 12;
      await playNames({ still: true });        // the names stand formed, without the show
      render();
    } else play();
  });
  if (debug) {
    window.__cine = {
      info: () => ({ ...renderer.info.render, ...renderer.info.memory, programs: renderer.info.programs.length, tier, pixelRatio }),
      pick: (x, y) => pick(x, y),
      // the heaviest meshes: triangles × instances
      top: () => {
        const rows = [];
        scene.traverse(o => {
          if (!o.isMesh || !o.geometry) return;
          const g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
          rows.push([Math.round(tris * (o.count || 1)), Math.round(tris), o.count || 1, o.material?.type, o.parent?.type]);
        });
        return rows.sort((a, b) => b[0] - a[0]).slice(0, 12);
      },
      // the hidden hearts and game entrances on screen (games preview), and whether something stands in front of them
      garden: () => {
        if (!garden) return null;
        const rc = new THREE.Raycaster(), out = {};
        rc.camera = camera;            // sprites need it to be raycast
        const blocked = (p, own) => {
          const dir = p.clone().sub(camera.position), d = dir.length();
          rc.set(camera.position, dir.normalize());
          rc.far = d - 0.05;
          return rc.intersectObjects(scene.children, true).some(h => (h.object.isMesh || h.object.isInstancedMesh) && h.object.visible && !own.getObjectById(h.object.id) && !(couple.group.getObjectById(h.object.id) && !couple.group.visible) && h.object !== water && h.object !== namesGlow && !h.object.isSprite
            && !(h.object.material?.transparent && h.object.material.opacity < 0.5));   // the mist veils hide nothing
        };
        garden.hearts.forEach(h => { const c = h.group.position.clone().add(h.mesh.position); out[`heart:${h.id}`] = { ...garden.screenOf(c, camera, window.innerWidth, window.innerHeight), found: h.found, blocked: blocked(c, h.group) }; });
        Object.entries(garden.props).forEach(([id, p]) => { out[`game:${id}`] = { ...garden.screenOf(p.center, camera, window.innerWidth, window.innerHeight), blocked: blocked(p.center, p.group) }; });
        return out;
      },
      look: () => ({ on: look.on, yaw: look.yaw, target: look.target, pitch: look.pitch, zoom: look.zoom, hop: !!look.hop }),
      lookTo: (yaw, pitch) => { look.target = yaw; if (pitch !== undefined) look.pitchTarget = pitch; },
      // from a point: which hearts and game entrances can be seen with nothing in between, and where (debug only)
      sight: (x, y, z) => {
        if (!garden) return null;
        const o = V(x, y, z), rc = new THREE.Raycaster();
        rc.camera = camera;
        const meshes = [];
        // what really hides: solid meshes (the mist veils over the lake are ~10 % opaque and do not count)
        scene.traverse(m => { if ((m.isMesh || m.isInstancedMesh) && m !== water && m !== namesGlow && m.visible !== false && !(m.material?.transparent && m.material.opacity < 0.5)) meshes.push(m); });
        const targets = [
          ...garden.hearts.filter(h => h.id !== 'door').map(h => [`heart:${h.id}`, h.group.position, h.group]),
          ...Object.entries(garden.props).map(([id, pp]) => [`game:${id}`, pp.center, pp.group]),
          ...Object.entries(garden.sky?.points || {}).map(([id, pp]) => [id, pp, new THREE.Group()]),
        ];
        const out = {};
        for (const [id, p, own] of targets) {
          const d = p.clone().sub(o), dist = d.length();
          rc.set(o, d.clone().normalize()); rc.far = dist - 0.15;
          const hit = rc.intersectObjects(meshes, false).find(h => !own.getObjectById(h.object.id) && !couple.group.getObjectById(h.object.id));
          out[id] = { blocked: hit ? hit.object.name || hit.object.geometry?.type || 'mesh' : false, yaw: +THREE.MathUtils.radToDeg(Math.atan2(d.x, -d.z)).toFixed(1), elev: +THREE.MathUtils.radToDeg(Math.atan2(d.y, Math.hypot(d.x, d.z))).toFixed(1), dist: +dist.toFixed(1) };
        }
        return out;
      },
      // how much of a portrait frame is covered by something within `near` m (the ground does not count) — debug only
      obstruction: (x, y, z, yawDeg, pitchDeg, fovDeg = rig.fovGarden + OVERLOOK.wider, near = 6) => {
        const o = V(x, y, z), rc = new THREE.Raycaster(), q = overlookQ(THREE.MathUtils.degToRad(yawDeg), THREE.MathUtils.degToRad(pitchDeg));
        rc.camera = camera; rc.far = near;
        const ground = new Set(); scene.traverse(m => { if (m.isMesh && m.geometry?.type === 'PlaneGeometry' && Math.abs(m.rotation.x + Math.PI / 2) < 1e-3) ground.add(m); });
        const meshes = []; scene.traverse(m => { if ((m.isMesh || m.isInstancedMesh) && m !== water && m !== namesGlow && !ground.has(m) && !couple.group.getObjectById(m.id) && !(m.material?.transparent && m.material.opacity < 0.5)) meshes.push(m); });
        const th = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2), tw = th * camera.aspect;
        let hit = 0, n = 0;
        for (let i = 0; i < 9; i++) for (let j = 0; j < 15; j++) {
          const d = V(((i + 0.5) / 9 * 2 - 1) * tw, ((j + 0.5) / 15 * 2 - 1) * th, -1).normalize().applyQuaternion(q);
          rc.set(o, d); n++;
          if (rc.intersectObjects(meshes, false).length) hit++;
        }
        return +(hit / n).toFixed(3);
      },
      // try another overlook (debug only): position and pitch in degrees
      overlookAt: (x, y, z, pitchDeg) => { OVERLOOK.pos.set(x, y, z); OVERLOOK.pitch = THREE.MathUtils.degToRad(pitchDeg); },
      overlook: () => ({ ...OVERLOOK, pos: OVERLOOK.pos.toArray() }),
      clearance: (x = OVERLOOK.pos.x, y = OVERLOOK.pos.y, z = OVERLOOK.pos.z) => {
        const rc = new THREE.Raycaster(), o = V(x, y, z);
        rc.camera = camera;
        let min = Infinity, at = null;
        for (let i = 0; i < 48; i++) {
          const el = ((i % 6) - 2.5) * 0.45, az = (Math.floor(i / 6) / 8) * Math.PI * 2;
          rc.set(o, V(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)));
          const hit = rc.intersectObjects(scene.children, true).find(h => (h.object.isMesh || h.object.isInstancedMesh) && h.object !== water && !h.object.isSprite && h.object.geometry?.type !== 'SphereGeometry');
          if (hit && hit.distance < min) { min = hit.distance; at = hit.point.toArray().map(v => +v.toFixed(2)); }
        }
        return { min: +min.toFixed(2), at };
      },
      loop: () => ({ running, suspended }),
      // where a world point (or a named landmark) is on screen
      screenOf: what => {
        const v = { moon: MOON, tree: V(GRAND.x, 4.6, GRAND.z), arch: V(0, 1.4, world.archZ), lake: V(3, WATER_Y, -40) }[what];
        const p = v.clone().project(camera);
        return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, inView: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1 };
      },
    };
  }

  return {
    tier,
    get index() { return rig.index; },
    get moving() { return !!rig.leg; },
    /* travel to a chapter, through every station on the way */
    async goTo(target) {
      target = clamp(target / (CHAPTERS.length - 1)) * (CHAPTERS.length - 1);
      if (rig.leg || target === rig.index) return;
      if (look.on || look.hop) await this.explore(false);      // back to the station first, then the journey
      // games preview: the letter on the door rolls up (if open) and its scroll lifts away before the door unlocks
      if (rig.index === 0 && garden?.poster.present) await garden.poster.leave(clock, reducedMotion);
      if (reducedMotion) {
        rig.index = target;
        layoutCouple();
        rig.unlock = rig.swing = target > 0 ? 1 : 0;
        setPose(CHAPTERS[target]);
        render();
        return;
      }
      const hops = Math.abs(target - rig.index);
      while (rig.index !== target) {
        const toIdx = rig.index + Math.sign(target - rig.index);
        const leg = legBetween(rig.index, toIdx);
        if (hops > 1 && !leg.door) leg.duration *= 0.7;     // passing through, not stopping
        leg.t0 = (performance.now() - t0) / 1000 / slowmo;      // now, not the last frame's clock
        if (leg.door && leg.forward && rig.namesOnDoor) { rig.namesOnDoor = false; at(NAMES_AT_DOOR, () => playNames()); }
        await new Promise(resolve => { leg.resolve = resolve; rig.leg = leg; });
        if (toIdx > 0 && nextBurst === Infinity) nextBurst = clock + 1.5;
      }
    },
    /* where a world point lands on screen (for anchoring HTML) */
    project(v) {
      const p = v.clone().project(camera);
      return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight, visible: p.z < 1 };
    },
    ready,
    playNames: () => playNames(),
    /* write the names as the door opens on the way in (the next door leg cues them) */
    namesOnDoor() { rig.namesOnDoor = true; },
    /* games preview: the letter on the door — its state, where it is on screen, open/close it */
    get letterState() { return garden?.poster.state ?? null; },
    letterLayout() { return garden?.poster.layout(camera, window.innerWidth, window.innerHeight) ?? null; },
    letterTo(open) {
      if (!garden || rig.leg || rig.index !== 0) return Promise.resolve();
      const done = garden.poster.to(open ? 1 : 0, clock, reducedMotion);
      if (reducedMotion) renderStill();
      return done;
    },
    /* «ابدأ المغامرة» pressed: the parchment sinks into the letter and a few golden sparks rise off it */
    letterStart() {
      if (!garden || rig.leg || rig.index !== 0 || garden.poster.state !== 'open') return Promise.resolve();
      const done = garden.poster.press(clock, reducedMotion);
      if (!reducedMotion) {
        const c = garden.poster.startPoint(), d = c.distanceTo(camera.position), list = [];
        for (let i = 0; i < 18; i++) {
          const from = c.clone().add(V((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.25, 0.04));
          const v = V((Math.random() - 0.5) * 0.5, 0.25 + Math.random() * 0.55, 0.15 + Math.random() * 0.2);
          list.push([from, v, 0.7 + Math.random() * 0.6, ['#ffd27a', '#fff3d6', '#f1d6a5', '#e3c27e'][i % 4], d * 0.008]);
        }
        fireworks.sparks(list, clock);
      }
      return done;
    },
    pick: (x, y) => (rig.leg ? null : pick(x, y)),
    /* a tap on the world: travel to what was touched — or, in the night sky, make a wish */
    tap(x, y) {
      if (rig.leg) return null;
      const here = CHAPTERS[rig.index], target = pick(x, y);
      if (here === 'sky' && (!target || target === 'sky')) { wish(x, y); return null; }
      return target && target !== here ? target : null;
    },
    wish,
    celebrate,
    /* games preview */
    interact,
    collectHeart,
    heartsFinale,
    wishStar,
    /* to the overlook (true) or back to the chapter's own station (false); resolves on arrival */
    explore(on) {
      if (look.hop) return look.hop.on === on ? look.hop.done : look.hop.done.then(() => this.explore(on));
      if (look.on === on || rig.leg || CHAPTERS[rig.index] === 'door') return Promise.resolve();
      if (reducedMotion) {
        settleLook(on);
        if (on) overlookPose(1); else setPose(CHAPTERS[rig.index]);
        renderStill();
        return Promise.resolve();
      }
      if (on) couple.group.visible = false;
      aimHome();
      const hop = { on, from: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov, t0: (performance.now() - t0) / 1000 / slowmo, duration: 1.6 };
      hop.done = new Promise(resolve => { hop.resolve = resolve; });
      look.hop = hop;
      return hop.done;
    },
    /* at the overlook: turn the head (all the way round; up and down within limits) — slower when
       zoomed in, so the same finger travel moves the same distance across the picture */
    lookBy(dYaw, dPitch = 0) {
      if (!look.on || look.hop || rig.leg) return;
      look.target += dYaw / look.zoomTarget;
      look.pitchTarget = Math.max(PITCH_MIN, Math.min(PITCH_MAX, look.pitchTarget + dPitch / look.zoomTarget));
      if (reducedMotion) { overlookPose(1); renderStill(); }
    },
    turn(rad) { this.lookBy(rad, 0); },
    /* zoom in (> 1) or out (< 1) by a factor, between the full view and ×4 */
    zoomBy(f) {
      if (!look.on || look.hop || rig.leg || !Number.isFinite(f) || f <= 0) return;
      look.zoomTarget = Math.max(1, Math.min(ZOOM_MAX, look.zoomTarget * f));
      if (reducedMotion) { overlookPose(1); renderStill(); }
    },
    get zoom() { return look.zoomTarget; },
    suspend() { suspended = true; pause(); },
    resume() { suspended = false; if (reducedMotion) render(); else play(); },
    resize() { resize(); if (reducedMotion) render(); },
    dispose() {
      pause();
      canvas.removeEventListener('webglcontextlost', lost);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('wedding:celebrate', onCelebrate);
      garden?.dispose();
      scene.traverse(o => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (!m) return;
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) u.value.dispose();
          m.dispose();
        });
      });
      envRT.dispose();
      renderer.dispose();
    },
  };
}
