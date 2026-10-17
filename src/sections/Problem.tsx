import { useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Scale } from "../components/Scale";
import { Readout } from "../components/Readout";
import { CropMarks } from "../components/CropMarks";
import { Icon } from "../components/Icon";
import { Segmented } from "../components/Segmented";
import { JointGrid } from "../viz/JointGrid";

export function Problem() {
  const [rep, setRep] = useState<"3" | "4">("3");
  const slip = rep === "4";
  return (
    <Section id="problem" surface="raised" label="The problem">
      <div className="wrap pb-28 pt-28 lg:pb-40 lg:pt-40">
        <Kicker index="01">The problem</Kicker>

        {/* beat 1 — the price of a second pair of eyes */}
        <div className="mt-12 grid-12 gap-y-8">
          <p className="t-num col-span-12 text-giant leading-[0.82]">
            <span className="sr-only">70 to 120 dollars a session.</span>
            <span aria-hidden>$70–120</span>
          </p>
          <div className="col-span-12 text-[var(--ink-muted)]">
            <Scale ticks={75} major={15} range={[70 / 150, 120 / 150]} labels={["$0", "$30", "$60", "$90", "$120", "$150"]} />
          </div>
          <div className="col-span-12 mt-10 grid-12 gap-y-4 lg:mt-14">
            <h2 className="t-head col-span-12 text-h3 lg:col-span-5">a session, for a personal trainer.</h2>
            <p className="col-span-12 max-w-[44ch] text-lead lg:col-span-5 lg:col-start-8">
              Right now, paying a trainer is the only reliable way to get your form checked.
            </p>
          </div>
        </div>

        {/* beat 2 — what a camera can't see: the same bench rep, two instruments */}
        <div className="mt-28 grid-12 gap-y-6 lg:mt-44">
          <h2 className="t-head col-span-12 text-h2 lg:col-span-6">A camera sees one side.</h2>
          <p className="col-span-12 max-w-[46ch] self-end text-lead lg:col-span-5 lg:col-start-8">
            Phone apps watch from one angle. On a bench press, if your far hand slips or your far elbow flares, the phone misses it. And you prop it up for every set.
          </p>

          <div className="col-span-12 mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="t-label text-[var(--ink-muted)]">Bench press · phone propped on your right · pick a rep</p>
            <Segmented label="Rep" value={rep} onChange={setRep}
              options={[{ value: "3", label: "Rep 3 · clean" }, { value: "4", label: "Rep 4 · far hand slips" }]} />
          </div>

          <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <figure className="rounded-md border border-[var(--line)] bg-[var(--ground)] p-4 sm:p-5">
              <figcaption className="t-label flex items-center gap-3 text-[var(--ink-muted)]">
                <Icon name="phone" size={18} className="text-[var(--ink)]" />
                <span className="text-[var(--ink)]">Phone camera</span> · one angle
              </figcaption>
              <JointGrid className="mt-5" state={(j) => (j.endsWith(" R") ? "on" : "blind")} />
              <div className="mt-4" aria-live="polite"><Readout status="neutral">Rep {rep.padStart(2, "0")} · no issues detected</Readout></div>
            </figure>
            <CropMarks className="text-[var(--ink)]">
              <figure className="h-full rounded-md border border-[var(--line)] bg-[var(--ground)] p-4 sm:p-5">
                <figcaption className="t-label flex items-center gap-3 text-[var(--ink-muted)]">
                  <Icon name="sides" size={18} className="text-[var(--ink)]" />
                  <span className="text-[var(--ink)]">FormGuard suit</span> · both sides
                </figcaption>
                <JointGrid className="mt-5" state={(j) => (slip && j === "Wrist L" ? "fault" : "on")} />
                <div className="mt-4" aria-live="polite">
                  {slip
                    ? <Readout status="fault">Rep 04 · Grip drift · Left hand</Readout>
                    : <Readout status="clear">Rep 03 · Both sides in range</Readout>}
                </div>
              </figure>
            </CropMarks>
          </div>

          <p className="t-head col-span-12 mt-16 max-w-[24ch] text-h3 lg:col-span-8">
            FormGuard sees both sides, every rep, without propping up your phone.
          </p>
        </div>
      </div>
    </Section>
  );
}
