import { useEffect, useRef, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { RepStrip } from "../components/RepStrip";
import { SquatStill, SquatVideo } from "../components/SquatView";
import type { Caps } from "../lib/env";
import { howPose } from "../viz/how";

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
  return caps.pin ? <HowPlayer /> : <HowStatic />;
}

/* ─────────────────────────────── desktop: the story plays on its own ─────────────────────────────── */
/** the pause on the app summary before the story starts again (ms) */
const END_HOLD_MS = 3500;
function HowPlayer() {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [st, setSt] = useState(() => howPose(0));
  const [playing, setPlaying] = useState(true);     // the visitor's choice (the pause button)
  const [inView, setInView] = useState(false);
  const hold = useRef(0);                          // the rest on the summary, before it starts again

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.intersectionRatio > 0.45), { threshold: [0, 0.45, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // the video is the clock: the story follows its time. It plays only while the section is on screen, and after
  // the end it rests on the app summary, then starts again.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!playing || !inView) { v.pause(); return; }
    let raf = 0;
    const sync = () => {
      if (v.duration) setSt(howPose(v.ended ? 1 : v.currentTime / v.duration));
      raf = requestAnimationFrame(sync);
    };
    const ended = () => { hold.current = window.setTimeout(() => { v.currentTime = 0; v.play().catch(() => {}); }, END_HOLD_MS); };
    v.addEventListener("ended", ended);
    if (v.ended) ended(); else v.play().catch(() => {});
    raf = requestAnimationFrame(sync);
    return () => { cancelAnimationFrame(raf); clearTimeout(hold.current); v.removeEventListener("ended", ended); };
  }, [playing, inView]);

  const jump = (i: number) => {
    const v = video.current;
    const p = i / 5 + 0.002;
    clearTimeout(hold.current);
    if (v?.duration) { v.currentTime = p * v.duration; if (playing && inView) v.play().catch(() => {}); }
    setSt(howPose(p));
  };

  return (
    <Section id="how" surface="chalk" label="How it works">
      <div ref={box} className="relative h-[100svh] min-h-[640px] overflow-hidden">
        {/* the stage: columns 5–12 */}
        <div className="absolute inset-y-0 right-0 left-[38%] flex items-center justify-center gap-6 pb-10 pl-6 pr-[var(--margin)] pt-[calc(var(--header-h)+2rem)]">
          {/* the lifter, rendered: scrolling scrubs the rep */}
          <SquatVideo ref={video} st={st} className={`h-[min(calc(100svh-var(--header-h)-5rem),46rem)] shrink-0 transition-[opacity,transform] duration-500 ease-[var(--ease-physical)] ${st.step === 4 ? "pointer-events-none -translate-x-6 opacity-0" : ""}`} />
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
                  <span aria-hidden className="absolute -left-px top-0 h-full w-[2px] origin-top bg-[var(--ink)]"
                    style={{ transform: `scaleY(${st.step === i ? Math.max(0.04, st.local) : 0})` }} />
                  <button type="button" onClick={() => jump(i)} aria-current={st.step === i ? "step" : undefined}
                    className={`flex w-full items-baseline gap-4 py-2.5 pl-5 text-left transition-colors duration-300 ${st.step === i ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
                    <span className="t-mono w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="t-title">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setPlaying((v) => !v)} aria-pressed={!playing}
              className="t-mono mt-6 flex items-center gap-2 self-start pl-5 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]">
              <span aria-hidden className="flex size-3 items-center justify-center">
                {playing
                  ? <span className="flex gap-[3px]"><span className="block h-3 w-[3px] bg-current" /><span className="block h-3 w-[3px] bg-current" /></span>
                  : <span className="block size-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />}
              </span>
              {playing ? "Pause" : "Play"}
            </button>
            <div className="relative mt-auto min-h-[8.5rem]" aria-live={playing ? "off" : "polite"}>
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
                  <SquatStill step={i} st={howPose(STEP_STILLS[i])} className="mx-auto w-full max-w-[24rem]" />
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
