/** Hand-keyed rep timing. Every curve is a function of phase in [0, 1), so scenes can scrub or play. */
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const sine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));

/** One squat rep: brace, controlled descent, pause, faster drive, lockout. Returns depth 0..1. */
export function squatDepth(phase: number) {
  const p = phase - Math.floor(phase);
  if (p < 0.08) return 0;
  if (p < 0.5) return sine((p - 0.08) / 0.42);
  if (p < 0.57) return 1;
  if (p < 0.86) return 1 - sine((p - 0.57) / 0.29) ** 0.92;
  return 0;
}

/** Knees caving: grows through the bottom and the drive, recovers at lockout. */
export function valgusCurve(phase: number, peak: number) {
  const p = phase - Math.floor(phase);
  return peak * smooth(0.38, 0.6, p) * (1 - smooth(0.8, 0.95, p));
}

/** One curl rep. `range` 1 = full (10° → 145°), 0.7 = the partial rep. Returns elbow flexion in degrees. */
export function curlFlex(phase: number, range = 1) {
  const p = phase - Math.floor(phase);
  const up = p < 0.06 ? 0 : p < 0.44 ? sine((p - 0.06) / 0.38) : p < 0.54 ? 1 : p < 0.94 ? 1 - sine((p - 0.54) / 0.4) : 0;
  return 10 + 135 * range * up;
}

/** One bench rep from lockout: lower to the chest, touch, press. Returns press 1 (lockout) .. 0 (chest). */
export function benchPress(phase: number) {
  const p = phase - Math.floor(phase);
  if (p < 0.1) return 1;
  if (p < 0.5) return 1 - sine((p - 0.1) / 0.4);
  if (p < 0.56) return 0;
  if (p < 0.88) return sine((p - 0.56) / 0.32);
  return 1;
}

export const breath = (t: number) => Math.sin((t / 4.2) * Math.PI * 2);

/** Rep index and phase at time t for a given period. */
export function repAt(t: number, period: number) {
  const x = Math.max(0, t) / period;
  return { index: Math.floor(x), phase: x - Math.floor(x) };
}

// ── life: what a body does between and around the reps ──────────────────────────────────

/** Slow, layered drift: three incommensurate sines, roughly in [−1, 1], never repeating visibly. */
const drift = (t: number, s: number) => Math.sin(t * 0.37 + s) * 0.5 + Math.sin(t * 0.71 + s * 2.1) * 0.3 + Math.sin(t * 1.33 + s * 3.7) * 0.2;

/** Idle movement: the head glances and settles, the weight drifts between the feet. Degrees and metres. */
export function idle(t: number) {
  return {
    head: { yaw: drift(t, 1.3) * 4.5, nod: drift(t * 0.8, 4.1) * 2.2, roll: drift(t * 0.6, 7.7) * 1.6 },
    sway: drift(t * 0.45, 9.2) * 0.011,
  };
}

/** The breath through one squat rep (same phase as squatDepth): a big inhale and brace at the top, held
 *  through the descent and the bottom, let out on the drive. −0.6 is resting, 1.4 is fully braced. */
export function braceBreath(phase: number) {
  const p = phase - Math.floor(phase);
  if (p < 0.08) return -0.6 + 2 * sine(p / 0.08);
  if (p < 0.6) return 1.4 - 0.15 * ((p - 0.08) / 0.52);
  if (p < 0.86) return 1.25 - 1.85 * sine((p - 0.6) / 0.26);
  return -0.6;
}

/** No two reps alike: each rep's depth, 0.95–1 of the target, from the rep's index. */
export function repDepth(index: number) {
  const x = Math.sin((index + 1) * 78.233) * 43758.5453;
  return 0.95 + 0.05 * (x - Math.floor(x));
}
