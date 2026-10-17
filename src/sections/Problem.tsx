import { useCallback, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Scale } from "../components/Scale";
import { Stage } from "../components/Stage";
import { Readout } from "../components/Readout";
import { CropMarks } from "../components/CropMarks";
import { Icon } from "../components/Icon";
import type { Caps } from "../lib/env";

const loadBench = () => import("../three/scenes/BenchScene").then(async (m) => { await m.preload(); return m; });
const GAP = 16;

export function Problem({ caps }: { caps: Caps }) {
  const [slip, setSlip] = useState({ on: false, rep: 4 });
  const onSlip = useCallback((on: boolean, rep: number) => setSlip({ on, rep }), []);
  // static views (no WebGL, mobile, reduced motion) show the moment of the slip
  const flagged = caps.live3D ? slip.on : true;
  return (
    <Section id="problem" surface="bone" label="The problem">
      <div className="wrap pb-28 pt-28 lg:pb-40 lg:pt-40">
        <Kicker index="01">The problem</Kicker>

        {/* beat 1 — the price of a second pair of eyes */}
        <div className="mt-12 grid-12 gap-y-8">
          <p className="t-num col-span-12 text-giant leading-[0.82]">
            <span className="sr-only">70 to 120 dollars a session.</span>
            <span aria-hidden>$70–120</span>
          </p>
          <div className="col-span-12 text-[var(--muted)]">
            <Scale ticks={75} major={15} range={[70 / 150, 120 / 150]} labels={["$0", "$30", "$60", "$90", "$120", "$150"]} />
          </div>
          <div className="col-span-12 mt-10 grid-12 gap-y-4 lg:mt-14">
            <h2 className="t-head col-span-12 text-h3 lg:col-span-5">a session, for a personal trainer.</h2>
            <p className="col-span-12 max-w-[44ch] text-lead lg:col-span-5 lg:col-start-8">
              Right now, paying a trainer is the only reliable way to get your form checked.
            </p>
          </div>
        </div>

        {/* beat 2 — what a camera can't see */}
        <div className="mt-28 grid-12 gap-y-6 lg:mt-44">
          <h2 className="t-head col-span-12 text-h2 lg:col-span-6">A camera sees one side.</h2>
          <p className="col-span-12 max-w-[46ch] self-end text-lead lg:col-span-5 lg:col-start-8">
            Phone apps watch from one angle. On a bench press, if your far hand slips or your far elbow flares, the phone misses it. And you prop it up for every set.
          </p>

          <div className="relative col-span-12 mt-10" style={{ ["--gap" as string]: `${GAP}px` }}>
            {/* panel backgrounds, behind the canvas */}
            <div aria-hidden className="absolute inset-0 grid grid-cols-2 gap-[var(--gap)]">
              <div className="rounded-[26px] bg-chalk ring-[7px] ring-inset ring-iron" />
              <div className="bg-chalk" />
            </div>
            <Stage load={loadBench} props={{ gap: GAP, onSlip }} live={caps.live3D} className="absolute inset-0"
              alt="Two views of the same bench press. Left, a phone beside the bench sees only the near side; the far hand slips out of view. Right, the suit sees every joint on both sides and flags the far hand." />
            {/* labels, in front */}
            <div className="relative grid aspect-[1.25/1] grid-cols-1 gap-[var(--gap)] sm:aspect-[2.35/1] sm:grid-cols-2">
              <figure className="relative rounded-[26px] p-5 sm:p-6">
                <figcaption className="t-mono flex items-center gap-3 text-[var(--muted)]">
                  <Icon name="phone" size={18} className="text-[var(--fg)]" />
                  <span className="text-[var(--fg)]">Phone camera</span> · one angle
                </figcaption>
                <p className="t-mono absolute right-6 top-6 hidden text-[var(--muted)] sm:block">1× · 30 fps</p>
                <p className="t-mono absolute bottom-6 left-6 border border-dashed border-[var(--muted)] bg-chalk/70 px-2.5 py-[5px] text-[var(--muted)]">
                  Far side · out of view
                </p>
              </figure>
              <CropMarks className="text-iron">
                <figure className="relative h-full p-4 sm:p-5">
                  <figcaption className="t-mono flex items-center gap-3 text-[var(--muted)]">
                    <Icon name="sides" size={18} className="text-[var(--fg)]" />
                    <span className="text-[var(--fg)]">FormGuard suit</span> · both sides
                  </figcaption>
                </figure>
              </CropMarks>
            </div>
          </div>

          {/* the verdicts, for the same rep */}
          <div className="col-span-12 grid grid-cols-1 gap-[16px] sm:grid-cols-2">
            <div className="flex flex-wrap items-center gap-3">
              <Readout status="neutral">Phone · no issues detected</Readout>
            </div>
            <div className="flex flex-wrap items-center gap-3" aria-live="polite">
              {flagged
                ? <Readout status="flag">Rep {String(slip.rep).padStart(2, "0")} · Grip drift · Left hand</Readout>
                : <Readout status="good">Rep {String(slip.rep).padStart(2, "0")} · Both sides clean</Readout>}
            </div>
          </div>

          <p className="t-head col-span-12 mt-16 max-w-[24ch] text-h3 lg:col-span-8">
            FormGuard sees both sides, every rep, without propping up your phone.
          </p>
        </div>
      </div>
    </Section>
  );
}
