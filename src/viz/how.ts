/**
 * How it works, as a function of scroll progress (0..1 across five steps):
 *  0 the suit — joints come online      1 warm-up — "your normal" forms
 *  2 every rep checked — rep 7 caves    3 told mid-set — buzz at the knee, rep 8 clean
 *  4 between sets — the app's summary
 * Deterministic, so any moment can also be drawn as a still (mobile, reduced motion).
 */
import { smooth, squatDepth, valgusCurve } from "./lift";

export function stepOf(p: number) {
  const x = Math.min(4.999, Math.max(0, p * 5));
  const step = Math.floor(x);
  return { step, local: x - step };
}

export const VALGUS = 12;

export function howPose(p: number) {
  const { step, local } = stepOf(p);
  let phase = 0, depth = 0, valgus = 0, rep = 0, flag = false, good = false, buzz = 0, ghost = 0, overlay = 0, nodes = 1;
  if (step === 0) {
    nodes = smooth(0.05, 0.85, local);
  } else if (step === 1) {
    phase = (local * 2) % 1;
    depth = squatDepth(phase);
    ghost = smooth(0.0, 0.7, local);
    rep = 1 + Math.floor(local * 2);
  } else if (step === 2) {
    ghost = 1;
    overlay = smooth(0, 0.25, local);
    if (local < 0.42) {
      phase = local / 0.42;
      depth = squatDepth(phase);                   // rep 6: clean
      rep = 6;
    } else {
      const ph = ((local - 0.42) / 0.58) * 0.62;    // rep 7: down, then the knees cave as the drive starts
      phase = ph;
      depth = squatDepth(ph);
      valgus = valgusCurve(ph, VALGUS);
      rep = 7;
    }
    flag = valgus > 4;
  } else if (step === 3) {
    ghost = 1; overlay = 1;
    if (local < 0.3) {
      // still at the bottom of rep 7: the buzz at the knee, the cue in the ear
      phase = 0.62 + (local / 0.3) * 0.04;
      depth = squatDepth(phase);
      valgus = VALGUS;
      buzz = smooth(0, 0.06, local) * (1 - smooth(0.26, 0.3, local));
      flag = true; rep = 7;
    } else if (local < 0.55) {
      // the drive finishes with the knees pushed back out
      const k = (local - 0.3) / 0.25;
      phase = 0.66 + k * 0.22;
      depth = squatDepth(phase);
      valgus = VALGUS * (1 - smooth(0, 0.6, k));
      flag = valgus > 4; good = !flag; rep = 7;
    } else {
      phase = (local - 0.55) / 0.45;
      depth = squatDepth(phase);                   // rep 8: clean
      good = true; rep = 8;
    }
  } else {
    overlay = 1 - smooth(0.1, 0.5, local);
    ghost = 1 - smooth(0.1, 0.5, local);
    rep = 8; phase = 1;
  }
  return { step, local, phase, depth, valgus, rep, flag, good, buzz, ghost, overlay, nodes };
}
export type HowState = ReturnType<typeof howPose>;
