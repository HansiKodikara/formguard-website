import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SensorCallouts, SensorLabels } from "./SensorCallouts";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/**
 * The suit in 3D, from the Blender scene (suit-render/scripts/export_web.py writes public/models/formguard-suit.glb).
 * Two nodes, FG_Suit and FG_Body (the stone mannequin); only the suit is shown. Lit like the studio renders: a soft
 * key from the front left, two rims from behind, a low fill; no glow. Drag to orbit (not on touch screens); no zoom, so the wheel scrolls
 * the page.
 */
const MODEL = "/models/formguard-suit.glb";
const TARGET = new THREE.Vector3(0, 0.93, 0);
/** phones and tablets: no dragging (a touch on the suit scrolls the page); it still turns by itself */
export const TOUCH = typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

function Suit({ onReady }: { onReady?: () => void }) {
  const { scene } = useGLTF(MODEL, "/draco/");
  useEffect(() => { onReady?.(); }, [onReady]);
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

/** after a failed load: forget it, so the next try fetches the model again rather than rethrowing the same error */
export const forgetModel = () => useGLTF.clear(MODEL);

/** OrbitControls' own turn speed (autoRotateSpeed 0.9: 0.9 turns a minute), in radians a second */
const SPIN = (2 * Math.PI / 60) * 0.9;

/**
 * Touch screens: the camera turns round the suit by itself and nothing listens to touches, so a swipe on the suit
 * scrolls the page. (OrbitControls, even with rotation off, sets touch-action: none on the canvas and traps it.)
 */
function Spin() {
  const still = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const camera = useThree((st) => st.camera);
  useEffect(() => { camera.lookAt(TARGET); }, [camera]);
  useFrame((_, dt) => {
    if (still) return;
    const off = camera.position.clone().sub(TARGET).applyAxisAngle(THREE.Object3D.DEFAULT_UP, SPIN * Math.min(dt, 0.1));
    camera.position.copy(TARGET).add(off);
    camera.lookAt(TARGET);
  });
  return null;
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

/**
 * GPU memory: touch screens (phones, whose GPU the page shares with the curl frames) draw at 1.5x, not 2x, with a
 * smaller floor shadow. Off screen, nothing is drawn.
 */
const LITE = TOUCH;

/**
 * The effects, each one switchable. On the Pixel 10 (Imagination PowerVR D-Series DXT) the key light's shadow map
 * faults the GPU within seconds: Chrome loses the context and then blocks the page from WebGL ("Web page caused
 * context loss"). Tested one at a time on the phone, the environment's reflections were fine and the shadow map was
 * not, so touch screens leave the shadow map out (the soft floor shadow still grounds him). To try a phone with an
 * effect on or off: ?3d=shadow, ?3d=noenv, ?3d=noaa, ?3d=full (everything) or ?3d=bare (nothing).
 *   env      softbox reflections on the seams and the knit (PMREM)
 *   shadow   the key light's shadow map
 *   contact  the soft floor shadow (drawn once)
 *   aa       MSAA (without it the black suit's outline steps)
 */
type Fx = { env: boolean; shadow: boolean; contact: boolean; aa: boolean };
function effects(): Fx {
  const fx: Fx = TOUCH ? { env: true, shadow: false, contact: true, aa: true } : { env: true, shadow: true, contact: true, aa: true };
  const want = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("3d");
  for (const t of (want ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)) {
    if (t === "full") Object.assign(fx, { env: true, shadow: true, contact: true, aa: true });
    else if (t === "bare") Object.assign(fx, { env: false, shadow: false, contact: false, aa: false });
    else {
      const off = t.startsWith("no"), k = (off ? t.slice(2) : t) as keyof Fx;
      if (k in fx) fx[k] = !off;
    }
  }
  return fx;
}
export const FX = effects();

/** onReady: the model is in and drawing; onLost: the browser took the WebGL context away (a GPU reset) */
export default function SuitViewer({ sensors, label, onReady, onLost }: { sensors: boolean; label: string; onReady?: () => void; onLost?: () => void }) {
  const labels = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className="relative h-full w-full">
      <Canvas role="img" aria-label={label} dpr={LITE ? [1, 1.5] : [1, 2]} shadows={FX.shadow} frameloop={onScreen ? "always" : "never"}
        camera={{ fov: 26, position: [1.7, 1.2, 4.0], near: 0.1, far: 30 }}
        gl={{ antialias: FX.aa, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.15 }}
        style={TOUCH ? { touchAction: "auto" } : { touchAction: "pan-y", cursor: "grab" }}
        onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", () => {
          // the viewer giving its own context back as it unmounts is not a loss: by then the canvas has left the page
          const c = gl.domElement;
          setTimeout(() => { if (c.isConnected) onLost?.(); }, 0);
        })}>
        {/* without the environment's reflections, a little more soft light so the black knit doesn't go flat */}
        <hemisphereLight args={["#F2EDE4", "#1B1A17", FX.env ? 0.35 : 0.6]} />
        {/* key: soft, front left, high */}
        <directionalLight position={[-2.2, 3.4, 2.6]} intensity={2.6} castShadow={FX.shadow}
          shadow-mapSize={LITE ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
          shadow-camera-left={-1.2} shadow-camera-right={1.2} shadow-camera-top={2.2} shadow-camera-bottom={-0.2} />
        {/* rims: behind on both sides, so the black fabric keeps its outline */}
        <directionalLight position={[2.6, 1.6, -2.4]} intensity={2.2} />
        <directionalLight position={[-2.6, 1.6, -2.4]} intensity={1.8} />
        {/* fill: low and in front */}
        <directionalLight position={[0, 0.4, 3]} intensity={0.45} />
        {/* softboxes for reflections only (the metal seam trim and the knit's sheen); never seen as a background */}
        {FX.env && <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={1.6} position={[-3, 3, 3]} scale={[3, 3, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={2.2} position={[3, 1.5, -3]} scale={[0.6, 4, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={1.8} position={[-3, 1.5, -3]} scale={[0.6, 4, 1]} target={[0, 1, 0]} />
          <Lightformer form="rect" intensity={0.3} position={[0, 0.4, 4]} scale={[3, 1.5, 1]} target={[0, 1, 0]} />
        </Environment>}
        <Suit onReady={onReady} />
        {sensors && <SensorCallouts labels={labels} />}
        <Fit />
        {/* drawn once: the suit never moves, only the camera */}
        {FX.contact && <ContactShadows frames={1} position={[0, 0.002, 0]} scale={2.4} blur={2.4} opacity={0.55} far={1.2} resolution={LITE ? 256 : 512} color="#000000" />}
        {TOUCH ? <Spin /> : <Controls />}
      </Canvas>
      {sensors && <SensorLabels ref={labels} />}
    </div>
  );
}

useGLTF.preload(MODEL, "/draco/");
