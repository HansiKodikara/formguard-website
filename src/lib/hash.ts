import { useEffect } from "react";

/**
 * Arriving on a link like /#test-lifter (the showcase QR code), on any phone, tablet or laptop.
 *
 * The browser looks for the anchor before React has drawn the page, so on its own it never jumps; and fonts, images
 * and the 3D above can still push the section down after it has. So: put the section's top just under the header
 * once the page is drawn, and again every time the layout above it changes, for up to 10 s, until the visitor does
 * anything themselves (touch, click, wheel, key), and from then on leave the scroll to them.
 */
const SETTLE_MS = 10_000;

export function useHashLanding() {
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id || !/^[\w-]+$/.test(id)) return;
    // stop the browser putting back an old scroll position (reloads, iOS Safari) over ours
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    let done = false;
    const jump = () => {
      if (done) return;
      const el = document.getElementById(id);
      if (!el) return;
      // measure the header rather than trust CSS: it's fixed, so it covers the top of whatever we land on
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      const top = Math.max(0, Math.floor(el.getBoundingClientRect().top + scrollY - header));
      if (Math.abs(scrollY - top) >= 1) scrollTo({ top, left: 0, behavior: "instant" as ScrollBehavior });
    };

    const rerun = () => requestAnimationFrame(jump);
    const layout = new ResizeObserver(rerun);         // anything above growing or shrinking
    layout.observe(document.body);
    rerun();
    document.fonts?.ready.then(rerun);
    addEventListener("load", rerun);
    addEventListener("resize", rerun);                // rotation, the iOS toolbar, a desktop window resize

    const finish = () => {
      if (done) return;
      done = true;
      layout.disconnect();
      clearTimeout(timer);
      removeEventListener("load", rerun);
      removeEventListener("resize", rerun);
      for (const e of INPUT) removeEventListener(e, finish, true);
    };
    const INPUT = ["pointerdown", "touchstart", "wheel", "keydown"] as const;
    for (const e of INPUT) addEventListener(e, finish, { capture: true, passive: true });
    const timer = setTimeout(finish, SETTLE_MS);
    return finish;
  }, []);
}
