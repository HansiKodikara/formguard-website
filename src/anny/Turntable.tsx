/**
 * Drag to turn the world around the lifter, like a sculptor's turntable. The lights and the studio's
 * reflections turn with it, so it reads as walking around the lifter. A flick keeps spinning and slows
 * naturally; let go for a moment and it eases back to the composed view, so the page's framing (and the
 * callouts placed against it) returns. Horizontal drags only: a vertical swipe still scrolls the page.
 */
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";

const TAU = Math.PI * 2;
const wrap = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

export function Turntable({ children, returnAfter = 2.5 }: { children: ReactNode; returnAfter?: number }) {
  const group = useRef<THREE.Group>(null);
  const { gl, scene } = useThree();
  const st = useMemo(() => ({
    yaw: 0, vel: 0, idle: 0, envBase: 0,
    drag: false, decided: false, id: -1, x0: 0, y0: 0, lastX: 0, lastT: 0,
  }), []);

  useEffect(() => {
    const el = gl.domElement;
    st.envBase = scene.environmentRotation.y;
    el.style.touchAction = "pan-y";
    el.style.cursor = "grab";
    const begin = (e: PointerEvent) => {
      st.decided = true;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) return;
      Object.assign(st, { drag: true, decided: false, id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastT: e.timeStamp, vel: 0 });
      if (e.pointerType === "mouse") begin(e);
    };
    const move = (e: PointerEvent) => {
      if (!st.drag || e.pointerId !== st.id) return;
      if (!st.decided) {
        // touch: wait to see which way the finger goes; vertical belongs to the page
        const dx = Math.abs(e.clientX - st.x0), dy = Math.abs(e.clientY - st.y0);
        if (dx + dy < 8) return;
        if (dy > dx) { st.drag = false; return; }
        begin(e);
      }
      // dragging across the full canvas turns the world about half way round
      const k = Math.PI / Math.max(500, el.clientWidth);
      const d = (e.clientX - st.lastX) * k, dt = Math.max(8, e.timeStamp - st.lastT) / 1000;
      st.yaw += d;
      st.vel = st.vel * 0.35 + (d / dt) * 0.65;
      st.lastX = e.clientX; st.lastT = e.timeStamp; st.idle = 0;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== st.id) return;
      // a pause before letting go means no flick
      if (e.timeStamp - st.lastT > 80) st.vel = 0;
      st.drag = false;
      el.style.cursor = "grab";
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.style.cursor = "";
    };
  }, [gl, scene, st]);

  useFrame((_, dt) => {
    if (!st.drag) {
      st.yaw += st.vel * dt;
      st.vel *= Math.exp(-dt * 2.8);
      st.idle += dt;
      if (st.idle > returnAfter && Math.abs(st.vel) < 0.1) st.yaw += wrap(-st.yaw) * (1 - Math.exp(-dt * 1.4));
    }
    st.yaw = wrap(st.yaw);
    if (group.current) group.current.rotation.y = st.yaw;
    scene.environmentRotation.y = st.envBase + st.yaw;
  });

  return <group ref={group}>{children}</group>;
}
