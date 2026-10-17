/** Environments: the dark gym (one hard overhead light) and the chalk lab (soft, bright, seamless). */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { chalkDust, lamp, lightCone, platform, rack } from "./props";

export const IRON = "#1b1a17";
export const CHALK = "#f2ede4";
export const LAMP_Y = 4.3;
export const SPREAD = 0.42;   // cone radius per metre below the lamp

export function Gym({ dust = true, showRack = true, showLamp = true, beam = 1, rackZ = -2.5, lampZ = 0.15 }: {
  dust?: boolean; showRack?: boolean; showLamp?: boolean; beam?: number; rackZ?: number; lampZ?: number;
}) {
  const { scene, gl } = useThree();
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
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#151412", roughness: 0.94 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    const plat = platform("gym");
    const rk = rack(); rk.position.set(0, 0, rackZ);
    const lp = lamp(LAMP_Y); lp.position.z = lampZ;
    const cone = lightCone(LAMP_Y, SPREAD); cone.position.z = lampZ;
    const d = chalkDust(200, 1.1, 3.9);
    return { spot, rim, rim2, front, fill, floor, plat, rk, lp, cone, d };
  }, [rackZ, lampZ]);

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
      {showLamp && <primitive object={parts.lp} />}
      {beam > 0 && <primitive object={parts.cone} />}
      {dust && <primitive object={parts.d.points} />}
    </>
  );
}

/** The chalk lab: transparent background (the section's Chalk shows through), soft key + fill, a shadow catcher. */
export function Lab({ platformOn = false }: { platformOn?: boolean }) {
  const { gl } = useThree();
  const parts = useMemo(() => {
    const key = new THREE.DirectionalLight("#fffaf2", 2.4);
    key.position.set(-2.2, 5.2, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -2; key.shadow.camera.right = 2; key.shadow.camera.top = 2.6; key.shadow.camera.bottom = -0.6;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.02;
    const fill = new THREE.HemisphereLight("#fffaf0", "#b9b0a0", 1.15);
    const rim = new THREE.DirectionalLight("#ffffff", 1.1);
    rim.position.set(2.5, 3, -3.5);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: "#1b1a17", opacity: 0.16 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    const plat = platform("lab");
    return { key, fill, rim, catcher, plat };
  }, []);
  useEffect(() => {
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.VSMShadowMap;
  }, [gl]);
  return (
    <>
      <primitive object={parts.key} />
      <primitive object={parts.fill} />
      <primitive object={parts.rim} />
      <primitive object={parts.catcher} />
      {platformOn && <primitive object={parts.plat} />}
    </>
  );
}
