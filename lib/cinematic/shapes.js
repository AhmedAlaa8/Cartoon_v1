/* ================================================================
   2D sources for the cinematic scene, drawn into canvases:
   • point clouds of the names and a heart (the fireworks settle on them);
   • the cartoon portraits and name ribbons on the hanging medallions.
   The calligraphy font is next/font's Aref Ruqaa — read from the page's
   --font-calli variable and loaded before anything is drawn with it.
================================================================ */
import * as THREE from 'three';

export function calligraphyFamily() {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-calli').trim() || 'serif';
}

export async function fontsReady(texts) {
  const family = calligraphyFamily();
  try {
    await Promise.all(texts.map(t => document.fonts.load(`700 160px ${family}`, t)));
  } catch { /* draw with whatever is available */ }
  return family;
}

function sampleCanvas(c, count) {
  const { width: w, height: h } = c;
  const data = c.getContext('2d').getImageData(0, 0, w, h).data;
  const filled = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 140) filled.push(x, y);
  }
  const n = filled.length / 2, pts = [];
  // a shuffled pick spreads the particles evenly over every stroke
  for (let i = 0; i < Math.min(count, n); i++) {
    const j = (Math.random() * n) | 0;
    pts.push([(filled[j * 2] - w / 2) / h, -(filled[j * 2 + 1] - h / 2) / h]);
  }
  return { pts, aspect: w / h };
}

/* a word in the calligraphy font → points in a box of height 1 (x scaled by aspect) */
export function sampleText(text, family, count) {
  const size = 220;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `700 ${size}px ${family}`;
  const m = probe.measureText(text);
  const c = document.createElement('canvas');
  c.width = Math.ceil(m.width + size * 0.3);
  c.height = Math.ceil(size * 1.5);
  const g = c.getContext('2d');
  g.font = `700 ${size}px ${family}`;
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.fillText(text, c.width / 2, c.height * 0.52);
  return sampleCanvas(c, count);
}

function heartPath(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.42);
  g.bezierCurveTo(cx - s * 0.62, cy - s * 0.02, cx - s * 0.5, cy - s * 0.52, cx, cy - s * 0.26);
  g.bezierCurveTo(cx + s * 0.5, cy - s * 0.52, cx + s * 0.62, cy - s * 0.02, cx, cy + s * 0.42);
  g.closePath();
}

/* a heart outline with a lighter fill — reads as a heart even with few particles */
export function sampleHeart(count) {
  const c = document.createElement('canvas');
  c.width = c.height = 300;
  const g = c.getContext('2d');
  heartPath(g, 150, 160, 300);
  g.lineWidth = 26;
  g.strokeStyle = '#fff';
  g.stroke();
  const ring = sampleCanvas(c, Math.round(count * 0.72));
  g.clearRect(0, 0, 300, 300);
  heartPath(g, 150, 160, 250);
  g.fillStyle = '#fff';
  g.fill();
  const fill = sampleCanvas(c, Math.round(count * 0.28));
  return { pts: [...ring.pts, ...fill.pts], aspect: 1 };
}

/* ---------------- cartoon portraits ---------------- */

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
const shade = (g, x0, y0, r0, x1, y1, r1, stops) => {
  const grd = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  return grd;
};

function backdrop(g, S) {
  g.fillStyle = shade(g, S * 0.5, S * 0.38, S * 0.05, S * 0.5, S * 0.5, S * 0.62,
    [[0, '#3b5296'], [0.55, '#16234a'], [1, '#070d22']]);
  g.fillRect(0, 0, S, S);
  // a warm glow behind the head and a few stars
  g.fillStyle = shade(g, S * 0.5, S * 0.4, 0, S * 0.5, S * 0.4, S * 0.4, [[0, 'rgba(255,214,140,.35)'], [1, 'rgba(255,214,140,0)']]);
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,240,210,.8)';
  [[0.2, 0.22], [0.8, 0.18], [0.14, 0.5], [0.86, 0.46], [0.27, 0.12], [0.72, 0.1]].forEach(([x, y], i) => {
    g.beginPath(); g.arc(S * x, S * y, S * (i % 2 ? 0.006 : 0.009), 0, Math.PI * 2); g.fill();
  });
}

function face(g, S, { cx, cy, blushes = true, lashes = false }) {
  const skin = '#e8b48c', skinLo = '#c98f68';
  // neck
  g.fillStyle = shade(g, cx, cy + S * 0.16, 0, cx, cy + S * 0.2, S * 0.1, [[0, skin], [1, skinLo]]);
  g.beginPath(); g.roundRect(cx - S * 0.055, cy + S * 0.1, S * 0.11, S * 0.12, S * 0.03); g.fill();
  // ears
  g.fillStyle = skinLo;
  [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * S * 0.135, cy + S * 0.01, S * 0.03, S * 0.042, 0, 0, Math.PI * 2); g.fill(); });
  // head: soft 3D shading
  g.fillStyle = shade(g, cx - S * 0.05, cy - S * 0.06, S * 0.02, cx, cy, S * 0.17, [[0, '#f6cfa8'], [0.6, skin], [1, skinLo]]);
  g.beginPath(); g.ellipse(cx, cy, S * 0.135, S * 0.155, 0, 0, Math.PI * 2); g.fill();
  // eyes: big, dark, with two highlights
  [-1, 1].forEach(s => {
    const ex = cx + s * S * 0.052, ey = cy + S * 0.005;
    g.fillStyle = '#2a1a12';
    g.beginPath(); g.ellipse(ex, ey, S * 0.019, S * 0.026, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(ex - S * 0.006, ey - S * 0.009, S * 0.007, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(ex + S * 0.007, ey + S * 0.008, S * 0.0035, 0, Math.PI * 2); g.fill();
    if (lashes) {
      g.strokeStyle = '#2a1a12'; g.lineWidth = S * 0.006; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ex + s * S * 0.016, ey - S * 0.018); g.lineTo(ex + s * S * 0.03, ey - S * 0.03); g.stroke();
    }
    // brows
    g.strokeStyle = '#3a2418'; g.lineWidth = S * 0.009; g.lineCap = 'round';
    g.beginPath(); g.arc(ex, ey - S * 0.012, S * 0.03, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
  });
  if (blushes) {
    g.fillStyle = 'rgba(233,120,130,.28)';
    [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * S * 0.075, cy + S * 0.05, S * 0.026, S * 0.016, 0, 0, Math.PI * 2); g.fill(); });
  }
  // nose and smile
  g.strokeStyle = 'rgba(150,90,60,.6)'; g.lineWidth = S * 0.006;
  g.beginPath(); g.arc(cx, cy + S * 0.035, S * 0.012, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  g.strokeStyle = '#8e3b3b'; g.lineWidth = S * 0.009;
  g.beginPath(); g.arc(cx, cy + S * 0.058, S * 0.034, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
}

export function groomPortrait(size = 768) {
  const [c, g] = canvas(size);
  const S = size, cx = S * 0.5, cy = S * 0.42;
  backdrop(g, S);
  g.save();
  g.translate(S * 0.5, S * 0.5); g.scale(1.32, 1.32); g.translate(-S * 0.5, -S * 0.47);
  // suit: shoulders, lapels, white shirt, gold bow tie, pink pocket square
  g.fillStyle = shade(g, cx, S * 0.7, S * 0.05, cx, S * 0.85, S * 0.45, [[0, '#2b3557'], [1, '#121830']]);
  g.beginPath(); g.moveTo(S * 0.12, S * 1.3); g.lineTo(S * 0.12, S); g.bezierCurveTo(S * 0.14, S * 0.72, S * 0.3, S * 0.64, cx, S * 0.63);
  g.bezierCurveTo(S * 0.7, S * 0.64, S * 0.86, S * 0.72, S * 0.88, S); g.closePath(); g.fill();
  g.fillStyle = '#f6efe2';
  g.beginPath(); g.moveTo(cx - S * 0.08, S * 0.63); g.lineTo(cx, S * 0.86); g.lineTo(cx + S * 0.08, S * 0.63); g.closePath(); g.fill();
  g.fillStyle = '#0d1226';
  [-1, 1].forEach(s => {
    g.beginPath(); g.moveTo(cx + s * S * 0.085, S * 0.63); g.lineTo(cx + s * S * 0.02, S * 0.86); g.lineTo(cx + s * S * 0.16, S * 0.7); g.closePath(); g.fill();
  });
  g.fillStyle = shade(g, cx - S * 0.01, S * 0.655, 0, cx, S * 0.66, S * 0.05, [[0, '#fff1c4'], [0.6, '#d6ad69'], [1, '#8a6224']]);
  g.beginPath(); g.moveTo(cx, S * 0.665); g.lineTo(cx - S * 0.055, S * 0.635); g.lineTo(cx - S * 0.055, S * 0.695); g.closePath();
  g.moveTo(cx, S * 0.665); g.lineTo(cx + S * 0.055, S * 0.635); g.lineTo(cx + S * 0.055, S * 0.695); g.closePath(); g.fill();
  g.beginPath(); g.arc(cx, S * 0.665, S * 0.014, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#efb5c2';
  g.beginPath(); g.moveTo(S * 0.66, S * 0.78); g.lineTo(S * 0.7, S * 0.75); g.lineTo(S * 0.73, S * 0.785); g.closePath(); g.fill();
  face(g, S, { cx, cy });
  // hair: a neat dark quiff with a soft highlight
  g.fillStyle = shade(g, cx - S * 0.05, cy - S * 0.17, S * 0.01, cx, cy - S * 0.1, S * 0.2, [[0, '#4a3226'], [0.5, '#24160f'], [1, '#140c08']]);
  g.beginPath();
  g.moveTo(cx - S * 0.14, cy - S * 0.01);
  g.bezierCurveTo(cx - S * 0.16, cy - S * 0.15, cx - S * 0.06, cy - S * 0.21, cx + S * 0.03, cy - S * 0.2);
  g.bezierCurveTo(cx + S * 0.13, cy - S * 0.2, cx + S * 0.16, cy - S * 0.1, cx + S * 0.14, cy - S * 0.01);
  g.bezierCurveTo(cx + S * 0.12, cy - S * 0.08, cx + S * 0.05, cy - S * 0.1, cx - S * 0.02, cy - S * 0.1);
  g.bezierCurveTo(cx - S * 0.08, cy - S * 0.1, cx - S * 0.12, cy - S * 0.07, cx - S * 0.14, cy - S * 0.01);
  g.fill();
  // a short, tidy beard line
  g.strokeStyle = 'rgba(40,25,18,.35)'; g.lineWidth = S * 0.018;
  g.beginPath(); g.arc(cx, cy + S * 0.02, S * 0.128, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
  g.restore();
  return c;
}

export function bridePortrait(size = 768) {
  const [c, g] = canvas(size);
  const S = size, cx = S * 0.5, cy = S * 0.42;
  backdrop(g, S);
  g.save();
  g.translate(S * 0.5, S * 0.5); g.scale(1.32, 1.32); g.translate(-S * 0.5, -S * 0.47);
  // the veil falls behind the shoulders
  g.fillStyle = shade(g, cx, cy, S * 0.1, cx, cy + S * 0.2, S * 0.5, [[0, 'rgba(255,250,242,.95)'], [1, 'rgba(240,228,214,.85)']]);
  g.beginPath(); g.moveTo(cx - S * 0.19, cy - S * 0.05);
  g.bezierCurveTo(cx - S * 0.3, cy + S * 0.25, cx - S * 0.32, S * 0.85, cx - S * 0.36, S);
  g.lineTo(cx + S * 0.36, S); g.bezierCurveTo(cx + S * 0.32, S * 0.85, cx + S * 0.3, cy + S * 0.25, cx + S * 0.19, cy - S * 0.05);
  g.closePath(); g.fill();
  // gown with a lace sweetheart neckline
  g.fillStyle = shade(g, cx, S * 0.72, S * 0.05, cx, S * 0.85, S * 0.45, [[0, '#fffaf2'], [1, '#e8dccb']]);
  g.beginPath(); g.moveTo(S * 0.16, S); g.bezierCurveTo(S * 0.18, S * 0.74, S * 0.32, S * 0.66, cx, S * 0.65);
  g.bezierCurveTo(S * 0.68, S * 0.66, S * 0.82, S * 0.74, S * 0.84, S); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(214,173,105,.85)'; g.lineWidth = S * 0.007;
  g.beginPath(); g.moveTo(cx - S * 0.12, S * 0.68); g.quadraticCurveTo(cx - S * 0.06, S * 0.76, cx, S * 0.71); g.quadraticCurveTo(cx + S * 0.06, S * 0.76, cx + S * 0.12, S * 0.68); g.stroke();
  g.fillStyle = 'rgba(214,173,105,.9)';
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(cx - S * 0.1 + i * S * 0.025, S * 0.705 + Math.sin(i) * S * 0.006, S * 0.005, 0, Math.PI * 2); g.fill(); }
  face(g, S, { cx, cy, lashes: true });
  // the veil framing the face (covers the hair), with a soft fold line
  g.fillStyle = shade(g, cx - S * 0.06, cy - S * 0.16, S * 0.02, cx, cy - S * 0.05, S * 0.26, [[0, '#ffffff'], [0.7, '#f7efe4'], [1, '#e3d6c4']]);
  g.beginPath();
  g.moveTo(cx - S * 0.155, cy + S * 0.14);
  g.bezierCurveTo(cx - S * 0.2, cy - S * 0.02, cx - S * 0.17, cy - S * 0.21, cx, cy - S * 0.215);
  g.bezierCurveTo(cx + S * 0.17, cy - S * 0.21, cx + S * 0.2, cy - S * 0.02, cx + S * 0.155, cy + S * 0.14);
  g.bezierCurveTo(cx + S * 0.15, cy + S * 0.05, cx + S * 0.15, cy - S * 0.09, cx, cy - S * 0.145);
  g.bezierCurveTo(cx - S * 0.15, cy - S * 0.09, cx - S * 0.15, cy + S * 0.05, cx - S * 0.155, cy + S * 0.14);
  g.fill();
  g.strokeStyle = 'rgba(190,170,145,.5)'; g.lineWidth = S * 0.005;
  g.beginPath(); g.moveTo(cx, cy - S * 0.145); g.bezierCurveTo(cx - S * 0.13, cy - S * 0.1, cx - S * 0.15, cy + S * 0.02, cx - S * 0.152, cy + S * 0.12); g.stroke();
  // a pearl tiara with little blush roses
  g.fillStyle = shade(g, cx, cy - S * 0.17, 0, cx, cy - S * 0.17, S * 0.12, [[0, '#fff3cf'], [1, '#c99a4b']]);
  g.beginPath(); g.ellipse(cx, cy - S * 0.168, S * 0.12, S * 0.022, 0, Math.PI, 0); g.fill();
  [[-0.08, -0.155], [0, -0.19], [0.08, -0.155]].forEach(([dx, dy], i) => {
    g.fillStyle = i === 1 ? '#f1b8c4' : '#f8dfe4';
    g.beginPath(); g.arc(cx + S * dx, cy + S * dy, S * (i === 1 ? 0.024 : 0.018), 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.beginPath(); g.arc(cx + S * dx - S * 0.006, cy + S * dy - S * 0.006, S * 0.006, 0, Math.PI * 2); g.fill();
  });
  g.restore();
  return c;
}

/* an ivory ribbon banner with a name in gold calligraphy */
export function ribbonTexture(text, family) {
  const W = 1024, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#fffaf0'); grd.addColorStop(0.5, '#f1e4cc'); grd.addColorStop(1, '#d9c3a0');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, H * 0.18); g.lineTo(W * 0.07, H * 0.5); g.lineTo(0, H * 0.82);             // swallow-tail ends
  g.lineTo(W, H * 0.82); g.lineTo(W * 0.93, H * 0.5); g.lineTo(W, H * 0.18); g.closePath();
  g.fill();
  g.strokeStyle = '#c99a4b'; g.lineWidth = 6;
  g.strokeRect(W * 0.1, H * 0.24, W * 0.8, H * 0.52);
  g.font = `700 112px ${family}`;
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tg = g.createLinearGradient(0, H * 0.3, 0, H * 0.75);
  tg.addColorStop(0, '#a87a34'); tg.addColorStop(1, '#5c3d12');
  g.fillStyle = tg;
  g.fillText(text, W / 2, H * 0.52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.42 * s);
  sh.bezierCurveTo(-0.62 * s, 0.02 * s, -0.5 * s, 0.52 * s, 0, 0.26 * s);
  sh.bezierCurveTo(0.5 * s, 0.52 * s, 0.62 * s, 0.02 * s, 0, -0.42 * s);
  return sh;
}
