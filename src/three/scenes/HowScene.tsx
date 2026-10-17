/**
 * How it works, driven by scroll progress (0..1 across five steps):
 *  0 the suit — nodes come online      1 warm-up — the ghost "your normal" forms
 *  2 every rep checked — rep 7 caves   3 told mid-set — buzz at the knee, rep 8 clean
 *  4 between sets — the lifter racks the bar, the stage steps back for the app
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { Daylight } from "../World";
import { Lifter, type Frame, type Script } from "../Lifter";
import { squat } from "../rig";
import { breath, smooth, squatDepth, valgusCurve } from "../lifts";
import { NODES, bodyResource } from "../body";
import type { SceneProps } from "../../components/Stage";
import { gymTextures, studioEnv } from "../textures";

/** Everything the scene draws, fetched before it mounts, so nothing pops in after the fade. */
export function preload() {
  return Promise.all([bodyResource("lifter"), gymTextures(), studioEnv()]);
}

export type HowAnchors = { knee: { x: number; y: number; visible: boolean }; ghost: { x: number; y: number; visible: boolean } };

type Shot = { pos: [number, number, number]; target: [number, number, number]; fov: number };
const SHOTS: Shot[] = [
  { pos: [2.0, 1.5, 4.4], target: [0, 1.05, 0], fov: 27 },
  { pos: [2.5, 1.25, 4.8], target: [0, 0.86, 0], fov: 27 },
  { pos: [0.35, 0.98, 4.0], target: [0, 0.68, 0.04], fov: 29 },
  { pos: [0.75, 0.84, 3.2], target: [0.06, 0.6, 0.06], fov: 29 },
  { pos: [2.9, 1.5, 5.6], target: [0, 1.0, 0], fov: 27 },
];

/** step + local progress, with gentle holds at each step's start and end */
export function stepOf(p: number) {
  const x = Math.min(4.999, Math.max(0, p * 5));
  const step = Math.floor(x);
  return { step, local: x - step };
}

const VALGUS = 12;

/** The lift as a function of scroll: deterministic, so any frame can also be rendered as a still. */
export function howPose(p: number) {
  const { step, local } = stepOf(p);
  let depth = 0, valgus = 0, rep = 0, flag = false, good = false, buzz = 0, ghost = 0, overlay = 0, nodes = 1;
  if (step === 0) {
    nodes = smooth(0.05, 0.85, local);
  } else if (step === 1) {
    depth = squatDepth(local * 2 % 1);
    ghost = 0.55 * smooth(0.0, 0.7, local);
    rep = 1 + Math.floor(local * 2);
  } else if (step === 2) {
    ghost = 0.55;
    overlay = smooth(0, 0.25, local);
    if (local < 0.42) {
      depth = squatDepth(local / 0.42);           // rep 6: clean
      rep = 6;
    } else {
      const ph = ((local - 0.42) / 0.58) * 0.62;   // rep 7: down, then the knees cave as the drive starts
      depth = squatDepth(ph);
      valgus = valgusCurve(ph, VALGUS);
      rep = 7;
    }
    flag = valgus > 4;
  } else if (step === 3) {
    ghost = 0.55; overlay = 1;
    if (local < 0.3) {
      // still at the bottom of rep 7: the buzz at the knee, the cue in the ear
      depth = squatDepth(0.62 + (local / 0.3) * 0.04);
      valgus = VALGUS;
      buzz = smooth(0, 0.06, local) * (1 - smooth(0.26, 0.3, local));
      flag = true; rep = 7;
    } else if (local < 0.55) {
      // the drive finishes with the knees pushed back out
      const k = (local - 0.3) / 0.25;
      depth = squatDepth(0.66 + k * 0.22);
      valgus = VALGUS * (1 - smooth(0, 0.6, k));
      flag = valgus > 4; good = !flag; rep = 7;
    } else {
      depth = squatDepth((local - 0.55) / 0.45);  // rep 8: clean
      good = true; rep = 8;
    }
  } else {
    overlay = 1 - smooth(0.1, 0.5, local);
    ghost = 0.55 * (1 - smooth(0.1, 0.5, local));
    rep = 8;
  }
  return { step, local, depth, valgus, rep, flag, good, buzz, ghost, overlay, nodes };
}

function lerpShot(p: number, out: Shot) {
  const x = Math.min(4, Math.max(0, p * 5 - 0.5));   // move between shots across each step boundary
  const i = Math.floor(x), k = smooth(0, 1, x - i);
  const a = SHOTS[i], b = SHOTS[Math.min(4, i + 1)];
  for (let n = 0; n < 3; n++) { out.pos[n] = a.pos[n] + (b.pos[n] - a.pos[n]) * k; out.target[n] = a.target[n] + (b.target[n] - a.target[n]) * k; }
  out.fov = a.fov + (b.fov - a.fov) * k;
  return out;
}

function Director({ progress, frame, onAnchors, frozenP }: {
  progress: { current: number }; frame: React.RefObject<Frame | null>; onAnchors?: (a: HowAnchors) => void; frozenP?: number;
}) {
  const { camera, size } = useThree();
  const shot = useMemo<Shot>(() => ({ pos: [0, 0, 0], target: [0, 0, 0], fov: 27 }), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const smoothP = useRef(frozenP ?? 0);
  useFrame((_, dt) => {
    // ease toward the scroll position: physical, never jumpy
    const want = frozenP ?? progress.current;
    smoothP.current += (want - smoothP.current) * (frozenP !== undefined ? 1 : Math.min(1, dt * 6));
    lerpShot(smoothP.current, shot);
    camera.position.set(...shot.pos);
    camera.lookAt(tgt.set(...shot.target));
    const pc = camera as THREE.PerspectiveCamera;
    if (pc.fov !== shot.fov) { pc.fov = shot.fov; pc.updateProjectionMatrix(); }
    const f = frame.current;
    if (f && onAnchors) {
      const proj = (p: THREE.Vector3) => {
        v.copy(p).project(camera);
        return { x: (v.x * 0.5 + 0.5) * size.width, y: (-v.y * 0.5 + 0.5) * size.height, visible: v.z < 1 };
      };
      onAnchors({ knee: proj(f.fig.nodePos.get("kneeL") ?? f.rig.j.kneeL), ghost: proj(f.ghost.j.kneeR) });
    }
  });
  return null;
}

export default function HowScene({ active, progress, onAnchors, frozenP }: SceneProps & {
  progress: { current: number }; onAnchors?: (a: HowAnchors) => void; frozenP?: number;
}) {
  const frame = useRef<Frame | null>(null);
  const shown = useRef(frozenP ?? 0);
  const script: Script = (f) => {
    frame.current = f;
    shown.current += ((frozenP ?? progress.current) - shown.current) * (frozenP !== undefined ? 1 : Math.min(1, f.dt * 6));
    const s = howPose(shown.current);
    squat(f.rig, f.P, { depth: s.depth, valgusL: s.valgus, valgusR: s.valgus * 0.45, breath: breath(f.t) });
    squat(f.ghost, f.P, { depth: s.depth });
    f.ghostOpacity = s.ghost;
    f.skeleton.opacity = s.overlay;
    f.skeleton.flag.clear(); f.skeleton.good.clear();
    const lit = Math.round(s.nodes * NODES.length);
    NODES.forEach((n, i) => f.fig.setNode(n, i < lit ? "on" : "off"));
    if (s.flag) { f.fig.setNode("kneeL", "flag"); (["hipL", "kneeL", "ankleL"] as const).forEach((j) => f.skeleton.flag.add(j)); }
    if (s.good) { f.fig.setNode("kneeL", "good"); f.fig.setNode("kneeR", "good"); (["hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"] as const).forEach((j) => f.skeleton.good.add(j)); }
    f.ripple.strength = s.buzz;
    f.ripple.at.copy(f.fig.nodePos.get("kneeL") ?? f.rig.j.kneeL);
    f.fig.grip = 76;
  };
  return (
    <Canvas frameloop={active ? "always" : "never"} shadows dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }} camera={{ fov: 27, position: SHOTS[0].pos, near: 0.1, far: 40 }}>
      <Daylight showRack rackX={0.5} rackZ={-2.1} />
      <Suspense fallback={null}><Lifter tone="lab" script={script} frozenT={frozenP !== undefined ? 2 : undefined} /></Suspense>
      <Director progress={progress} frame={frame} onAnchors={onAnchors} frozenP={frozenP} />
    </Canvas>
  );
}
