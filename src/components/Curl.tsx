import { useEffect, useRef, useState } from "react";
import DATA from "../viz/curlFrames.json";

/**
 * 'How it works', played by scrolling: the rendered lifter's arm (just the arm) curling a dumbbell, twice. Rep 1 is
 * clean, the elbow pinned at his side. On rep 2 the elbow drifts forward as he lifts, and past his normal the suit
 * catches it: the ring at the elbow pulses and the cue appears. The section stays put (sticky) while the page
 * scrolls through the reps, and the story eases towards the scroll position, so it plays as motion, never jumps.
 *
 * The rendered frames (suit-render/squat-video, render_squat.py --curl): the clean lift bottom to top, then the
 * faulty one; the way down is the same frames backwards. The ones near the story's frame are decoded ahead and the
 * nearest decoded is drawn on a canvas, so nothing is ever shown before it has decoded (swapping stacked <img>s
 * flickered). Not a cross-fade: the
 * dumbbell moves a few centimetres between frames, and a dark object blended over the light page reads as a double
 * edge.
 */
const C = DATA as { frames: number; steps: number; size: [number, number]; elbowL: [number, number][]; dumbbell: [number, number][] };
const S = C.steps;
const url = (i: number) => `/demo/curl-${String(i).padStart(2, "0")}.webp`;
/** the files' width (encode_squat.py), less than the render's (C.size): never decode them bigger than that */
const FILE_W = 720;
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
  const pos = (r.rep === 1 ? 1 : S + 1) + lift * (S - 1);     // fractional, 1-based
  // how far up this rep has been: on the way down the path it traced stays drawn
  const peak = p < r.down[0] ? lift : 1;
  return { rep: r.rep, lift, peak, pos, alert: r.rep === 2 && lift > LIMIT, start: p < 0.04, done: p > 0.965 };
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

/** frames kept decoded either side of the one on show; the rest wait compressed (all 80 are 640 KB) */
const WINDOW = 8;
/** phones decode at 1.5x density at most: as sharp as the 3D hero there, and half the memory of 2x */
const FRAME_DPR = typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches ? 1.5 : 2;
type Bitmap = ImageBitmap | HTMLImageElement;

/** One frame decoded at `w` pixels wide (the stage's real size, not the file's), or at full size where resizing
 * isn't supported. */
async function decode(blob: Blob, w: number): Promise<Bitmap> {
  if (typeof createImageBitmap === "function") {
    const h = Math.round((w * C.size[1]) / C.size[0]);
    try { return await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" }); }
    catch { return await createImageBitmap(blob); }
  }
  const im = new Image();
  im.src = URL.createObjectURL(blob);
  await im.decode();
  return im;
}
const release = (bm: Bitmap) => { if ("close" in bm) bm.close(); else URL.revokeObjectURL(bm.src); };

/**
 * The frames, once the stage is near: all fetched (compressed, small), but only those within WINDOW of frame `f`
 * decoded, at the size the stage is drawn, and the ones scrolled far past given back. All 80 decoded at full size
 * were 210 MB, which on a phone shares the GPU with the hero's 3D suit; this keeps it to about 20 frames, a few
 * MB each at most (about 25 MB in all on a phone).
 */
function useFrames(box: React.RefObject<HTMLElement | null>, f: number) {
  const blobs = useRef<(Blob | null)[]>(new Array(C.frames).fill(null));
  const frames = useRef(new Map<number, Bitmap>());
  const pending = useRef(new Set<number>());
  const [fetched, setFetched] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const dead = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    dead.current = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      for (let i = 0; i < C.frames; i++) {
        fetch(url(i + 1)).then((r) => r.blob())
          .then((bl) => { if (!dead.current) { blobs.current[i] = bl; setFetched((n) => n + 1); } })
          .catch(() => {});
      }
    }, { rootMargin: "1200px" });
    io.observe(el);
    const held = frames.current;
    return () => { dead.current = true; io.disconnect(); held.forEach(release); held.clear(); };
  }, [box]);

  // decode what's near frame f (nearest first), and give back what's far from it
  useEffect(() => {
    const el = box.current;
    if (!el || !fetched) return;
    const w = Math.min(FILE_W, Math.round(el.clientWidth * Math.min(FRAME_DPR, window.devicePixelRatio || 1)));
    const at = f - 1;
    for (const [i, bm] of frames.current) {
      if (Math.abs(i - at) > WINDOW + 2) { release(bm); frames.current.delete(i); }
    }
    for (let d = 0; d <= WINDOW; d++) {
      for (const i of d ? [at + d, at - d] : [at]) {
        const blob = blobs.current[i];
        if (i < 0 || i >= C.frames || !blob || frames.current.has(i) || pending.current.has(i)) continue;
        pending.current.add(i);
        decode(blob, w)
          .then((bm) => {
            pending.current.delete(i);
            if (dead.current) { release(bm); return; }
            frames.current.set(i, bm);
            setLoaded((n) => n + 1);
          })
          .catch(() => pending.current.delete(i));
      }
    }
  }, [box, f, fetched]);

  return { frames, loaded };
}

/** frames a..b (1-based) of a projected point, as SVG points in the ring's 300 x 400 units */
const line = (pts: [number, number][], a: number, b: number) => pts.slice(a - 1, b).map(([x, y]) => `${(x * 300).toFixed(1)},${(y * 400).toFixed(1)}`).join(" ");
/** the first frame of the faulty lift past his normal: where its path turns red */
const WRONG = S + 1 + Math.ceil(LIMIT * (S - 1));
/** where the elbow belongs: where it sat all through the clean lift */
const HOME = C.elbowL[0];

/** how far the elbow has moved off where it belongs, in the ring's units */
const driftAt = (f: number) => { const [ex, ey] = C.elbowL[f - 1]; return Math.hypot((ex - HOME[0]) * 300, (ey - HOME[1]) * 400); };

/** A path as a faint dotted line: round dots, no edge. */
function Trace({ points, stroke, opacity }: { points: string; stroke: string; opacity: number }) {
  return <polyline points={points} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0 5" opacity={opacity} />;
}

/**
 * The paths, faint dotted lines: the dumbbell's, traced as it rises. On rep 2 the clean lift's path stays, fainter
 * (his normal), the new one is traced beside it and turns red from where the elbow leaves his normal, and the
 * elbow's own drift is a dotted line from where it belongs to where it is.
 */
function Paths({ m, f }: { m: Moment; f: number }) {
  const D = C.dumbbell, ink = "var(--color-iron)", wrong = "var(--signal-ink)";
  const start = m.rep === 1 ? 1 : S + 1;
  const tip = start + Math.round(m.peak * (S - 1));
  const [ex, ey] = C.elbowL[f - 1], [hx, hy] = HOME;
  return (
    <>
      {m.rep === 1 && tip > start && <Trace points={line(D, start, tip)} stroke={ink} opacity={0.55} />}
      {m.rep === 2 && (
        <>
          <Trace points={line(D, 1, S)} stroke={ink} opacity={0.3} />
          {tip > start && <Trace points={line(D, start, Math.min(tip, WRONG))} stroke={ink} opacity={0.55} />}
          {tip > WRONG && <Trace points={line(D, WRONG, tip)} stroke={wrong} opacity={0.9} />}
          {/* the elbow: where it belongs, and how far it has drifted */}
          {driftAt(f) > 2 && (
            <>
              <circle cx={hx * 300} cy={hy * 400} r="3" fill="none" stroke={ink} strokeWidth="1" opacity="0.6" />
              <Trace points={`${hx * 300},${hy * 400} ${ex * 300},${ey * 400}`} stroke={m.alert ? wrong : ink} opacity={m.alert ? 0.9 : 0.55} />
            </>
          )}
        </>
      )}
    </>
  );
}

/** The arm at the moment (the nearest frame), and the ring at the elbow. */
export function CurlStage({ m, className = "" }: { m: Moment; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const f = Math.round(m.pos);
  const { frames, loaded } = useFrames(box, f);

  useEffect(() => {
    const c = canvas.current, el = box.current;
    const ctx = c?.getContext("2d");
    if (!c || !el || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(el.clientWidth * dpr), H = Math.round(el.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const F = frames.current;
    // the frame, or until it's in, the nearest decoded one
    let im: Bitmap | null = null;
    for (let k = 0; k < C.frames && !im; k++) im = F.get(f - 1 - k) ?? F.get(f - 1 + k) ?? null;
    if (im) ctx.drawImage(im, 0, 0, W, H);
  }, [f, loaded, frames]);

  const [ex, ey] = C.elbowL[f - 1];
  // once the elbow drifts, its label moves to where it belongs (the leader would run across that spot)
  const moved = m.rep === 2 && driftAt(f) > 2;
  return (
    <div ref={box} className={`relative aspect-[3/4] ${className}`}>
      <div className="absolute inset-0" style={fade}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={GRAIN} />
      </div>
      <span className="sr-only">Rendered: a lifter's arm curling a dumbbell{m.alert ? ", the elbow drifting forward off his side" : ""}.</span>

      {/* the paths, then the elbow: a hairline ring, as on the hero model; a light line with a thin ink edge, so it
          reads on the black suit and on the page; no glow. On the buzz it goes red and pulses */}
      <svg aria-hidden viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <Paths m={m} f={f} />
        <g transform={`translate(${ex * 300} ${ey * 400})`} fill="none" opacity={m.alert ? 1 : 0.7} className="transition-opacity duration-300">
          <g stroke="var(--color-iron)" strokeWidth={3} strokeOpacity={0.55}>
            <circle r="14" />
            {!moved && <path d="M 20 8 L 36 26 L 62 26" />}
          </g>
          <g stroke="var(--color-chalk)" strokeWidth={1.2}>
            <circle r="14" />
            {!moved && <path d="M 20 8 L 36 26 L 62 26" />}
          </g>
          {m.alert ? (
            <>
              {/* the buzzer: the ring goes red and pulses out from the elbow */}
              <circle r="14" stroke="var(--signal-ink)" strokeWidth="2.2" />
              {[0, 400].map((delay) => (
                <circle key={delay} r="14" stroke="var(--signal-ink)" strokeWidth="2" className="motion-safe:animate-[fg-buzz_800ms_ease-out_infinite]"
                  style={{ transformBox: "fill-box", transformOrigin: "center", animationDelay: `${delay}ms` }} />
              ))}
            </>
          ) : (
            <circle r="20" stroke="var(--color-chalk)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" className="motion-safe:animate-[spin_8s_linear_infinite]" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          )}
        </g>
      </svg>
      {/* at the end of the leader (66, 26 in the ring's 300 x 400 units): down and to the right, under the upper arm,
          clear of the forearm and the dumbbell in every frame */}
      <span aria-hidden className="fg-callout" style={{ left: `${(ex + 66 / 300) * 100}%`, top: `${(ey + 26 / 400) * 100}%`, transform: "translateY(-50%)", color: "var(--ink)", opacity: moved ? 0 : 1 }}>
        Elbow · L
      </span>
      {/* rep 2: beside where the elbow belongs */}
      <span aria-hidden className="fg-callout" style={{ left: `${(HOME[0] + 8 / 300) * 100}%`, top: `${HOME[1] * 100}%`, transform: "translateY(-50%)", color: "var(--ink-muted)", opacity: moved ? 1 : 0 }}>
        Belongs here
      </span>
      {/* the buzz, at the elbow where the eye already is: just under the ring, moving with it */}
      {m.alert && (
        <div aria-hidden className="absolute w-max max-w-[60%] -translate-x-1/2 rounded-sm border border-[var(--signal-ink)] bg-[var(--color-chalk)] px-2.5 py-1.5 text-center text-[var(--signal-ink)] motion-safe:animate-[fg-fade_200ms_ease-out]"
          style={{ left: `${ex * 100}%`, top: `${(ey + 26 / 400) * 100}%` }}>
          <p className="t-label flex items-center justify-center gap-1.5"><span className="block size-1.5 shrink-0 rounded-full bg-current" />Buzz · elbow drifting forward</p>
          <p className="mt-0.5 text-[13px] leading-tight">Keep it at your side.</p>
        </div>
      )}
      {/* rep 2: what the dotted paths are */}
      <ul aria-hidden className="t-mono absolute bottom-[4%] left-[6%] space-y-1 text-[11px] text-[var(--ink-muted)] transition-opacity duration-300" style={{ opacity: m.rep === 2 ? 1 : 0 }}>
        <li className="flex items-center gap-2"><svg width="22" height="4"><line x1="2" y1="2" x2="20" y2="2" stroke="var(--color-iron)" strokeWidth="2" strokeLinecap="round" strokeDasharray="0 5" opacity="0.3" /></svg>Rep 1 · your normal</li>
        <li className="flex items-center gap-2"><svg width="22" height="4"><line x1="2" y1="2" x2="20" y2="2" stroke="var(--signal-ink)" strokeWidth="2" strokeLinecap="round" strokeDasharray="0 5" opacity="0.9" /></svg>Rep 2 · out of it</li>
      </ul>
    </div>
  );
}

/** What the suit is saying: in range, the buzz, and after the set the one thing to change. */
export function CurlCue({ m, className = "" }: { m: Moment; className?: string }) {
  return (
    <p aria-live="polite" className={`t-label flex min-h-6 items-center gap-2 transition-colors ${m.alert ? "text-[var(--signal-ink)]" : m.done ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"} ${className}`}>
      {m.alert
        ? <><span aria-hidden className="block size-2 shrink-0 rounded-full bg-current" />Rep 2 · left elbow out of your normal</>
        : m.done
          ? <><span aria-hidden className="block size-2 shrink-0 rounded-full bg-[var(--signal)]" />Next set · keep your left elbow at your side</>
          : <><span aria-hidden className="block size-2 shrink-0 rounded-full border-[1.5px] border-current" />Rep {m.rep} · in your normal</>}
    </p>
  );
}
