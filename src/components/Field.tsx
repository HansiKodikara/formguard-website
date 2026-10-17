import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";

/** A fault, per the design system's Flag: a filled dot and the words, in signal-ink. */
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 flex items-center gap-2 text-[14px] font-semibold text-[var(--signal-ink)]">
      <span aria-hidden className="block size-2 shrink-0 rounded-full bg-current" />{children}
    </p>
  );
}

export function Field({ label, error, hint, className = "", ...input }: {
  label: string; error?: string; hint?: string; className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const msg = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="t-label mb-2 block text-[var(--ink)]">{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={msg}
        className={
          "block h-12 w-full rounded-md border bg-[var(--ground-raised)] px-4 font-display text-[16px] text-[var(--ink)] " +
          "placeholder:text-[var(--ink-muted)] transition-colors duration-200 hover:border-[var(--ink)] focus:border-[var(--ink)] " +
          (error ? "border-[var(--signal-ink)]" : "border-[var(--line-strong)]")
        }
        {...input}
      />
      {error ? (
        <FieldError id={msg!}>{error}</FieldError>
      ) : hint ? (
        <p id={msg} className="mt-2 text-[14px] text-[var(--ink-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function ChipGroup({ legend, name, type = "checkbox", options, value, onChange, error, columns = "" }: {
  legend: string; name: string; type?: "checkbox" | "radio"; options: { value: string; label: ReactNode }[];
  value: string[]; onChange: (v: string[]) => void; error?: string; columns?: string;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="t-label mb-2 text-[var(--ink)]">{legend}</legend>
      <div className={`flex flex-wrap gap-2 ${columns}`}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} className="relative cursor-pointer">
              <input
                type={type}
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(type === "radio" ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span
                className={
                  "flex h-12 items-center gap-2.5 rounded-md border px-4 text-[16px] transition-colors duration-200 " +
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)] " +
                  (on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--ground)]" : "border-[var(--line-strong)] hover:border-[var(--ink)]")
                }
              >
                <span aria-hidden className={`grid size-3.5 place-items-center border-[1.5px] border-current ${type === "radio" ? "rounded-full" : "rounded-sm"}`}>
                  {on && (type === "radio" ? <span className="size-1.5 rounded-full bg-current" /> : <Icon name="check" size={11} strokeWidth={3} />)}
                </span>
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </fieldset>
  );
}
