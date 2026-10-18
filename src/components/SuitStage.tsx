import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The suit on its own as a 3D model you can turn (public/models, from suit-render/scripts/export_web.py), with
 * the sensors shown or hidden. `eager` loads it straight away (the hero); otherwise it loads
 * when it comes near. Until then, or without WebGL, a studio render stands in (public/suit, from
 * scripts/suit-images.sh): it is on a dark sweep, so the stage belongs on Iron, and its edges are feathered into
 * the section with a mask; the pixels are untouched. If the 3D viewer fails (an error, or the GPU drops the WebGL
 * context) the render stays.
 */
const SuitViewer = lazy(() => import("../three/SuitViewer"));
/** touch screens turn the suit with a sideways swipe (SuitViewer's Spin), so the hint says that there */
const TOUCH = typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

/** three.js needs WebGL2 */
function hasWebGL2() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();   // give the check's context back straight away
    return !!gl;
  } catch {
    return false;
  }
}

/** a crash inside the 3D viewer falls back to the render instead of taking the page down */
class Fallback extends Component<{ to: ReactNode; onError: (e: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: Error) { this.props.onError(e); }
  render() { return this.state.failed ? this.props.to : this.props.children; }
}

const POSTER = { id: "05_suit_three_quarter_back",
  alt: "The full FormGuard suit, shirt and tights together, three-quarter back view." };
const src = (id: string, w: number) => `/suit/${id}-${w}.webp`;
const srcSet = (id: string) => `${src(id, 400)} 400w, ${src(id, 800)} 800w, ${src(id, 1600)} 1600w`;

const FEATHER: React.CSSProperties = {
  maskImage: "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent)",
  WebkitMaskImage: "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

export function SuitStage({ eager = false, className = "" }: { eager?: boolean; className?: string }) {
  const [sensors, setSensors] = useState(true);
  const [near, setNear] = useState(eager);
  const [webgl] = useState(hasWebGL2);
  const [failed, setFailed] = useState(false);
  // a failed load gets one fresh try; after the GPU drops the context, Chrome often blocks the page from WebGL
  // ("Web page caused context loss"), so that one goes straight to the render
  const [attempt, setAttempt] = useState(0);
  const tries = useRef(0);
  const fail = useCallback((detail: string, retry = true) => {
    console.error("[suit 3d]", detail);
    if (retry && tries.current < 1) {
      tries.current++;
      // forget the failed load first, or the retry would be handed the same error
      import("../three/SuitViewer").then((m) => m.forgetModel()).catch(() => {}).finally(() => setAttempt((a) => a + 1));
    } else {
      setFailed(true);
    }
  }, []);
  const lost = useCallback(() => fail("the GPU dropped the WebGL context", false), [fail]);
  const fig = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = fig.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const shot = POSTER;
  const poster = (
    <img src={src(shot.id, 800)} srcSet={srcSet(shot.id)} sizes="(min-width: 1024px) 45vw, 92vw"
      alt={shot.alt} width={1600} height={2400} loading={eager ? "eager" : "lazy"} decoding="async" style={FEATHER}
      className="mx-auto block h-full w-auto max-w-full motion-safe:animate-[fg-fade_400ms_var(--ease-physical)]" />
  );
  return (
    <div className={className}>
      <figure ref={fig} className="relative mx-auto aspect-[2/3] max-h-[70svh] w-full max-w-[34rem]">
        {webgl && near && !failed ? (
          <Fallback key={attempt} to={poster} onError={(e) => fail(e.message)}>
            <Suspense fallback={poster}>
              <SuitViewer sensors={sensors} onLost={lost}
                label={`3D model of the FormGuard suit: a black long-sleeve compression shirt and full-length tights with silver seam lines and sensor pods${sensors ? ", each pod ringed and labelled" : ""}. ${TOUCH ? "Swipe sideways to turn it." : "Drag to turn it."}`} />
            </Suspense>
          </Fallback>
        ) : <div className="h-full">{poster}</div>}
      </figure>
      {webgl && !failed && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
          <button type="button" aria-pressed={sensors} onClick={() => setSensors(!sensors)}
            className={`h-12 rounded-md border px-4 text-[15px] font-semibold transition-colors ${sensors ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--line-strong)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
            {sensors ? "Hide sensors" : "Show sensors"}
          </button>
          <p className="t-label basis-full text-center text-[var(--ink-muted)]">{TOUCH ? "Swipe sideways to turn it" : "Drag to turn it"}</p>
        </div>
      )}
    </div>
  );
}
