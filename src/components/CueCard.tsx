import { Flag } from "./Flag";

/** The coaching cue (CueCard.md): the joint, the cue as spoken (five words or fewer), the fix in one sentence. */
export function CueCard({ joint, cue, fix, meta, className = "" }: { joint: string; cue: string; fix?: string; meta?: string; className?: string }) {
  return (
    <div className={`flex max-w-[22.5rem] flex-col gap-2 rounded-md border border-[var(--line)] bg-[var(--ground-raised)] p-4 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <Flag tone="fault">{joint}</Flag>
        {meta && <span className="t-mono text-[var(--ink-muted)]">{meta}</span>}
      </div>
      <p className="t-head text-[28px] leading-8 text-[var(--ink)]">{cue}</p>
      {fix && <p className="text-[16px] leading-6 text-[var(--ink)]">{fix}</p>}
    </div>
  );
}
