import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button";
import { CueCard } from "../components/CueCard";
import { Flag } from "../components/Flag";
import { Kicker } from "../components/Kicker";
import { Readout } from "../components/Readout";
import { RepStrip } from "../components/RepStrip";
import { Section } from "../components/Section";
import type { Caps } from "../lib/env";
import { repAt, repDepth, useClock } from "../viz/lift";
import { RepTrace } from "../viz/RepTrace";
import { judge, type RepParams } from "../viz/signal";

/**
 * Right after the suit in the hero: what's in it, and what it does with it. The specs, and the instrument: a live
 * set, every rep checked against the lifter's own normal.
 */
const SPECS = [
  { n: "12", label: "Sensor pods", note: "Wrists, upper arms, shoulders, thighs and shins on both sides, plus the upper and lower back" },
  { n: "2", label: "Pieces", note: "A long-sleeve shirt and full-length tights" },
  { n: "1", label: "Controller", note: "On the left upper arm, wired to every pod by the silver seams" },
];

const PERIOD = 3.6, SET = 8;
/** The set on the monitor: steady reps, with the left knee caving on rep 4. */
const rep = (i: number): RepParams => ({ depth: repDepth(i), cave: i % SET === 3 ? 10 : 0, seed: i });

function LiveSet({ caps }: { caps: Caps }) {
  const panel = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  // reduced motion: start still, on the rep after the fault; the visitor can press play
  useEffect(() => { if (caps.ready && caps.reduced) setPlaying(false); }, [caps.ready, caps.reduced]);
  const clock = useClock(playing, panel);
  // reduced motion opens on the rep after the fault, so the still tells the whole story
  const t = (caps.reduced ? PERIOD * 4.35 : 0) + clock;

  const { index, phase } = repAt(t, PERIOD);
  const set = Math.floor(index / SET), inSet = index % SET;
  const done = Array.from({ length: inSet }, (_, k) => rep(set * SET + k));
  const live = { r: rep(index), p: phase };
  const last = done[done.length - 1];
  const fault = last ? judge(last) : null;

  return (
    <div ref={panel} className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Readout status="live">Back squat · set {set + 1} · rep {String(inSet + 1).padStart(2, "0")}</Readout>
        <Button variant="quiet" size="sm" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}>{playing ? "Pause" : "Play"}</Button>
      </div>
      <RepTrace className="mt-5" compact reps={done} live={live}
        title="A live squat set. Each rep is drawn as knee bend and left-knee travel against a shaded band, the lifter's normal. On rep 4 the left knee caves in and its trace leaves the band." />
      <RepStrip className="mt-6" label="This set" reps={done.map((r) => ({ depth: r.depth, fault: judge(r)?.joint }))} slots={SET} />
      <div className="mt-5 min-h-[9rem]" aria-live="polite">
        {fault ? (
          <CueCard joint={fault.joint} cue={fault.cue} fix={fault.fix} meta={`Rep ${inSet}`} className="max-w-none bg-[var(--ground)]" />
        ) : last ? (
          <div className="rounded-md border border-[var(--line)] bg-[var(--ground)] p-4">
            <Flag tone="clear">Rep {inSet} · in range</Flag>
            <p className="mt-2 text-[16px]">Within your normal. No cue.</p>
          </div>
        ) : (
          <p className="t-mono pt-2 text-[var(--ink-muted)]">First rep of the set. Hover the trace to read it.</p>
        )}
      </div>
    </div>
  );
}

export function Suit({ caps }: { caps: Caps }) {
  return (
    <Section id="suit" surface="chalk" label="The suit">
      <div className="wrap grid-12 items-center gap-y-12 pb-24 pt-24 lg:pb-32 lg:pt-32">
        <div className="col-span-12 lg:col-span-5">
          <Kicker index="01">The suit</Kicker>
          <h2 className="t-head mt-6 text-h2">The sensors are sewn in.</h2>
          <p className="mt-6 max-w-[38ch] text-lead text-[var(--ink)]/90">Every rep is read at the joints and checked against your own normal, live.</p>
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
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <LiveSet caps={caps} />
        </div>
      </div>
    </Section>
  );
}
