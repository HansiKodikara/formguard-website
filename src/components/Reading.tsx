/** One measured value, like a gauge (Reading.md). Turns fault only when it's outside the lifter's own normal. */
export function Reading({ label, value, unit, note, tone = "clear", className = "" }: {
  label: string; value: React.ReactNode; unit?: string; note?: string; tone?: "fault" | "clear"; className?: string;
}) {
  const f = tone === "fault";
  return (
    <div className={`inline-flex min-w-[8.75rem] flex-col gap-1 ${className}`}>
      <span className="t-label text-[var(--ink-muted)]">{label}</span>
      <span className={`t-reading ${f ? "text-[var(--signal-ink)]" : "text-[var(--ink)]"}`}>
        {value}{unit && <span className="ml-0.5 font-mono text-[16px] text-[var(--ink-muted)]">{unit}</span>}
      </span>
      {note && <span className={`t-mono ${f ? "text-[var(--signal-ink)]" : "text-[var(--ink-muted)]"}`}>{note}</span>}
    </div>
  );
}
