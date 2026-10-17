/** A row of mutually exclusive choices: a radio group drawn as joined buttons, 48px tall. */
export function Segmented<T extends string>({ label, value, options, onChange, className = "" }: {
  label: string; value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-md border border-[var(--line-strong)] p-1 ${className}`}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = options[(i + step + options.length) % options.length];
        onChange(next.value);
        (e.currentTarget.querySelector(`[data-v="${next.value}"]`) as HTMLElement | null)?.focus();
      }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-v={o.value}
            onClick={() => onChange(o.value)}
            className={`h-10 whitespace-nowrap rounded-sm px-4 text-[15px] font-semibold transition-colors duration-200 ${on ? "bg-[var(--ink)] text-[var(--ground)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
