import { useEffect, useState } from "react";
import DATA from "../viz/curlFrames.json";

/**
 * 'How it works', played by scrolling: the rendered lifter's arm (just the arm) curling a dumbbell, twice. Rep 1 is
 * clean, the elbow pinned at his side. On rep 2 the elbow drifts forward as he lifts, and past his normal the suit
 * catches it: the ring at the elbow pulses and the cue appears. The section stays put (sticky) while the page
 * scrolls through the reps, and the story eases towards the scroll position, so it plays as motion, never jumps.
 *
 * 48 rendered frames (suit-render/squat-video, render_squat.py --curl): 1-24 the clean lift, bottom to top; 25-48
 * the faulty one. The way down is the same frames backwards.
 */
const C = DATA as { frames: number; steps: number; size: [number, number]; elbowL: [number, number][] };
const S = C.steps;
const url = (i: number) => `/demo/curl-${String(i).padStart(2, "0")}.webp`;
/** how many screens of scrolling the two reps take */
export const SCREENS = 2.6;
/** past this share of the faulty lift the elbow has drifted out of his normal */
const LIMIT = 0.5;

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The story at scroll progress p: which rep, how far up (0 bottom .. 1 top), and the frame. */
export function moment(p: number) {
  // rep 1: up, a beat at the top, down; a beat at the bottom; rep 2 the same
  const reps = [
    { rep: 1, up: [0.05, 0.22], down: [0.27, 0.43] },
    { rep: 2, up: [0.52, 0.71], down: [0.8, 0.96] },
  ];
  const r = p < 0.475 ? reps[0] : reps[1];
  const lift = p < r.down[0] ? smooth(r.up[0], r.up[1], p) : 1 - smooth(r.down[0], r.down[1], p);
  const frame = (r.rep === 1 ? 1 : S + 1) + Math.round(lift * (S - 1));
  return { rep: r.rep, lift, frame, alert: r.rep === 2 && lift > LIMIT, start: p < 0.04, done: p > 0.965 };
}

const EDGE_FADE = "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)";
const fade = { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" } as const;
const GRAIN = { backgroundImage: "url(/textures/chalk-grain.png)", backgroundSize: "128px", mixBlendMode: "multiply", opacity: 0.22 } as const;

export type Moment = ReturnType<typeof moment>;

/** Progress through a tall track (0 as it pins, 1 as it lets go), eased towards the scroll. */
export function useTrackProgress(track: React.RefObject<HTMLElement | null>, reduced = false) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0, shown = 0, target = 0;
    const read = () => {
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect(), travel = r.height - window.innerHeight;
      target = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
    };
    const tick = () => {
      shown = reduced ? target : shown + (target - shown) * 0.16;
      if (Math.abs(target - shown) < 0.0005) shown = target;
      setP(shown);
      raf = shown === target ? 0 : requestAnimationFrame(tick);
    };
    const onScroll = () => { read(); if (!raf) raf = requestAnimationFrame(tick); };
    read(); shown = target; setP(target);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [track, reduced]);
  return p;
}

/** The arm, the frame for the moment, and the ring at the elbow. */
export function CurlStage({ m, className = "" }: { m: Moment; className?: string }) {
  const [ex, ey] = C.elbowL[m.frame - 1];
  return (
    <div className={`relative aspect-[3/4] ${className}`}>
      <div className="absolute inset-0" style={fade}>
        {Array.from({ length: C.frames }, (_, i) => (
          <img key={i} src={url(i + 1)} width={C.size[0]} height={C.size[1]} alt="" draggable={false} decoding="async"
            className={`absolute inset-0 h-full w-full ${i + 1 === m.frame ? "opacity-100" : "opacity-0"}`} />
        ))}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={GRAIN} />
      </div>
      <span className="sr-only">Rendered: a lifter's arm curling a dumbbell{m.alert ? ", the elbow drifting forward off his side" : ""}.</span>

      {/* the elbow: a hairline ring, as on the hero model; a light line with a thin ink edge, so it reads on the
          black suit and on the page; no glow */}
      <svg aria-hidden viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <g transform={`translate(${ex * 300} ${ey * 400})`} fill="none" opacity={m.alert ? 1 : 0.7} className="transition-opacity duration-300">
          <g stroke="var(--color-iron)" strokeWidth={3} strokeOpacity={0.55}>
            <circle r="14" />
            <path d="M -20 8 L -36 26 L -62 26" />
          </g>
          <g stroke="var(--color-chalk)" strokeWidth={m.alert ? 1.6 : 1.2}>
            <circle r="14" />
            <path d="M -20 8 L -36 26 L -62 26" />
          </g>
          <circle r="20" stroke="var(--color-chalk)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" className="motion-safe:animate-[spin_8s_linear_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          {m.alert && <circle r="14" stroke="var(--color-chalk)" strokeWidth="1.2" className="motion-safe:animate-[fg-buzz_800ms_ease-out_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
        </g>
      </svg>
      {/* at the end of the leader (-66, 26 in the ring's 300 x 400 units): down and to the left, clear of the arm in
          every frame */}
      <span aria-hidden className="fg-callout" style={{ left: `${(ex - 66 / 300) * 100}%`, top: `${(ey + 26 / 400) * 100}%`, transform: "translate(-100%, -50%)", color: "var(--ink)" }}>
        Elbow · L
      </span>
    </div>
  );
}

/** What the suit is saying: in range, the buzz, and after the set the one thing to change. */
export function CurlCue({ m, className = "" }: { m: Moment; className?: string }) {
  return (
    <p aria-live="polite" className={`t-label flex min-h-6 items-center gap-2 transition-colors ${m.alert ? "text-[var(--signal-ink)]" : m.done ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"} ${className}`}>
      {m.alert
        ? <><span aria-hidden className="block size-2 shrink-0 rounded-full bg-current" />Buzz · left elbow drifting forward. Keep it at your side.</>
        : m.done
          ? <><span aria-hidden className="block size-2 shrink-0 rounded-full bg-[var(--signal)]" />Next set · keep your left elbow at your side</>
          : <><span aria-hidden className="block size-2 shrink-0 rounded-full border-[1.5px] border-current" />Rep {m.rep} · in your normal</>}
    </p>
  );
}
