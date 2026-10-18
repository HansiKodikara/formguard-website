import { useRef } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { CurlCue, CurlStage, moment, SCREENS, useTrackProgress } from "../components/Curl";
import type { Caps } from "../lib/env";

/** Four steps, a few words each; the one the arm is showing is lit as the story scrolls by. */
const STEPS = [
  { title: "Wear it", body: "Sensors sit at every joint." },
  { title: "Lift", body: "Your warm-up teaches it your normal." },
  { title: "Feel the buzz", body: "A joint drifts, and it buzzes right there." },
  { title: "Fix it", body: "Between sets: the one thing to change." },
];

/**
 * How it works: the steps on the left, the rendered arm on the right, the whole section pinned (sticky) while the
 * page scrolls through two curls. The clean rep is 'Lift' (it learns your normal), the elbow drifting is 'Feel the
 * buzz', and the end of the set is 'Fix it'.
 */
export function HowItWorks({ caps }: { caps: Caps }) {
  const track = useRef<HTMLDivElement>(null);
  const p = useTrackProgress(track, caps.reduced);
  const m = moment(p);
  const step = m.start ? 0 : m.done ? 3 : m.rep === 1 ? 1 : 2;

  return (
    <Section id="how" surface="chalk" label="How it works">
      <div ref={track} className="relative" style={{ height: `${SCREENS * 100 + 100}svh` }}>
        <div className="sticky top-0 h-[100svh] min-h-[560px] overflow-hidden">
          <div className="wrap grid-12 h-full content-center items-center gap-y-4 pb-6 pt-[calc(var(--header-h)+1rem)]">
            <div className="col-span-12 md:col-span-5">
              <Kicker index="02">How it works</Kicker>
              <h2 className="t-head mt-5 max-w-[16ch] text-[clamp(1.75rem,3.2vw,3.5rem)] leading-[1]">It learns you, then catches the rep that drifts.</h2>

              {/* desktop: all four, the current one lit */}
              <ol className="mt-10 hidden border-l border-[var(--line-strong)] md:block">
                {STEPS.map((s, i) => (
                  <li key={i} className="relative py-3 pl-5">
                    <span aria-hidden className={`absolute -left-px top-0 h-full w-[2px] origin-top bg-[var(--ink)] transition-transform duration-500 ease-[var(--ease-physical)] ${step === i ? "scale-y-100" : "scale-y-0"}`} />
                    <p className={`flex items-baseline gap-4 transition-colors duration-300 ${step === i ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"}`} aria-current={step === i ? "step" : undefined}>
                      <span className="t-mono w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className="t-title">{s.title}</span>
                    </p>
                    <p className={`ml-10 max-w-[30ch] overflow-hidden text-[15px] leading-[1.45] text-[var(--ink-muted)] transition-[max-height,opacity] duration-500 ease-[var(--ease-physical)] ${step === i ? "mt-1 max-h-16 opacity-100" : "max-h-0 opacity-0"}`}>{s.body}</p>
                  </li>
                ))}
              </ol>
              {/* phones: just the current one */}
              <p className="mt-4 md:hidden" aria-current="step">
                <span className="t-mono text-[var(--ink-muted)]">{String(step + 1).padStart(2, "0")} </span>
                <span className="t-title">{STEPS[step].title}</span>
                <span className="block text-[15px] leading-[1.45] text-[var(--ink-muted)]">{STEPS[step].body}</span>
              </p>

              <CurlCue m={m} className="mt-8 hidden md:flex" />
            </div>

            <div className="col-span-12 flex flex-col items-center gap-3 md:col-span-7">
              <CurlStage m={m} className="h-[min(calc(100svh-var(--header-h)-4rem),46rem)] max-h-[52svh] max-w-full md:max-h-none" />
              <CurlCue m={m} className="text-center md:hidden" />
              <p className="t-mono text-[var(--ink-muted)] transition-opacity duration-500" style={{ opacity: m.start ? 1 : 0 }}>Scroll to lift</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
