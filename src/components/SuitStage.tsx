import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Segmented } from "./Segmented";

/**
 * The suit as a 3D model you can turn (public/models, from suit-render/scripts/export_web.py), with its controls:
 * on the body or suit only, sensors shown or hidden. `eager` loads it straight away (the hero); otherwise it loads
 * when it comes near. Until then, or without WebGL, a studio render stands in (public/suit, from
 * scripts/suit-images.sh): it is on a dark sweep, so the stage belongs on Iron, and its edges are feathered into
 * the section with a mask; the pixels are untouched.
 */
const SuitViewer = lazy(() => import("../three/SuitViewer"));

function hasWebGL() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

const POSTERS = {
  on: { id: "07_body_three_quarter_front",
    alt: "The FormGuard suit worn on a mannequin, three-quarter front view: a black long-sleeve compression shirt and full-length tights with thin silver seam lines and small sensor pods at the arms and legs." },
  off: { id: "05_suit_three_quarter_back",
    alt: "The full FormGuard suit, shirt and tights together, three-quarter back view." },
};
const src = (id: string, w: number) => `/suit/${id}-${w}.webp`;
const srcSet = (id: string) => `${src(id, 400)} 400w, ${src(id, 800)} 800w, ${src(id, 1600)} 1600w`;

const FEATHER: React.CSSProperties = {
  maskImage: "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent)",
  WebkitMaskImage: "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

export function SuitStage({ eager = false, className = "" }: { eager?: boolean; className?: string }) {
  const [body, setBody] = useState<"on" | "off">("on");
  const [sensors, setSensors] = useState(true);
  const [near, setNear] = useState(eager);
  const [webgl] = useState(hasWebGL);
  const fig = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = fig.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  const shot = POSTERS[body];
  const poster = (
    <img src={src(shot.id, 800)} srcSet={srcSet(shot.id)} sizes="(min-width: 1024px) 45vw, 92vw"
      alt={shot.alt} width={1600} height={2400} loading={eager ? "eager" : "lazy"} decoding="async" style={FEATHER}
      className="mx-auto block h-full w-auto max-w-full motion-safe:animate-[fg-fade_400ms_var(--ease-physical)]" />
  );
  return (
    <div className={className}>
      <figure ref={fig} className="relative mx-auto aspect-[2/3] max-h-[70svh] w-full max-w-[34rem]">
        {webgl && near ? (
          <Suspense fallback={poster}>
            <SuitViewer showBody={body === "on"} sensors={sensors}
              label={`3D model of the FormGuard suit${body === "on" ? " on a mannequin" : ""}: a black long-sleeve compression shirt and full-length tights with silver seam lines and sensor pods${sensors ? ", each pod ringed and labelled" : ""}. Drag to turn it.`} />
          </Suspense>
        ) : <div key={shot.id} className="h-full">{poster}</div>}
      </figure>
      {webgl && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
          <Segmented label="Show the suit" value={body} onChange={setBody}
            options={[{ value: "on", label: "On the body" }, { value: "off", label: "Suit only" }]} />
          <button type="button" aria-pressed={sensors} onClick={() => setSensors(!sensors)}
            className={`h-12 rounded-md border px-4 text-[15px] font-semibold transition-colors ${sensors ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--line-strong)] text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
            {sensors ? "Hide sensors" : "Show sensors"}
          </button>
          <p className="t-label basis-full text-center text-[var(--ink-muted)]">Drag to turn it</p>
        </div>
      )}
    </div>
  );
}
