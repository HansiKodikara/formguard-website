/** Dev-only test bench for the 3D lifter. /lab/figure.html?lift=squat&env=gym&cam=front34&overlay=1&ghost=1&t=1.6 */
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { bench, curl, squat } from "../three/rig";
import { breath, benchPress, curlFlex, repAt, squatDepth, valgusCurve } from "../three/lifts";
import { CameraRig, Lifter, type Script } from "../three/Lifter";
import { Gym, Lab } from "../three/World";
import { NODES, type Variant } from "../three/body";
import { benchModel } from "../three/props";

const CAMS: Record<string, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  front34: { pos: [2.3, 1.35, 4.3], target: [0, 0.92, 0], fov: 28 },
  hero: { pos: [1.6, 1.15, 5.2], target: [-0.75, 1.15, 0], fov: 30 },
  front: { pos: [0, 1.05, 4.8], target: [0, 0.9, 0], fov: 27 },
  side: { pos: [4.8, 1.05, 0.1], target: [0, 0.9, 0], fov: 27 },
  curl: { pos: [3.6, 1.3, 2.6], target: [0, 1.0, 0], fov: 27 },
  closeUpper: { pos: [1.2, 1.55, 2.0], target: [0, 1.25, 0], fov: 26 },
  closeSquat: { pos: [1.5, 0.9, 2.3], target: [0, 0.62, 0.05], fov: 30 },
  low: { pos: [1.8, 0.55, 3.6], target: [0, 1.0, 0], fov: 32 },
  benchPhone: { pos: [-1.55, 0.6, -0.15], target: [0, 0.68, -0.25], fov: 48 },
  benchSuit: { pos: [2.2, 2.4, 2.1], target: [0, 0.62, -0.15], fov: 30 },
};

export function FigureLab() {
  const q = new URLSearchParams(location.search);
  const lift = q.get("lift") ?? "stand";
  const env = q.get("env") ?? "gym";
  const cam = CAMS[q.get("cam") ?? (lift === "bench" ? "benchSuit" : "front34")];
  const overlay = q.get("overlay") === "1";
  const ghost = q.get("ghost") === "1";
  const frozen = q.has("t") ? Number(q.get("t")) : undefined;
  const variant = (q.get("body") ?? "lifter") as Variant;
  const benchObj = useMemo(() => (lift === "bench" ? benchModel() : null), [lift]);

  const script: Script = (f) => {
    const t = f.t;
    f.skeleton.opacity = overlay ? 1 : 0;
    f.ghostOpacity = ghost ? 0.55 : 0;
    if (lift === "stand") {
      squat(f.rig, f.P, { depth: 0, breath: breath(t) });
      squat(f.ghost, f.P, { depth: 0 });
      NODES.forEach((n, i) => f.fig.setNode(n, t > 0.4 + i * 0.16 ? "on" : "off"));
    } else if (lift === "squat") {
      const { index, phase } = repAt(t, 3.2);
      const fault = index % 3 === 1;
      const v = fault ? valgusCurve(phase, 13) : 0;
      squat(f.rig, f.P, { depth: squatDepth(phase), valgusL: v, valgusR: v * 0.55, breath: breath(t) });
      squat(f.ghost, f.P, { depth: squatDepth(phase) });
      f.fig.setAll("on");
      f.skeleton.flag.clear();
      if (v > 4) { f.fig.setNode("kneeL", "flag"); f.skeleton.flag.add("kneeL").add("hipL").add("ankleL"); f.ripple.at.copy(f.fig.nodePos.get("kneeL")!); }
      f.ripple.strength = v > 6 ? 1 : 0;
      f.traceFrom = overlay ? "b" : null;
    } else if (lift === "curl") {
      const { index, phase } = repAt(t, 2.8);
      const range = index % 3 === 2 ? 0.7 : 1;
      curl(f.rig, f.P, { flex: curlFlex(phase, range), breath: breath(t) });
      curl(f.ghost, f.P, { flex: curlFlex(phase, 1) });
      f.fig.setAll("on");
      if (range < 1 && phase > 0.3 && phase < 0.6) f.fig.setNode("elbowR", "flag");
    } else if (lift === "bench") {
      const { index, phase } = repAt(t, 3.4);
      const slip = index % 2 === 1 ? Math.sin(Math.min(1, phase * 1.4) * Math.PI) : 0;
      bench(f.rig, f.P, { press: benchPress(phase), slip, breath: breath(t) });
      bench(f.ghost, f.P, { press: benchPress(phase) });
      f.fig.setAll("on");
      if (slip > 0.3) f.fig.setNode("wristL", "flag");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: env === "gym" ? "#1b1a17" : "#f2ede4" }}>
      <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} camera={{ fov: cam.fov, near: 0.1, far: 60, position: cam.pos }}>
        {env === "gym" ? <Gym showRack={lift !== "bench"} /> : <Lab platformOn={q.get("platform") === "1"} />}
        {benchObj && <primitive object={benchObj} />}
        <Suspense fallback={null}>
          <Lifter variant={variant} tone={env === "gym" ? "gym" : "lab"} script={script} bar={lift === "curl" ? "curl" : "olympic"} frozenT={frozen} />
        </Suspense>
        <CameraRig pos={cam.pos} target={cam.target} fov={cam.fov} />
      </Canvas>
      <p className="t-mono" style={{ position: "fixed", left: 16, bottom: 12, color: env === "gym" ? "#9a948a" : "#6b665e" }}>
        lab · {lift} · {env} · {q.get("cam") ?? "default"} {frozen !== undefined ? `· t=${frozen}` : ""}
      </p>
    </div>
  );
}
