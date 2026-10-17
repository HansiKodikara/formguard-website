/**
 * The data layer drawn over the body, like a motion-capture overlay: skeleton lines between joint
 * centres, joint markers, the bar path traced through the air, and the buzz ripple at a flagged joint.
 * Rendered without depth testing so it reads through the suit, as an instrument would show it.
 */
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { Joint, Rig } from "./rig";

export const BONES: [Joint, Joint][] = [
  ["pelvis", "lumbar"], ["lumbar", "chest"], ["chest", "neck"], ["neck", "head"],
  ["shoulderL", "shoulderR"], ["hipL", "hipR"],
  ["shoulderL", "elbowL"], ["elbowL", "wristL"], ["shoulderR", "elbowR"], ["elbowR", "wristR"],
  ["hipL", "kneeL"], ["kneeL", "ankleL"], ["hipR", "kneeR"], ["kneeR", "ankleR"],
  ["ankleL", "toeL"], ["ankleR", "toeR"],
];
export const MARKERS: Joint[] = ["chest", "pelvis", "shoulderL", "shoulderR", "elbowL", "elbowR", "wristL", "wristR", "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR"];

// RED is signal-ink on dark; in range (GREEN) stays neutral Chalk: the design system has no green.
const CHALK = new THREE.Color("#f2ede4"), RED = new THREE.Color("#ec6157"), GREEN = CHALK.clone(), GREY = new THREE.Color("#6f6a60");

export class Skeleton {
  readonly group = new THREE.Group();
  private lines: LineSegments2;
  private geo: LineSegmentsGeometry;
  private mat: LineMaterial;
  private dots: THREE.InstancedMesh;
  private pos = new Float32Array(BONES.length * 6);
  private col = new Float32Array(BONES.length * 6);
  opacity = 0;
  /** joints drawn in red / green / grey (blind spot) */
  flag = new Set<Joint>();
  good = new Set<Joint>();
  hidden = new Set<Joint>();

  private base: THREE.Color;
  private _m = new THREE.Matrix4();
  private _s = new THREE.Vector3();

  constructor(lineWidth = 1.6, light = false) {
    this.base = new THREE.Color(light ? "#1b1a17" : "#f2ede4");
    this.geo = new LineSegmentsGeometry();
    this.mat = new LineMaterial({ linewidth: lineWidth, vertexColors: true, transparent: true, depthTest: false, depthWrite: false, worldUnits: false });
    this.lines = new LineSegments2(this.geo, this.mat);
    this.lines.renderOrder = 10;
    this.lines.frustumCulled = false;
    const dot = new THREE.CircleGeometry(1, 20);
    this.dots = new THREE.InstancedMesh(dot, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, vertexColors: false }), MARKERS.length);
    this.dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MARKERS.length * 3), 3);
    this.dots.renderOrder = 11;
    this.dots.frustumCulled = false;
    this.group.add(this.lines, this.dots);
  }

  private colorOf(a: Joint, b?: Joint) {
    if (this.flag.has(a) && (!b || this.flag.has(b))) return RED;
    if (this.good.has(a) && (!b || this.good.has(b))) return GREEN;
    if (this.hidden.has(a) || (b && this.hidden.has(b))) return GREY;
    return this.base;
  }

  update(r: Rig, camera: THREE.Camera, viewport: { width: number; height: number }) {
    this.group.visible = this.opacity > 0.002;
    if (!this.group.visible) return;
    BONES.forEach(([a, b], i) => {
      r.j[a].toArray(this.pos, i * 6);
      r.j[b].toArray(this.pos, i * 6 + 3);
      const c = this.colorOf(a, b);
      c.toArray(this.col, i * 6); c.toArray(this.col, i * 6 + 3);
    });
    this.geo.setPositions(this.pos);
    this.geo.setColors(this.col);
    this.mat.opacity = this.opacity * 0.85;
    this.mat.resolution.set(viewport.width, viewport.height);
    const m = this._m, q = camera.quaternion, s = this._s;
    MARKERS.forEach((j, i) => {
      const flagged = this.flag.has(j), good = this.good.has(j);
      const size = (flagged || good ? 0.022 : 0.012) * (j === "head" ? 1.6 : 1);
      s.setScalar(size);
      m.compose(r.j[j], q, s);
      this.dots.setMatrixAt(i, m);
      this.dots.setColorAt(i, this.colorOf(j));
    });
    this.dots.instanceMatrix.needsUpdate = true;
    this.dots.instanceColor!.needsUpdate = true;
    (this.dots.material as THREE.MeshBasicMaterial).opacity = this.opacity;
  }
}

/** The bar's path through the air: a fading trail of the left sleeve's end, as bar-path apps draw it. */
export class BarTrace {
  readonly line: Line2;
  private geo = new LineGeometry();
  private mat: LineMaterial;
  private pts: THREE.Vector3[] = [];
  opacity = 0;
  constructor(color = "#f2ede4", max = 140) {
    this.mat = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: 2, transparent: true, depthTest: false, worldUnits: false, dashed: false });
    this.line = new Line2(this.geo, this.mat);
    this.line.renderOrder = 9;
    this.line.frustumCulled = false;
    this.max = max;
  }
  private max: number;
  push(p: THREE.Vector3) {
    const last = this.pts[this.pts.length - 1];
    if (last && last.distanceToSquared(p) < 1e-6) return;
    this.pts.push(p.clone());
    if (this.pts.length > this.max) this.pts.shift();
  }
  clear() { this.pts.length = 0; }
  update(viewport: { width: number; height: number }) {
    this.line.visible = this.opacity > 0.002 && this.pts.length > 2;
    if (!this.line.visible) return;
    this.geo.setPositions(this.pts.flatMap((p) => [p.x, p.y, p.z]));
    this.mat.opacity = this.opacity;
    this.mat.resolution.set(viewport.width, viewport.height);
  }
}

/** The buzz: rings pulsing out from a joint, facing the camera. */
export class Ripple {
  readonly group = new THREE.Group();
  private rings: THREE.Mesh[] = [];
  at = new THREE.Vector3();
  strength = 0;  // 0..1, how active the buzz is
  constructor(color = "#ec6157") {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
      m.renderOrder = 12;
      this.rings.push(m);
      this.group.add(m);
    }
  }
  update(t: number, camera: THREE.Camera) {
    this.group.visible = this.strength > 0.002;
    if (!this.group.visible) return;
    this.rings.forEach((m, i) => {
      const k = ((t * 1.6 + i / 3) % 1);
      m.position.copy(this.at);
      m.quaternion.copy(camera.quaternion);
      m.scale.setScalar(0.03 + k * 0.17);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) ** 1.6 * this.strength;
    });
  }
}

export { CHALK as OVERLAY_CHALK, RED as OVERLAY_RED, GREEN as OVERLAY_GREEN, GREY as OVERLAY_GREY };
