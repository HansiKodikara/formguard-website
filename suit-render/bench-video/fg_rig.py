"""Skeleton for the body form: a scripted armature placed on measured joint centres of Body_Form (A-pose, 1.80 m),
bone-heat weights for the body, and procedural weights for the hands so the four fingers curl together into a grip."""
import bpy, bmesh, math, numpy as np
from mathutils import Vector, Matrix, Quaternion

# rest joint positions (metres, Body_Form space: +X = wearer's left, -Y = front, Z up); left side, mirrored for right
SPINE = [
    ('root',        (0, 0.000, 0.93), (0, 0.000, 1.03), None),
    ('spine',       (0, 0.000, 1.03), (0, 0.010, 1.18), 'root'),
    ('chest',       (0, 0.010, 1.18), (0, 0.020, 1.34), 'spine'),
    ('upper_chest', (0, 0.020, 1.34), (0, 0.000, 1.47), 'chest'),
    ('neck',        (0, 0.000, 1.47), (0, -0.010, 1.57), 'upper_chest'),
    ('head',        (0, -0.010, 1.57), (0, -0.010, 1.78), 'neck'),
]
WRIST = (0.401, -0.075, 0.930)
KNUCKLE = Vector((0.452, -0.120, 0.838))
FINGER_DIR = (Vector((0.457, -0.140, 0.768)) - KNUCKLE).normalized()
FINGER_LEN = (0.036, 0.022, 0.020)
LIMB = [
    ('clavicle',  (0.025, -0.030, 1.455), (0.165, 0.015, 1.440), 'upper_chest'),
    ('upper_arm', (0.185, 0.015, 1.420), (0.326, -0.006, 1.130), 'clavicle'),
    ('forearm',   (0.326, -0.006, 1.130), (0.401, -0.075, 0.930), 'upper_arm'),
    ('hand',      (0.401, -0.075, 0.930), tuple(KNUCKLE), 'forearm'),
    ('thumb1',    (0.405, -0.105, 0.905), (0.397, -0.150, 0.878), 'hand'),
    ('thumb2',    (0.397, -0.150, 0.878), (0.393, -0.190, 0.863), 'thumb1'),
    ('thigh',     (0.090, -0.010, 0.920), (0.140, 0.012, 0.500), 'root'),
    ('shin',      (0.140, 0.012, 0.500), (0.188, 0.045, 0.085), 'thigh'),
    ('foot',      (0.188, 0.045, 0.085), (0.200, -0.080, 0.020), 'shin'),
]
def finger_bones():
    out, p, parent = [], KNUCKLE.copy(), 'hand'
    for i, L in enumerate(FINGER_LEN):
        q = p + FINGER_DIR * L
        out.append((f'finger{i + 1}', tuple(p), tuple(q), parent))
        p, parent = q, f'finger{i + 1}'
    return out
LIMB += finger_bones()
CONNECTED = {'spine', 'chest', 'upper_chest', 'neck', 'head', 'forearm', 'hand', 'thumb2', 'shin', 'foot',
             'finger2', 'finger3'}

def mx(v, s):
    return (v[0] * s, v[1], v[2])

def build_armature(name, coll):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    arm = bpy.data.armatures.new(name)
    ob = bpy.data.objects.new(name, arm)
    coll.objects.link(ob)
    ob.show_in_front = True
    arm.display_type = 'STICK'
    vl = bpy.context.view_layer
    with bpy.context.temp_override(active_object=ob, object=ob, selected_objects=[ob], view_layer=vl):
        vl.objects.active = ob
        bpy.ops.object.mode_set(mode='EDIT')
        eb = arm.edit_bones
        for n, h, t, p in SPINE:
            b = eb.new(n); b.head, b.tail = h, t
            if p: b.parent = eb[p]; b.use_connect = n in CONNECTED
            b.align_roll((0, -1, 0))
        for side, s in (('L', 1), ('R', -1)):
            for n, h, t, p in LIMB:
                b = eb.new(f'{n}.{side}'); b.head, b.tail = mx(h, s), mx(t, s)
                b.parent = eb[p if p in [x[0] for x in SPINE] else f'{p}.{side}']
                b.use_connect = n in CONNECTED
                b.align_roll((0, -1, 0))
        bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def heat_weights(body, rig):
    vl = bpy.context.view_layer
    for o in vl.objects: o.select_set(False)
    body.select_set(True); rig.select_set(True); vl.objects.active = rig
    with bpy.context.temp_override(active_object=rig, object=rig, selected_objects=[body, rig],
                                   selected_editable_objects=[body, rig], view_layer=vl):
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    body.parent = None                        # keep only the Armature modifier
    body.matrix_world = Matrix.Identity(4)

def set_weights(ob, vidx, weights):
    """weights: dict group -> np.array of len(vidx); replaces those vertices' weights entirely."""
    for g in ob.vertex_groups:
        g.remove(list(map(int, vidx)))
    for gname, w in weights.items():
        vg = ob.vertex_groups.get(gname) or ob.vertex_groups.new(name=gname)
        for i, wi in zip(vidx, w):
            if wi > 1e-4:
                vg.add([int(i)], float(wi), 'REPLACE')

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def hand_weights(body):
    """Power grip: fingers weighted by distance past the knuckle line, the thumb by its own segment."""
    n = len(body.data.vertices)
    co = np.zeros(n * 3); body.data.vertices.foreach_get('co', co); V = co.reshape(-1, 3)
    for side, s in (('L', 1), ('R', -1)):
        W = np.array(mx(WRIST, s)); K = np.array(mx(KNUCKLE, s)); D = np.array(mx(FINGER_DIR, s))
        F = (K - W) / np.linalg.norm(K - W)
        sel = np.where((V[:, 0] * s > 0.33) & (((V - W) @ F) > -0.01))[0]
        P = V[sel]
        # thumb: closest to the thumb segments
        t0, t1, t2 = (np.array(mx(p, s)) for p in ((0.405, -0.105, 0.905), (0.397, -0.150, 0.878), (0.393, -0.190, 0.863)))
        def seg_dist(P, a, b):
            ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1)
            return np.linalg.norm(P - (a + t[:, None] * ab), axis=1), t
        d1, u1 = seg_dist(P, t0, t1); d2, u2 = seg_dist(P, t1, t2)
        dthumb = np.minimum(d1, d2)
        d_along = (P - K) @ D
        is_thumb = (dthumb < 0.016) & (P[:, 1] < -0.115) & (d_along < 0.0)
        w = {f'hand.{side}': np.zeros(len(P)), f'forearm.{side}': np.zeros(len(P)),
             f'finger1.{side}': np.zeros(len(P)), f'finger2.{side}': np.zeros(len(P)), f'finger3.{side}': np.zeros(len(P)),
             f'thumb1.{side}': np.zeros(len(P)), f'thumb2.{side}': np.zeros(len(P))}
        L1, L2 = FINGER_LEN[0], FINGER_LEN[0] + FINGER_LEN[1]
        b = 0.006
        f1 = smoothstep(-b, b, d_along); f2 = smoothstep(L1 - b, L1 + b, d_along); f3 = smoothstep(L2 - b, L2 + b, d_along)
        fing = ~is_thumb
        w[f'hand.{side}'][fing] = (1 - f1)[fing]
        w[f'finger1.{side}'][fing] = (f1 - f2)[fing]
        w[f'finger2.{side}'][fing] = (f2 - f3)[fing]
        w[f'finger3.{side}'][fing] = f3[fing]
        # wrist blend into the forearm
        dw = (P - W) @ F
        fw = 1 - smoothstep(-0.01, 0.02, dw)
        for k in (f'hand.{side}',):
            w[f'forearm.{side}'][fing] = (w[k] * fw)[fing]
            w[k][fing] = (w[k] * (1 - fw))[fing]
        th_t = np.where(d1 <= d2, u1 * 0.5, 0.5 + u2 * 0.5)
        tb = smoothstep(0.35, 0.65, th_t)
        soft = 1 - smoothstep(0.010, 0.016, dthumb)
        w[f'thumb1.{side}'][is_thumb] = ((1 - tb) * soft)[is_thumb]
        w[f'thumb2.{side}'][is_thumb] = (tb * soft)[is_thumb]
        w[f'hand.{side}'][is_thumb] = (1 - soft)[is_thumb]
        set_weights(body, sel, w)

def normalize_weights(ob):
    vl = bpy.context.view_layer
    vl.objects.active = ob
    with bpy.context.temp_override(active_object=ob, object=ob, selected_objects=[ob], view_layer=vl):
        bpy.ops.object.vertex_group_normalize_all(lock_active=False)

def rig_body(body, coll, name='FG_Rig'):
    rig = build_armature(name, coll)
    heat_weights(body, rig)
    hand_weights(body)
    normalize_weights(body)
    m = body.modifiers.get('Armature') or body.modifiers.new('Armature', 'ARMATURE')
    m.object = rig; m.use_deform_preserve_volume = True
    # armature first in the stack
    while list(body.modifiers).index(m) > 0:
        body.modifiers.move(list(body.modifiers).index(m), list(body.modifiers).index(m) - 1)
    return rig
