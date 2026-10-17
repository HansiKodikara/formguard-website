/**
 * A measurement scale: minor and major ticks, optional labels, an optional highlighted range and marker.
 * Used for scroll progress, the price ruler, range of motion and rep timelines — always measuring something.
 */
export function Scale({
  ticks = 50, major = 10, labels, range, marker, height = 22, className = "", labelClass = "",
}: {
  ticks?: number; major?: number; labels?: (string | null)[];
  range?: [number, number]; marker?: number; height?: number; className?: string; labelClass?: string;
}) {
  const xs = Array.from({ length: ticks + 1 }, (_, i) => i / ticks);
  return (
    <div className={`relative ${className}`} style={{ height }} aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
        <line x1="0" x2="100%" y1="0.5" y2="0.5" stroke="currentColor" strokeWidth="1" />
        {xs.map((x, i) => (
          <line key={i} x1={`${x * 100}%`} x2={`${x * 100}%`} y1="0" y2={i % major === 0 ? 10 : 5}
            stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {range && (
          <rect x={`${range[0] * 100}%`} y="0" width={`${(range[1] - range[0]) * 100}%`} height="4" fill="var(--color-red)" />
        )}
        {marker !== undefined && <rect x={`calc(${marker * 100}% - 1px)`} y="-3" width="2" height="16" fill="var(--color-red)" />}
      </svg>
      {labels && (
        <div className={`t-mono absolute inset-x-0 top-[14px] ${labelClass}`}>
          {labels.map((l, i) => l && (
            <span key={i} className="absolute -translate-x-1/2" style={{ left: `${(i / (labels.length - 1)) * 100}%` }}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
