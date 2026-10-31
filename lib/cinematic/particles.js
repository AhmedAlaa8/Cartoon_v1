/* ================================================================
   GPU particle systems. Every system is ONE THREE.Points draw; motion
   is computed in the vertex shader from time, so the CPU only writes
   attributes when something is spawned. Each system can be drawn a
   second time mirrored about the water line — that is the reflection.
================================================================ */
import * as THREE from 'three';

export const WATER_Y = -0.08;

const SPRITE_FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uStreak;      // >0 stretches the sprite vertically (reflections)
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    q.x *= 1.0 + uStreak * 3.0;
    q.y /= 1.0 + uStreak * 1.5;
    float d = length(q);
    float a = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.14, 0.0, d);
    gl_FragColor = vec4(vColor * a + core * 0.55, a * vAlpha);
    #include <colorspace_fragment>
  }
`;

const MIRROR_GLSL = /* glsl */`
  uniform float uMirror;
  uniform float uTime;
  vec3 mirrorIfNeeded(vec3 p) {
    if (uMirror > 0.5) {
      p.y = 2.0 * ${WATER_Y.toFixed(3)} - p.y;
      p.x += sin(p.z * 0.9 + uTime * 1.7) * 0.06 + sin(p.y * 2.3 + uTime * 2.3) * 0.05;
    }
    return p;
  }
`;

function pointsMaterial(vertexShader, fragmentShader, uniforms, mirror) {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: { ...uniforms, uMirror: { value: mirror ? 1 : 0 }, uStreak: { value: mirror ? 1 : 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function withMirror(scene, geometry, makeMaterial, mirror) {
  const main = new THREE.Points(geometry, makeMaterial(false));
  main.frustumCulled = false;
  scene.add(main);
  let reflection = null;
  if (mirror) {
    reflection = new THREE.Points(geometry, makeMaterial(true));
    reflection.frustumCulled = false;
    scene.add(reflection);
  }
  return [main, reflection];
}

/* ---------------- fireworks ---------------- */

const FW_VERT = /* glsl */`
  attribute vec3 aVel;        // velocity — or the target point for kind 1
  attribute vec4 aTime;       // birth, life, trail delay, kind (0 spark, 1 gather, 2 star)
  attribute vec3 aColor;
  attribute vec3 aParams;     // drag, gravity, size
  uniform float uPx;
  varying vec3 vColor;
  varying float vAlpha;
  ${MIRROR_GLSL}
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float t = uTime - aTime.x - aTime.z;
    if (t < 0.0 || t > aTime.y) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
    float age = t / aTime.y;
    vec3 p;
    float kind = aTime.w;
    if (kind < 0.5) {
      float k = aParams.x;
      p = position + aVel * (1.0 - exp(-k * t)) / k;
      p.y -= 0.5 * aParams.y * t * t;
    } else if (kind < 1.5) {
      float e = 1.0 - pow(1.0 - clamp(t / (aTime.y * 0.7), 0.0, 1.0), 3.0);
      p = mix(position, aVel, e);
      p += vec3(sin(t * 3.0 + position.x), cos(t * 2.6 + position.y), 0.0) * 0.04 * (1.0 - e);
    } else {
      p = position;
    }
    p = mirrorIfNeeded(p);
    float trail = aTime.z / 0.13;                         // 0 for the head, 1 at the end of the tail
    float fade = kind > 1.5 ? sin(3.14159 * age) : pow(1.0 - age, 1.6);
    float crackle = kind < 0.5 && age > 0.55 ? step(0.35, hash(floor(uTime * 18.0) + position.x * 13.0 + aVel.y)) : 1.0;
    vAlpha = fade * crackle * (1.0 - trail * 0.6) * (uMirror > 0.5 ? 0.4 : 1.0);
    if (kind > 1.5) vAlpha *= 0.75 + 0.25 * sin(uTime * 6.0 + position.x * 7.0);
    vColor = aColor * 1.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aParams.z * (1.0 - trail * 0.45) * (1.0 - age * 0.35) * uPx / -mv.z;
  }
`;

// bursts happen ~65 m away over the lake; this sets their size there
const SPREAD = 2.4;
const TRAIL_STEP = 0.026;        // seconds between trail samples — close enough to read as a streak

export function createFireworks(scene, { capacity, trail, sparkScale, mirror }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const time = new Float32Array(capacity * 4);
  const col = new Float32Array(capacity * 3);
  const par = new Float32Array(capacity * 3);
  for (let i = 0; i < capacity; i++) time[i * 4 + 1] = -1; // dead until spawned
  const attrs = {
    position: new THREE.BufferAttribute(pos, 3),
    aVel: new THREE.BufferAttribute(vel, 3),
    aTime: new THREE.BufferAttribute(time, 4),
    aColor: new THREE.BufferAttribute(col, 3),
    aParams: new THREE.BufferAttribute(par, 3),
  };
  Object.entries(attrs).forEach(([k, a]) => { a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); });

  const uniforms = { uTime: { value: 0 }, uPx: { value: 600 } };
  const [main, reflection] = withMirror(scene, geo, m => pointsMaterial(FW_VERT, SPRITE_FRAG, uniforms, m), mirror);

  let head = 0, aliveUntil = 0;
  const color = new THREE.Color();
  const tmp = new THREE.Vector3();

  function write(i, origin, v, birth, life, delay, kind, c, drag, gravity, size) {
    aliveUntil = Math.max(aliveUntil, birth + delay + life);
    pos.set([origin.x, origin.y, origin.z], i * 3);
    vel.set([v.x, v.y, v.z], i * 3);
    time.set([birth, life, delay, kind], i * 4);
    col.set([c.r, c.g, c.b], i * 3);
    par.set([drag, gravity, size], i * 3);
  }

  // one spark with its trail samples
  function emit(origin, v, birth, life, kind, c, drag, gravity, size, samples = trail) {
    const n = kind === 0 ? samples : 1;
    for (let s = 0; s < n; s++) {
      write(head, origin, v, birth, life, s * TRAIL_STEP, kind, c, drag, gravity, size);
      head = (head + 1) % capacity;
    }
  }

  function flush(from, count) {
    for (const a of Object.values(attrs)) {
      const size = a.itemSize;
      if (from + count <= capacity) a.addUpdateRange(from * size, count * size);
      else { a.addUpdateRange(from * size, (capacity - from) * size); a.addUpdateRange(0, (from + count - capacity) * size); }
      a.needsUpdate = true;
    }
  }

  function batch(fn) {
    const start = head;
    const before = head;
    fn();
    const count = (head - before + capacity) % capacity || capacity;
    flush(start, Math.min(count, capacity));
  }

  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const randDir = () => {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    return tmp.set(r * Math.cos(a), u, r * Math.sin(a));
  };

  const PALETTE = {
    willow: ['#ffd27a', '#ffbf55', '#fff0c8', '#f1c27d'],
    champagne: ['#fff3d6', '#f1d6a5', '#d6ad69', '#e9b5c1', '#f7c9d2'],
    rose: ['#e9b5c1', '#f7c9d2', '#fff0e6', '#d6ad69'],
  };

  function rocket(from, to, now, flight) {
    const v = to.clone().sub(from).divideScalar(flight);
    color.set('#ffe2a8');
    emit(from, v, now, flight, 0, color, 0.0001, 0, 0.75, trail + 3);
  }

  const api = {
    uniforms,
    get aliveUntil() { return aliveUntil; },          // nothing to draw after this
    /* a rocket rises from the lake, then the burst */
    launch(kind, at, now, { rocketFrom, camera } = {}) {
      batch(() => {
        const flight = 1.25;
        if (rocketFrom) rocket(rocketFrom, at, now, flight);
        const t0 = now + (rocketFrom ? flight : 0);
        emit(at, new THREE.Vector3(), t0, 0.55, 0, color.set('#fff1d0'), 1, 0, 9, 1);
        if (kind === 'willow') {
          const n = Math.round(130 * sparkScale);
          for (let i = 0; i < n; i++) {
            const v = randDir().multiplyScalar((5.2 + Math.random() * 1.6) * SPREAD);
            v.y += 1.2 * SPREAD;
            emit(at, v, t0, 3.8 + Math.random() * 1.0, 0, color.set(pick(PALETTE.willow)), 1.05, 3.0 * SPREAD, 1.15);
          }
        } else if (kind === 'bloom') {
          const n = Math.round(170 * sparkScale);
          for (let i = 0; i < n; i++) {
            const inner = i % 3 === 0;
            const v = randDir().multiplyScalar((inner ? 3.8 : 7.4 + Math.random() * 0.6) * SPREAD);
            emit(at, v, t0, 2.4 + Math.random() * 0.7, 0, color.set(pick(PALETTE.champagne)), 1.6, 1.3 * SPREAD, inner ? 1.3 : 1.05);
          }
        } else if (kind === 'heart') {
          const right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3(0, 1, 0);
          if (camera) { right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1); }
          const n = Math.round(170 * sparkScale);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const hx = 16 * Math.pow(Math.sin(a), 3);
            const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
            const v = right.clone().multiplyScalar(hx * 0.42 * SPREAD).addScaledVector(up, hy * 0.42 * SPREAD);
            emit(at, v, t0, 3.2, 0, color.set(pick(PALETTE.rose)), 1.25, 0.45 * SPREAD, 1.2);
          }
        }
      });
    },
    /* sparks drifting in from all around and gathering on a ring */
    gather(center, right, up, radius, now, duration) {
      batch(() => {
        const n = Math.round(220 * sparkScale);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const target = center.clone().addScaledVector(right, Math.cos(a) * radius * 1.35).addScaledVector(up, Math.sin(a) * radius * 0.62);
          const from = center.clone()
            .addScaledVector(right, (Math.random() - 0.5) * radius * 6)
            .addScaledVector(up, (Math.random() - 0.3) * radius * 4);
          const t = now + Math.random() * 0.5;
          emit(from, target, t, duration + 0.9 + Math.random() * 0.6, 1, color.set(pick(PALETTE.willow)), 1, 0, 0.08);
        }
      });
    },
    /* a guest's wish: a spark that rises, then rests as a twinkling star */
    wish(at, now) {
      batch(() => {
        const from = at.clone().add(new THREE.Vector3(0, -6, 0));
        rocket(from, at, now, 0.9);
        emit(at, new THREE.Vector3(), now + 0.9, 6.5, 2, color.set('#fff3d6'), 1, 0, 1.6);
        for (let i = 0; i < 14; i++) {
          emit(at, randDir().multiplyScalar(2.2), now + 0.9, 1.4, 0, color.set(pick(PALETTE.champagne)), 2, 0.6, 0.3, 2);
        }
      });
    },
    /* a rocket on its own (the name sequence pairs it with its own burst) */
    rocket(from, to, now, flight) { batch(() => rocket(from, to, now, flight)); },
    /* the soft white flash where a shell opens */
    flash(at, t) { batch(() => emit(at, new THREE.Vector3(), t, 0.6, 0, color.set('#fff1d0'), 1, 0, 11, 1)); },
    /* loose sparks: [[position, velocity, life, colour, size], …] */
    sparks(list, now) {
      batch(() => list.forEach(([pos, vel, life, c, size]) => emit(pos, vel, now, life, 0, color.set(c), 1.4, 0.6, size, 2)));
    },
    setPixelScale(px) { uniforms.uPx.value = px; },
    update(t) { uniforms.uTime.value = t; },
    objects: [main, reflection].filter(Boolean),
  };
  return api;
}

/* ---------------- flickering flames / small lights ---------------- */

const GLOW_VERT = /* glsl */`
  attribute vec3 aColor;
  attribute vec2 aInfo;       // size, flicker amount
  uniform float uPx;
  varying vec3 vColor;
  varying float vAlpha;
  ${MIRROR_GLSL}
  void main() {
    vec3 p = mirrorIfNeeded(position);
    float s = position.x * 13.1 + position.z * 7.7;
    float f = 1.0 - aInfo.y * (0.5 + 0.5 * sin(uTime * (7.0 + fract(s) * 6.0) + s) * sin(uTime * 3.1 + s * 2.0));
    vAlpha = f * (uMirror > 0.5 ? 0.45 : 1.0);
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aInfo.x * f * uPx / -mv.z;
  }
`;

export function createGlowPoints(scene, items, { mirror }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(items.flatMap(i => i.p), 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(items.flatMap(i => new THREE.Color(i.c).toArray()), 3));
  geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(items.flatMap(i => [i.s, i.f ?? 0.25]), 2));
  const uniforms = { uTime: { value: 0 }, uPx: { value: 600 } };
  const objects = withMirror(scene, geo, m => pointsMaterial(GLOW_VERT, SPRITE_FRAG, uniforms, m), mirror).filter(Boolean);
  return { uniforms, objects };
}

/* ---------------- sky lanterns ---------------- */

const LANTERN_VERT = /* glsl */`
  attribute vec4 aInfo;       // speed, phase, size, sway
  uniform float uPx;
  uniform float uSpan;
  varying float vAlpha;
  varying vec3 vColor;
  ${MIRROR_GLSL}
  void main() {
    float h = mod(uTime * aInfo.x + aInfo.y, uSpan);
    vec3 p = position + vec3(sin(uTime * 0.21 + aInfo.y) * aInfo.w, h, cos(uTime * 0.17 + aInfo.y) * aInfo.w * 0.5);
    float life = h / uSpan;
    vAlpha = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.75, life) * (uMirror > 0.5 ? 0.38 : 1.0);
    vAlpha *= 0.85 + 0.15 * sin(uTime * 5.0 + aInfo.y * 9.0);
    vColor = vec3(1.0);
    p = mirrorIfNeeded(p);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aInfo.z * uPx / -mv.z;
  }
`;
const LANTERN_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uStreak;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 uv = vec2(gl_PointCoord.x, uStreak > 0.5 ? gl_PointCoord.y : 1.0 - gl_PointCoord.y);
    vec4 c = texture2D(uMap, uv);
    gl_FragColor = vec4(c.rgb * vColor, c.a * vAlpha);
    #include <colorspace_fragment>
  }
`;

export function createSkyLanterns(scene, { count, distant, map, mirror }) {
  const p = [], info = [];
  const add = (x, y, z, speed, size, sway) => { p.push(x, y, z); info.push(speed, Math.random() * 60, size, sway); };
  for (let i = 0; i < count; i++) {
    add((Math.random() - 0.5) * 40, 3 + Math.random() * 4, -32 - Math.random() * 45, 0.3 + Math.random() * 0.2, 1.3 + Math.random() * 0.6, 0.6);
  }
  for (let i = 0; i < distant; i++) {
    add((Math.random() - 0.5) * 120, 4 + Math.random() * 8, -80 - Math.random() * 60, 0.45 + Math.random() * 0.3, 1.6, 1.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  const uniforms = { uTime: { value: 0 }, uPx: { value: 600 }, uSpan: { value: 42 }, uMap: { value: map } };
  const make = mirrored => new THREE.ShaderMaterial({
    vertexShader: LANTERN_VERT, fragmentShader: LANTERN_FRAG,
    uniforms: { ...uniforms, uMirror: { value: mirrored ? 1 : 0 }, uStreak: { value: mirrored ? 1 : 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const objects = withMirror(scene, geo, make, mirror).filter(Boolean);
  return { uniforms, objects };
}

/* ---------------- stars ---------------- */

const STAR_VERT = /* glsl */`
  attribute vec2 aInfo;       // size, twinkle phase
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = 0.55 + 0.45 * sin(uTime * (0.6 + fract(aInfo.y) * 1.4) + aInfo.y * 10.0);
    vColor = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.93, 0.8), fract(aInfo.y * 3.7));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aInfo.x * uScale;
  }
`;

export function createStars(scene, count) {
  const p = [], info = [];
  for (let i = 0; i < count; i++) {
    // upper hemisphere, denser towards the zenith
    const y = Math.pow(Math.random(), 0.7) * 0.95 + 0.04;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - y * y);
    p.push(Math.cos(a) * r * 380, y * 380, Math.sin(a) * r * 380);
    info.push(Math.random() < 0.06 ? 3.2 : 1.1 + Math.random() * 1.4, Math.random() * 100);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 2));
  const uniforms = { uTime: { value: 0 }, uScale: { value: 1 }, uStreak: { value: 0 } };
  const stars = new THREE.Points(geo, new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: SPRITE_FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = -1;
  scene.add(stars);
  return { uniforms, objects: [stars] };
}

/* ---------------- fireflies ---------------- */

const FIREFLY_VERT = /* glsl */`
  attribute vec2 aSeed;
  uniform float uTime;
  uniform float uPx;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float s = aSeed.x, k = aSeed.y;
    vec3 p = position + vec3(sin(uTime * 0.31 * k + s) * 0.7, sin(uTime * 0.47 * k + s * 2.0) * 0.35, cos(uTime * 0.27 * k + s) * 0.7);
    float blink = smoothstep(0.35, 1.0, sin(uTime * (0.9 + k * 0.8) + s * 5.0) * 0.5 + 0.5);
    vAlpha = blink;
    vColor = vec3(1.0, 0.86, 0.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 0.09 * uPx / -mv.z;
  }
`;

export function createFireflies(scene, count, area) {
  const p = [], seed = [];
  for (let i = 0; i < count; i++) {
    p.push(area.x0 + Math.random() * (area.x1 - area.x0), 0.4 + Math.random() * 2.4, area.z0 + Math.random() * (area.z1 - area.z0));
    seed.push(Math.random() * 100, 0.6 + Math.random() * 0.8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 2));
  const uniforms = { uTime: { value: 0 }, uPx: { value: 600 }, uStreak: { value: 0 } };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    vertexShader: FIREFLY_VERT, fragmentShader: SPRITE_FRAG, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  return { uniforms, objects: [pts] };
}


/* ---------------- names written by fireworks ----------------
   Every particle knows where its shell bursts (aBurst), how it flies
   out (aVel), the letter point it settles on (position), and when it
   is born, starts to settle, and dissolves (aT). All motion is in the
   vertex shader; the CPU writes the buffers once per sequence. */

const NAME_VERT = /* glsl */`
  attribute vec3 aBurst;
  attribute vec3 aVel;
  attribute vec4 aT;          // burst time, settle start, settle duration, dissolve time
  attribute vec3 aColor;
  attribute vec3 aInfo;       // seed, kind (0 letter, 1 heart), world size
  uniform float uPx;
  varying vec3 vColor;
  varying float vAlpha;
  ${MIRROR_GLSL}
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float t = uTime - aT.x;
    if (t < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
    // the shell: out from the burst point, slowed by the air, a little gravity
    float k = 2.0;
    vec3 burst = aBurst + aVel * (1.0 - exp(-k * t)) / k;
    burst.y -= 0.5 * aInfo.z * 6.0 * t * t;
    // settling onto the letters
    float m = clamp((uTime - aT.y) / aT.z, 0.0, 1.0);
    m = m < 0.5 ? 4.0 * m * m * m : 1.0 - pow(-2.0 * m + 2.0, 3.0) / 2.0;
    vec3 target = position;
    if (aInfo.y > 0.5) target = aBurst + (position - aBurst) * (1.0 + 0.035 * sin(uTime * 2.4));   // the heart breathes
    float sh = aInfo.x * 40.0;
    target += vec3(sin(uTime * 2.1 + sh), cos(uTime * 1.7 + sh * 1.3), 0.0) * aInfo.z * 0.22 * m;
    vec3 p = mix(burst, target, m);
    float alpha = 1.0;
    // dissolving into drifting sparks
    float d = uTime - aT.w;
    if (d > 0.0) {
      vec3 drift = vec3(hash(sh) - 0.5, hash(sh + 1.7) - 0.25, hash(sh + 3.1) - 0.5) * aInfo.z * 9.0;
      p += drift * d;
      p.y -= aInfo.z * 1.6 * d * d;
      alpha *= 1.0 - smoothstep(0.0, 3.2, d);
    }
    alpha *= 0.8 + 0.2 * sin(uTime * 7.0 + sh);
    vColor = mix(vec3(1.0, 0.9, 0.68) * 1.6, aColor * 1.45, clamp(t / 0.5, 0.0, 1.0));
    p = mirrorIfNeeded(p);
    vAlpha = alpha * (uMirror > 0.5 ? 0.38 : 1.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aInfo.z * (1.0 + 0.7 * (1.0 - m)) * uPx / -mv.z;
  }
`;

export function createNameWriter(scene, { capacity }) {
  const geo = new THREE.BufferGeometry();
  const arrays = {
    position: new Float32Array(capacity * 3), aBurst: new Float32Array(capacity * 3), aVel: new Float32Array(capacity * 3),
    aT: new Float32Array(capacity * 4), aColor: new Float32Array(capacity * 3), aInfo: new Float32Array(capacity * 3),
  };
  for (let i = 0; i < capacity; i++) arrays.aT[i * 4] = 1e9;        // unborn
  const attrs = {};
  for (const [k, arr] of Object.entries(arrays)) {
    attrs[k] = new THREE.BufferAttribute(arr, k === 'aT' ? 4 : 3);
    geo.setAttribute(k, attrs[k]);
  }
  const uniforms = { uTime: { value: 0 }, uPx: { value: 600 } };
  const objects = withMirror(scene, geo, m => pointsMaterial(NAME_VERT, SPRITE_FRAG, uniforms, m), true).filter(Boolean);
  const color = new THREE.Color();
  let aliveUntil = 0;

  return {
    uniforms, objects, capacity,
    get aliveUntil() { return aliveUntil; },
    /* groups: [{ points: [Vector3], burst: Vector3, tBurst, tSettle, settleDur, palette: [css], kind, size, speed }] */
    write(groups, tDissolve) {
      let n = 0;
      for (const g of groups) {
        for (const p of g.points) {
          if (n >= capacity) break;
          arrays.position.set([p.x, p.y, p.z], n * 3);
          arrays.aBurst.set([g.burst.x, g.burst.y, g.burst.z], n * 3);
          const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
          const sp = g.speed * (0.55 + Math.random() * 0.6);
          arrays.aVel.set([r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp * 0.5], n * 3);
          arrays.aT.set([g.tBurst, g.tSettle + Math.random() * 0.35, g.settleDur, tDissolve + Math.random() * 0.8], n * 4);
          color.set(g.palette[(Math.random() * g.palette.length) | 0]);
          arrays.aColor.set([color.r, color.g, color.b], n * 3);
          arrays.aInfo.set([Math.random(), g.kind, g.size * (0.8 + Math.random() * 0.5)], n * 3);
          n++;
        }
      }
      for (let i = n; i < capacity; i++) arrays.aT[i * 4] = 1e9;
      for (const a of Object.values(attrs)) a.needsUpdate = true;
      aliveUntil = tDissolve + 0.8 + 3.4;               // last spark has faded
      return n;
    },
    dissolveAt(t) {
      for (let i = 0; i < capacity; i++) if (arrays.aT[i * 4] < 1e8) arrays.aT[i * 4 + 3] = t + Math.random() * 0.8;
      attrs.aT.needsUpdate = true;
      aliveUntil = t + 0.8 + 3.4;
    },
  };
}
