/**
 * The lifter's body: an Anny human (NAVER LABS Europe, Apache-2.0; MakeHuman assets, CC0), exported
 * offline by scripts/figure/export_body.py and skinned here. The IK rig (rig.ts) decides what the lift
 * does; this file aims each Anny bone along the rig so the real body follows exactly.
 */
import * as THREE from "three";
import type { Rig } from "./rig";

// ── data ──────────────────────────────────────────────────────────────────────────────

type V3 = [number, number, number];
export type BodyMeasure = {
  height: number; thigh: number; shin: number; upperArm: number; forearm: number; hand: number; footLen: number; ankleH: number;
  pelvis: V3; hipL: V3; shoulderL: V3; neck: V3; head: V3; chest: V3; lumbar: V3; shoulderUp: number;
};
type VariantData = { bboxMin: V3; bboxMax: V3; bind: number[]; measure: BodyMeasure; pods: Record<string, number> };
type Meta = { vertexCount: number; triangleCount: number; bones: string[]; parents: number[]; variants: Record<string, VariantData> };
export type Variant = "lifter" | "long" | "short";

const base = "/models/";
let metaP: Promise<Meta> | null = null;
let topoP: Promise<ArrayBuffer> | null = null;
let attrP: Promise<ArrayBuffer> | null = null;
const shapeP = new Map<Variant, Promise<ArrayBuffer>>();

export type BodyData = { meta: Meta; topo: ArrayBuffer; attrs: ArrayBuffer; shape: ArrayBuffer; variant: Variant };

/** Fetches (once) the shared topology and the variant's shape. */
export function loadBody(variant: Variant): Promise<BodyData> {
  metaP ??= fetch(base + "body.json").then((r) => r.json());
  topoP ??= fetch(base + "body-topology.bin").then((r) => r.arrayBuffer());
  attrP ??= fetch(base + "body-attrs.bin").then((r) => r.arrayBuffer());
  if (!shapeP.has(variant)) shapeP.set(variant, fetch(base + `body-${variant}.bin`).then((r) => r.arrayBuffer()));
  return Promise.all([metaP, topoP, attrP, shapeP.get(variant)!]).then(([meta, topo, attrs, shape]) => ({ meta, topo, attrs, shape, variant }));
}

/** A stable promise per variant, for React's use(). */
const resources = new Map<Variant, Promise<BodyData>>();
export function bodyResource(variant: Variant) {
  if (!resources.has(variant)) resources.set(variant, loadBody(variant));
  return resources.get(variant)!;
}

/** Builds a shared geometry (positions, normals, indices, skin) for a variant. Cached. */
const geoCache = new Map<Variant, THREE.BufferGeometry>();
function geometry(d: BodyData) {
  const hit = geoCache.get(d.variant);
  if (hit) return hit;
  const { meta, topo, shape } = d;
  const v = meta.variants[d.variant];
  const n = meta.vertexCount, t = meta.triangleCount;
  const idx = new Uint16Array(topo, 0, t * 3);
  const skinI = new Uint8Array(topo, t * 6, n * 4);
  const skinW = new Uint8Array(topo, t * 6 + n * 4, n * 4);
  const q = new Int16Array(shape);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    const a = i % 3;
    pos[i] = v.bboxMin[a] + ((q[i] + 32767) / 65534) * (v.bboxMax[a] - v.bboxMin[a]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  // garment structure (see export_body.py · write_attrs): region per vertex, seam fields
  const region = new Uint8Array(d.attrs, 0, n);
  const sx = new Int8Array(d.attrs, n, n), sy = new Int8Array(d.attrs, n * 2, n);
  const seam = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { seam[i * 2] = sx[i] / 127; seam[i * 2 + 1] = sy[i] / 100; }
  g.setAttribute("aSeam", new THREE.BufferAttribute(seam, 2));
  // triangles grouped by region (majority vote) so suit, skin and shoes get crisp boundaries
  const byRegion: number[][] = [[], [], []];
  for (let f = 0; f < t; f++) {
    const a = region[idx[f * 3]], b = region[idx[f * 3 + 1]], c = region[idx[f * 3 + 2]];
    const r = a === b || a === c ? a : b === c ? b : Math.min(a, b, c);
    byRegion[r].push(idx[f * 3], idx[f * 3 + 1], idx[f * 3 + 2]);
  }
  const sorted = new Uint16Array(t * 3);
  let o = 0;
  byRegion.forEach((list, r) => { sorted.set(list, o); g.addGroup(o, list.length, r); o += list.length; });
  g.setIndex(new THREE.BufferAttribute(sorted, 1));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(Uint16Array.from(skinI), 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(new Float32Array(skinW).map((w) => w / 255), 4));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  geoCache.set(d.variant, g);
  return g;
}

// ── retargeting ───────────────────────────────────────────────────────────────────────

/** Bones we aim along the rig: bone, its aim target bone (rest), the rig joint to aim at, up reference. */
type Aim = { bone: string; toward: string; rigFrom?: keyof Rig["j"]; rigTo: keyof Rig["j"]; up: "kneeL" | "kneeR" | "elbowL" | "elbowR" | "Y" | "handL" | "handR"; restUp: V3 };
const AIMS: Aim[] = [];
for (const s of ["L", "R"] as const) {
  AIMS.push(
    { bone: `upperleg01.${s}`, toward: `lowerleg01.${s}`, rigTo: `knee${s}`, up: `knee${s}`, restUp: [0, 0, 1] },
    { bone: `lowerleg01.${s}`, toward: `foot.${s}`, rigTo: `ankle${s}`, up: `knee${s}`, restUp: [0, 0, 1] },
    { bone: `foot.${s}`, toward: `toe3-1.${s}`, rigTo: `toe${s}`, up: "Y", restUp: [0, 1, 0] },
    { bone: `upperarm01.${s}`, toward: `lowerarm01.${s}`, rigTo: `elbow${s}`, up: `elbow${s}`, restUp: [0, 0, -1] },
    { bone: `lowerarm01.${s}`, toward: `wrist.${s}`, rigTo: `wrist${s}`, up: `elbow${s}`, restUp: [0, 0, -1] },
    { bone: `wrist.${s}`, toward: `finger3-1.${s}`, rigTo: `hand${s}`, up: `hand${s}`, restUp: [s === "L" ? 1 : -1, 0, 0] },
  );
}
const FINGERS = ["finger2", "finger3", "finger4", "finger5"];

const _m = new THREE.Matrix4(), _a = new THREE.Vector3(), _u = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _p = new THREE.Vector3();
const _bR = new THREE.Matrix4(), _bD = new THREE.Matrix4();

/** Rotation taking the rest (aim, up) frame onto the desired (aim, up) frame. */
function frameRotation(aimR: THREE.Vector3, upR: THREE.Vector3, aimD: THREE.Vector3, upD: THREE.Vector3, out: THREE.Quaternion) {
  const basis = (a: THREE.Vector3, u: THREE.Vector3, m: THREE.Matrix4) => {
    _a.copy(a).normalize();
    _u.copy(u).addScaledVector(_a, -u.dot(_a));
    if (_u.lengthSq() < 1e-8) _u.set(0, 0, 1).addScaledVector(_a, -_a.z);
    _u.normalize();
    _c.crossVectors(_a, _u);
    m.makeBasis(_a, _u, _c);
  };
  basis(aimR, upR, _bR);
  basis(aimD, upD, _bD);
  _m.copy(_bD).multiply(_bR.transpose());
  return out.setFromRotationMatrix(_m);
}

export type NodeState = "off" | "on" | "flag" | "good" | "dim";
export const NODES = [
  "shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR", "tspine", "lspine",
  "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR",
] as const;
export type NodeName = (typeof NODES)[number];

const NODE_COLOR: Record<NodeState, THREE.Color> = {
  off: new THREE.Color("#2b2925"), dim: new THREE.Color("#5a554c"), on: new THREE.Color("#f2ede4"),
  flag: new THREE.Color("#e2372c"), good: new THREE.Color("#4fc193"),
};

let _halo: THREE.Texture | null = null;
function haloTexture() {
  if (_halo) return _halo;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.16, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.42, "rgba(255,255,255,0.1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _halo = new THREE.CanvasTexture(c);
  _halo.colorSpace = THREE.SRGBColorSpace;
  return _halo;
}

export class Body {
  readonly group = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly measure: BodyMeasure;
  private bones: THREE.Bone[] = [];
  private byName = new Map<string, number>();
  private parents: number[];
  private restWorldQ: THREE.Quaternion[] = [];
  private restWorldP: THREE.Vector3[] = [];
  private restLocalQ: THREE.Quaternion[] = [];
  private restLocalP: THREE.Vector3[] = [];
  private worldQ: THREE.Quaternion[] = [];
  private worldP: THREE.Vector3[] = [];
  private aims: { i: number; aimRest: THREE.Vector3; upRest: THREE.Vector3; a: Aim }[] = [];
  private podVertex = new Map<NodeName, number>();
  readonly pods = new Map<NodeName, { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; halo: THREE.Sprite; state: NodeState; glow: number }>();
  readonly nodePos = new Map<NodeName, THREE.Vector3>();
  /** finger curl for a closed grip, degrees */
  grip = 72;

  constructor(d: BodyData, material: THREE.Material | THREE.Material[], opts: { pods?: boolean; castShadow?: boolean } = {}) {
    const { meta } = d;
    const v = meta.variants[d.variant];
    this.measure = v.measure;
    this.parents = meta.parents;
    const bind = v.bind;
    const world: THREE.Matrix4[] = meta.bones.map((_, i) => new THREE.Matrix4().fromArray(bind, i * 16));
    meta.bones.forEach((name, i) => {
      const b = new THREE.Bone();
      b.name = name;
      this.bones.push(b);
      this.byName.set(name, i);
      const wq = new THREE.Quaternion(), wp = new THREE.Vector3(), s = new THREE.Vector3();
      world[i].decompose(wp, wq, s);
      this.restWorldQ.push(wq);
      this.restWorldP.push(wp);
      this.worldQ.push(wq.clone());
      this.worldP.push(wp.clone());
    });
    meta.bones.forEach((_, i) => {
      const p = this.parents[i];
      const local = p < 0 ? world[i].clone() : new THREE.Matrix4().copy(world[p]).invert().multiply(world[i]);
      const lp = new THREE.Vector3(), lq = new THREE.Quaternion(), ls = new THREE.Vector3();
      local.decompose(lp, lq, ls);
      this.restLocalQ.push(lq);
      this.restLocalP.push(lp);
      this.bones[i].position.copy(lp);
      this.bones[i].quaternion.copy(lq);
      if (p >= 0) this.bones[p].add(this.bones[i]);
    });
    for (const a of AIMS) {
      const i = this.byName.get(a.bone)!, t = this.byName.get(a.toward)!;
      this.aims.push({ i, a, aimRest: this.restWorldP[t].clone().sub(this.restWorldP[i]).normalize(), upRest: new THREE.Vector3(...a.restUp) });
    }
    const skeleton = new THREE.Skeleton(this.bones, world.map((m) => m.clone().invert()));
    this.mesh = new THREE.SkinnedMesh(geometry(d), material);
    this.mesh.add(this.bones[0]);
    this.mesh.bind(skeleton, new THREE.Matrix4());
    this.mesh.castShadow = opts.castShadow ?? true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    if (opts.pods !== false) {
      const podGeo = new THREE.CapsuleGeometry(0.011, 0.024, 6, 14);
      for (const n of NODES) {
        const mat = new THREE.MeshStandardMaterial({ color: "#1c1b18", emissive: NODE_COLOR.off.clone(), emissiveIntensity: 1, roughness: 0.35 });
        const mesh = new THREE.Mesh(podGeo, mat);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: "#f2ede4", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        halo.scale.setScalar(0.18);
        this.group.add(mesh, halo);
        this.pods.set(n, { mesh, mat, halo, state: "off", glow: 0 });
        this.nodePos.set(n, new THREE.Vector3());
        this.podVertex.set(n, v.pods[n]);
      }
    }
  }

  setNode(n: NodeName, state: NodeState) { const p = this.pods.get(n); if (p) p.state = state; }
  setAll(state: NodeState) { for (const n of NODES) this.setNode(n, state); }

  private idx(name: string) { return this.byName.get(name)!; }

  /** world rotation for bone i becomes `q`; local = parentWorld⁻¹ · q */
  private setWorldQ(i: number, q: THREE.Quaternion) {
    this.worldQ[i].copy(q);
    const p = this.parents[i];
    if (p < 0) this.bones[i].quaternion.copy(q);
    else this.bones[i].quaternion.copy(_qi.copy(this.worldQ[p]).invert().multiply(q));
  }

  /** propagate rest-local transforms below bone i (world caches only) */
  private inherit(i: number) {
    const p = this.parents[i];
    this.worldQ[i].copy(this.worldQ[p]).multiply(this.restLocalQ[i]);
    this.worldP[i].copy(this.restLocalP[i]).applyQuaternion(this.worldQ[p]).add(this.worldP[p]);
    this.bones[i].quaternion.copy(this.restLocalQ[i]);
  }

  /** Pose the body from the rig. */
  pose(r: Rig) {
    const j = r.j;
    const root = 0;
    // root: at the rig's pelvis, rotated by the pelvis
    this.worldP[root].copy(j.pelvis);
    this.bones[root].position.copy(j.pelvis);
    this.setWorldQ(root, _q.copy(r.pelvisQ).multiply(this.restWorldQ[root]));
    const spine05 = this.idx("spine05"), neck01 = this.idx("neck01");
    const aimed = new Map(this.aims.map((a) => [a.i, a]));
    for (let i = 1; i < this.bones.length; i++) {
      const p = this.parents[i];
      // position from the (already posed) parent
      this.worldP[i].copy(this.restLocalP[i]).applyQuaternion(this.worldQ[p]).add(this.worldP[p]);
      if (i === spine05) {
        this.setWorldQ(i, _q.copy(r.torsoQ).multiply(this.restWorldQ[i]));
      } else if (i === neck01) {
        this.setWorldQ(i, _q.copy(r.headQ).multiply(this.restWorldQ[i]));
      } else if (aimed.has(i)) {
        const a = aimed.get(i)!;
        const target = j[a.a.rigTo];
        _p.copy(target).sub(this.worldP[i]);
        const up = a.a.up === "Y" ? _u.set(0, 1, 0)
          : a.a.up.startsWith("knee") ? r.pole[a.a.up as "kneeL"]
          : a.a.up.startsWith("elbow") ? r.pole[a.a.up as "elbowL"]
          : r.handBack[a.a.up === "handL" ? "L" : "R"];
        const rot = frameRotation(a.aimRest, a.upRest, _p, up.clone(), _q);
        this.setWorldQ(i, rot.multiply(this.restWorldQ[i]));
      } else {
        this.inherit(i);
        const name = this.bones[i].name;
        // close the hand around the bar: curl each finger joint about its local X
        if (FINGERS.some((f) => name.startsWith(f)) || name.startsWith("finger1")) {
          const k = name.startsWith("finger1") ? 0.45 : 1;
          const ang = THREE.MathUtils.degToRad(this.grip * k * (name.includes("-1") ? 0.9 : 1));
          this.bones[i].quaternion.copy(this.restLocalQ[i]).multiply(_qi.setFromAxisAngle(_u.set(1, 0, 0), ang));
          this.worldQ[i].copy(this.worldQ[p]).multiply(this.bones[i].quaternion);
        }
      }
      this.bones[i].position.copy(this.restLocalP[i]);
    }
    this.bones[root].updateMatrixWorld(true);
  }

  /** Pose, then move the sensor pods onto the deformed skin and ease their glow. */
  update(r: Rig, dt = 1 / 60) {
    this.pose(r);
    if (!this.pods.size) return;
    for (const [n, p] of this.pods) {
      const vi = this.podVertex.get(n)!;
      const pos = this.nodePos.get(n)!;
      pos.fromBufferAttribute(this.mesh.geometry.attributes.position as THREE.BufferAttribute, vi);
      this.mesh.applyBoneTransform(vi, pos);   // skinned, in the lifter's local space (same as the rig)
      // sit the pod just proud of the skin, facing out from the nearest joint
      const joint = podJoint(n, r);
      _a.copy(pos).sub(joint).normalize();
      p.mesh.position.copy(pos).addScaledVector(_a, 0.006);
      p.mesh.quaternion.setFromUnitVectors(_u.set(0, 0, 1), _a);
      p.mesh.rotateX(Math.PI / 2);
      p.halo.position.copy(pos).addScaledVector(_a, 0.02);
      const target = p.state === "off" ? 0 : p.state === "dim" ? 0.25 : 1;
      p.glow += (target - p.glow) * Math.min(1, dt * 7);
      const col = NODE_COLOR[p.state];
      p.mat.emissive.copy(NODE_COLOR.off).lerp(col, p.glow);
      p.mat.emissiveIntensity = 1 + p.glow * (p.state === "flag" ? 2.4 : 1.6);
      const hm = p.halo.material as THREE.SpriteMaterial;
      hm.color.copy(col);
      hm.opacity = p.state === "off" || p.state === "dim" ? 0 : p.glow * (p.state === "flag" ? 1 : 0.7);
    }
  }
}

function podJoint(n: NodeName, r: Rig): THREE.Vector3 {
  if (n === "tspine") return r.j.chest;
  if (n === "lspine") return r.j.lumbar;
  return r.j[n as keyof Rig["j"]];
}

// ── materials ─────────────────────────────────────────────────────────────────────────

/** The compression suit: matte knit with a soft sheen, flatlock seams drawn as anti-aliased iso-lines. */
export function suitMaterial(tone: "gym" | "lab" = "gym") {
  const m = new THREE.MeshPhysicalMaterial({
    color: tone === "gym" ? "#1f1d1a" : "#262420",
    roughness: 0.7,
    metalness: 0,
    sheen: 0.3,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(tone === "gym" ? "#8f897f" : "#77716a"),
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSeam = { value: new THREE.Color(tone === "gym" ? "#4a463f" : "#55504a") };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aSeam;\nvarying vec2 vSeam;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSeam = aSeam;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uSeam;\nvarying vec2 vSeam;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float wx = fwidth(vSeam.x), wy = fwidth(vSeam.y);
        float lx = 1.0 - smoothstep(wx * 0.5, wx * 1.4, abs(vSeam.x));
        float ly = 1.0 - smoothstep(wy * 0.5, wy * 1.4, abs(vSeam.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, uSeam, max(lx, ly) * 0.9);`);
  };
  return m;
}

/** Bare head, neck and hands: a matte, sculptural finish so the suit reads as something worn. */
export function skinMaterial(tone: "gym" | "lab" = "gym") {
  return new THREE.MeshStandardMaterial({ color: tone === "gym" ? "#514a42" : "#5a5249", roughness: 0.78, metalness: 0 });
}
export function shoeMaterial() {
  return new THREE.MeshStandardMaterial({ color: "#141311", roughness: 0.55, metalness: 0 });
}

/** The three materials a body uses, in region order: suit, skin, shoe. */
export function bodyMaterials(tone: "gym" | "lab" = "gym"): THREE.Material[] {
  return [suitMaterial(tone), skinMaterial(tone), shoeMaterial()];
}

/** "Your normal": fresnel edges only, skinned, so it reads as an outline you can see the lift through. */
export function ghostMaterial(color = "#f2ede4", opacity = 0.5, additive = true) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying vec3 vV;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        vV = normalize(-mv.xyz);
        vN = normalize(normalMatrix * objectNormal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        gl_FragColor = vec4(uColor, smoothstep(0.42, 1.0, f) * uOpacity);
      }`,
    transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
