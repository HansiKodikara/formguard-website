/** The voice cue's waveform. Bars move only while `speaking`; static (and still legible) otherwise. */
const BARS = [0.35, 0.6, 0.9, 0.55, 1, 0.7, 0.4, 0.8, 0.5, 0.3, 0.65, 0.45];

export function Waveform({ speaking = false, className = "" }: { speaking?: boolean; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex h-5 items-center gap-[3px] ${className}`}>
      {BARS.map((h, i) => (
        <span
          key={i}
          className={`block w-[2px] origin-center bg-current ${speaking ? "animate-[fg-wave_0.9s_var(--ease-lift)_infinite_alternate]" : ""}`}
          style={{ height: `${Math.round(h * 100)}%`, animationDelay: `${(i % 5) * -0.17}s` }}
        />
      ))}
    </span>
  );
}
