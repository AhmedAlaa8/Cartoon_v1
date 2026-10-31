/* Easing helpers for the camera rig and the door sequence. */
export const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const range = (p, from, to) => clamp((p - from) / (to - from));
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);

export function phases(p) {
  return {
    unlock: easeOut(range(p, 0, 0.12)),              // dial turns, light leaks through the seam
    dialFade: range(p, 0.1, 0.16),
    swing: easeInOut(range(p, 0.1, 0.62)),           // leaves rotate on their hinges
    enter: easeInOut(range(p, 0.5, 0.96)),           // the camera walks through the doorway
    leak: range(p, 0.12, 0.3),
  };
}
