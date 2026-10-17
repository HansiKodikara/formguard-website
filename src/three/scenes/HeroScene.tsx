/** Hero: daylight, a lifter warming up — real reps, every joint online, the suit measuring as they move. */
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useRef } from "react";
import type { PerspectiveCamera } from "three";
import { Daylight } from "../World";
import { CameraRig, Lifter, type Script } from "../Lifter";
import { squat } from "../rig";
import { breath, repAt, squatDepth } from "../lifts";
import { NODES, bodyResource } from "../body";
import type { SceneProps } from "../../components/Stage";
import { gymTextures, studioEnv } from "../textures";

/** Everything the scene draws, fetched before it mounts, so nothing pops in after the fade. */
export function preload() {
  return Promise.all([bodyResource("lifter"), gymTextures(), studioEnv()]);
}

export const NODE_START = 0.5, NODE_STEP = 0.1, HERO_PERIOD = 4.4;
export type HeroHud = { nodes: number; rep: number; knee: number; depth: number };

/** Shift the frustum (not the camera) so the lifter sits right of centre. Wider canvases push further
 *  right, because the headline (sized in vw inside a capped container) takes more of a wide screen. */
export function FrameOffset({ x = 0, y = 0, perAspect = 0 }: { x?: number; y?: number; perAspect?: number }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const c = camera as PerspectiveCamera;
    const ox = x + Math.max(0, size.width / size.height - 1.6) * perAspect;
    c.setViewOffset(size.width, size.height, -size.width * ox, -size.height * y, size.width, size.height);
    return () => c.clearViewOffset();
  }, [camera, size, x, y, perAspect]);
  return null;
}

export default function HeroScene({ active, onHud, frozenT }: SceneProps & { onHud?: (h: HeroHud) => void; frozenT?: number }) {
  const last = useRef("");
  const script: Script = (f) => {
    // two seconds standing while the suit comes online, then steady warm-up reps
    const t = Math.max(0, f.t - 2.2);
    const { index, phase } = repAt(t, HERO_PERIOD);
    const d = f.t < 2.2 ? 0 : squatDepth(phase);
    squat(f.rig, f.P, { depth: d, breath: breath(f.t) });
    let lit = 0;
    NODES.forEach((n, i) => {
      const on = f.t > NODE_START + i * NODE_STEP;
      f.fig.setNode(n, on ? "on" : "off");
      lit += on ? 1 : 0;
    });
    f.skeleton.opacity = Math.min(0.55, Math.max(0, (f.t - 1.6) * 0.5));
    f.traceFrom = f.t > 2.2 ? "a" : null;
    f.trace.opacity = 0.5;
    f.fig.grip = 76;
    const hud = { nodes: lit, rep: f.t < 2.2 ? 0 : index + 1, knee: Math.round(f.rig.angle.kneeL), depth: Math.round(d * 100) };
    const key = `${hud.nodes}|${hud.rep}|${Math.round(hud.knee / 2)}|${Math.round(hud.depth / 5)}`;
    if (key !== last.current) { last.current = key; onHud?.(hud); }
  };
  return (
    <Canvas frameloop={active ? "always" : "never"} shadows dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 25, position: [4.7, 1.5, 3.25], near: 0.1, far: 40 }}>
      <Daylight showRack rackX={-0.6} rackZ={-1.7} />
      <Suspense fallback={null}><Lifter tone="lab" script={script} frozenT={frozenT} /></Suspense>
      <CameraRig pos={[4.7, 1.5, 3.25]} target={[0, 0.92, 0]} fov={25} />
      <FrameOffset x={0.24} y={-0.02} perAspect={0.2} />
    </Canvas>
  );
}
