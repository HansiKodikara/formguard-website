import { useEffect } from "react";

/**
 * Arriving on a link like /#test-lifter (the showcase QR code). The browser looks for the anchor before React has
 * drawn the page, so it never jumps; and fonts, images and 3D above it can still move it once it's there. So:
 * jump once the page is drawn, then again as fonts and the rest load, until the visitor scrolls for themselves.
 */
export function useHashLanding() {
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    let gave = false;
    const jump = () => {
      if (gave) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "start" });
    };
    // any input of their own means they've taken over
    const stop = () => { gave = true; };
    requestAnimationFrame(jump);
    document.fonts?.ready.then(jump);
    addEventListener("load", jump);
    const timers = [400, 1200, 2500].map((t) => setTimeout(jump, t));
    addEventListener("wheel", stop, { passive: true });
    addEventListener("touchstart", stop, { passive: true });
    addEventListener("keydown", stop);
    return () => {
      timers.forEach(clearTimeout);
      removeEventListener("load", jump);
      removeEventListener("wheel", stop); removeEventListener("touchstart", stop); removeEventListener("keydown", stop);
    };
  }, []);
}
