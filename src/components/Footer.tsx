import { Logo } from "./Logo";
import { SITE } from "../config";

export function Footer() {
  return (
    <footer data-surface="iron" className="surface-iron">
      <div className="wrap grid-12 gap-y-10 py-16 lg:py-20">
        <div className="col-span-12 lg:col-span-6">
          <Logo tone="reversed" height={28} />
          <p className="mt-6 max-w-[34ch] text-[var(--ink-muted)]">{SITE.tagline} A sensor suit and AI that check every rep, in development.</p>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <p className="t-label text-[var(--ink-muted)]">Contact</p>
          <a href={`mailto:${SITE.contactEmail}`} className="mt-3 inline-block underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--ink)]">{SITE.contactEmail}</a>
        </div>
        <div className="col-span-6 lg:col-span-3">
          <p className="t-label text-[var(--ink-muted)]">On this page</p>
          <ul className="mt-3 space-y-2">
            {[["#why", "Why us"], ["#how", "How it works"], ["#try", "Try it"], ["#test-lifter", "Become a test lifter"]].map(([h, l]) => (
              <li key={h}><a href={h} className="hover:underline">{l}</a></li>
            ))}
          </ul>
        </div>
        <p className="t-mono col-span-12 border-t border-[var(--line)] pt-6 text-[var(--ink-muted)]">© {new Date().getFullYear()} FormGuard</p>
      </div>
    </footer>
  );
}
