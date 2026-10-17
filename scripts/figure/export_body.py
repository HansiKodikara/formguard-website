"""Export Anny (NAVER, Apache-2.0; MakeHuman assets CC0) bodies for the site's 3D lifter.

    scripts/figure/.venv/bin/python scripts/figure/export_body.py

Writes public/models/:
  body-topology.bin  shared by every variant: triangle indices (u16) + 4 skin indices (u8) + 4 skin weights (u8)
  body-<variant>.bin per variant: vertex positions quantised to int16 against the variant's bounding box
  body.json          bone names/parents, per-variant rest (bind) bone matrices, measured proportions,
                     key joints and the surface vertices the sensor pods attach to.

Coordinates are converted from Anny (Z up, facing −Y) to three.js (Y up, facing +Z, the lifter's
left on +X) by (x, y, z) → (x, z, −y), then lifted so the soles rest on y = 0.
"""
import json
import os
import sys

import numpy as np
import torch

os.environ.setdefault("ANNY_CACHE_DIR", os.path.join(os.path.dirname(__file__), "cache"))
import anny  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "models")

# Phenotypes are in [0, 1]; local changes in [-1, 1] (MakeHuman targets).
ATHLETE_LOCAL = {
    "l-upperleg-muscle-incr": 0.5, "r-upperleg-muscle-incr": 0.5,
    "l-lowerleg-muscle-incr": 0.45, "r-lowerleg-muscle-incr": 0.45,
    "l-upperarm-muscle-incr": 0.35, "r-upperarm-muscle-incr": 0.35,
    "l-upperarm-shoulder-muscle-incr": 0.45, "r-upperarm-shoulder-muscle-incr": 0.45,
    "l-lowerarm-muscle-incr": 0.3, "r-lowerarm-muscle-incr": 0.3,
}
VARIANTS = {
    # the main lifter: an athletic adult man, 1.75 m
    "lifter": dict(phen=dict(gender=1.0, age=0.5, muscle=0.82, weight=0.5, height=0.66, proportions=0.85), local=ATHLETE_LOCAL),
    # "your body, not a textbook": same lift, different levers
    "long": dict(phen=dict(gender=1.0, age=0.5, muscle=0.78, weight=0.48, height=0.6, proportions=0.6),
                 local={**ATHLETE_LOCAL, "upperlegs-height-incr": 0.55, "lowerlegs-height-incr": 0.05}),
    "short": dict(phen=dict(gender=0.0, age=0.5, muscle=0.8, weight=0.52, height=0.52, proportions=0.75),
                  local={**ATHLETE_LOCAL, "upperlegs-height-incr": -0.45}),
}

C = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=np.float64)   # Anny → three (proper rotation)


def to_three_points(p, lift):
    q = p @ C.T
    q[:, 1] += lift
    return q


def to_three_matrix(M, lift):
    """World 4×4 (Anny) → world 4×4 (three): R' = C R Cᵀ, t' = C t + lift."""
    out = np.eye(4)
    out[:3, :3] = C @ M[:3, :3] @ C.T
    out[:3, 3] = C @ M[:3, 3]
    out[1, 3] += lift
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    model = anny.Anny(local_changes="default").to(dtype=torch.float64)
    labels = list(model.bone_labels)
    parents = [int(p) for p in (model.bone_parents.tolist() if hasattr(model.bone_parents, "tolist") else model.bone_parents)]
    faces = model.faces.cpu().numpy().astype(np.int64)
    nv = int(model.vertex_bone_indices.shape[0])
    assert faces.max() < 65536 and nv < 65536

    # ── shared topology: triangles + top-4 skin weights ────────────────────────────────
    bi = model.vertex_bone_indices.cpu().numpy()
    bw = model.vertex_bone_weights.cpu().numpy()
    order = np.argsort(-bw, axis=1)[:, :4]
    idx4 = np.take_along_axis(bi, order, 1)
    w4 = np.take_along_axis(bw, order, 1)
    w4 = w4 / np.clip(w4.sum(1, keepdims=True), 1e-9, None)
    wq = np.floor(w4 * 255 + 0.5).astype(np.int32)
    wq[:, 0] += 255 - wq.sum(1)                       # exact sum 255 per vertex
    idx4[w4 == 0] = 0
    lost = 1 - np.take_along_axis(bw, order, 1).sum(1) / np.clip(bw.sum(1), 1e-9, None)
    with open(os.path.join(OUT, "body-topology.bin"), "wb") as f:
        f.write(faces.astype(np.uint16).tobytes())
        f.write(idx4.astype(np.uint8).tobytes())
        f.write(np.clip(wq, 0, 255).astype(np.uint8).tobytes())

    meta = {
        "source": "Anny (NAVER LABS Europe, Apache-2.0) · MakeHuman assets via MPFB2 (CC0)",
        "vertexCount": nv, "triangleCount": int(faces.shape[0]),
        "bones": labels, "parents": parents, "variants": {},
    }
    eye = torch.eye(4, dtype=torch.float64)[None, None].repeat(1, model.bone_count, 1, 1)
    for name, spec in VARIANTS.items():
        local = {k: float(v) for k, v in spec["local"].items() if k in model.local_change_labels}
        out = model(pose_parameters=eye, phenotype_kwargs=spec["phen"], local_changes_kwargs=local)
        V = out["rest_vertices"][0].cpu().numpy()
        B = out["rest_bone_poses"][0].cpu().numpy()
        lift = -V[:, 2].min()                           # soles on the floor
        V3 = to_three_points(V, lift)
        Bw = np.stack([to_three_matrix(B[i], lift) for i in range(len(labels))])
        lo, hi = V3.min(0), V3.max(0)
        q = np.round((V3 - lo) / (hi - lo) * 65534 - 32767).astype(np.int16)
        with open(os.path.join(OUT, f"body-{name}.bin"), "wb") as f:
            f.write(q.tobytes())
        head = {l: Bw[i][:3, 3] for i, l in enumerate(labels)}
        meas = measure(head, V3)
        meta["variants"][name] = {
            "bboxMin": lo.round(6).tolist(), "bboxMax": hi.round(6).tolist(),
            "bind": [round(float(x), 6) for M in Bw for x in M.T.reshape(-1)],   # column-major, like three's Matrix4.elements
            "measure": {k: (round(float(v), 4) if np.isscalar(v) else [round(float(x), 4) for x in v]) for k, v in meas.items()},
            "pods": pods(head, V3, faces),
        }
        print(f"{name:6s} height {V3[:, 1].max():.3f} m  thigh {meas['thigh']:.3f}  shin {meas['shin']:.3f}  "
              f"upperArm {meas['upperArm']:.3f}  forearm {meas['forearm']:.3f}  torso→shoulder {meas['shoulderUp']:.3f}")
    write_attrs(model, labels, faces, os.path.join(OUT, "body-attrs.bin"), meta)
    with open(os.path.join(OUT, "body.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    sizes = {fn: os.path.getsize(os.path.join(OUT, fn)) // 1024 for fn in os.listdir(OUT)}
    print("weights beyond the top 4: mean", f"{lost.mean() * 100:.2f}%", "max", f"{lost.max() * 100:.1f}%")
    print("files (KB):", sizes)


def write_attrs(model, labels, faces, path, meta):
    """Garment structure, per vertex, from the main lifter's rest pose:
       region   0 suit · 1 bare skin (head, upper neck, hands) · 2 shoe (feet)
       seamX    rest normal's front/back component (×127): zero exactly on the side seams of the torso,
                the in/out seams of the legs and the underarm seams, so the shader draws them as an iso-line
       seamY    signed height above the waistband (cm), for the one horizontal seam."""
    eye = torch.eye(4, dtype=torch.float64)[None, None].repeat(1, model.bone_count, 1, 1)
    spec = VARIANTS["lifter"]
    local = {k: float(v) for k, v in spec["local"].items() if k in model.local_change_labels}
    out = model(pose_parameters=eye, phenotype_kwargs=spec["phen"], local_changes_kwargs=local)
    V = out["rest_vertices"][0].cpu().numpy()
    lift = -V[:, 2].min()
    V3 = to_three_points(V, lift)
    # vertex normals (area-weighted)
    n = np.zeros_like(V3)
    tri = V3[faces]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    for k in range(3):
        np.add.at(n, faces[:, k], fn)
    n /= np.clip(np.linalg.norm(n, axis=1, keepdims=True), 1e-12, None)
    bi = model.vertex_bone_indices.cpu().numpy()
    bw = model.vertex_bone_weights.cpu().numpy()
    def share(prefixes):
        m = np.array([any(l.startswith(p) for p in prefixes) for l in labels])
        return (bw * m[bi]).sum(1) / np.clip(bw.sum(1), 1e-9, None)
    skin = np.maximum(share(["head", "eye", "neck03"]), share(["wrist", "finger", "metacarpal"]))
    shoe = share(["foot", "toe"])
    region = np.where(shoe > 0.5, 2, np.where(skin > 0.5, 1, 0)).astype(np.uint8)
    seam_x = np.clip(np.round(n[:, 2] * 127), -127, 127).astype(np.int8)
    pelvis_y = float(np.median(V3[share(["pelvis", "root"]) > 0.6][:, 1])) if (share(["pelvis", "root"]) > 0.6).any() else 0.95
    seam_y = np.clip(np.round((V3[:, 1] - (pelvis_y + 0.035)) * 100), -127, 127).astype(np.int8)
    with open(path, "wb") as f:
        f.write(region.tobytes()); f.write(seam_x.tobytes()); f.write(seam_y.tobytes())
    meta["attrs"] = {"regions": ["suit", "skin", "shoe"], "counts": [int((region == k).sum()) for k in range(3)], "waistY": round(pelvis_y + 0.035, 4)}
    print("regions (suit, skin, shoe):", meta["attrs"]["counts"], "waistband y", meta["attrs"]["waistY"])


def measure(h, V):
    L = lambda a, b: float(np.linalg.norm(h[a] - h[b]))
    pelvis = h["root"]
    return {
        "height": float(V[:, 1].max()),
        "thigh": L("upperleg01.L", "lowerleg01.L"), "shin": L("lowerleg01.L", "foot.L"),
        "upperArm": L("upperarm01.L", "lowerarm01.L"), "forearm": L("lowerarm01.L", "wrist.L"),
        "hand": L("wrist.L", "finger3-3.L"), "footLen": L("foot.L", "toe3-1.L") * 1.3,
        "ankleH": float(h["foot.L"][1]),
        "pelvis": pelvis, "hipL": h["upperleg01.L"] - pelvis, "shoulderL": h["upperarm01.L"] - pelvis,
        "neck": h["neck01"] - pelvis, "head": h["head"] - pelvis, "chest": h["spine01"] - pelvis, "lumbar": h["spine03"] - pelvis,
        "shoulderUp": float(h["upperarm01.L"][1] - pelvis[1]),
    }


def pods(h, V, faces):
    """Surface vertex for each sensor pod: the vertex near the joint furthest along a chosen direction."""
    def pick(center, direction, radius):
        d = np.asarray(direction, float); d /= np.linalg.norm(d)
        rel = V - center
        near = np.where(np.linalg.norm(rel, axis=1) < radius)[0]
        return int(near[np.argmax(rel[near] @ d)])
    out = {}
    for s, x in (("L", 1), ("R", -1)):
        out[f"shoulder{s}"] = pick(h[f"upperarm01.{s}"], [x * 0.7, 0.7, 0.1], 0.12)
        out[f"elbow{s}"] = pick(h[f"lowerarm01.{s}"], [x * 0.3, 0, -1], 0.08)        # point of the elbow (back)
        out[f"wrist{s}"] = pick(h[f"wrist.{s}"], [x * 0.4, 0.3, -0.8], 0.06)         # back of the wrist
        out[f"hip{s}"] = pick(h[f"upperleg01.{s}"], [x, 0.1, 0], 0.16)                # side of the hip
        out[f"knee{s}"] = pick(h[f"lowerleg01.{s}"], [0, 0, 1], 0.09)                  # on the kneecap
        out[f"ankle{s}"] = pick(h[f"foot.{s}"], [x, 0.2, 0], 0.07)                     # outside ankle
    out["tspine"] = pick(h["spine01"], [0, -0.1, -1], 0.16)
    out["lspine"] = pick(h["spine04"], [0, 0, -1], 0.16)
    return out


if __name__ == "__main__":
    sys.exit(main())
