import type { ReactNode } from "react";
import { Icon } from "./Icon";

export type ReadoutStatus = "flag" | "good" | "neutral" | "live";

/** A data readout: `REP 07 · KNEE VALGUS · L · 12°`. Status is carried by an icon and a word as well as colour. */
export function Readout({ status = "neutral", children, className = "", srStatus = true }: {
  status?: ReadoutStatus; children: ReactNode; className?: string; srStatus?: boolean;
}) {
  const tone =
    status === "flag" ? "text-[var(--flag)] border-[var(--flag-mark)]"
    : status === "good" ? "text-[var(--good)] border-[var(--good)]"
    : status === "live" ? "text-[var(--fg)] border-[var(--fg)]"
    : "text-[var(--fg)] border-[var(--rule-strong)]";
  return (
    <span className={`t-mono inline-flex items-center gap-2 border px-2.5 py-[5px] ${tone} ${className}`}>
      {status === "flag" && <Icon name="flag" size={13} strokeWidth={1.8} />}
      {status === "good" && <Icon name="check" size={13} strokeWidth={2.4} />}
      {status === "live" && <span aria-hidden className="block size-[7px] rounded-full bg-current" />}
      {srStatus && status === "flag" && <span className="sr-only">Flagged:</span>}
      {srStatus && status === "good" && <span className="sr-only">Good:</span>}
      <span>{children}</span>
    </span>
  );
}
