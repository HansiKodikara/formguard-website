/** A lifter in the scene: the Anny body, bar, ghost ("your normal") and data overlays, driven by a per-frame script. */
import { use, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { fromBody, makeRig, type Proportions, type Rig } from "./rig";
import { Body, bodyMaterials, bodyResource, ghostMaterial, ghostMaterials, type Variant } from "./body";
import { gymTextures } from "./textures";
import { barbell, type Barbell } from "./props";
import { BarTrace, Ripple, Skeleton } from "./Overlays";

export type Frame = {
  t: number; dt: number; P: Proportions;
  rig: Rig; ghost: Rig; fig: Body; ghostFig: Body;
  bar: Barbell; skeleton: Skeleton; trace: BarTrace; ripple: Ripple;
  /** set by the script */
  ghostOpacity: number; barVisible: boolean; traceFrom: "a" | "b" | null;
};
export type Script = (f: Frame) => void;

export function Lifter({ variant = "lifter", tone = "gym", script, bar = "olympic", position = [0, 0, 0], frozenT, onFrame }: {
  variant?: Variant; tone?: "gym" | "lab"; script: Script; bar?: "olympic" | "curl";
  position?: [number, number, number]; frozenT?: number; onFrame?: (f: Frame) => void;
}) {
  const data = use(bodyResource(variant));
  const gym = use(gymTextures());
  const { camera, size } = useThree();
  const f = useMemo<Frame>(() => {
    const P = fromBody(data.meta.variants[variant].measure);
    const fig = new Body(data, bodyMaterials(data, gym, tone));
    const gm = ghostMaterial(tone === "gym" ? "#f2ede4" : "#1b1a17", 0.55, tone === "gym");
    const ghostFig = new Body(data, ghostMaterials(gm), { pods: false, castShadow: false });
    ghostFig.mesh.renderOrder = 5;
    return {
      t: 0, dt: 0, P, rig: makeRig(), ghost: makeRig(), fig, ghostFig,
      bar: barbell(gym, bar), skeleton: new Skeleton(1.6, tone === "lab"), trace: new BarTrace(tone === "gym" ? "#f2ede4" : "#1b1a17"),
      ripple: new Ripple(), ghostOpacity: 0, barVisible: true, traceFrom: null,
    };
  }, [data, gym, variant, tone, bar]);
  const scriptRef = useRef(script);
  scriptRef.current = script;
  useEffect(() => () => { for (const m of [f.fig.mesh.material, f.ghostFig.mesh.material].flat()) (m as THREE.Material).dispose(); }, [f]);

  useFrame((_, dt) => {
    f.dt = Math.min(dt, 1 / 20);
    f.t = frozenT ?? f.t + f.dt;
    scriptRef.current(f);
    f.fig.update(f.rig, frozenT !== undefined ? 1 : f.dt);
    f.ghostFig.group.visible = f.ghostOpacity > 0.003;
    if (f.ghostFig.group.visible) {
      f.ghostFig.pose(f.ghost);
      ((f.ghostFig.mesh.material as THREE.Material[])[0] as THREE.ShaderMaterial).uniforms.uOpacity.value = f.ghostOpacity;
    }
    f.bar.group.visible = f.barVisible && f.rig.bar.on;
    if (f.bar.group.visible) f.bar.set(f.rig.bar.a, f.rig.bar.b);
    if (f.traceFrom) f.trace.push(f.traceFrom === "a" ? f.rig.bar.a : f.rig.bar.b);
    f.skeleton.update(f.rig, camera, size);
    f.trace.update(size);
    f.ripple.update(f.t, camera);
    onFrame?.(f);
  });

  return (
    <group position={position}>
      <primitive object={f.fig.group} />
      <primitive object={f.ghostFig.group} />
      <primitive object={f.bar.group} />
      <primitive object={f.skeleton.group} />
      <primitive object={f.trace.line} />
      <primitive object={f.ripple.group} />
    </group>
  );
}

/** Smoothly drives the camera toward a target view each frame. */
export function CameraRig({ pos, target, fov = 30, lerp = 1 }: { pos: [number, number, number]; target: [number, number, number]; fov?: number; lerp?: number }) {
  const { camera } = useThree();
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const k = lerp >= 1 ? 1 : 1 - Math.pow(1 - lerp, dt * 60);
    want.set(...pos);
    camera.position.lerp(want, k);
    tgt.lerp(want.set(...target), k);
    camera.lookAt(tgt);
    const pc = camera as THREE.PerspectiveCamera;
    if (Math.abs(pc.fov - fov) > 0.01) { pc.fov += (fov - pc.fov) * k; pc.updateProjectionMatrix(); }
  });
  return null;
}
