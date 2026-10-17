import { COLORS, LOGO } from "../brand/logo-data";

export type LogoVariant = "lockup" | "symbol" | "stacked";
/** primary: Iron + red bar (light bg) · reversed: Chalk + red bar (dark bg) · iron/chalk: one colour ·
 *  current: ink follows CSS `color`, bar stays red · adaptive: Iron, Chalk in dark mode (favicon) */
export type LogoTone = "primary" | "reversed" | "iron" | "chalk" | "current" | "adaptive";

const INK: Record<LogoTone, string> = {
  primary: COLORS.iron, reversed: COLORS.chalk, iron: COLORS.iron, chalk: COLORS.chalk, current: "currentColor", adaptive: COLORS.iron,
};
const BAR: Record<LogoTone, string> = {
  primary: COLORS.red, reversed: COLORS.red, iron: COLORS.iron, chalk: COLORS.chalk, current: COLORS.red, adaptive: COLORS.red,
};

/** BRAND.md: the symbol's master artwork at 48px and up, the pixel-drawn cuts below it. */
function artFor(variant: LogoVariant, height?: number) {
  if (variant !== "symbol" || height === undefined) return LOGO[variant];
  if (height < 32) return LOGO.symbol16;
  if (height < 48) return LOGO.symbol32;
  return LOGO.symbol;
}

type Props = {
  variant?: LogoVariant;
  tone?: LogoTone;
  /** rendered height in CSS px; required for the symbol to pick the right cut */
  height?: number;
  className?: string;
  title?: string;
  /** hide from assistive tech when a visible label already names it */
  decorative?: boolean;
};

/** The one FormGuard logo. Header, footer, favicon and Open Graph image all render through this. */
export function Logo({ variant = "lockup", tone = "primary", height, className, title = "FormGuard", decorative }: Props) {
  const a = artFor(variant, height);
  const width = height !== undefined ? Math.round(((height * a.w) / a.h) * 100) / 100 : undefined;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${a.w} ${a.h}`}
      width={width}
      height={height}
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      {tone === "adaptive" && (
        <style>{`.fg-ink{fill:${COLORS.iron}}@media (prefers-color-scheme:dark){.fg-ink{fill:${COLORS.chalk}}}`}</style>
      )}
      <path className={tone === "adaptive" ? "fg-ink" : undefined} fill={tone === "adaptive" ? undefined : INK[tone]} d={a.ink} />
      <path fill={BAR[tone]} d={a.bar} />
    </svg>
  );
}
