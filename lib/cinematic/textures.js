/* ================================================================
   Procedural textures for «ليلة تحت النجوم», drawn once into canvases
   at start-up: no image files to download.
================================================================ */
import * as THREE from 'three';

export function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { srgb = true, repeat = null, anisotropy = 1 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = anisotropy;
  return tex;
}

const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

function speckle(g, w, h, rnd, n, light, dark) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = rnd() > 0.5 ? light : dark;
    g.globalAlpha = 0.04 + rnd() * 0.1;
    const s = 1 + rnd() * 3;
    g.fillRect(rnd() * w, rnd() * h, s, s);
  }
  g.globalAlpha = 1;
}

/* ashlar masonry: warm limestone blocks with mortar joints.
   1024 px = 4 scene units (shape UVs are in scene units). */
export function ashlarTexture(seed, anisotropy) {
  const [c, g] = canvas(1024, 1024);
  const rnd = seeded(seed);
  g.fillStyle = '#3b2f24';
  g.fillRect(0, 0, 1024, 1024);
  let y = 0;
  while (y < 1024) {
    const h = 74 + rnd() * 26;
    let x = -rnd() * 120;
    while (x < 1024) {
      const w = 110 + rnd() * 170;
      const t = rnd();
      const base = [128 + t * 46, 100 + t * 36, 70 + t * 26];
      const grd = g.createLinearGradient(x, y, x + w, y + h);
      grd.addColorStop(0, rgb(base[0] + 14, base[1] + 12, base[2] + 8));
      grd.addColorStop(1, rgb(base[0] - 16, base[1] - 14, base[2] - 10));
      g.fillStyle = grd;
      g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.strokeStyle = 'rgba(255,235,200,.12)';
      g.lineWidth = 2;
      g.strokeRect(x + 4, y + 4, w - 8, h - 8);
      // pitting and weathering
      for (let k = 0; k < 14; k++) {
        g.fillStyle = rnd() > 0.5 ? 'rgba(40,28,18,.18)' : 'rgba(255,240,210,.08)';
        g.beginPath();
        g.ellipse(x + rnd() * w, y + rnd() * h, 2 + rnd() * 9, 1 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      x += w;
    }
    y += h;
  }
  speckle(g, 1024, 1024, rnd, 9000, '#fff1d8', '#1f150c');
  return finish(c, { repeat: [0.25, 0.25], anisotropy });
}

/* pale carved limestone for the arch, capitals and urns */
export function creamStoneTexture(seed, anisotropy) {
  const [c, g] = canvas(512, 512);
  const rnd = seeded(seed);
  g.fillStyle = '#c4ab84';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = rnd() > 0.5 ? 'rgba(120,96,64,.12)' : 'rgba(255,244,220,.12)';
    g.lineWidth = 1 + rnd() * 3;
    g.beginPath();
    let x = rnd() * 512, yy = rnd() * 512;
    g.moveTo(x, yy);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 120; yy += (rnd() - 0.5) * 120; g.lineTo(x, yy); }
    g.stroke();
  }
  speckle(g, 512, 512, rnd, 6000, '#fff6e2', '#5a4630');
  return finish(c, { repeat: [0.6, 0.6], anisotropy });
}

/* dark lawn */
export function grassTexture(seed, anisotropy) {
  const [c, g] = canvas(512, 512);
  const rnd = seeded(seed);
  g.fillStyle = '#122014';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const t = rnd();
    g.strokeStyle = rgb(18 + t * 30, 34 + t * 40, 18 + t * 22, 0.5);
    g.lineWidth = 1;
    const x = rnd() * 512, y = rnd() * 512;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5);
    g.stroke();
  }
  return finish(c, { repeat: [0.7, 0.7], anisotropy });
}

/* warm amber light seen through the door glass */
export function glassGlowTexture() {
  const [c, g] = canvas(256, 512);
  const grd = g.createRadialGradient(128, 300, 10, 128, 300, 320);
  grd.addColorStop(0, '#ffe2a8');
  grd.addColorStop(0.35, '#f5b25a');
  grd.addColorStop(0.75, '#b9631f');
  grd.addColorStop(1, '#5a2a0c');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 512);
  return finish(c);
}

/* soft round glow */
export function radialTexture(stops, size = 128) {
  const [c, g] = canvas(size, size);
  const h = size / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return finish(c);
}

/* a paper sky lantern, centred in a square sprite */
export function skyLanternTexture() {
  const [c, g] = canvas(128, 128);
  const glow = g.createRadialGradient(64, 70, 4, 64, 70, 62);
  glow.addColorStop(0, 'rgba(255,170,70,.45)');
  glow.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);
  const body = g.createLinearGradient(40, 0, 88, 0);
  body.addColorStop(0, '#e2741f');
  body.addColorStop(0.5, '#ffd690');
  body.addColorStop(1, '#e2741f');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(42, 34); g.lineTo(86, 34); g.lineTo(80, 94); g.lineTo(48, 94); g.closePath();
  g.fill();
  const lit = g.createRadialGradient(64, 92, 1, 64, 92, 16);
  lit.addColorStop(0, '#fff8e0');
  lit.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = lit;
  g.fillRect(44, 74, 40, 30);
  return finish(c);
}

/* a crescent moon with a faint earthshine on its dark side */
export function crescentTexture(seed) {
  const S = 512, R = 200, C = S / 2;
  const [c, g] = canvas(S, S);
  const rnd = seeded(seed);
  // earthshine: the whole disc, barely there
  const shine = g.createRadialGradient(C, C, R * 0.2, C, C, R);
  shine.addColorStop(0, 'rgba(150,165,205,.16)');
  shine.addColorStop(1, 'rgba(120,140,190,.08)');
  g.fillStyle = shine;
  g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
  // the lit crescent, drawn on its own layer then carved by an offset disc
  const [lc, lg] = canvas(S, S);
  const lit = lg.createRadialGradient(C - R * 0.4, C, R * 0.1, C, C, R);
  lit.addColorStop(0, '#fffdf2');
  lit.addColorStop(0.7, '#f3ead0');
  lit.addColorStop(1, '#d9cfae');
  lg.fillStyle = lit;
  lg.beginPath(); lg.arc(C, C, R, 0, Math.PI * 2); lg.fill();
  for (let i = 0; i < 14; i++) {
    lg.fillStyle = `rgba(150,140,115,${0.05 + rnd() * 0.08})`;
    lg.beginPath();
    lg.ellipse(C - R * 0.75 + rnd() * R * 0.5, C - R * 0.6 + rnd() * R * 1.2, 8 + rnd() * 22, 6 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
    lg.fill();
  }
  lg.globalCompositeOperation = 'destination-out';
  const carve = lg.createRadialGradient(C + R * 0.34, C - R * 0.1, R * 0.8, C + R * 0.34, C - R * 0.1, R * 0.93);
  carve.addColorStop(0, 'rgba(0,0,0,1)');
  carve.addColorStop(1, 'rgba(0,0,0,0)');          // a soft terminator, not a cut-out edge
  lg.fillStyle = carve;
  lg.beginPath(); lg.arc(C + R * 0.34, C - R * 0.1, R * 0.93, 0, Math.PI * 2); lg.fill();
  g.drawImage(lc, 0, 0);
  return finish(c);
}
