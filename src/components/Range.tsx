import { useId } from "react";

/** A labelled slider: the label in words, the value in mono, a 48px-tall track for chalky thumbs. */
export function Range({ label, value, min, max, step = 1, unit, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void; disabled?: boolean;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={disabled ? "opacity-40" : ""}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="t-label text-[var(--ink-muted)]">{label}</label>
        <span className="t-mono text-[var(--ink)]">{value}{unit && <span className="text-[var(--ink-muted)]"> {unit}</span>}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--pct" as string]: `${pct}%` }}
        className="fg-range mt-2 h-12 w-full cursor-pointer disabled:cursor-not-allowed" />
    </div>
  );
}
