/**
 * The FormGuard lifter's skeleton: a joint hierarchy solved per frame.
 *
 * Hierarchy  pelvis ─┬─ hip ─ knee ─ ankle ─ toe            (×2, two-bone IK, feet planted)
 *                    └─ lumbar ─ chest ─┬─ neck ─ head
 *                                       └─ shoulder ─ elbow ─ wrist ─ hand   (×2, two-bone IK)
 * World axes: Y up, the lifter faces +Z, their LEFT side is +X. Units: metres.
 * Proportions are measured from the loaded Anny body (body.ts), so the IK solves on the real bone
 * lengths and the body's bones land exactly on the rig. Each lift solves biomechanical constraints
 * (bar over mid-foot, feet planted, hands on the bar) instead of playing canned rotations.
 */
import { Quaternion, Vector3 } from "three";
import type { BodyMeasure } from "./body";

type V3 = [number, number, number];
export type Proportions = {
  thigh: number; shin: number; ankleH: number; footLen: number;
  upperArm: number; forearm: number; hand: number;
  /** offsets from the pelvis in the rest pose (left side for paired joints) */
  hipOff: V3; shoulderOff: V3; neckOff: V3; headOff: V3; chestOff: V3; lumbarOff: V3;
  /** pelvis → shoulder line, the torso lever */
  torso: number;
};

export function fromBody(m: BodyMeasure): Proportions {
  return {
    thigh: m.thigh, shin: m.shin, ankleH: m.ankleH, footLen: m.footLen,
    upperArm: m.upperArm, forearm: m.forearm, hand: m.hand,
    hipOff: m.hipL, shoulderOff: m.shoulderL, neckOff: m.neck, headOff: m.head, chestOff: m.chest, lumbarOff: m.lumbar,
    torso: m.shoulderUp,
  };
}

export const JOINTS = [
  "pelvis", "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR", "toeL", "toeR", "heelL", "heelR",
  "lumbar", "chest", "neck", "head", "shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR", "handL", "handR",
] as const;
export type Joint = (typeof JOINTS)[number];

export type Rig = {
  j: Record<Joint, Vector3>;
  torsoQ: Quaternion;
  pelvisQ: Quaternion;
  headQ: Quaternion;
  /** the breath, −1 (out) … 1 (in; up to ~1.4 when braced): lifts the chest and shoulders on the body */
  breath: number;
  pole: { kneeL: Vector3; kneeR: Vector3; elbowL: Vector3; elbowR: Vector3 };
  /** the direction the back of each hand faces (wrist roll) */
  handBack: { L: Vector3; R: Vector3 };
  footDir: { L: Vector3; R: Vector3 };
  bar: { a: Vector3; b: Vector3; on: boolean };  // a = lifter's left end (+X)
  angle: { kneeL: number; kneeR: number; elbowL: number; elbowR: number; torso: number; valgusL: number; valgusR: number };
};

export function makeRig(): Rig {
  const j = {} as Record<Joint, Vector3>;
  for (const n of JOINTS) j[n] = new Vector3();
  return {
    j, torsoQ: new Quaternion(), pelvisQ: new Quaternion(), headQ: new Quaternion(), breath: 0,
    pole: { kneeL: new Vector3(), kneeR: new Vector3(), elbowL: new Vector3(), elbowR: new Vector3() },
    handBack: { L: new Vector3(), R: new Vector3() },
    footDir: { L: new Vector3(), R: new Vector3() },
    bar: { a: new Vector3(), b: new Vector3(), on: false },
    angle: { kneeL: 0, kneeR: 0, elbowL: 0, elbowR: 0, torso: 0, valgusL: 0, valgusR: 0 },
  };
}

// ── math helpers (allocation-free in the hot path) ─────────────────────────────────────
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
const _u = new Vector3(), _v = new Vector3(), _t = new Vector3(), _q2 = new Quaternion(), _q3 = new Quaternion();
const _gL = new Vector3(), _gR = new Vector3(), _pL = new Vector3(), _pR = new Vector3();
const deg = Math.PI / 180;

/** Analytic two-bone IK: places `mid` so |root-mid| = a, |mid-end| = b, bending toward `pole`. */
export function twoBone(root: Vector3, target: Vector3, a: number, b: number, pole: Vector3, mid: Vector3, end: Vector3) {
  _u.subVectors(target, root);
  let len = _u.length();
  len = Math.min(Math.max(len, Math.abs(a - b) + 1e-4), a + b - 1e-4);
  _u.normalize();
  const cosA = (a * a + len * len - b * b) / (2 * a * len);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  _v.copy(pole).addScaledVector(_u, -pole.dot(_u)).normalize();
  mid.copy(root).addScaledVector(_u, a * cosA).addScaledVector(_v, a * sinA);
  end.copy(root).addScaledVector(_u, len);
}

function angleAt(a: Vector3, b: Vector3, c: Vector3) {
  _u.subVectors(a, b).normalize();
  _v.subVectors(c, b).normalize();
  return Math.acos(Math.min(1, Math.max(-1, _u.dot(_v)))) / deg;
}

function at(out: Vector3, origin: Vector3, q: Quaternion, x: number, y: number, z: number) {
  return out.set(x, y, z).applyQuaternion(q).add(origin);
}

function hips(r: Rig, P: Proportions) {
  const [hx, hy, hz] = P.hipOff;
  at(r.j.hipL, r.j.pelvis, r.pelvisQ, hx, hy, hz);
  at(r.j.hipR, r.j.pelvis, r.pelvisQ, -hx, hy, hz);
}

// ── shared lower body: feet planted, knees tracking toward the toes (minus valgus) ───────
function legs(r: Rig, P: Proportions, stance: number, toeOut: number, valgusL: number, valgusR: number) {
  const { j } = r;
  for (const [s, side] of [[1, "L"], [-1, "R"]] as const) {
    const ankle = j[`ankle${side}`], toe = j[`toe${side}`], heel = j[`heel${side}`];
    ankle.set((s * stance) / 2, P.ankleH, 0);
    const yaw = s * toeOut * deg;
    const dir = r.footDir[side].set(Math.sin(yaw), 0, Math.cos(yaw));
    toe.copy(ankle).addScaledVector(dir, P.footLen * 0.62).setY(P.ankleH * 0.42);
    heel.copy(ankle).addScaledVector(dir, -P.footLen * 0.2).setY(0.03);
    const v = (side === "L" ? valgusL : valgusR) * deg;
    const kyaw = s * (toeOut * deg - v);
    const pole = r.pole[`knee${side}`].set(Math.sin(kyaw), 0.08, Math.cos(kyaw)).normalize();
    twoBone(j[`hip${side}`], ankle, P.thigh, P.shin, pole, j[`knee${side}`], _t);
  }
  r.angle.kneeL = 180 - angleAt(j.hipL, j.kneeL, j.ankleL);
  r.angle.kneeR = 180 - angleAt(j.hipR, j.kneeR, j.ankleR);
  r.angle.valgusL = valgusL;
  r.angle.valgusR = valgusR;
}

/** Small head movements on top of the lift's own head angle: degrees. */
export type Head = { yaw?: number; nod?: number; roll?: number };

function upperBody(r: Rig, P: Proportions, pitch: number, headPitch: number, breath = 0, head: Head = {}) {
  r.breath = breath;
  const { j } = r;
  const pelvis = j.pelvis;
  r.pelvisQ.setFromAxisAngle(X, pitch * 0.82 * deg);
  r.torsoQ.setFromAxisAngle(X, pitch * deg);
  at(j.lumbar, pelvis, r.torsoQ, ...P.lumbarOff);
  at(j.chest, pelvis, r.torsoQ, P.chestOff[0], P.chestOff[1] + breath * 0.004, P.chestOff[2]);
  at(j.neck, pelvis, r.torsoQ, ...P.neckOff);
  r.headQ.setFromAxisAngle(Y, (head.yaw ?? 0) * deg)
    .multiply(_q2.setFromAxisAngle(X, (headPitch + (head.nod ?? 0)) * deg))
    .multiply(_q3.setFromAxisAngle(Z, (head.roll ?? 0) * deg));
  // skull centre: the head bone sits at the base of the skull; the centre is ~9 cm above it
  at(j.head, j.neck, r.headQ, P.headOff[0] - P.neckOff[0], P.headOff[1] - P.neckOff[1] + 0.09, P.headOff[2] - P.neckOff[2] + 0.015);
  const [sx, sy, sz] = P.shoulderOff;
  at(j.shoulderL, pelvis, r.torsoQ, sx, sy + breath * 0.002, sz);
  at(j.shoulderR, pelvis, r.torsoQ, -sx, sy + breath * 0.002, sz);
  r.angle.torso = pitch;
}

/** `bar`: on a bar, the wrists bend sideways so the fingers cross the bar square, as a real grip does. */
function arms(r: Rig, P: Proportions, gripL: Vector3, gripR: Vector3, poleL: Vector3, poleR: Vector3, bar?: Vector3) {
  const { j } = r;
  for (const [side, grip, pole] of [["L", gripL, poleL], ["R", gripR, poleR]] as const) {
    r.pole[`elbow${side}`].copy(pole).normalize();
    r.handBack[side].copy(pole).normalize();
    twoBone(j[`shoulder${side}`], grip, P.upperArm, P.forearm, r.pole[`elbow${side}`], j[`elbow${side}`], j[`wrist${side}`]);
    _u.subVectors(j[`wrist${side}`], j[`elbow${side}`]).normalize();
    if (bar) _u.addScaledVector(bar, -0.9 * _u.dot(bar)).normalize();
    j[`hand${side}`].copy(j[`wrist${side}`]).addScaledVector(_u, P.hand * 0.5);
  }
  r.angle.elbowL = 180 - angleAt(j.shoulderL, j.elbowL, j.wristL);
  r.angle.elbowR = 180 - angleAt(j.shoulderR, j.elbowR, j.wristR);
}

// ── lifts ─────────────────────────────────────────────────────────────────────────────

export type SquatParams = {
  depth: number; valgusL?: number; valgusR?: number; breath?: number; leanMax?: number; stance?: number; barOn?: boolean;
  /** idle life: head movements (degrees) and a sideways weight shift (metres), both fading out with depth */
  head?: Head; sway?: number;
};

/** High-bar back squat. `depth` 0 = locked out, 1 = bottom (hip crease below the knee).
 *  The hips are solved so the bar stays over mid-foot, as it must for a balanced squat. */
export function squat(r: Rig, P: Proportions, s: SquatParams) {
  const stance = s.stance ?? 0.38;
  const toeOut = 16;
  const d = Math.min(1, Math.max(0, s.depth));
  const hipDrop = -P.hipOff[1];
  const hStand = P.ankleH + hipDrop + P.thigh + P.shin - 0.014;
  const hBottom = P.ankleH + hipDrop + P.shin * 0.82 - 0.03;     // hip crease just below the knee
  const h = hStand + (hBottom - hStand) * d;
  // torso lean at depth grows with femur length relative to torso: this is what "your normal" captures
  const leanMax = s.leanMax ?? 18 + 48 * (P.thigh / P.torso - 0.75);
  const pitch = 3 + (leanMax - 3) * Math.pow(d, 0.85);
  // bar on the upper traps; hips solved to keep it over mid-foot
  const barUp = P.shoulderOff[1] + 0.05, barBack = P.shoulderOff[2] - 0.085;
  const midfoot = P.footLen * 0.18;
  const pr = pitch * deg;
  const barZ = barUp * Math.sin(pr) + barBack * Math.cos(pr);
  // at depth the lifter is locked in: the idle movements fade out
  const calm = 1 - 0.8 * Math.min(1, d * 2);
  r.j.pelvis.set((s.sway ?? 0) * calm, h, midfoot - barZ);
  const hd = s.head ?? {};
  upperBody(r, P, pitch, pitch * 0.6, s.breath ?? 0, { yaw: (hd.yaw ?? 0) * calm, nod: (hd.nod ?? 0) * calm, roll: (hd.roll ?? 0) * calm });
  hips(r, P);
  legs(r, P, stance, toeOut, s.valgusL ?? 0, s.valgusR ?? 0);
  r.bar.on = s.barOn ?? true;
  const barC = at(_t, r.j.pelvis, r.torsoQ, 0, barUp, barBack);
  r.bar.a.set(1.1, barC.y, barC.z); r.bar.b.set(-1.1, barC.y, barC.z);
  // wrists below and behind the bar, so it sits across the base of the fingers and they wrap over it
  _gL.set(0.44, barC.y - 0.078, barC.z - 0.032);
  _gR.set(-0.44, barC.y - 0.078, barC.z - 0.032);
  arms(r, P, _gL, _gR, _pL.set(0.35, -1, -0.55), _pR.set(-0.35, -1, -0.55), X);
  return r;
}

export type StandParams = { breath?: number; sway?: number; head?: Head };

/** Ready stance before the lift: tall, arms relaxed at the sides, weight even. */
export function stand(r: Rig, P: Proportions, s: StandParams = {}) {
  const hStand = P.ankleH - P.hipOff[1] + P.thigh + P.shin - 0.01;
  const sway = s.sway ?? 0;
  r.j.pelvis.set(sway * 0.01, hStand, 0.004);
  upperBody(r, P, 1.5, 3, s.breath ?? 0, s.head);
  hips(r, P);
  legs(r, P, 0.34, 12, 0, 0);
  r.bar.on = false;
  // hands hang just off the thighs, elbows soft and pointing back
  const hy = r.j.pelvis.y - 0.11;
  _gL.set(P.shoulderOff[0] + 0.09, hy, 0.035);
  _gR.set(-P.shoulderOff[0] - 0.09, hy, 0.035);
  arms(r, P, _gL, _gR, _pL.set(0.35, -0.05, -1), _pR.set(-0.35, -0.05, -1));
  r.handBack.L.set(1, 0, -0.25).normalize();
  r.handBack.R.set(-1, 0, -0.25).normalize();
  return r;
}

export type CurlParams = { flex: number; breath?: number; lean?: number; head?: Head };

/** Standing barbell curl. `flex` is elbow flexion in degrees (≈10 extended → 145 full). */
export function curl(r: Rig, P: Proportions, c: CurlParams) {
  const hStand = P.ankleH - P.hipOff[1] + P.thigh + P.shin - 0.008;
  r.j.pelvis.set(0, hStand, 0);
  upperBody(r, P, 2 + (c.lean ?? 0), 4, c.breath ?? 0, c.head);
  hips(r, P);
  legs(r, P, 0.32, 10, 0, 0);
  const th = c.flex * deg;
  const shoulderFlex = (Math.max(0, c.flex - 60) / 85) * 9 * deg;
  for (const [side, s] of [["L", 1], ["R", -1]] as const) {
    const sh = r.j[`shoulder${side}`];
    _q2.setFromAxisAngle(X, -shoulderFlex);
    const elbow = r.j[`elbow${side}`].set(s * 0.03, -P.upperArm, -0.01).applyQuaternion(_q2).add(sh);
    const wrist = r.j[`wrist${side}`].set(0, -Math.cos(th + shoulderFlex), Math.sin(th + shoulderFlex)).multiplyScalar(P.forearm).add(elbow);
    _u.subVectors(wrist, elbow).normalize();
    r.j[`hand${side}`].copy(wrist).addScaledVector(_u, P.hand * 0.5);
    r.pole[`elbow${side}`].set(s * 0.15, 0, -1).normalize();
    // underhand grip: the back of the hand faces away from the bend
    r.handBack[side].set(0, -Math.sin(th + shoulderFlex), -Math.cos(th + shoulderFlex));
  }
  r.angle.elbowL = c.flex; r.angle.elbowR = c.flex;
  const hc = _t.addVectors(r.j.handL, r.j.handR).multiplyScalar(0.5);
  r.bar.on = true;
  r.bar.a.set(0.62, hc.y, hc.z); r.bar.b.set(-0.62, hc.y, hc.z);
  return r;
}

export type BenchParams = { press: number; slip?: number; breath?: number; head?: Head };
export const BENCH = { top: 0.44, length: 1.22, width: 0.29, z0: -0.62, z1: 0.6 };

/** Bench press along the bench (head toward −Z). `press` 0 = bar on the chest, 1 = lockout.
 *  `slip` drifts the LEFT (far-side) hand out and down: the fault a side-on phone can't see. */
export function bench(r: Rig, P: Proportions, b: BenchParams) {
  const { j } = r;
  r.torsoQ.setFromAxisAngle(X, -90 * deg);
  r.pelvisQ.copy(r.torsoQ);
  // lying on the pad: the back of the ribcage rests on the bench top
  j.pelvis.set(0, BENCH.top + 0.1, 0.22);
  at(j.lumbar, j.pelvis, r.torsoQ, ...P.lumbarOff);
  at(j.chest, j.pelvis, r.torsoQ, P.chestOff[0], P.chestOff[1], P.chestOff[2] + (b.breath ?? 0) * 0.004);
  at(j.neck, j.pelvis, r.torsoQ, ...P.neckOff);
  r.breath = b.breath ?? 0;
  // lying back: the head turns about the body's long axis, nods about its own X
  r.headQ.copy(r.torsoQ).multiply(_q2.setFromAxisAngle(Y, (b.head?.yaw ?? 0) * deg)).multiply(_q3.setFromAxisAngle(X, (b.head?.nod ?? 0) * deg));
  at(j.head, j.neck, r.headQ, P.headOff[0] - P.neckOff[0], P.headOff[1] - P.neckOff[1] + 0.09, P.headOff[2] - P.neckOff[2] + 0.015);
  const [sx, sy, sz] = P.shoulderOff;
  at(j.shoulderL, j.pelvis, r.torsoQ, sx, sy, sz);
  at(j.shoulderR, j.pelvis, r.torsoQ, -sx, sy, sz);
  r.angle.torso = 90;
  hips(r, P);
  for (const [s, side] of [[1, "L"], [-1, "R"]] as const) {
    const ankle = j[`ankle${side}`].set(s * 0.36, P.ankleH, 0.58);
    const dir = r.footDir[side].set(s * 0.3, 0, 1).normalize();
    j[`toe${side}`].copy(ankle).addScaledVector(dir, P.footLen * 0.62).setY(P.ankleH * 0.42);
    j[`heel${side}`].copy(ankle).addScaledVector(dir, -P.footLen * 0.2).setY(0.03);
    const pole = r.pole[`knee${side}`].set(s * 0.22, 1, 0.12).normalize();
    twoBone(j[`hip${side}`], ankle, P.thigh, P.shin, pole, j[`knee${side}`], _t);
  }
  r.angle.kneeL = 180 - angleAt(j.hipL, j.kneeL, j.ankleL);
  r.angle.kneeR = 180 - angleAt(j.hipR, j.kneeR, j.ankleR);
  // bar path: a J — over the lower chest at the bottom, over the shoulders at lockout
  const p = Math.min(1, Math.max(0, b.press));
  const chestTop = j.chest.y + 0.1;
  const lock = j.shoulderL.y + (P.upperArm + P.forearm) * 0.97 + 0.03;
  const y = chestTop + (lock - chestTop) * p;
  const z = j.chest.z + 0.06 + (j.shoulderL.z - (j.chest.z + 0.06)) * Math.pow(p, 0.7);
  const slip = Math.min(1, Math.max(0, b.slip ?? 0));
  _gL.set(0.42 + slip * 0.065, y - 0.04 - slip * 0.045, z);
  _gR.set(-0.42, y - 0.04, z);
  arms(r, P, _gL, _gR, _pL.set(0.9, -0.2, 0.3), _pR.set(-0.9, -0.2, 0.3), X);
  r.bar.on = true;
  r.bar.a.set(1.1, y - slip * 0.075, z); r.bar.b.set(-1.1, y + slip * 0.012, z);
  return r;
}
