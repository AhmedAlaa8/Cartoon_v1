/* ================================================================
   The doorway's 2D outlines (arch, leaves, panels), small textures and
   the WebGL probe — shared by the world and the scene.
   Units: the opening is 2 wide (x −1…1), its arch springs at y = HS.
================================================================ */
import * as THREE from 'three';

export const HS = 2.2;                 // spring line of the arch
export const GAP = 0.008;              // half the seam between the leaves
export const LEAF_W = 1 - GAP;

/* ---------- 2D outlines ---------- */

export function arc(cx, cy, r, from, to, n = 40) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = from + (to - from) * (i / n);
    pts.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return pts;
}

// the arched opening, half-width a, from the floor up
export function archOutline(a, bottom = 0) {
  return [new THREE.Vector2(a, bottom), ...arc(0, HS, a, 0, Math.PI), new THREE.Vector2(-a, bottom)];
}

// a U-shaped band around the opening: outer half-width a2, inner a1
export function archBand(a1, a2) {
  return new THREE.Shape([
    new THREE.Vector2(-a2, 0), ...arc(0, HS, a2, Math.PI, 0), new THREE.Vector2(a2, 0),
    new THREE.Vector2(a1, 0), ...arc(0, HS, a1, 0, Math.PI), new THREE.Vector2(-a1, 0),
  ]);
}

// leaf outline in hinge space (hinge at x = 0, seam at x = LEAF_W);
// its top follows the doorway arch, centred on the seam at (1, HS)
export function leafOutline() {
  const top = Math.acos(-GAP);
  return new THREE.Shape([
    new THREE.Vector2(0, 0), new THREE.Vector2(LEAF_W, 0),
    ...arc(1, HS, 1, top, Math.PI),
  ]);
}

// a panel on the leaf; with r it is the concentric arched one
export function panelOutline(x0, x1, y0, { r, y1 }) {
  if (r) {
    const start = Math.acos((x1 - 1) / r);
    return [new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), ...arc(1, HS, r, start, Math.PI, 32)];
  }
  return [new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y0), new THREE.Vector2(x1, y1), new THREE.Vector2(x0, y1)];
}

/* ---------- small textures ---------- */

export function glowTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// vertical wood grain with a couple of knots, drawn once into a canvas
export function woodTexture({ base, dark, light }, seed, anisotropy) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;

  g.fillStyle = base;
  g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 320; i++) {
    const x0 = rnd() * 512, amp = 2 + rnd() * 7, freq = 0.003 + rnd() * 0.009, ph = rnd() * 6.28;
    g.strokeStyle = rnd() > 0.45 ? dark : light;
    g.globalAlpha = 0.06 + rnd() * 0.22;
    g.lineWidth = 0.6 + rnd() * 2.2;
    g.beginPath();
    for (let y = 0; y <= 1024; y += 16) {
      const x = x0 + Math.sin(y * freq + ph) * amp;
      if (y) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }
  for (let k = 0; k < 2; k++) {
    const kx = 60 + rnd() * 392, ky = 120 + rnd() * 780;
    g.strokeStyle = dark;
    for (let r = 3; r < 26; r += 3) {
      g.globalAlpha = 0.35 - r * 0.011;
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(kx, ky, r * 0.55, r * 1.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 0.32);          // shape UVs are in scene units; one image spans ~3 units of height
  tex.anisotropy = anisotropy;
  return tex;
}

export const WOODS = {
  walnut: { base: '#4b2c17', dark: '#24120a', light: '#70472a' },
  oak: { base: '#7a5532', dark: '#43291a', light: '#a07750' },
};

/* ---------- geometry helpers ---------- */

export const extrude = (shape, depth, bevel = 0) => new THREE.ExtrudeGeometry(shape, {
  depth, curveSegments: 1, steps: 1,
  bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
});

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}
