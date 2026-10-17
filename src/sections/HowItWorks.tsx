import { useRef, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Readout } from "../components/Readout";
import { RepStrip } from "../components/RepStrip";
import { Icon } from "../components/Icon";
import { Waveform } from "../components/Waveform";
import { ScrollTrigger, useGSAP } from "../lib/gsap";
import type { Caps } from "../lib/env";
import { RepTrace } from "../viz/RepTrace";
import { JointGrid, ONLINE_ORDER } from "../viz/JointGrid";
import type { RepParams } from "../viz/signal";
import { repDepth } from "../viz/lift";
import { howPose, VALGUS, type HowState } from "../viz/how";

export const STEPS = [
  { title: "Put on the suit.", body: "Sensors sit at every joint, on both sides of your body. Put it on and do a warm-up set." },
  { title: "It learns your normal.", body: "From your warm-up, FormGuard learns how you move: your depth, your angles, your timing. Every rep after that is checked against it." },
  { title: "AI checks every rep.", body: "Each rep is compared with known form mistakes and with your own normal. Here, on rep 7, the left knee caves in on the way up." },
  { title: "It tells you mid-set.", body: "The suit buzzes at the joint that's off, and your earbuds say how to fix it. One cue at a time: spine first, then joint alignment, then depth." },
  { title: "Between sets, see what to fix.", body: "A plain summary of the set: which rep, which joint, and what to change on the next one." },
];

/** Still progress values: the key moment of each step, for mobile and reduced motion. */
export const STEP_STILLS = [0.17, 0.33, 0.57, 0.64, 0.9];

export function HowItWorks({ caps }: { caps: Caps }) {
  return caps.pin ? <HowPinned /> : <HowStatic />;
}

/** The reps of the story: two warm-up reps (set 1), then set 2, where rep 7's left knee caves. */
const warmup = (i: number): RepParams => ({ depth: 1, cave: 0, seed: 40 + i });
const set2 = (n: number): RepParams => ({ depth: repDepth(n), cave: n === 7 ? VALGUS : 0, seed: n });

/** What the instrument shows at one moment of the story. */
function HowStage({ st, compact = false }: { st: HowState; compact?: boolean }) {
  if (st.step === 0) {
    const lit = Math.round(st.nodes * ONLINE_ORDER.length);
    return (
      <div>
        <Readout status={lit === ONLINE_ORDER.length ? "live" : "neutral"}>{lit === ONLINE_ORDER.length ? "All joints · online" : `Joints coming online · ${lit}/${ONLINE_ORDER.length}`}</Readout>
        <JointGrid className="mt-5" state={(j) => (ONLINE_ORDER.indexOf(j) < lit ? "on" : "off")} />
      </div>
    );
  }
  const warm = st.step === 1;
  const done = warm ? Array.from({ length: st.rep - 1 }, (_, i) => warmup(i)) : Array.from({ length: st.rep - 1 }, (_, i) => set2(i + 1));
  const live = st.step === 4 ? null : { r: warm ? warmup(st.rep - 1) : set2(st.rep), p: st.phase };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {warm
          ? <Readout status="live">Learning your normal · warm-up rep {Math.max(1, st.rep)}/2</Readout>
          : <Readout status="live">Set 2 · back squat · rep {String(st.rep).padStart(2, "0")}</Readout>}
        {st.flag && <Readout status="fault">Rep 07 · Knee valgus · L · {Math.max(4, Math.round(st.valgus))}°</Readout>}
        {!warm && !st.flag && st.rep >= 7 && st.good && <Readout status="clear">Rep {String(st.rep).padStart(2, "0")} · Knees out · in range</Readout>}
      </div>
      <RepTrace className={compact ? "mt-4" : "mt-6"} compact={compact} reps={done} live={live} bandOpacity={warm ? st.ghost : 1}
        title={warm ? "Warm-up reps: the shaded band of your normal forms around them." : "Set 2: each rep against your normal. On rep 7 the left knee's trace leaves the band."} />
      {!warm && !(compact && st.step === 3) && <RepStrip className={compact ? "mt-4" : "mt-6"} label="Set 2" reps={done.map((r, i) => ({ depth: r.depth, fault: i + 1 === 7 && "Knees caving" }))} slots={8} />}
      {st.step === 3 && (
        <div className={`${compact ? "mt-4" : "mt-6"} rounded-md border border-[var(--line)] bg-[var(--ground)] p-4`}>
          <div className="t-label flex items-center justify-between text-[var(--ink-muted)]">
            <span className="flex items-center gap-2"><Icon name="earbud" size={16} className="text-[var(--ink)]" />In your earbuds</span>
            <Waveform speaking={st.buzz > 0.5} className="text-[var(--ink)]" />
          </div>
          <p className="t-head mt-2 text-[28px] leading-8">Knees out.</p>
          <p className="t-label mt-3 flex items-center gap-2 text-[var(--ink-muted)]"><Icon name="buzz" size={14} className="text-[var(--signal-ink)]" />Buzz at the left knee · audio optional</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── desktop: pinned, scroll-driven ─────────────────────────────── */
function HowPinned() {
  const pin = useRef<HTMLDivElement>(null);
  const trig = useRef<ScrollTrigger | null>(null);
  const [st, setSt] = useState(() => howPose(0));

  useGSAP(() => {
    trig.current = ScrollTrigger.create({
      trigger: pin.current, start: "top top", end: () => "+=" + innerHeight * 4.2, pin: true, anticipatePin: 1,
      onUpdate: (self) => setSt(howPose(self.progress)),
    });
    return () => trig.current?.kill();
  });

  const jump = (i: number) => {
    const t = trig.current;
    if (!t) return;
    window.scrollTo({ top: t.start + ((i + 0.55) / 5) * (t.end - t.start), behavior: "smooth" });
  };

  return (
    <Section id="how" surface="chalk" label="How it works">
      <div ref={pin} className="relative h-[100svh] min-h-[640px] overflow-hidden">
        {/* the stage: columns 5–12 */}
        <div className="absolute inset-y-0 right-0 left-[38%] flex items-center justify-center pb-10 pl-6 pr-[var(--margin)] pt-[calc(var(--header-h)+2rem)]">
          <div className={`w-full max-w-[36rem] rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-6 transition-[opacity,transform] duration-500 ease-[var(--ease-physical)] ${st.step === 4 ? "pointer-events-none -translate-x-6 opacity-0" : ""}`}>
            <HowStage st={st} compact />
          </div>
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-[19.5rem] -translate-x-1/2 -translate-y-1/2">
            <AppScreen visible={st.step === 4} />
          </div>
        </div>

        <div className="wrap pointer-events-none relative grid-12 h-full">
          <div className="pointer-events-auto col-span-4 flex h-full flex-col pb-14 pt-[calc(var(--header-h)+3.5rem)]">
            <Kicker index="03">How it works</Kicker>
            <h2 className="t-head mt-6 text-[clamp(2.25rem,3.4vw,3.75rem)] leading-[0.98]">It learns you, then checks every rep.</h2>
            <ol className="mt-10 border-l border-[var(--line-strong)]">
              {STEPS.map((s, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={`absolute -left-px top-0 h-full w-[2px] origin-top bg-[var(--ink)] transition-transform duration-500 ease-[var(--ease-physical)] ${st.step === i ? "scale-y-100" : "scale-y-0"}`} />
                  <button type="button" onClick={() => jump(i)} aria-current={st.step === i ? "step" : undefined}
                    className={`flex w-full items-baseline gap-4 py-2.5 pl-5 text-left transition-colors duration-300 ${st.step === i ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                    <span className="t-mono w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="t-title">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="relative mt-auto min-h-[8.5rem]" aria-live="polite">
              {STEPS.map((s, i) => (
                <p key={i} className={`absolute inset-x-0 bottom-0 max-w-[38ch] text-lead transition-[opacity,transform] duration-500 ease-[var(--ease-physical)] ${st.step === i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
                  {s.body}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Between sets: the app, in plain words. Dark, the in-app default: the phone sits on a bench in a dim gym. */
const SET = [0.98, 1, 0.97, 1, 0.99, 0.96, 0.97, 0.98];   // depth of each rep, 0–1 of the lifter's normal
const FAULT_REP = 7;

export function AppScreen({ visible = true, className = "" }: { visible?: boolean; className?: string }) {
  return (
    <div aria-hidden={!visible} className={`${visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-6"} transition-[opacity,transform] duration-700 ease-[var(--ease-physical)] ${className}`}>
      <div className="rounded-[32px] bg-[#0d0c0a] p-[7px]">
        <div className="surface-iron rounded-[24px] px-5 pb-6 pt-5">
          <p className="t-mono text-[var(--ink-muted)]">Set 2 · back squat</p>
          <p className="t-head mt-2 text-[28px] leading-8">One thing to fix.</p>

          <RepStrip className="mt-5" label="Reps" reps={SET.map((depth, i) => ({ depth, fault: i + 1 === FAULT_REP && "Knees caving" }))} />

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="t-label flex items-center gap-2 text-[var(--signal-ink)]"><span aria-hidden className="block size-2 rounded-full bg-current" />Knees caving · rep 7</p>
            <p className="mt-2 text-[15px] leading-[1.45]">Your left knee caved in on the way up. Next set, push your knees out over your toes as you stand.</p>
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <p className="t-label flex items-center gap-2 text-[var(--ink-muted)]"><span aria-hidden className="block size-2 rounded-full border-[1.5px] border-current" />In range · depth</p>
            <p className="mt-2 text-[15px] leading-[1.45]">Every rep reached your normal depth.</p>
          </div>
          <div className="mt-6 flex h-12 items-center justify-center rounded-md bg-[var(--ink)] text-[16px] font-semibold text-[var(--ground)]">Start set 3</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── mobile / reduced motion: the same story, stacked ─────────────────────────────── */
function HowStatic() {
  return (
    <Section id="how" surface="chalk" label="How it works">
      <div className="wrap pb-24 pt-24">
        <Kicker index="03">How it works</Kicker>
        <h2 className="t-head mt-6 text-h2">It learns you, then checks every rep.</h2>
        <ol className="mt-14 space-y-16">
          {STEPS.map((s, i) => (
            <li key={i} className="grid-12 gap-y-6">
              <div className="col-span-12 md:col-span-5">
                <p className="t-mono text-[var(--ink-muted)]">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="t-head mt-3 text-h3">{s.title}</h3>
                <p className="mt-3 max-w-[40ch] text-[var(--ink)]/90">{s.body}</p>
              </div>
              <div className="col-span-12 md:col-span-7">
                {i < 4 ? (
                  <div className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-4 sm:p-6"><HowStage st={howPose(STEP_STILLS[i])} /></div>
                ) : (
                  <AppScreen className="mx-auto w-full max-w-[20rem]" />
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
