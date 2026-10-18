import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SensorCallouts, SensorLabels } from "./SensorCallouts";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/**
 * The suit in 3D, from the Blender scene (suit-render/scripts/export_web.py writes public/models/formguard-suit.glb).
 * Two nodes, FG_Suit and FG_Body (the stone mannequin); only the suit is shown. Lit like the studio renders: a soft
 * key from the front left, two rims from behind, a low fill; no glow. Drag to orbit; no zoom, so the wheel scrolls
 * the page.
 */
const MODEL = "/models/formguard-suit.glb";
const TARGET = new THREE.Vector3(0, 0.93, 0);

function Suit() {
  const { scene } = useGLTF(MODEL, "/draco/");
  const body = useMemo(() => scene.getObjectByName("FG_Body"), [scene]);
  useMemo(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
    });
  }, [scene]);
  if (body) body.visible = false;
  return <primitive object={scene} />;
}

/** turn slowly until someone takes hold of it; never for reduced motion */
function Controls() {
  const ref = useRef<OrbitControlsImpl>(null);
  const still = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const stop = () => { c.autoRotate = false; };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  }, []);
  return (
    <OrbitControls ref={ref} target={TARGET} enablePan={false} enableZoom={false} enableDamping dampingFactor={0.08}
      minPolarAngle={Math.PI * 0.18} maxPolarAngle={Math.PI * 0.56}
      autoRotate={!still} autoRotateSpeed={0.9} />
  );
}

/** on a narrow canvas, start further back so the callout labels fit beside the figure */
function Fit() {
  const { camera, size } = useThree();
  useEffect(() => {
    if (size.width < 520) camera.position.sub(TARGET).multiplyScalar(1.15).add(TARGET);
  }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps -- once, at the starting width
  return null;
}

export default function SuitViewer({ sensors, label }: { sensors: boolean; label: string }) {
  const labels = useRef<HTMLDivElement>(null);
  return (
    <div className="relative h-full w-full">
      <Canvas role="img" aria-label={label} dpr={[1, 2]} shadows
        camera={{ fov: 26, position: [1.7, 1.2, 4.0], near: 0.1, far: 30 }}
        gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.15 }}
        style={{ touchAction: "pan-y", cursor: "grab" }}>
        <hemisphereLight args={["#F2EDE4", "#1B1A17", 0.35]} />
        {/* key: soft, front left, high */}
        <directionalLight position={[-2.2, 3.4, 2.6]} intensity={2.6} castShadow
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
          shadow-camera-left={-1.2} shadow-camera-right={1.2} shadow-camera-top={2.2} shadow-camera-bottom={-0.2} />
        {/* rims: behind on both sides, so the black fabric keeps its outline */}
        <directionalLight position={[2.6, 1.6, -2.4]} intensity={2.2} />
        <directionalLight position={[-2.6, 1.6, -2.4]} intensity={1.8} />
        {/* fill: low and in front */}
        <directionalLight position={[0, 0.4, 3]} intensity={0.45} />
        {/* softboxes for reflections only (the metal seam trim and the knit's sheen); never seen as a background */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={1.6} position={[-3, 3, 3]} scale={[3, 3, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={2.2} position={[3, 1.5, -3]} scale={[0.6, 4, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={1.8} position={[-3, 1.5, -3]} scale={[0.6, 4, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={0.3} position={[0, 0.4, 4]} scale={[3, 1.5, 1]} target={[0, 1, 0]} />
        </Environment>
        <Suit />
        {sensors && <SensorCallouts labels={labels} />}
        <Fit />
        <ContactShadows position={[0, 0.002, 0]} scale={2.4} blur={2.4} opacity={0.55} far={1.2} resolution={512} color="#000000" />
        <Controls />
      </Canvas>
      {sensors && <SensorLabels ref={labels} />}
    </div>
  );
}

useGLTF.preload(MODEL, "/draco/");
