/**
 * What the suit reads during a squat, as two channels over one rep (phase 0 → 1):
 *   bend — how far the knee bends, degrees: depth.
 *   cave — how far the left knee travels in toward the midline, degrees: alignment (valgus).
 * "Your normal" is a band around each channel, learnt from the warm-up. A rep is judged against the
 * lifter's own band, not a textbook: a fault is the trace leaving it.
 */
import { squatDepth, valgusCurve } from "./lift";

export type RepParams = {
  /** depth reached, as a share of the lifter's normal (1 = their usual depth) */
  depth: number;
  /** how far the left knee caves at its worst, degrees */
  cave: number;
  /** a per-rep seed, so no two traces are identical */
  seed: number;
};

export const BEND_MAX = 132;
export const CHANNELS = {
  bend: { label: "Knee bend", unit: "°", max: 140 },
  cave: { label: "Left knee in", unit: "°", max: 14 },
} as const;
export type Channel = keyof typeof CHANNELS;

const wobble = (p: number, seed: number) => Math.sin(p * 9.4 + seed * 2.3) * 0.5 + Math.sin(p * 17.1 + seed * 5.1) * 0.25;

export function sample(ch: Channel, r: RepParams, p: number) {
  const d = squatDepth(p);
  if (ch === "bend") return BEND_MAX * d * r.depth + wobble(p, r.seed) * 1.2 * d;
  return 1.1 * d + valgusCurve(p, r.cave) + wobble(p, r.seed + 7) * 0.35 * d;
}

/** The lifter's normal at this point in the rep: [low, high]. */
export function band(ch: Channel, p: number): [number, number] {
  const d = squatDepth(p);
  if (ch === "bend") return [BEND_MAX * d * 0.92 - 1.5, BEND_MAX * d + 3];
  return [0, 1.1 * d + 2.2];
}

export type Fault = { key: "cave" | "depth"; joint: string; cue: string; fix: string };

/** One cue at a time, joint alignment before depth: the same order the suit coaches in. */
export function judge(r: RepParams): Fault | null {
  if (r.cave > 4) return { key: "cave", joint: "Left knee caving", cue: "Knees out.", fix: "Push your knees out over your toes as you stand up." };
  if (r.depth < 0.9) return { key: "depth", joint: "Partial rep", cue: "Full depth.", fix: "Sit down until your hips reach your normal depth, then drive up." };
  return null;
}

/** Is this channel outside the lifter's normal at phase p? */
export const outside = (ch: Channel, r: RepParams, p: number) => {
  const v = sample(ch, r, p), [lo, hi] = band(ch, p);
  return v < lo - 0.5 || v > hi + 0.5;
};
