import { useState, type ReactNode } from "react";
import { Logo } from "../components/Logo";
import { Button } from "../components/Button";
import { Kicker } from "../components/Kicker";
import { Readout } from "../components/Readout";
import { Scale } from "../components/Scale";
import { CropMarks } from "../components/CropMarks";
import { ChipGroup, Field } from "../components/Field";
import { Icon, ICON_NAMES } from "../components/Icon";
import { Waveform } from "../components/Waveform";
import { contrast } from "../lib/contrast";

const C = {
  iron: "#1b1a17", chalk: "#f2ede4", red: "#c62b22", redOnDark: "#ea5a4e", go: "#1b6e53", goOnDark: "#4fc193",
  iron2: "#23221e", iron3: "#2f2d29", iron4: "#47443d", stone6: "#6b665e", stone4: "#9a948a", chalk3: "#d6cfc1", chalk2: "#e7e1d5",
};

function Band({ index, title, note, children, dark = false, id, stack = false }: {
  index: string; title: string; note?: ReactNode; children: ReactNode; dark?: boolean; id?: string; stack?: boolean;
}) {
  return (
    <section id={id} className={`${dark ? "surface-iron" : "surface-chalk"} grain border-t border-[var(--rule)]`}>
      <div className="wrap grid-12 gap-y-10 py-20 lg:py-28">
        <header className={`col-span-12 ${stack ? "lg:grid-12 lg:gap-x-[var(--gutter)]" : "lg:col-span-3"}`}>
          <div className={stack ? "lg:col-span-3" : ""}><Kicker index={index}>{title}</Kicker></div>
          {note && <div className={`mt-5 max-w-[34ch] text-small text-[var(--muted)] ${stack ? "lg:col-span-5 lg:mt-0 lg:max-w-[52ch]" : ""}`}>{note}</div>}
        </header>
        <div className={`col-span-12 ${stack ? "" : "lg:col-span-9"}`}>{children}</div>
      </div>
    </section>
  );
}

function Ratio({ fg, bg }: { fg: string; bg: string }) {
  const r = contrast(fg, bg);
  const pass = r >= 4.5 ? "AA" : r >= 3 ? "AA large · UI" : "decorative only";
  return <span>{r.toFixed(2)}:1 · {pass}</span>;
}

function Swatch({ name, hex, role, big = false, on = "auto" }: { name: string; hex: string; role: string; big?: boolean; on?: "auto" }) {
  void on;
  const darkInk = contrast(hex, C.iron) > contrast(hex, C.chalk);
  return (
    <div className={big ? "col-span-12 sm:col-span-4" : "col-span-6 sm:col-span-3"}>
      <div className={`flex flex-col justify-between p-4 ${big ? "h-56" : "h-32"}`} style={{ background: hex, color: darkInk ? C.iron : C.chalk }}>
        <span className="t-mono">{hex.toUpperCase()}</span>
        <span className={big ? "t-head text-h3" : "font-text text-[15px] font-[620]"}>{name}</span>
      </div>
      <dl className="t-mono mt-3 space-y-1 text-[var(--muted)] normal-case tracking-[0.02em]">
        <dd className="text-[var(--fg)]">{role}</dd>
        <dd>on Chalk <Ratio fg={hex} bg={C.chalk} /></dd>
        <dd>on Iron <Ratio fg={hex} bg={C.iron} /></dd>
      </dl>
    </div>
  );
}

function TypeRow({ role, spec, children, full = false }: { role: string; spec: string; children: ReactNode; full?: boolean }) {
  return (
    <div className="grid-12 items-baseline gap-y-4 border-t border-[var(--rule)] py-8">
      <div className={`col-span-12 ${full ? "" : "md:col-span-3"}`}>
        <p className="font-text text-[15px] font-[620]">{role}</p>
        <p className="t-mono mt-1 text-[var(--muted)] normal-case tracking-[0.02em]">{spec}</p>
      </div>
      <div className={`col-span-12 min-w-0 ${full ? "" : "md:col-span-9"}`}>{children}</div>
    </div>
  );
}

function Curve({ name, d, bez }: { name: string; d: string; bez: string }) {
  return (
    <figure className="col-span-12 sm:col-span-6">
      <CropMarks className="text-[var(--fg)]">
        <svg viewBox="-6 -6 112 112" className="aspect-square w-full max-w-[260px]" aria-hidden>
          <path d="M0 100H100M0 100V0" stroke="currentColor" strokeOpacity=".25" fill="none" />
          <path d={d} stroke="var(--color-red)" strokeWidth="2" fill="none" />
        </svg>
      </CropMarks>
      <figcaption className="t-mono mt-4 text-[var(--muted)]"><span className="text-[var(--fg)]">{name}</span> · {bez}</figcaption>
    </figure>
  );
}

export function Styleguide() {
  const [lifts, setLifts] = useState<string[]>(["squat", "deadlift"]);
  const [freq, setFreq] = useState<string[]>(["3-4"]);
  return (
    <main>
      {/* ─── cover ─── */}
      <section className="surface-iron grain platform-grid">
        <div className="wrap grid-12 min-h-[78vh] content-between gap-y-16 pb-14 pt-10">
          <div className="col-span-12 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Logo tone="reversed" height={30} />
            <span className="t-mono text-[var(--muted)]">Design system · v0.1 · Oct 2026</span>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <Kicker index="00">Style guide</Kicker>
            <h1 className="t-display mt-6 text-h1 uppercase">One system,<br />every rep.</h1>
          </div>
          <div className="col-span-12 grid-12 gap-y-6 border-t border-[var(--rule-strong)] pt-6 t-mono text-[var(--muted)]">
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--fg)]">Grid</span><br />12 columns · gutter 12–28 · margin 20–88</p>
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--fg)]">Type</span><br />FG Display · FG Text · FG Mono</p>
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--fg)]">Colour</span><br />Iron · Chalk · Plate Red · Go</p>
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--fg)]">Base unit</span><br />4px · scale 4 → 256</p>
          </div>
        </div>
      </section>

      {/* ─── grid ─── */}
      <Band index="01" title="Grid" stack note={<>Twelve columns inside fluid margins. Text aligns to columns, not to the centre. Compositions change section to section, but the grid stays the same.</>}>
        <div className="relative">
          <div className="grid-12 h-56">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="relative bg-[color-mix(in_srgb,var(--color-red)_10%,transparent)] outline outline-1 -outline-offset-1 outline-[color-mix(in_srgb,var(--color-red)_35%,transparent)]">
                <span className="t-mono absolute left-1.5 top-1.5 text-red">{String(i + 1).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
          <Scale ticks={48} major={4} className="mt-4 text-[var(--muted)]" labels={["0", null, null, "3", null, null, "6", null, null, "9", null, null, "12"]} />
        </div>
      </Band>

      {/* ─── colour ─── */}
      <Band index="02" title="Colour" note={<>Three brand colours, one functional green for good reps, and neutrals mixed from Iron and Chalk. Good and bad always use an icon and a word as well as colour.</>}>
        <div className="grid-12 gap-y-10">
          <Swatch big name="Iron Black" hex={C.iron} role="Text · dark gym sections" />
          <Swatch big name="Chalk" hex={C.chalk} role="Light sections · text on dark" />
          <Swatch big name="Plate Red" hex={C.red} role="Accent · flagged reps" />
          <Swatch name="Red on dark" hex={C.redOnDark} role="Small flagged text on Iron" />
          <Swatch name="Go" hex={C.go} role="Good rep, on Chalk" />
          <Swatch name="Go on dark" hex={C.goOnDark} role="Good rep, on Iron" />
          <Swatch name="Stone 6" hex={C.stone6} role="Muted text on Chalk" />
          <Swatch name="Stone 4" hex={C.stone4} role="Muted text on Iron" />
          <Swatch name="Iron 2" hex={C.iron2} role="Raised surface, dark" />
          <Swatch name="Iron 4" hex={C.iron4} role="Rules, idle nodes" />
          <Swatch name="Chalk 3" hex={C.chalk3} role="Rules on Chalk" />
        </div>
      </Band>

      {/* ─── type ─── */}
      <Band index="03" title="Type" dark stack note={<>FG Display is Hubot Sans, the wordmark's face: heavy and wide, used huge. FG Text (Mona Sans) for reading. FG Mono (IBM Plex Mono) for anything measured. Hubot's zero is barred, so big numbers are set in FG Text, wide.</>}>
        <TypeRow full role="Giant" spec="FG Text 860 · width 125 · 88 → 352px · 0.82">
          <p className="t-num text-giant leading-[0.82]">$70–120</p>
        </TypeRow>
        <TypeRow full role="Headline 1" spec="FG Display 800 · width 110 · 52 → 168px · 0.9">
          <p className="t-display text-h1 uppercase">Coaching, without the coach.</p>
        </TypeRow>
        <TypeRow role="Headline 2" spec="FG Display 760 · width 105 · 40 → 96px · 0.96">
          <p className="t-head text-h2">A camera sees one side.</p>
        </TypeRow>
        <TypeRow role="Headline 3" spec="FG Display 760 · width 105 · 26 → 44px · 1.04">
          <p className="t-head text-h3">The suit buzzes at the joint that's off.</p>
        </TypeRow>
        <TypeRow role="Lead" spec="FG Text 440 · 19 → 24px · 1.42">
          <p className="max-w-[46ch] text-lead font-[440]">FormGuard helps lifters fix their form without a personal trainer, using a sensor suit and AI.</p>
        </TypeRow>
        <TypeRow role="Body" spec="FG Text 420 · 17px · 1.55 · max 62ch">
          <p className="max-w-[62ch]">Between sets, see exactly what to fix: which rep, which joint, and what to do about it on the next set.</p>
        </TypeRow>
        <TypeRow role="Mono label" spec="FG Mono 500 · 11.5px · +8% · caps">
          <div className="flex flex-wrap gap-3">
            <Readout>REP 07 · KNEE VALGUS · L · 12°</Readout>
            <span className="t-mono self-center text-[var(--muted)]">Fig. 03 · Front view, 1:20</span>
          </div>
        </TypeRow>
      </Band>

      {/* ─── space ─── */}
      <Band index="04" title="Space" note={<>A 4px base. Sections draw from the large end (96 → 256) and never all use the same padding.</>}>
        <div className="space-y-3">
          {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256].map((s) => (
            <div key={s} className="flex items-center gap-4">
              <span className="t-mono w-12 text-right text-[var(--muted)]">{s}</span>
              <span className="block h-3 bg-iron" style={{ width: s }} />
            </div>
          ))}
        </div>
      </Band>

      {/* ─── components ─── */}
      <Band index="05" title="Components" note={<>Square corners and hairline rules. Plate Red is reserved for the one call to action and for flags. Every state is visible: hover, focus, error, done.</>}>
        <div className="grid-12 gap-y-10">
          {(["chalk", "iron"] as const).map((s) => (
            <div key={s} className={`col-span-12 xl:col-span-6 surface-${s} grain p-6 sm:p-8 outline outline-1 -outline-offset-1 outline-[var(--rule)]`}>
              <p className="t-mono mb-6 text-[var(--muted)]">On {s === "chalk" ? "Chalk" : "Iron"}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button arrow>Become a test lifter</Button>
                <Button variant="secondary">How it works</Button>
                <Button size="sm" variant="secondary" disabled>Disabled</Button>
              </div>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <Field label="Name" placeholder="Your name" autoComplete="name" />
                <Field label="Email" type="email" defaultValue="lifter@" error="Enter a full email address" />
              </div>
              <div className="mt-6">
                <ChipGroup legend="What do you lift?" name={`lift-${s}`} value={lifts} onChange={setLifts}
                  options={["Squat", "Deadlift", "Bench", "Overhead press", "Curls", "Other"].map((l) => ({ value: l.toLowerCase(), label: l }))} />
              </div>
              <div className="mt-6">
                <ChipGroup legend="How often do you train?" type="radio" name={`freq-${s}`} value={freq} onChange={setFreq}
                  options={[{ value: "1-2", label: "1–2× a week" }, { value: "3-4", label: "3–4×" }, { value: "5+", label: "5+" }]} />
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <Readout status="live">16 nodes · online</Readout>
                <Readout status="flag">REP 07 · Knee valgus · L · 12°</Readout>
                <Readout status="good">REP 08 · Good</Readout>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Icon name="earbud" size={20} />
                <span className="font-text text-[17px] font-[620]">“Knees out.”</span>
                <Waveform speaking className="text-red" />
              </div>
              <div className="mt-8"><Kicker index="03">How it works</Kicker></div>
              <Scale className="mt-8 text-[var(--muted)]" ticks={60} major={10} range={[0.583, 1]} marker={0.7}
                labels={["$0", null, "$20", null, "$40", null, "$60", null, "$80", null, "$100", null, "$120"]} />
            </div>
          ))}
        </div>
      </Band>

      {/* ─── icons ─── */}
      <Band index="06" title="Icons" dark note={<>Drawn for FormGuard on a 24-unit grid: 1.5 stroke, square caps, joints as solid nodes, the same anatomy as the 3D figure's sensors. No icon library.</>}>
        <div className="grid grid-cols-3 gap-px bg-[var(--rule)] sm:grid-cols-5 lg:grid-cols-8">
          {ICON_NAMES.map((n) => (
            <div key={n} className="flex aspect-square flex-col items-center justify-center gap-4 bg-[var(--bg)]">
              <Icon name={n} size={40} />
              <span className="t-mono text-[var(--muted)]">{n}</span>
            </div>
          ))}
        </div>
      </Band>

      {/* ─── texture + instruments ─── */}
      <Band index="07" title="Texture & instruments" note={<>Chalk grain on light sections, film grain on dark, a faint platform grid at 1 m = 48px. Rules, ticks and crop marks only where something is measured or framed.</>}>
        <div className="grid-12 gap-y-6">
          <div className="col-span-12 sm:col-span-4"><div className="surface-chalk grain h-48 outline outline-1 -outline-offset-1 outline-[var(--rule)]" /><p className="t-mono mt-3 text-[var(--muted)]">Chalk grain · multiply 35%</p></div>
          <div className="col-span-12 sm:col-span-4"><div className="surface-iron grain h-48" /><p className="t-mono mt-3 text-[var(--muted)]">Film grain · soft-light 22%</p></div>
          <div className="col-span-12 sm:col-span-4"><div className="surface-iron platform-grid h-48" /><p className="t-mono mt-3 text-[var(--muted)]">Platform grid · 7%</p></div>
          <div className="col-span-12 mt-8 grid-12 gap-y-10">
            <Curve name="Physical" bez="cubic-bezier(.22,1,.36,1)" d="M0 100C22 0 36 0 100 0" />
            <Curve name="Lift" bez="cubic-bezier(.65,0,.35,1)" d="M0 100C65 100 35 0 100 0" />
          </div>
        </div>
      </Band>

      {/* ─── logo ─── */}
      <Band index="08" title="Logo" dark note={<>Every logo on the site renders through one &lt;Logo&gt; component. The symbol switches to its pixel-drawn cuts below 48px.</>}>
        <div className="flex flex-col gap-12">
          <Logo tone="reversed" height={64} className="h-auto w-full max-w-[505px]" />
          <div className="flex flex-wrap items-end gap-10">
            {[96, 48, 40, 24, 16].map((h) => (
              <div key={h} className="flex flex-col items-start gap-3">
                <Logo variant="symbol" tone="reversed" height={h} />
                <span className="t-mono text-[var(--muted)]">{h}px · {h >= 48 ? "master" : h >= 32 ? "32 cut" : "16 cut"}</span>
              </div>
            ))}
          </div>
          <div className="surface-chalk inline-block w-full max-w-[420px] self-start p-8 sm:p-10"><Logo variant="stacked" tone="primary" height={150} className="h-auto w-full" /></div>
        </div>
      </Band>
    </main>
  );
}
