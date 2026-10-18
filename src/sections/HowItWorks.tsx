import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { CurlDemo } from "../components/CurlDemo";
import type { Caps } from "../lib/env";

/** Four steps, a few words each; the third is the one you can try, right below. */
const STEPS = [
  { title: "Wear it", body: "Sensors sit at every joint." },
  { title: "Lift", body: "Your warm-up teaches it your normal." },
  { title: "Feel the buzz", body: "A joint drifts, and it buzzes right there." },
  { title: "Fix it", body: "Between sets: the one thing to change." },
];
const TRY = 2;

export function HowItWorks({ caps }: { caps: Caps }) {
  return (
    <Section id="how" surface="chalk" label="How it works">
      <div className="wrap pb-24 pt-24 md:pb-28 md:pt-28">
        <Kicker index="03">How it works</Kicker>
        <h2 className="t-head mt-6 max-w-[18ch] text-h2">It learns you, then catches the rep that drifts.</h2>

        <ol className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={i} className={`border-t pt-4 ${i === TRY ? "border-[var(--ink)]" : "border-[var(--line-strong)]"}`}>
              <p className="t-mono text-[var(--ink-muted)]">{String(i + 1).padStart(2, "0")}</p>
              <p className={`t-title mt-2 ${i === TRY ? "text-[var(--ink)]" : ""}`}>{s.title}</p>
              <p className="mt-1 max-w-[26ch] text-[15px] leading-[1.45] text-[var(--ink-muted)]">{s.body}</p>
            </li>
          ))}
        </ol>

        <CurlDemo reduced={caps.reduced} className="mt-14" />
      </div>
    </Section>
  );
}
