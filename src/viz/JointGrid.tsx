/**
 * Every joint the suit tracks, by side: a sensor per joint, both sides of the body. Each comes online in
 * turn; a joint that's off right now is flagged in red, with its word (never colour alone).
 */
export const JOINT_ROWS = ["Shoulder", "Elbow", "Wrist", "Hip", "Knee", "Ankle"] as const;
export type Side = "L" | "R";
export type JointKey = `${(typeof JOINT_ROWS)[number]} ${Side}` | "Upper back" | "Lower back";
export const JOINT_COUNT = JOINT_ROWS.length * 2 + 2;

/** The order joints come online: down the body, both sides together, the spine in the middle. */
export const ONLINE_ORDER: JointKey[] = [
  "Shoulder L", "Shoulder R", "Elbow L", "Elbow R", "Wrist L", "Wrist R", "Upper back", "Lower back",
  "Hip L", "Hip R", "Knee L", "Knee R", "Ankle L", "Ankle R",
];

export type JointState = "off" | "on" | "fault" | "blind";

export function JointGrid({ state, className = "" }: { state: (j: JointKey) => JointState; className?: string }) {
  const cell = (j: JointKey, label: string) => {
    const s = state(j);
    return (
      <div key={j} className={`flex h-10 items-center gap-3 rounded-sm border px-3 transition-colors duration-300
        ${s === "fault" ? "border-[var(--signal-ink)] text-[var(--signal-ink)]" : s === "on" ? "border-[var(--line-strong)] text-[var(--ink)]" : "border-dashed border-[var(--line)] text-[var(--ink-muted)]"}`}>
        {/* the tracked motif: a dot in a ring; hollow when offline, red when off */}
        <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] ${s === "fault" ? "border-current" : s === "on" ? "border-current" : "border-[var(--line-strong)]"}`}>
          {(s === "on" || s === "fault") && <span className={`block size-1.5 rounded-full ${s === "fault" ? "bg-[var(--signal)]" : "bg-current"}`} />}
        </span>
        <span className="text-[15px] font-semibold">{label}{/ [LR]$/.test(j) && <span className="sr-only">, {j.endsWith("L") ? "left" : "right"}</span>}</span>
        {/* on narrow screens the border and marker carry the state; the words stay for screen readers, and a fault keeps them */}
        <span className={`t-mono ml-auto ${s === "fault" ? "max-sm:text-[11px]" : "max-sm:sr-only"}`}>{s === "fault" ? "Out of range" : s === "on" ? "Live" : s === "blind" ? "Out of view" : "Offline"}</span>
      </div>
    );
  };
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <span className="t-label text-[var(--ink-muted)]">Left side</span>
        <span className="t-label text-[var(--ink-muted)]">Right side</span>
        {JOINT_ROWS.flatMap((r) => [cell(`${r} L`, r), cell(`${r} R`, r)])}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        <span className="t-label col-span-2 text-[var(--ink-muted)]">Spine</span>
        {cell("Upper back", "Upper back")}
        {cell("Lower back", "Lower back")}
      </div>
    </div>
  );
}
