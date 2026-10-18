import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Section } from "../components/Section";
import { Kicker } from "../components/Kicker";
import { ScrollTrigger, useGSAP } from "../lib/gsap";
import type { Caps } from "../lib/env";

/**
 * For choosing between the two lifters: the earlier real-time Anny lifter (src/anny, from origin/realistic-model)
 * doing the same story as 'How it works' above, driven by scroll the same way. Temporary: whichever loses goes.
 */
const HowScene = lazy(() => import("../anny/HowScene"));
const PIN_SCREENS = 2.4;

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: "50% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

export function AnnyCompare({ caps }: { caps: Caps }) {
  const pin = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const visible = useInView(pin);

  useGSAP(() => {
    if (!caps.pin) return;
    const t = ScrollTrigger.create({
      trigger: pin.current, start: "top top", end: () => "+=" + innerHeight * PIN_SCREENS, pin: true, anticipatePin: 1,
      refreshPriority: -1,                        // after any pin above has added its scroll space
      onUpdate: (self) => { progress.current = self.progress; },
    });
    return () => t.kill();
  }, { dependencies: [caps.pin] });

  // phones: no pin; the story follows the section through the viewport
  useEffect(() => {
    if (caps.pin) return;
    const el = pin.current;
    const on = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      progress.current = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
    };
    on(); addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, [caps.pin]);

  return (
    <Section id="compare-anny" surface="chalk" label="Compare: the earlier 3D lifter">
      <div ref={pin} className={`relative overflow-hidden ${caps.pin ? "h-[100svh] min-h-[640px]" : "py-20"}`}>
        <div className="wrap grid-12 h-full items-center gap-y-8">
          <div className="col-span-12 lg:col-span-4">
            <Kicker index="A/B">Compare</Kicker>
            <h2 className="t-head mt-6 text-[clamp(2rem,3vw,3.25rem)] leading-[1]">The earlier Anny lifter, real-time 3D.</h2>
            <p className="mt-6 max-w-[36ch] text-lead">The same story as above: warm-up reps, then rep 7, where the left knee caves on the way up. Scroll to play it, drag to turn it.</p>
          </div>
          <div className={`col-span-12 lg:col-span-8 ${caps.pin ? "h-[min(calc(100svh-var(--header-h)-4rem),46rem)]" : "aspect-[4/5]"}`}>
            {visible && (
              <Suspense fallback={null}>
                <HowScene active={visible} progress={progress} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
