/** Section index, set like an instrument marking: a hairline tick, the number in mono, the name as a label. */
export function Kicker({ index, children, className = "" }: { index: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`t-label flex items-center gap-3 text-[var(--ink-muted)] ${className}`}>
      <span aria-hidden className="h-px w-6 bg-[var(--ink)]" />
      <span className="t-mono text-[var(--ink)]">{index}</span>
      <span aria-hidden>/</span>
      <span>{children}</span>
    </p>
  );
}
