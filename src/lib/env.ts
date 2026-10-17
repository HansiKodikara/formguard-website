import { useEffect, useState } from "react";

/** Capabilities, decided on the client after hydration (the server always renders the static story). */
export type Caps = { ready: boolean; live3D: boolean; reduced: boolean; desktop: boolean };

const SSR_CAPS: Caps = { ready: false, live3D: false, reduced: false, desktop: false };

function webgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function useCaps(): Caps {
  const [caps, set] = useState<Caps>(SSR_CAPS);
  useEffect(() => {
    const mqDesk = matchMedia("(min-width: 1024px)");
    const mqRed = matchMedia("(prefers-reduced-motion: reduce)");
    const forced = new URLSearchParams(location.search).get("static") === "1";
    const update = () => {
      const desktop = mqDesk.matches;
      const reduced = mqRed.matches;
      set({ ready: true, desktop, reduced, live3D: desktop && !reduced && !forced && webgl() });
    };
    update();
    mqDesk.addEventListener("change", update);
    mqRed.addEventListener("change", update);
    return () => { mqDesk.removeEventListener("change", update); mqRed.removeEventListener("change", update); };
  }, []);
  return caps;
}
