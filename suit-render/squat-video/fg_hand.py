"""Hands for the squat: a full finger skeleton (four fingers and the thumb, three bones each) placed on joint centres
measured from Body_Form's own hands, weights by distance to each bone, and a grip solved against the bar: every joint
curls, base to tip, until its bone meets the bar. Replaces fg_rig.py's one-piece 'power grip' fingers (finger1-3,
thumb1-2), which curled all four fingers as a block and left them floating over the bar.

    hand_rig(rig, body)     after rig_body(): swap the finger bones and re-weight the hands
    grip(rig, bar)          after the hands are on the bar (frame 1): curl the fingers and thumb round it
"""
import bpy, math, numpy as np
from mathutils import Vector, Matrix

FINGERS = ('index', 'middle', 'ring', 'pinky')
OLD = ('finger1', 'finger2', 'finger3', 'thumb1', 'thumb2')
# from the knuckle (MCP) to the fingertip: where the two finger joints sit (share of the length)
PIP, DIP = 0.46, 0.73
MCP_BACK = {'index': 0.021, 'middle': 0.022, 'ring': 0.021, 'pinky': 0.017}   # knuckle behind the finger web (m)
THUMB_CMC = Vector((0.399, -0.100, 0.912))                                   # base of the thumb (left)
THUMB_SPLIT = (0.44, 0.75)                                                    # MCP, IP along CMC -> tip
# bone radii (skin surface from the bone line), for the contact test
RAD = {'f': (0.0095, 0.0085, 0.0075), 't': (0.0115, 0.0105, 0.0090)}
MAX = {'f': (88, 100, 70), 't': (40, 55, 70)}


def _hand_points(V, s):
    W = np.array((0.401 * s, -0.075, 0.930)); K = np.array((0.452 * s, -0.120, 0.838))
    F = (K - W) / np.linalg.norm(K - W)
    m = (V[:, 0] * s > 0.36) & (V[:, 2] < 0.95) & (((V - W) @ F) > -0.02)
    return np.where(m)[0], W


def measure(body):
    """Joint chains for the left hand, in body (= rig rest) space: {name: [head, j1, j2, tip]}."""
    V = np.array([v.co[:] for v in body.data.vertices])
    idx, W = _hand_points(V, 1)
    H = V[idx]
    c = H.mean(0); _, _, Vt = np.linalg.svd(H - c, full_matrices=False)
    D, L = Vt[0], Vt[1]
    if D @ (np.array((0.452, -0.120, 0.838)) - W) < 0: D = -D
    s = (H - c) @ D; u = (H - c) @ L
    if L[1] > 0: u, L = -u, -L                   # u grows towards the index finger (the front, -Y)
    m = s > 0.012
    uu = u[m]; P = H[m]
    cent = np.percentile(uu, [90, 62, 35, 8])  # index, middle, ring, pinky
    for _ in range(40):
        lab = np.argmin(np.abs(uu[:, None] - cent[None]), 1)
        cent = np.array([uu[lab == k].mean() for k in range(4)])
    chains = {}
    for k, name in enumerate(FINGERS):
        Q = P[lab == k]; sq = (Q - c) @ D
        cs = [Q[(sq >= a) & (sq < a + 0.012)].mean(0) for a in np.arange(0.012, sq.max() - 0.006, 0.012)
              if ((sq >= a) & (sq < a + 0.012)).sum() > 5]
        cs = np.array(cs)
        d = cs[-1] - cs[0]; d /= np.linalg.norm(d)
        tip = Q[np.argmax(sq)]
        tip = cs[0] + d * ((tip - cs[0]) @ d - 0.004)
        mcp = cs[0] - d * MCP_BACK[name]
        chains[name] = [mcp, mcp + (tip - mcp) * PIP, mcp + (tip - mcp) * DIP, tip]
    # thumb: the hand's points nearest the old thumb segments' far side, tip = farthest from the CMC
    cmc = np.array(THUMB_CMC)
    th = (s < 0.0) & (s > -0.08) & (u > 0.03)
    T = H[th]
    tip = T[np.argmax(np.linalg.norm(T - cmc, axis=1))]
    tdir = (tip - cmc) / np.linalg.norm(tip - cmc)
    tip = tip - tdir * 0.004
    a, b = THUMB_SPLIT
    chains['thumb'] = [cmc, cmc + (tip - cmc) * a, cmc + (tip - cmc) * b, tip]
    return chains


def _mx(p, s):
    return Vector((p[0] * s, p[1], p[2]))


def hand_rig(rig, body):
    chains = measure(body)
    vl = bpy.context.view_layer
    with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[rig], view_layer=vl):
        vl.objects.active = rig
        bpy.ops.object.mode_set(mode='EDIT')
        eb = rig.data.edit_bones
        for side in ('L', 'R'):
            for n in OLD:
                b = eb.get(f'{n}.{side}')
                if b: eb.remove(b)
        for side, s in (('L', 1), ('R', -1)):
            for name, pts in chains.items():
                parent = eb[f'hand.{side}']
                for i in range(3):
                    b = eb.new(f'{name}{i + 1}.{side}')
                    b.head, b.tail = _mx(pts[i], s), _mx(pts[i + 1], s)
                    b.parent = parent; b.use_connect = i > 0
                    b.align_roll((0, -1, 0))
                    parent = b
        bpy.ops.object.mode_set(mode='OBJECT')
    for n in OLD:
        for side in ('L', 'R'):
            g = body.vertex_groups.get(f'{n}.{side}')
            if g: body.vertex_groups.remove(g)
    _weights(body, chains)
    print('[hand] chains (L):', {k: [tuple(round(float(x), 3) for x in p) for p in v] for k, v in chains.items()})
    return chains


def _seg_dist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)


def _weights(body, chains):
    """Each hand vertex is shared by its two nearest bones, by distance; the palm (hand bone) is the four
    metacarpals, wrist to knuckle; the wrist blends into the forearm."""
    V = np.array([v.co[:] for v in body.data.vertices])
    for side, s in (('L', 1), ('R', -1)):
        idx, W = _hand_points(V, s)
        idx = idx[V[idx, 0] * s > 0.33]
        P = V[idx]
        bones, dist = [], []
        for name, pts in chains.items():
            pts = [np.array(_mx(p, s)) for p in pts]
            if name == 'thumb':
                bones.append(f'hand.{side}'); dist.append(_seg_dist(P, W, pts[0]))
            else:
                bones.append(f'hand.{side}'); dist.append(_seg_dist(P, W, pts[0]))
            for i in range(3):
                bones.append(f'{name}{i + 1}.{side}'); dist.append(_seg_dist(P, pts[i], pts[i + 1]))
        dist = np.array(dist)                                   # bones x verts
        # several 'hand' rows: keep the nearest metacarpal only
        names = np.array(bones)
        uniq = list(dict.fromkeys(bones))
        Dm = np.array([dist[names == n].min(0) for n in uniq])
        order = np.argsort(Dm, 0)
        d0 = np.take_along_axis(Dm, order[:1], 0)[0]; d1 = np.take_along_axis(Dm, order[1:2], 0)[0]
        # the nearest bone takes it all until the second is within 6 mm of as near; then they share
        t = np.clip((d1 - d0) / 0.006, 0, 1)
        w1 = 0.5 + 0.5 * t
        Wt = {n: np.zeros(len(P)) for n in uniq + [f'forearm.{side}']}
        for j, n in enumerate(uniq):
            Wt[n] += np.where(order[0] == j, w1, 0) + np.where(order[1] == j, 1 - w1, 0)
        # wrist: blend the palm into the forearm
        K = np.array(_mx(chains['middle'][0], s)); F = (K - W) / np.linalg.norm(K - W)
        fw = 1 - np.clip(((P - W) @ F + 0.01) / 0.03, 0, 1); fw = fw * fw * (3 - 2 * fw)
        Wt[f'forearm.{side}'] = Wt[f'hand.{side}'] * fw
        Wt[f'hand.{side}'] = Wt[f'hand.{side}'] * (1 - fw)
        for g in body.vertex_groups:
            g.remove(list(map(int, idx)))
        for gname, w in Wt.items():
            vg = body.vertex_groups.get(gname) or body.vertex_groups.new(name=gname)
            for i, wi in zip(idx, w):
                if wi > 1e-4: vg.add([int(i)], float(wi), 'REPLACE')


def _rot(axis, th):
    a = axis / np.linalg.norm(axis); x, y, z = a; c, s = math.cos(th), math.sin(th); C = 1 - c
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def grip(rig, bar, bar_r):
    """Curl each finger and thumb, base to tip, until each bone meets the bar (the hand is fixed to the bar, so this
    is solved once, in the rest frame, and holds for every frame)."""
    bpy.context.view_layer.update()
    pb = rig.pose.bones
    Rw = rig.matrix_world.inverted()
    out = {}
    for side in ('L', 'R'):
        hb = pb[f'hand.{side}']
        T = (hb.matrix @ hb.bone.matrix_local.inverted()).inverted()           # pose -> rest, for the hand
        bw = bar.matrix_world
        p0 = T @ (Rw @ bw.translation); p1 = T @ (Rw @ (bw @ Vector((1, 0, 0))))
        A = np.array(p0); Ad = np.array(p1 - p0); Ad /= np.linalg.norm(Ad)
        def bar_d(P):
            q = P - A; return np.linalg.norm(q - np.outer(q @ Ad, Ad), axis=1)
        for name in FINGERS + ('thumb',):
            kind = 't' if name == 'thumb' else 'f'
            bones = [pb[f'{name}{i + 1}.{side}'] for i in range(3)]
            heads = [np.array(b.bone.head_local) for b in bones] + [np.array(bones[2].bone.tail_local)]
            pts = [h.copy() for h in heads]
            angs = []; Rc = np.eye(3)                                           # rotation so far, base to here
            for i in range(3):
                h = pts[i]; dvec = pts[i + 1] - h
                # rotate towards the bar: axis = bone x (bar-ward, square to the bone)
                q = h - A; near = A + Ad * (q @ Ad)
                tob = near - h; tob -= dvec * (tob @ dvec) / (dvec @ dvec)
                ax = np.cross(dvec, tob)
                if kind == 'f' and i > 0: ax = out_ax                          # one flexion axis per finger
                if i == 0: out_ax = ax
                best = 0.0
                for deg in np.arange(0, MAX[kind][i] + 0.1, 1.0):
                    R = _rot(ax, math.radians(deg))
                    seg = h + np.outer(np.linspace(0.25, 1.0, 8), R @ dvec)
                    if bar_d(seg).min() < bar_r + RAD[kind][i]: break
                    best = deg
                R = _rot(ax, math.radians(best))
                for j in range(i + 1, 4): pts[j] = h + R @ (pts[j] - h)
                # Blender applies a bone's rotation in its rest frame, carried by its parents': store the axis there
                a_rest = Rc.T @ (ax / np.linalg.norm(ax))
                angs.append((a_rest, best)); Rc = R @ Rc
            out[f'{name}.{side}'] = [round(a, 0) for _, a in angs]
            # pose: each bone rotated about its axis, given in the rest frame (as fg_bench.rot_world)
            for b, (ax, deg) in zip(bones, angs):
                Mrest = b.bone.matrix_local.to_3x3()
                R = Matrix.Rotation(math.radians(deg), 3, Vector(ax))
                b.rotation_mode = 'QUATERNION'
                b.rotation_quaternion = (Mrest.inverted() @ R @ Mrest).to_quaternion()
    print('[hand] grip (deg, base to tip):', out)
    return out
