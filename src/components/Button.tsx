import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Common = { variant?: "primary" | "secondary" | "quiet"; size?: "md" | "sm"; fullWidth?: boolean; children: ReactNode; className?: string };

// FormGuard-design-system/components/Button.md: verb first, sentence case, no full stop.
const base =
  "group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-display font-semibold " +
  "transition-[box-shadow,border-color] duration-200 select-none " +
  "disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40";
// 48px for chalky hands between sets; sm (36px) is for dense desktop UI only
const sizes = { md: "h-12 px-5 text-[16px] leading-6", sm: "h-9 px-4 text-[14px]" };
const variants = {
  // Plate Red, at most once per screen: the one thing the screen is for
  primary: "bg-[var(--signal)] text-[var(--on-signal)] hover:shadow-[inset_0_-3px_0_var(--on-signal)]",
  secondary: "bg-[var(--ink)] text-[var(--ground)] hover:shadow-[inset_0_-3px_0_var(--ink-muted)]",
  quiet: "bg-transparent text-[var(--ink)] border-[var(--line-strong)] hover:border-[var(--ink)]",
};
const cls = (variant: keyof typeof variants, size: keyof typeof sizes, fullWidth?: boolean, className = "") =>
  `${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`;

export function Button({ variant = "primary", size = "md", fullWidth, children, className = "", ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cls(variant, size, fullWidth, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", fullWidth, children, className = "", ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cls(variant, size, fullWidth, className)} {...rest}>
      {children}
    </a>
  );
}
