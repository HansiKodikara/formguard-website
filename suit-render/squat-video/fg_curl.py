"""The curl frames for 'How it works': the lifter standing, his left arm mid-way through a dumbbell curl (upper arm
by his side, forearm level, palm up), and the classic fault: the elbow drifting forward off his side as the shoulder
takes over. Keyed on frames CURL0 + k, k = 0 .. CURL_N - 1, the upper arm swinging forward up to CURL_DRIFT degrees.

    pose_curl(rig, body)    the pose, the dumbbell in his left hand (fingers solved round the handle), the frames
"""
import bpy, math, numpy as np
from mathutils import Vector, Matrix

CURL0, CURL_N, CURL_DRIFT = 101, 12, 40.0
ELBOW_UP = 0.10            # the forearm just above level (rise over run), mid-curl
HANDLE_R = 0.0165           # dumbbell handle radius (m)


def _curl_par_rot(pb):
    if pb.parent is None: return Matrix.Identity(3)
    return pb.parent.matrix.to_3x3() @ pb.parent.bone.matrix_local.to_3x3().inverted()


def _turn_bone(pb, axis_arm, deg):
    """Rotate a pose bone about an armature-space axis through its head (on top of its current pose)."""
    a = _curl_par_rot(pb).inverted() @ Vector(axis_arm)
    rot_world(pb, a.normalized(), deg)


def aim_bone(rig, name, want):
    bpy.context.view_layer.update()
    pb = rig.pose.bones[name]
    cur = (pb.tail - pb.head).normalized()
    q = cur.rotation_difference(Vector(want).normalized())
    if q.angle > 1e-5: _turn_bone(pb, q.axis, math.degrees(q.angle))


def _palm(chains, s):
    """Rest-frame palm normal (from the back of the hand to the palm), finger direction and the across-the-palm
    axis (index -> pinky), for side s (1 = left)."""
    mx = lambda p: np.array((p[0] * s, p[1], p[2]))
    mcp = {k: mx(v[0]) for k, v in chains.items()}
    D = mx(chains['middle'][3]) - mcp['middle']; D /= np.linalg.norm(D)
    A = mcp['pinky'] - mcp['index']; A -= D * (A @ D); A /= np.linalg.norm(A)
    n = np.cross(A, D); n /= np.linalg.norm(n)
    if n[0] * s > 0: n = -n                      # A-pose: the palm faces the thigh (towards the midline)
    c = np.mean([mcp[k] for k in ('index', 'middle', 'ring', 'pinky')], axis=0)
    return Vector(n), Vector(D), Vector(A), Vector(c)


def dumbbell(coll, M):
    root = bpy.data.objects.new('FG_Dumbbell', None); coll.objects.link(root)
    obs = [cyl('FG_DB_Handle', coll, HANDLE_R, 0.135, (0, 0, 0), mat=M['steel'])]
    for s in (1, -1):
        obs.append(cyl(f'FG_DB_Collar_{s}', coll, 0.024, 0.012, (s * 0.0735, 0, 0), mat=M['sleeve']))
        obs.append(cyl(f'FG_DB_Plate_{s}', coll, 0.072, 0.034, (s * 0.0965, 0, 0), mat=M['plate'], verts=96))
        obs.append(cyl(f'FG_DB_Cap_{s}', coll, 0.03, 0.008, (s * 0.1175, 0, 0), mat=M['sleeve']))
    for o in obs: o.parent = root
    return root


def pose_curl(rig, body, coll, M):
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'QUATERNION'; b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)
        for c in list(b.constraints): b.constraints.remove(c)
    # standing tall; legs out of the A-pose a little
    for s, side in ((1, 'L'), (-1, 'R')):
        aim_bone(rig, f'thigh.{side}', (0.03 * s, 0.01, -1))
        aim_bone(rig, f'shin.{side}', (0.0, 0.03, -1))
    # right arm: relaxed by his side
    aim_bone(rig, 'upper_arm.R', (-0.12, 0.04, -1)); aim_bone(rig, 'forearm.R', (-0.05, -0.18, -1)); aim_bone(rig, 'hand.R', (-0.03, -0.12, -1))
    # left arm: upper arm by his side, forearm level and forward, wrist straight
    aim_bone(rig, 'upper_arm.L', (0.10, 0.03, -1))
    aim_bone(rig, 'forearm.L', (0.02, -1, ELBOW_UP))
    aim_bone(rig, 'hand.L', (0.02, -1, ELBOW_UP))
    # palm up: turn the forearm about its own axis until the palm faces the ceiling
    chains = measure(body)
    n, D, A, c = _palm(chains, 1)
    bpy.context.view_layer.update()
    fa = pb['forearm.L']; ax = (fa.tail - fa.head).normalized()
    hb = pb['hand.L']; H = hb.matrix.to_3x3() @ hb.bone.matrix_local.to_3x3().inverted()
    cur = H @ n; cur = (cur - ax * cur.dot(ax)).normalized()
    up = Vector((0, 0, 1)); up = (up - ax * up.dot(ax)).normalized()
    ang = math.degrees(math.atan2(cur.cross(up).dot(ax), cur.dot(up)))
    _turn_bone(fa, ax, ang)
    bpy.context.view_layer.update()
    # the dumbbell: across the palm at the base of the fingers, on the hand bone
    db = dumbbell(coll, M)
    centre = c + D * 0.012 + n * (HANDLE_R + 0.011)
    X = A; Z = n; Y = Z.cross(X)
    rest = Matrix.Translation(centre) @ Matrix((X, Y, Z)).transposed().to_4x4()
    bone = rig.data.bones['hand.L']
    db.parent = rig; db.parent_type = 'BONE'; db.parent_bone = 'hand.L'
    db.matrix_parent_inverse = (rig.matrix_world @ bone.matrix_local @ Matrix.Translation((0, bone.length, 0))).inverted()
    db.matrix_basis = rig.matrix_world @ rest
    bpy.context.view_layer.update()
    grip(rig, db, HANDLE_R)
    # the frames: the upper arm swings forward (about the side-to-side axis), the elbow leaving his side
    ua = pb['upper_arm.L']
    base = ua.rotation_quaternion.copy()
    for k in range(CURL_N):
        t = k / (CURL_N - 1); t = t * t * (3 - 2 * t)
        ua.rotation_quaternion = base
        _turn_bone(ua, (1, 0, 0), -CURL_DRIFT * t)
        ua.keyframe_insert('rotation_quaternion', frame=CURL0 + k)
    return db


# his left arm in the rest pose (Body_Form space; fg_rig.py): shoulder, elbow, wrist, fingertips, and how far the skin
# and the sleeve lie from that line
ARM_LINE = [Vector((0.185, 0.015, 1.420)), Vector((0.326, -0.006, 1.130)), Vector((0.401, -0.075, 0.930)), Vector((0.462, -0.155, 0.770))]
ARM_RADIUS = (0.078, 0.062, 0.065)
CUT_BELOW = 0.05            # the cut: a clean ring this far down the upper arm from the shoulder joint

def isolate_arm(colls):
    """Only his left arm: every mesh (body and suit alike) keeps just what lies round the arm's line, from a clean
    cut just below the shoulder, and fades out towards it; the rest of him, the eyes included, is hidden."""
    S, E = ARM_LINE[0], ARM_LINE[1]
    d = (E - S).normalized()
    segs = list(zip(ARM_LINE[:-1], ARM_LINE[1:], ARM_RADIUS))
    def on_arm(p):
        if (p - S).dot(d) < CUT_BELOW: return False
        for a, b, r in segs:
            ab = b - a; t = min(1.0, max(0.0, (p - a).dot(ab) / ab.length_squared))
            if (p - (a + ab * t)).length < r: return True
        return False
    for c in colls:
        for ob in list(bpy.data.collections[c].all_objects):     # a copy: hiding one changes the live list
            if ob.type != 'MESH': continue
            M = ob.matrix_world
            keep = [v.index for v in ob.data.vertices if on_arm(M @ v.co)]
            if not keep:
                ob.hide_render = True; ob.hide_viewport = True; continue
            vg = ob.vertex_groups.new(name='curl_arm'); vg.add(keep, 1.0, 'REPLACE')
            mk = ob.modifiers.new('CurlArm', 'MASK'); mk.vertex_group = vg.name
            # how far down the arm each point is, for the fade at the shoulder
            at = ob.data.attributes.new('arm_t', 'FLOAT', 'POINT')
            at.data.foreach_set('value', [(M @ v.co - S).dot(d) for v in ob.data.vertices])
            for m in ob.data.materials:
                if m: fade_material(m)


FADE = (CUT_BELOW + 0.015, CUT_BELOW + 0.09)      # transparent at the cut, solid this far down the arm

def fade_material(m):
    """The arm dissolves towards the shoulder (the 'arm_t' attribute), so where it was cut from the body never shows."""
    nt = m.node_tree
    if nt is None or 'FG_ArmFade' in nt.nodes: return
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)
    link = out.inputs['Surface'].links[0]; src = link.from_socket
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'arm_t'; at.attribute_type = 'GEOMETRY'
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value, mr.inputs['From Max'].default_value = FADE
    mr.interpolation_type = 'SMOOTHSTEP'
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.name = 'FG_ArmFade'
    nt.links.new(at.outputs['Fac'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], mx.inputs['Fac'])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(src, mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs['Surface'])
