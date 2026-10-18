import { useEffect, useRef, useState } from "react";
import type { HowState } from "../viz/how";
import { frameFor, frameUrl, SQUAT } from "../viz/squatFrames";

/**
 * The rendered squat for 'How it works': the frame for the current moment of the story, drawn on a canvas so
 * scrolling scrubs it (frames preload when the section comes near; until a frame is in, the nearest loaded one
 * stands in). When the knee caves, a hairline ring marks the left knee, as the sensor callouts on the hero model
 * do: chalk, no glow. On Iron, the render's own studio colour.
 */
type St = Pick<HowState, "step" | "phase" | "depth" | "rep" | "flag" | "buzz">;

function KneeMark({ frame, on, buzz }: { frame: number; on: boolean; buzz: number }) {
  const [x, y] = SQUAT.kneeL[frame - 1];
  return (
    <svg aria-hidden viewBox="0 0 300 400" preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}>
      <g transform={`translate(${x * 300} ${y * 400})`} stroke="var(--color-chalk)" fill="none" vectorEffect="non-scaling-stroke">
        <circle r="13" strokeWidth="1.2" />
        <circle r="20" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" className="motion-safe:animate-[spin_8s_linear_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        {buzz > 0 && <circle r="20" strokeWidth="1" opacity={0.7 * (1 - buzz)} className="motion-safe:animate-[fg-ripple_900ms_ease-out_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
        <path d="M 20 -4 L 46 -26 L 82 -26" strokeWidth="1" />
      </g>
    </svg>
  );
}

function KneeLabel({ frame, on }: { frame: number; on: boolean }) {
  const [x, y] = SQUAT.kneeL[frame - 1];
  // at the end of the leader (84, -26 in the mark's 300 x 400 units)
  return (
    <span aria-hidden className={`fg-callout transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}
      style={{ left: `${(x + 84 / 300) * 100}%`, top: `${(y - 26 / 400) * 100}%`, transform: "translateY(-50%)" }}>
      Knee · L
    </span>
  );
}

/** Scroll-scrubbed: every frame preloaded, drawn on a canvas. */
export function SquatView({ st, className = "" }: { st: St; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<(HTMLImageElement | null)[]>([]);
  const [ready, setReady] = useState(0);              // bumps as frames arrive, to redraw
  const frame = frameFor(st);

  // preload every frame once the section is near
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const w = el.clientWidth * (window.devicePixelRatio || 1) > 520 ? 720 : 450;
      // the frames nearest the start of the story first
      const order = Array.from({ length: SQUAT.frames }, (_, i) => i + 1);
      imgs.current = new Array(SQUAT.frames + 1).fill(null);
      for (const f of order) {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => { imgs.current[f] = im; setReady((n) => n + 1); };
        im.src = frameUrl(f, w);
      }
    }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // draw the frame (or the nearest one that has loaded)
  useEffect(() => {
    const c = canvas.current, el = box.current;
    if (!c || !el) return;
    let im: HTMLImageElement | null = null;
    for (let k = 0; k < SQUAT.frames && !im; k++) im = imgs.current[frame - k] || imgs.current[frame + k] || null;
    if (!im) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(el.clientWidth * dpr), H = Math.round(el.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    c.getContext("2d")?.drawImage(im, 0, 0, W, H);
  }, [frame, ready]);

  return (
    <div ref={box} className={`surface-iron relative aspect-[3/4] overflow-hidden rounded-md ${className}`}>
      <canvas ref={canvas} role="img" className="absolute inset-0 h-full w-full"
        aria-label={`Rendered: a lifter in the FormGuard suit doing a back squat${st.rep === 7 && st.flag ? ", the left knee caving in" : ""}.`} />
      <KneeMark frame={frame} on={st.flag} buzz={st.buzz} />
      <KneeLabel frame={frame} on={st.flag} />
    </div>
  );
}

/** One still frame (mobile, reduced motion). */
export function SquatStill({ st, className = "" }: { st: St; className?: string }) {
  const f = frameFor(st);
  return (
    <div className={`surface-iron relative aspect-[3/4] overflow-hidden rounded-md ${className}`}>
      <img src={frameUrl(f, 450)} srcSet={`${frameUrl(f, 450)} 450w, ${frameUrl(f, 720)} 720w`} sizes="(min-width: 768px) 40vw, 92vw"
        width={900} height={1200} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full"
        alt={`Rendered: a lifter in the FormGuard suit doing a back squat${st.rep === 7 && st.flag ? ", the left knee caving in" : ""}.`} />
      <KneeMark frame={f} on={st.flag} buzz={0} />
      <KneeLabel frame={f} on={st.flag} />
    </div>
  );
}
