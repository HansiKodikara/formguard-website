import { useEffect, useRef, useState } from "react";
import type { HowState } from "../viz/how";
import { frameFor, frameUrl, SQUAT } from "../viz/squatFrames";

/**
 * The rendered squat for 'How it works', on the page's own background (the frames are transparent). Scrolling picks
 * the frame for the moment and a canvas draws it; frames preload as the section comes near, and until one is in,
 * the nearest loaded frame stands in. The feet never move,
 * so the contact shadow is drawn once under them. When the knee caves, a hairline ring marks the left knee, as the
 * sensor callouts on the hero model do: ink on this light page, no glow.
 */
type St = Pick<HowState, "step" | "phase" | "depth" | "rep" | "flag" | "buzz">;

const [fx0, fx1, fy0, fy1] = SQUAT.floor;
/** a soft ellipse under the feet */
function FloorShadow() {
  const cx = (fx0 + fx1) / 2, cy = fy1 - (fy1 - fy0) * 0.25, w = (fx1 - fx0) * 1.45, h = (fy1 - fy0) * 0.9;
  return (
    <div aria-hidden className="pointer-events-none absolute rounded-[50%]"
      style={{ left: `${(cx - w / 2) * 100}%`, top: `${(cy - h / 2) * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
        background: "radial-gradient(closest-side, rgb(27 26 23 / 0.32), rgb(27 26 23 / 0.12) 55%, transparent)" }} />
  );
}

function KneeMark({ frame, on, buzz }: { frame: number; on: boolean; buzz: number }) {
  const [x, y] = SQUAT.kneeL[frame - 1];
  return (
    <svg aria-hidden viewBox="0 0 300 400" preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full text-[var(--ink)] transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}>
      <g transform={`translate(${x * 300} ${y * 400})`} stroke="currentColor" fill="none" vectorEffect="non-scaling-stroke">
        <circle r="13" strokeWidth="1.2" />
        <circle r="20" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" className="motion-safe:animate-[spin_8s_linear_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        {buzz > 0 && <circle r="20" strokeWidth="1" className="motion-safe:animate-[fg-ripple_900ms_ease-out_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
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
      style={{ left: `${(x + 84 / 300) * 100}%`, top: `${(y - 26 / 400) * 100}%`, transform: "translateY(-50%)", color: "var(--ink)" }}>
      Knee · L
    </span>
  );
}

const label = (st: St) => `Rendered: a lifter in the FormGuard suit doing a back squat${st.rep === 7 && st.flag ? ", the left knee caving in" : ""}.`;

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
      imgs.current = new Array(SQUAT.frames + 1).fill(null);
      for (let f = 1; f <= SQUAT.frames; f++) {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => { imgs.current[f] = im; setReady((n) => n + 1); };
        im.src = frameUrl(f, w);
      }
    }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // draw the nearest frame (or the nearest one that has loaded). Not a cross-fade: mid-drive the hips move ~6 cm
  // between frames, and blending two poses that far apart reads as a double exposure. The section eases its
  // progress towards the scroll, so a scroll still steps through every frame in turn.
  useEffect(() => {
    const c = canvas.current, el = box.current;
    if (!c || !el) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let im: HTMLImageElement | null = null;
    for (let k = 0; k < SQUAT.frames && !im; k++) im = imgs.current[frame - k] || imgs.current[frame + k] || null;
    if (!im) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(el.clientWidth * dpr), H = Math.round(el.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(im, 0, 0, W, H);
  }, [frame, ready]);

  return (
    <div ref={box} className={`relative aspect-[3/4] ${className}`}>
      <FloorShadow />
      <canvas ref={canvas} role="img" className="absolute inset-0 h-full w-full" aria-label={label(st)} />
      <KneeMark frame={frame} on={st.flag} buzz={st.buzz} />
      <KneeLabel frame={frame} on={st.flag} />
    </div>
  );
}

/** One still frame (mobile, reduced motion). */
export function SquatStill({ st, className = "" }: { st: St; className?: string }) {
  const f = frameFor(st);
  return (
    <div className={`relative aspect-[3/4] ${className}`}>
      <FloorShadow />
      <img src={frameUrl(f, 450)} srcSet={`${frameUrl(f, 450)} 450w, ${frameUrl(f, 720)} 720w`} sizes="(min-width: 768px) 40vw, 92vw"
        width={900} height={1200} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full" alt={label(st)} />
      <KneeMark frame={f} on={st.flag} buzz={0} />
      <KneeLabel frame={f} on={st.flag} />
    </div>
  );
}
