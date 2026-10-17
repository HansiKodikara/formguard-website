import { useEffect, useState } from "react";

/** Capabilities, decided on the client after hydration (the server always renders the static story). */
export type Caps = { ready: boolean; reduced: boolean; desktop: boolean; /** scroll-pinned storytelling */ pin: boolean };

const SSR_CAPS: Caps = { ready: false, reduced: false, desktop: false, pin: false };

export function useCaps(): Caps {
  const [caps, set] = useState<Caps>(SSR_CAPS);
  useEffect(() => {
    const mqDesk = matchMedia("(min-width: 1024px)");
    const mqRed = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => set({ ready: true, desktop: mqDesk.matches, reduced: mqRed.matches, pin: mqDesk.matches && !mqRed.matches });
    update();
    mqDesk.addEventListener("change", update);
    mqRed.addEventListener("change", update);
    return () => { mqDesk.removeEventListener("change", update); mqRed.removeEventListener("change", update); };
  }, []);
  return caps;
}
