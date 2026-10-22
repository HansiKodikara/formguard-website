import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Icon } from "./Icon";

/** A required field's mark: a red asterisk people can see, "required" for screen readers (the input says so too). */
export function Req() {
  return <><span aria-hidden className="ml-1 text-[var(--signal-ink)]">*</span><span className="sr-only"> (required)</span></>;
}

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
      <label htmlFor={id} className="t-label mb-2 block text-[var(--ink)]">{label}{input.required && <Req />}</label>
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

export function ChipGroup({ legend, name, type = "checkbox", options, value, onChange, error, columns = "", required = false, stacked = false }: {
  legend: string; name: string; type?: "checkbox" | "radio"; options: { value: string; label: ReactNode }[];
  value: string[]; onChange: (v: string[]) => void; error?: string; columns?: string; required?: boolean;
  /** one option per row, full width, for long labels */
  stacked?: boolean;
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="t-label mb-2 text-[var(--ink)]">{legend}{required && <Req />}</legend>
      <div className={`${stacked ? "grid gap-2" : "flex flex-wrap gap-2"} ${columns}`}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} className="relative cursor-pointer">
              <input
                type={type}
                name={name}
                value={o.value}
                checked={on}
                required={required && type === "radio" ? true : undefined}
                onChange={() => onChange(type === "radio" ? [o.value] : on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span
                className={
                  `flex ${stacked ? "min-h-12 py-3 text-left" : "h-12"} items-center gap-2.5 rounded-md border px-4 text-[16px] transition-colors duration-200 ` +
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)] " +
                  (on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--ground)]" : "border-[var(--line-strong)] hover:border-[var(--ink)]")
                }
              >
                <span aria-hidden className={`grid size-3.5 shrink-0 place-items-center border-[1.5px] border-current ${type === "radio" ? "rounded-full" : "rounded-sm"}`}>
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

export function Select({ label, error, options, placeholder = "Choose one", className = "", ...select }: {
  label: string; error?: string; options: readonly string[]; placeholder?: string; className?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="t-label mb-2 block text-[var(--ink)]">{label}{select.required && <Req />}</label>
      <div className="relative">
        <select id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined}
          className={
            "block h-12 w-full appearance-none rounded-md border bg-[var(--ground-raised)] pl-4 pr-10 font-display text-[16px] text-[var(--ink)] " +
            "transition-colors duration-200 hover:border-[var(--ink)] focus:border-[var(--ink)] " +
            (error ? "border-[var(--signal-ink)]" : "border-[var(--line-strong)]")
          }
          {...select}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute right-4 top-1/2 size-3 -translate-y-1/2 text-[var(--ink-muted)]">
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
}

/** One checkbox with its sentence beside it (consent). The whole row is the tap target. */
export function Checkbox({ children, checked, onChange, error, required = false }: {
  children: ReactNode; checked: boolean; onChange: (v: boolean) => void; error?: string; required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-1 text-[16px] leading-[1.45]">
        <input id={id} type="checkbox" checked={checked} required={required} onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined}
          className="peer sr-only" />
        <span aria-hidden className={
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border-[1.5px] transition-colors " +
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)] " +
          (checked ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--ground)]" : error ? "border-[var(--signal-ink)]" : "border-[var(--line-strong)]")
        }>
          {checked && <Icon name="check" size={13} strokeWidth={3} />}
        </span>
        <span>{children}{required && <Req />}</span>
      </label>
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
    </div>
  );
}

export function Textarea({ label, error, hint, className = "", ...area }: {
  label: string; error?: string; hint?: string; className?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const msg = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="t-label mb-2 block text-[var(--ink)]">{label}{area.required && <Req />}</label>
      <textarea
        id={id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={msg}
        className={
          "block min-h-28 w-full resize-y rounded-md border bg-[var(--ground-raised)] px-4 py-3 font-display text-[16px] leading-[1.5] text-[var(--ink)] " +
          "placeholder:text-[var(--ink-muted)] transition-colors duration-200 hover:border-[var(--ink)] focus:border-[var(--ink)] " +
          (error ? "border-[var(--signal-ink)]" : "border-[var(--line-strong)]")
        }
        {...area}
      />
      {error ? <FieldError id={msg!}>{error}</FieldError> : hint ? <p id={msg} className="mt-2 text-[14px] text-[var(--ink-muted)]">{hint}</p> : null}
    </div>
  );
}
