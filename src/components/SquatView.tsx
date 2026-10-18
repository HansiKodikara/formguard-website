import { useEffect, useRef, useState } from "react";
import type { HowState } from "../viz/how";
import { frameAt, frameUrl, progressOf, SQUAT } from "../viz/squatFrames";

/**
 * The rendered squat for 'How it works', on the page's own background (the frames are transparent). Scrolling picks
 * the frame for the moment and a canvas draws it; frames preload as the section comes near, and until one is in,
 * the nearest loaded frame stands in. The camera moves round the lifter and in on his knees as the story goes, so
 * the contact shadow under the feet is placed per frame, and the frame's edges fade into the page (the close shots
 * crop him). When the knee caves, a hairline ring marks the left knee, as the sensor callouts on the hero model do:
 * ink on this light page, no glow.
 */
type St = Pick<HowState, "step" | "local" | "flag" | "buzz">;

/** fade the frame's edges into the page: the close shots crop the lifter and the bar */
const EDGE_FADE = "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent), linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent)";
const fade = { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" } as const;

/** a soft ellipse under the feet */
function FloorShadow({ frame }: { frame: number }) {
  const [fx0, fx1, fy0, fy1] = SQUAT.floor[frame - 1];
  const cx = (fx0 + fx1) / 2, cy = (fy0 + fy1) / 2, w = fx1 - fx0, h = fy1 - fy0;
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

const label = (st: St) => `Rendered: a lifter in the FormGuard suit doing a back squat${st.flag ? ", the left knee caving in" : ""}.`;

/** Scroll-scrubbed: every frame preloaded, drawn on a canvas. */
export function SquatView({ st, className = "" }: { st: St; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<(HTMLImageElement | null)[]>([]);
  const [ready, setReady] = useState(0);              // bumps as frames arrive, to redraw
  const frame = frameAt(progressOf(st));

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
      <div className="absolute inset-0" style={fade}>
        <FloorShadow frame={frame} />
        <canvas ref={canvas} role="img" className="absolute inset-0 h-full w-full" aria-label={label(st)} />
      </div>
      <KneeMark frame={frame} on={st.flag} buzz={st.buzz} />
      <KneeLabel frame={frame} on={st.flag} />
    </div>
  );
}

/** One still frame (mobile, reduced motion). */
export function SquatStill({ st, className = "" }: { st: St; className?: string }) {
  const f = frameAt(progressOf(st));
  return (
    <div className={`relative aspect-[3/4] ${className}`}>
      <div className="absolute inset-0" style={fade}>
      <FloorShadow frame={f} />
      <img src={frameUrl(f, 450)} srcSet={`${frameUrl(f, 450)} 450w, ${frameUrl(f, 720)} 720w`} sizes="(min-width: 768px) 40vw, 92vw"
        width={900} height={1200} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full" alt={label(st)} />
      </div>
      <KneeMark frame={f} on={st.flag} buzz={0} />
      <KneeLabel frame={f} on={st.flag} />
    </div>
  );
}
