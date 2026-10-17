/**
 * The lifter's body: an Anny human (NAVER LABS Europe, Apache-2.0; MakeHuman assets, CC0), exported
 * offline by scripts/figure/export_body.py and skinned here. The IK rig (rig.ts) decides what the lift
 * does; this file aims each Anny bone along the rig so the real body follows exactly.
 */
import * as THREE from "three";
import type { Rig } from "./rig";
import { resource, texture, tiled, type GymTextures, type Resource } from "./textures";

// ── data ──────────────────────────────────────────────────────────────────────────────

type V3 = [number, number, number];
export type BodyMeasure = {
  height: number; thigh: number; shin: number; upperArm: number; forearm: number; hand: number; footLen: number; ankleH: number;
  pelvis: V3; hipL: V3; shoulderL: V3; neck: V3; head: V3; chest: V3; lumbar: V3; shoulderUp: number;
};
/** Material groups, in draw order (see export_body.py). */
export const GROUPS = ["suit", "skin", "eyes", "shoes", "hair", "brows", "lashes"] as const;
export type Group = (typeof GROUPS)[number];
/** Split off the eyes at load: MakeHuman's high-poly eyes carry a cornea shell, UV-mapped to a corner patch
 *  of the eye texture, that must draw as clear, wet glass over the iris (not as an opaque disc). */
const CORNEA = GROUPS.length;
const isCorneaUV = (u: number, v: number) => u > 0.8 && v < 0.2;
type TexSet = { map?: string; normalMap?: string };
type VariantData = {
  vertexCount: number; indexCount: number; bboxMin: V3; bboxMax: V3; bind: number[]; measure: BodyMeasure;
  pods: Record<string, number>; groups: { name: Group; start: number; count: number }[]; textures: Partial<Record<Group, TexSet>>;
};
type Meta = { bones: string[]; parents: number[]; variants: Record<string, VariantData> };
export type Variant = "lifter" | "long" | "short";
export type BodyTextures = Partial<Record<Group, { map?: THREE.Texture; normalMap?: THREE.Texture }>>;
export type BodyData = { meta: Meta; buf: ArrayBuffer; variant: Variant; tex: BodyTextures };

let metaP: Promise<Meta> | null = null;

/** Fetches the variant's mesh (one file) and its textures (real skin, eyes, hair… all CC0). */
async function loadBody(variant: Variant): Promise<BodyData> {
  metaP ??= fetch("/models/figure.json").then((r) => r.json());
  const [meta, buf] = await Promise.all([metaP, fetch(`/models/figure-${variant}.bin`).then((r) => r.arrayBuffer())]);
  const tex: BodyTextures = {};
  await Promise.all(Object.entries(meta.variants[variant].textures).map(async ([g, set]) => {
    const [map, normalMap] = await Promise.all([
      set?.map ? texture(set.map) : undefined,
      set?.normalMap ? texture(set.normalMap, { srgb: false }) : undefined,
    ]);
    tex[g as Group] = { map, normalMap };
  }));
  return { meta, buf, variant, tex };
}

/** A stable promise per variant, for React's use(); preload it before mounting a scene. */
const resources = new Map<Variant, Resource<BodyData>>();
export function bodyResource(variant: Variant) {
  if (!resources.has(variant)) resources.set(variant, resource(loadBody(variant)));
  return resources.get(variant)!;
}

/** Builds the variant's skinned geometry: positions, normals, UVs, skin, garment seams, material groups. Cached. */
const geoCache = new Map<Variant, THREE.BufferGeometry>();
function geometry(d: BodyData) {
  const hit = geoCache.get(d.variant);
  if (hit) return hit;
  const v = d.meta.variants[d.variant];
  const n = v.vertexCount, m = v.indexCount, b = d.buf;
  let o = 0;
  const idx = new Uint16Array(b, o, m); o += m * 2;
  const q = new Int16Array(b, o, n * 3); o += n * 6;
  const uv = new Uint16Array(b, o, n * 2); o += n * 4;
  const nrm = new Int8Array(b, o, n * 3); o += n * 3;
  const skinI = new Uint8Array(b, o, n * 4); o += n * 4;
  const skinW = new Uint8Array(b, o, n * 4); o += n * 4;
  const sm = new Int8Array(b, o, n * 2);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    const a = i % 3;
    pos[i] = v.bboxMin[a] + ((q[i] + 32767) / 65534) * (v.bboxMax[a] - v.bboxMin[a]);
  }
  const seam = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { seam[i * 2] = sm[i * 2] / 127; seam[i * 2 + 1] = sm[i * 2 + 1] / 100; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Int8Array(nrm), 3, true));
  g.setAttribute("uv", new THREE.BufferAttribute(new Uint16Array(uv), 2, true));
  g.setAttribute("aSeam", new THREE.BufferAttribute(seam, 2));
  const sI = Uint16Array.from(skinI), sW = new Float32Array(skinW).map((w) => w / 255);
  const tris = new Uint16Array(idx);
  const range = (name: Group) => v.groups.find((x) => x.name === name)!;
  const verts = (name: Group) => { const r = range(name); return new Set(tris.subarray(r.start, r.start + r.count)); };
  const lids = eyelids(pos, verts("eyes"), verts("skin"), verts("lashes"), sI, sW, d.meta.bones.length);
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(sI, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(sW, 4));
  // the eye group: eyeballs first, then the cornea shells as their own group
  const eye = range("eyes");
  const ball: number[] = [], cornea: number[] = [];
  for (let t = eye.start; t < eye.start + eye.count; t += 3) {
    const a = tris[t];
    (isCorneaUV(uv[a * 2] / 65535, uv[a * 2 + 1] / 65535) ? cornea : ball).push(tris[t], tris[t + 1], tris[t + 2]);
  }
  tris.set(ball, eye.start);
  tris.set(cornea, eye.start + ball.length);
  g.setIndex(new THREE.BufferAttribute(tris, 1));
  for (const grp of v.groups) {
    if (grp.name !== "eyes") { g.addGroup(grp.start, grp.count, GROUPS.indexOf(grp.name)); continue; }
    g.addGroup(grp.start, ball.length, GROUPS.indexOf("eyes"));
    g.addGroup(grp.start + ball.length, cornea.length, CORNEA);
  }
  g.userData.eyeCentres = lids;
  g.computeBoundingSphere();
  geoCache.set(d.variant, g);
  return g;
}

/**
 * The rig has no eyelid bones, so we add two (one per eye, pivoting at the eyeball's centre) and hand them
 * the upper lid: skin and upper lashes above the eye opening, weighted by how far above it they sit. Rotating
 * a lid bone about X then rolls the lid down over the eyeball, the way a real lid slides over the cornea.
 * Measured on the Anny head: the opening spans about −26° (lower lid) to +17° (upper lid) about the centre.
 * Returns the eye centres (bind pose), [left, right]; lid bones are appended as bone `nb` (L) and `nb + 1` (R).
 */
function eyelids(pos: Float32Array, eye: Set<number>, skin: Set<number>, lashes: Set<number>, sI: Uint16Array, sW: Float32Array, nb: number) {
  const centres = [1, -1].map((side) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const i of eye) {
      if (Math.sign(pos[i * 3]) !== side) continue;
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i * 3 + a]); hi[a] = Math.max(hi[a], pos[i * 3 + a]); }
    }
    return new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
  });
  const deg = 180 / Math.PI;
  const assign = (i: number, bone: number, w: number) => {
    if (w <= 0.01) return;
    let k = 0;   // replace the weakest influence, scale the rest so the weights still sum to 1
    for (let j = 1; j < 4; j++) if (sW[i * 4 + j] < sW[i * 4 + k]) k = j;
    sW[i * 4 + k] = 0;
    let sum = 0;
    for (let j = 0; j < 4; j++) sum += sW[i * 4 + j];
    for (let j = 0; j < 4; j++) sW[i * 4 + j] *= sum > 0 ? (1 - w) / sum : 0;
    sI[i * 4 + k] = bone; sW[i * 4 + k] = w;
  };
  const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  centres.forEach((c, s) => {
    for (const set of [skin, lashes]) {
      for (const i of set) {
        const dx = pos[i * 3] - c.x, dy = pos[i * 3 + 1] - c.y, dz = pos[i * 3 + 2] - c.z;
        const r = Math.hypot(dx, dy, dz);
        if (dz < -0.004 || r > 0.026 || Math.abs(dx) > 0.022) continue;
        const phi = Math.atan2(dy, dz) * deg;   // elevation about the eye's horizontal axis
        // full weight from the lid margin up the lid, fading out below the brow and toward the corners
        const w = set === lashes
          ? (dy > 0 ? 1 : 0)
          : ramp(8, 16, phi) * (1 - ramp(42, 78, phi)) * (1 - ramp(0.013, 0.021, Math.abs(dx))) * (1 - ramp(0.02, 0.026, r));
        assign(i, nb + s, w);
      }
    }
  });
  return centres;
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
/** Curl per finger segment for a grip around a bar, as a fraction of `grip`: knuckle, middle, tip. */
const CURL = { fingers: [0.62, 1.12, 0.78], thumb: [0.45, 0.6, 0.6] };

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
  /** The sensors are woven into the suit, so they're never drawn: each node is a state and a point on the
   *  skin, which the scene uses to anchor callouts and the buzz. */
  readonly pods = new Map<NodeName, { state: NodeState }>();
  readonly nodePos = new Map<NodeName, THREE.Vector3>();
  /** finger curl for a closed grip, degrees (the middle joint's bend; see CURL) */
  grip = 72;
  /** where the eyes look, in the lifter's space; null = straight ahead, a couple of metres out */
  look: THREE.Vector3 | null = null;
  /** hold the lids at this much of a blink (0 open … 1 shut) instead of blinking on their own: the lab's stills */
  blinkHold: number | null = null;
  /** per finger bone: its flexion axis in the bone's local frame and its curl fraction */
  private curl = new Map<number, { axis: THREE.Vector3; k: number }>();
  private eyes: number[] = [];
  private chest: number[] = [];
  private clavicles: number[] = [];
  private lids: number[] = [];
  // the life in the eyes: blinks and small saccades, on their own clocks
  private life = { t: 0, nextBlink: 1.2, blink: 0, sacc: new THREE.Vector3(), saccTo: new THREE.Vector3(), nextSacc: 0.6, seed: 1 };

  constructor(d: BodyData, material: THREE.Material | THREE.Material[], opts: { pods?: boolean; castShadow?: boolean } = {}) {
    const { meta } = d;
    const v = meta.variants[d.variant];
    this.measure = v.measure;
    const bind = v.bind;
    const geo = geometry(d);
    // the rig's bones, plus the two eyelid bones (eyelids(): children of the head, pivoting at each eye)
    const head = meta.bones.indexOf("head");
    const centres = geo.userData.eyeCentres as THREE.Vector3[];
    const names = [...meta.bones, "lid.L", "lid.R"];
    this.parents = [...meta.parents, head, head];
    const world: THREE.Matrix4[] = [
      ...meta.bones.map((_, i) => new THREE.Matrix4().fromArray(bind, i * 16)),
      ...centres.map((c) => new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)),
    ];
    names.forEach((name, i) => {
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
    names.forEach((_, i) => {
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
    this.eyes = ["eye.L", "eye.R"].map((n) => this.byName.get(n)!);
    this.lids = ["lid.L", "lid.R"].map((n) => this.byName.get(n)!);
    this.chest = ["spine02", "spine01"].map((n) => this.byName.get(n)!);
    this.clavicles = ["clavicle.L", "clavicle.R"].map((n) => this.byName.get(n)!);
    this.fingerAxes();
    this.life.seed = d.variant.length * 7 + 3;
    const skeleton = new THREE.Skeleton(this.bones, world.map((m) => m.clone().invert()));
    this.mesh = new THREE.SkinnedMesh(geo, material);
    this.mesh.add(this.bones[0]);
    this.mesh.bind(skeleton, new THREE.Matrix4());
    this.mesh.castShadow = opts.castShadow ?? true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    if (opts.pods !== false) {
      for (const n of NODES) {
        this.pods.set(n, { state: "off" });
        this.nodePos.set(n, new THREE.Vector3());
        this.podVertex.set(n, v.pods[n]);
      }
    }
  }

  /**
   * Each finger bends about its own hinge: perpendicular to the segment and to the palm's normal, taken from
   * the bind pose (wrist → middle knuckle for the hand's long axis, index → little knuckle across it).
   */
  private fingerAxes() {
    const P = (n: string) => this.restWorldP[this.byName.get(n)!];
    for (const s of ["L", "R"] as const) {
      const along = new THREE.Vector3().subVectors(P(`finger3-1.${s}`), P(`wrist.${s}`));
      const across = new THREE.Vector3().subVectors(P(`finger2-1.${s}`), P(`finger5-1.${s}`));
      const palm = new THREE.Vector3().crossVectors(along, across).normalize().multiplyScalar(s === "L" ? 1 : -1);
      for (let f = 1; f <= 5; f++) {
        for (let seg = 1; seg <= 3; seg++) {
          const i = this.byName.get(`finger${f}-${seg}.${s}`);
          if (i === undefined) continue;
          const next = this.byName.get(`finger${f}-${seg + 1}.${s}`);
          const dir = next !== undefined
            ? new THREE.Vector3().subVectors(this.restWorldP[next], this.restWorldP[i])
            : new THREE.Vector3().subVectors(this.restWorldP[i], this.restWorldP[this.parents[i]]);
          const axis = new THREE.Vector3().crossVectors(dir.normalize(), palm).normalize();
          axis.applyQuaternion(_qi.copy(this.restWorldQ[i]).invert());   // into the bone's local frame
          this.curl.set(i, { axis, k: (f === 1 ? CURL.thumb : CURL.fingers)[seg - 1] });
        }
      }
    }
  }

  private rand() { const x = Math.sin(this.life.seed++ * 12.9898) * 43758.5453; return x - Math.floor(x); }

  /** Advance blinks and saccades. A blink is fast to close (~70 ms) and slower to open (~140 ms). */
  private live(dt: number) {
    const L = this.life;
    L.t += dt;
    if (L.t > L.nextBlink) {
      const k = (L.t - L.nextBlink) / 0.21;
      L.blink = k < 0.33 ? k / 0.33 : k < 1 ? 1 - (k - 0.33) / 0.67 : 0;
      if (k >= 1) { L.blink = 0; L.nextBlink = L.t + 2.2 + this.rand() * 3.8 - (this.rand() < 0.15 ? 2 : 0); }
    }
    if (L.t > L.nextSacc) {
      // small, quick jumps of gaze around the point of regard, a couple of degrees at most
      L.saccTo.set((this.rand() - 0.5) * 0.09, (this.rand() - 0.5) * 0.05, 0);
      L.nextSacc = L.t + 0.5 + this.rand() * 2;
    }
    L.sacc.lerp(L.saccTo, Math.min(1, dt * 30));
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
        const c = this.curl.get(i);
        if (c) {
          // close the hand around the bar: each segment about its own hinge
          this.bones[i].quaternion.copy(this.restLocalQ[i]).multiply(_qi.setFromAxisAngle(c.axis, THREE.MathUtils.degToRad(this.grip * c.k)));
          this.worldQ[i].copy(this.worldQ[p]).multiply(this.bones[i].quaternion);
        } else if (this.chest.includes(i) || this.clavicles.includes(i)) {
          // breathing: the upper spine opens and the shoulders rise on the inhale
          const ax = this.chest.includes(i) ? _a.set(1, 0, 0) : _a.set(0, 0, i === this.clavicles[0] ? 1 : -1);
          const deg = this.chest.includes(i) ? -1.1 : 1.8;
          _q.setFromAxisAngle(ax.applyQuaternion(r.torsoQ), THREE.MathUtils.degToRad(deg * r.breath));
          this.setWorldQ(i, _q.multiply(this.worldQ[i]));
        } else if (i === this.eyes[0] || i === this.eyes[1]) {
          this.gaze(i, r);
        } else if (i === this.lids[0] || i === this.lids[1]) {
          // the lid closes for a blink, and follows the eye down when the gaze drops
          const lift = Math.max(0, -this.gazePitch) * 0.55;
          this.bones[i].quaternion.copy(this.restLocalQ[i]).multiply(_qi.setFromAxisAngle(_u.set(1, 0, 0), THREE.MathUtils.degToRad((this.blinkHold ?? this.life.blink) * 40) + lift));
          this.worldQ[i].copy(this.worldQ[p]).multiply(this.bones[i].quaternion);
        }
      }
      this.bones[i].position.copy(this.restLocalP[i]);
    }
    this.bones[root].updateMatrixWorld(true);
  }

  private gazePitch = 0;
  /** Turn an eye toward the point of regard (clamped to ±28°, as far as eyes comfortably rotate). */
  private gaze(i: number, r: Rig) {
    const fwd = _a.set(0, 0, 1).applyQuaternion(_q.copy(this.worldQ[i]).multiply(_qi.copy(this.restWorldQ[i]).invert()));
    const target = this.look ? _p.copy(this.look) : _p.copy(r.j.head).addScaledVector(fwd, 2.5);
    const want = _c.subVectors(target, this.worldP[i]).normalize();
    want.x += this.life.sacc.x; want.y += this.life.sacc.y;
    want.normalize();
    const ang = fwd.angleTo(want), max = THREE.MathUtils.degToRad(28);
    if (ang > max) want.lerpVectors(fwd, want, max / ang).normalize();
    this.gazePitch = Math.asin(Math.max(-1, Math.min(1, want.y))) - Math.asin(Math.max(-1, Math.min(1, fwd.y)));
    _q.setFromUnitVectors(fwd, want);
    this.setWorldQ(i, _q.multiply(this.worldQ[i]));
  }

  /** Pose, then find each sensor node on the deformed skin.
   *  dt ≥ 0.5 is a snap (a still, or a second render of the same frame): the eyes' clocks don't advance. */
  update(r: Rig, dt = 1 / 60) {
    if (dt < 0.5) this.live(dt);
    this.pose(r);
    for (const n of this.pods.keys()) {
      const vi = this.podVertex.get(n)!;
      const pos = this.nodePos.get(n)!;
      pos.fromBufferAttribute(this.mesh.geometry.attributes.position as THREE.BufferAttribute, vi);
      this.mesh.applyBoneTransform(vi, pos);   // skinned, in the lifter's local space (same as the rig)
    }
  }
}

// ── materials ─────────────────────────────────────────────────────────────────────────

/** Hair colour per lifter, multiplied over the MakeHuman hair texture. */
const HAIR_TINT: Record<Variant, string> = { lifter: "#2f2622", long: "#a58566", short: "#3d2c24" };

/** The compression suit: a real knit (ambientCG Fabric062) — heathered colour, weave relief, fabric
 *  roughness — with a soft sheen, and flatlock seams drawn as anti-aliased iso-lines. */
export function suitMaterial(gym: GymTextures, tone: "gym" | "lab" = "lab") {
  const knit = tiled(gym.fabric, 34, 34);
  const m = new THREE.MeshPhysicalMaterial({
    color: tone === "gym" ? "#34312d" : "#3e3a35",
    map: knit.color, normalMap: knit.normal, normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: knit.orm, roughness: 1, aoMap: knit.orm, aoMapIntensity: 0.7,
    metalness: 0, sheen: 0.5, sheenRoughness: 0.45, sheenColor: new THREE.Color("#8f897f"),
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSeam = { value: new THREE.Color(tone === "gym" ? "#4a463f" : "#5d5851") };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aSeam;\nvarying vec2 vSeam;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSeam = aSeam;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uSeam;\nvarying vec2 vSeam;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        float wx = fwidth(vSeam.x), wy = fwidth(vSeam.y);
        float lx = 1.0 - smoothstep(wx * 0.5, wx * 1.4, abs(vSeam.x));
        float ly = 1.0 - smoothstep(wy * 0.5, wy * 1.4, abs(vSeam.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, uSeam, max(lx, ly) * 0.9);`);
  };
  return m;
}

/** Bare head, neck and hands: the MakeHuman skin texture, with a soft warm sheen at grazing angles. */
export function skinMaterial(tex: BodyTextures) {
  return new THREE.MeshPhysicalMaterial({
    map: tex.skin?.map, roughness: 0.5, metalness: 0, specularIntensity: 0.55,
    sheen: 0.3, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffb59c"),
  });
}

/** Every material a body uses, in group order (see GROUPS). */
export function bodyMaterials(d: BodyData, gym: GymTextures, tone: "gym" | "lab" = "lab"): THREE.Material[] {
  const t = d.tex;
  const strands = (map: THREE.Texture | undefined, color: string, alphaTest: number) => new THREE.MeshStandardMaterial({
    map, color, alphaTest, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0,
  });
  return [
    suitMaterial(gym, tone),
    skinMaterial(t),
    new THREE.MeshStandardMaterial({ map: t.eyes?.map, roughness: 0.35, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: t.shoes?.map, normalMap: t.shoes?.normalMap, roughness: 0.62, metalness: 0 }),
    strands(t.hair?.map, HAIR_TINT[d.variant], 0.4),
    strands(t.brows?.map, "#3a2e28", 0.3),
    strands(t.lashes?.map, "#1c1715", 0.3),
    corneaMaterial(),
  ];
}

/** The cornea: clear and wet. It adds only its reflections (black base, additive), so the iris shows
 *  through with a catchlight on top: the single biggest cue that the eyes are alive. */
function corneaMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#000000", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02,
    specularIntensity: 1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/** The ghost draws the body's surface only: no eyes, hair or trainers. */
export function ghostMaterials(ghost: THREE.Material): THREE.Material[] {
  const none = new THREE.MeshBasicMaterial({ visible: false });
  return [...GROUPS.map((g) => (g === "suit" || g === "skin" ? ghost : none)), none];
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
