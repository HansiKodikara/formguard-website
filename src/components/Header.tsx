import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { ButtonLink } from "./Button";
import { ScrollScale } from "./ScrollScale";

/** Sticky, minimal: the logo and the one call to action. Takes the colour of the section beneath it. */
export function Header() {
  const [surface, setSurface] = useState<"iron" | "chalk">("chalk");
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const probe = () => {
      setScrolled(scrollY > 8);
      const el = document.elementsFromPoint(innerWidth / 2, 40).find((e) => (e as HTMLElement).dataset?.surface) as HTMLElement | undefined;
      const s = el?.dataset.surface;
      // the header is Iron over dark sections and Chalk over everything else (the logo never sits on red)
      if (s) setSurface(s === "iron" ? "iron" : "chalk");
    };
    let raf = 0;
    const on = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; probe(); }); };
    probe();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); };
  }, []);
  const dark = surface === "iron";
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,color] duration-500 ease-[var(--ease-physical)] ${dark ? "surface-iron" : "surface-chalk"} ${scrolled ? "" : "!bg-transparent"} border-b ${scrolled ? "border-[var(--rule)]" : "border-transparent"}`}
    >
      <div className="wrap flex h-[var(--header-h)] items-center justify-between">
        <a href="#top" className="-m-2 p-2" aria-label="FormGuard, back to top">
          <Logo tone={dark ? "reversed" : "primary"} height={24} decorative />
        </a>
        <ButtonLink href="#test-lifter" size="sm" arrow>Become a test lifter</ButtonLink>
      </div>
      <ScrollScale />
    </header>
  );
}
