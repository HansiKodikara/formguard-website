/**
 * Mounts a code-split 3D scene only when it's near the viewport, pauses it when off screen, and
 * unmounts it when far away. Until then — and always on mobile or with reduced motion — it shows
 * the pre-rendered still of the same scene, so the story never depends on WebGL.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from "react";

export type SceneProps = { active: boolean };

export function Stage<P extends object>({
  load, props, live, still, alt, className = "", fadeIn = true,
}: {
  load: () => Promise<{ default: ComponentType<P & SceneProps> }>;
  props: P;
  live: boolean;
  still?: string;
  alt: string;
  className?: string;
  fadeIn?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [shown, setShown] = useState(false);
  const Scene = useMemo(() => lazy(load), [load]);

  useEffect(() => {
    if (!live || !ref.current) return;
    const el = ref.current;
    const nearIO = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "120% 0px 120% 0px" });
    const seenIO = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "10% 0px 10% 0px" });
    nearIO.observe(el);
    seenIO.observe(el);
    return () => { nearIO.disconnect(); seenIO.disconnect(); };
  }, [live]);

  useEffect(() => {
    if (!near) setShown(false);
  }, [near]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {still && (!live || !shown) && (
        <img src={still} alt={alt} className="absolute inset-0 h-full w-full object-cover" decoding="async" loading="lazy" />
      )}
      {!still && <span className="sr-only">{alt}</span>}
      {live && near && (
        <div className={`absolute inset-0 transition-opacity duration-[1200ms] ease-[var(--ease-physical)] ${shown || !fadeIn ? "opacity-100" : "opacity-0"}`} aria-hidden>
          <Suspense fallback={null}>
            <ReadyGate onReady={() => setShown(true)}>
              <Scene {...props} active={onScreen} />
            </ReadyGate>
          </Suspense>
        </div>
      )}
    </div>
  );
}

function ReadyGate({ children, onReady }: { children: React.ReactNode; onReady: () => void }) {
  useEffect(() => {
    // two frames after the scene mounts, the first frame has been drawn
    let a = 0, b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(onReady); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [onReady]);
  return <>{children}</>;
}
