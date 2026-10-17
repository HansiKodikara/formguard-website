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

// FormGuard-design-system/tokens.json
const C = {
  iron: "#1b1a17", chalk: "#f2ede4", red: "#c62b22", redInkDark: "#ec6157",
  chalkRaised: "#faf7f1", chalkLine: "#dcd5c9", stoneStrong: "#8a8378", stone: "#5e584f",
  ironRaised: "#24221e", ironLine: "#38352f", ashStrong: "#7d776d", ash: "#ada79d",
};

function Band({ index, title, note, children, dark = false, id, stack = false }: {
  index: string; title: string; note?: ReactNode; children: ReactNode; dark?: boolean; id?: string; stack?: boolean;
}) {
  return (
    <section id={id} className={`${dark ? "surface-iron" : "surface-chalk"} grain border-t border-[var(--line)]`}>
      <div className="wrap grid-12 gap-y-10 py-20 lg:py-28">
        <header className={`col-span-12 ${stack ? "lg:grid-12 lg:gap-x-[var(--gutter)]" : "lg:col-span-3"}`}>
          <div className={stack ? "lg:col-span-3" : ""}><Kicker index={index}>{title}</Kicker></div>
          {note && <div className={`mt-5 max-w-[34ch] text-small text-[var(--ink-muted)] ${stack ? "lg:col-span-5 lg:mt-0 lg:max-w-[52ch]" : ""}`}>{note}</div>}
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
        <span className={big ? "t-head text-h3" : "t-title"}>{name}</span>
      </div>
      <dl className="t-mono mt-3 space-y-1 text-[var(--ink-muted)]">
        <dd className="text-[var(--ink)]">{role}</dd>
        <dd>on Chalk <Ratio fg={hex} bg={C.chalk} /></dd>
        <dd>on Iron <Ratio fg={hex} bg={C.iron} /></dd>
      </dl>
    </div>
  );
}

function TypeRow({ role, spec, children, full = false }: { role: string; spec: string; children: ReactNode; full?: boolean }) {
  return (
    <div className="grid-12 items-baseline gap-y-4 border-t border-[var(--line)] py-8">
      <div className={`col-span-12 ${full ? "" : "md:col-span-3"}`}>
        <p className="t-title">{role}</p>
        <p className="t-mono mt-1 text-[var(--ink-muted)]">{spec}</p>
      </div>
      <div className={`col-span-12 min-w-0 ${full ? "" : "md:col-span-9"}`}>{children}</div>
    </div>
  );
}

function Curve({ name, d, bez }: { name: string; d: string; bez: string }) {
  return (
    <figure className="col-span-12 sm:col-span-6">
      <CropMarks className="text-[var(--ink)]">
        <svg viewBox="-6 -6 112 112" className="aspect-square w-full max-w-[260px]" aria-hidden>
          <path d="M0 100H100M0 100V0" stroke="currentColor" strokeOpacity=".25" fill="none" />
          <path d={d} stroke="var(--color-red)" strokeWidth="2" fill="none" />
        </svg>
      </CropMarks>
      <figcaption className="t-mono mt-4 text-[var(--ink-muted)]"><span className="text-[var(--ink)]">{name}</span> · {bez}</figcaption>
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
            <span className="t-label text-[var(--ink-muted)]">Design system · v1 · Oct 2026</span>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <Kicker index="00">Style guide</Kicker>
            <h1 className="t-display mt-6 text-h1 uppercase">One system,<br />every rep.</h1>
          </div>
          <div className="col-span-12 grid-12 gap-y-6 border-t border-[var(--line-strong)] pt-6 t-mono text-[var(--ink-muted)]">
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--ink)]">Grid</span><br />12 columns · gutter 12–28 · margin 20–88</p>
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--ink)]">Type</span><br />Archivo · IBM Plex Mono</p>
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--ink)]">Colour</span><br />Chalk · Iron Black · Plate Red</p>
            <p className="col-span-6 md:col-span-3"><span className="text-[var(--ink)]">Base unit</span><br />4px · scale 4 → 256</p>
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
          <Scale ticks={48} major={4} className="mt-4 text-[var(--ink-muted)]" labels={["0", null, null, "3", null, null, "6", null, null, "9", null, null, "12"]} />
        </div>
      </Band>

      {/* ─── colour ─── */}
      <Band index="02" title="Colour" note={<>Chalk, Iron Black and Plate Red. Red is the only colour that means anything: the fault, the logo's dot and the one primary button. Good form is the expected state, so it stays neutral. A fault always gets its word and a filled dot as well as colour.</>}>
        <div className="grid-12 gap-y-10">
          <Swatch big name="Chalk" hex={C.chalk} role="ground (light) · ink (dark)" />
          <Swatch big name="Iron Black" hex={C.iron} role="ink (light) · ground (dark)" />
          <Swatch big name="Plate Red" hex={C.red} role="signal · same in both themes" />
          <Swatch name="Signal ink, dark" hex={C.redInkDark} role="Red text on Iron Black" />
          <Swatch name="Ground raised" hex={C.chalkRaised} role="Cards and panels, light" />
          <Swatch name="Line" hex={C.chalkLine} role="Hairlines, light" />
          <Swatch name="Line strong" hex={C.stoneStrong} role="Control borders, light" />
          <Swatch name="Ink muted" hex={C.stone} role="Secondary text, light" />
          <Swatch name="Ground raised" hex={C.ironRaised} role="Cards and panels, dark" />
          <Swatch name="Line" hex={C.ironLine} role="Hairlines, dark" />
          <Swatch name="Line strong" hex={C.ashStrong} role="Control borders, dark" />
          <Swatch name="Ink muted" hex={C.ash} role="Secondary text, dark" />
        </div>
      </Band>

      {/* ─── type ─── */}
      <Band index="03" title="Type" dark stack note={<>Archivo for everything a person reads: sturdy, slightly industrial, no flourish. IBM Plex Mono for everything that's measured, so readings look like instrument output. Words in sans, numbers in mono.</>}>
        <TypeRow full role="Giant" spec="Archivo 800 · 56 → 336px · 0.84">
          <p className="t-num text-giant leading-[0.84]">$70–120</p>
        </TypeRow>
        <TypeRow full role="Display" spec="Archivo 800 · −2% · 56 → 160px · 0.92">
          <p className="t-display text-h1 uppercase">Coaching, without the coach.</p>
        </TypeRow>
        <TypeRow role="Headline 2" spec="Archivo 700 · −1% · 40 → 96px · 0.98">
          <p className="t-head text-h2">A camera sees one side.</p>
        </TypeRow>
        <TypeRow role="Heading" spec="Archivo 700 · −1% · 28 → 44px">
          <p className="t-head text-h3">The suit buzzes at the joint that's off.</p>
        </TypeRow>
        <TypeRow role="Title" spec="Archivo 600 · 18 / 24px">
          <p className="t-title">It learns your normal.</p>
        </TypeRow>
        <TypeRow role="Body" spec="Archivo 400 · 16 / 24px · max 62ch">
          <p className="max-w-[62ch]">Between sets, see exactly what to fix: which rep, which joint, and what to do about it on the next set.</p>
        </TypeRow>
        <TypeRow role="Label" spec="Archivo 600 · 12 / 16px · +8% · uppercase">
          <p className="t-label text-[var(--ink-muted)]">Left knee</p>
        </TypeRow>
        <TypeRow role="Reading" spec="IBM Plex Mono 500 · 32 / 36px">
          <p className="t-reading">12<span className="ml-0.5 text-[16px] text-[var(--ink-muted)]">°</span></p>
        </TypeRow>
        <TypeRow role="Data" spec="IBM Plex Mono 400 · 13 / 18px">
          <div className="flex flex-wrap gap-3">
            <Readout status="fault">Rep 07 · Knee valgus · L · 12°</Readout>
            <span className="t-mono self-center text-[var(--ink-muted)]">Past your normal by 7°</span>
          </div>
        </TypeRow>
      </Band>

      {/* ─── space ─── */}
      <Band index="04" title="Space" note={<>A 4px base. Sections draw from the large end (96 → 256) and never all use the same padding.</>}>
        <div className="space-y-3">
          {[4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256].map((s) => (
            <div key={s} className="flex items-center gap-4">
              <span className="t-mono w-12 text-right text-[var(--ink-muted)]">{s}</span>
              <span className="block h-3 bg-iron" style={{ width: s }} />
            </div>
          ))}
        </div>
      </Band>

      {/* ─── components ─── */}
      <Band index="05" title="Components" note={<>Small radii (2px, 4px), hairlines not shadows, controls at least 48px tall. Plate Red is for the one primary button and for faults. Focus is a 2px ink ring; disabled is 40% opacity.</>}>
        <div className="grid-12 gap-y-10">
          {(["chalk", "iron"] as const).map((s) => (
            <div key={s} className={`col-span-12 xl:col-span-6 surface-${s} grain p-6 sm:p-8 outline outline-1 -outline-offset-1 outline-[var(--line)]`}>
              <p className="t-label mb-6 text-[var(--ink-muted)]">On {s === "chalk" ? "Chalk" : "Iron Black"}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Become a test lifter</Button>
                <Button variant="secondary">See how it works</Button>
                <Button variant="quiet">Recalibrate</Button>
                <Button size="sm" variant="quiet" disabled>Disabled</Button>
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
                <Readout status="fault">Rep 07 · Knee valgus · L · 12°</Readout>
                <Readout status="clear">Rep 08 · In range</Readout>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Icon name="earbud" size={20} />
                <span className="t-title">Knees out.</span>
                <Waveform speaking className="text-[var(--ink)]" />
              </div>
              <div className="mt-8"><Kicker index="03">How it works</Kicker></div>
              <Scale className="mt-8 text-[var(--ink-muted)]" ticks={60} major={10} range={[0.583, 1]} marker={0.7}
                labels={["$0", null, "$20", null, "$40", null, "$60", null, "$80", null, "$100", null, "$120"]} />
            </div>
          ))}
        </div>
      </Band>

      {/* ─── icons ─── */}
      <Band index="06" title="Icons" dark note={<>Drawn for FormGuard on a 24-unit grid: 1.5 stroke, square ends, geometric shapes, drawn in ink. A fault icon switches to signal-ink. No icon library.</>}>
        <div className="grid grid-cols-3 gap-px bg-[var(--line)] sm:grid-cols-5 lg:grid-cols-8">
          {ICON_NAMES.map((n) => (
            <div key={n} className="flex aspect-square flex-col items-center justify-center gap-4 bg-[var(--ground)]">
              <Icon name={n} size={40} />
              <span className="t-mono text-[var(--ink-muted)]">{n}</span>
            </div>
          ))}
        </div>
      </Band>

      {/* ─── texture + instruments ─── */}
      <Band index="07" title="Texture & instruments" note={<>Chalk grain on light sections, film grain on dark, a faint platform grid at 1 m = 48px. Rules, ticks and crop marks only where something is measured or framed.</>}>
        <div className="grid-12 gap-y-6">
          <div className="col-span-12 sm:col-span-4"><div className="surface-chalk grain h-48 outline outline-1 -outline-offset-1 outline-[var(--line)]" /><p className="t-mono mt-3 text-[var(--ink-muted)]">Chalk grain · multiply 35%</p></div>
          <div className="col-span-12 sm:col-span-4"><div className="surface-iron grain h-48" /><p className="t-mono mt-3 text-[var(--ink-muted)]">Film grain · soft-light 22%</p></div>
          <div className="col-span-12 sm:col-span-4"><div className="surface-iron platform-grid h-48" /><p className="t-mono mt-3 text-[var(--ink-muted)]">Platform grid · 7%</p></div>
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
                <span className="t-mono text-[var(--ink-muted)]">{h}px · {h >= 48 ? "master" : h >= 32 ? "32 cut" : "16 cut"}</span>
              </div>
            ))}
          </div>
          <div className="surface-chalk inline-block w-full max-w-[420px] self-start p-8 sm:p-10"><Logo variant="stacked" tone="primary" height={150} className="h-auto w-full" /></div>
        </div>
      </Band>
    </main>
  );
}
