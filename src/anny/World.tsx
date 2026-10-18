/** Environments: the dark gym (one hard overhead light) and daylight (a bright studio, image-based light). */
import { use, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { barbell, benchModel, chalkDust, lamp, lightCone, platform, rack } from "./props";
import { gymTextures, studioEnv } from "./textures";

export const IRON = "#1b1a17";
export const CHALK = "#f2ede4";
export const LAMP_Y = 4.3;
export const SPREAD = 0.42;   // cone radius per metre below the lamp

export function Gym({ dust = true, showRack = true, showLamp = true, beam = 1, rackZ = -2.5, rackX = 0, lampZ = 0.15, rackedBar = false }: {
  dust?: boolean; showRack?: boolean; showLamp?: boolean; beam?: number; rackZ?: number; rackX?: number; lampZ?: number;
  /** the bar resting on the rack's J-hooks: the logo's idea, the bar held in place */
  rackedBar?: boolean;
}) {
  const { scene, gl } = useThree();
  const gym = use(gymTextures());
  const parts = useMemo(() => {
    const spot = new THREE.SpotLight("#fff6ea", 165, 0, Math.atan(SPREAD), 0.6, 2);
    spot.position.set(0, LAMP_Y, lampZ);
    spot.target.position.set(0, 0, 0.05);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.03;
    spot.shadow.radius = 9;
    spot.shadow.blurSamples = 16;
    spot.shadow.camera.near = 1.2;
    spot.shadow.camera.far = 6;
    // cool rims against the warm key: they cut the silhouette out of the dark
    const rim = new THREE.DirectionalLight("#dce6f2", 4.4);
    rim.position.set(-1.8, 3.4, -4.2);
    const rim2 = new THREE.DirectionalLight("#e6edf5", 3.2);
    rim2.position.set(2.4, 2.4, -3.6);
    // a soft key from the camera side so the face and front of the body read
    const front = new THREE.DirectionalLight("#eeebe5", 0.8);
    front.position.set(1.2, 2.4, 4.2);
    const fill = new THREE.HemisphereLight("#33322f", "#0c0b0a", 0.22);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#0e0d0c", roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const plat = platform(gym, "gym");
    const rk = rack(); rk.position.set(rackX, 0, rackZ);
    const racked = barbell(gym, "olympic");
    racked.set(new THREE.Vector3(rackX + 1.1, 1.47, rackZ + 0.08), new THREE.Vector3(rackX - 1.1, 1.47, rackZ + 0.08));
    const lp = lamp(LAMP_Y); lp.position.z = lampZ;
    const cone = lightCone(LAMP_Y, SPREAD); cone.position.z = lampZ;
    const d = chalkDust(200, 1.1, 3.9);
    return { spot, rim, rim2, front, fill, floor, plat, rk, racked, lp, cone, d };
  }, [gym, rackZ, rackX, lampZ]);

  useEffect(() => {
    scene.fog = new THREE.Fog(IRON, 3.6, 9.2);
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1.15;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.VSMShadowMap;
    return () => { scene.fog = null; };
  }, [scene, gl]);

  useFrame((_, dt) => {
    parts.d.material.uniforms.uTime.value += dt;
    (parts.cone.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.045 * beam;
  });

  return (
    <>
      <primitive object={parts.spot} />
      <primitive object={parts.spot.target} />
      <primitive object={parts.rim} />
      <primitive object={parts.rim2} />
      <primitive object={parts.front} />
      <primitive object={parts.fill} />
      <primitive object={parts.floor} />
      <primitive object={parts.plat} />
      {showRack && <primitive object={parts.rk} />}
      {showRack && rackedBar && <primitive object={parts.racked.group} />}
      {showLamp && <primitive object={parts.lp} />}
      {beam > 0 && <primitive object={parts.cone} />}
      {dust && <primitive object={parts.d.points} />}
    </>
  );
}

/**
 * Daylight: a bright photo studio. The canvas is transparent, so the page's own Chalk is the wall and the
 * floor — no seams at the edges. Light comes from a real studio HDRI (Poly Haven, CC0): big windows, soft
 * and even, with true reflections on the steel; a warm key from the window side casts the soft shadows.
 */
export function Daylight({ platformOn = true, showRack = false, rackedBar = false, rackX = 0, rackZ = -2.1, sun = [-3.2, 5.6, 3.6], envIntensity = 0.85, envRotation = 2.2 }: {
  platformOn?: boolean; showRack?: boolean; rackedBar?: boolean; rackX?: number; rackZ?: number; sun?: [number, number, number];
  envIntensity?: number; envRotation?: number;
}) {
  const { gl, scene } = useThree();
  const gym = use(gymTextures());
  const env = use(studioEnv());
  const parts = useMemo(() => {
    const key = new THREE.DirectionalLight("#fff1de", 2.2);
    key.position.set(...sun);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3.2, bottom: -1.2, near: 0.5, far: 16 });
    key.shadow.radius = 10;
    key.shadow.blurSamples = 20;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.025;
    const sky = new THREE.HemisphereLight("#f3f6fa", "#d9cfbf", 0.35);
    // two rims from behind pick the dark suit out of the bright room with a bright edge, and backlight
    // the ears and fingers so the light shows through them (skinMaterial)
    const rim = new THREE.DirectionalLight("#fff4e6", 2.6);
    rim.position.set(2.8, 3.0, -3.8);
    const rim2 = new THREE.DirectionalLight("#e9f0f7", 1.5);
    rim2.position.set(-3.4, 2.2, -3.0);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: "#3a3127", opacity: 0.2 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    const plat = platform(gym, "lab");
    const rk = rack(true); rk.position.set(rackX, 0, rackZ);
    const racked = barbell(gym, "olympic");
    racked.set(new THREE.Vector3(rackX + 1.1, 1.47, rackZ + 0.08), new THREE.Vector3(rackX - 1.1, 1.47, rackZ + 0.08));
    return { key, sky, rim, rim2, catcher, plat, rk, racked };
  }, [gym, rackX, rackZ, sun]);
  useEffect(() => {
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.VSMShadowMap;
  }, [gl]);
  useEffect(() => {
    scene.environment = env;
    scene.environmentIntensity = envIntensity;
    scene.environmentRotation.set(0, envRotation, 0);
    return () => { scene.environment = null; };
  }, [scene, env, envIntensity, envRotation]);
  return (
    <>
      <primitive object={parts.key} />
      <primitive object={parts.sky} />
      <primitive object={parts.rim} />
      <primitive object={parts.rim2} />
      <primitive object={parts.catcher} />
      {platformOn && <primitive object={parts.plat} />}
      {showRack && <primitive object={parts.rk} />}
      {showRack && rackedBar && <primitive object={parts.racked.group} />}
    </>
  );
}

/** A flat bench with its leather pad, for the bench press scenes. */
export function Bench({ light = true }: { light?: boolean }) {
  const gym = use(gymTextures());
  const obj = useMemo(() => benchModel(gym, light), [gym, light]);
  return <primitive object={obj} />;
}

/** Kept for the lab page: the same daylight, no platform by default. */
export function Lab({ platformOn = false }: { platformOn?: boolean }) {
  return <Daylight platformOn={platformOn} />;
}
