/** Section index, set like an instrument marking: a red tick, the number, the name. */
export function Kicker({ index, children, className = "" }: { index: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`t-mono flex items-center gap-3 text-[var(--muted)] ${className}`}>
      <span aria-hidden className="h-px w-6 bg-red" />
      <span className="text-[var(--fg)]">{index}</span>
      <span aria-hidden>/</span>
      <span>{children}</span>
    </p>
  );
}
