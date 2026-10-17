"""Export the site's 3D lifters: Anny bodies (NAVER LABS Europe, Apache-2.0), dressed in real MakeHuman
assets (CC0): the UV-mapped skin texture, eyes, brows, lashes, hair and trainers, each fitted to each body.

    scripts/figure/.venv/bin/python scripts/figure/export_body.py

Needs the MakeHuman system asset pack (CC0) unpacked into scripts/figure/cache/mh-assets/sys:
https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html

Writes public/models/:
  figure.json           bone names/parents; per variant: rest (bind) bone matrices, measured proportions,
                        the surface vertices the sensor pods attach to, the buffer layout, material groups
                        and textures
  figure-<variant>.bin  one file per variant, little-endian, in this order:
                        index u16 · position i16×3 (quantised to the bbox) · uv u16×2 · normal i8×3 ·
                        skinIndex u8×4 · skinWeight u8×4 · seam i8×2 (garment structure, see `seams`)
and public/textures/figure/*.webp (skins, eyes, brows, lashes, hair, trainers).

Coordinates: Anny is MakeHuman ×0.1, Z up, facing −Y; three.js is Y up, facing +Z, the lifter's left on +X.
(x, y, z)anny → (x, z, −y)three, which is exactly MakeHuman's own axes ×0.1, so the proxies' (.mhclo)
offsets apply per axis unchanged. The bodies are lifted so the soles rest on y = 0.
"""
import json
import os
import sys

import numpy as np
import torch
from PIL import Image

os.environ.setdefault("ANNY_CACHE_DIR", os.path.join(os.path.dirname(__file__), "cache"))
import anny  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "models")
TEX = os.path.join(ROOT, "public", "textures", "figure")
MH = os.path.join(os.path.dirname(__file__), "cache", "mh-assets", "sys")
BODY_VERTS = 13380   # hm08: the body; helpers (eyes, lashes, tights, hair, …) follow

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
    "lifter": dict(phen=dict(gender=1.0, age=0.5, muscle=0.82, weight=0.5, height=0.66, proportions=0.85), local=ATHLETE_LOCAL,
                   dress=dict(skin="young_caucasian_male2", eyes="brown", brows="eyebrow009", lashes="eyelashes01", hair="short02", shoes="shoes06")),
    # "your body, not a textbook": same lift, different levers
    "long": dict(phen=dict(gender=1.0, age=0.5, muscle=0.78, weight=0.48, height=0.6, proportions=0.6),
                 local={**ATHLETE_LOCAL, "upperlegs-height-incr": 0.55, "lowerlegs-height-incr": 0.05},
                 dress=dict(skin="young_caucasian_male2", eyes="bluegreen", brows="eyebrow001", lashes="eyelashes01", hair="short04", shoes="shoes05")),
    "short": dict(phen=dict(gender=0.0, age=0.5, muscle=0.8, weight=0.52, height=0.52, proportions=0.75),
                  local={**ATHLETE_LOCAL, "upperlegs-height-incr": -0.45},
                  dress=dict(skin="young_asian_female", eyes="brown", brows="eyebrow010", lashes="eyelashes02", hair="ponytail01", shoes="shoes05")),
}
# material groups, in draw order (the site's body.ts builds one material per group)
GROUPS = ["suit", "skin", "eyes", "shoes", "hair", "brows", "lashes"]
PROXY_DIRS = {"eyes": "eyes/high-poly/high-poly", "brows": "eyebrows/{0}/{0}", "lashes": "eyelashes/{0}/{0}",
              "hair": "hair/{0}/{0}", "shoes": "clothes/{0}/{0}"}
# texture size per group, px (the head is ~1/3 of the skin atlas; 1024 is plenty at the site's framing)
TEX_SIZE = {"skin": 1024, "eyes": 256, "brows": 256, "lashes": 256, "hair": 1024, "shoes": 512}
SOCK_TOP = 0.06      # keep the trainers' sock this far above the ankle bone (m); the suit covers the rest

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


# ── MakeHuman file formats ──────────────────────────────────────────────────────────────

def _num(s):
    try:
        float(s)
        return True
    except ValueError:
        return False


def load_obj(path):
    """Positions, texture coordinates and faces as lists of (vertex, uv) corners."""
    V, T, F = [], [], []
    for line in open(path, encoding="utf-8", errors="ignore"):
        s = line.split()
        if not s:
            continue
        if s[0] == "v":
            V.append([float(x) for x in s[1:4]])
        elif s[0] == "vt":
            T.append([float(x) for x in s[1:3]])
        elif s[0] == "f":
            F.append([(int(c.split("/")[0]) - 1, int(c.split("/")[1]) - 1) for c in s[1:]])
    return np.array(V), np.array(T), F


def load_mhclo(path):
    """A proxy's fit to the base mesh: per vertex, three base vertices, barycentric weights and an offset
    scaled per axis by the distance between two reference vertices; plus base vertices it hides."""
    refs, wts, offs, scale, delete = [], [], [], {}, []
    state = None
    for line in open(path, encoding="utf-8", errors="ignore"):
        s = line.split()
        if not s or s[0].startswith("#") or s[0].startswith("//"):
            continue
        if s[0] == "verts":
            state = "verts"
            continue
        if s[0] == "delete_verts":
            state = "delete"
            continue
        if state == "verts" and _num(s[0]):
            if len(s) == 1:
                refs.append([int(s[0])] * 3); wts.append([1.0, 0, 0]); offs.append([0.0, 0, 0])
            else:
                refs.append([int(x) for x in s[:3]]); wts.append([float(x) for x in s[3:6]]); offs.append([float(x) for x in s[6:9]])
            continue
        if state == "delete" and _num(s[0]):
            delete.extend(s)
            continue
        if s[0] in ("x_scale", "y_scale", "z_scale"):
            scale["xyz".index(s[0][0])] = (int(s[1]), int(s[2]), float(s[3]))
    hidden = []
    i = 0
    while i < len(delete):
        if i + 2 < len(delete) and delete[i + 1] == "-":
            hidden.extend(range(int(delete[i]), int(delete[i + 2]) + 1)); i += 3
        else:
            hidden.append(int(delete[i])); i += 1
    return dict(refs=np.array(refs), wts=np.array(wts), offs=np.array(offs), scale=scale, hidden=np.array(hidden, dtype=np.int64))


def load_mhmat(path):
    out = {}
    for line in open(path, encoding="utf-8", errors="ignore"):
        s = line.split(None, 1)
        if len(s) == 2 and not s[0].startswith(("#", "//")):
            out.setdefault(s[0], s[1].strip())
    return out


def fit(clo, V):
    """Proxy vertex positions on a body (V: the full hm08 vertex set in three coordinates)."""
    P = (clo["wts"][:, :, None] * V[clo["refs"]]).sum(1)
    s = np.ones(3)
    for ax, (a, b, den) in clo["scale"].items():
        s[ax] = abs(V[a, ax] - V[b, ax]) / den
    return P + clo["offs"] * s


# ── mesh helpers ────────────────────────────────────────────────────────────────────────

def vertex_normals(P, tris):
    n = np.zeros_like(P)
    t = P[tris]
    fn = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    for k in range(3):
        np.add.at(n, tris[:, k], fn)
    return n / np.clip(np.linalg.norm(n, axis=1, keepdims=True), 1e-12, None)


def top4(dense):
    order = np.argsort(-dense, axis=1)[:, :4]
    w = np.take_along_axis(dense, order, 1)
    w = w / np.clip(w.sum(1, keepdims=True), 1e-9, None)
    q = np.floor(w * 255 + 0.5).astype(np.int32)
    q[:, 0] += 255 - q.sum(1)                          # exact sum 255 per vertex
    order[w == 0] = 0
    return order.astype(np.uint8), np.clip(q, 0, 255).astype(np.uint8)


def dense_weights(rows, wts, bi, bw, nb):
    """Blend base-vertex skin weights: rows (n×k) base vertex ids, wts (n×k) blend weights → (n×bones)."""
    n, k = rows.shape
    dense = np.zeros((n, nb))
    for c in range(k):
        idx = bi[rows[:, c]]
        w = bw[rows[:, c]] * np.clip(wts[:, c:c + 1], 0, None)
        np.add.at(dense, (np.repeat(np.arange(n), idx.shape[1]), idx.ravel()), w.ravel())
    return dense


def split_by_uv(tri_v, tri_t):
    """Vertices shared across a UV seam become one vertex per (position, uv) pair."""
    pairs = np.stack([tri_v.ravel(), tri_t.ravel()], 1)
    uniq, inv = np.unique(pairs, axis=0, return_inverse=True)
    return uniq[:, 0], uniq[:, 1], inv.reshape(-1, 3)


# ── textures ────────────────────────────────────────────────────────────────────────────

def save_tex(src, name, size, alpha=False, quality=84):
    os.makedirs(TEX, exist_ok=True)
    out = os.path.join(TEX, name + ".webp")
    im = Image.open(src)
    im = im.convert("RGBA" if alpha else "RGB")
    if max(im.size) > size:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(out, "WEBP", quality=quality, method=6, exact=False)
    return "/textures/figure/" + name + ".webp"


def dress_textures(name, kind, mat_path):
    """The proxy's textures (diffuse, optional normal), resized to the group's size, as WebP."""
    d = os.path.dirname(mat_path)
    mat = load_mhmat(mat_path)
    out = {}
    diffuse = mat.get("diffuseTexture")
    if diffuse:
        out["map"] = save_tex(os.path.join(d, diffuse), f"{kind}-{name}", TEX_SIZE[kind], alpha=kind in ("hair", "brows", "lashes"))
    normal = mat.get("normalmapTexture")
    if normal and os.path.exists(os.path.join(d, normal)):
        out["normalMap"] = save_tex(os.path.join(d, normal), f"{kind}-{name}-n", min(512, TEX_SIZE[kind]), quality=90)
    return out


def skin_texture(skin):
    d = os.path.join(MH, "skins", skin)
    mat = load_mhmat(os.path.join(d, skin + ".mhmat"))
    return {"map": save_tex(os.path.join(d, mat["diffuseTexture"]), f"skin-{skin}", TEX_SIZE["skin"], quality=86)}


# ── export ──────────────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUT, exist_ok=True)
    # "anny-full" keeps every hm08 vertex (helpers too), so MakeHuman proxies index straight into it
    model = anny.Anny(local_changes="default", topology="anny-full").to(dtype=torch.float64)
    labels = list(model.bone_labels)
    parents = [int(p) for p in (model.bone_parents.tolist() if hasattr(model.bone_parents, "tolist") else model.bone_parents)]
    nb = len(labels)
    faces = model.faces.cpu().numpy().astype(np.int64)
    ftex = model.face_texture_coordinate_indices.cpu().numpy().astype(np.int64)
    uvs = model.texture_coordinates.cpu().numpy()
    bi = model.vertex_bone_indices.cpu().numpy().astype(np.int64)
    bw = model.vertex_bone_weights.cpu().numpy()
    body_tris = (faces < BODY_VERTS).all(1)            # the body only: eyes and tongue come from proxies / are hidden
    faces, ftex = faces[body_tris], ftex[body_tris]

    def share(prefixes):
        m = np.array([any(l.startswith(p) for p in prefixes) for l in labels])
        return (bw * m[bi]).sum(1) / np.clip(bw.sum(1), 1e-9, None)

    meta = {
        "source": "Anny (NAVER LABS Europe, Apache-2.0) · MakeHuman system assets (CC0)",
        "bones": labels, "parents": parents, "groups": GROUPS, "variants": {},
    }
    eye = torch.eye(4, dtype=torch.float64)[None, None].repeat(1, model.bone_count, 1, 1)
    for name, spec in VARIANTS.items():
        local = {k: float(v) for k, v in spec["local"].items() if k in model.local_change_labels}
        out = model(pose_parameters=eye, phenotype_kwargs=spec["phen"], local_changes_kwargs=local)
        V = out["rest_vertices"][0].cpu().numpy()
        B = out["rest_bone_poses"][0].cpu().numpy()
        lift = -V[:BODY_VERTS, 2].min()                  # soles on the floor
        V3 = to_three_points(V, lift)
        Bw = np.stack([to_three_matrix(B[i], lift) for i in range(nb)])
        head = {l: Bw[i][:3, 3] for i, l in enumerate(labels)}
        dress = spec["dress"]

        # ── the body: normals on the whole surface, then split along UV seams
        N = vertex_normals(V3, faces)
        clos = {k: load_mhclo(os.path.join(MH, PROXY_DIRS[k].format(dress[k]) + ".mhclo")) for k in ("eyes", "brows", "lashes", "hair", "shoes")}
        # feet inside the trainers: the shoes' hidden vertices, up to just under the trimmed sock's top
        sock_top = max(head["foot.L"][1], head["foot.R"][1]) + SOCK_TOP
        hidden = np.zeros(len(V3), bool)
        hidden[clos["shoes"]["hidden"][clos["shoes"]["hidden"] < len(V3)]] = True
        hidden &= V3[:, 1] < sock_top - 0.012
        keep = ~hidden[faces].any(1)
        bf, bt = faces[keep], ftex[keep]
        orig, uv_i, tris = split_by_uv(bf, bt)
        # the suit ends in a clean mock-neck collar and two cuffs: cut the surface along those planes
        cutm = cut(V3[orig], N[orig], uvs[uv_i], orig, tris, skin_field(V3, head, share)[orig])
        seam = seams(cutm["P"], cutm["N"], waist_y(V3, share))
        si, sw = top4(dense_weights(cutm["A"], cutm["W"], bi, bw, nb))
        body = dict(P=cutm["P"], N=cutm["N"], UV=cutm["UV"], SI=si, SW=sw, S=seam)
        parts = []   # (group, vertex block, triangles)
        for g in (0, 1):
            parts.append((GROUPS[g], body, cutm["tris"][cutm["skin"] == bool(g)]))

        # ── the proxies, fitted to this body
        textures = {"skin": skin_texture(dress["skin"])}
        for kind in ("eyes", "shoes", "hair", "brows", "lashes"):
            clo = clos[kind]
            base = os.path.join(MH, PROXY_DIRS[kind].format(dress[kind]))
            OV, OT, OF = load_obj(base + ".obj")
            assert len(OV) == len(clo["refs"]), (kind, len(OV), len(clo["refs"]))
            P = fit(clo, V3)
            tv = np.array([[f[0][0], f[k][0], f[k + 1][0]] for f in OF for k in range(1, len(f) - 1)])
            tt = np.array([[f[0][1], f[k][1], f[k + 1][1]] for f in OF for k in range(1, len(f) - 1)])
            if kind == "shoes":
                # trim the sock: drop triangles entirely above the ankle bone + SOCK_TOP
                keep_t = (P[tv][:, :, 1] < sock_top).any(1)
                tv, tt = tv[keep_t], tt[keep_t]
            PN = vertex_normals(P, tv)
            o, u, t = split_by_uv(tv, tt)
            psi, psw = top4(dense_weights(clo["refs"][o], clo["wts"][o], bi, bw, nb))
            proxy = dict(P=P[o], N=PN[o], UV=OT[u], SI=psi, SW=psw, S=np.zeros((len(o), 2)))
            parts.append((kind, proxy, t))
            if kind == "eyes":
                mat = os.path.join(MH, "eyes", "materials", dress["eyes"] + ".mhmat")
                textures[kind] = dress_textures(dress["eyes"], kind, mat)
            else:
                textures[kind] = dress_textures(dress[kind], kind, base + ".mhmat")

        # ── one buffer: vertices of each part in turn, triangles sorted by group
        blocks, offset, index, groups = [], 0, [], []
        seen = {}
        for g, data, t in parts:
            key = id(data)
            if key not in seen:
                seen[key] = offset
                blocks.append(data)
                offset += len(data["P"])
            start = sum(len(x) for x in index) * 3
            index.append(t + seen[key])
            groups.append({"name": g, "start": int(start), "count": int(len(t) * 3)})
        P = np.concatenate([b["P"] for b in blocks]); NN = np.concatenate([b["N"] for b in blocks])
        UV = np.concatenate([b["UV"] for b in blocks]); SI = np.concatenate([b["SI"] for b in blocks])
        SW = np.concatenate([b["SW"] for b in blocks]); S = np.concatenate([b["S"] for b in blocks])
        I = np.concatenate(index)
        nv, nt = len(P), int(I.size)
        assert nv < 65536, nv
        lo, hi = P.min(0), P.max(0)
        q = np.round((P - lo) / (hi - lo) * 65534 - 32767).astype(np.int16)
        uvq = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)
        nq = np.clip(np.round(NN * 127), -127, 127).astype(np.int8)
        with open(os.path.join(OUT, f"figure-{name}.bin"), "wb") as f:
            f.write(I.astype(np.uint16).tobytes())
            f.write(q.tobytes()); f.write(uvq.tobytes()); f.write(nq.tobytes())
            f.write(SI.tobytes()); f.write(SW.tobytes())
            f.write(np.clip(np.round(S), -127, 127).astype(np.int8).tobytes())

        # the pods sit on body vertices: the first copy of each after the UV split
        first = np.full(len(V3), -1)
        first[orig[::-1]] = np.arange(len(orig))[::-1]
        meas = measure(head, V3[:BODY_VERTS])
        meta["variants"][name] = {
            "vertexCount": int(nv), "indexCount": nt,
            "bboxMin": lo.round(6).tolist(), "bboxMax": hi.round(6).tolist(),
            "bind": [round(float(x), 6) for M in Bw for x in M.T.reshape(-1)],   # column-major, like three's Matrix4.elements
            "measure": {k: (round(float(v), 4) if np.isscalar(v) else [round(float(x), 4) for x in v]) for k, v in meas.items()},
            "pods": {k: int(first[v]) for k, v in pods(head, V3, bf).items()},
            "groups": groups, "textures": textures,
        }
        print(f"{name:6s} height {V3[:BODY_VERTS, 1].max():.3f} m  verts {nv}  tris {nt // 3}  "
              + "  ".join(f"{g['name']} {g['count'] // 3}" for g in groups))
    with open(os.path.join(OUT, "figure.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    for fn in sorted(os.listdir(OUT)):
        print(f"  {fn:22s} {os.path.getsize(os.path.join(OUT, fn)) // 1024:5d} KB")
    for fn in sorted(os.listdir(TEX)):
        print(f"  textures/figure/{fn:28s} {os.path.getsize(os.path.join(TEX, fn)) // 1024:5d} KB")


def waist_y(V, share):
    pel = share(["pelvis", "root"]) > 0.6
    pel[BODY_VERTS:] = False
    return (float(np.median(V[pel][:, 1])) if pel.any() else 0.95) + 0.035


def seams(P, N, waist):
    """Garment structure for the suit shader, per vertex:
       x  rest normal's front/back component (×127): zero exactly on the side seams of the torso, the in/out
          seams of the legs and the underarm seams, so the shader draws them as iso-lines
       y  signed height above the waistband (cm), for the one horizontal seam."""
    x = np.clip(np.round(N[:, 2] * 127), -127, 127)
    y = np.clip(np.round((P[:, 1] - waist) * 100), -127, 127)
    return np.stack([x, y], 1)


def skin_field(V, head, share):
    """Signed distance (m), positive on bare skin: above a collar plane at mid-neck (a little lower at the
    front, like a mock neck) and past a cuff plane at each wrist."""
    neck, top = head["neck01"], head["head"]
    c = neck + 0.42 * (top - neck)
    n = np.array([0.0, 1.0, 0.3]); n /= np.linalg.norm(n)
    f = (V - c) @ n
    arm = share(["lowerarm", "wrist", "finger", "metacarpal"]) > 0.3
    for s in "LR":
        e, w = head[f"lowerarm01.{s}"], head[f"wrist.{s}"]
        d = (w - e) / np.linalg.norm(w - e)
        fs = (V - (w - 0.012 * d)) @ d
        near = (np.linalg.norm(V - w, axis=1) < 0.3) & arm
        f = np.maximum(f, np.where(near, fs, -1.0))
    return f


def cut(P, N, UV, orig, tris, f):
    """Split every triangle the boundary f = 0 crosses, so the suit/skin edge is a smooth line, not a
    zig-zag of whole triangles. New vertices interpolate position, normal, UV and skin weights."""
    f = np.where(np.abs(f) < 1e-7, -1e-7, f)
    P, N, UV, F = list(P), list(N), list(UV), list(f)
    A = [[int(o), int(o)] for o in orig]
    W = [[1.0, 0.0] for _ in orig]
    cache = {}
    def mid(i, j):
        key = (min(i, j), max(i, j))
        if key not in cache:
            t = F[i] / (F[i] - F[j])
            P.append(P[i] + t * (P[j] - P[i]))
            n = N[i] + t * (N[j] - N[i]); N.append(n / max(np.linalg.norm(n), 1e-9))
            UV.append(UV[i] + t * (UV[j] - UV[i]))
            F.append(0.0)
            A.append([A[i][0], A[j][0]]); W.append([1 - t, t])
            cache[key] = len(P) - 1
        return cache[key]
    out, skin = [], []
    for a, b, c in tris:
        s = [F[a] > 0, F[b] > 0, F[c] > 0]
        if all(s) or not any(s):
            out.append((a, b, c)); skin.append(s[0]); continue
        tri = [a, b, c]
        k = next(i for i in range(3) if s[i] != s[(i + 1) % 3] and s[i] != s[(i + 2) % 3])
        a, b, c = tri[k], tri[(k + 1) % 3], tri[(k + 2) % 3]
        lone = F[a] > 0
        ab, ac = mid(a, b), mid(a, c)
        out += [(a, ab, ac), (ab, b, c), (ab, c, ac)]
        skin += [lone, not lone, not lone]
    return dict(P=np.array(P), N=np.array(N), UV=np.array(UV), A=np.array(A), W=np.array(W),
                tris=np.array(out), skin=np.array(skin))


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
    """Surface vertex for each sensor pod: the body vertex near the joint furthest along a chosen direction."""
    on_body = np.zeros(len(V), bool)
    on_body[np.unique(faces)] = True
    def pick(center, direction, radius):
        d = np.asarray(direction, float); d /= np.linalg.norm(d)
        rel = V - center
        near = np.where((np.linalg.norm(rel, axis=1) < radius) & on_body)[0]
        return int(near[np.argmax(rel[near] @ d)])
    out = {}
    for s, x in (("L", 1), ("R", -1)):
        out[f"shoulder{s}"] = pick(h[f"upperarm01.{s}"], [x * 0.7, 0.7, 0.1], 0.12)
        out[f"elbow{s}"] = pick(h[f"lowerarm01.{s}"], [x * 0.3, 0, -1], 0.08)        # point of the elbow (back)
        out[f"wrist{s}"] = pick(h[f"wrist.{s}"], [x * 0.4, 0.3, -0.8], 0.06)         # back of the wrist
        out[f"hip{s}"] = pick(h[f"upperleg01.{s}"], [x, 0.1, 0], 0.16)                # side of the hip
        out[f"knee{s}"] = pick(h[f"lowerleg01.{s}"], [0, 0, 1], 0.09)                  # on the kneecap
        out[f"ankle{s}"] = pick(h[f"foot.{s}"] + np.array([0, 0.07, 0]), [x, 0.2, 0], 0.07)   # outside, just above the trainer
    out["tspine"] = pick(h["spine01"], [0, -0.1, -1], 0.16)
    out["lspine"] = pick(h["spine04"], [0, 0, -1], 0.16)
    return out


if __name__ == "__main__":
    sys.exit(main())
