import { useCallback, useMemo, useRef, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Stage } from "../components/Stage";
import { Readout } from "../components/Readout";
import { Icon } from "../components/Icon";
import { Waveform } from "../components/Waveform";
import { ScrollTrigger, useGSAP } from "../lib/gsap";
import type { Caps } from "../lib/env";
import { howPose, type HowAnchors } from "../three/scenes/HowScene";

const loadHow = () => import("../three/scenes/HowScene").then(async (m) => { await m.preload(); return m; });

export const STEPS = [
  { title: "Put on the suit.", body: "Sensors sit at every joint, on both sides of your body. Put it on and do a warm-up set." },
  { title: "It learns your normal.", body: "From your warm-up, FormGuard learns how you move: your depth, your angles, your timing. Every rep after that is checked against it." },
  { title: "AI checks every rep.", body: "Each rep is compared with known form mistakes and with your own normal. Here, on rep 7, the left knee caves in on the way up." },
  { title: "It tells you mid-set.", body: "The suit buzzes at the joint that's off, and your earbuds say how to fix it. One cue at a time: spine first, then joint alignment, then depth." },
  { title: "Between sets, see what to fix.", body: "A plain summary of the set: which rep, which joint, and what to change on the next one." },
];

/** Still progress values: the key moment of each step, for mobile and reduced motion. */
export const STEP_STILLS = [0.17, 0.33, 0.57, 0.64, 0.9];

type Pose = ReturnType<typeof howPose>;
const same = (a: Pose, b: Pose) =>
  a.step === b.step && a.rep === b.rep && a.flag === b.flag && a.good === b.good && (a.buzz > 0.5) === (b.buzz > 0.5) &&
  Math.round(a.valgus) === Math.round(b.valgus) && (a.ghost > 0.3) === (b.ghost > 0.3) && (a.nodes > 0.98) === (b.nodes > 0.98);

export function HowItWorks({ caps }: { caps: Caps }) {
  return caps.live3D ? <HowPinned caps={caps} /> : <HowStatic />;
}

/* ─────────────────────────────── desktop: pinned, scroll-driven ─────────────────────────────── */
function HowPinned({ caps }: { caps: Caps }) {
  const pin = useRef<HTMLDivElement>(null);
  const callout = useRef<HTMLDivElement>(null);
  const trig = useRef<ScrollTrigger | null>(null);
  const progress = useMemo(() => ({ current: 0 }), []);
  const [st, setSt] = useState(() => howPose(0));

  useGSAP(() => {
    trig.current = ScrollTrigger.create({
      trigger: pin.current, start: "top top", end: () => "+=" + innerHeight * 4.2, pin: true, scrub: true, anticipatePin: 1,
      onUpdate: (self) => {
        progress.current = self.progress;
        const s = howPose(self.progress);
        setSt((prev) => (same(prev, s) ? prev : s));
      },
    });
    return () => trig.current?.kill();
  }, { dependencies: [caps.live3D] });

  const onAnchors = useCallback((a: HowAnchors) => {
    const el = callout.current;
    if (!el) return;
    el.style.transform = `translate3d(${Math.round(a.knee.x)}px, ${Math.round(a.knee.y)}px, 0)`;
  }, []);

  const jump = (i: number) => {
    const t = trig.current;
    if (!t) return;
    const y = t.start + ((i + 0.55) / 5) * (t.end - t.start);
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const showCallout = (st.step === 2 || st.step === 3) && (st.flag || st.good) && st.rep >= 7;
  return (
    <Section id="how" surface="chalk" label="How it works">
      <div ref={pin} className="relative h-[100svh] min-h-[640px] overflow-hidden">
        {/* the stage: columns 5–12 */}
        <div className="absolute inset-y-0 right-0 left-[34%]">
          <Stage load={loadHow} props={{ progress, onAnchors }} live className="absolute inset-0" alt="The lifter squats in the suit: nodes come online, a ghost of their normal movement forms, rep 7's left knee caves and is flagged, the suit buzzes at the knee and the next rep is clean." />
          {/* knee callout, follows the joint */}
          <div ref={callout} aria-hidden className={`pointer-events-none absolute left-0 top-0 transition-opacity duration-300 ${showCallout ? "opacity-100" : "opacity-0"}`}>
            <span className="absolute -translate-x-1/2 -translate-y-1/2 block size-3 rotate-45 border border-current" />
            <span className="absolute left-3 top-0 block h-px w-14 bg-current opacity-60" />
            <div className="absolute left-[4.25rem] top-0 -translate-y-1/2 whitespace-nowrap">
              {st.flag
                ? <Readout status="fault" srStatus={false}>Rep {String(st.rep).padStart(2, "0")} · Knee valgus · L · {Math.max(4, Math.round(st.valgus))}°</Readout>
                : <Readout status="clear" srStatus={false}>Rep {String(st.rep).padStart(2, "0")} · Knees out · in range</Readout>}
            </div>
          </div>
          <StageHud st={st} />
          <AppScreen visible={st.step === 4} />
        </div>

        <div className="wrap pointer-events-none relative grid-12 h-full">
          <div className="pointer-events-auto col-span-4 flex h-full flex-col pb-14 pt-[calc(var(--header-h)+3.5rem)]">
            <Kicker index="02">How it works</Kicker>
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

/** What the instrument shows, per step: readouts in the stage's corners. */
function StageHud({ st }: { st: Pose }) {
  return (
    <>
      <div className="pointer-events-none absolute right-[var(--margin)] top-[calc(var(--header-h)+3.5rem)] flex flex-col items-end gap-2">
        {st.step === 0 && <Readout status={st.nodes > 0.98 ? "live" : "neutral"}>{st.nodes > 0.98 ? "All joints · online" : "Nodes coming online"}</Readout>}
        {st.step === 1 && <Readout status="live">Learning your normal · warm-up rep {Math.max(1, st.rep)}/2</Readout>}
        {st.step === 1 && st.ghost > 0.3 && <p className="t-label flex items-center gap-2 text-[var(--ink-muted)]"><span aria-hidden className="block h-px w-6 bg-[var(--ink)]/60" />Your normal</p>}
        {(st.step === 2 || st.step === 3) && <Readout status="live">Set 2 · back squat · rep {String(st.rep).padStart(2, "0")}</Readout>}
        {st.step === 2 && st.rep === 6 && <Readout status="clear">Rep 06 · In range</Readout>}
      </div>
      <div className={`pointer-events-none absolute bottom-14 left-[var(--margin)] w-[min(26rem,80%)] transition-[opacity,transform] duration-500 ease-[var(--ease-physical)] ${st.step === 3 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
        <div className="rounded-md border border-[var(--line)] bg-[var(--ground-raised)]/95 p-4">
          <div className="t-label flex items-center justify-between text-[var(--ink-muted)]">
            <span className="flex items-center gap-2"><Icon name="earbud" size={16} className="text-[var(--ink)]" />In your earbuds</span>
            <Waveform speaking={st.buzz > 0.5} className="text-[var(--ink)]" />
          </div>
          <p className="t-head mt-2 text-[28px] leading-8">Knees out.</p>
          <p className="t-label mt-4 flex items-center gap-2 text-[var(--ink-muted)]"><Icon name="buzz" size={14} className="text-[var(--signal-ink)]" />Buzz at the left knee · audio optional</p>
        </div>
      </div>
    </>
  );
}

/** Between sets: the app, in plain words. Dark, the in-app default: the phone sits on a bench in a dim gym. */
const SET = [0.98, 1, 0.97, 1, 0.99, 0.96, 0.97, 0.98];   // depth of each rep, 0–1 of the lifter's normal
const FAULT_REP = 7;

export function AppScreen({ visible = true, className = "" }: { visible?: boolean; className?: string }) {
  return (
    <div aria-hidden={!visible} className={`${visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-6"} transition-[opacity,transform] duration-700 ease-[var(--ease-physical)] ${className || "absolute right-[var(--margin)] top-1/2 w-[19.5rem] -translate-y-1/2"}`}>
      <div className="rounded-[32px] bg-[#0d0c0a] p-[7px]">
        <div className="surface-iron rounded-[24px] px-5 pb-6 pt-5">
          <p className="t-mono text-[var(--ink-muted)]">Set 2 · back squat</p>
          <p className="t-head mt-2 text-[28px] leading-8">One thing to fix.</p>

          {/* RepStrip: every rep as a bar of its depth; clean reps neutral, the fault rep red and numbered */}
          <div className="mt-5 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="t-label text-[var(--ink-muted)]">Reps</span>
              <span className="t-mono text-[var(--ink)]">7/8 in range</span>
            </div>
            <ol className="flex h-16 items-end gap-2 border-b border-[var(--line-strong)]" aria-label="Reps">
              {SET.map((d, i) => (
                <li key={i} className="flex h-full flex-1 flex-col justify-end">
                  <span className={`block rounded-t-sm ${i + 1 === FAULT_REP ? "bg-[var(--signal)] shadow-[inset_0_0_0_2px_var(--signal-ink)]" : "bg-[var(--line-strong)]"}`} style={{ height: `${d * 100}%` }} />
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              {SET.map((_, i) => (
                <span key={i} className={`t-mono flex-1 text-center ${i + 1 === FAULT_REP ? "font-medium text-[var(--signal-ink)]" : "text-[var(--ink-muted)]"}`}>{i + 1}</span>
              ))}
            </div>
          </div>

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
        <Kicker index="02">How it works</Kicker>
        <h2 className="t-head mt-6 text-h2">It learns you, then checks every rep.</h2>
        <ol className="mt-14 space-y-16">
          {STEPS.map((s, i) => {
            const st = howPose(STEP_STILLS[i]);
            return (
              <li key={i} className="grid-12 gap-y-6">
                <div className="col-span-12 md:col-span-5">
                  <p className="t-mono text-[var(--ink-muted)]">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="t-head mt-3 text-h3">{s.title}</h3>
                  <p className="mt-3 max-w-[40ch] text-[var(--ink)]/90">{s.body}</p>
                </div>
                <div className="col-span-12 md:col-span-7">
                  {i < 4 ? (
                    <figure className="relative aspect-[4/5] overflow-hidden bg-[var(--ground-raised)] sm:aspect-[16/11]">
                      <img src={`/stills/how-${i + 1}.webp`} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                      <figcaption className="absolute left-3 top-3 flex flex-col items-start gap-2">
                        {i === 0 && <Readout status="live">All joints · online</Readout>}
                        {i === 1 && <Readout status="live">Learning your normal</Readout>}
                        {i === 2 && <Readout status="fault">Rep 07 · Knee valgus · L · {Math.round(st.valgus)}°</Readout>}
                        {i === 3 && <Readout status="fault">Buzz · left knee</Readout>}
                      </figcaption>
                      {i === 3 && (
                        <div className="absolute inset-x-3 bottom-3 rounded-md border border-[var(--line)] bg-[var(--ground-raised)]/95 p-4">
                          <p className="t-label flex items-center gap-2 text-[var(--ink-muted)]"><Icon name="earbud" size={14} className="text-[var(--ink)]" />In your earbuds</p>
                          <p className="t-head mt-2 text-[28px] leading-8">Knees out.</p>
                        </div>
                      )}
                    </figure>
                  ) : (
                    <AppScreen className="mx-auto w-full max-w-[20rem]" />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}
