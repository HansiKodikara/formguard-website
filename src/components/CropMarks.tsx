import type { ReactNode } from "react";

/** Printer's crop marks at the four corners of a figure frame. */
export function CropMarks({ children, className = "", inset = -10, size = 10 }: { children: ReactNode; className?: string; inset?: number; size?: number }) {
  const corner = (pos: string, h: string, v: string) => (
    <span aria-hidden className={`pointer-events-none absolute ${pos}`} style={{ width: size, height: size }}>
      <span className={`absolute ${h} h-px w-full bg-current opacity-50`} />
      <span className={`absolute ${v} h-full w-px bg-current opacity-50`} />
    </span>
  );
  const o = `${inset}px`;
  return (
    <div className={`relative ${className}`}>
      {children}
      <span style={{ inset: o }} className="pointer-events-none absolute">
        {corner("left-0 top-0 -translate-x-full -translate-y-full", "bottom-0 left-0", "right-0 top-0")}
        {corner("right-0 top-0 translate-x-full -translate-y-full", "bottom-0 right-0", "left-0 top-0")}
        {corner("bottom-0 left-0 -translate-x-full translate-y-full", "top-0 left-0", "right-0 bottom-0")}
        {corner("bottom-0 right-0 translate-x-full translate-y-full", "top-0 right-0", "left-0 bottom-0")}
      </span>
    </div>
  );
}
