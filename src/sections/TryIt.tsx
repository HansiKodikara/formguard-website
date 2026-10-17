import { useEffect, useRef, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Button } from "../components/Button";
import { Reading } from "../components/Reading";
import { RepStrip } from "../components/RepStrip";
import { CueCard } from "../components/CueCard";
import { Flag } from "../components/Flag";
import { Range } from "../components/Range";
import { RepTrace } from "../viz/RepTrace";
import { judge, sample, type Fault, type RepParams } from "../viz/signal";

const REP_SECONDS = 2.4, SET = 8;

/**
 * The sandbox: set up a rep (how deep, how much the left knee caves), do it, and see what the suit sees:
 * the trace against your normal as it happens, the rep added to the set, and the one cue to fix.
 */
export function TryIt() {
  const [depth, setDepth] = useState(100);   // % of the lifter's normal
  const [cave, setCave] = useState(0);       // degrees the left knee caves in, at worst
  const [phase, setPhase] = useState<number | null>(null);
  const [reps, setReps] = useState<RepParams[]>([]);
  const [last, setLast] = useState<{ n: number; fault: Fault | null } | null>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const current: RepParams = { depth: depth / 100, cave, seed: reps.length + 11 };

  const doRep = () => {
    if (phase !== null) return;
    const r = current, t0 = performance.now();
    const fresh = reps.length >= SET;
    if (fresh) { setReps([]); setLast(null); }
    const n = (fresh ? 0 : reps.length) + 1;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1000 / REP_SECONDS);
      setPhase(p);
      if (p < 1) { raf.current = requestAnimationFrame(tick); return; }
      setPhase(null);
      setReps((rs) => [...(fresh ? [] : rs), r]);
      setLast({ n, fault: judge(r) });
    };
    raf.current = requestAnimationFrame(tick);
  };

  const running = phase !== null;
  const cavePeak = Math.max(0, sample("cave", current, 0.62));

  return (
    <Section id="try" surface="iron" label="Try it">
      <div className="wrap grid-12 gap-y-12 pb-28 pt-28 lg:pb-36 lg:pt-36">
        <div className="col-span-12 lg:col-span-5">
          <Kicker index="03">Try it</Kicker>
          <h2 className="t-head mt-6 text-h2">Do a rep. See what it sees.</h2>
          <p className="mt-6 max-w-[40ch] text-lead text-[var(--ink)]/90">
            Set how deep you go and how much your left knee caves, then do a rep. FormGuard checks it against your own normal, the shaded band, and tells you the one thing to fix.
          </p>
          <div className="mt-10 space-y-8">
            <Range label="Depth" value={depth} min={70} max={100} unit="% of your normal" onChange={setDepth} disabled={running} />
            <Range label="Left knee caves in" value={cave} min={0} max={14} unit="°" onChange={setCave} disabled={running} />
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="secondary" onClick={doRep} disabled={running}>{reps.length >= SET ? "Start a new set" : "Do a rep"}</Button>
              {reps.length > 0 && !running && <Button variant="quiet" onClick={() => { setReps([]); setLast(null); }}>Clear the set</Button>}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-6 border-t border-[var(--line)] pt-6">
              <Reading label="Depth" value={depth} unit="%" tone={judge({ ...current, cave: 0 }) ? "fault" : "clear"}
                note={depth < 90 ? `Short of your normal by ${100 - depth}%` : "Your usual depth"} />
              <Reading label="Left knee" value={cavePeak.toFixed(1)} unit="° in" tone={cave > 4 ? "fault" : "clear"}
                note={cave > 4 ? "Outside your normal" : "Tracking over your toes"} />
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <div className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-5 sm:p-6">
            <RepTrace reps={reps} live={running ? { r: current, p: phase } : null}
              title="Your rep as traces of knee bend and left-knee travel, against the shaded band of your normal. Stretches outside the band are faults." />
            <RepStrip className="mt-8" label="This set" reps={reps.map((r) => ({ depth: r.depth, fault: judge(r)?.joint }))} slots={SET} />
            <div className="mt-6 min-h-[10.5rem]" aria-live="polite">
              {last?.fault ? (
                <CueCard joint={last.fault.joint} cue={last.fault.cue} fix={last.fault.fix} meta={`Rep ${last.n}`} className="max-w-none bg-[var(--ground)]" />
              ) : last ? (
                <div className="rounded-md border border-[var(--line)] bg-[var(--ground)] p-4">
                  <Flag tone="clear">Rep {last.n} · in range</Flag>
                  <p className="mt-2 text-[16px]">Clean rep. {reps.filter((r) => !judge(r)).length}/{reps.length} in range.</p>
                </div>
              ) : (
                <p className="t-mono pt-2 text-[var(--ink-muted)]">Do a rep to start the set. Then try one with the knee caving.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
