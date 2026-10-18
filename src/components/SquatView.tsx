import { forwardRef, useEffect, useRef, useState } from "react";
import type { HowState } from "../viz/how";
import { frameAt, progressOf, SQUAT, stillUrl, VIDEO_URL } from "../viz/squatFrames";

/**
 * The rendered squat for 'How it works': a video on the page's own colour (Chalk), with the floor shadow rendered
 * in. The camera moves round the lifter and in on his knees as the story goes, so the frame's edges fade into the
 * page (the close shots crop him), and the page's grain lies over it as over the rest of the section. When the knee
 * caves, a hairline ring marks the left knee, as the sensor callouts on the hero model do: ink, no glow.
 */
type St = Pick<HowState, "step" | "local" | "flag" | "buzz">;

const EDGE_FADE = "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent), linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent)";
const fade = { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" } as const;
const GRAIN = { backgroundImage: "url(/textures/chalk-grain.png)", backgroundSize: "128px", mixBlendMode: "multiply", opacity: 0.22 } as const;

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

/** The video. The parent drives it (play, pause, seek) and reads its time as the story's clock. */
export const SquatVideo = forwardRef<HTMLVideoElement, { st: St; className?: string }>(function SquatVideo({ st, className = "" }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);              // load only as the section comes near
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const frame = frameAt(progressOf(st));
  return (
    <div ref={box} className={`relative aspect-[3/4] ${className}`}>
      <div className="absolute inset-0" style={fade}>
        <video ref={ref} src={near ? VIDEO_URL : undefined} poster={stillUrl(0)} muted playsInline preload="auto"
          className="absolute inset-0 h-full w-full" aria-label={label(st)} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={GRAIN} />
      </div>
      <KneeMark frame={frame} on={st.flag} buzz={st.buzz} />
      <KneeLabel frame={frame} on={st.flag} />
    </div>
  );
});

/** One still: the key moment of a step (phones, reduced motion). */
export function SquatStill({ step, st, className = "" }: { step: number; st: St; className?: string }) {
  const f = frameAt(progressOf(st));
  return (
    <div className={`relative aspect-[3/4] ${className}`}>
      <div className="absolute inset-0" style={fade}>
        <img src={stillUrl(step)} width={SQUAT.size[0]} height={SQUAT.size[1]} loading="lazy" decoding="async"
          className="absolute inset-0 h-full w-full" alt={label(st)} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={GRAIN} />
      </div>
      <KneeMark frame={f} on={st.flag} buzz={0} />
      <KneeLabel frame={f} on={st.flag} />
    </div>
  );
}
