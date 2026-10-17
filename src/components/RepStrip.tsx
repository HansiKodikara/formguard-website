/** Every rep in a set as a bar of its depth (RepStrip.md): clean reps neutral, fault reps red and numbered. */
export type Rep = { depth: number; fault?: string | false };

export function RepStrip({ reps, label, summary, slots = 0, className = "" }: {
  reps: Rep[]; label?: string; summary?: string; /** empty places to show before the set fills */ slots?: number; className?: string;
}) {
  const clean = reps.filter((r) => !r.fault).length;
  const sum = summary ?? (reps.length === 0 ? "No reps yet" : clean === reps.length ? `Clean set · ${clean}/${reps.length} in range` : `${clean}/${reps.length} in range`);
  const cells = Math.max(slots, reps.length);
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        {label && <span className="t-label text-[var(--ink-muted)]">{label}</span>}
        <span className="t-mono text-[var(--ink)]" aria-live="polite">{sum}</span>
      </div>
      <ol className="flex h-16 items-end gap-2 border-b border-[var(--line-strong)]" aria-label="Reps">
        {Array.from({ length: cells }, (_, i) => {
          const r = reps[i];
          return (
            <li key={i} className="flex h-full max-w-8 min-w-3 flex-1 flex-col justify-end"
              aria-label={r ? `Rep ${i + 1}: ${r.fault ? r.fault : "in range"}, depth ${Math.round(r.depth * 100)}%` : `Rep ${i + 1}: not done`}>
              {r && <span className={`block rounded-t-sm ${r.fault ? "bg-[var(--signal)] shadow-[inset_0_0_0_2px_var(--signal-ink)]" : "bg-[var(--line-strong)]"}`} style={{ height: `${Math.max(6, r.depth * 100)}%` }} />}
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2" aria-hidden>
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} className={`t-mono max-w-8 min-w-3 flex-1 text-center ${reps[i]?.fault ? "font-medium text-[var(--signal-ink)]" : "text-[var(--ink-muted)]"}`}>{i + 1}</span>
        ))}
      </div>
    </div>
  );
}
