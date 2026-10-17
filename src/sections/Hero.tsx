import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "../components/Button";
import { Readout } from "../components/Readout";
import { RepStrip } from "../components/RepStrip";
import { CueCard } from "../components/CueCard";
import { Flag } from "../components/Flag";
import { Section } from "../components/Section";
import { SITE } from "../config";
import type { Caps } from "../lib/env";
import { RepTrace } from "../viz/RepTrace";
import { judge, type RepParams } from "../viz/signal";
import { repAt, repDepth, useClock } from "../viz/lift";

const PERIOD = 3.6, SET = 8;
/** The set on the monitor: steady reps, with the left knee caving on rep 4. */
const rep = (i: number): RepParams => ({ depth: repDepth(i), cave: i % SET === 3 ? 10 : 0, seed: i });

export function Hero({ caps }: { caps: Caps }) {
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
    <Section id="top" surface="chalk" label="Introduction" className="overflow-hidden">
      <div className="wrap relative grid-12 min-h-[100svh] content-center gap-y-12 pb-12 pt-[calc(var(--header-h)+clamp(2rem,5vh,4rem))]">
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
        </div>

        {/* the instrument: a live set, every rep checked against the lifter's own normal */}
        <div ref={panel} className="col-span-12 lg:col-span-6 lg:col-start-7">
          <div className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-5 sm:p-6">
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
        </div>
      </div>
    </Section>
  );
}
