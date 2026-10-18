import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import PODS from "./suitPods.json";

/**
 * Sensor callouts, drawn like a technical drawing over the model: a hairline ring round each pod, a dashed outer
 * ring, and a leader out to a label. They turn with the model and fade as a pod turns away from the camera.
 * Chalk only, no glow; the pods themselves keep their red dots. Positions come from export_web.py (suitPods.json).
 * The labels are plain DOM (<SensorLabels>, laid over the canvas) moved here each frame.
 */
const CHALK = "#F2EDE4";
const NAMES: Record<string, string> = {
  Wrist: "Wrist", Bicep: "Upper arm", Trap: "Shoulder", Thigh: "Thigh", Shin: "Shin",
  ShoulderBlades: "Upper back", LowerBack: "Lower back", Controller: "Controller",
};
export const label = (id: string) => {
  const [k, side] = id.split("_");
  return side ? `${NAMES[k]} · ${side}` : NAMES[k];
};
// leader rise per pod (m): the lower-back pod sits right under the controller, so its leader goes down
const RISE: Record<string, number> = { LowerBack: -0.07, Controller: 0.06 };

const R_IN = 0.024, R_OUT = 0.036, OUT = 0.085, ELBOW = 0.07;
const UP = new THREE.Vector3(0, 1, 0);

function circle(c: THREE.Vector3, n: THREE.Vector3, r: number, seg = 48) {
  const u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  return Array.from({ length: seg + 1 }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return c.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r);
  });
}

const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tmp = { toCam: new THREE.Vector3(), right: new THREE.Vector3(), p2: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() };

type Labels = React.RefObject<HTMLDivElement | null>;

function Callout({ id, p, n, labels }: { id: string; p: number[]; n: number[]; labels: Labels }) {
  const pod = useMemo(() => {
    const c = new THREE.Vector3(...p), nn = new THREE.Vector3(...n).normalize();
    const lift = c.clone().addScaledVector(nn, 0.006);             // just off the fabric
    const p1 = c.clone().addScaledVector(nn, OUT).addScaledVector(UP, RISE[id] ?? 0.04);
    const start = c.clone().addScaledVector(p1.clone().sub(c).normalize(), R_OUT); // leave from the outer ring
    return { c, n: nn, lift, p1, start, inner: circle(lift, nn, R_IN), outer: circle(lift, nn, R_OUT, 40) };
  }, [id, p, n]);
  const inner = useRef<Line2>(null), outer = useRef<Line2>(null), lead = useRef<Line2 | LineSegments2>(null);
  const spin = useRef<THREE.Group>(null);

  useFrame(({ camera, size }, dt) => {
    const text = labels.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    // fade with how squarely the pod faces the camera
    const f = tmp.toCam.copy(camera.position).sub(pod.c).normalize().dot(pod.n);
    const o = THREE.MathUtils.smoothstep(f, 0.05, 0.4);
    for (const l of [inner.current, outer.current, lead.current]) if (l) { l.material.opacity = o * (l === outer.current ? 0.55 : 0.9); l.visible = o > 0.01; }
    if (text) text.style.opacity = String(o);
    // the elbow runs sideways on screen, outward from the body's centre line
    tmp.right.setFromMatrixColumn(camera.matrixWorld, 0);
    const s = Math.sign(tmp.a.set(pod.p1.x, 0, pod.p1.z).dot(tmp.right) || 1);
    tmp.p2.copy(pod.p1).addScaledVector(tmp.right, s * (size.width < 520 ? ELBOW * 0.5 : ELBOW));
    lead.current?.geometry.setPositions([...pod.start.toArray(), ...pod.p1.toArray(), ...tmp.p2.toArray()]);
    if (text) {
      tmp.b.copy(tmp.p2).project(camera);
      const x = ((tmp.b.x + 1) / 2) * size.width, y = ((1 - tmp.b.y) / 2) * size.height;
      // beside the line's end, on the side it runs to, but never past the frame's edge
      const w = text.offsetWidth, left = s > 0 ? Math.min(x + 6, size.width - 4 - w) : Math.max(x - 6 - w, 4);
      text.style.transform = `translate(${left.toFixed(1)}px, ${y.toFixed(1)}px) translateY(-50%)`;
    }
    // the outer ring turns slowly about the pod
    if (spin.current && !still) spin.current.rotateOnWorldAxis(pod.n, dt * 0.6);
  });

  const common = { color: CHALK, transparent: true, depthTest: false, depthWrite: false, renderOrder: 10 } as const;
  return (
    <group>
      <Line ref={inner} points={pod.inner} lineWidth={1.2} {...common} />
      <group ref={spin} position={pod.lift}>
        <Line ref={outer} points={pod.outer.map((q) => q.clone().sub(pod.lift))} lineWidth={1} dashed dashSize={0.012} gapSize={0.008} {...common} />
      </group>
      <Line ref={lead} points={[pod.start, pod.p1, pod.p1]} lineWidth={1} {...common} />
    </group>
  );
}

/** inside the Canvas: the rings and leaders */
export function SensorCallouts({ labels }: { labels: Labels }) {
  return <>{PODS.map((d) => <Callout key={d.id} {...d} labels={labels} />)}</>;
}

/** outside the Canvas, over it: the labels (opacity 0 until the first frame places them) */
export function SensorLabels({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PODS.map((d) => <span key={d.id} data-id={d.id} className="fg-callout" style={{ opacity: 0 }}>{label(d.id)}</span>)}
    </div>
  );
}
