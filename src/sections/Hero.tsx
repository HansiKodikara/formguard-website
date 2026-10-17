import { useCallback, useState } from "react";
import { Stage } from "../components/Stage";
import { ButtonLink } from "../components/Button";
import { Readout } from "../components/Readout";
import { Section } from "../components/Section";
import { SITE } from "../config";
import type { Caps } from "../lib/env";
import { NODES } from "../three/body";
import type { HeroHud } from "../three/scenes/HeroScene";

const loadHero = () => import("../three/scenes/HeroScene").then(async (m) => { await m.preload(); return m; });

export function Hero({ caps }: { caps: Caps }) {
  const [hud, setHud] = useState<HeroHud | null>(null);
  const onHud = useCallback((h: HeroHud) => setHud(h), []);
  const total = NODES.length;
  const shown = caps.live3D ? hud?.nodes ?? 0 : total;
  return (
    <Section id="top" surface="chalk" label="Introduction" className="overflow-hidden [--hero-foot:5.5rem]">
      <Stage load={loadHero} props={{ onHud }} live={caps.live3D} still="/stills/hero.webp" alt="A lifter in the FormGuard sensor suit squats on a lifting platform in daylight. Sensor nodes glow at every joint and a skeleton overlay tracks the movement." className="absolute inset-x-0 top-0 bottom-[var(--hero-foot)]" />
      <div className="wrap relative grid-12 min-h-[100svh] content-between gap-y-12 pb-10 pt-[calc(var(--header-h)+clamp(2.5rem,9vh,7rem))] lg:pb-12">
        <div className="col-span-12 lg:col-span-8 2xl:col-span-9">
          <p className="t-mono flex items-center gap-3 text-[var(--muted)]">
            <span aria-hidden className="h-px w-6 bg-red" />In development · test lifters wanted
          </p>
          <h1 className="t-display mt-6 text-[clamp(2.75rem,12.2vw,4.25rem)] uppercase leading-[0.9] lg:text-[clamp(4rem,6.85vw,8.5rem)]">
            Coaching,<br />without the<br />coach.
          </h1>
          <p className="mt-8 max-w-[34ch] text-lead font-[440] text-[var(--fg)]/90 lg:mt-10">{SITE.oneLiner}</p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <ButtonLink href="#test-lifter" arrow>Become a test lifter</ButtonLink>
            <a href="#how" className="group inline-flex items-center gap-2 font-[560] underline decoration-[var(--rule-strong)] decoration-1 underline-offset-[6px] transition-colors hover:decoration-[var(--fg)]">
              See how it works
            </a>
          </div>
        </div>
        <div className="col-span-12 grid-12 h-[var(--hero-foot)] items-center border-t border-[var(--rule)] -mb-10 lg:-mb-12">
          <div className="t-mono col-span-4 flex items-center gap-4 text-[var(--muted)] lg:col-span-6">
            <span aria-hidden className="relative block h-9 w-px overflow-hidden bg-[var(--rule-strong)]">
              <span className="absolute inset-x-0 top-0 h-3 bg-[var(--fg)] motion-safe:animate-[fg-scroll_2.4s_var(--ease-lift)_infinite]" />
            </span>
            Scroll
          </div>
          <div className="col-span-8 flex flex-col items-end gap-3 lg:col-span-6 lg:flex-row lg:items-center lg:justify-end lg:gap-6">
            <Readout status={shown === total ? "live" : "neutral"} className="tabular-nums">
              Nodes · {String(shown).padStart(2, "0")}/{total}
            </Readout>
            {caps.live3D && hud && hud.rep > 0 ? (
              <Readout status="good" className="tabular-nums">Rep {String(hud.rep).padStart(2, "0")} · Knee {String(hud.knee).padStart(3, "0")}° · Depth {String(hud.depth).padStart(3, "0")}%</Readout>
            ) : (
              <p className="t-mono hidden text-[var(--muted)] lg:block">Fig. 01 · Warm-up set, every joint measured</p>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
