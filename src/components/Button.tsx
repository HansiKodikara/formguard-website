import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type Common = { variant?: "primary" | "secondary"; size?: "md" | "sm"; arrow?: boolean; children: ReactNode; className?: string };

const base =
  "group inline-flex items-center justify-center gap-3 whitespace-nowrap font-text font-[620] tracking-[0.005em] " +
  "transition-[background-color,color,border-color] duration-300 ease-[var(--ease-physical)] select-none " +
  "disabled:cursor-not-allowed disabled:opacity-45";
const sizes = { md: "h-[52px] px-5 text-[15.5px]", sm: "h-10 px-4 text-[14px]" };
const variants = {
  // Plate Red is the brand accent; the CTA is the only red button on the page
  primary: "bg-red text-chalk hover:bg-[#a9241c] active:bg-[#93201a]",
  secondary: "border-[1.5px] border-current text-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)]",
};

function Inner({ children, arrow }: { children: ReactNode; arrow?: boolean }) {
  return (
    <>
      <span>{children}</span>
      {arrow && (
        <Icon name="arrow" size={16} className="transition-transform duration-300 ease-[var(--ease-physical)] group-hover:translate-x-[3px]" />
      )}
    </>
  );
}

export function Button({ variant = "primary", size = "md", arrow, children, className = "", ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      <Inner arrow={arrow}>{children}</Inner>
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", arrow, children, className = "", ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      <Inner arrow={arrow}>{children}</Inner>
    </a>
  );
}
