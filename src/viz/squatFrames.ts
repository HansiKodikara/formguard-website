/**
 * The rendered squat (suit-render/squat-video): which frame shows a moment of the 'How it works' story.
 *
 * The render is one take along the scroll: the lifter does the story's reps while the camera moves round him and in
 * on the knees, as the earlier real-time lifter's camera did. Frame i shows scroll progress p[i]; frames sit closer
 * together where the lifter moves fast. floor: the feet's shadow ellipse in each frame; kneeL: the left knee in
 * each frame (both 0-1 of the frame, y down).
 */
import DATA from "./squatFrames.json";
import type { HowState } from "./how";

export const SQUAT = DATA as {
  frames: number; size: [number, number]; p: number[];
  floor: [number, number, number, number][];
  kneeL: [number, number][];
};

/** The frame (1-based) for scroll progress p: the nearest one. */
export function frameAt(p: number) {
  const P = SQUAT.p;
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (P[mid] <= p) lo = mid; else hi = mid;
  }
  return (p - P[lo] <= P[hi] - p ? lo : hi) + 1;
}

/** Scroll progress of a story state. */
export const progressOf = (st: Pick<HowState, "step" | "local">) => (st.step + st.local) / 5;

// ---- the render's motion library (render_squat.py poses the lifter from it; scripts/squat-timeline.mjs) ----
const CLEAN = 1, CAVE = 38, PER_REP = 36;      // frames 1-37 a clean rep, 38-74 the rep where the left knee caves

/** Which moment of the motion library a story state shows, fractional. The library's depth curve is
 * sin^2(pi p), p 0..1 over the rep (0.5 = bottom), so a moment is matched by its depth and whether the lifter is
 * going down or up. */
export function frameExact(st: Pick<HowState, "step" | "phase" | "depth" | "rep">) {
  if (st.step === 0 || st.step === 4) return 1;            // standing: suiting up / between sets
  const d = Math.min(1, Math.max(0, st.depth));
  const half = Math.asin(Math.sqrt(d)) / Math.PI;          // 0..0.5: the render's own phase at this depth
  const p = st.phase < 0.535 ? half : 1 - half;            // the site's bottom runs 0.5-0.57
  return (st.rep === 7 ? CAVE : CLEAN) + p * PER_REP;
}

export const frameUrl = (f: number, w: 720 | 450) => `/squat/${w}-${String(f).padStart(3, "0")}.webp`;
