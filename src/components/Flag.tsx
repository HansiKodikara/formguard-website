/** Form status (FormGuard-design-system/components/Flag.md): a fault in red with a filled dot; clear is "In range", neutral, hollow dot. */
export function Flag({ tone = "clear", children, className = "" }: { tone?: "fault" | "clear"; children?: React.ReactNode; className?: string }) {
  return (
    <span className={`t-label inline-flex items-center gap-2 ${tone === "fault" ? "text-[var(--signal-ink)]" : "text-[var(--ink-muted)]"} ${className}`}>
      <span aria-hidden className={`block size-2 shrink-0 rounded-full ${tone === "fault" ? "bg-current" : "border-[1.5px] border-current"}`} />
      {tone === "fault" && <span className="sr-only">Fault:</span>}
      {children ?? (tone === "fault" ? "Fault" : "In range")}
    </span>
  );
}
