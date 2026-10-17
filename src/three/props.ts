/** The gym: bar, plates, platform, rack, bench, lamp, chalk dust, light. Plain three.js, shared by every scene. */
import * as THREE from "three";
import { BENCH } from "./rig";

export const MAT = {
  rubber: () => new THREE.MeshStandardMaterial({ color: "#141311", roughness: 0.88, metalness: 0 }),
  steel: () => new THREE.MeshStandardMaterial({ color: "#b8b4aa", roughness: 0.3, metalness: 1 }),
  knurl: () => new THREE.MeshStandardMaterial({ color: "#8f8b83", roughness: 0.55, metalness: 1 }),
  frame: () => new THREE.MeshStandardMaterial({ color: "#2a2926", roughness: 0.55, metalness: 0.55 }),
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
  return latheX(pts);
}

export type Barbell = { group: THREE.Group; set(a: THREE.Vector3, b: THREE.Vector3): void };

/** Olympic bar (2.2 m) with two bumpers a side, or a short curl bar with small plates. */
export function barbell(kind: "olympic" | "curl" = "olympic"): Barbell {
  const group = new THREE.Group();
  const steel = MAT.steel(), rubber = MAT.rubber(), knurl = MAT.knurl();
  const len = kind === "olympic" ? 2.2 : 1.24;
  const inner = kind === "olympic" ? 0.655 : 0.33;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, inner * 2, 24).rotateZ(Math.PI / 2), knurl);
  group.add(shaft);
  for (const s of [1, -1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len / 2 - inner, 32).rotateZ(Math.PI / 2), steel);
    sleeve.position.x = s * (inner + (len / 2 - inner) / 2);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 32).rotateZ(Math.PI / 2), steel);
    collar.position.x = s * (inner + 0.015);
    group.add(sleeve, collar);
    const plates = kind === "olympic" ? [[0.225, 0.062], [0.225, 0.062]] : [[0.13, 0.03], [0.11, 0.024]];
    let x = inner + 0.03 + 0.004;
    for (const [R, t] of plates) {
      const p = new THREE.Mesh(plateGeometry(R, t), rubber);
      p.position.x = s * (x + t / 2);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.36, R * 0.36, t + 0.004, 40, 1, true).rotateZ(Math.PI / 2), steel);
      hub.position.copy(p.position);
      p.castShadow = p.receiveShadow = true;
      group.add(p, hub);
      x += t + 0.003;
    }
  }
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const _d = new THREE.Vector3(), _X = new THREE.Vector3(1, 0, 0);
  return {
    group,
    set(a, b) {
      group.position.addVectors(a, b).multiplyScalar(0.5);
      group.quaternion.setFromUnitVectors(_X, _d.subVectors(a, b).normalize());
    },
  };
}

/** Olympic platform: oak centre strip (where the lifter stands), rubber sides (where plates land). */
export function platform(tone: "gym" | "lab") {
  const g = new THREE.Group();
  const H = 0.045, S = 2.44, W = 1.22;
  const tex = woodTexture(tone);
  const wood = new THREE.Mesh(new THREE.BoxGeometry(W, H, S), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.68, metalness: 0 }));
  wood.position.y = H / 2;
  const rubberMat = new THREE.MeshStandardMaterial({ color: tone === "gym" ? "#161513" : "#2c2a26", roughness: 0.93 });
  const left = new THREE.Mesh(new THREE.BoxGeometry((S - W) / 2, H, S), rubberMat);
  left.position.set(W / 2 + (S - W) / 4, H / 2, 0);
  const right = left.clone();
  right.position.x *= -1;
  for (const m of [wood, left, right]) { m.receiveShadow = true; g.add(m); }
  g.userData.top = H;
  return g;
}

function woodTexture(tone: "gym" | "lab") {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 1024;
  const x = c.getContext("2d")!;
  const base = tone === "gym" ? [66, 56, 45] : [178, 156, 124];
  const planks = 8;
  for (let i = 0; i < planks; i++) {
    const v = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const k = 0.9 + 0.12 * Math.abs(v);
    x.fillStyle = `rgb(${base.map((b) => Math.round(b * k)).join(",")})`;
    x.fillRect((i * 512) / planks, 0, 512 / planks, 1024);
    // grain: long faint streaks
    for (let s = 0; s < 26; s++) {
      x.strokeStyle = `rgba(0,0,0,${0.035 + 0.04 * Math.random()})`;
      x.lineWidth = 1 + Math.random() * 1.5;
      const px = (i * 512) / planks + Math.random() * (512 / planks);
      x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + 6, 300, px - 6, 700, px + 3, 1024); x.stroke();
    }
    x.fillStyle = "rgba(0,0,0,0.35)";
    x.fillRect((i * 512) / planks, 0, 2, 1024);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Power rack (the logo's own anatomy): uprights, J-hooks, safety arms. */
export function rack() {
  const g = new THREE.Group();
  const m = MAT.frame();
  const up = new THREE.BoxGeometry(0.076, 2.3, 0.076);
  const W = 1.22, D = 1.1;
  for (const x of [-W / 2, W / 2]) for (const z of [0, -D]) {
    const u = new THREE.Mesh(up, m);
    u.position.set(x, 1.15, z);
    g.add(u);
    // holes: a dark column on the inner face
    for (let k = 0; k < 26; k++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.024, 0.024), new THREE.MeshBasicMaterial({ color: "#050505" }));
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

export function benchModel() {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(BENCH.width, 0.07, BENCH.length), new THREE.MeshStandardMaterial({ color: "#1d1c19", roughness: 0.78 }));
  pad.position.set(0, BENCH.top - 0.035, (BENCH.z0 + BENCH.z1) / 2);
  const frameM = MAT.frame();
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
