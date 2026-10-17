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
