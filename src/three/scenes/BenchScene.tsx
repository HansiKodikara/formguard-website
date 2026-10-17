/**
 * The problem, beat 2: the same bench rep seen twice, side by side, in one WebGL context.
 * Left — a phone propped beside the bench: it tracks the near side only; the far arm is a blind spot.
 * Right — the suit: every joint on both sides, and the far hand's slip flagged at the wrist.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { Bench, Daylight } from "../World";
import { Lifter, type Frame, type Script } from "../Lifter";
import { bench } from "../rig";
import { benchPress, breath, idle, repAt } from "../lifts";
import { NODES, bodyResource } from "../body";
import type { Joint } from "../rig";
import type { SceneProps } from "../../components/Stage";
import { gymTextures, studioEnv } from "../textures";

/** Everything the scene draws, fetched before it mounts, so nothing pops in after the fade. */
export function preload() {
  return Promise.all([bodyResource("lifter"), gymTextures(), studioEnv()]);
}

const FAR: Joint[] = ["shoulderL", "elbowL", "wristL", "handL", "hipL", "kneeL", "ankleL", "toeL"];
export const BENCH_PERIOD = 3.4;

/** Is this rep's far hand slipping, and how much (0..1)? Every second rep slips. */
export function slipAt(t: number) {
  const { index, phase } = repAt(t, BENCH_PERIOD);
  if (index % 2 === 0) return 0;
  return Math.sin(Math.min(1, Math.max(0, (phase - 0.08) / 0.8)) * Math.PI);
}

function DualRender({ frame, gap }: { frame: React.RefObject<Frame | null>; gap: number }) {
  const { gl, scene, size } = useThree();
  const cams = useMemo(() => {
    // a phone propped on the floor beside the bench, framing the lifter side-on
    const phone = new THREE.PerspectiveCamera(40, 1, 0.05, 40);
    phone.position.set(-2.75, 0.62, 0.0);
    phone.lookAt(0.1, 0.72, -0.12);
    const suit = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
    suit.position.set(1.95, 2.55, 1.95);
    suit.lookAt(0, 0.72, -0.22);
    return { phone, suit };
  }, []);
  useFrame(() => {
    const f = frame.current;
    const W = size.width, H = size.height;
    const half = Math.floor((W - gap) / 2);
    gl.autoClear = false;
    gl.setScissorTest(true);
    gl.setClearColor(0x000000, 0);
    const view = (x: number, cam: THREE.PerspectiveCamera, phoneView: boolean) => {
      if (f) {
        // what each instrument can see
        NODES.forEach((n) => f.fig.setNode(n, phoneView ? "off" : "on"));
        if (!phoneView && slipAt(f.t) > 0.25) f.fig.setNode("wristL", "flag");
        f.fig.update(f.rig, 1);  // a snap: re-find the nodes for this view without advancing the eyes
        f.skeleton.flag.clear(); f.skeleton.hidden.clear();
        if (phoneView) FAR.forEach((j) => f.skeleton.hidden.add(j));
        else if (slipAt(f.t) > 0.25) ["wristL", "elbowL", "handL"].forEach((j) => f.skeleton.flag.add(j as Joint));
        f.skeleton.update(f.rig, cam, { width: half, height: H });
        f.ripple.strength = !phoneView && slipAt(f.t) > 0.45 ? 1 : 0;
        f.ripple.at.copy(f.fig.nodePos.get("wristL")!);
        f.ripple.update(f.t, cam);
      }
      cam.aspect = half / H;
      cam.updateProjectionMatrix();
      gl.setViewport(x, 0, half, H);
      gl.setScissor(x, 0, half, H);
      gl.clear();
      gl.render(scene, cam);
    };
    view(0, cams.phone, true);
    view(W - half, cams.suit, false);
    gl.setScissorTest(false);
  }, 1);
  return null;
}

export default function BenchScene({ active, gap = 24, onSlip }: SceneProps & { gap?: number; onSlip?: (slipping: boolean, rep: number) => void }) {
  const frame = useRef<Frame | null>(null);
  const last = useRef<boolean | null>(null);
  const script: Script = (f) => {
    frame.current = f;
    const { phase, index } = repAt(f.t, BENCH_PERIOD);
    const slip = slipAt(f.t);
    const head = idle(f.t).head;
    bench(f.rig, f.P, { press: benchPress(phase), slip, breath: breath(f.t), head: { yaw: head.yaw * 0.5, nod: head.nod * 0.5 } });
    f.skeleton.opacity = 1;
    f.fig.grip = 78;
    const slipping = slip > 0.25;
    if (slipping !== last.current) { last.current = slipping; onSlip?.(slipping, index + 1); }
  };
  return (
    <Canvas frameloop={active ? "always" : "never"} shadows dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
      <Daylight sun={[-2.4, 5.2, 2.8]} />
      <Bench />
      <Suspense fallback={null}><Lifter tone="lab" script={script} /></Suspense>
      <DualRender frame={frame} gap={gap} />
    </Canvas>
  );
}
