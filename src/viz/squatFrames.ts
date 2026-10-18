/**
 * The rendered squat (suit-render/squat-video): which frame shows a moment of the 'How it works' story.
 * Frames 1-37 are a clean rep, 38-74 the same rep with the left knee caving (the site's rep 7). Both passes share
 * the render's depth curve, sin^2(pi p) with p 0..1 over the rep (0.5 = bottom), so a moment is matched by its
 * squat depth and whether the lifter is going down or up. kneeL: the left knee in each frame (0-1, y down).
 */
import DATA from "./squatFrames.json";
import type { HowState } from "./how";

export const SQUAT = DATA as {
  frames: number; clean: [number, number]; cave: [number, number]; size: [number, number];
  /** the feet's box (x0, x1, y0, y1; 0-1, y down), for the contact shadow: they never move */
  floor: [number, number, number, number];
  kneeL: [number, number][];
};
const PER_REP = SQUAT.clean[1] - SQUAT.clean[0];          // 36 steps per rep

/** The frame for a moment, fractional: the player blends the two frames either side, so the motion is continuous. */
export function frameExact(st: Pick<HowState, "step" | "phase" | "depth" | "rep">) {
  if (st.step === 0 || st.step === 4) return 1;            // standing: suiting up / between sets
  const d = Math.min(1, Math.max(0, st.depth));
  const half = Math.asin(Math.sqrt(d)) / Math.PI;          // 0..0.5: the render's own phase at this depth
  const p = st.phase < 0.535 ? half : 1 - half;            // the site's bottom runs 0.5-0.57
  const first = st.rep === 7 ? SQUAT.cave[0] : SQUAT.clean[0];
  return first + p * PER_REP;
}
export const frameFor = (st: Pick<HowState, "step" | "phase" | "depth" | "rep">) => Math.round(frameExact(st));

export const frameUrl = (f: number, w: 720 | 450) => `/squat/${w}-${String(f).padStart(3, "0")}.webp`;
