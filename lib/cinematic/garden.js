/* ================================================================
   Games & surprises in the garden (preview: ?games=1 only).
   • five hidden hearts, each placed where a chapter's own portrait
     framing shows it, clear of that chapter's words and buttons;
   • three game entrances as objects of the world: a sign at the foot
     of the chandelier tree (the quiz), a little football corner on the
     right lawn (the penalty challenge), a glowing book on a plinth at
     the left shore among the floating candles (write your wish).
   Positions were fitted on a 390×844 portrait screen; the comment on
   each says where it lands and in which chapter.
================================================================ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WATER_Y } from './particles';
import { heartShape } from './shapes';
import { radialTexture } from './textures';
import { WEDDING, weddingInstant } from '@/lib/wedding';
import { POSTER } from '@/lib/games/poster';
import { HINGE_Z, T } from './world';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// five matching rubies; `glow` keeps the four in the garden a little dimmer than the one on the
// lit door, so they still have to be found
export const HEARTS = [
  // the door: on the left capital, where the arch springs (≈ 44,334)
  { id: 'door', chapter: 'door', at: V(-1.17, 2.44, 0.3), size: 0.19, glow: 1 },
  // the aisle: among the petals beside the last lantern before the arch (RSVP, ≈ 310,679)
  { id: 'aisle', chapter: 'rsvp', at: V(0.55, 0.1, -17.2), size: 0.11, glow: 0.75 },
  // the lake: floating with the candles off the left shore, past the grand tree's trunk (the couple, ≈ 46,712);
  // from the explore overlook it stands clear of the wish book (≈ 220 px) and the quiz sign (≈ 86 px)
  { id: 'lake', chapter: 'couple', at: V(-14, WATER_Y + 0.38, -26), size: 0.5, float: true, glow: 0.75 },
  // the chandelier tree: hanging on a cord from the near boughs, above the groom, clear of the title
  // in portrait and landscape alike (the couple)
  { id: 'tree', chapter: 'couple', at: V(-4.3, 5.85, -15.2), size: 0.24, cord: 1.6, glow: 0.75 },
  // the floral arch: tucked into the flowers on the arch's left shoulder (the names, ≈ 91,543)
  { id: 'arch', chapter: 'names', at: V(-0.92, 2.24, -18.86), size: 0.17, glow: 0.75 },
];

export const GAME_SPOTS = {
  // at the foot of the chandelier tree, under the medallions (the couple, ≈ 240,731 — no turning needed)
  quiz: { at: V(-4.8, 0, -15.0), face: V(-2.6, 0, -8.4), label: 'تحدي العروسين' },
  // on the right lawn by the shore, past the last jasmine bushes (explore from RSVP: centred ≈ 35° right)
  penalty: { at: V(3.3, 0, -18.6), face: V(0, 0, -14.2), label: 'تحدي العروسة' },
  // on the left shore among the floating candles (explore from RSVP: centred ≈ 30° left)
  wish: { at: V(-3.4, 0, -20.1), face: V(0, 0, -14.2), label: 'اكتب أمنيتك' },
};

/* ---------- canvases ---------- */
function signTexture(text, family) {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  // a walnut board with a gold inlay
  const wood = g.createLinearGradient(0, 0, 0, H);
  wood.addColorStop(0, '#6b4a30'); wood.addColorStop(0.5, '#553722'); wood.addColorStop(1, '#3e2716');
  g.fillStyle = wood;
  g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 46); g.fill();
  g.globalAlpha = 0.12; g.strokeStyle = '#1d1209'; g.lineWidth = 2;
  for (let y = 22; y < H; y += 9) { g.beginPath(); g.moveTo(10, y + Math.sin(y) * 3); g.bezierCurveTo(W * 0.3, y - 4, W * 0.6, y + 5, W - 10, y); g.stroke(); }
  g.globalAlpha = 1;
  const gold = g.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#fff4d6'); gold.addColorStop(0.45, '#e3c27e'); gold.addColorStop(1, '#9a6c2c');
  g.strokeStyle = gold; g.lineWidth = 9;
  g.beginPath(); g.roundRect(22, 22, W - 44, H - 44, 34); g.stroke();
  g.lineWidth = 2.5;
  g.beginPath(); g.roundRect(36, 36, W - 72, H - 72, 24); g.stroke();
  g.font = `700 78px ${family}`;
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  g.fillStyle = gold;
  g.fillText(text, W / 2, H * 0.53);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function ballTexture() {
  const S = 256, c = document.createElement('canvas');
  c.width = S * 2; c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf6ec'; g.fillRect(0, 0, S * 2, S);
  // navy patches on an equirectangular map: they read as a classic ball once wrapped
  g.fillStyle = '#16244f';
  const patch = (x, y, r) => {
    g.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i / 5) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r); }
    g.closePath(); g.fill();
  };
  for (let k = 0; k < 5; k++) { patch((k + 0.5) * S * 0.4, S * 0.5, S * 0.11); patch(k * S * 0.4, S * 0.17, S * 0.07); patch(k * S * 0.4, S * 0.83, S * 0.07); }
  g.fillStyle = '#16244f'; g.fillRect(0, 0, S * 2, S * 0.04); g.fillRect(0, S * 0.96, S * 2, S * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bookTexture() {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const page = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6);
  page.addColorStop(0, '#fffaf0'); page.addColorStop(1, '#ead8b6');
  g.fillStyle = page; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(160,120,60,.45)'; g.lineWidth = 3;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 7; i++) {
      const x0 = side ? W * 0.56 : W * 0.08, y = H * (0.2 + i * 0.1);
      g.beginPath(); g.moveTo(x0, y); g.bezierCurveTo(x0 + 60, y - 4, x0 + 110, y + 4, x0 + W * 0.36, y); g.stroke();
    }
  }
  g.fillStyle = 'rgba(120,80,30,.35)'; g.fillRect(W / 2 - 2, 0, 4, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- the letter on the door: a small ivory parchment on a rope from a brass ring ----------
   The paper, its ornaments, the rope, the scroll and the wax seal are 3D; the words and the two
   buttons are the page's own text laid over the paper (GamesLayer), so they stay sharp and
   readable at any size and work with a screen reader. Open → rolls up into a sealed scroll
   (close) → unrolls again (open), as often as the guest likes; neither touches the door.
   «ابدأ المغامرة» is a raised scrap of torn parchment on the letter (real geometry: thickness,
   curled and folded corners, a shadow on the paper under it); «افتح الرسالة» is a carved walnut
   sign that drops in on two ropes from brass hooks on the door while the letter is rolled up. */
const LETTER_W = 1.34, LETTER_H = 2.3;               // metres: the door's carving shows on both sides
const LETTER_TOP = 2.86;                             // under the arch of the glass, above the handles
const PX = 768, PY = Math.round(PX * LETTER_H / LETTER_W);
// the parchment button: centred under the words, near the foot of the letter (GamesLayer keeps the words above it)
const BTN_W = 1.06, BTN_H = 0.38, BTN_Y = LETTER_H * 0.855, BTN_Z = 0.026;
const BPX = 512, BPY = Math.round(BPX * BTN_H / BTN_W);
// the sign: hooks on the wooden stile at the seam (one on each leaf), just under the rolled scroll;
// the board hangs between the top rosettes of the glass and the handles, clear of the ruby on the capital
const SIGN_W = 0.96, SIGN_H = 0.36, SIGN_TOP = 2.44, HOOK_X = 0.055, HOOK_Y = 2.66, EYE_X = 0.4, EYE_Y = -0.035;

// a torn edge, the same every time: a ragged line with a few deep nicks bitten out of it
function edgePoints(inset, seed = 3, { w = PX, h = PY, nx = 60, ny = 100, k = 1 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = [];
  const side = (x0, y0, x1, y1, n, nX, nY) => {
    for (let i = 0; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      let d = ((rnd() - 0.5) * 16 + Math.sin(t * 37 + seed) * 4) * k;   // ragged
      if (rnd() < 0.07) d += (26 + rnd() * 26) * k;                      // a nick torn out
      pts.push([x + nX * d, y + nY * d]);
    }
  };
  const a = inset, b = w - inset, top = inset, bot = h - inset;
  side(a, top, b, top, nx, 0, 1);
  side(b, top, b, bot, ny, -1, 0);
  side(b, bot, a, bot, nx, 0, -1);
  side(a, bot, a, top, ny, 1, 0);
  return pts;
}
function edgePath(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}
// hairline cracks running in from the edge, with a lighter lip beside each
function cracks(g, pts, seed = 9, { w = PX, h = PY, n = 30, k = 1 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[(rnd() * pts.length) | 0];
    const cx = w / 2 - x0, cy = h / 2 - y0, l = Math.hypot(cx, cy);
    let x = x0, y = y0, ang = Math.atan2(cy, cx) + (rnd() - 0.5) * 0.9;
    const len = (26 + rnd() * 70) * k, steps = 5 + ((rnd() * 4) | 0);
    const path = [[x, y]];
    for (let j = 0; j < steps; j++) { ang += (rnd() - 0.5) * 0.9; x += Math.cos(ang) * len / steps; y += Math.sin(ang) * len / steps; path.push([x, y]); }
    if (!l) continue;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,250,236,.55)'; g.lineWidth = 2.2 * Math.max(k, 0.6);
    g.beginPath(); path.forEach(([px, py], j) => (j ? g.lineTo(px + 1.5, py + 1.5) : g.moveTo(px + 1.5, py + 1.5))); g.stroke();
    g.strokeStyle = 'rgba(84,50,18,.78)'; g.lineWidth = 2 * Math.max(k, 0.6);
    g.beginPath(); path.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
  }
}

function letterTexture() {
  const c = document.createElement('canvas');
  c.width = PX; c.height = PY;
  const g = c.getContext('2d');
  const edge = edgePoints(22);
  g.save();
  edgePath(g, edge);
  g.clip();
  const paper = g.createRadialGradient(PX / 2, PY * 0.42, PX * 0.08, PX / 2, PY * 0.5, PY * 0.66);
  paper.addColorStop(0, '#fcf6e8'); paper.addColorStop(0.62, '#f3e6c8'); paper.addColorStop(1, '#ddc497');
  g.fillStyle = paper; g.fillRect(0, 0, PX, PY);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,85,40,${0.025 + rnd() * 0.04})`; g.fillRect(rnd() * PX, rnd() * PY, 1 + rnd() * 1.5, 3 + rnd() * 8); }
  // a burnt, darkened rim that follows every tear
  g.lineWidth = 46; g.strokeStyle = 'rgba(110,70,26,.3)'; g.filter = 'blur(14px)'; edgePath(g, edge); g.stroke(); g.filter = 'none';
  g.lineWidth = 3; g.strokeStyle = 'rgba(90,56,20,.55)'; edgePath(g, edge); g.stroke();
  cracks(g, edge);
  // a fine gold rule inside the edge, small flourishes in the corners and an ornament at the head
  const gold = g.createLinearGradient(0, 0, PX, PY);
  gold.addColorStop(0, '#f1d6a5'); gold.addColorStop(0.5, '#c39545'); gold.addColorStop(1, '#8a6224');
  g.strokeStyle = gold; g.fillStyle = gold;
  g.lineWidth = 3; g.strokeRect(34, 34, PX - 68, PY - 68);
  g.lineWidth = 1.2; g.strokeRect(44, 44, PX - 88, PY - 88);
  const curl = (x, y, sx, sy) => {
    g.save(); g.translate(x, y); g.scale(sx, sy); g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(30, 0, 44, 12, 40, 32); g.bezierCurveTo(37, 48, 16, 44, 22, 30); g.stroke();
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(0, 30, 12, 44, 32, 40); g.stroke();
    g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  curl(56, 56, 1, 1); curl(PX - 56, 56, -1, 1); curl(56, PY - 56, 1, -1); curl(PX - 56, PY - 56, -1, -1);
  const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.32 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  g.beginPath(); g.moveTo(PX / 2 - 110, 74); g.lineTo(PX / 2 - 26, 74); g.moveTo(PX / 2 + 26, 74); g.lineTo(PX / 2 + 110, 74); g.lineWidth = 1.6; g.stroke();
  star(PX / 2, 74, 15); star(PX / 2 - 120, 74, 6); star(PX / 2 + 120, 74, 6);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function sealTexture() {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const wax = g.createRadialGradient(S * 0.4, S * 0.35, 4, S / 2, S / 2, S / 2);
  wax.addColorStop(0, '#d0364b'); wax.addColorStop(0.6, '#8f1426'); wax.addColorStop(1, '#5a0a16');
  g.fillStyle = wax;
  g.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2, r = S * (0.46 + (i % 2 ? 0.03 : 0)); g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); }
  g.fill();
  g.strokeStyle = 'rgba(255,190,190,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2); g.stroke();
  // an embossed heart
  g.fillStyle = 'rgba(70,4,14,.55)';
  g.beginPath(); g.moveTo(S / 2, S * 0.66); g.bezierCurveTo(S * 0.3, S * 0.52, S * 0.36, S * 0.34, S / 2, S * 0.44); g.bezierCurveTo(S * 0.64, S * 0.34, S * 0.7, S * 0.52, S / 2, S * 0.66); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// «ابدأ المغامرة»: antique parchment torn all round — fibres, a crease, worn corners, hairline
// cracks, a scorched rim and a fine gold rule with a star at each end. The words are laid over it
// by the page (GamesLayer), printed in ink between the stars.
function parchmentTexture() {
  const c = document.createElement('canvas');
  c.width = BPX; c.height = BPY;
  const g = c.getContext('2d');
  const shape = { w: BPX, h: BPY, nx: 64, ny: 22, k: 0.5 };
  const edge = edgePoints(12, 7, shape);
  g.save();
  edgePath(g, edge);
  g.clip();
  const paper = g.createRadialGradient(BPX * 0.46, BPY * 0.38, 8, BPX / 2, BPY / 2, BPX * 0.58);
  paper.addColorStop(0, '#fffaee'); paper.addColorStop(0.55, '#f5e8c9'); paper.addColorStop(1, '#d9bd8b');
  g.fillStyle = paper; g.fillRect(0, 0, BPX, BPY);
  let seed = 21;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // paper fibres
  g.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const x = rnd() * BPX, y = rnd() * BPY, a = rnd() * Math.PI, l = 3 + rnd() * 10;
    g.strokeStyle = `rgba(120,85,40,${0.03 + rnd() * 0.06})`; g.lineWidth = 0.6 + rnd() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  // an old fold across the paper: a shadow on one side, a light ridge on the other
  const fold = (x0, y0, x1, y1) => {
    g.lineWidth = 5; g.strokeStyle = 'rgba(120,80,34,.13)'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,252,240,.7)'; g.beginPath(); g.moveTo(x0 + 2, y0 + 2); g.lineTo(x1 + 2, y1 + 2); g.stroke();
  };
  fold(BPX * 0.31, -4, BPX * 0.36, BPY + 4);
  fold(BPX * 0.7, BPY + 4, BPX * 0.78, -4);
  // worn, darker corners
  [[0, 0], [BPX, 0], [0, BPY], [BPX, BPY]].forEach(([x, y]) => {
    const wear = g.createRadialGradient(x, y, 0, x, y, BPY * 0.7);
    wear.addColorStop(0, 'rgba(120,76,28,.32)'); wear.addColorStop(1, 'rgba(120,76,28,0)');
    g.fillStyle = wear; g.fillRect(0, 0, BPX, BPY);
  });
  // a scorched rim that follows every tear
  g.lineWidth = 22; g.strokeStyle = 'rgba(110,70,26,.2)'; g.filter = 'blur(8px)'; edgePath(g, edge); g.stroke(); g.filter = 'none';
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(90,56,20,.45)'; edgePath(g, edge); g.stroke();
  cracks(g, edge, 13, { ...shape, n: 9, k: 0.45 });
  // gold, but not metal: a fine double rule inside the tears and a star at each end of the words
  const gold = g.createLinearGradient(0, 0, BPX, BPY);
  gold.addColorStop(0, '#ecd09a'); gold.addColorStop(0.5, '#c39545'); gold.addColorStop(1, '#8a6224');
  g.strokeStyle = gold; g.fillStyle = gold;
  g.lineWidth = 2.2; g.beginPath(); g.roundRect(28, 26, BPX - 56, BPY - 52, 16); g.stroke();
  g.lineWidth = 1; g.beginPath(); g.roundRect(35, 33, BPX - 70, BPY - 66, 11); g.stroke();
  const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.34 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  star(52, BPY / 2, 9); star(BPX - 52, BPY / 2, 9);
  for (let i = 0; i < 40; i++) { g.globalAlpha = 0.25 + rnd() * 0.4; g.fillRect(40 + rnd() * (BPX - 80), 30 + rnd() * (BPY - 60), 1.4, 1.4); }
  g.globalAlpha = 1;
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// the parchment's shadow on the letter: dark right under its edges, soft beyond them
function contactShadowTexture() {
  const W = 256, H = Math.round(W * BTN_H / BTN_W * 1.1), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.filter = 'blur(9px)';
  g.fillStyle = 'rgba(58,36,16,.75)';
  g.beginPath(); g.roundRect(26, 20, W - 52, H - 40, 10); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// «افتح الرسالة»: a walnut board — flowing grain round a knot, small dents, worn darker edges, a
// carved border — the words cut into it and laid with soft gold leaf, brass nails in the lower corners
function signFaceTexture(text, family) {
  const W = 512, H = Math.round(W * SIGN_H / SIGN_W), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#7d5534'); base.addColorStop(0.5, '#694427'); base.addColorStop(1, '#52331c');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  let seed = 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const kx = W * 0.86, ky = H * 0.72;                  // the knot, away from the words
  for (let i = 0; i < 48; i++) {
    const y0 = (i / 48) * H * 1.12 - H * 0.06;
    g.strokeStyle = rnd() < 0.55 ? `rgba(38,20,8,${0.16 + rnd() * 0.22})` : `rgba(176,126,82,${0.07 + rnd() * 0.12})`;
    g.lineWidth = 0.8 + rnd() * 2.4;
    g.beginPath();
    for (let x = -12; x <= W + 12; x += 12) {
      const dx = x - kx, dy = y0 - ky, dk = dx * dx + dy * dy * 2.6;
      const y = y0 + Math.sin(x * 0.011 + i * 0.7) * 3 + 30 * Math.exp(-dk / 3600) * Math.sign(dy || 1);
      if (x === -12) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (const r of [16, 11, 7]) { g.strokeStyle = 'rgba(34,17,6,.42)'; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, r * 1.5, r * 0.75, -0.08, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(30,14,5,.7)'; g.beginPath(); g.ellipse(kx, ky, 5, 2.6, -0.08, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(24,12,4,${0.2 + rnd() * 0.3})`; g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 0.8 + rnd() * 2.2, 0.6 + rnd(), rnd() * 3, 0, Math.PI * 2); g.fill(); }
  // edges worn darker by hands and weather
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.6);
  vg.addColorStop(0, 'rgba(20,10,4,0)'); vg.addColorStop(1, 'rgba(20,10,4,.55)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  // a carved border: the groove's shadow above, its lit lip below
  g.lineWidth = 3; g.strokeStyle = 'rgba(22,10,3,.7)'; g.beginPath(); g.roundRect(20, 17, W - 40, H - 34, 22); g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(232,184,130,.32)'; g.beginPath(); g.roundRect(21.5, 19.5, W - 40, H - 34, 22); g.stroke();
  // brass nails
  [[38, H - 34], [W - 38, H - 34]].forEach(([x, y]) => {
    const n = g.createRadialGradient(x - 2, y - 2, 0.5, x, y, 7);
    n.addColorStop(0, '#fff1c4'); n.addColorStop(0.45, '#d4a64e'); n.addColorStop(1, '#6e4c18');
    g.fillStyle = 'rgba(15,7,2,.6)'; g.beginPath(); g.arc(x + 1, y + 1.5, 7.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = n; g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill();
  });
  // the words, cut into the wood: lit lower lip, the dark cut, then gold leaf set a little lower
  // so the cut's shadow stays along the top of every stroke
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 92;
  g.font = `700 ${size}px ${family}`;
  size = Math.min(size, size * (W * 0.74) / Math.max(1, g.measureText(text).width));
  g.font = `700 ${size}px ${family}`;
  const y = H * 0.5;
  g.fillStyle = 'rgba(255,214,160,.38)'; g.fillText(text, W / 2, y + 3);
  g.fillStyle = '#170a03'; g.fillText(text, W / 2, y);
  const leaf = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  leaf.addColorStop(0, '#fff6dc'); leaf.addColorStop(0.5, '#ecc277'); leaf.addColorStop(1, '#a8763a');
  g.fillStyle = leaf; g.fillText(text, W / 2, y + 1.6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// twisted jute: diagonal strands that read as a rope at any length
function ropeTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#b39467'; g.fillRect(0, 0, 16, 64);
  g.strokeStyle = 'rgba(60,40,18,.6)'; g.lineWidth = 2.5;
  for (let y = -16; y < 80; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(16, y + 10); g.stroke(); }
  g.strokeStyle = 'rgba(240,220,180,.45)'; g.lineWidth = 1;
  for (let y = -14; y < 80; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(16, y + 10); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 9);
  return tex;
}

// the board's outline: not a perfect rectangle — a soft hump along the top, a sag along the
// bottom, corners rounded unevenly. Origin at the middle of the top edge.
function signShape() {
  const w = SIGN_W / 2, h = SIGN_H, s = new THREE.Shape();
  s.moveTo(-w + 0.05, 0.004);
  s.quadraticCurveTo(0.02, 0.024, w - 0.062, 0);
  s.quadraticCurveTo(w + 0.004, -0.003, w + 0.004, -0.058);
  s.lineTo(w - 0.008, -h + 0.072);
  s.quadraticCurveTo(w - 0.01, -h - 0.004, w - 0.082, -h + 0.006);
  s.quadraticCurveTo(0.1, -h - 0.014, -w + 0.06, -h - 0.002);
  s.quadraticCurveTo(-w - 0.004, -h + 0.002, -w + 0.002, -h + 0.052);
  s.lineTo(-w - 0.006, -0.05);
  s.quadraticCurveTo(-w - 0.002, 0.006, -w + 0.05, 0.004);
  return s;
}

// a corner rolled round a little cylinder: corner, the direction into the paper, how far in the
// fold starts, the roll's radius, up (+1, towards the guest) or down (−1, into the letter)
const CURLS = [
  { x: -BTN_W / 2, y: BTN_H / 2, dx: 1, dy: -1, reach: 0.16, rad: 0.042, up: 1 },
  { x: BTN_W / 2, y: -BTN_H / 2, dx: -1, dy: 1, reach: 0.17, rad: 0.046, up: 1 },
  { x: BTN_W / 2, y: BTN_H / 2, dx: -1, dy: -1, reach: 0.06, rad: 0.08, up: -1 },
  { x: -BTN_W / 2, y: -BTN_H / 2, dx: 1, dy: 1, reach: 0.05, rad: 0.07, up: -1 },
].map(c => ({ ...c, dx: c.dx / Math.SQRT2, dy: c.dy / Math.SQRT2 }));

function createLetter(scene, { brass, disposables, family, door }) {
  const tex = letterTexture(), sealTex = sealTexture();
  disposables.push(tex, sealTex);
  // the paper: the bottom edge curls forward like a sheet that was rolled, a faint belly in the middle
  const geo = new THREE.PlaneGeometry(LETTER_W, LETTER_H, 20, 30);
  geo.translate(0, -LETTER_H / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / LETTER_W + 0.5, v = -p.getY(i) / LETTER_H;
    const low = Math.max(0, (v - 0.86) / 0.14), side = Math.max(0, (Math.abs(u - 0.5) * 2 - 0.7) / 0.3);
    p.setZ(i, 0.05 * low * low + 0.025 * side * side * Math.max(low, 0.3) + 0.01 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
  }
  geo.computeVertexNormals();
  const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.95, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,.5)'], [0.7, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,0)']]);
  disposables.push(shadowTex);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(LETTER_W * 1.18, LETTER_H * 1.1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 }));
  shadow.position.set(0.03, -LETTER_H / 2 - 0.04, -0.025);

  // hung on the door: a brass ring at the head, a rope to two pins on the paper's corners
  const z = HINGE_Z + T / 2 + 0.11;
  const pivot = new THREE.Group();
  pivot.position.set(0, LETTER_TOP, z);
  const ringY = 0.24;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 10, 28), brass);
  ring.position.set(0, ringY, -0.03);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), brass);
  boss.position.set(0, ringY + 0.05, -0.06);
  const pinX = LETTER_W / 2 - 0.08;
  const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-pinX, -0.06, 0.02), new THREE.Vector3(-pinX * 0.4, ringY * 0.55, 0.0), new THREE.Vector3(0, ringY - 0.05, -0.02),
    new THREE.Vector3(pinX * 0.4, ringY * 0.55, 0.0), new THREE.Vector3(pinX, -0.06, 0.02),
  ]), 40, 0.006, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 }));
  const pins = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), brass); m.position.set(s * pinX, -0.06, 0.03); return m; });
  const sheet = new THREE.Group();          // what sways: paper, its shadow, the pins
  sheet.add(shadow, paper, ...pins);
  // the roll: grows as the paper winds onto it; when closed it is the scroll, with its wax seal
  const rollMat = new THREE.MeshStandardMaterial({ color: 0xefe1bf, roughness: 0.9, emissive: 0x3a2c14, emissiveIntensity: 0.35 });
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, LETTER_W * 0.97, 28, 1).rotateZ(Math.PI / 2), rollMat);
  const knobs = [-1, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), brass));
  const seal = new THREE.Group();
  const sealDisc = new THREE.Mesh(new THREE.CircleGeometry(0.085, 28), new THREE.MeshStandardMaterial({ map: sealTex, transparent: true, alphaTest: 0.4, roughness: 0.35, emissive: 0x2a0008, emissiveIntensity: 0.4 }));
  seal.add(sealDisc);
  sheet.add(roll, seal, ...knobs);

  /* «ابدأ المغامرة»: the scrap of parchment raised on the letter. One bent sheet drawn twice — the
     face, and a darker copy a few millimetres behind and lower that shows as the paper's thickness —
     over a soft shadow on the letter. Pressing it pushes the middle in, which lifts the curled corners. */
  const btnTex = parchmentTexture();
  disposables.push(btnTex);
  const btnGeo = new THREE.PlaneGeometry(BTN_W, BTN_H, 64, 22);
  const flat = btnGeo.attributes.position.array.slice();
  function bend(press, breeze) {
    const pos = btnGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = flat[i * 3], y = flat[i * 3 + 1];
      const u = x / BTN_W + 0.5, v = y / BTN_H + 0.5;
      // raised in the middle like paper with a little body; the press dents it
      let zz = (0.008 - 0.016 * press) * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      zz += 0.003 * Math.sin(u * 11 + 1.3) * Math.pow(Math.abs(v - 0.5) * 2, 2);
      for (let k = 0; k < CURLS.length; k++) {
        const c = CURLS[k];
        const over = c.reach * (1 + 0.3 * press) * (1 + 0.06 * Math.sin(breeze + k * 1.9)) - ((x - c.x) * c.dx + (y - c.y) * c.dy);
        if (over <= 0) continue;
        const a = Math.min(over / c.rad, 2.7), shift = over - c.rad * Math.sin(a);
        x += c.dx * shift; y += c.dy * shift;
        zz += c.up * c.rad * (1 - Math.cos(a));
      }
      pos.setXYZ(i, x, y, zz);
    }
    pos.needsUpdate = true;
    btnGeo.computeVertexNormals();
  }
  bend(0, 0);
  const faceMat = new THREE.MeshStandardMaterial({ map: btnTex, emissiveMap: btnTex, emissive: 0xffffff, emissiveIntensity: 0.26, roughness: 0.92, alphaTest: 0.5, side: THREE.DoubleSide });
  // the underside of a curled corner faces away from the light: a shade darker and warmer
  faceMat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'if (!gl_FrontFacing) outgoingLight *= vec3(0.74, 0.68, 0.6);\n#include <opaque_fragment>');
  };
  faceMat.customProgramCacheKey = () => 'parchment-underside';
  const btnFace = new THREE.Mesh(btnGeo, faceMat);
  const btnEdge = new THREE.Mesh(btnGeo, new THREE.MeshStandardMaterial({ map: btnTex, color: 0xdcc394, emissive: 0x4a3618, emissiveIntensity: 0.5, roughness: 1, alphaTest: 0.5, side: THREE.DoubleSide }));
  btnEdge.position.set(0.007, -0.016, -0.008);
  btnEdge.scale.set(1.006, 1.01, 1);
  const contactTex = contactShadowTexture();
  disposables.push(contactTex);
  const btnShadow = new THREE.Mesh(new THREE.PlaneGeometry(BTN_W * 1.24, BTN_H * 1.62), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0.55 }));
  btnShadow.renderOrder = 1;             // over the letter's paper, which is drawn with the transparent pass
  const btn = new THREE.Group();
  btn.add(btnShadow, btnEdge, btnFace);
  btn.rotation.z = -0.022;               // laid on by hand, not quite square
  sheet.add(btn);
  pivot.add(ring, boss, rope, sheet);
  scene.add(pivot);

  /* «افتح الرسالة»: the walnut sign. Brass cup hooks are screwed into the stile on each leaf (they
     open with the door); the board hangs from them on two ropes and swings like a pendulum from
     the point between the hooks, the ropes recomputed every frame so they always meet hook and eyelet. */
  const doorZ = HINGE_Z + T / 2;
  const hookGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.026, 0.029, 0.008, 16).rotateX(Math.PI / 2).translate(0, 0, 0.004),      // the rose on the wood
    new THREE.CylinderGeometry(0.006, 0.006, 0.026, 8).rotateX(Math.PI / 2).translate(0, 0, 0.016),       // the shank
    new THREE.TorusGeometry(0.016, 0.0058, 8, 14, Math.PI).rotateZ(Math.PI).translate(0, 0.016, 0.029),  // the cup, open upwards
  ]);
  disposables.push(hookGeo);
  [-1, 1].forEach(s => {
    const hook = new THREE.Mesh(hookGeo, brass);
    const leaf = s < 0 ? door?.left : door?.right;
    // hinge space: the left hinge stands at x = −1, the right at x = +1, both at HINGE_Z
    if (leaf) { hook.position.set(s * HOOK_X - s, HOOK_Y, T / 2); leaf.add(hook); }
    else { hook.position.set(s * HOOK_X, HOOK_Y, doorZ); scene.add(hook); }
  });
  const faceTex = signFaceTexture(POSTER.reopen, family), ropeTex = ropeTexture();
  disposables.push(faceTex, ropeTex);
  const boardGeo = new THREE.ExtrudeGeometry(signShape(), { depth: 0.024, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.009, bevelSegments: 2, curveSegments: 8 });
  boardGeo.translate(0, 0, 0.008);
  {
    // the face maps the canvas once across the board (the bevel and the sides are plain walnut)
    const uv = boardGeo.attributes.uv, pos = boardGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + SIGN_W / 2) / SIGN_W, (pos.getY(i) + SIGN_H) / SIGN_H);
  }
  const board = new THREE.Mesh(boardGeo, [
    new THREE.MeshStandardMaterial({ map: faceTex, emissiveMap: faceTex, emissive: 0xffffff, emissiveIntensity: 0.36, roughness: 0.55 }),
    new THREE.MeshStandardMaterial({ color: 0x3e2615, roughness: 0.62, emissive: 0x1c0e05, emissiveIntensity: 0.5 }),
  ]);
  const eyeGeo = new THREE.TorusGeometry(0.016, 0.0048, 8, 18);
  disposables.push(eyeGeo);
  const boardFront = 0.042;
  const eyes = [-1, 1].map(s => { const m = new THREE.Mesh(eyeGeo, brass); m.position.set(s * EYE_X, EYE_Y, boardFront + 0.002); return m; });
  const swingBoard = new THREE.Group();
  swingBoard.add(board, ...eyes);
  const ropeMat = new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.95, emissive: 0x2a1c0c, emissiveIntensity: 0.4 });
  const ropeGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 1, 6, 1, true).translate(0, -0.5, 0);
  disposables.push(ropeGeo);
  const ropes = [-1, 1].map(() => new THREE.Mesh(ropeGeo, ropeMat));
  const hanger = new THREE.Group();
  hanger.position.set(0, SIGN_TOP, doorZ + 0.012);
  hanger.add(swingBoard, ...ropes);
  hanger.visible = false;
  scene.add(hanger);
  const hookAt = [-1, 1].map(s => new THREE.Vector3(s * HOOK_X, HOOK_Y - SIGN_TOP, 0.029 - 0.012));
  const swingFrom = new THREE.Vector3(0, HOOK_Y - SIGN_TOP, 0);
  const DOWN = new THREE.Vector3(0, -1, 0), eye = new THREE.Vector3(), dir = new THREE.Vector3();
  let signK = 0, shownAt = -1, lastT = null;
  function hang(t, still) {
    const want = api.state === 'closed' && !leaving ? 1 : 0;
    const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    if (want && signK === 0) shownAt = t;
    signK = still ? want : Math.max(0, Math.min(1, signK + (want ? dt / 0.55 : -dt / 0.22)));
    hanger.visible = signK > 0;
    if (!hanger.visible) return;
    // drops in on lengthening ropes and settles with a little overshoot; draws back up when it goes
    const k = want ? 1 + 2.2 * Math.pow(signK - 1, 3) + 1.2 * Math.pow(signK - 1, 2) : signK * signK;
    const since = t - shownAt;
    const theta = still ? 0 : 0.016 * Math.sin(t * 1.3) + 0.007 * Math.sin(t * 2.9 + 1) + 0.1 * Math.exp(-2.2 * since) * Math.sin(4.2 * since);
    const lift = (1 - k) * (HOOK_Y - SIGN_TOP);
    swingBoard.scale.setScalar(Math.max(0.001, k));
    swingBoard.rotation.z = theta;
    // the board turns about the point between the hooks: a pendulum
    swingBoard.position.set(-swingFrom.y * Math.sin(theta), swingFrom.y * (1 - Math.cos(theta)) + lift, 0);
    ropes.forEach((r, i) => {
      eye.set((i ? 1 : -1) * EYE_X, EYE_Y, boardFront).multiplyScalar(swingBoard.scale.x).applyEuler(swingBoard.rotation).add(swingBoard.position);
      dir.subVectors(eye, hookAt[i]);
      const len = Math.max(0.001, dir.length());
      r.position.copy(hookAt[i]);
      r.quaternion.setFromUnitVectors(DOWN, dir.divideScalar(len));
      r.scale.set(1, len, 1);
    });
  }

  let open = 1;                    // 1 = unrolled, 0 = rolled into the scroll
  let anim = null, leaving = null, press = null, pressK = 0;
  const api = {
    state: 'open',                 // open | closed | opening | closing | gone
    get busy() { return !!anim || !!leaving || !!press; },
    get present() { return api.state !== 'gone'; },
    // screen layout for the page's text and buttons over the paper, and the sign's tap area (CSS px)
    layout(camera, w, h) {
      if (!pivot.visible) return null;
      // asked for before the first frame too: bring the matrices up to date rather than trust the last render
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      pivot.updateWorldMatrix(true, false);
      const screen = v => { v.project(camera); return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h }; };
      const pt = (x, y, zz = 0.02) => screen(pivot.localToWorld(new THREE.Vector3(x, y, zz)));
      const rect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
      const page = rect(pt(-LETTER_W / 2, 0), pt(LETTER_W / 2, -LETTER_H));
      const start = rect(pt(-BTN_W / 2, -BTN_Y + BTN_H / 2, BTN_Z), pt(BTN_W / 2, -BTN_Y - BTN_H / 2, BTN_Z));
      // the sign where it rests, not where it swings
      const sign = rect(screen(new THREE.Vector3(-SIGN_W / 2, SIGN_TOP, doorZ + 0.05)), screen(new THREE.Vector3(SIGN_W / 2, SIGN_TOP - SIGN_H, doorZ + 0.05)));
      return { ...page, start, sign };
    },
    // roll up (to = 0) or unroll (to = 1); resolves when done
    to(target, now, instant) {
      if (api.state === 'gone') return Promise.resolve();
      api.state = target ? 'opening' : 'closing';
      if (instant) { open = target; api.state = target ? 'open' : 'closed'; pose(); return Promise.resolve(); }
      return new Promise(resolve => { anim = { from: open, to: target, t0: now, dur: 0.75, resolve }; });
    },
    // «ابدأ المغامرة» pressed: the parchment sinks into the letter; resolves once it is down
    press(now, instant) {
      if (api.state !== 'open' || instant) return Promise.resolve();
      return new Promise(resolve => { press = { t0: now, resolve }; });
    },
    // where the parchment button is in the world (for the golden sparks)
    startPoint() { btn.updateWorldMatrix(true, false); return btn.localToWorld(new THREE.Vector3(0, 0, 0.02)); },
    // the adventure begins: the sign draws up or the letter rolls up, then the scroll lifts away
    leave(now, instant) {
      if (api.state === 'gone') return Promise.resolve();
      if (instant) { pivot.visible = false; hanger.visible = false; signK = 0; api.state = 'gone'; return Promise.resolve(); }
      const go = () => new Promise(resolve => { leaving = { t0: now + (open > 0 ? 0.6 : signK > 0 ? 0.25 : 0), resolve }; });
      if (open > 0) { anim = { from: open, to: 0, t0: now, dur: 0.6, resolve: () => {} }; }
      return go();
    },
    update(t, still) {
      if (!pivot.visible) return;
      if (anim) {
        const k = Math.min(1, (t - anim.t0) / anim.dur), e = k * k * (3 - 2 * k);
        open = anim.from + (anim.to - anim.from) * e;
        if (k >= 1) { const r = anim.resolve; open = anim.to; anim = null; if (api.state !== 'gone' && !leaving) api.state = open ? 'open' : 'closed'; r(); }
      }
      // pressed in over 0.16 s, held while the letter rolls away, eased back if nothing follows
      if (press) {
        const s = t - press.t0;
        pressK = s < 0.16 ? Math.sin((s / 0.16) * Math.PI / 2) : s < 0.9 ? 1 : Math.max(0, 1 - (s - 0.9) / 0.3);
        if (s >= 0.16 && press.resolve) { const r = press.resolve; press.resolve = null; r(); }
        if (s >= 1.2) { press = null; pressK = 0; }
      }
      pose();
      if (btn.visible && !still) bend(pressK, t * 1.7);
      hang(t, still);
      if (leaving && t >= leaving.t0) {
        const k = Math.min(1, (t - leaving.t0) / 0.5);
        pivot.position.y = LETTER_TOP + k * k * 1.6;
        if (k >= 1) { pivot.visible = false; hanger.visible = false; api.state = 'gone'; const r = leaving.resolve; leaving = null; r(); }
      }
      if (still) return;
      sheet.rotation.z = Math.sin(t * 0.7) * 0.005;
      sheet.rotation.x = Math.sin(t * 0.45 + 1) * 0.01;
    },
  };
  function pose() {
    const left = Math.max(0.0001, open);
    paper.scale.y = left; shadow.scale.y = left;
    paper.visible = shadow.visible = open > 0.01;
    pins.forEach(m => { m.visible = open > 0.08; });
    const r = 0.03 + 0.035 * (1 - open);
    roll.scale.set(1, r, r);
    roll.position.set(0, -LETTER_H * open - (open < 0.01 ? 0.05 : 0), 0.05);
    roll.visible = open < 0.995;
    knobs.forEach((k, i) => { k.visible = roll.visible; k.scale.setScalar(r * 0.95); k.position.set((i ? 1 : -1) * (LETTER_W * 0.485 + r * 0.5), roll.position.y, 0.05); });
    seal.visible = open < 0.12;
    seal.position.set(0, roll.position.y, 0.05 + r + 0.004);
    seal.scale.setScalar(Math.min(1, (0.12 - open) / 0.08));
    // the parchment button rides on the paper as it rolls, and is gone before the roll reaches it
    btn.visible = open > 0.5;
    btn.position.set(0, -BTN_Y * open, BTN_Z - 0.008 * pressK);
    btn.scale.set(1 - 0.02 * pressK, left * (1 - 0.02 * pressK), 1);
    btnShadow.position.set(0.018 - 0.01 * pressK, -0.034 + 0.018 * pressK, -0.016 + 0.006 * pressK);
    btnShadow.material.opacity = 0.55 - 0.25 * pressK;
  }
  pose();
  return api;
}

/* ---------- in the sky while exploring: the countdown under the moon, the verse above it ----------
   Far away like the moon itself — the guest zooms in to read them. Drawn once (the verse) and once a
   second (the countdown), only while they are shown. */
const VERSE = '«ومن آياته أن خلق لكم من أنفسكم أزواجًا لتسكنوا إليها وجعل بينكم مودّةً ورحمة»';
const toArabic = s => String(s).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

function createSkySigns(scene, moon, disposables) {
  const css = getComputedStyle(document.documentElement);
  const calli = css.getPropertyValue('--font-calli').trim() || 'serif';
  const verseFont = css.getPropertyValue('--font-verse').trim() || 'serif';
  const body = css.getPropertyValue('--font-body').trim() || 'sans-serif';
  const sign = (w, h, worldW) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    sp.scale.set(worldW, worldW * h / w, 1);
    sp.renderOrder = 2;
    sp.visible = false;
    scene.add(sp);
    disposables.push(tex);
    return { c, g: c.getContext('2d'), tex, sp };
  };
  const glow = g => { g.shadowColor = 'rgba(214,173,105,.75)'; g.shadowBlur = 26; };
  const verse = sign(1536, 400, 92);
  verse.sp.position.set(moon.x, moon.y + 34, moon.z);
  const count = sign(1536, 620, 74);
  count.sp.position.set(moon.x, moon.y - 32, moon.z);

  let fontsOk = false;
  const drawVerse = () => {
    const { g, c } = verse;
    g.clearRect(0, 0, c.width, c.height);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; glow(g);
    g.fillStyle = '#f4eadd';
    g.font = `400 92px ${verseFont}`;
    // two lines, broken at a word near the middle
    const words = VERSE.split(' '), half = Math.ceil(words.length / 2);
    g.fillText(words.slice(0, half).join(' '), c.width / 2, 140);
    g.fillText(words.slice(half).join(' '), c.width / 2, 270);
    verse.tex.needsUpdate = true;
  };
  const target = weddingInstant();
  let last = '';
  const drawCount = () => {
    const d = Math.max(0, target - Date.now());
    const units = [[Math.floor(d / 86400000), 'يوم'], [Math.floor(d % 86400000 / 3600000), 'ساعة'], [Math.floor(d % 3600000 / 60000), 'دقيقة'], [Math.floor(d % 60000 / 1000), 'ثانية']];
    const key = units.map(u => u[0]).join(':');
    if (key === last) return;
    last = key;
    const { g, c } = count;
    g.clearRect(0, 0, c.width, c.height);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; glow(g);
    g.fillStyle = '#f4eadd';
    g.font = `700 104px ${calli}`;
    g.fillText(d === 0 ? 'لقد حلّ اليوم الموعود' : 'العدّ التنازلي ليوم العمر', c.width / 2, 92);
    g.fillStyle = '#f1d6a5';
    g.font = `400 54px ${body}`;
    g.fillText(WEDDING.dateLabelAr, c.width / 2, 196);
    // days on the right, seconds on the left (RTL), each over its word
    units.forEach(([v, label], i) => {
      const x = c.width / 2 + (1.5 - i) * 330;
      g.fillStyle = '#f4eadd'; g.font = `300 168px ${body}`;
      g.fillText(toArabic(i ? String(v).padStart(2, '0') : v), x, 380);
      g.fillStyle = '#f1d6a5'; g.font = `400 52px ${body}`;
      g.fillText(label, x, 520);
      if (i) { g.fillStyle = '#d6ad69'; g.font = `400 40px ${body}`; g.fillText('✦', x + 165, 372); }
    });
    count.tex.needsUpdate = true;
  };
  let lastT = null;
  return {
    points: { 'sky:moon': moon.clone(), 'sky:verse': verse.sp.position.clone(), 'sky:countdown': count.sp.position.clone() },
    update(on, still, t) {
      const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      if (on && !fontsOk) {
        fontsOk = true;
        Promise.all([document.fonts.load(`400 92px ${verseFont}`, VERSE), document.fonts.load(`700 104px ${calli}`, 'العدّ'), document.fonts.load(`300 168px ${body}`, '٠١٢')])
          .catch(() => {}).then(() => { drawVerse(); last = ''; drawCount(); });
      }
      for (const s of [verse, count]) {
        const want = on ? 1 : 0, m = s.sp.material;
        // fades by time (≈ 0.35 s), not by frames, so a slow phone never leaves them hanging in the sky
        m.opacity = still ? want : m.opacity + Math.sign(want - m.opacity) * Math.min(Math.abs(want - m.opacity), dt * 3);
        s.sp.visible = m.opacity > 0;
      }
      if (on) drawCount();
    },
    get fading() { return [verse, count].some(s => s.sp.visible && s.sp.material.opacity < 1); },
    // 1 while the verse or the countdown is in the picture, easing to 0 as both leave it
    facing(camera) {
      let most = 0;
      for (const s of [verse, count]) {
        const v = s.sp.position.clone().project(camera);
        if (v.z > 1) continue;
        most = Math.max(most, 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(v.x), Math.abs(v.y)), 1, 1.8));
      }
      return most;
    },
  };
}

/* ---------- the garden layer ---------- */
export function createGarden(scene, { materials, bloom, family, found = [], moon, door, canopy }) {
  const { brass, stoneCream, bloomMat, leafGreen, cluster } = materials;
  const glowTex = radialTexture([[0, 'rgba(255,226,170,.95)'], [0.3, 'rgba(255,200,120,.35)'], [1, 'rgba(255,180,90,0)']]);
  const disposables = [glowTex];
  const glowSprite = (scale, opacity, color = 0xffffff) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(scale);
    return s;
  };

  /* hearts: five polished rubies, each with a soft red halo and glints that wink and travel across it */
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(1), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 18 });
  heartGeo.center();
  // deep red, polished, a clear lacquer catching the lanterns and the room light
  const rubyMat = new THREE.MeshPhysicalMaterial({
    color: 0xc4102f, roughness: 0.1, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03,
    specularIntensity: 1, ior: 1.77, sheen: 0.6, sheenColor: new THREE.Color(0xff6b80), sheenRoughness: 0.3,
    emissive: 0x6a0016, emissiveIntensity: 0.6, envMapIntensity: 3.2,
  });
  // a four-pointed glint for the sparkle
  const glintTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,230,235,.6)'); grd.addColorStop(1, 'rgba(255,200,210,0)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(35, 29, 64, 32); g.quadraticCurveTo(35, 35, 32, 64); g.quadraticCurveTo(29, 35, 0, 32); g.quadraticCurveTo(29, 29, 32, 0); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  disposables.push(glintTex);
  const cordMat = new THREE.MeshBasicMaterial({ color: 0xc69a4c });
  // where the winking glints sit on the shoulders (× size); the travelling one sweeps from the left
  // shoulder down across the face towards the point
  const WINKS = [[-0.34, 0.3], [0.4, 0.16]];
  const sweep = u => [-0.5 + 0.86 * u, 0.36 - 0.62 * u + 0.16 * Math.sin(Math.PI * u)];
  const hearts = HEARTS.map((h, i) => {
    const group = new THREE.Group();
    group.position.copy(h.at);
    const mesh = new THREE.Mesh(heartGeo, rubyMat);
    mesh.scale.setScalar(h.size);
    const halo = glowSprite(h.size * 3.4, 0.55 * h.glow, 0xff3a55);
    group.add(halo, mesh);
    const glints = [...WINKS, [0, 0]].map(() => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sp.scale.setScalar(h.size * 0.5);
      group.add(sp);
      return sp;
    });
    if (h.cord) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, h.cord, 3), cordMat);
      cord.position.y = h.cord / 2 + h.size * 0.35;
      group.add(cord);
    }
    scene.add(group);
    const done = found.includes(h.id);
    group.visible = !done;
    return { ...h, group, mesh, halo, glints, phase: i * 1.7, found: done, collecting: null };
  });

  /* game entrances */
  const props = {};
  const faceTo = (obj, spot) => { obj.rotation.y = Math.atan2(spot.face.x - spot.at.x, spot.face.z - spot.at.z); };
  // a signpost: a turned post, an arched walnut board, a lantern hanging from an iron arm
  function signpost(spot, height) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3120, roughness: 0.7 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, height, 10), wood);
    post.position.y = height / 2;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), brass);
    cap.position.y = height + 0.03;
    const tex = signTexture(spot.label, family);
    disposables.push(tex);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.43), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.38, roughness: 0.6, transparent: true, alphaTest: 0.05 }));
    board.position.set(0, height - 0.32, 0.07);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.41, 0.04), wood);
    back.position.set(0, height - 0.32, 0.035);
    // a garland of white blooms along the top of the board
    const blooms = new THREE.InstancedMesh(bloom, bloomMat, 9);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(0, 0.4, 1).normalize());
    for (let i = 0; i < 9; i++) blooms.setMatrixAt(i, m.compose(V(-0.38 + i * 0.095, height - 0.1 + Math.sin(i * 1.3) * 0.015, 0.09), q, V(0.05, 0.05, 0.05)));
    g.add(post, cap, back, board, blooms);
    return g;
  }

  // the quiz: a signpost at the foot of the grand tree
  {
    const spot = GAME_SPOTS.quiz;
    const g = signpost(spot, 1.45);
    const beacon = glowSprite(1.6, 0.35);
    beacon.position.y = 1.15;
    g.add(beacon);
    g.position.copy(spot.at);
    faceTo(g, spot);
    scene.add(g);
    props.quiz = { group: g, center: spot.at.clone().add(V(0, 1.0, 0)), radius: 0.75, beacon };
  }

  // the penalty challenge: a small goal dressed with a garland, a cartoon ball, a sign
  {
    const spot = GAME_SPOTS.penalty;
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf6eee2, roughness: 0.5 });
    const W = 1.5, H = 0.95;
    const goal = new THREE.Group();
    [[-W / 2, H / 2, 0, 0], [W / 2, H / 2, 0, 0]].forEach(([x, y]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, H, 10), white);
      p.position.set(x, y, 0);
      goal.add(p);
    });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, W + 0.07, 10).rotateZ(Math.PI / 2), white);
    bar.position.y = H;
    goal.add(bar);
    // the net: a fine lattice drawn as lines
    const net = [];
    for (let i = 0; i <= 10; i++) { const x = -W / 2 + (i / 10) * W; net.push(x, 0, -0.45, x, H, -0.08); }
    for (let j = 0; j <= 6; j++) { const y = (j / 6) * H, z = -0.45 + (j / 6) * 0.37; net.push(-W / 2, y, z, W / 2, y, z); }
    const netGeo = new THREE.BufferGeometry();
    netGeo.setAttribute('position', new THREE.Float32BufferAttribute(net, 3));
    goal.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xf6eee2, transparent: true, opacity: 0.45 })));
    // garland on the crossbar
    const blooms = new THREE.InstancedMesh(bloom, bloomMat, 11);
    const leaves = new THREE.InstancedMesh(cluster, leafGreen, 11);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < 11; i++) {
      const x = -W / 2 + (i / 10) * W;
      leaves.setMatrixAt(i, m.compose(V(x, H + 0.02, 0.02), q.identity(), V(0.08, 0.06, 0.06)));
      leaves.setColorAt(i, new THREE.Color(['#24391f', '#2c4426', '#33492a'][i % 3]));
      blooms.setMatrixAt(i, m.compose(V(x + 0.05, H + 0.05, 0.07), q.setFromUnitVectors(V(0, 1, 0), V(0, 0.5, 1).normalize()), V(0.055, 0.055, 0.055)));
    }
    goal.add(leaves, blooms);
    goal.position.set(0.25, 0, -0.75);
    const ballTex = ballTexture();
    disposables.push(ballTex);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45, emissive: 0x3a3226, emissiveIntensity: 0.4 }));
    ball.position.set(-0.05, 0.17, 0.25);
    const sign = signpost(spot, 1.15);
    sign.position.set(-0.85, 0, 0.15);
    sign.scale.setScalar(0.85);
    const beacon = glowSprite(1.8, 0.32);
    beacon.position.set(0, 0.6, 0);
    g.add(goal, ball, sign, beacon);
    g.position.copy(spot.at);
    faceTo(g, spot);
    scene.add(g);
    props.penalty = { group: g, center: spot.at.clone().add(V(0, 0.45, 0)), radius: 1.0, beacon, ball };
  }

  // write your wish: an open book glowing on a stone plinth, sparks rising from its pages, a sign
  {
    const spot = GAME_SPOTS.wish;
    const g = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.LatheGeometry([
      [0, 0], [0.26, 0], [0.26, 0.07], [0.16, 0.14], [0.13, 0.62], [0.24, 0.7], [0.27, 0.78], [0, 0.78],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 20), stoneCream);
    const pageTex = bookTexture();
    disposables.push(pageTex);
    const book = new THREE.Group();
    const cover = new THREE.MeshStandardMaterial({ color: 0x1a2a5c, roughness: 0.5, metalness: 0.2 });
    const pages = new THREE.MeshStandardMaterial({ map: pageTex, emissiveMap: pageTex, emissive: 0xffe2a8, emissiveIntensity: 0.9, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const half = new THREE.Group();
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.34), cover);
      c.position.x = s * 0.13;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.32), pages);
      p.position.set(s * 0.125, 0.02, 0);
      half.add(c, p);
      half.rotation.z = -s * 0.16;
      book.add(half);
    }
    // a gold ribbon marker
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.004, 0.24), brass);
    ribbon.position.set(0.02, 0.03, 0.2);
    book.add(ribbon);
    book.position.y = 0.82;
    book.rotation.x = -0.25;
    const glow = glowSprite(1.1, 0.85);
    glow.position.y = 0.95;
    // a small wishing lantern floating above the book
    const lantern = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd08a, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    const flame = glowSprite(0.42, 0.9);
    lantern.add(paper, flame);
    lantern.position.y = 1.45;
    const sign = signpost(spot, 1.15);
    sign.position.set(0.62, 0, 0.12);
    sign.rotation.y = -0.35;
    sign.scale.setScalar(0.85);
    g.add(plinth, book, glow, lantern, sign);
    g.position.copy(spot.at);
    faceTo(g, spot);
    scene.add(g);
    props.wish = { group: g, center: spot.at.clone().add(V(0, 0.9, 0)), radius: 0.8, beacon: glow, lantern };
  }

  const poster = createLetter(scene, { brass, disposables, family, door });
  const sky = moon ? createSkySigns(scene, moon, disposables) : null;

  /* ---------- exploring, zoomed in on the verse or the countdown: the trees in between turn see-through ----------
     A twin of the canopy shares its geometry and its instances but draws see-through, after the sky
     signs; it stands in for the canopy only while it fades, so the trees are untouched otherwise. */
  const ghost = canopy ? (() => {
    const mat = canopy.material.clone();
    mat.onBeforeCompile = canopy.material.onBeforeCompile;        // the same moonlit rim
    mat.customProgramCacheKey = canopy.material.customProgramCacheKey;
    mat.transparent = true;
    disposables.push(mat);
    const m = new THREE.InstancedMesh(canopy.geometry, mat, canopy.count);
    m.instanceMatrix = canopy.instanceMatrix;
    m.instanceColor = canopy.instanceColor;
    m.renderOrder = 3;
    m.visible = false;
    scene.add(m);
    return m;
  })() : null;
  let see = 0, seeWant = 0;        // 0 = the trees as they are, 1 = as see-through as they get
  function fadeTrees(beacon, still, dt) {
    if (!ghost) return;
    const want = beacon && sky ? THREE.MathUtils.smoothstep(beacon.zoom, 1.15, 1.9) * sky.facing(beacon.camera) : 0;
    seeWant = want;
    see = still ? want : see + Math.sign(want - see) * Math.min(Math.abs(want - see), dt * 2.5);
    const on = see > 0.002;
    // swap only on a change, so the door's own showing and hiding of the garden is left alone
    if (on !== ghost.visible) { ghost.visible = on; canopy.visible = !on; }
    ghost.material.opacity = 1 - 0.8 * see;
  }

  /* ---------- picking in screen space: a small heart still gets a finger-sized target ---------- */
  const tmp = new THREE.Vector3();
  function screenOf(p, camera, w, h) {
    tmp.copy(p).project(camera);
    return { x: (tmp.x + 1) / 2 * w, y: (1 - tmp.y) / 2 * h, front: tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 };
  }
  function pxRadius(center, r, camera, h) {
    const d = center.distanceTo(camera.position);
    return (r / (d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * (h / 2);
  }
  function pick(x, y, camera, w, h) {
    let best = null, bestD = Infinity;
    const test = (hit, center, r, minPx) => {
      if (!center) return;
      const s = screenOf(center, camera, w, h);
      if (!s.front) return;
      const d = Math.hypot(s.x - x, s.y - y), reach = Math.max(minPx, pxRadius(center, r, camera, h) * 1.15);
      if (d <= reach && d < bestD) { bestD = d; best = hit; }
    };
    hearts.forEach(hh => {
      if (!hh.found && hh.group.visible && hh.mesh.visible) test({ kind: 'heart', id: hh.id }, hh.group.position, hh.size * 0.7, 30);
    });
    for (const [id, p] of Object.entries(props)) if (p.group.visible) test({ kind: 'game', id }, p.center, p.radius, 34);
    return best;
  }

  /* ---------- a found heart turns into golden sparks ---------- */
  function collect(id, now) {
    const hh = hearts.find(x => x.id === id);
    if (!hh || hh.found) return null;
    hh.found = true;
    hh.collecting = now;
    return hh;
  }

  const exploreHalo = glowSprite(1, 0, 0xffd6df);          // template material for the explore beacons
  disposables.push(exploreHalo.material);
  hearts.forEach(hh => {
    hh.beacon = new THREE.Sprite(exploreHalo.material.clone());
    hh.beacon.visible = false;
    hh.group.add(hh.beacon);
  });
  // a glint on the face of its heart: in front of the surface, riding the heart's bob
  function placeGlint(hh, g, gx, gy) { g.position.set(gx * hh.size * 1.6, gy * hh.size * 1.6 + hh.mesh.position.y, hh.size * 0.4); }

  let lastT = null;
  function update(t, reducedMotion, beacon = null) {
    const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    poster.update(t, reducedMotion);
    fadeTrees(beacon, reducedMotion, dt);
    sky?.update(!!beacon, reducedMotion, t);
    hearts.forEach(hh => {
      if (!hh.group.visible) return;
      // exploring: a glow of a fixed on-screen size marks every heart still hidden in the garden
      hh.beacon.visible = !!beacon && !hh.found;
      if (hh.beacon.visible) {
        const d = hh.group.position.distanceTo(beacon.from);
        hh.beacon.scale.setScalar(beacon.px * beacon.metresPerPx * d);
        hh.beacon.material.opacity = reducedMotion ? 0.8 : 0.6 + 0.3 * Math.sin(t * 2.6 + hh.phase);
      }
      if (hh.collecting !== null) {
        const k = Math.min(1, (t - hh.collecting) / 0.45);
        hh.mesh.scale.setScalar(hh.size * (1 + k * 0.8));
        hh.halo.material.opacity = 0.55 * (1 - k);
        hh.mesh.visible = k < 0.6;
        if (k >= 1 || reducedMotion) hh.group.visible = false;
        return;
      }
      if (reducedMotion) {
        hh.glints.forEach((g, k) => { placeGlint(hh, g, ...(WINKS[k] || sweep(0.4))); g.material.opacity = k === 0 ? 0.8 : 0; });
        return;
      }
      hh.mesh.rotation.y = Math.sin(t * 0.9 + hh.phase) * 0.45;
      hh.mesh.position.y = Math.sin(t * 1.3 + hh.phase) * hh.size * (hh.float ? 0.08 : 0.18);
      // each ruby breathes a red glow, winks its shoulder glints in turn, and every few seconds a
      // glint runs across its face
      hh.halo.material.opacity = (0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + hh.phase))) * hh.glow;
      hh.glints.forEach((g, k) => {
        if (k < WINKS.length) {
          placeGlint(hh, g, ...WINKS[k]);
          g.material.opacity = Math.pow(Math.max(0, Math.sin(t * 1.9 - k * 2.1 + hh.phase)), 6);
        } else {
          const u = (((t + hh.phase * 1.3) / 3.4) % 1) / 0.36;      // runs for 1.2 s of every 3.4 s
          g.material.opacity = u < 1 ? Math.pow(Math.sin(Math.PI * u), 1.5) : 0;
          if (u < 1) placeGlint(hh, g, ...sweep(u));
        }
        g.material.rotation = t * 0.6 + k;
      });
    });
    if (reducedMotion) return;
    for (const p of Object.values(props)) p.beacon.material.opacity = (p.beacon.userData.base ??= p.beacon.material.opacity) * (0.8 + 0.2 * Math.sin(t * 1.6));
    props.wish.lantern.position.y = 1.45 + Math.sin(t * 0.9) * 0.05;
    props.penalty.ball.rotation.y = t * 0.4;
  }

  const animating = () => hearts.some(hh => hh.collecting !== null && hh.group.visible) || poster.busy || !!sky?.fading || (!!ghost && Math.abs(see - seeWant) > 0.002);

  return {
    hearts, props, poster, sky, pick, collect, update, animating, screenOf,
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}
