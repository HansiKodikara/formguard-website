import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SensorCallouts, SensorLabels } from "./SensorCallouts";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/**
 * The suit in 3D, from the Blender scene (suit-render/scripts/export_web.py writes public/models/formguard-suit.glb).
 * Two nodes, FG_Suit and FG_Body (the stone mannequin); only the suit is shown. Lit like the studio renders: a soft
 * key from the front left, two rims from behind, a low fill; no glow. Drag to orbit (on touch screens, swipe sideways); no zoom, so the wheel scrolls
 * the page.
 */
const MODEL = "/models/formguard-suit.glb";
const TARGET = new THREE.Vector3(0, 0.93, 0);
/** phones and tablets: a sideways swipe turns the suit, an up-and-down one scrolls the page (Spin) */
export const TOUCH = typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

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

/** after a failed load: forget it, so the next try fetches the model again rather than rethrowing the same error */
export const forgetModel = () => useGLTF.clear(MODEL);

/** OrbitControls' own turn speed (autoRotateSpeed 0.9: 0.9 turns a minute), in radians a second */
const SPIN = (2 * Math.PI / 60) * 0.9;
/** after someone lets go, how long before it starts turning by itself again, and how long it takes to get up to speed (s) */
const RESUME_AFTER = 2.5, RESUME_RAMP = 1.5;
/** the fastest a swipe can leave the suit coasting, in radians a second */
const MAX_COAST = 5;

/**
 * Touch screens: a sideways swipe turns the suit (round its upright axis only, no tilting), an up-and-down swipe
 * scrolls the page. The canvas is touch-action: pan-y, so the browser keeps vertical pans for scrolling and hands
 * the sideways ones here; OrbitControls can't do this (it sets touch-action: none and traps the page). It turns by
 * itself, stops while someone swipes it, coasts a little when they let go, and a moment later starts turning again.
 */
function Spin() {
  const still = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const camera = useThree((st) => st.camera);
  const el = useThree((st) => st.gl.domElement);
  // idle: seconds since the finger lifted (Infinity until anyone touches it)
  const d = useRef({ id: -1, x: 0, pending: 0, vel: 0, held: false, idle: Infinity });
  useEffect(() => { camera.lookAt(TARGET); }, [camera]);
  useEffect(() => {
    el.style.touchAction = "pan-y";
    const st = d.current;
    const down = (e: PointerEvent) => { if (st.id !== -1) return; st.id = e.pointerId; st.x = e.clientX; st.held = true; st.idle = 0; st.vel = 0; };
    const move = (e: PointerEvent) => { if (e.pointerId !== st.id) return; st.pending += e.clientX - st.x; st.x = e.clientX; };
    // pointercancel: the browser took the gesture for scrolling
    const up = (e: PointerEvent) => { if (e.pointerId === st.id) { st.id = -1; st.held = false; st.idle = 0; } };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
    };
  }, [el]);
  useFrame((_, dt) => {
    const st = d.current, t = Math.min(dt, 0.1);
    let turn = 0;
    if (st.pending) {
      // a swipe across the whole canvas turns it half way round; the suit follows the finger
      turn = -(st.pending / Math.max(1, el.clientWidth)) * Math.PI;
      // let go, it coasts on at half the swipe's speed (capped), so a flick doesn't spin it round
      st.vel = Math.max(-MAX_COAST, Math.min(MAX_COAST, (turn / Math.max(t, 1 / 120)) * 0.5));
      st.pending = 0;
    } else if (st.held) {
      st.vel = 0;                                     // the finger stopped: no coasting when it lifts
    } else if (st.vel) {
      turn = st.vel * t;
      st.vel *= Math.pow(0.002, t);                   // dies away in about half a second
      if (Math.abs(st.vel) < 0.01) st.vel = 0;
    } else if (!still) {
      // turning by itself: from the start, or again a moment after someone lets go, easing up to speed
      st.idle += t;
      const ease = st.idle === Infinity ? 1 : Math.min(1, Math.max(0, (st.idle - RESUME_AFTER) / RESUME_RAMP));
      turn = SPIN * t * ease * ease * (3 - 2 * ease);
    }
    if (!turn) return;
    const off = camera.position.clone().sub(TARGET).applyAxisAngle(THREE.Object3D.DEFAULT_UP, turn);
    camera.position.copy(TARGET).add(off);
    camera.lookAt(TARGET);
  });
  return null;
}

/** turn slowly; stop while someone holds it, and start again a moment after they let go; never for reduced motion */
function Controls() {
  const ref = useRef<OrbitControlsImpl>(null);
  const still = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  // idle: seconds since they let go (Infinity until anyone takes hold); -1 while held
  const idle = useRef(Infinity);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const start = () => { idle.current = -1; };
    const end = () => { idle.current = 0; };
    c.addEventListener("start", start);
    c.addEventListener("end", end);
    return () => { c.removeEventListener("start", start); c.removeEventListener("end", end); };
  }, []);
  useFrame((_, dt) => {
    const c = ref.current;
    if (!c || still) return;
    if (idle.current >= 0) idle.current += Math.min(dt, 0.1);
    const e = idle.current < 0 ? 0 : idle.current === Infinity ? 1 : Math.min(1, Math.max(0, (idle.current - RESUME_AFTER) / RESUME_RAMP));
    c.autoRotate = e > 0;
    c.autoRotateSpeed = 0.9 * e * e * (3 - 2 * e);
  });
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
 * Touch screens leave out the key light's shadow map: on the Pixel 10 (Imagination PowerVR D-Series DXT) it faults the
 * GPU within seconds, Chrome loses the context and then blocks the page from WebGL. Tested one effect at a time on
 * the phone, the environment's reflections were fine and the shadow map was not. The soft floor shadow still grounds
 * him.
 */
const SHADOW_MAP = !TOUCH;

/** onLost: the browser took the WebGL context away (a GPU reset) */
export default function SuitViewer({ sensors, label, onLost }: { sensors: boolean; label: string; onLost?: () => void }) {
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
      <Canvas role="img" aria-label={label} dpr={LITE ? [1, 1.5] : [1, 2]} shadows={SHADOW_MAP} frameloop={onScreen ? "always" : "never"}
        camera={{ fov: 26, position: [1.7, 1.2, 4.0], near: 0.1, far: 30 }}
        gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.15 }}
        style={{ touchAction: "pan-y", cursor: TOUCH ? undefined : "grab" }}
        onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", () => {
          // the viewer giving its own context back as it unmounts is not a loss: by then the canvas has left the page
          const c = gl.domElement;
          setTimeout(() => { if (c.isConnected) onLost?.(); }, 0);
        })}>
        <hemisphereLight args={["#F2EDE4", "#1B1A17", 0.35]} />
        {/* key: soft, front left, high */}
        <directionalLight position={[-2.2, 3.4, 2.6]} intensity={2.6} castShadow={SHADOW_MAP}
          shadow-mapSize={LITE ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
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
        {/* drawn once: the suit never moves, only the camera */}
        <ContactShadows frames={1} position={[0, 0.002, 0]} scale={2.4} blur={2.4} opacity={0.55} far={1.2} resolution={LITE ? 256 : 512} color="#000000" />
        {TOUCH ? <Spin /> : <Controls />}
      </Canvas>
      {sensors && <SensorLabels ref={labels} />}
    </div>
  );
}

useGLTF.preload(MODEL, "/draco/");
