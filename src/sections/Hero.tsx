import { ButtonLink } from "../components/Button";
import { Section } from "../components/Section";
import { SuitStage } from "../components/SuitStage";
import { SITE } from "../config";

/** The landing view: the suit itself, on Iron (its own colour), turnable, every sensor marked. */
const FACTS = [
  { n: "12", label: "Sensors" },
  { n: "2", label: "Pieces" },
  { n: "1", label: "Controller" },
];

export function Hero() {
  return (
    <Section id="top" surface="iron" label="Introduction" className="overflow-hidden">
      <div className="wrap relative grid-12 min-h-[100svh] content-center items-center gap-y-6 pb-12 pt-[calc(var(--header-h)+clamp(2rem,5vh,4rem))]">
        <div className="col-span-12 lg:col-span-6">
          <p className="t-label flex items-center gap-3 text-[var(--ink-muted)]">
            <span aria-hidden className="h-px w-6 bg-[var(--ink)]" />In development · test lifters wanted
          </p>
          <h1 className="t-display mt-6 text-[clamp(2.75rem,12.2vw,4.25rem)] uppercase leading-[0.9] lg:text-[clamp(3.75rem,6vw,7.5rem)]">
            Coaching,<br />without the<br />coach.
          </h1>
          <p className="mt-8 max-w-[34ch] text-lead font-normal text-[var(--ink)]/90 lg:mt-10">{SITE.oneLiner}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <ButtonLink href="#test-lifter">Become a test lifter</ButtonLink>
            <a href="#try" className="inline-flex items-center gap-2 font-semibold underline decoration-[var(--line-strong)] decoration-1 underline-offset-[6px] transition-colors hover:decoration-[var(--ink)]">
              Try a rep yourself
            </a>
          </div>
          {/* the kit, in three numbers */}
          <dl className="mt-12 hidden max-w-[28rem] grid-cols-3 sm:grid border-t border-[var(--line)] pt-5">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt className="t-label text-[var(--ink-muted)]">{f.label}</dt>
                <dd className="t-num mt-1 text-[40px] leading-none">{f.n}</dd>
              </div>
            ))}
          </dl>
        </div>

        <SuitStage eager className="col-span-12 lg:col-span-6" />
      </div>
    </Section>
  );
}
