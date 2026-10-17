import { useEffect, useRef } from "react";

/** Scroll progress as a measurement scale: minor ticks every 2%, majors every 10%, an ink fill. */
export function ScrollScale() {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      if (fill.current) fill.current.style.transform = `scaleX(${p})`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  const ticks = Array.from({ length: 51 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[7px]" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {ticks.map((i) => (
          <line key={i} x1={`${i * 2}%`} x2={`${i * 2}%`} y1={i % 5 === 0 ? 0 : 3.5} y2="7" stroke="currentColor" strokeOpacity={i % 5 === 0 ? 0.55 : 0.28} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div ref={fill} className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-[var(--ink)]" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
