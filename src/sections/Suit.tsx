import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Segmented } from "../components/Segmented";

/**
 * The product: the suit from the Blender scene in suit-render/, as a 3D model you can turn (public/models, from
 * suit-render/scripts/export_web.py), loaded only when the section comes near. Until then, or without WebGL, a
 * studio render stands in (public/suit, from scripts/suit-images.sh); it is on a dark sweep, so this section is
 * Iron and its edges are feathered into it with a mask; the pixels are untouched.
 */
const SuitViewer = lazy(() => import("../three/SuitViewer"));

function hasWebGL() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}
/** a studio render stands in while the model loads, and for browsers without WebGL */
const POSTERS = {
  on: { id: "07_body_three_quarter_front",
    alt: "The FormGuard suit worn on a mannequin, three-quarter front view: a black long-sleeve compression shirt and full-length tights with thin silver seam lines and small sensor pods at the arms and legs." },
  off: { id: "05_suit_three_quarter_back",
    alt: "The full FormGuard suit, shirt and tights together, three-quarter back view, with the controller on the back waistband." },
};

const src = (id: string, w: number) => `/suit/${id}-${w}.webp`;
const srcSet = (id: string) => `${src(id, 400)} 400w, ${src(id, 800)} 800w, ${src(id, 1600)} 1600w`;

/** feather the studio backdrop into the section: a soft ellipse, so there's no box around it */
const FEATHER: React.CSSProperties = {
  maskImage: "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent)",
  WebkitMaskImage: "linear-gradient(to right, transparent, #000 32%, #000 68%, transparent), linear-gradient(to bottom, transparent, #000 14%, #000 80%, transparent)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

const SPECS = [
  { n: "12", label: "Sensor pods", note: "Wrists, upper arms, shoulders, thighs and shins on both sides, plus the upper and lower back" },
  { n: "2", label: "Pieces", note: "A long-sleeve shirt and full-length tights" },
  { n: "1", label: "Controller", note: "On the back waistband, wired to every pod by the silver seams" },
];

export function Suit() {
  const [body, setBody] = useState<"on" | "off">("on");
  const [near, setNear] = useState(false);
  const [webgl] = useState(hasWebGL);
  const fig = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = fig.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const shot = POSTERS[body];
  const poster = (
    <img src={src(shot.id, 800)} srcSet={srcSet(shot.id)} sizes="(min-width: 1024px) 45vw, 92vw"
      alt={shot.alt} width={1600} height={2400} loading="lazy" decoding="async" style={FEATHER}
      className="mx-auto block h-full w-auto max-w-full motion-safe:animate-[fg-fade_400ms_var(--ease-physical)]" />
  );
  return (
    <Section id="suit" surface="iron" label="The suit">
      <div className="wrap grid-12 items-center gap-y-10 pb-24 pt-24 lg:pb-32 lg:pt-32">
        <div className="col-span-12 lg:col-span-5">
          <Kicker index="01">The suit</Kicker>
          <h2 className="t-head mt-6 text-h2">The sensors are sewn in.</h2>
          <dl className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {SPECS.map((s) => (
              <div key={s.label} className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-4 py-4">
                <dt className="t-num text-[40px] leading-none">{s.n}</dt>
                <dd>
                  <span className="t-title block">{s.label}</span>
                  <span className="mt-1 block text-[15px] leading-[1.45] text-[var(--ink-muted)]">{s.note}</span>
                </dd>
              </div>
            ))}
          </dl>

          {webgl && (
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Segmented label="Show the suit" value={body} onChange={setBody}
                options={[{ value: "on", label: "On the body" }, { value: "off", label: "Suit only" }]} />
              <p className="t-label text-[var(--ink-muted)]">Drag to turn it</p>
            </div>
          )}
        </div>

        <figure ref={fig} className="relative col-span-12 mx-auto aspect-[2/3] max-h-[88svh] w-full max-w-[36rem] lg:col-span-6 lg:col-start-7">
          {webgl && near ? (
            <Suspense fallback={poster}>
              <SuitViewer showBody={body === "on"}
                label={`3D model of the FormGuard suit${body === "on" ? " on a mannequin" : ""}: a black long-sleeve compression shirt and full-length tights with silver seam lines and sensor pods. Drag to turn it.`} />
            </Suspense>
          ) : <div key={shot.id} className="h-full">{poster}</div>}
        </figure>
      </div>
    </Section>
  );
}
