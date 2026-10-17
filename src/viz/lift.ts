/** Hand-keyed rep timing. Every curve is a function of phase in [0, 1), so a section can scrub or play. */
import { useEffect, useRef, useState } from "react";

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

export const breath = (t: number) => Math.sin((t / 4.2) * Math.PI * 2);

/** Rep index and phase at time t for a given period. */
export function repAt(t: number, period: number) {
  const x = Math.max(0, t) / period;
  return { index: Math.floor(x), phase: x - Math.floor(x) };
}

/** No two reps alike: each rep's depth, 0.95–1 of the target, from the rep's index. */
export function repDepth(index: number) {
  const x = Math.sin((index + 1) * 78.233) * 43758.5453;
  return 0.95 + 0.05 * (x - Math.floor(x));
}

/**
 * A clock in seconds that runs while `playing` and the element is on screen, at the display's frame rate.
 * Returns the time; re-renders each frame only while running.
 */
export function useClock(playing: boolean, target: React.RefObject<Element | null>) {
  const [t, setT] = useState(0);
  const visible = useRef(true);
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible.current) setT((x) => x + dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return t;
}

/** True when the visitor asked for less motion. */
export function useReducedMotion() {
  const [reduced, set] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => set(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
