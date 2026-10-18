"""Bench-press loop: scene 'FG_Bench' in bench-video/formguard_bench.blend (built from a copy of formguard_suit.blend).
- the display body (warm-stone mannequin, crotch-panel mask) rigged with fg_rig
- the whole suit frozen at rest (modifiers applied) and bound to the same skeleton by weight transfer
- bench, bar and plates (downloaded models in bench-video/equipment), the J-curve bar path and the two reps
- the dark studio sweep and lights of the product renders, and fixed cameras
formguard_suit.blend itself is never modified."""
import bpy, bmesh, math, os, json, numpy as np, builtins
from mathutils import Vector, Matrix, Quaternion, Euler
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

SRC_SCENE = bpy.data.scenes['Scene']
BENCH_NAME = 'FG_Bench'
FPS, FRAMES = 30, 240

def get_scene():
    sc = bpy.data.scenes.get(BENCH_NAME)
    if sc is None:
        sc = bpy.data.scenes.new(BENCH_NAME)
    sc.world = SRC_SCENE.world
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    sc.render.fps = FPS; sc.frame_start = 1; sc.frame_end = FRAMES
    vs, svs = sc.view_settings, SRC_SCENE.view_settings
    sc.display_settings.display_device = SRC_SCENE.display_settings.display_device
    vs.view_transform = svs.view_transform; vs.look = svs.look; vs.exposure = svs.exposure
    return sc
BENCH = get_scene()

def bcoll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
    par = parent or BENCH.collection
    if c.name not in par.children:
        par.children.link(c)
    return c

def clear_coll(c):
    for o in list(c.all_objects):
        d = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if d is not None and d.users == 0:
            for lib in (bpy.data.meshes, bpy.data.armatures, bpy.data.curves, bpy.data.cameras, bpy.data.lights):
                if d.rna_type.identifier == lib.rna_type.identifier.replace('BlendData', '').rstrip('s').capitalize() or d in lib.values():
                    lib.remove(d); break

# ================================================================ display body + rig
def build_body(coll):
    src = bpy.data.objects['Body_Form']
    me = src.data.copy(); me.name = 'FG_Bench_Body'
    ob = bpy.data.objects.new('FG_Bench_Body', me); coll.objects.link(ob)
    ob.vertex_groups.clear()
    mat = principled('FG_Mannequin', '#A39B8F', rough=0.5, spec=0.35, sheen=0.1, sheen_tint='#F2EDE4')
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    return ob

def body_masks(body):
    """Hide (a) the patch under the tights' crotch panel, as on FG_Body_Display, and (b) skin that is fully covered
    by the suit (>= 22 mm inside a garment edge), so the deforming body can never poke through the fabric."""
    V = np.array([v.co[:] for v in body.data.vertices])
    c, rad, sc3 = np.array((0.0, -0.118, 0.862)), 0.062 * 1.5, np.array((0.7, 1.3, 1.0))
    crotch = (((V - c) / (rad * sc3)) ** 2).sum(1) < 1.0
    covered = np.zeros(len(V), bool)
    for gname in ('FG_Shirt', 'FG_Tights'):
        g = bpy.data.objects[gname]
        gm = g.data
        bm = bmesh.new(); bm.from_mesh(gm)
        bd = [v.co.copy() for v in bm.verts if v.is_boundary]
        bm.free()
        kd_all = KDTree(len(gm.vertices))
        for i, v in enumerate(gm.vertices): kd_all.insert(v.co, i)
        kd_all.balance()
        kd_bd = KDTree(len(bd))
        for i, p in enumerate(bd): kd_bd.insert(p, i)
        kd_bd.balance()
        for i, p in enumerate(V):
            if covered[i]: continue
            _, _, d = kd_all.find(p)
            if d < 0.004:
                _, _, db = kd_bd.find(p)
                if db > 0.022: covered[i] = True
    hide = np.where(crotch | covered)[0]
    vg = body.vertex_groups.get('hidden_under_suit') or body.vertex_groups.new(name='hidden_under_suit')
    vg.add([int(i) for i in hide], 1.0, 'REPLACE')
    mk = body.modifiers.new('HideUnderSuit', 'MASK'); mk.vertex_group = vg.name; mk.invert_vertex_group = True
    print('body mask: hidden verts', len(hide), 'of', len(V))

# ================================================================ freeze the suit and bind it to the skeleton
def suit_sources():
    out = []
    for cname in ('FG_Shirt_Set', 'FG_Tights_Set'):
        for o in bpy.data.collections[cname].all_objects:
            if o.type not in ('MESH', 'CURVE') or 'Guide' in o.name:
                continue
            out.append(o)
    return out

def bake_object(o, coll, dg):
    e = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(e, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(o.matrix_world)
    me.name = 'FGB_' + o.name
    ob = bpy.data.objects.new('FGB_' + o.name, me)
    coll.objects.link(ob)
    if o.type == 'CURVE':
        me.materials.clear()
        for m in o.data.materials: me.materials.append(m)
    return ob

def body_weight_table(body):
    groups = [g.name for g in body.vertex_groups if g.name != 'hidden_under_suit']
    gi = {body.vertex_groups[n].index: k for k, n in enumerate(groups)}
    W = np.zeros((len(body.data.vertices), len(groups)), np.float32)
    for v in body.data.vertices:
        for g in v.groups:
            k = gi.get(g.group)
            if k is not None: W[v.index, k] = g.weight
    W /= np.clip(W.sum(1, keepdims=True), 1e-6, None)
    return groups, W

def transfer_weights(ob, body_bvh, polys, V, groups, W):
    me = ob.data
    n = len(me.vertices)
    out = np.zeros((n, len(groups)), np.float32)
    for i, v in enumerate(me.vertices):
        loc, nor, fi, d = body_bvh.find_nearest(v.co)
        vids = polys[fi]
        dd = np.linalg.norm(V[vids] - np.array(loc), axis=1)
        w = 1.0 / (dd + 1e-4); w /= w.sum()
        out[i] = w @ W[vids]
    ob.vertex_groups.clear()
    for k, gname in enumerate(groups):
        col = out[:, k]
        nz = np.where(col > 0.004)[0]
        if len(nz) == 0: continue
        vg = ob.vertex_groups.new(name=gname)
        q = np.round(col[nz] * 200) / 200
        for val in np.unique(q):
            idx = nz[q == val]
            vg.add(idx.tolist(), float(max(val, 0.005)), 'REPLACE')

def bind_suit(body, rig, coll):
    dg = bpy.context.evaluated_depsgraph_get()
    srcs = suit_sources()
    baked = [bake_object(o, coll, dg) for o in srcs]
    V = np.array([v.co[:] for v in body.data.vertices])
    polys = [list(p.vertices) for p in body.data.polygons]
    bvh = BVHTree.FromPolygons([tuple(v) for v in V], polys)
    groups, W = body_weight_table(body)
    nv = 0
    for ob in baked:
        transfer_weights(ob, bvh, polys, V, groups, W)
        m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = rig; m.use_deform_preserve_volume = True
        nv += len(ob.data.vertices)
    print('suit pieces bound:', len(baked), 'vertices', nv)
    return baked

# ================================================================ pose and animation
ROOT_TZ = [0.0]
PAD_Z = 0.44            # top of the bench pad (standard flat bench); replaced by the measured pad height when the bench model is in
ARM_Y = -0.95           # rig placement along the bench: hips near y = 0, head towards +Y
GRIP_X = 0.38          # hand centre from the midline: hands ~0.76 m apart (index fingers inside the 81 cm rings), so the
                        # forearms stack over the wrists when the elbows are tucked to ~50 deg
BAR_R = 0.014           # 28 mm Olympic bar shaft
# elbow pole offsets (metres): rep 1 from the shoulder joint, rep 2 from the hand / bar touch point
FLARE_POLE_Y, FLARE_POLE_Z = -0.19, -0.12
TUCK_POLE_X, TUCK_POLE_Y, TUCK_POLE_Z = 0.06, -0.25, -0.80
# where the bar touches the chest, measured from the shoulder joints towards the feet
TOUCH_1, TOUCH_2 = 0.075, 0.185

def rest_rot(rig, bone):
    return rig.data.bones[bone].matrix_local.to_3x3()

def rot_world(pb, axis, deg):
    """Rotate a pose bone about an axis given in the rig's rest frame (standing)."""
    R = Matrix.Rotation(math.radians(deg), 3, Vector(axis))
    Mrest = pb.bone.matrix_local.to_3x3()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = (Mrest.inverted() @ R @ Mrest).to_quaternion() @ pb.rotation_quaternion

def empty(name, coll, loc=(0, 0, 0), parent=None, size=0.05, shape='PLAIN_AXES'):
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, None); coll.objects.link(ob)
    ob.empty_display_type = shape; ob.empty_display_size = size
    ob.parent = parent
    ob.location = loc
    ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = (1, 0, 0, 0)
    ob.animation_data_clear()
    return ob

def frame_map(d_from, p_from, d_to, p_to):
    """Rotation taking the orthonormal frame (d_from, p_from) onto (d_to, p_to)."""
    def basis(d, p):
        d = Vector(d).normalized(); p = (Vector(p) - d * Vector(p).dot(d)).normalized()
        return Matrix((d, p, d.cross(p))).transposed()
    return basis(d_to, p_to) @ basis(d_from, p_from).inverted()

def static_pose(rig):
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'QUATERNION'; b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)
        for c in list(b.constraints): b.constraints.remove(c)
    # a slight arch, shoulder blades pulled back and down, head resting on the pad
    rot_world(pb['spine'], (1, 0, 0), -7)
    rot_world(pb['chest'], (1, 0, 0), -5)
    rot_world(pb['upper_chest'], (1, 0, 0), 4)
    for s, side in ((1, 'L'), (-1, 'R')):
        rot_world(pb[f'clavicle.{side}'], (0, 0, 1), 9 * s)        # retract (tail moves back)
        rot_world(pb[f'clavicle.{side}'], (0, 1, 0), 5 * s)        # depress
        # power grip round the bar: fingers curl about the knuckle line, thumb wraps the other way
        for f, a in (('finger1', 62), ('finger2', 75), ('finger3', 55)):
            rot_world(pb[f'{f}.{side}'], (0, 1, 0), a * s)
        rot_world(pb[f'thumb1.{side}'], (0, 0, 1), -25 * s)
        rot_world(pb[f'thumb2.{side}'], (0, 0, 1), -30 * s)

def place_rig(rig, tz, tilt=0.0):
    """Lay the lifter on the bench through the root bone (the Armature modifier ignores the rig object's own
    transform): standing (+Z up, facing -Y) -> supine, face up, head towards +Y, at height tz.
    tilt (deg) rocks the pelvis so that the upper back and the glutes can both rest on the pad."""
    rig.matrix_world = Matrix.Identity(4)
    target = Matrix.Translation((0, ARM_Y, tz)) @ Matrix.Rotation(math.radians(-90 + tilt), 4, 'X')
    B = rig.data.bones['root'].matrix_local
    pb = rig.pose.bones['root']
    pb.rotation_mode = 'QUATERNION'
    pb.matrix_basis = B.inverted() @ target @ B
    ROOT_TZ[0] = tz

def body_world_verts(body):
    """Deformed skin, unmasked (the masks hide the skin under the suit, which is exactly what touches the pad)."""
    masks = [m for m in body.modifiers if m.type == 'MASK']
    for m in masks: m.show_viewport = False
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    e = body.evaluated_get(dg); me = e.to_mesh()
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
    e.to_mesh_clear()
    for m in masks: m.show_viewport = True
    return co.reshape(-1, 3) @ np.array(body.matrix_world)[:3, :3].T + np.array(body.matrix_world)[:3, 3]

def contacts(rig, body):
    """Lowest skin point of the upper back, of the glutes and of the back of the head (|x| < 0.12)."""
    bpy.context.view_layer.update()
    P = body_world_verts(body)
    sh_y = world_head(rig, 'upper_arm.L').y; hip_y = world_head(rig, 'thigh.L').y; head_y = world_head(rig, 'head').y
    mid = np.abs(P[:, 0]) < 0.12
    def low(y0, y1):
        m = mid & (P[:, 1] > y0) & (P[:, 1] < y1)
        return float(P[m, 2].min())
    return low(sh_y - 0.20, sh_y + 0.02), low(hip_y - 0.12, hip_y + 0.10), low(head_y - 0.02, head_y + 0.20)

SINK = 0.008     # the pad gives a little under the lifter's weight

def settle(rig, body):
    """Rock the pelvis until upper back and glutes sit level, drop the lifter onto the pad, then extend the neck until
    the head rests on it too."""
    tz = ROOT_TZ[0]
    def err(t):
        place_rig(rig, tz, t)
        ub, gl, hd = contacts(rig, body)
        return ub - gl                             # >0: upper back sits higher than the glutes
    lo, hi = -20.0, 20.0
    elo, ehi = err(lo), err(hi)
    tilt = 0.0
    if elo * ehi < 0:
        for _ in range(18):                        # bisection: upper back and glutes level
            mid = (lo + hi) / 2; em = err(mid)
            if em * elo > 0: lo, elo = mid, em
            else: hi, ehi = mid, em
        tilt = (lo + hi) / 2
    place_rig(rig, tz, tilt)
    ub, gl, hd = contacts(rig, body)
    tz += (PAD_Z - SINK) - min(ub, gl)
    place_rig(rig, tz, tilt)
    pb = rig.pose.bones['neck']
    base = pb.rotation_quaternion.copy()
    for k in range(10):
        ub, gl, hd = contacts(rig, body)
        gap = hd - (PAD_Z - SINK * 0.5)
        if abs(gap) < 0.003: break
        rot_world(pb, (1, 0, 0), -math.degrees(math.atan2(gap, 0.12)) * 0.8)
    print(f'settle: tilt {tilt:.1f} deg, root z {tz:.3f}, contacts back/glutes/head {contacts(rig, body)}')
    return tz, tilt

def leg_ik(rig, coll):
    pb = rig.pose.bones
    tz = ROOT_TZ[0]
    for s, side in ((1, 'L'), (-1, 'R')):
        hip_y = ARM_Y + 0.92
        tgt = empty(f'FG_IK_Foot.{side}', coll, (0.28 * s, hip_y - 0.47, 0.085))
        # flat foot, toes out ~12 deg: the foot bone keeps its standing rest orientation in world space
        tgt.rotation_quaternion = (Matrix.Rotation(math.radians(12 * s), 3, 'Z') @ rest_rot(rig, f'foot.{side}')).to_quaternion()
        pole = empty(f'FG_Pole_Knee.{side}', coll, (0.36 * s, hip_y - 0.40, 1.2))
        ik = pb[f'shin.{side}'].constraints.new('IK')
        ik.target = tgt; ik.pole_target = pole; ik.chain_count = 2; ik.use_tail = True
        cr = pb[f'foot.{side}'].constraints.new('COPY_ROTATION'); cr.target = tgt
        cr.target_space = 'WORLD'; cr.owner_space = 'WORLD'
        bpy.context.view_layer.update()
        calibrate_pole(rig, side, ik, pole, chain=('thigh', 'shin', 'foot'))

HAND_DIR_REST = {'L': (Vector((0.452, -0.120, 0.838)) - Vector((0.401, -0.075, 0.930))).normalized()}
HAND_DIR_REST['R'] = Vector((-HAND_DIR_REST['L'].x, HAND_DIR_REST['L'].y, HAND_DIR_REST['L'].z))

def arm_ik(rig, coll, bar):
    pb = rig.pose.bones
    targets = {}
    for s, side in ((1, 'L'), (-1, 'R')):
        # wrist sits 2 cm towards the head and 3.5 cm below the bar centre: bar across the heel of the palm,
        # over the forearm line (straight wrist)
        tgt = empty(f'FG_IK_Hand.{side}', coll, (GRIP_X * s, 0.02, -0.035), parent=bar)
        # hand orientation: pointing up along the forearm, palm facing the feet (-Y), turned in slightly
        Q = frame_map(HAND_DIR_REST[side], (-s, 0, 0), (0.0, -0.05, 1.0), (0.12 * -s, -1.0, 0.0))
        tgt.rotation_quaternion = (Q @ rest_rot(rig, f'hand.{side}')).to_quaternion()
        pole = empty(f'FG_Pole_Elbow.{side}', coll, (0.9 * s, 0, 0))
        ik = pb[f'forearm.{side}'].constraints.new('IK')
        ik.target = tgt; ik.pole_target = pole; ik.chain_count = 2; ik.use_tail = True
        cr = pb[f'hand.{side}'].constraints.new('COPY_ROTATION'); cr.target = tgt
        cr.target_space = 'WORLD'; cr.owner_space = 'WORLD'
        targets[side] = (tgt, pole, ik)
    return targets

def world_head(rig, bone):
    return rig.matrix_world @ rig.pose.bones[bone].head

def calibrate_pole(rig, side, ik, pole, chain=('upper_arm', 'forearm', 'hand')):
    """Pick the pole_angle that puts the middle joint (elbow / knee) on the pole's side of the chain."""
    best = None
    for ang in (-180, -90, 0, 90):
        ik.pole_angle = math.radians(ang)
        bpy.context.view_layer.update()
        sh, el, wr = (world_head(rig, f'{b}.{side}') for b in chain)
        line = (wr - sh).normalized()
        def off(p):
            v = p - sh; return (v - line * v.dot(line)).normalized()
        score = off(el).dot(off(pole.matrix_world.translation))
        if best is None or score > best[0]:
            best = (score, ang)
    ik.pole_angle = math.radians(best[1])
    return best

# ================================================================ the two reps
# frame numbers (30 fps, frame 1 = t 0)
K = dict(start=1, r1_go=15, r1_mid=38, r1_bottom=60, r1_hold_end=80, r1_up_mid=93, r1_lock=110,
         r2_go=125, r2_mid=148, r2_bottom=170, r2_pause_end=175, r2_up_mid=189, r2_lock=206, end=FRAMES)
EVENTS = [('rep1_start', 'start'), ('rep1_bottom', 'r1_bottom'), ('flare_hold_end', 'r1_hold_end'),
          ('rep1_lockout', 'r1_lock'), ('rep2_bottom', 'r2_bottom'), ('rep2_lockout', 'r2_lock')]

def chest_top(body, y, half=0.035):
    P = body_world_verts(body)
    m = (np.abs(P[:, 0]) < half) & (np.abs(P[:, 1] - y) < 0.012)
    return float(P[m, 2].max())

def key_loc(ob, frame, loc):
    ob.location = loc
    ob.keyframe_insert('location', frame=frame)

def smooth_fcurves(ob):
    if not ob.animation_data or not ob.animation_data.action: return
    act = ob.animation_data.action
    fcs = []
    if hasattr(act, 'fcurves'):
        fcs = list(act.fcurves)
    else:                                          # layered actions (Blender 4.4+)
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    fcs += list(bag.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'; kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
        fc.update()

def animate(rig, body, bar, targets):
    sc = bpy.context.scene
    sc.frame_set(1)
    S = {side: world_head(rig, f'upper_arm.{side}') for side in ('L', 'R')}
    Sy = (S['L'].y + S['R'].y) / 2; Sz = (S['L'].z + S['R'].z) / 2; Sx = (S['L'].x - S['R'].x) / 2
    L = rig.data.bones['upper_arm.L'].length + rig.data.bones['forearm.L'].length
    # lockout: arms just straight, bar over the shoulder joints
    y_top = Sy - 0.015
    dx, dy = GRIP_X - Sx, (y_top + 0.02) - Sy
    z_top = Sz + 0.035 + math.sqrt((L - 0.006) ** 2 - dx * dx - dy * dy)
    # bottoms: rep 1 (flared) touches high on the chest, rep 2 (tucked) the lower chest
    y_b1, y_b2 = Sy - TOUCH_1, Sy - TOUCH_2
    z_b1 = chest_top(body, y_b1) + BAR_R + 0.006
    z_b2 = chest_top(body, y_b2) + BAR_R + 0.006
    top = Vector((0, y_top, z_top))
    b1, b2 = Vector((0, y_b1, z_b1)), Vector((0, y_b2, z_b2))
    def mid_down(b):   # bar travels down and towards the feet
        return Vector((0, top.y + (b.y - top.y) * 0.55, top.z + (b.z - top.z) * 0.50))
    def mid_up(b):     # J-curve: up and back towards the face early, then straight up over the shoulders
        return Vector((0, b.y + (top.y - b.y) * 0.70, b.z + (top.z - b.z) * 0.45))
    bar.animation_data_clear()
    for f, p in ((K['start'], top), (K['r1_go'], top), (K['r1_mid'], mid_down(b1)), (K['r1_bottom'], b1),
                 (K['r1_hold_end'], b1), (K['r1_up_mid'], mid_up(b1)), (K['r1_lock'], top), (K['r2_go'], top),
                 (K['r2_mid'], mid_down(b2)), (K['r2_bottom'], b2), (K['r2_pause_end'], b2),
                 (K['r2_up_mid'], mid_up(b2)), (K['r2_lock'], top), (K['end'], top)):
        key_loc(bar, f, p)
    smooth_fcurves(bar)
    # elbows. Rep 1 (fault): pole out to the side at shoulder height, so the elbows flare to ~80-90 deg.
    # Rep 2 (clean): pole under the wrist and towards the feet, so the elbows drop and tuck under the bar.
    for side, (tgt, pole, ik) in targets.items():
        s = 1 if side == 'L' else -1
        sh = S[side]
        flare = Vector((sh.x + 0.60 * s, sh.y + FLARE_POLE_Y, sh.z + FLARE_POLE_Z))
        tuck = Vector((GRIP_X * s + TUCK_POLE_X * s, b2.y + TUCK_POLE_Y, sh.z + TUCK_POLE_Z))
        pole.animation_data_clear()
        for f, p in ((K['start'], flare), (K['r1_lock'], flare), (K['r2_go'], tuck), (K['r2_lock'], tuck),
                     (K['r2_lock'] + 22, flare), (K['end'], flare)):
            key_loc(pole, f, p)
        smooth_fcurves(pole)
    return dict(Sy=Sy, Sz=Sz, top=top, b1=b1, b2=b2)

def elbow_report(rig):
    """Elbow angle from the torso at both bottoms, in the top view (0 = along the side, 90 = straight out),
    and how far the forearm leans from vertical."""
    sc = bpy.context.scene
    out = {}
    for name in ('r1_bottom', 'r2_bottom'):
        sc.frame_set(K[name]); bpy.context.view_layer.update()
        vals = []
        for side in ('L', 'R'):
            sh, el, wr = (world_head(rig, f'{b}.{side}') for b in ('upper_arm', 'forearm', 'hand'))
            v = (el - sh); v2 = Vector((v.x, v.y))
            ang = math.degrees(math.atan2(abs(v2.x), -v2.y)) if v2.length > 1e-6 else 0
            fa = (wr - el)
            front = math.degrees(math.atan2(abs(fa.x), fa.z))     # lean seen from the feet (frontal plane)
            side_ = math.degrees(math.atan2(abs(fa.y), fa.z))     # lean seen from the side (bar path plane)
            vals.append(dict(elbow_from_torso=round(ang, 1), forearm_lean_front=round(front, 1), forearm_lean_side=round(side_, 1)))
        out[name] = vals
    sc.frame_set(1)
    return out

def write_events(path):
    ev = [{'id': i, 'frame': K[k], 't': round((K[k] - 1) / FPS, 3)} for i, k in EVENTS]
    with open(path, 'w') as f:
        json.dump({'fps': FPS, 'frames': FRAMES, 'events': ev}, f, indent=2)
    return ev

# ================================================================ equipment (downloaded models, neutral materials)
EQUIP_DIR = os.path.join(BENCH_DIR, 'equipment')
def equip_materials():
    return dict(
        steel=principled('FG_Eq_BarSteel', '#8C8B87', rough=0.32, metallic=0.9, spec=0.5),
        sleeve=principled('FG_Eq_SleeveSteel', '#A4A39F', rough=0.22, metallic=0.95, spec=0.5),
        plate=principled('FG_Eq_PlateIron', '#1D1C1A', rough=0.7, metallic=0.2, spec=0.35),
        pad=principled('FG_Eq_PadVinyl', '#141311', rough=0.55, spec=0.35, sheen=0.1, sheen_tint='#F2EDE4'),
        frame=principled('FG_Eq_FramePowder', '#2B2A27', rough=0.45, metallic=0.3, spec=0.4),
    )

def append_equipment(fname, coll):
    path = os.path.join(EQUIP_DIR, fname)
    if not os.path.exists(path):
        return []
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
    obs = [o for o in dst.objects if o is not None]
    for o in obs:
        coll.objects.link(o)
    return obs

# ================================================================ build
def build_rig_and_suit():
    RIGC = bcoll('FG_Bench_Rig'); SUITC = bcoll('FG_Bench_Suit'); CTL = bcoll('FG_Bench_Controls')
    for c in (RIGC, SUITC, CTL): clear_coll(c)
    with bpy.context.temp_override(scene=BENCH, view_layer=BENCH.view_layers[0]):
        body = build_body(RIGC)
        rig = rig_body(body, RIGC)
        body_masks(body)
    for c in ('FG_Shirt_Set', 'FG_Tights_Set', 'FG_Shirt_Details', 'FG_Tights_Details'):
        bpy.data.collections[c].hide_viewport = False; bpy.data.collections[c].hide_render = False
    with bpy.context.temp_override(scene=SRC_SCENE, view_layer=SRC_SCENE.view_layers[0]):
        bind_suit(body, rig, SUITC)
    return rig, body, CTL

def build_motion(rig, body, CTL):
    with bpy.context.temp_override(scene=BENCH, view_layer=BENCH.view_layers[0]):
        BENCH.frame_set(1)
        static_pose(rig)
        place_rig(rig, PAD_Z + 0.118)
        bpy.context.view_layer.update()
        bar = empty('FG_Bar', CTL, (0, ARM_Y + 1.40, 1.08), size=0.3)
        T = arm_ik(rig, CTL, bar)
        leg_ik(rig, CTL)
        bpy.context.view_layer.update()
        for side, (tgt, pole, ik) in T.items():
            s = 1 if side == 'L' else -1
            pole.location = (0.9 * s, ARM_Y + 1.42, 0.5)
            bpy.context.view_layer.update()
            calibrate_pole(rig, side, ik, pole)
        settle(rig, body)
        info = animate(rig, body, bar, T)
        rep = elbow_report(rig)
        print('bar path', {k: (tuple(round(c, 3) for c in v) if hasattr(v, 'x') else round(v, 3)) for k, v in info.items()})
        print('elbow angle from torso / forearm lean from vertical at the bottoms:', rep)
    return bar, T, info, rep

# ================================================================ studio and cameras
# camera angles: azimuth measured from the lifter's left side (+X) towards the feet (-Y); elevation above horizontal
CAMERAS = {
    'threequarter': dict(az=30.0, el=40.0, lens=50.0, target=(0.0, 0.14, 0.58), dist=3.7),
    'side':         dict(az=0.0,  el=8.0,  lens=50.0, target=(0.0, 0.16, 0.58), dist=4.1),
}
MOBILE = dict(cam='threequarter', lens=50.0, dist=3.3, target=(0.02, 0.22, 0.62))   # 4:5 crop for phones

def cam_vector(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.cos(e) * math.cos(a), -math.cos(e) * math.sin(a), math.sin(e)))

def build_sweep_bench(coll):
    """The product renders' seamless sweep: floor + curved wall, wall on the far side of the lifter from the camera."""
    name = 'FG_Bench_Backdrop'
    old = bpy.data.objects.get(name)
    if old: bpy.data.objects.remove(old, do_unlink=True)
    prof = [(-7.0, 0.0), (2.0, 0.0)]
    R = 1.4
    for i in range(1, 17):
        a = -math.pi / 2 + (math.pi / 2) * i / 16
        prof.append((2.0 + R * math.cos(a), R + R * math.sin(a)))
    prof.append((2.0 + R, 8.0))
    verts, faces = [], []
    xs = [-25.0 + 50.0 * i / 20 for i in range(21)]
    for x in xs:
        for y, z in prof:
            verts.append((x, y, z))
    n = len(prof)
    for i in range(len(xs) - 1):
        for j in range(n - 1):
            faces.append((i * n + j, (i + 1) * n + j, (i + 1) * n + j + 1, i * n + j + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    if me.polygons[0].normal.z < 0:
        for p in me.polygons: p.flip()
    me.materials.append(bpy.data.materials['FG_Backdrop'])
    return ob

def bench_lights(coll):
    out = {}
    for name, shape, sx, sy, w in (('FGB_Key', 'SQUARE', 2.0, 2.0, 400.0), ('FGB_Rim_L', 'RECTANGLE', 0.3, 2.0, 600.0),
                                   ('FGB_Rim_R', 'RECTANGLE', 0.3, 2.0, 600.0), ('FGB_Fill', 'SQUARE', 1.5, 1.5, 40.0)):
        old = bpy.data.objects.get(name)
        if old: bpy.data.objects.remove(old, do_unlink=True)
        ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, 'AREA')
        ld.type = 'AREA'; ld.shape = shape; ld.size = sx; ld.size_y = sy; ld.energy = w
        if hasattr(ld, 'use_temperature'):
            ld.use_temperature = True; ld.temperature = 5600.0
        ob = bpy.data.objects.new(name, ld); coll.objects.link(ob)
        ob.visible_camera = False
        out[name] = ob
    return out

def place_stage(angle, lights, backdrop, cam):
    """Rotate the light rig and the sweep with the camera, as in the product shots."""
    c = CAMERAS[angle]
    tgt = Vector(c['target'])
    v = cam_vector(c['az'], c['el'])
    hv = Vector((v.x, v.y, 0)).normalized()                 # camera side, horizontal
    rot = math.atan2(hv.y, hv.x) - math.radians(-90)        # rig local -Y points at the camera
    T = Matrix.Translation(tgt) @ Matrix.Rotation(rot, 4, 'Z')
    local = {
        'FGB_Key': Vector((math.sin(math.radians(-25)) * math.cos(math.radians(45)), -math.cos(math.radians(25)) * math.cos(math.radians(45)), math.sin(math.radians(45)))) * 3.2,
        'FGB_Rim_L': Vector((-math.sin(math.radians(120)) * 2.2, -math.cos(math.radians(120)) * 2.2, 0.35)),
        'FGB_Rim_R': Vector((math.sin(math.radians(120)) * 2.2, -math.cos(math.radians(120)) * 2.2, 0.35)),
        'FGB_Fill': Vector((0.0, -2.6, -0.35)),
    }
    for n, ob in lights.items():
        ob.location = T @ local[n]
        d = (tgt - ob.location).normalized()
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    backdrop.matrix_world = Matrix.Translation((tgt.x, tgt.y, 0.0)) @ Matrix.Rotation(rot, 4, 'Z')

def frame_points():
    """What every frame must show: the loaded bar at lockout and at both bottoms, the feet, the head and the bench."""
    bar = bpy.data.objects['FG_Bar']; rig = bpy.data.objects['FG_Rig']
    pts = []
    for f in (K['start'], K['r1_bottom'], K['r2_bottom']):
        BENCH.frame_set(f)
        c = bar.matrix_world.translation.copy()
        for sx in (1, -1):
            for dy, dz in ((0.225, 0), (-0.225, 0), (0, 0.225), (0, -0.225)):
                pts.append(c + Vector((sx * (SLEEVE_IN + 0.10), dy, dz)))
            pts.append(c + Vector((sx * SLEEVE_OUT, 0, 0)))
    BENCH.frame_set(1)
    for b in ('foot.L', 'foot.R'):
        pts.append(rig.matrix_world @ rig.pose.bones[b].tail + Vector((0, -0.06, -0.02)))
    pts.append(rig.matrix_world @ rig.pose.bones['head'].tail)
    for y in PAD_Y:
        for x in (-0.25, 0.25):
            pts.append(Vector((x, y, 0.0))); pts.append(Vector((x, y, PAD_Z)))
    return pts

def fit_camera(ob, az, el, lens, aspect, margin=0.06, target=None, pts=None):
    """Place the camera on its fixed bearing so every frame point fits inside the frame with the given margin."""
    pts = pts or frame_points()
    fwd = -cam_vector(az, el)
    right = fwd.cross(Vector((0, 0, 1))).normalized(); up = right.cross(fwd)
    half_w = 18.0 / lens if aspect >= 1 else 18.0 / lens * aspect      # sensor 36 mm on the long side
    half_h = half_w / aspect
    tgt = Vector(target) if target else sum(pts, Vector()) / len(pts)
    for _ in range(3):
        best = None
        for i in range(400):
            d = 1.0 + i * 0.025
            cam = tgt - fwd * d
            ok, xs, ys = True, [], []
            for p in pts:
                v = p - cam; z = v.dot(fwd)
                if z <= 0.1: ok = False; break
                xs.append(v.dot(right) / z / half_w); ys.append(v.dot(up) / z / half_h)
            if ok and max(map(abs, xs)) <= 1 - margin and max(map(abs, ys)) <= 1 - margin:
                best = (d, xs, ys); break
        d, xs, ys = best
        cam = tgt - fwd * d
        # recentre the target on the content
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        zc = (tgt - cam).length
        tgt = tgt + right * cx * zc * half_w + up * cy * zc * half_h
    ob.location = tgt - fwd * d
    ob.rotation_euler = fwd.to_track_quat('-Z', 'Y').to_euler()
    ob.data.lens = lens
    return d

def make_camera(name, coll, angle, lens, dist, target):
    c = CAMERAS[angle]
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cd.lens = lens; cd.sensor_width = 36.0; cd.sensor_fit = 'AUTO'; cd.clip_start = 0.05; cd.clip_end = 60
    ob = bpy.data.objects.get(name)
    if ob is None:
        ob = bpy.data.objects.new(name, cd); coll.objects.link(ob)
    if name.endswith('mobile'):
        # the 4:5 crop: the lifter's torso, arms and the bar path; plates may run off the sides
        pts = [p for p in frame_points() if abs(p.x) < 0.75]
        fit_camera(ob, c['az'], c['el'], lens, 1080 / 1350, margin=0.05, pts=pts)
    else:
        fit_camera(ob, c['az'], c['el'], lens, 1920 / 1080, margin=0.05)
    return ob

def build_studio():
    ST = bcoll('FG_Bench_Stage')
    backdrop = build_sweep_bench(ST)
    lights = bench_lights(ST)
    cams = {a: make_camera(f'FGB_Cam_{a}', ST, a, CAMERAS[a]['lens'], CAMERAS[a]['dist'], CAMERAS[a]['target'])
            for a in CAMERAS}
    cams['mobile'] = make_camera('FGB_Cam_mobile', ST, MOBILE['cam'], MOBILE['lens'], MOBILE['dist'], MOBILE['target'])
    return backdrop, lights, cams

def set_angle(angle, mobile=False):
    """Make one camera active, with the matching resolution, light rig and sweep."""
    sc = BENCH
    backdrop = bpy.data.objects['FG_Bench_Backdrop']
    lights = {n: bpy.data.objects[n] for n in ('FGB_Key', 'FGB_Rim_L', 'FGB_Rim_R', 'FGB_Fill')}
    cam = bpy.data.objects['FGB_Cam_mobile' if mobile else f'FGB_Cam_{angle}']
    place_stage(MOBILE['cam'] if mobile else angle, lights, backdrop, cam)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = (1080, 1350) if mobile else (1920, 1080)
    sc.render.resolution_percentage = 100

# ================================================================ equipment placement
PAD_Y = (-0.30, 0.90)          # pad runs under the glutes to just past the head
BAR_LEN, SLEEVE_IN, SLEEVE_OUT = 2.20, 0.655, 1.10     # IWF men's bar: 2.2 m, sleeves from 0.655 m out

def cyl(name, coll, r, depth, loc, axis='X', mat=None, verts=48):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=depth)
    if axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'Y'))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    ob.location = loc
    if mat: me.materials.append(mat)
    bev = ob.modifiers.new('Bevel', 'BEVEL'); bev.width = min(0.003, r * 0.2); bev.segments = 2; bev.limit_method = 'ANGLE'
    return ob

def box(name, coll, size, loc, mat=None, bevel=0.01):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); ob.location = loc
    if mat: me.materials.append(mat)
    b = ob.modifiers.new('Bevel', 'BEVEL'); b.width = bevel; b.segments = 3
    return ob

def proxy_bench(coll, M):
    """Stand-in flat bench, used only until the downloaded bench is in source/equipment/bench.blend."""
    y0, y1 = PAD_Y; L = y1 - y0; yc = (y0 + y1) / 2
    box('FG_Proxy_BenchPad', coll, (0.29, L, 0.075), (0, yc, PAD_Z - 0.0375), M['pad'], 0.02)
    box('FG_Proxy_BenchBoard', coll, (0.25, L - 0.04, 0.02), (0, yc, PAD_Z - 0.085), M['frame'], 0.004)
    box('FG_Proxy_BenchRail', coll, (0.08, L - 0.30, 0.06), (0, yc, PAD_Z - 0.13), M['frame'], 0.006)
    for yy in (y0 + 0.12, y1 - 0.12):
        box('FG_Proxy_BenchPost', coll, (0.07, 0.07, PAD_Z - 0.17), (0, yy, (PAD_Z - 0.16) / 2), M['frame'], 0.006)
        box('FG_Proxy_BenchFoot', coll, (0.42, 0.07, 0.05), (0, yy, 0.025), M['frame'], 0.006)

def proxy_bar(coll, M, parent):
    """Stand-in Olympic bar with two 20 kg iron plates a side, used only until source/equipment/barbell.blend exists."""
    obs = [cyl('FG_Proxy_BarShaft', coll, BAR_R, 2 * SLEEVE_IN, (0, 0, 0), mat=M['steel'])]
    for s in (1, -1):
        obs.append(cyl(f'FG_Proxy_BarCollar_{s}', coll, 0.031, 0.03, (s * (SLEEVE_IN + 0.015), 0, 0), mat=M['sleeve']))
        obs.append(cyl(f'FG_Proxy_BarSleeve_{s}', coll, 0.025, SLEEVE_OUT - SLEEVE_IN - 0.03,
                       (s * (SLEEVE_IN + 0.03 + (SLEEVE_OUT - SLEEVE_IN - 0.03) / 2), 0, 0), mat=M['sleeve']))
        for k in range(2):
            obs.append(cyl(f'FG_Proxy_Plate_{s}_{k}', coll, 0.225, 0.042, (s * (SLEEVE_IN + 0.055 + k * 0.046), 0, 0),
                           mat=M['plate'], verts=96))
    for o in obs:
        o.parent = parent
    return obs

def fit_equipment(obs, kind, M, bar):
    """Scale/position downloaded models to real-world size, and give them neutral matte materials
    (removes any brand print or coloured plates)."""
    import mathutils
    pts = [o.matrix_world @ Vector(c) for o in obs if o.type == 'MESH' for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    root = bpy.data.objects.new(f'FG_{kind}_Root', None); obs[0].users_collection[0].objects.link(root)
    for o in obs:
        if o.parent is None:
            o.parent = root
    if kind == 'Bench':
        # long axis -> Y, pad top -> PAD_Z, centred on the pad range
        size = hi - lo
        if size.x > size.y:
            root.rotation_euler = (0, 0, math.radians(90))
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in obs if o.type == 'MESH' for c in o.bound_box]
        zmax = max(p.z for p in pts); zmin = min(p.z for p in pts)
        k = PAD_Z / (zmax - zmin)
        root.scale = (k, k, k)
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in obs if o.type == 'MESH' for c in o.bound_box]
        cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2; cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
        root.location = (-cx, (PAD_Y[0] + PAD_Y[1]) / 2 - cy, -min(p.z for p in pts))
        for o in obs:
            if o.type == 'MESH':
                big = o.dimensions.length > 0.6
                o.data.materials.clear(); o.data.materials.append(M['frame'])
    else:
        size = hi - lo
        axis = max(range(3), key=lambda i: size[i])
        if axis == 1: root.rotation_euler = (0, 0, math.radians(90))
        elif axis == 2: root.rotation_euler = (0, math.radians(90), 0)
        bpy.context.view_layer.update()
        k = BAR_LEN / size[axis]
        root.scale = (k, k, k)
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in obs if o.type == 'MESH' for c in o.bound_box]
        c = Vector(((min(p.x for p in pts) + max(p.x for p in pts)) / 2, (min(p.y for p in pts) + max(p.y for p in pts)) / 2,
                    (min(p.z for p in pts) + max(p.z for p in pts)) / 2))
        root.location = -c
        root.parent = bar
        for o in obs:
            if o.type == 'MESH':
                r = max(o.dimensions[1], o.dimensions[2]) * k
                o.data.materials.clear()
                o.data.materials.append(M['plate'] if r > 0.15 else M['steel'])
    return root

def build_equipment(bar):
    EQ = bcoll('FG_Bench_Equipment'); clear_coll(EQ)
    M = equip_materials()
    used = {}
    for fname, kind in (('bench.blend', 'Bench'), ('barbell.blend', 'Bar')):
        obs = append_equipment(fname, EQ)
        if obs:
            fit_equipment(obs, kind, M, bar); used[kind] = 'downloaded'
        else:
            (proxy_bench(EQ, M) if kind == 'Bench' else proxy_bar(EQ, M, bar)); used[kind] = 'proxy'
    print('equipment:', used)
    return used


# ================================================================ entry point
def build(write_events_to=None):
    """Rebuild the whole bench scene from the current product scene (body, suit, logos) and return a report."""
    import time
    t = time.time()
    rig, body, CTL = build_rig_and_suit()
    bar, T, info, rep = build_motion(rig, body, CTL)
    with bpy.context.temp_override(scene=BENCH, view_layer=BENCH.view_layers[0]):
        used = build_equipment(bar)
        build_studio()
        set_angle('threequarter')
        BENCH.frame_set(1)
    ev = write_events(write_events_to) if write_events_to else None
    print(f'bench scene built in {time.time() - t:.1f} s')
    return dict(elbows=rep, equipment=used, events=ev, bar=info)
