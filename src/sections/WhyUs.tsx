import { useEffect, useRef, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Icon } from "../components/Icon";

/**
 * Why us: FormGuard against the two things people use now to check their form, a personal trainer and a phone
 * app. Each answer carries the fact behind it; FormGuard's column is the one set in Iron, headed by the suit. The
 * rows come in one after another as the table scrolls into view, and FormGuard's ticks draw in last.
 */
const COLS = [
  { name: "Personal trainer", icon: "trainer" },
  { name: "Phone app", icon: "phone" },
  { name: "FormGuard", icon: null },
] as const;
type Cell = { yes: boolean; fact: string };
const ROWS: { label: string; cells: [Cell, Cell, Cell] }[] = [
  { label: "There for every set", cells: [
    { yes: false, fact: "Only the hours you book" },
    { yes: true, fact: "When you prop your phone up" },
    { yes: true, fact: "Every set, every rep" },
  ] },
  { label: "No fee per session", cells: [
    { yes: false, fact: "$70–120 a session" },
    { yes: true, fact: "A monthly subscription" },
    { yes: true, fact: "A small monthly plan, a fraction of one session" },
  ] },
  { label: "Sees both sides of you", cells: [
    { yes: true, fact: "Walks around you" },
    { yes: false, fact: "One camera, one side" },
    { yes: true, fact: "Sensors on both sides" },
  ] },
];
const US = 2;
const STEP = 140;   // ms between rows coming in

const FEATHER = "linear-gradient(to bottom, #000 70%, transparent), linear-gradient(to right, transparent, #000 22%, #000 78%, transparent)";
/** phones: the row name is in its own line above, so this one is for screen readers only (the site's .sr-only
 * can't be undone per breakpoint, it sits outside the utility layers) */
const HIDE_ON_PHONE = "max-sm:absolute max-sm:h-px max-sm:w-px max-sm:overflow-hidden max-sm:whitespace-nowrap max-sm:border-0 max-sm:p-0 max-sm:[clip:rect(0,0,0,0)]";

function Mark({ yes, draw, shown, delay }: { yes: boolean; draw?: boolean; shown: boolean; delay: number }) {
  if (!yes) return <Icon name="cross" size={22} title="No" className="text-[var(--signal-ink)]" />;
  if (!draw) return <Icon name="check" size={22} title="Yes" />;
  // FormGuard's tick: drawn in, stroke first to last
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="square" role="img" aria-label="Yes">
      <path d="M4.5 12.6 9.8 17.8 19.8 6.4" pathLength={1} strokeDasharray="1" strokeDashoffset={shown ? 0 : 1}
        style={{ transition: `stroke-dashoffset 420ms var(--ease-physical) ${delay}ms` }} />
    </svg>
  );
}

/** true once the table has scrolled into view (straight away without IntersectionObserver) */
function useShown(ref: React.RefObject<HTMLElement | null>) {
  const [shown, setShown] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, shown]);
  return shown;
}

export function WhyUs() {
  const table = useRef<HTMLTableElement>(null);
  const shown = useShown(table);
  const enter = (i: number) => ({
    opacity: shown ? 1 : 0, transform: shown ? "none" : "translateY(10px)",
    transition: `opacity 500ms var(--ease-physical) ${i * STEP}ms, transform 500ms var(--ease-physical) ${i * STEP}ms`,
  });
  const usBg = "bg-[var(--color-iron)] text-[var(--color-chalk)]";
  const usLine = "border-b border-[color-mix(in_srgb,var(--color-chalk)_18%,transparent)]";

  return (
    <Section id="why" surface="raised" label="Why us">
      <div className="wrap pb-24 pt-24 lg:pb-32 lg:pt-32">
        <Kicker index="01">Why us</Kicker>
        <table ref={table} className="mt-8 w-full table-fixed border-collapse">
          <caption className="t-head mb-10 text-left text-h3">Why not a trainer or an app?</caption>
          <colgroup>
            {/* phones: the row's name gets a line of its own above its answers, so the answers have the width */}
            <col className="w-0 sm:w-[28%]" />
            <col /><col /><col />
          </colgroup>
          <thead>
            <tr>
              <td className="max-sm:p-0" />
              {COLS.map((c, i) => (
                <th key={c.name} scope="col" className={`px-2 pb-5 pt-6 text-center align-bottom ${i === US ? `rounded-t-md ${usBg}` : "text-[var(--ink)]"}`}>
                  {c.icon ? (
                    <Icon name={c.icon} size={44} className="mx-auto text-[var(--ink-muted)]" />
                  ) : (
                    <img src="/suit/05_suit_three_quarter_back-400.webp" alt="" width={400} height={600} loading="lazy" decoding="async"
                      className="mx-auto h-28 w-auto sm:h-36" style={{ maskImage: FEATHER, WebkitMaskImage: FEATHER, maskComposite: "intersect", WebkitMaskComposite: "source-in" }} />
                  )}
                  <span className="t-title mt-3 block text-[15px] leading-tight sm:text-[18px]">{c.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, ri) => {
              const last = ri === ROWS.length - 1;
              return [
                <tr key={`${r.label}-m`} aria-hidden className="sm:hidden">
                  <td colSpan={4} className="t-title pt-6 pb-1 text-left text-[16px] font-semibold" style={enter(ri)}>{r.label}</td>
                </tr>,
                <tr key={r.label}>
                  <th scope="row" className={`t-title border-b border-[var(--line-strong)] py-6 pr-4 text-left align-top font-semibold sm:text-[20px] ${HIDE_ON_PHONE}`} style={enter(ri)}>{r.label}</th>
                  {r.cells.map((c, i) => {
                    const us = i === US;
                    return (
                      <td key={i} className={`px-2 py-4 text-center align-top sm:px-4 sm:py-6 ${us ? `${usBg} ${last ? "rounded-b-md" : usLine}` : "border-b border-[var(--line-strong)] text-[var(--ink)]"}`}>
                        <div style={enter(ri)}>
                          <span className="inline-flex justify-center"><Mark yes={c.yes} draw={us} shown={shown} delay={ROWS.length * STEP + ri * STEP} /></span>
                          <span className={`mt-1.5 block text-[12.5px] leading-snug sm:text-[14px] ${us ? "text-[color-mix(in_srgb,var(--color-chalk)_72%,transparent)]" : "text-[var(--ink-muted)]"}`}>{c.fact}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
