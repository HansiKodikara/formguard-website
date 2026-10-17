/**
 * Reps as traces, the way the suit sees them: one row per channel, time through the rep left to right,
 * "your normal" as a shaded band. Earlier reps sit faint behind; the current rep draws in ink, and any
 * stretch outside the band turns red. Hover (or focus and use the arrow keys) to read any moment.
 */
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { CHANNELS, band, outside, sample, type Channel, type RepParams } from "./signal";

const N = 80, W = 600, H = 120;
const BOTTOM = 0.535;   // the pause at the bottom of the rep, on the phase axis

function line(ch: Channel, r: RepParams, upto = 1) {
  const max = CHANNELS[ch].max;
  let d = "";
  const n = Math.max(1, Math.round(N * upto));
  for (let i = 0; i <= n; i++) {
    const pp = Math.min(i / N, upto);
    d += `${i ? "L" : "M"}${(pp * W).toFixed(1)} ${(H - (sample(ch, r, pp) / max) * H).toFixed(1)}`;
  }
  return d;
}

function outsideRuns(ch: Channel, r: RepParams, upto = 1) {
  const max = CHANNELS[ch].max, runs: string[] = [];
  let cur = "";
  const n = Math.round(N * upto);
  for (let i = 0; i <= n; i++) {
    const p = i / N;
    const pt = `${(p * W).toFixed(1)} ${(H - (sample(ch, r, p) / max) * H).toFixed(1)}`;
    if (outside(ch, r, p)) cur += `${cur ? "L" : "M"}${pt}`;
    else if (cur) { runs.push(cur); cur = ""; }
  }
  if (cur) runs.push(cur);
  return runs;
}

function bandArea(ch: Channel) {
  const max = CHANNELS[ch].max, y = (v: number) => (H - (v / max) * H).toFixed(1);
  let up = "", down = "";
  for (let i = 0; i <= N; i++) {
    const p = i / N, [lo, hi] = band(ch, p);
    up += `${i ? "L" : "M"}${(p * W).toFixed(1)} ${y(hi)}`;
    down = `L${(p * W).toFixed(1)} ${y(Math.max(0, lo))}` + down;
  }
  return up + down + "Z";
}

export function RepTrace({ reps, live = null, bandOpacity = 1, channels = ["bend", "cave"], compact = false, title, className = "" }: {
  /** finished reps, oldest first */
  reps: RepParams[];
  /** the rep in progress, drawn up to phase p */
  live?: { r: RepParams; p: number } | null;
  /** how much of "your normal" has been learnt yet (0 … 1) */
  bandOpacity?: number;
  channels?: Channel[];
  /** shorter plots, for tight panels */
  compact?: boolean;
  title: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const focus = live?.r ?? reps[reps.length - 1] ?? null;
  const upto = live ? live.p : 1;
  const at = hover ?? (live ? live.p : null);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setHover(Math.min(upto, Math.max(0, (e.clientX - b.left) / b.width)));
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0;
    if (!step) return;
    e.preventDefault();
    setHover((h) => Math.min(upto, Math.max(0, (h ?? 0) + step)));
  };

  return (
    <div className={className}>
      <div role="img" aria-label={title} tabIndex={0} onKeyDown={key} onBlur={() => setHover(null)}
        className="relative cursor-crosshair outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)]"
        onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {channels.map((ch, row) => {
          const c = CHANNELS[ch];
          const v = focus && at !== null ? sample(ch, focus, at) : null;
          const out = focus && at !== null && outside(ch, focus, at);
          return (
            <div key={ch} className={row ? (compact ? "mt-3" : "mt-5") : ""}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="t-label text-[var(--ink-muted)]">{c.label}</span>
                <span className={`t-mono tabular-nums ${out ? "text-[var(--signal-ink)]" : "text-[var(--ink)]"}`}>
                  {v === null ? "—" : `${Math.max(0, v).toFixed(ch === "cave" ? 1 : 0)}${c.unit}`}
                  {v !== null && <span className="text-[var(--ink-muted)]">{out ? " · outside your normal" : " · in range"}</span>}
                </span>
              </div>
              <div className={`relative mt-2 ${compact ? "h-16 sm:h-20" : "h-24 sm:h-28"}`}>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
                  {[0, 0.5, 1].map((g) => <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
                  <path d={bandArea(ch)} fill="var(--ink)" fillOpacity={0.09 * bandOpacity} stroke="var(--line-strong)" strokeOpacity={bandOpacity} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                  {reps.slice(live ? -4 : -5, live ? undefined : -1).map((r, i) => (
                    <path key={i} d={line(ch, r)} fill="none" stroke={outsideRuns(ch, r).length ? "var(--signal-ink)" : "var(--ink-muted)"}
                      strokeOpacity={0.35} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                  ))}
                  {focus && (
                    <>
                      <path d={line(ch, focus, upto)} fill="none" stroke="var(--ink)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                      {outsideRuns(ch, focus, upto).map((d, i) => <path key={i} d={d} fill="none" stroke="var(--signal-ink)" strokeWidth={3} vectorEffect="non-scaling-stroke" />)}
                    </>
                  )}
                  {at !== null && <line x1={at * W} x2={at * W} y1={0} y2={H} stroke="var(--ink)" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
                </svg>
                {/* the head of the trace (HTML, so it stays round in a stretched plot) */}
                {focus && at !== null && v !== null && (
                  <span aria-hidden className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${out ? "bg-[var(--signal)] ring-2 ring-[var(--signal-ink)]" : "bg-[var(--ink)]"}`}
                    style={{ left: `${at * 100}%`, top: `${(1 - Math.max(0, v) / c.max) * 100}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="t-label relative mt-2 h-4 text-[var(--ink-muted)]" aria-hidden>
        <span className="absolute left-0">Start</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${BOTTOM * 100}%` }}>Bottom</span>
        <span className="absolute right-0">Lockout</span>
      </div>
    </div>
  );
}
