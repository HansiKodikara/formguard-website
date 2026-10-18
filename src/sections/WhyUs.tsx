import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { Icon } from "../components/Icon";

/**
 * Why us: FormGuard against the two things people use now to check their form, a personal trainer and a phone
 * app. Three plain rows; FormGuard's column is the one set in Iron.
 */
const COLS = ["Personal trainer", "Phone app", "FormGuard"] as const;
const ROWS: { label: string; has: [boolean, boolean, boolean] }[] = [
  { label: "There for every set", has: [false, true, true] },
  { label: "No fee per session", has: [false, true, true] },
  { label: "Sees both sides of you", has: [true, false, true] },
];
const US = 2;

function Mark({ yes }: { yes: boolean }) {
  return yes
    ? <Icon name="check" size={22} title="Yes" />
    : <Icon name="cross" size={22} title="No" className="text-[var(--signal-ink)]" />;
}

export function WhyUs() {
  return (
    <Section id="why" surface="raised" label="Why us">
      <div className="wrap pb-24 pt-24 lg:pb-32 lg:pt-32">
        <Kicker index="01">Why us</Kicker>
        <div className="mt-8 grid-12">
          <table className="col-span-12 w-full table-fixed border-collapse lg:col-span-10">
            <caption className="t-head mb-10 text-left text-h3">Why not a trainer or an app?</caption>
            <colgroup>
              <col className="w-[40%] sm:w-[46%]" />
              <col /><col /><col />
            </colgroup>
            <thead>
              <tr>
                <td />
                {COLS.map((c, i) => (
                  <th key={c} scope="col"
                    className={`t-mono px-1 pb-4 pt-5 text-center align-bottom text-[11px] uppercase leading-tight tracking-[0.08em] sm:text-[12px] ${i === US ? "rounded-t-md bg-[var(--color-iron)] text-[var(--color-chalk)]" : "text-[var(--ink-muted)]"}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, ri) => {
                const last = ri === ROWS.length - 1;
                return (
                  <tr key={r.label}>
                    <th scope="row" className="t-title border-b border-[var(--line-strong)] py-5 pr-3 text-left font-semibold">{r.label}</th>
                    {r.has.map((yes, i) => (
                      <td key={i}
                        className={`py-5 text-center ${i === US
                          ? `bg-[var(--color-iron)] text-[var(--color-chalk)] ${last ? "rounded-b-md" : "border-b border-[color-mix(in_srgb,var(--color-chalk)_18%,transparent)]"}`
                          : "border-b border-[var(--line-strong)] text-[var(--ink)]"}`}>
                        <span className="inline-flex justify-center"><Mark yes={yes} /></span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
