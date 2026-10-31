import { assetPath } from '@/lib/asset-path';
/* ================================================================
   The world of «ليلة تحت النجوم»:
   • outside (z > 0): a limestone wall, a carved arch on pilasters,
     a walnut double door with amber glass behind wrought-iron
     scrollwork, hanging lanterns, floor lanterns, stone urns of flowers;
   • inside (z < 0): a lawn with a petal-strewn aisle lined with candle
     lanterns, a floral arch at the shore, trees with chandeliers,
     a calm lake with floating candles, hills and a far shoreline.
   Units: the door opening is 2 wide; 1 unit ≈ 1 m.
================================================================ */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  HS, LEAF_W, arc, archOutline, archBand, leafOutline, panelOutline, extrude, woodTexture, WOODS,
} from './geometry';
import {
  ashlarTexture, creamStoneTexture, grassTexture, glassGlowTexture, radialTexture, seeded,
} from './textures';
import { WATER_Y } from './particles';

export const T = 0.11;              // leaf thickness
export const HINGE_Z = -0.3;        // leaves sit in the middle of the wall's depth
export const SHORE_Z = -20.5;
const WALL_DEPTH = 0.6;

const merge = parts => mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)));
const placed2 = (mesh, x, y, z) => { mesh.position.set(x, y, z); return mesh; };

function placed(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  return geo.clone().applyMatrix4(m);
}

// ShapeGeometry UVs are in scene units; stretch them over the bounding box
function normaliseUV(geo) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - min.x) / (max.x - min.x), (pos.getY(i) - min.y) / (max.y - min.y));
  }
  uv.needsUpdate = true;
  return geo;
}

/* a lantern: frame geometry (metal), glass and the flame's local position */
function lanternGeometry(kind) {
  if (kind === 'hex') {
    const bars = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      bars.push(placed(new THREE.BoxGeometry(0.018, 0.4, 0.018), Math.cos(a) * 0.125, 0, Math.sin(a) * 0.125, 0, -a));
    }
    return {
      frame: merge([
        ...bars,
        placed(new THREE.ConeGeometry(0.19, 0.17, 6), 0, 0.29, 0),
        placed(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 6), 0, 0.2, 0),
        placed(new THREE.SphereGeometry(0.03, 8, 6), 0, 0.4, 0),
        placed(new THREE.CylinderGeometry(0.13, 0.05, 0.1, 6), 0, -0.24, 0),
        placed(new THREE.SphereGeometry(0.025, 8, 6), 0, -0.31, 0),
      ]),
      glass: new THREE.CylinderGeometry(0.122, 0.122, 0.38, 6, 1, true),
      flame: [0, 0.02, 0],
    };
  }
  // square candle lantern (aisle / doorstep)
  const posts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => placed(new THREE.BoxGeometry(0.02, 0.42, 0.02), x * 0.1, 0.24, z * 0.1));
  return {
    frame: merge([
      ...posts,
      placed(new THREE.BoxGeometry(0.24, 0.03, 0.24), 0, 0.015, 0),
      placed(new THREE.BoxGeometry(0.24, 0.03, 0.24), 0, 0.46, 0),
      placed(new THREE.ConeGeometry(0.15, 0.09, 4), 0, 0.52, 0, 0, Math.PI / 4),
      placed(new THREE.TorusGeometry(0.04, 0.008, 6, 16), 0, 0.6, 0),
    ]),
    glass: placed(new THREE.BoxGeometry(0.19, 0.4, 0.19), 0, 0.24, 0),
    candle: placed(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 12), 0, 0.115, 0),
    flame: [0, 0.23, 0],
  };
}

// a single teardrop petal, lying flat (x/z), tip towards +z
function petalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.6, 0.25, 0.55, 0.9, 0, 1);
  s.bezierCurveTo(-0.55, 0.9, -0.6, 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 4).rotateX(-Math.PI / 2);
  // a gentle cup so the petal catches light
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.pow(pos.getX(i), 2) * 0.35);
  g.computeVertexNormals();
  return g;
}

// an open bloom: two rings of cupped petals around a small heart, facing +y
export function bloomGeometry() {
  const petal = petalGeometry();
  const parts = [];
  [[6, 0.75, 0.9, 0], [5, 0.5, 1.25, 0.6]].forEach(([n, size, lift, offset]) => {
    for (let i = 0; i < n; i++) {
      const g = petal.clone().scale(size, size, size).rotateX(-lift).rotateY((i / n) * Math.PI * 2 + offset);
      parts.push(g);
    }
  });
  parts.push(new THREE.IcosahedronGeometry(0.16, 0).translate(0, 0.12, 0));
  return merge(parts.map(g => { g.deleteAttribute('uv'); return g; }));
}

// a soft, lumpy foliage cluster (not a faceted ball): a subdivided sphere pushed about by noise
export function softClusterGeometry(detail = 2) {
  // shared vertices first, so the normals come out smooth rather than faceted
  // (detail 2 = 320 triangles: round enough once smooth-shaded; there are ~1 400 of these)
  const ico = new THREE.IcosahedronGeometry(1, detail);
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  const g = mergeVertices(ico);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + v.y * 1.7) * Math.cos(v.z * 2.6 - v.y * 1.3) * 0.16
      + Math.sin(v.x * 7.3 - v.z * 5.1) * 0.05;
    v.multiplyScalar(1 + n);
    v.y *= v.y < 0 ? 0.62 : 1;             // flatter underneath, like real canopy
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/* stylised rim light: a soft moonlit edge on foliage, bark and stone,
   so shapes read against the night sky without real shadows */
export function withRim(material, color, strength) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uRim = { value: new THREE.Color(color) };
    shader.uniforms.uRimK = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;\nuniform float uRimK;')
      .replace('#include <opaque_fragment>', `
        float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        outgoingLight += uRim * rim * uRimK;
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `rim-${color}-${strength}`;
  return material;
}

// a broadleaf tree: merged tapering branches + leaf-cluster positions
function growTree(rnd, base, lean, depth, { len = 2.6, rad = 0.19, spread = 1.1, leaf = 0.42, perTip = 4 } = {}) {
  const wood = [], leaves = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (from, dir, len, rad, d) => {
    const g = new THREE.CylinderGeometry(rad * 0.68, rad, len, 8, 1).translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)).translate(from.x, from.y, from.z);
    wood.push(g);
    const end = from.clone().addScaledVector(dir, len);
    if (d === 0) {
      for (let k = 0; k < perTip; k++) {
        leaves.push([end.x + (rnd() - 0.5) * spread, end.y + (rnd() - 0.3) * spread * 0.64, end.z + (rnd() - 0.5) * spread, leaf + rnd() * leaf * 0.9]);
      }
      return;
    }
    const n = 2 + (rnd() > 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.3 + lean * 0.15, (rnd() - 0.15) * 0.7, (rnd() - 0.5) * 1.3)).normalize();
      grow(end, nd, len * (0.66 + rnd() * 0.14), rad * 0.62, d - 1);
    }
  };
  grow(base, new THREE.Vector3(lean * 0.22, 1, 0).normalize(), len, rad, depth);
  return { wood: merge(wood.map(g => { g.deleteAttribute('uv'); return g; })), leaves };
}

/* wrought-iron scrollwork in 3D (tubes, leaves, rosettes) inside the glass panel of one leaf:
   a border bar, a central stem, pairs of C-scrolls curling into spirals, three rosettes */
function ironworkGeometry(outline, cx, y0, y1, tier) {
  const iron = [], brassParts = [];
  const tubular = tier === 'low' ? 0.6 : 1;
  const tube = (pts, r, closed = false, segs = 64) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), closed, 'centripetal');
    iron.push(new THREE.TubeGeometry(curve, Math.round(segs * tubular), r, 6, closed));
  };
  // border, a little inside the glass edge — straight segments, so the corners stay corners
  const border = outline.map(p => new THREE.Vector3(cx + (p.x - cx) * 0.975, y0 + (p.y - y0) * 0.985 + 0.012, 0));
  const frame = new THREE.CurvePath();
  border.forEach((p, i) => frame.add(new THREE.LineCurve3(p, border[(i + 1) % border.length])));
  iron.push(new THREE.TubeGeometry(frame, Math.round(220 * tubular), 0.011, 6, false));
  // the stem
  tube([[cx, y0 + 0.03], [cx, (y0 + y1) / 2], [cx, y1 - 0.06]], 0.012, false, 24);
  // C-scrolls: an arm out from the stem that curls into a spiral
  const scroll = (y, side, dir, size) => {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([cx + side * size * t, y + dir * size * 0.42 * Math.sin(Math.PI * t * 0.9)]);
    }
    const [ex, ey] = pts[pts.length - 1];
    const ox = ex - side * size * 0.2, oy = ey - dir * size * 0.16;
    const r0 = Math.hypot(ex - ox, ey - oy), a0 = Math.atan2(ey - oy, ex - ox);
    for (let i = 1; i <= 26; i++) {
      const t = i / 26, a = a0 - side * dir * t * Math.PI * 2.1, r = r0 * (1 - 0.78 * t);
      pts.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]);
    }
    tube(pts, 0.008, false, 72);
    // two forged leaves along the arm
    [0.35, 0.62].forEach((t, k) => {
      const [lx, ly] = pts[Math.round(t * 10)];
      const leaf = new THREE.SphereGeometry(1, 8, 6).scale(0.012, 0.036, 0.006)
        .rotateZ(side * (0.9 + k * 0.5) * dir).translate(lx, ly + dir * 0.02, 0.004);
      iron.push(leaf);
    });
  };
  const span = y1 - y0;
  [[0.12, 1], [0.34, -1], [0.56, 1], [0.76, -1]].forEach(([v, dir]) => {
    const y = y0 + span * v;
    scroll(y, -1, dir, 0.27);
    scroll(y, 1, dir, 0.27);
  });
  // rosettes on the stem (brass hearts)
  [0.23, 0.5, 0.86].forEach(v => {
    const y = y0 + span * v;
    iron.push(new THREE.TorusGeometry(0.075, 0.009, 6, 32).translate(cx, y, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      iron.push(new THREE.SphereGeometry(1, 8, 6).scale(0.016, 0.042, 0.007).rotateZ(a - Math.PI / 2)
        .translate(cx + Math.cos(a) * 0.045, y + Math.sin(a) * 0.045, 0.006));
    }
    brassParts.push(new THREE.SphereGeometry(0.02, 12, 8).translate(cx, y, 0.012));
  });
  const clean = g => { if (g.index) g = g.toNonIndexed(); ['uv'].forEach(a => g.deleteAttribute(a)); return g; };
  return { iron: mergeGeometries(iron.map(clean)), brass: mergeGeometries(brassParts.map(clean)) };
}

/* the real walnut (Poly Haven, CC0): colour, normal and roughness, varnished */
function walnutMaterial(anisotropy) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x8a6448, roughness: 0.82, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.32,
    normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 0.7,
  });
  const loader = new THREE.TextureLoader();
  const load = (url, srgb) => loader.loadAsync(url).then(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.05, 1.05);          // ~1 m of veneer per tile (shape UVs are in metres)
    t.anisotropy = anisotropy;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const ready = Promise.all([
    load(assetPath('/cinematic/tex/walnut_diff.webp'), true),
    load(assetPath('/cinematic/tex/walnut_nor.webp'), false),
    load(assetPath('/cinematic/tex/walnut_rough.webp'), false),
  ]).then(([map, normalMap, roughnessMap]) => {
    Object.assign(mat, { map, normalMap, roughnessMap });
    mat.needsUpdate = true;
  }).catch(() => {});      // the procedural tint stays if a texture cannot load
  return { mat, ready };
}

export function buildWorld(scene, { tier, anisotropy }) {
  const rnd = seeded(27072027);
  const glows = [];            // flame / light sprites → one glow-points system
  const add = (...o) => o.forEach(x => scene.add(x));

  /* ---------- materials ---------- */
  const ashlar = ashlarTexture(11, anisotropy);
  const cream = creamStoneTexture(5, anisotropy);
  const stoneWall = new THREE.MeshStandardMaterial({ map: ashlar, bumpMap: ashlar, bumpScale: 2, roughness: 0.92, color: 0xb59e82 });
  const stoneCream = new THREE.MeshStandardMaterial({ map: cream, bumpMap: cream, bumpScale: 1.5, roughness: 0.85, color: 0xf2e6d2 });
  const walnut = woodTexture(WOODS.walnut, 2707, anisotropy);
  const wood = new THREE.MeshStandardMaterial({ map: walnut, bumpMap: walnut, bumpScale: 1.2, roughness: 0.55, color: 0x9d8670, envMapIntensity: 0.35 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x17120d, metalness: 0.7, roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc69a4c, metalness: 1, roughness: 0.32 });
  const lanternGlass = new THREE.MeshBasicMaterial({ color: 0xffc472, side: THREE.DoubleSide });
  const softGlass = new THREE.MeshBasicMaterial({ color: 0xffcf96, transparent: true, opacity: 0.1, depthWrite: false });
  const candleMat = new THREE.MeshBasicMaterial({ color: 0xd9c7aa });
  const leafGreen = withRim(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), '#3a5a8c', 0.5);
  const greens = ['#24391f', '#2c4426', '#1e3120', '#33492a'].map(c => new THREE.Color(c));

  /* =========================== OUTSIDE =========================== */

  // the wall, with a true arched opening
  const wallShape = new THREE.Shape([
    new THREE.Vector2(-14, -0.5), new THREE.Vector2(14, -0.5), new THREE.Vector2(14, 11), new THREE.Vector2(-14, 11),
  ]);
  wallShape.holes.push(new THREE.Path(archOutline(1, -0.01)));
  const wall = new THREE.Mesh(extrude(wallShape, WALL_DEPTH), stoneWall);
  wall.position.z = -WALL_DEPTH;
  add(wall);

  // carved archivolt — its legs are the pilasters
  const archivolt = new THREE.Mesh(extrude(archBand(1.0, 1.34), 0.14, 0.025), stoneCream);
  const innerMould = new THREE.Mesh(extrude(archBand(1.0, 1.06), 0.2, 0.012), stoneCream);
  const outerMould = new THREE.Mesh(extrude(archBand(1.3, 1.36), 0.19, 0.012), stoneCream);
  add(archivolt, innerMould, outerMould);
  // voussoir joints radiating across the arch
  const joints = [];
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    joints.push(placed(new THREE.BoxGeometry(0.34, 0.012, 0.02), Math.cos(a) * 1.18, HS + Math.sin(a) * 1.18, 0.155, 0, 0, a));
  }
  add(new THREE.Mesh(merge(joints), new THREE.MeshBasicMaterial({ color: 0x6d5a40 })));

  // capitals at the spring line + plinths
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(merge([
      placed(new THREE.BoxGeometry(0.5, 0.08, 0.3), 0, 0.16, 0),
      placed(new THREE.BoxGeometry(0.42, 0.12, 0.26), 0, 0.06, 0),
      placed(new THREE.BoxGeometry(0.38, 0.05, 0.24), 0, -0.03, 0),
    ]), stoneCream);
    cap.position.set(s * 1.17, HS - 0.12, 0.07);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.3), stoneCream);
    plinth.position.set(s * 1.17, 0.17 + 0.16, 0.08);
    add(cap, plinth);
  }
  // keystone
  const keystone = new THREE.Mesh(extrude(new THREE.Shape([
    new THREE.Vector2(-0.16, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0.22, 0.42), new THREE.Vector2(-0.22, 0.42),
  ]), 0.2, 0.02), stoneCream);
  keystone.position.set(0, HS + 0.98, 0);
  add(keystone);

  // stone steps and the paved forecourt
  const steps = new THREE.Mesh(merge([
    placed(new THREE.BoxGeometry(6.4, 0.16, 1.1), 0, 0.08, 0.55),
    placed(new THREE.BoxGeometry(7.2, 0.1, 1.7), 0, -0.03, 0.85),
  ]), stoneCream);
  add(steps);
  const forecourt = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), new THREE.MeshStandardMaterial({ map: ashlar, roughness: 0.95, color: 0x5d4b38 }));
  forecourt.rotation.x = -Math.PI / 2;
  forecourt.position.set(0, -0.08, 9);
  add(forecourt);

  /* ---------- the door leaves ---------- */
  const leafGeo = extrude(leafOutline(), T - 0.016, 0.008);
  leafGeo.translate(0, 0, -(T - 0.016) / 2);
  const PX0 = 0.11, PX1 = LEAF_W - 0.085, GY0 = 0.42;
  const glassOutline = panelOutline(PX0, PX1, GY0, { r: 1 - PX0 });
  const glassGeo = normaliseUV(new THREE.ShapeGeometry(new THREE.Shape(glassOutline), 1));
  const glassMat = new THREE.MeshBasicMaterial({ map: glassGlowTexture(), color: new THREE.Color(0.9, 0.9, 0.9) });
  const ironMat = withRim(new THREE.MeshStandardMaterial({ color: 0x1a1410, metalness: 0.8, roughness: 0.42 }), '#ffcf8a', 0.35);
  const walnutDoor = walnutMaterial(anisotropy);
  const GCX = (PX0 + PX1) / 2;      // the glass top at the centre line, under the arch
  const ironGeo = ironworkGeometry(glassOutline, GCX, GY0, HS + Math.sqrt(Math.pow(1 - PX0, 2) - Math.pow(GCX - 1, 2)), tier);
  // the wooden bead around the glass and a kick panel
  const bead = new THREE.Shape(panelOutline(PX0 - 0.03, PX1 + 0.03, GY0 - 0.03, { r: 1 - PX0 + 0.03 }));
  bead.holes.push(new THREE.Path(glassOutline));
  const beadGeo = extrude(bead, 0.015, 0.008);
  const kickGeo = extrude(new THREE.Shape(panelOutline(PX0, PX1, 0.1, { y1: 0.33 })), 0.01, 0.015);
  const handleGeo = merge([
    new THREE.CylinderGeometry(0.016, 0.016, 0.5, 12),
    placed(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), 0, 0.2, -0.035, Math.PI / 2),
    placed(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), 0, -0.2, -0.035, Math.PI / 2),
    placed(new THREE.SphereGeometry(0.026, 10, 8), 0, 0.27, 0),
    placed(new THREE.SphereGeometry(0.026, 10, 8), 0, -0.27, 0),
  ]);
  const plateGeo = new THREE.BoxGeometry(0.07, 0.66, 0.012);

  function buildLeaf() {
    const leaf = new THREE.Group();
    const z = T / 2;
    leaf.add(new THREE.Mesh(leafGeo, walnutDoor.mat));
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = z + 0.002;
    const ironwork = new THREE.Mesh(ironGeo.iron, ironMat);
    ironwork.position.z = z + 0.016;
    const rosettes = new THREE.Mesh(ironGeo.brass, brass);
    rosettes.position.z = z + 0.016;
    leaf.add(rosettes);
    const beadMesh = new THREE.Mesh(beadGeo, walnutDoor.mat);
    beadMesh.position.z = z;
    const kick = new THREE.Mesh(kickGeo, walnutDoor.mat);
    kick.position.z = z;
    const plate = new THREE.Mesh(plateGeo, iron);
    plate.position.set(LEAF_W - 0.045, 1.55, z + 0.006);
    const handle = new THREE.Mesh(handleGeo, brass);
    handle.position.set(LEAF_W - 0.045, 1.55, z + 0.08);
    leaf.add(glass, ironwork, beadMesh, kick, plate, handle);
    return leaf;
  }
  const leftHinge = new THREE.Group();
  leftHinge.position.set(-1, 0, HINGE_Z);
  const leftLeaf = buildLeaf();
  leftHinge.add(leftLeaf);
  // the lock: a brass latch bar on the left leaf, resting across the seam in a keeper on the right;
  // it turns upright when the lock opens (scene: latch.rotation.z)
  const latch = new THREE.Group();
  latch.position.set(LEAF_W - 0.075, 1.2, T / 2 + 0.03);
  latch.add(new THREE.Mesh(merge([
    placed(new THREE.BoxGeometry(0.17, 0.026, 0.018), 0.085, 0, 0),
    placed(new THREE.SphereGeometry(0.02, 12, 8), 0.17, 0, 0),
    placed(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), 0, 0, 0, Math.PI / 2),
  ]), brass));
  leftLeaf.add(latch);
  leftLeaf.add(placed2(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 24), brass), LEAF_W - 0.075, 1.2, T / 2 + 0.012));
  const rightHinge = new THREE.Group();
  rightHinge.position.set(1, 0, HINGE_Z);
  const mirrored = buildLeaf();
  mirrored.scale.x = -1;
  // the keeper the latch drops into
  mirrored.add(placed2(new THREE.Mesh(merge([
    placed(new THREE.BoxGeometry(0.05, 0.012, 0.03), 0, 0.024, 0),
    placed(new THREE.BoxGeometry(0.05, 0.012, 0.03), 0, -0.024, 0),
    placed(new THREE.BoxGeometry(0.012, 0.06, 0.03), -0.02, 0, 0),
  ]), brass), LEAF_W - 0.06, 1.2, T / 2 + 0.03));
  rightHinge.add(mirrored);
  add(leftHinge, rightHinge);

  /* ---------- lanterns on the facade ---------- */
  const hex = lanternGeometry('hex');
  const square = lanternGeometry('square');
  const facadeLights = [];
  for (const s of [-1, 1]) {
    const x = s * 1.95;
    const bracket = new THREE.Mesh(merge([
      placed(new THREE.BoxGeometry(0.04, 0.04, 0.5), 0, 0, 0.25),
      placed(new THREE.BoxGeometry(0.16, 0.3, 0.03), 0, -0.05, 0.01),
      placed(new THREE.TorusGeometry(0.11, 0.012, 6, 24, Math.PI * 1.5), 0, -0.13, 0.17, 0, Math.PI / 2),
      placed(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4), 0, -0.07, 0.46),
    ]), iron);
    bracket.position.set(x, 3.35, 0);
    const frame = new THREE.Mesh(hex.frame, iron);
    const glass = new THREE.Mesh(hex.glass, lanternGlass);
    const lantern = new THREE.Group();
    lantern.add(frame, glass);
    lantern.position.set(x, 2.84, 0.46);
    add(bracket, lantern);
    glows.push({ p: [x, 2.86, 0.46], c: '#ffd38a', s: 0.5, f: 0.18 });
    const light = new THREE.PointLight(0xffa64d, 4.2, 0, 1.9);
    light.position.set(x, 2.84, 0.62);
    add(light);
    facadeLights.push(light);

    // floor lantern at the foot of each pilaster
    const fl = new THREE.Group();
    fl.add(new THREE.Mesh(square.frame, brass), new THREE.Mesh(square.glass, softGlass), new THREE.Mesh(square.candle, candleMat));
    fl.position.set(s * 1.62, 0.16, 0.45);
    fl.scale.setScalar(1.1);
    add(fl);
    glows.push({ p: [s * 1.62, 0.16 + 0.25, 0.45], c: '#ffcf7a', s: 0.3, f: 0.3 });
    glows.push({ p: [s * 1.62, 0.2, 0.45], c: '#ff9a3c', s: 0.7, f: 0.12 });
  }

  /* ---------- stone urns with white flowers ---------- */
  const urnProfile = [
    [0, 0], [0.2, 0], [0.22, 0.05], [0.12, 0.12], [0.1, 0.24], [0.17, 0.32], [0.27, 0.5], [0.31, 0.64], [0.34, 0.68], [0.3, 0.7], [0, 0.7],
  ].map(([x, y]) => new THREE.Vector2(x * 1.25, y * 1.25));
  const urnGeo = new THREE.LatheGeometry(urnProfile, 24);
  const foliage = [], flowers = [];
  for (const s of [-1, 1]) {
    const ux = s * 2.65, uy = 0.16, uz = 0.55;
    const urn = new THREE.Mesh(urnGeo, stoneCream);
    urn.position.set(ux, uy, uz);
    add(urn);
    for (let i = 0; i < { desktop: 90, mobile: 60, low: 40 }[tier]; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.5;
      foliage.push([ux + Math.cos(a) * r, uy + 0.88 + rnd() * 0.32 * (1 - r), uz + Math.sin(a) * r * 0.8, 0.07 + rnd() * 0.06]);
    }
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.5;
      flowers.push([ux + Math.cos(a) * r, uy + 0.95 + rnd() * 0.32 * (1 - r), uz + Math.sin(a) * r * 0.8 + 0.05, 0.035]);
    }
  }

  /* =========================== INSIDE =========================== */

  // lawn up to the shore, with a stone aisle down the middle
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, Math.abs(SHORE_Z) + 0.2), new THREE.MeshStandardMaterial({ map: grassTexture(3, anisotropy), roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(0, 0, SHORE_Z / 2);
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.3, Math.abs(SHORE_Z) - 1.5), new THREE.MeshStandardMaterial({ map: cream, roughness: 0.95, color: 0x6e604c }));
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(0, 0.006, (SHORE_Z - 1.5) / 2 - 0.4);
  const shore = new THREE.Mesh(new THREE.BoxGeometry(90, 0.18, 0.5), stoneCream);
  shore.position.set(0, -0.02, SHORE_Z);
  add(lawn, aisle, shore);

  // aisle lanterns, both sides
  const perSide = { desktop: 14, mobile: 11, low: 8 }[tier];
  const lanternSpots = [];
  for (let i = 0; i < perSide; i++) {
    const z = -3.2 - i * ((Math.abs(SHORE_Z) - 5) / (perSide - 1));
    lanternSpots.push([-0.88, z], [0.88, z]);
  }
  const instanced = (geo, mat, spots, y = 0) => {
    const m = new THREE.InstancedMesh(geo, mat, spots.length);
    const mx = new THREE.Matrix4();
    spots.forEach(([x, z], i) => m.setMatrixAt(i, mx.makeTranslation(x, y, z)));
    add(m);
    return m;
  };
  instanced(square.frame, brass, lanternSpots);
  instanced(square.glass, softGlass, lanternSpots);
  instanced(square.candle, candleMat, lanternSpots);
  lanternSpots.forEach(([x, z]) => {
    glows.push({ p: [x, 0.25, z], c: '#ffcf7a', s: 0.16, f: 0.3 });
    glows.push({ p: [x, 0.25, z], c: '#ff9c40', s: 0.42, f: 0.1 });
  });
  // pools of candle light on the ground
  const pool = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radialTexture([[0, 'rgba(255,190,110,.5)'], [0.5, 'rgba(255,160,80,.12)'], [1, 'rgba(255,140,60,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    lanternSpots.length,
  );
  const mx = new THREE.Matrix4();
  lanternSpots.forEach(([x, z], i) => pool.setMatrixAt(i, mx.makeTranslation(x * 0.85, 0.012, z)));
  add(pool);

  // white petals scattered along both edges of the aisle
  const petalCount = { desktop: 1600, mobile: 800, low: 400 }[tier];
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x1c1814, side: THREE.DoubleSide });
  const petals = new THREE.InstancedMesh(petalGeometry(), petalMat, petalCount);
  const blush = [new THREE.Color('#f7f1e8'), new THREE.Color('#f6dfe2'), new THREE.Color('#fbeee6')];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < petalCount; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (0.5 + Math.pow(rnd(), 1.6) * 0.75);
    const z = -2.6 - rnd() * (Math.abs(SHORE_Z) - 3.5);
    e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
    const k = 0.035 + rnd() * 0.025;
    sc.set(k, k, k);
    petals.setMatrixAt(i, mx.compose(pv.set(x, 0.012 + rnd() * 0.03, z), q.setFromEuler(e), sc));
    petals.setColorAt(i, blush[(rnd() * 3) | 0]);
  }
  add(petals);

  // the floral arch at the shore, flanked by glowing pillars
  const ARCH_Z = SHORE_Z + 1.4;
  const archFrame = new THREE.Mesh(merge([
    placed(new THREE.BoxGeometry(0.1, 2.3, 0.1), -1.3, 1.15, 0),
    placed(new THREE.BoxGeometry(0.1, 2.3, 0.1), 1.3, 1.15, 0),
    placed(new THREE.BoxGeometry(3.2, 0.1, 0.12), 0, 2.36, 0),
  ]), wood);
  archFrame.position.z = ARCH_Z;
  add(archFrame);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.13, 8, 48, Math.PI), withRim(new THREE.MeshStandardMaterial({ color: 0x24391f, roughness: 0.85 }), '#3a5a8c', 0.5));
  ring.position.set(0, 1.25, ARCH_Z);
  add(ring);
  for (let i = 0; i < { desktop: 260, mobile: 210, low: 150 }[tier]; i++) {
    const t = rnd();
    let x, y;
    if (t < 0.62) { const a = rnd() * Math.PI; x = Math.cos(a) * 1.3; y = 1.25 + Math.sin(a) * 1.3; }
    else { x = (rnd() > 0.5 ? 1 : -1) * 1.3; y = rnd() * 1.25; }
    const jitter = () => (rnd() - 0.5) * 0.22;
    foliage.push([x + jitter(), y + jitter(), ARCH_Z + jitter(), 0.09 + rnd() * 0.06]);
    flowers.push([x + jitter(), y + jitter(), ARCH_Z + 0.12 + jitter() * 0.5, 0.06 + rnd() * 0.04, rnd() < 0.22 ? 'rose' : null]);
  }
  for (const s of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.95, 16), new THREE.MeshBasicMaterial({ color: 0xfff0d2 }));
    pillar.position.set(s * 1.75, 0.475, ARCH_Z + 0.2);
    add(pillar);
    glows.push({ p: [s * 1.75, 0.6, ARCH_Z + 0.2], c: '#ffe2b0', s: 1.0, f: 0.05 });
  }
  // a stone pedestal crowned with flowers under the arch
  const pedestal = new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0], [0.24, 0], [0.24, 0.06], [0.14, 0.12], [0.11, 0.5], [0.2, 0.58], [0.22, 0.64], [0, 0.64],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 20), stoneCream);
  pedestal.position.set(0, 0, ARCH_Z - 0.1);
  add(pedestal);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.26;
    flowers.push([Math.cos(a) * r, 0.68 + rnd() * 0.12 * (1 - r * 3), ARCH_Z - 0.1 + Math.sin(a) * r, 0.05, rnd() < 0.3 ? 'rose' : null]);
  }
  // ivory drapes tied back at the posts
  const drapeGeo = new THREE.PlaneGeometry(0.62, 2.3, 10, 24);
  {
    const p = drapeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), v = 1 - (y + 1.15) / 2.3;   // 0 at the top, 1 at the floor
      const tie = Math.exp(-Math.pow((v - 0.62) / 0.12, 2));          // gathered at the tie-back
      p.setX(i, x * (1 - 0.7 * tie) + 0.18 * v * v);
      p.setZ(i, Math.sin(x * 22) * 0.035 * (1 - tie) + 0.05 * v);
    }
    drapeGeo.computeVertexNormals();
  }
  const drapeMat = withRim(new THREE.MeshStandardMaterial({ color: 0xf6eee2, roughness: 0.8, transparent: true, opacity: 0.82, side: THREE.DoubleSide, emissive: 0x2a2118 }), '#ffe2b0', 0.35);
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(drapeGeo, drapeMat);
    d.position.set(s * 1.52, 1.15, ARCH_Z + 0.16);
    d.scale.x = s;
    add(d);
  }

  // foliage + flowers as two instanced draws
  const cluster = softClusterGeometry(tier === 'low' ? 1 : 2);
  const leavesMesh = new THREE.InstancedMesh(cluster, leafGreen, foliage.length);
  foliage.forEach(([x, y, z, r], i) => {
    e.set(rnd() * 6, rnd() * 6, 0);
    leavesMesh.setMatrixAt(i, mx.compose(pv.set(x, y, z), q.setFromEuler(e), sc.set(r, r * 0.85, r)));
    leavesMesh.setColorAt(i, greens[(rnd() * greens.length) | 0]);
  });
  add(leavesMesh);
  const bloomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, emissive: 0x2a2420, side: THREE.DoubleSide });
  const blooms = new THREE.InstancedMesh(bloomGeometry(), bloomMat, flowers.length);
  const toward = new THREE.Vector3();
  const rose = new THREE.Color('#efbcc6');
  flowers.forEach(([x, y, z, r, tint], i) => {
    // face up and out, towards the viewer
    toward.set((rnd() - 0.5) * 0.8, 0.6 + rnd() * 0.4, 0.7).normalize();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toward);
    const k = r * 1.5;
    blooms.setMatrixAt(i, mx.compose(pv.set(x, y, z), q, sc.set(k, k, k)));
    blooms.setColorAt(i, tint === 'rose' ? rose : blush[i % 3]);
  });
  add(blooms);

  /* ---------- trees overhanging the aisle, with chandeliers ---------- */
  const bark = withRim(new THREE.MeshStandardMaterial({ color: 0x33251a, roughness: 0.95 }), '#3a5a8c', 0.45);
  const canopyMat = withRim(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), '#4a6aa0', 0.55);
  // aisle trees (the left shore is kept clear for the grand tree and its view of the lake)
  const treeSpots = [[-1, -6.0], [1, -9.4], [1, -13.2], [1, -4.6], [-1, -2.8]].slice(0, { desktop: 5, mobile: 4, low: 3 }[tier]);
  const canopy = [];
  treeSpots.forEach(([side, z]) => {
    const base = new THREE.Vector3(side * (3.4 + rnd() * 0.8), 0, z);
    const t = growTree(rnd, base, -side, tier === 'low' ? 3 : 4);   // lean in over the aisle
    add(new THREE.Mesh(t.wood, bark));
    canopy.push(...t.leaves);
  });

  /* ---------- the grand chandelier tree (chapter four) ---------- */
  const GRAND = new THREE.Vector3(-6.6, 0, -17.4);
  const grand = growTree(rnd, GRAND, 0, tier === 'desktop' ? 5 : 4, { len: 3.1, rad: 0.42, spread: 2.0, leaf: 0.62, perTip: tier === 'desktop' ? 5 : 7 });
  add(new THREE.Mesh(grand.wood, bark));
  canopy.push(...grand.leaves);
  // lanterns on cords from the lower boughs
  const hangCount = { desktop: 14, mobile: 10, low: 6 }[tier];
  const cords = [], hung = [];
  // one lantern per slice of the canopy, hung from that slice's lowest cluster,
  // so they ring the whole tree instead of bunching on one side
  const lowBoughs = [];
  for (let k = 0; k < hangCount; k++) {
    const a0 = (k / hangCount) * Math.PI * 2, a1 = ((k + 1) / hangCount) * Math.PI * 2;
    const slice = grand.leaves.filter(([x, y, z]) => {
      const a = Math.atan2(z - GRAND.z, x - GRAND.x) + Math.PI;
      return y > 3.4 && a >= a0 && a < a1 && Math.hypot(x - GRAND.x, z - GRAND.z) > 1.2;
    });
    if (slice.length) lowBoughs.push(slice.reduce((lo, l) => (l[1] < lo[1] ? l : lo)));
  }
  lowBoughs.forEach(([x, y, z]) => {
    const drop = 0.5 + rnd() * 0.9;
    const ly = y - drop;
    cords.push(placed(new THREE.CylinderGeometry(0.004, 0.004, drop, 3), x, y - drop / 2, z));
    hung.push([x, ly, z]);
    glows.push({ p: [x, ly + 0.02, z], c: '#ffd38a', s: 0.42, f: 0.2 });
    glows.push({ p: [x, ly, z], c: '#ffb45a', s: 1.1, f: 0.08 });
  });
  const smallHex = lanternGeometry('hex');
  const hungFrame = new THREE.InstancedMesh(smallHex.frame, iron, hung.length);
  const hungGlass = new THREE.InstancedMesh(smallHex.glass, lanternGlass, hung.length);
  hung.forEach(([x, y, z], i) => {
    mx.compose(pv.set(x, y, z), q.identity(), sc.set(0.55, 0.55, 0.55));
    hungFrame.setMatrixAt(i, mx);
    hungGlass.setMatrixAt(i, mx);
  });
  add(hungFrame, hungGlass);
  // fairy lights woven through the canopy
  const fairy = { desktop: 220, mobile: 140, low: 70 }[tier];
  for (let i = 0; i < fairy; i++) {
    const [x, y, z, r] = grand.leaves[(rnd() * grand.leaves.length) | 0];
    const a = rnd() * Math.PI * 2;
    glows.push({ p: [x + Math.cos(a) * r * 1.05, y - r * 0.4 + rnd() * r * 0.5, z + Math.sin(a) * r * 1.05], c: rnd() > 0.3 ? '#ffe2a8' : '#fff4dc', s: 0.06, f: 0.7 });
  }

  // the canopy is ~700 clusters: on phones a coarser cluster (it is dark, high and soft-lit anyway)
  const canopyMesh = new THREE.InstancedMesh(tier === 'desktop' ? cluster : softClusterGeometry(1), canopyMat, canopy.length);
  canopy.forEach(([x, y, z, r], i) => {
    e.set(rnd() * 3, rnd() * 3, rnd() * 3);
    canopyMesh.setMatrixAt(i, mx.compose(pv.set(x, y, z), q.setFromEuler(e), sc.set(r, r * 0.78, r)));
    canopyMesh.setColorAt(i, greens[(rnd() * greens.length) | 0]);
  });
  add(canopyMesh);
  const chandelierSpots = [[-1.6, 4.4, -6.2], [1.8, 4.9, -9.2], [1.7, 4.3, -13.0], [GRAND.x + 1.1, 4.5, GRAND.z + 0.9]];
  const chain = [];
  chandelierSpots.forEach(([x, y, z]) => {
    chain.push(placed(new THREE.CylinderGeometry(0.008, 0.008, 2.2, 4), x, y + 1.25, z));
    chain.push(placed(new THREE.TorusGeometry(0.28, 0.012, 6, 24), x, y, z, Math.PI / 2));
    chain.push(placed(new THREE.TorusGeometry(0.18, 0.01, 6, 20), x, y + 0.28, z, Math.PI / 2));
    chain.push(placed(new THREE.ConeGeometry(0.1, 0.36, 8), x, y - 0.2, z, Math.PI));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      glows.push({ p: [x + Math.cos(a) * 0.28, y + 0.08, z + Math.sin(a) * 0.28], c: '#ffd89a', s: 0.13, f: 0.3 });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      glows.push({ p: [x + Math.cos(a) * 0.17, y + 0.36, z + Math.sin(a) * 0.17], c: '#ffe6b8', s: 0.1, f: 0.3 });
    }
    // crystal drops catching the light
    for (let i = 0; i < 12; i++) {
      const a = rnd() * Math.PI * 2, r = 0.08 + rnd() * 0.22;
      glows.push({ p: [x + Math.cos(a) * r, y - 0.1 - rnd() * 0.35, z + Math.sin(a) * r], c: '#fff7ea', s: 0.04, f: 0.9 });
    }
    glows.push({ p: [x, y, z], c: '#ffbf6a', s: 1.3, f: 0.04 });
  });
  chain.push(...cords);
  add(new THREE.Mesh(merge(chain), brass));

  /* ---------- jasmine bushes along the lawn ---------- */
  const bushes = { desktop: 16, mobile: 11, low: 7 }[tier];
  const bushLeaves = [], jasmine = [];
  for (let i = 0; i < bushes * 2; i++) {
    const side = i % 2 ? 1 : -1;
    const bx = side * (1.6 + rnd() * 0.9), bz = -3.2 - (i >> 1) * ((Math.abs(SHORE_Z) - 6) / bushes) - rnd() * 0.4;
    if (side < 0 && bz < -14.5) continue;             // the grand tree's clearing
    for (let k = 0; k < 4; k++) {
      bushLeaves.push([bx + (rnd() - 0.5) * 0.6, 0.22 + rnd() * 0.25, bz + (rnd() - 0.5) * 0.6, 0.22 + rnd() * 0.12]);
    }
    for (let k = 0; k < 9; k++) {
      const a = rnd() * Math.PI * 2;
      jasmine.push([bx + Math.cos(a) * 0.3, 0.32 + rnd() * 0.3, bz + Math.sin(a) * 0.3, 0.022 + rnd() * 0.01]);
    }
  }
  const bushMesh = new THREE.InstancedMesh(cluster, leafGreen, bushLeaves.length);
  bushLeaves.forEach(([x, y, z, r], i) => {
    bushMesh.setMatrixAt(i, mx.compose(pv.set(x, y, z), q.identity(), sc.set(r, r * 0.8, r)));
    bushMesh.setColorAt(i, greens[(rnd() * greens.length) | 0]);
  });
  add(bushMesh);
  const jasmineMesh = new THREE.InstancedMesh(bloomGeometry(), bloomMat, jasmine.length);
  jasmine.forEach(([x, y, z, r], i) => {
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pv.set((rnd() - 0.5), 0.8, (rnd() - 0.2)).normalize());
    jasmineMesh.setMatrixAt(i, mx.compose(pv.set(x, y, z), q, sc.set(r, r, r)));
  });
  add(jasmineMesh);

  /* ---------- reeds at the water's edge ---------- */
  const reedCount = { desktop: 260, mobile: 160, low: 80 }[tier];
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.012, 1, 3).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x1b2a1a, roughness: 0.9 }), reedCount);
  for (let i = 0; i < reedCount; i++) {
    const side = rnd() > 0.5 ? 1 : -1;
    const x = side * (2.6 + Math.pow(rnd(), 0.7) * 22);
    e.set((rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
    const h = 0.5 + rnd() * 0.9;
    reeds.setMatrixAt(i, mx.compose(pv.set(x, WATER_Y, SHORE_Z - 0.3 - rnd() * 1.4), q.setFromEuler(e), sc.set(1, h, 1)));
  }
  add(reeds);

  /* ---------- the lake ---------- */
  const floatCount = { desktop: 46, mobile: 30, low: 16 }[tier];
  const cups = [];
  for (let i = 0; i < floatCount; i++) {
    const x = (rnd() - 0.5) * 26 * (0.5 + rnd());
    const z = SHORE_Z - 1.5 - Math.pow(rnd(), 0.8) * 30;
    cups.push(placed(new THREE.CylinderGeometry(0.09, 0.06, 0.05, 10), x, WATER_Y + 0.02, z));
    glows.push({ p: [x, WATER_Y + 0.1, z], c: '#ffcf7a', s: 0.22, f: 0.35 });
    glows.push({ p: [x, WATER_Y + 0.08, z], c: '#ff9c40', s: 0.9, f: 0.12 });
  }
  add(new THREE.Mesh(merge(cups), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.8 })));

  // far shore: tree line, hills, village lights
  const ridge = (z, minH, maxH, step, color) => {
    const pts = [new THREE.Vector2(-260, -1)];
    for (let x = -260; x <= 260; x += step) {
      const h = minH + (Math.sin(x * 0.013) * 0.5 + 0.5) * (maxH - minH) * 0.7 + rnd() * (maxH - minH) * 0.3;
      pts.push(new THREE.Vector2(x, h));
    }
    pts.push(new THREE.Vector2(260, -1));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), new THREE.MeshBasicMaterial({ color, fog: true }));
    m.position.z = z;
    add(m);
  };
  ridge(-230, 6, 28, 7, 0x111c38);
  ridge(-150, 2, 9, 2.4, 0x0a1228);
  const villageCount = { desktop: 70, mobile: 46, low: 24 }[tier];
  for (let i = 0; i < villageCount; i++) {
    glows.push({ p: [(rnd() - 0.5) * 220, 0.3 + rnd() * 1.6, -148 + rnd() * 2], c: rnd() > 0.3 ? '#ffc070' : '#ffe6b5', s: 0.8 + rnd() * 0.6, f: 0.2 });
  }

  return { leftHinge, rightHinge, latch, facadeLights, glassMat, glows, archZ: ARCH_Z, grandTree: GRAND, canopy: canopyMesh, ready: walnutDoor.ready, materials: { brass, iron, stoneCream, leafGreen, bloomMat, cluster } };
}
