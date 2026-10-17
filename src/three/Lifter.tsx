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

/** A soft dark ellipse for under a foot: where the shoe meets the floor, light can't reach. */
let _contact: THREE.Texture | null = null;
function contactTexture() {
  if (_contact) return _contact;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,1)");
  grd.addColorStop(0.45, "rgba(0,0,0,0.75)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _contact = new THREE.CanvasTexture(c);
  return _contact;
}
function footShadows() {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: contactTexture(), color: "#2b2219", transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return [new THREE.Mesh(geo, mat), new THREE.Mesh(geo, mat)];
}

export function Lifter({ variant = "lifter", tone = "gym", script, bar = "olympic", position = [0, 0, 0], floor = 0, frozenT, onFrame }: {
  variant?: Variant; tone?: "gym" | "lab"; script: Script; bar?: "olympic" | "curl";
  /** the floor's height under the feet (the platform's top), for the contact shadows */
  position?: [number, number, number]; floor?: number; frozenT?: number; onFrame?: (f: Frame) => void;
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
  const feet = useMemo(footShadows, []);
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
    if (f.bar.group.visible) f.bar.set(f.rig.bar.a, f.rig.bar.b, frozenT !== undefined ? undefined : f.dt);
    if (f.traceFrom) f.trace.push(f.traceFrom === "a" ? f.rig.bar.a : f.rig.bar.b);
    // contact shadows: under each foot, heel to toe, fading as the heel lifts off the floor
    (["L", "R"] as const).forEach((s, i) => {
      const m = feet[i], heel = f.rig.j[`heel${s}`], toe = f.rig.j[`toe${s}`];
      m.position.set((heel.x + toe.x) / 2, floor + 0.001, (heel.z + toe.z) / 2 + 0.005);
      m.rotation.y = Math.atan2(toe.x - heel.x, toe.z - heel.z);
      m.scale.set(0.15, 1, Math.hypot(toe.x - heel.x, toe.z - heel.z) * 1.9);
      m.visible = heel.y < 0.12;
    });
    f.skeleton.update(f.rig, camera, size);
    f.trace.update(size);
    f.ripple.update(f.t, camera);
    onFrame?.(f);
  });

  return (
    <group position={position}>
      <primitive object={f.fig.group} />
      <primitive object={feet[0]} />
      <primitive object={feet[1]} />
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
