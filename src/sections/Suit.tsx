import { useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";

/**
 * The product: the suit, from the Blender renders in suit-render/ (web copies in public/suit/, made by
 * scripts/suit-images.sh). One large viewer and a strip of every shot. The renders sit on a dark studio sweep,
 * so this section is Iron, and the viewer's edges are feathered into it with a mask; the pixels are untouched.
 */
type Shot = { id: string; label: string; alt: string };
const SHOTS: Shot[] = [
  { id: "07_body_three_quarter_front", label: "On the body · ¾",
    alt: "The FormGuard suit worn on a mannequin, three-quarter front view: a black long-sleeve compression shirt and full-length tights with thin silver seam lines and small sensor pods at the arms and legs." },
  { id: "06_body_front", label: "On the body · front",
    alt: "The FormGuard suit worn on a mannequin, front view, arms slightly out: sensor pods on both arms and both legs, the FormGuard logo on the chest and the F symbol on the left thigh." },
  { id: "08_body_back", label: "On the body · back",
    alt: "The FormGuard suit worn on a mannequin, back view: silver signal seams run from the shoulders down the spine to the controller on the back waistband." },
  { id: "01_shirt_front", label: "Shirt · front",
    alt: "The FormGuard shirt on its own, front: long sleeves, the stacked FormGuard logo on the chest, sensor pods on the upper arms and wrists." },
  { id: "02_shirt_back", label: "Shirt · back",
    alt: "The FormGuard shirt on its own, back: sensor pods at the top of each shoulder and between the shoulder blades, joined by silver signal seams." },
  { id: "03_tights_front", label: "Tights · front",
    alt: "The FormGuard tights on their own, front: the F symbol on the left thigh, sensor pods on the outer thighs and shins." },
  { id: "04_tights_back", label: "Tights · back",
    alt: "The FormGuard tights on their own, back: the controller on the waistband, a sensor pod at the lower back, signal seams running down each leg." },
  { id: "05_suit_three_quarter_back", label: "Full suit · ¾ back",
    alt: "The full FormGuard suit, shirt and tights together, three-quarter back view, with the controller on the back waistband." },
];

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
  const [i, setI] = useState(0);
  const shot = SHOTS[i];
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

          {/* every shot: pick one to see it large */}
          <div role="group" aria-label="Views of the suit" className="-mx-1 mt-10 flex gap-2 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {SHOTS.map((s, k) => (
              <button key={s.id} type="button" onClick={() => setI(k)} aria-pressed={k === i} aria-label={s.label}
                className={`group relative w-[4.5rem] shrink-0 overflow-hidden rounded-sm border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] lg:w-auto ${k === i ? "border-[var(--ink)]" : "border-[var(--line)] hover:border-[var(--line-strong)]"}`}>
                <img src={src(s.id, 400)} alt="" width={400} height={600} loading="lazy" decoding="async" className="block aspect-[2/3] w-full object-cover" />
              </button>
            ))}
          </div>
          <p className="t-label mt-3 text-[var(--ink-muted)]" aria-live="polite">{shot.label}</p>
        </div>

        <figure className="col-span-12 lg:col-span-6 lg:col-start-7">
          <img key={shot.id} src={src(shot.id, 800)} srcSet={srcSet(shot.id)} sizes="(min-width: 1024px) 45vw, 92vw"
            alt={shot.alt} width={1600} height={2400} loading="lazy" decoding="async" style={FEATHER}
            className="mx-auto block aspect-[2/3] h-auto max-h-[88svh] w-auto max-w-full motion-safe:animate-[fg-fade_400ms_var(--ease-physical)]" />
        </figure>
      </div>
    </Section>
  );
}
