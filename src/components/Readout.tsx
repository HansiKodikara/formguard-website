import type { ReactNode } from "react";

export type ReadoutStatus = "fault" | "clear" | "neutral" | "live";

/**
 * An instrument readout: `Rep 07 · Knee valgus · L · 12°`, set in mono because it's measured.
 * Follows the design system's Flag: a fault is signal-ink with a filled dot; clear is neutral with a
 * hollow dot (good form is the expected state, so it gets no colour); live is a filled ink dot.
 */
export function Readout({ status = "neutral", children, className = "", srStatus = true }: {
  status?: ReadoutStatus; children: ReactNode; className?: string; srStatus?: boolean;
}) {
  const tone =
    status === "fault" ? "text-[var(--signal-ink)] border-[var(--signal-ink)]"
    : status === "clear" ? "text-[var(--ink)] border-[var(--line-strong)]"
    : status === "live" ? "text-[var(--ink)] border-[var(--ink)]"
    : "text-[var(--ink)] border-[var(--line-strong)]";
  return (
    <span className={`t-mono inline-flex items-center gap-2 rounded-sm border bg-[var(--ground)]/85 px-2.5 py-[5px] ${tone} ${className}`}>
      {status === "fault" && <span aria-hidden className="block size-2 shrink-0 rounded-full bg-current" />}
      {status === "clear" && <span aria-hidden className="block size-2 shrink-0 rounded-full border-[1.5px] border-[var(--ink-muted)]" />}
      {status === "live" && <span aria-hidden className="block size-2 shrink-0 rounded-full bg-current" />}
      {srStatus && status === "fault" && <span className="sr-only">Fault:</span>}
      {srStatus && status === "clear" && <span className="sr-only">In range:</span>}
      <span>{children}</span>
    </span>
  );
}
