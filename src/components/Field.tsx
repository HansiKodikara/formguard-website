import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Field({ label, error, hint, className = "", ...input }: {
  label: string; error?: string; hint?: string; className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const msg = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="t-mono mb-2 block text-[var(--fg)]">{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={msg}
        className={
          "block h-[52px] w-full border-[1.5px] bg-[var(--field-bg)] px-4 font-text text-[17px] text-[var(--fg)] " +
          "placeholder:text-[var(--muted)] transition-colors duration-200 hover:border-[var(--fg)] focus:border-[var(--fg)] " +
          (error ? "border-[var(--flag-mark)]" : "border-[var(--field-border)]")
        }
        {...input}
      />
      {error ? (
        <p id={msg} className="mt-2 flex items-center gap-2 text-[14px] font-[520] text-[var(--flag)]"><Icon name="flag" size={14} strokeWidth={1.8} />{error}</p>
      ) : hint ? (
        <p id={msg} className="mt-2 text-[14px] text-[var(--muted)]">{hint}</p>
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
      <legend className="t-mono mb-2 text-[var(--fg)]">{legend}</legend>
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
                  "flex h-11 items-center gap-2.5 border-[1.5px] px-3.5 text-[15px] transition-colors duration-200 " +
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-red " +
                  (on ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--field-border)] hover:border-[var(--fg)]")
                }
              >
                <span aria-hidden className={`grid size-3.5 place-items-center border-[1.5px] border-current ${type === "radio" ? "rounded-full" : ""}`}>
                  {on && (type === "radio" ? <span className="size-1.5 rounded-full bg-current" /> : <Icon name="check" size={11} strokeWidth={3} />)}
                </span>
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p id={`${id}-err`} className="mt-2 flex items-center gap-2 text-[14px] font-[520] text-[var(--flag)]"><Icon name="flag" size={14} strokeWidth={1.8} />{error}</p>}
    </fieldset>
  );
}
