/**
 * FormGuard icons. Drawn for this brand on a 24-unit grid: 1.5 stroke, square caps, miter joins,
 * joints as solid nodes (r 1.75), the same anatomy as the 3D figure's sensor nodes. No icon library.
 */
import type { SVGProps } from "react";

const N = (cx: number, cy: number, r = 1.75) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const ICONS = {
  /** the suit: a body with nodes at every joint */
  suit: (
    <>
      <path d="M9.4 3.2c.8 1.4 4.4 1.4 5.2 0L19 5l2.6 11.6-2.9.8L16.6 9.8V21H7.4V9.8L5.3 17.4l-2.9-.8L5 5z" />
      {N(7.2, 6.4, 1.5)}{N(16.8, 6.4, 1.5)}{N(4.3, 12.2, 1.5)}{N(19.7, 12.2, 1.5)}
    </>
  ),
  /** a joint node */
  node: <><circle cx="12" cy="12" r="6" />{N(12, 12, 2.25)}</>,
  /** the haptic buzz: a node and its pulse */
  buzz: (
    <>
      {N(12, 12, 2.5)}
      <path d="M7.2 8.2a6 6 0 0 0 0 7.6M16.8 8.2a6 6 0 0 1 0 7.6M4.4 5.6a10 10 0 0 0 0 12.8M19.6 5.6a10 10 0 0 1 0 12.8" />
    </>
  ),
  /** an earbud: the voice cue */
  earbud: (
    <>
      <circle cx="9" cy="8" r="4.6" />
      <path d="M10.6 12.3 11.6 21.5h3l-.8-10.4" />
      <path d="M16.4 4.4a6.6 6.6 0 0 1 0 7.2M19.4 2.4a10.4 10.4 0 0 1 0 11.2" />
    </>
  ),
  /** a phone camera and its one-sided field of view */
  phone: (
    <>
      <path d="M2.5 4.5h6v15h-6z" />
      {N(5.5, 7.5, 1.2)}
      <path d="M8.5 9 21.5 5M8.5 12 21.5 16" />
      <path d="M21.5 5a14 14 0 0 1 0 11" strokeDasharray="1.4 1.8" />
    </>
  ),
  /** both sides tracked: left and right columns of nodes */
  sides: (
    <>
      <circle cx="12" cy="3.6" r="1.9" />
      <path d="M12 6.4V21.5" strokeDasharray="1.4 1.8" />
      <path d="M7.5 7.8h9M7.5 7.8 6 14M16.5 7.8 18 14M9.5 14.5 8.6 21.5M14.5 14.5l.9 7" />
      {N(7.5, 7.8)}{N(16.5, 7.8)}{N(6, 14)}{N(18, 14)}{N(9.3, 17)}{N(14.7, 17)}
    </>
  ),
  /** what a mirror can't show: your back, side-on */
  mirror: (
    <>
      <path d="M2.5 2.5h5v19h-5z" />
      <circle cx="13.6" cy="5" r="2" />
      <path d="M14.4 7.6c1.6 2 2.2 4.2 1.8 6.6M16.2 14.2l-2.6 7.3M16.2 14.2l2 7.3M14.6 9.6 11 11.8" />
      {N(17.4, 10.2, 1.9)}
    </>
  ),
  /** no trainer bill: a dollar, struck */
  cost: (
    <>
      <path d="M15.8 7.6c-.6-1.4-2-2.1-3.8-2.1-2.2 0-3.6 1.1-3.6 2.8 0 1.6 1.2 2.3 3.6 2.9 2.6.6 4 1.4 4 3.2 0 1.8-1.6 3-4 3-2 0-3.6-.8-4.2-2.4M12 3v2.5M12 17.4V21" />
      <path d="M3.5 20.5 20.5 3.5" />
    </>
  ),
  /** your body: two lifters, two proportions */
  bodies: (
    <>
      <circle cx="7" cy="3.6" r="1.8" />
      <path d="M7 5.8V13l-1.6 8.4M7 13l1.6 8.4M4.6 8.4h4.8" />
      <circle cx="17" cy="7.4" r="1.8" />
      <path d="M17 9.6v5l-1.4 6.8M17 14.6l1.4 6.8M14.8 11.6h4.4" />
      {N(7, 13)}{N(17, 14.6)}
    </>
  ),
  /** fatigue: steady, then drifting off your normal */
  fatigue: (
    <>
      <path d="M2.5 8.5h19" strokeDasharray="1.5 2" />
      <path d="M2.5 8.5h11l3 3.8 4.5 6.4" />
      {N(21, 18.7)}
    </>
  ),
  /** a partial rep: range of motion stopping short of the mark */
  partial: (
    <>
      <path d="M4 15a8 8 0 0 1 14.2-5" />
      <path d="M20 15h2.5" />
      {N(12, 15, 2)}
      {N(18.2, 10)}
    </>
  ),
  /** a good rep */
  check: <path d="M4.5 12.6 9.8 17.8 19.8 6.4" />,
  /** a flagged rep */
  flag: <><path d="M6 21.5V2.5" /><path d="M6 3h13.5l-3.4 4.6 3.4 4.6H6z" fill="currentColor" /></>,
  arrow: <path d="M3.5 12h16M13.5 6l6 6-6 6" />,
  /** between sets: the app */
  app: (
    <>
      <rect x="6" y="2.5" width="12" height="19" />
      <path d="M9 7h6M9 10.5h6M9 14h3.5" />
      {N(15, 14, 1.2)}
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 24, title, ...rest }: { name: IconName; size?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(ICONS) as IconName[];
