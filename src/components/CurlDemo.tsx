import { useEffect, useRef, useState } from "react";
import DATA from "../viz/curlFrames.json";

/**
 * 'Feel the buzz', to try: the rendered lifter's arm mid-way through a dumbbell curl. Drag his elbow forward (or use
 * the slider) and past his normal the suit catches it: the ring at the elbow pulses, the cue appears, and a phone
 * buzzes. Let go and the elbow springs back to his side. Twelve rendered frames (suit-render/squat-video,
 * render_squat.py --curl) from the elbow at his side to drifted 40 degrees forward, all from one camera, so moving
 * between them is instant and smooth.
 */
const K = DATA as { frames: number; size: [number, number]; elbowL: [number, number][] };
const N = K.frames;
const url = (i: number) => `/demo/curl-${String(i).padStart(2, "0")}.webp`;
/** past this the elbow has drifted out of the lifter's normal (0 = at his side, 1 = 40 degrees forward) */
const LIMIT = 0.4;
/** how far a drag moves the elbow: the whole range over this share of the frame's width */
const DRAG_SPAN = 0.2;

const EDGE_FADE = "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), linear-gradient(to bottom, transparent, #000 6%, #000 94%, transparent)";
const fade = { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" } as const;
const GRAIN = { backgroundImage: "url(/textures/chalk-grain.png)", backgroundSize: "128px", mixBlendMode: "multiply", opacity: 0.22 } as const;

const clamp = (x: number) => Math.min(1, Math.max(0, x));

export function CurlDemo({ reduced = false, className = "" }: { reduced?: boolean; className?: string }) {
  const [v, setV] = useState(0);
  const vRef = useRef(0);
  const anim = useRef(0);
  const touched = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x0: number; v0: number; w: number } | null>(null);

  const set = (x: number) => { vRef.current = clamp(x); setV(vRef.current); };
  const springTo = (target: number, ms = 550) => {
    cancelAnimationFrame(anim.current);
    if (reduced) { set(target); return; }
    const from = vRef.current, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3;
      set(from + (target - from) * e);
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  const grab = () => { touched.current = true; cancelAnimationFrame(anim.current); };

  // the suit's buzz, for real on a phone
  const alert = v > LIMIT;
  const was = useRef(false);
  useEffect(() => {
    if (alert && !was.current && touched.current) navigator.vibrate?.([70, 50, 70]);
    was.current = alert;
  }, [alert]);

  // the first time it comes into view, the elbow nudges forward and back, so it's clear it moves
  useEffect(() => {
    const el = stage.current;
    if (!el || reduced) return;
    let t1 = 0, t2 = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      t1 = window.setTimeout(() => {
        if (touched.current) return;
        springTo(0.3, 700);
        t2 = window.setTimeout(() => { if (!touched.current) springTo(0, 700); }, 950);
      }, 500);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // drag anywhere on the arm: to the left (his front) swings the elbow forward
  const down = (e: React.PointerEvent) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    grab();
    drag.current = { id: e.pointerId, x0: e.clientX, v0: vRef.current, w: e.currentTarget.getBoundingClientRect().width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    set(d.v0 + (d.x0 - e.clientX) / (d.w * DRAG_SPAN));
  };
  const up = (e: React.PointerEvent) => {
    if (!drag.current || e.pointerId !== drag.current.id) return;
    drag.current = null;
    springTo(0);
  };

  // the frame, and the elbow between the two nearest frames
  const fi = v * (N - 1);
  const shown = Math.round(fi) + 1;
  const a = K.elbowL[Math.floor(fi)], b = K.elbowL[Math.min(N - 1, Math.floor(fi) + 1)], t = fi - Math.floor(fi);
  const kx = a[0] + (b[0] - a[0]) * t, ky = a[1] + (b[1] - a[1]) * t;

  return (
    <div className={className}>
      <div ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="relative mx-auto aspect-[4/3] w-full max-w-[52rem] cursor-grab touch-pan-y select-none active:cursor-grabbing">
        <div className="absolute inset-0" style={fade}>
          {Array.from({ length: N }, (_, i) => (
            <img key={i} src={url(i + 1)} width={K.size[0]} height={K.size[1]} alt="" draggable={false} decoding="async"
              className={`absolute inset-0 h-full w-full ${i + 1 === shown ? "opacity-100" : "opacity-0"}`} />
          ))}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={GRAIN} />
        </div>
        <span className="sr-only">Rendered: a lifter's arm mid-way through a dumbbell curl{alert ? ", the elbow drifting forward off his side" : ""}.</span>

        {/* the elbow: a hairline ring, as on the hero model; no glow */}
        <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {/* the ring sits on the black suit, the leader runs out over the page: a light line with a thin ink edge
              reads on both */}
          <g transform={`translate(${kx * 400} ${ky * 300})`} fill="none" opacity={alert ? 1 : 0.7} className="transition-opacity duration-300">
            <g stroke="var(--color-iron)" strokeWidth={3} strokeOpacity={0.55}>
              <circle r="15" />
              <path d="M -21 8 L -40 27 L -74 27" />
            </g>
            <g stroke="var(--color-chalk)" strokeWidth={alert ? 1.6 : 1.2}>
              <circle r="15" />
              <path d="M -21 8 L -40 27 L -74 27" />
            </g>
            <circle r="22" stroke="var(--color-chalk)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" className="motion-safe:animate-[spin_8s_linear_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
            {alert && <circle r="15" stroke="var(--color-chalk)" strokeWidth="1.2" className="motion-safe:animate-[fg-buzz_800ms_ease-out_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
          </g>
        </svg>
        {/* at the end of the leader (-78, 27 in the ring's 400 x 300 units): down and to the left, the one clear
            space in every frame */}
        <span aria-hidden className="fg-callout" style={{ left: `${(kx - 78 / 400) * 100}%`, top: `${(ky + 27 / 300) * 100}%`, transform: "translate(-100%, -50%)", color: "var(--ink)" }}>
          Elbow · L
        </span>
      </div>

      <div className="mx-auto mt-6 flex max-w-[52rem] flex-col items-center gap-4">
        <p aria-live="polite" className={`t-label flex min-h-6 items-center gap-2 transition-colors ${alert ? "text-[var(--signal-ink)]" : "text-[var(--ink-muted)]"}`}>
          {alert
            ? <><span aria-hidden className="block size-2 rounded-full bg-current" />Buzz · left elbow drifting forward. Keep it at your side.</>
            : <><span aria-hidden className="block size-2 rounded-full border-[1.5px] border-current" />In your normal</>}
        </p>
        <label className="flex w-full max-w-[22rem] flex-col items-center gap-2">
          <span className="t-mono text-[var(--ink-muted)]">Drag his elbow forward, or slide</span>
          <input type="range" min={0} max={100} value={Math.round(v * 100)}
            onPointerDown={grab} onKeyDown={grab}
            onChange={(e) => set(Number(e.currentTarget.value) / 100)}
            onPointerUp={() => springTo(0)}
            aria-label="Move his left elbow forward" aria-valuetext={alert ? "Drifting forward: the suit buzzes" : "In his normal range"}
            className="w-full accent-[var(--ink)]" />
        </label>
      </div>
    </div>
  );
}
