/**
 * The rendered squat (suit-render/squat-video): a 30 fps video of the whole 'How it works' story, 26 s, in which
 * the camera moves round the lifter and in on his knees. The video's time is the story's clock: progress p = time /
 * duration. kneeL: the left knee in each frame (0-1 of the frame, y down), for the knee callout.
 */
import DATA from "./squatFrames.json";
import type { HowState } from "./how";

export const SQUAT = DATA as { fps: number; frames: number; size: [number, number]; kneeL: [number, number][] };

export const VIDEO_URL = "/squat/squat.mp4";
/** the key moment of steps 1-4 as stills (phones, reduced motion); step 1's is also the video's poster */
export const stillUrl = (step: number) => `/squat/still-${step}.webp`;

/** The video frame (1-based) showing scroll... story progress p. */
export const frameAt = (p: number) => Math.min(SQUAT.frames, Math.max(1, Math.round(p * (SQUAT.frames - 1)) + 1));

/** Story progress of a story state. */
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
