/**
 * The gym: bar, plates, platform, rack, bench, lamp, chalk dust, light. Plain three.js, shared by every
 * scene. Surfaces use real, scanned CC0 texture sets (ambientCG), mapped at their true physical size.
 */
import * as THREE from "three";
import { BENCH } from "./rig";
import { pbr, tiled, type GymTextures } from "./textures";

/** UVs in metres (÷ tile): a box face takes the two axes it spans, so textures never stretch. */
function boxUVs(g: THREE.BufferGeometry, tile: number) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const [u, v] = ax > 0.5 ? [p.getZ(i), p.getY(i)] : ay > 0.5 ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
  return g;
}
/** Lathe/cylinder UVs (u around, v along) scaled to metres. */
function roundUVs(g: THREE.BufferGeometry, around: number, along: number, tile: number) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * around) / tile, (uv.getY(i) * along) / tile);
  uv.needsUpdate = true;
  return g;
}

export const MAT = {
  /** bumper plates: matte black rubber (ambientCG Rubber004) */
  rubber: (g: GymTextures) => pbr(g.plate, { color: "#4a4744", normalStrength: 0.5 }),
  /** sleeves and collars: brushed steel (Metal009) */
  steel: (g: GymTextures) => pbr(g.steel, { color: "#e9e6df", roughness: 0.62, normalStrength: 0.4 }),
  /** the shaft: the same steel, knurled */
  knurl: (g: GymTextures) => {
    const m = pbr(g.steel, { color: "#b9b5ad", roughness: 1.15 });
    m.normalMap = g.knurl;
    m.normalScale.set(0.9, 0.9);
    return m;
  },
  /** rack and bench frames: powder-coated steel, a thin clear coat over the paint */
  frame: (light = false) => new THREE.MeshPhysicalMaterial({
    color: light ? "#8f8a82" : "#2a2926", roughness: 0.5, metalness: 0.15, clearcoat: 0.35, clearcoatRoughness: 0.45,
  }),
};

/** Lathe a profile (x = radius, y = axial) and turn its axis onto X. */
function latheX(points: [number, number][], seg = 64) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** A bumper plate: rubber disc with rounded edges, steel hub. Axis along X, centred on 0. */
function plateGeometry(R = 0.225, t = 0.062) {
  const e = 0.012;
  const pts: [number, number][] = [[0.026, -t / 2], [R - e, -t / 2]];
  for (let i = 1; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push([R - e + e * Math.cos(a), -t / 2 + e + e * Math.sin(a)]); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push([R - e + e * Math.cos(a), t / 2 - e + e * Math.sin(a)]); }
  pts.push([0.026, t / 2]);
  return roundUVs(latheX(pts), 2 * Math.PI * R, 2 * R + t, 0.3);
}

/** `dt` (seconds) lets the loaded ends lag and settle as the bar changes direction; omit it for a still. */
export type Barbell = { group: THREE.Group; set(a: THREE.Vector3, b: THREE.Vector3, dt?: number): void };

/** Olympic bar (2.2 m) with two bumpers a side, or a short curl bar with small plates. */
export function barbell(gym: GymTextures, kind: "olympic" | "curl" = "olympic"): Barbell {
  const group = new THREE.Group();
  const steel = MAT.steel(gym), rubber = MAT.rubber(gym), knurl = MAT.knurl(gym);
  const len = kind === "olympic" ? 2.2 : 1.24;
  const inner = kind === "olympic" ? 0.655 : 0.33;
  const shaftGeo = roundUVs(new THREE.CylinderGeometry(0.0145, 0.0145, inner * 2, 24), 2 * Math.PI * 0.0145, inner * 2, 0.012);
  const shaft = new THREE.Mesh(shaftGeo.rotateZ(Math.PI / 2), knurl);
  group.add(shaft);
  // each loaded end hangs off the shaft at the collar, so it can flex (see set)
  const ends: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const end = new THREE.Group();
    end.position.x = s * inner;
    group.add(end);
    ends.push(end);
    const sleeveLen = len / 2 - inner;
    const sleeve = new THREE.Mesh(roundUVs(new THREE.CylinderGeometry(0.025, 0.025, sleeveLen, 32), 2 * Math.PI * 0.025, sleeveLen, 0.4).rotateZ(Math.PI / 2), steel);
    sleeve.position.x = s * (sleeveLen / 2);
    const collar = new THREE.Mesh(roundUVs(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 32), 2 * Math.PI * 0.036, 0.03, 0.4).rotateZ(Math.PI / 2), steel);
    collar.position.x = s * 0.015;
    end.add(sleeve, collar);
    const plates = kind === "olympic" ? [[0.225, 0.062], [0.225, 0.062]] : [[0.13, 0.03], [0.11, 0.024]];
    let x = inner + 0.03 + 0.004;
    for (const [R, t] of plates) {
      const p = new THREE.Mesh(plateGeometry(R, t), rubber);
      p.position.x = s * (x - inner + t / 2);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.36, R * 0.36, t + 0.004, 40, 1, true).rotateZ(Math.PI / 2), steel);
      hub.position.copy(p.position);
      end.add(p, hub);
      x += t + 0.003;
    }
  }
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const _d = new THREE.Vector3(), _X = new THREE.Vector3(1, 0, 0);
  // whip: the loaded ends are a damped spring (~2.6 Hz) driven by the bar's vertical acceleration, so the
  // plates dip as the bar is driven up out of the bottom and settle after lockout. Only an Olympic bar flexes.
  const whip = { y: NaN, v: 0, ang: 0, w: 0 };
  const K = (2 * Math.PI * 2.6) ** 2, C = 2 * 0.22 * Math.sqrt(K), GAIN = kind === "olympic" ? 3.2 : 0;
  return {
    group,
    set(a, b, dt) {
      group.position.addVectors(a, b).multiplyScalar(0.5);
      group.quaternion.setFromUnitVectors(_X, _d.subVectors(a, b).normalize());
      if (dt && dt < 0.2 && GAIN) {
        const y = group.position.y;
        const v = Number.isNaN(whip.y) ? 0 : (y - whip.y) / dt;
        const acc = (v - whip.v) / dt;
        whip.y = y; whip.v += (v - whip.v) * Math.min(1, dt * 30);
        whip.w += (-K * whip.ang - C * whip.w + Math.max(-12, Math.min(12, acc)) * GAIN) * dt;
        whip.ang = Math.max(-0.035, Math.min(0.035, whip.ang + whip.w * dt));
      }
      ends[0].rotation.z = -whip.ang;
      ends[1].rotation.z = whip.ang;
    },
  };
}

/** The platform's top surface: the floor the lifter stands on. */
export const PLATFORM_TOP = 0.045;

/** Olympic platform: oak centre (where the lifter stands), rubber sides (where plates land). */
export function platform(gym: GymTextures, tone: "gym" | "lab") {
  const g = new THREE.Group();
  const H = PLATFORM_TOP, S = 2.44, W = 1.22;
  const wood = new THREE.Mesh(boxUVs(new THREE.BoxGeometry(W, H, S), 1.6),
    pbr(tiled(gym.wood, 1, 1, Math.PI / 2), { color: tone === "gym" ? "#6f6253" : "#fff6ea", roughness: 1.15, normalStrength: 0.6 }));
  wood.position.y = H / 2;
  const rubberMat = pbr(gym.rubber, { color: tone === "gym" ? "#8a8683" : "#ffffff", normalStrength: 0.7 });
  const side = boxUVs(new THREE.BoxGeometry((S - W) / 2, H, S), 0.7);
  const left = new THREE.Mesh(side, rubberMat);
  left.position.set(W / 2 + (S - W) / 4, H / 2, 0);
  const right = left.clone();
  right.position.x *= -1;
  for (const m of [wood, left, right]) { m.receiveShadow = true; g.add(m); }
  g.userData.top = H;
  return g;
}

/** Power rack (the logo's own anatomy): uprights, J-hooks, safety arms. */
export function rack(light = false) {
  const g = new THREE.Group();
  const m = MAT.frame(light);
  const up = new THREE.BoxGeometry(0.076, 2.3, 0.076);
  const W = 1.22, D = 1.1;
  const holeMat = new THREE.MeshBasicMaterial({ color: light ? "#4a4741" : "#050505" });
  for (const x of [-W / 2, W / 2]) for (const z of [0, -D]) {
    const u = new THREE.Mesh(up, m);
    u.position.set(x, 1.15, z);
    g.add(u);
    // holes: a dark column on the inner face
    for (let k = 0; k < 26; k++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.024, 0.024), holeMat);
      h.position.set(x - Math.sign(x) * 0.039, 0.42 + k * 0.064, z);
      g.add(h);
    }
  }
  for (const z of [0, -D]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.076, 0.076, 0.076), m);
    top.position.set(0, 2.3, z); g.add(top);
  }
  for (const x of [-W / 2, W / 2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.076, D), m);
    side.position.set(x, 2.3, -D / 2); g.add(side);
    const base = side.clone(); base.position.y = 0.04; g.add(base);
    // safety arm: the guard, set just below the bottom of the squat
    const safety = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, D + 0.36), m);
    safety.position.set(x - Math.sign(x) * 0.07, 0.86, -D / 2 + 0.18); g.add(safety);
    // J-hook
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.14), m);
    hook.position.set(x - Math.sign(x) * 0.07, 1.42, 0.08); g.add(hook);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.03), m);
    lip.position.set(x - Math.sign(x) * 0.07, 1.46, 0.145); g.add(lip);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Flat bench: a leather pad (ambientCG Leather026) on a powder-coated frame. */
export function benchModel(gym: GymTextures, light = false) {
  const g = new THREE.Group();
  const padGeo = boxUVs(new THREE.BoxGeometry(BENCH.width, 0.07, BENCH.length), 0.5);
  const pad = new THREE.Mesh(padGeo, pbr(gym.leather, { color: "#ffffff", roughness: 1.3, normalStrength: 0.8 }));
  pad.position.set(0, BENCH.top - 0.035, (BENCH.z0 + BENCH.z1) / 2);
  const frameM = MAT.frame(light);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, BENCH.length - 0.1), frameM);
  beam.position.set(0, BENCH.top - 0.11, pad.position.z);
  g.add(pad, beam);
  for (const z of [BENCH.z0 + 0.12, BENCH.z1 - 0.12]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, BENCH.top - 0.13, 0.06), frameM);
    leg.position.set(0, (BENCH.top - 0.13) / 2, z);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.07), frameM);
    foot.position.set(0, 0.02, z);
    g.add(leg, foot);
  }
  // uprights with J-hooks at the head end
  for (const x of [-0.56, 0.56]) {
    const u = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.12, 0.06), frameM);
    u.position.set(x, 0.56, BENCH.z0 - 0.1);
    g.add(u);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Industrial pendant: dark shade, a bright bulb. */
export function lamp(y: number) {
  const g = new THREE.Group();
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.26, 48, 1, true), new THREE.MeshStandardMaterial({ color: "#1b1a18", roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }));
  shade.position.y = y + 0.13;
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.16, 40), new THREE.MeshBasicMaterial({ color: "#fff8ec" }));
  bulb.rotation.x = Math.PI / 2;
  bulb.position.y = y + 0.02;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3), new THREE.MeshBasicMaterial({ color: "#0c0c0b" }));
  cord.position.y = y + 1.75;
  g.add(shade, bulb, cord);
  return g;
}

/** Chalk dust: motes that only show inside the light cone, drifting slowly. */
export function chalkDust(count = 380, radius = 1.6, top = 3.8) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 0.15 + Math.random() * top;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLight: { value: new THREE.Vector3(0, 4.3, 0) }, uSpread: { value: 0.62 }, uOpacity: { value: 1 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime; uniform vec3 uLight; uniform float uSpread; uniform float uScale;
      varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * (0.012 + seed * 0.02);
        p.y = mod(p.y - 0.15 + t * 6.0, 3.8) + 0.15;
        p.x += sin(uTime * 0.17 + seed * 40.0) * 0.06;
        p.z += cos(uTime * 0.13 + seed * 23.0) * 0.06;
        // inside the cone? radial distance vs the cone radius at this height
        float h = max(0.01, uLight.y - p.y);
        float rCone = h * uSpread;
        float rd = length(p.xz - uLight.xz);
        float inCone = 1.0 - smoothstep(rCone * 0.25, rCone * 0.75, rd);
        vA = inCone * (0.35 + 0.65 * fract(seed * 7.13)) * smoothstep(0.1, 0.6, p.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * (1.0 + seed * 1.8) * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * uOpacity;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.92), a * 0.5);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { points: pts, material: mat };
}

/** A faint beam: brighter where you look through more of it, fading toward the lamp. */
export function lightCone(y: number, spread: number) {
  const h = y;
  const g = new THREE.CylinderGeometry(0.15, h * spread, h, 64, 1, true);
  g.translate(0, h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.05 }, uH: { value: h } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY; uniform float uH;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); vY = position.y / uH; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() { float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float a = f * uOpacity * smoothstep(0.0, 0.35, vY) * (1.0 - smoothstep(0.85, 1.0, vY)); gl_FragColor = vec4(1.0, 0.96, 0.9, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(g, mat);
}
