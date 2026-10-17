import type { ReactNode } from "react";

/** A page section on one of the two surfaces. The header reads `data-surface` to switch its colours. */
export function Section({ id, surface, className = "", children, label }: {
  id: string; surface: "iron" | "chalk" | "bone" | "red"; className?: string; children: ReactNode; label?: string;
}) {
  return (
    <section id={id} data-surface={surface} aria-label={label} className={`surface-${surface} grain relative ${className}`}>
      {children}
    </section>
  );
}
