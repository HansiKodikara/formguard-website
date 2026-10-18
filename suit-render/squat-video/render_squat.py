"""Back-squat frames for the website's 'How it works' scroll: the FormGuard suit on the rigged lifter, rendered in
Cycles with the product renders' studio lights, on a transparent background
(for the page's own background, which draws the floor shadow; --sweep for the dark studio sweep).

One take along the scroll: the lifter does the site's story (timeline.json, from scripts/squat-timeline.mjs) while
the camera moves through SHOTS. The poses come from a motion library keyed on frames 1-74:

    frames  1-37  a clean rep: standing -> bottom (frame 19) -> standing
    frames 38-74  the same rep with the left knee caving in: it starts to go late in the descent, is fully in at the
                  bottom (frame 56) and through the first half of the drive, then pushes back out (as the site's rep 7)

    B=/Applications/Blender.app/Contents/MacOS/Blender
    $B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py -- [options]

Options:
    --frames 19,56     only these output frames (comma list or a-b range; default all)
    --story 170        how many output frames the take has
    --timeline FILE    the story (default squat-video/timeline.json)
    --samples 64       Cycles samples (adaptive, denoised)
    --res 900x1200     output size (default 900 x 1200, 3:4)
    --out DIR          where the PNGs go (default squat-video/renders, git-ignored)
    --dqs              keep 'preserve volume' skinning (the bench video's), for comparison
    --sweep            render on the product renders' dark studio sweep instead of a transparent background
    --simple           pose from the simple depth curves instead of the MyoSuite motion (squat-motion.json)
    --motion FILE      MyoSuite motion to use (default squat-video/squat-motion.json, from myo_squat.py)
    --workbench        flat viewport shading instead of Cycles (motion check only)
    --points FILE      write each frame's scroll position, the left knee and the floor shadow (0-1 image
                       coordinates, y down) as JSON and stop, without rendering (src/viz/squatFrames.json)

Built in memory from formguard_suit.blend each run (rig, suit binding, bar, studio): the .blend is never saved.
Reuses bench-video/fg_rig.py (skeleton, weights; fg_hand.py replaces its fingers, fg_skin.py adds skin and eyes) and the suit binding, helpers and lights of bench-video/fg_bench.py.
"""
import bpy, sys, os, math, time, numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default

HERE = os.path.dirname(os.path.abspath(__file__))           # suit-render/squat-video
FG_ROOT = os.path.dirname(HERE)
SCRIPTS = os.path.join(FG_ROOT, 'scripts')
BENCH_DIR = os.path.join(FG_ROOT, 'bench-video')
G = globals(); G['FG_ROOT'] = FG_ROOT; G['BENCH_DIR'] = BENCH_DIR
for f in ('fg_lib.py', 'fg_scene.py'):
    exec(open(os.path.join(SCRIPTS, f)).read(), G)
for f in ('fg_rig.py', 'fg_bench.py'):
    exec(open(os.path.join(BENCH_DIR, f)).read(), G)
for f in ('fg_hand.py', 'fg_skin.py'):
    exec(open(os.path.join(HERE, f)).read(), G)
# fg_bench makes an (empty) FG_Bench scene on load; this script works in the product scene
SC = bpy.data.scenes['Scene']
if 'FG_Bench' in bpy.data.scenes: bpy.data.scenes.remove(bpy.data.scenes['FG_Bench'])
bpy.context.window_manager  # noqa
OUT = os.path.abspath(opt('--out') or os.path.join(HERE, 'renders'))
os.makedirs(OUT, exist_ok=True)

def coll(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in SC.collection.children: SC.collection.children.link(c)
    return c

# ================================================================ settings
CLEAN, CAVE = range(1, 38), range(38, 75)     # frame ranges of the two passes
BOTTOM = 19
STANCE_X, TOE_OUT = 0.235, 16.0               # ankle centre from the midline (m), toes turned out (deg)
HIP_TOP_Z = 0.902                             # standing: legs all but straight
HIP_BOT_Z, HIP_BOT_Y = 0.505, 0.215           # bottom: hip crease just below the knee, hips back
LEAN_BOT = 36.0                               # torso lean from vertical at the bottom (deg)
GRIP_X = 0.42                                 # hands on the bar
CAVE_POLE_X = -0.85                           # left knee's aim at the worst of the cave (clean: +0.40, over the toes)
# camera: azimuth from straight in front of the lifter towards their left (deg), elevation, lens
CAM = dict(az=28.0, el=9.0, lens=55.0)

def depth(p):
    return math.sin(math.pi * p) ** 2            # slow at the top and the bottom

def sstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def phase(f):
    """0 -> 1 over a rep (0.5 = bottom) for each frame, and how much the left knee caves (0 -> 1). The cave follows
    the site's rep 7 (src/viz/how.ts): in from depth 0.8 on the way down, fully in at the bottom, out again between
    depth 0.75 and 0.2 on the way up."""
    if f in CLEAN: return (f - 1) / 36.0, 0.0
    p = (f - 38) / 36.0
    d = depth(p)
    return p, (sstep(0.8, 1.0, d) if p <= 0.5 else sstep(0.2, 0.75, d))

# ================================================================ build: body, skeleton, suit
def build():
    R = coll('FG_Squat_Rig'); S = coll('FG_Squat_Suit'); C = coll('FG_Squat_Controls')
    body = build_body(R)
    with bpy.context.temp_override(scene=SC, view_layer=SC.view_layers[0]):
        rig = rig_body(body, R)
        hand_rig(rig, body)
        body_masks(body)
    body.data.materials.clear(); body.data.materials.append(skin_material(body))
    add_eyes(rig, R)
    for c in ('FG_Shirt_Set', 'FG_Tights_Set', 'FG_Shirt_Details', 'FG_Tights_Details'):
        bpy.data.collections[c].hide_viewport = False; bpy.data.collections[c].hide_render = False
    pieces = bind_suit(body, rig, S)
    if not opt('--dqs'):
        smooth_skinning([body] + pieces)
    # the product scene's own suit, mannequin and stage are not part of this shot
    for c in ('FG_Shirt_Set', 'FG_Tights_Set', 'FG_Shirt_Details', 'FG_Tights_Details', 'FG_Stage'):
        if c in bpy.data.collections:
            bpy.data.collections[c].hide_render = True; bpy.data.collections[c].hide_viewport = True
    for n in ('Body_Form', 'FG_Body_Display'):
        o = bpy.data.objects.get(n)
        if o: o.hide_render = True; o.hide_viewport = True
    return rig, body, C

def smooth_skinning(obs):
    """Plain (linear) skinning instead of 'preserve volume', which balloons the shoulders, traps and knees in big
    bends; a Corrective Smooth after it relaxes the creases back towards the rest shape."""
    for ob in obs:
        arm = next((m for m in ob.modifiers if m.type == 'ARMATURE'), None)
        if arm is None: continue
        arm.use_deform_preserve_volume = False
        cs = ob.modifiers.new('CorrectiveSmooth', 'CORRECTIVE_SMOOTH')
        cs.rest_source = 'ORCO'; cs.smooth_type = 'LENGTH_WEIGHTED'; cs.iterations = 12; cs.factor = 0.5
        cs.use_only_smooth = False; cs.use_pin_boundary = True
        i = list(ob.modifiers).index(arm) + 1
        while list(ob.modifiers).index(cs) > i:
            ob.modifiers.move(list(ob.modifiers).index(cs), list(ob.modifiers).index(cs) - 1)

def bar_rest(body):
    """Where the bar sits on the standing lifter: high bar, on the top of the traps just below C7."""
    P = body_world_verts(body)
    m = (np.abs(P[:, 0]) > 0.05) & (np.abs(P[:, 0]) < 0.10) & (P[:, 1] > 0.02) & (P[:, 1] < 0.12) & (P[:, 2] > 1.38) & (P[:, 2] < 1.53)
    top = P[m][np.argmax(P[m][:, 2])]
    return Vector((0.0, float(top[1]) + 0.004, float(top[2]) + BAR_R + 0.004))

def pose_rig(rig, C, body):
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'QUATERNION'; b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)
        for c in list(b.constraints): b.constraints.remove(c)
    for s, side in ((1, 'L'), (-1, 'R')):
        rot_world(pb[f'clavicle.{side}'], (0, 0, 1), 4 * s)       # shoulder blades a little back under the bar
    rot_world(pb['upper_chest'], (1, 0, 0), -4)                    # chest up
    bpy.context.view_layer.update()
    # the bar rides on the upper back
    bar = empty('FG_Bar', C, bar_rest(body), size=0.3)
    co = bar.constraints.new('CHILD_OF'); co.target = rig; co.subtarget = 'upper_chest'
    co.inverse_matrix = (rig.matrix_world @ pb['upper_chest'].matrix).inverted()
    # legs: feet planted, toes out; knees aim over the toes (pole in front and outside)
    feet, knee_poles = {}, {}
    for s, side in ((1, 'L'), (-1, 'R')):
        foot_at = MAP(MOTION[1]['ankle' + side]) if MOTION else Vector((STANCE_X * s, 0.045, 0.085))
        tgt = empty(f'FG_IK_Foot.{side}', C, foot_at)
        tgt.rotation_quaternion = (Matrix.Rotation(math.radians(TOE_OUT * s), 3, 'Z') @ rest_rot(rig, f'foot.{side}')).to_quaternion()
        pole = empty(f'FG_Pole_Knee.{side}', C, (0.40 * s, -1.2, 0.5))
        ik = pb[f'shin.{side}'].constraints.new('IK'); ik.target = tgt; ik.pole_target = pole; ik.chain_count = 2; ik.use_tail = True
        cr = pb[f'foot.{side}'].constraints.new('COPY_ROTATION'); cr.target = tgt; cr.target_space = cr.owner_space = 'WORLD'
        feet[side], knee_poles[side] = tgt, (pole, ik)
    # arms: hands on the bar outside the shoulders, elbows down and back
    for s, side in ((1, 'L'), (-1, 'R')):
        # hands behind the bar, fingers over the top of it towards the front, palms facing forward
        tgt = empty(f'FG_IK_Hand.{side}', C, (GRIP_X * s, 0.035, -0.05), parent=bar)
        Q = frame_map(HAND_DIR_REST[side], (-s, 0, 0), (0.0, -0.30, 1.0), (0.10 * -s, -1.0, -0.30))
        tgt.rotation_quaternion = (Q @ rest_rot(rig, f'hand.{side}')).to_quaternion()
        pole = empty(f'FG_Pole_Elbow.{side}', C, (0.28 * s, 0.35, -0.80), parent=bar)   # rides with the bar: elbows down and a little back
        ik = pb[f'forearm.{side}'].constraints.new('IK'); ik.target = tgt; ik.pole_target = pole; ik.chain_count = 2; ik.use_tail = True
        cr = pb[f'hand.{side}'].constraints.new('COPY_ROTATION'); cr.target = tgt; cr.target_space = cr.owner_space = 'WORLD'
    set_frame_pose(rig, knee_poles, BOTTOM)          # calibrate the poles with the joints bent, where they're unambiguous
    bpy.context.view_layer.update()
    for side in ('L', 'R'):
        print('[squat] knee pole', side, fine_pole(rig, side, *reversed(knee_poles[side]), chain=('thigh', 'shin', 'foot')))
        print('[squat] elbow pole', side, fine_pole(rig, side, pb[f'forearm.{side}'].constraints['IK'], bpy.data.objects[f'FG_Pole_Elbow.{side}']))
    return bar, knee_poles

def fine_pole(rig, side, ik, pole, chain=('upper_arm', 'forearm', 'hand')):
    """Like fg_bench.calibrate_pole, but in 5-degree steps: put the middle joint as far towards its pole as it goes."""
    best = None
    for ang in range(-180, 180, 5):
        ik.pole_angle = math.radians(ang)
        bpy.context.view_layer.update()
        a, m, b = (world_head(rig, f'{x}.{side}') for x in chain)
        line = (b - a).normalized()
        def off(p):
            v = p - a; return (v - line * v.dot(line)).normalized()
        score = off(m).dot(off(pole.matrix_world.translation))
        if best is None or score > best[0]: best = (score, ang)
    ik.pole_angle = math.radians(best[1])
    return best

# ---------------------------------------------------------------- the motion: MyoSuite (myo_squat.py), or the simple curves
import json
MOTION_FILE = opt('--motion') or os.path.join(HERE, 'squat-motion.json')
MOTION = None if opt('--simple') or not os.path.exists(MOTION_FILE) else {fr['frame']: fr for fr in json.load(open(MOTION_FILE))['frames']}
TILT_SHARE = 0.82                    # pelvis tilt / torso lean, as in myo_squat.py; the spine bends the rest
H0 = Vector((0.0, -0.01, 0.92))      # this rig's rest hip centre
ANKLE_REST = Vector((0.0, 0.045, 0.085))
def myo_map():
    """MyoLeg -> this body: scale by leg length (hip to ankle), feet at this rig's ankles on frame 1."""
    f1 = MOTION[1]
    hipm = (Vector(f1['hipL']) + Vector(f1['hipR'])) / 2; ankm = (Vector(f1['ankleL']) + Vector(f1['ankleR'])) / 2
    k = 0.842 / (Vector(f1['hipL']) - Vector(f1['ankleL'])).length * 1.0
    return lambda v: (Vector(v) - ankm) * k + ANKLE_REST
MAP = myo_map() if MOTION else None

def set_frame_pose(rig, knee_poles, f):
    """Keyed on frame f. With MyoSuite motion: hips, pelvis tilt and torso lean from the solved skeleton, each knee
    pointed at the solved knee, feet where the solver planted them. Without: the simple depth curves."""
    p, cave = phase(f)
    d = depth(p)
    if MOTION:
        fr = MOTION[f]
        H = MAP(fr['hip_c']); lean = fr['pitch']; tilt = lean * TILT_SHARE
    else:
        H = Vector((0.0, -0.01 + HIP_BOT_Y * d, HIP_TOP_Z + (HIP_BOT_Z - HIP_TOP_Z) * d))
        lean = LEAN_BOT * d ** 1.15; tilt = lean
    target = Matrix.Translation(H) @ Matrix.Rotation(math.radians(tilt), 4, 'X') @ Matrix.Translation(-H0)
    B = rig.data.bones['root'].matrix_local
    pb = rig.pose.bones['root']
    pb.matrix_basis = B.inverted() @ target @ B
    pb.keyframe_insert('location', frame=f); pb.keyframe_insert('rotation_quaternion', frame=f)
    # the rest of the lean in the spine (the pelvis carries TILT_SHARE of it)
    for bn, share in (('spine', 0.5), ('chest', 0.5)):
        sb = rig.pose.bones[bn]; sb.rotation_quaternion = (1, 0, 0, 0)
        rot_world(sb, (1, 0, 0), (lean - tilt) * share)
        sb.keyframe_insert('rotation_quaternion', frame=f)
    # head: eyes forward and a little down, so the neck stays neutral as the torso leans
    nk = rig.pose.bones['neck']; nk.rotation_quaternion = (1, 0, 0, 0)
    rot_world(nk, (1, 0, 0), -lean * 0.45)
    nk.keyframe_insert('rotation_quaternion', frame=f)
    for side, (pole, ik) in knee_poles.items():
        s = 1 if side == 'L' else -1
        if MOTION:
            hip, knee, ank = MAP(fr['hip' + side]), MAP(fr['knee' + side]), MAP(fr['ankle' + side])
            out = knee - (hip + ank) / 2
            if out.length < 0.02:                       # legs straight: aim the knee over the toes
                out = Vector((math.sin(math.radians(TOE_OUT)) * s, -1, 0))
            pole.location = knee + out.normalized() * 0.6
        else:
            x = 0.40 * s
            if side == 'L': x = x + (CAVE_POLE_X - x) * cave
            pole.location = (x, -1.2, 0.5)
        pole.keyframe_insert('location', frame=f)

def animate(rig, knee_poles):
    for f in list(CLEAN) + list(CAVE):
        set_frame_pose(rig, knee_poles, f)
    for ob in [rig] + [p for p, _ in knee_poles.values()]:
        act = ob.animation_data.action if ob.animation_data else None
        if not act: continue
        fcs = list(act.fcurves) if hasattr(act, 'fcurves') else [fc for l in act.layers for st in l.strips for bag in st.channelbags for fc in bag.fcurves]
        for fc in fcs:
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

# ================================================================ studio and camera
# The camera moves with the scroll, as the site's earlier real-time lifter did: five shots, one per step of the
# story, and the camera always on its way from one to the next (p = scroll progress 0..1; shot i is at p = 0.1 +
# 0.2 i). az: bearing from straight in front of the lifter towards their left (deg); el: elevation (deg); zoom:
# distance as a share of the distance that fits the whole lift; focus: 0 aims at the whole lift, 1 at the knees.
SHOTS = [
    dict(az=30.0, el=10.0, zoom=1.00, focus=0.0),     # 0 the suit: three-quarter front, from their left
    dict(az=-32.0, el=6.0, zoom=1.03, focus=0.0),     # 1 warm-up: round to their right
    dict(az=6.0, el=3.0, zoom=0.90, focus=0.15),      # 2 every rep checked: square on, where a knee caving shows
    dict(az=16.0, el=1.0, zoom=0.56, focus=1.0),      # 3 told mid-set: in close on the knees
    dict(az=38.0, el=11.0, zoom=1.06, focus=0.0),     # 4 between sets: back out
]

def sstep01(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)

def shot_at(p):
    x = min(4.0, max(0.0, p * 5 - 0.5))
    i = min(3, int(x)); k = sstep01(x - i)
    a, b = SHOTS[i], SHOTS[i + 1]
    return {key: a[key] + (b[key] - a[key]) * k for key in a}

def cam_dir(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))

class Studio:
    def __init__(self, rig):
        ST = coll('FG_Squat_Stage')
        self.backdrop = build_sweep_bench(ST)
        self.lights = bench_lights(ST)
        cd = bpy.data.cameras.new('FGS_Cam'); cd.lens = CAM['lens']; cd.sensor_width = 36.0; cd.sensor_fit = 'AUTO'
        self.cam = bpy.data.objects.new('FGS_Cam', cd); ST.objects.link(self.cam); SC.camera = self.cam
        # what has to fit: the standing lifter with the loaded bar, and the bottom of both reps
        pts = []
        for f in (1, BOTTOM, 56):
            SC.frame_set(f)
            bar = bpy.data.objects['FG_Bar'].matrix_world.translation
            for sx in (1, -1):
                for dy, dz in ((0, 0.225), (0, -0.225), (0.2, 0), (-0.2, 0)):
                    pts.append(bar + Vector((sx * (SLEEVE_IN + 0.10), dy, dz)))
            pts.append(rig.matrix_world @ rig.pose.bones['head'].tail + Vector((0, 0, 0.03)))
        for sx in (1, -1):
            pts.append(Vector((sx * (STANCE_X + 0.05), -0.20, 0.0)))
        self.pts = pts
        # the knees at the bottom of the caving rep: the close shot's aim
        SC.frame_set(56)
        kn = [rig.matrix_world @ rig.pose.bones[f'shin.{sd}'].head for sd in ('L', 'R')]
        self.knees = (kn[0] + kn[1]) / 2 + Vector((0, 0, -0.04))
        SC.frame_set(1)
        self.fits = [self.fit(sh['az'], sh['el']) for sh in SHOTS]
        if not opt('--sweep'):
            self.backdrop.hide_render = True      # transparent: the page is the background

    def fit(self, az, el):
        """Camera target and distance that frame the whole lift from this bearing."""
        v = cam_dir(az, el); fwd = -v
        right = fwd.cross(Vector((0, 0, 1))).normalized(); up = right.cross(fwd)
        W, Hh = res(); asp = W / Hh
        half_h = 18.0 / CAM['lens']; half_w = half_h * asp           # sensor fit: 36 mm on the long (vertical) side
        tgt = sum(self.pts, Vector()) / len(self.pts)
        for _ in range(3):
            for i in range(400):
                dist = 1.5 + i * 0.02
                c = tgt - fwd * dist
                xs, ys = [], []
                for p in self.pts:
                    q = p - c; z = q.dot(fwd)
                    xs.append(q.dot(right) / z / half_w); ys.append(q.dot(up) / z / half_h)
                if max(map(abs, xs)) <= 0.95 and max(map(abs, ys)) <= 0.93: break
            cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
            tgt = tgt + right * cx * dist * half_w + up * cy * dist * half_h
        return tgt, dist

    def aim(self, p):
        x = min(4.0, max(0.0, p * 5 - 0.5)); i = min(3, int(x)); k = sstep01(x - i)
        sh = shot_at(p)
        (t0, d0), (t1, d1) = self.fits[i], self.fits[i + 1]
        tgt = t0.lerp(t1, k); dist = (d0 + (d1 - d0) * k) * sh['zoom']
        tgt = tgt.lerp(self.knees, sh['focus'])
        v = cam_dir(sh['az'], sh['el'])
        self.cam.location = tgt + v * dist
        self.cam.rotation_euler = (-v).to_track_quat('-Z', 'Y').to_euler()
        # the light rig and sweep turn with the camera, as in the product shots
        hv = Vector((v.x, v.y, 0)).normalized()
        rot = math.atan2(hv.y, hv.x) - math.radians(-90)
        T = Matrix.Translation((0, 0, 1.0)) @ Matrix.Rotation(rot, 4, 'Z')
        local = {
            'FGB_Key': Vector((math.sin(math.radians(-25)) * math.cos(math.radians(45)), -math.cos(math.radians(25)) * math.cos(math.radians(45)), math.sin(math.radians(45)))) * 3.2,
            'FGB_Rim_L': Vector((-math.sin(math.radians(120)) * 2.2, -math.cos(math.radians(120)) * 2.2, 0.35)),
            'FGB_Rim_R': Vector((math.sin(math.radians(120)) * 2.2, -math.cos(math.radians(120)) * 2.2, 0.35)),
            'FGB_Fill': Vector((0.0, -2.6, -0.35)),
        }
        for n, ob in self.lights.items():
            ob.location = T @ local[n]
            ob.rotation_euler = (Vector((0, 0, 1.0)) - ob.location).normalized().to_track_quat('-Z', 'Y').to_euler()
        self.backdrop.matrix_world = Matrix.Rotation(rot, 4, 'Z')
        return sh

def res():
    r = opt('--res') or '900x1200'
    return tuple(int(x) for x in r.split('x'))

# ================================================================ the story: output frames along the scroll
def pose_gap(a, b):
    """How far the lifter moves between two moments of the motion library, in library frames. Frames 1, 37 and 38
    are all standing, so passing between reps costs nothing."""
    def q(m): return (m - 1) if m < 37.5 else (m - 38)
    d = abs(q(a) - q(b))
    return min(d, abs(36 - d)) if (min(a, b) < 37.5 <= max(a, b) or d > 18) else d

def story(n):
    """n output frames along the scroll, placed so each step between them is about equally big: the lifter moving
    1.3 library frames, the camera turning 2 degrees, rising 1 degree or moving in 2.5 % count the same."""
    T = json.load(open(opt('--timeline') or os.path.join(HERE, 'timeline.json')))['motion']
    S = len(T); ps = [j / (S - 1) for j in range(S)]
    shots = [shot_at(p) for p in ps]
    cost = [0.0]
    for j in range(1, S):
        a, b = shots[j - 1], shots[j]
        c = pose_gap(T[j - 1], T[j]) / 1.3 + abs(a['az'] - b['az']) / 2.0 + abs(a['el'] - b['el']) / 1.0 \
            + abs(a['zoom'] - b['zoom']) / 0.025 + abs(a['focus'] - b['focus']) / 0.05
        cost.append(cost[-1] + c)
    out, j = [], 0
    for i in range(n):
        want = cost[-1] * i / (n - 1)
        while j < S - 1 and cost[j + 1] <= want: j += 1
        jj = j if (j == S - 1 or want - cost[j] <= cost[j + 1] - want) else j + 1
        out.append((ps[jj], T[jj]))
    return out

def show(rig, studio, p, m):
    f = int(math.floor(m)); SC.frame_set(f, subframe=m - f)
    return studio.aim(p)

# ================================================================ run
t0 = time.time()
with bpy.context.temp_override(scene=SC, view_layer=SC.view_layers[0]):
    rig, body, C = build()
    SC.frame_set(1)
    bar, knee_poles = pose_rig(rig, C, body)
    animate(rig, knee_poles)
    SC.frame_set(1)
    grip(rig, bpy.data.objects['FG_Bar'], BAR_R)
    M = equip_materials()
    # plates face the key light here (they're edge-on on the bench): darker, rougher iron so they don't read as pale discs
    M['plate'] = principled('FG_Eq_PlateIron_Squat', '#121110', rough=0.85, metallic=0.1, spec=0.25)
    proxy_bar(C, M, bar)
    studio = Studio(rig)
print(f'[squat] built in {time.time() - t0:.0f} s', flush=True)

SC.view_settings.exposure = -2.7 if opt('--sweep') else -2.2   # product renders: -3.2, same wattages; brighter for a light page
W, Hh = res()
SC.render.resolution_x, SC.render.resolution_y, SC.render.resolution_percentage = W, Hh, 100
SC.render.image_settings.file_format = 'PNG'; SC.render.image_settings.color_depth = '16'
SC.render.film_transparent = not opt('--sweep')
SC.render.image_settings.color_mode = 'RGB' if opt('--sweep') else 'RGBA'
if opt('--workbench'):
    SC.render.engine = 'BLENDER_WORKBENCH'
    sh = SC.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True
    SC.view_settings.exposure = 0.0; SC.view_settings.view_transform = 'Standard'
else:
    SC.render.engine = 'CYCLES'
    SC.cycles.samples = int(opt('--samples', 64)); SC.cycles.use_denoising = True; SC.cycles.use_adaptive_sampling = True
STORY = story(int(opt('--story', 170)))
N = len(STORY)
fr = opt('--frames')
if isinstance(fr, str):
    frames = list(range(int(fr.split('-')[0]), int(fr.split('-')[1]) + 1)) if '-' in fr else [int(x) for x in fr.split(',')]
else:
    frames = list(range(1, N + 1))
if opt("--debug"): exec(open(opt("--debug")).read()); raise SystemExit(0)
if isinstance(opt('--points'), str):
    from bpy_extras.object_utils import world_to_camera_view
    def px(v):
        q = world_to_camera_view(SC, SC.camera, v); return q.x, 1 - q.y
    knee, floor = [], []
    feet = None
    for p, m in STORY:
        show(rig, studio, p, m)
        bpy.context.view_layer.update()
        # the knee: the shin bone's head (the joint centre)
        knee.append([round(c, 4) for c in px(rig.matrix_world @ rig.pose.bones['shin.L'].head)])
        if feet is None:
            fp = [rig.matrix_world @ rig.pose.bones[f'foot.{sd}'].head for sd in ('L', 'R')] + \
                 [rig.matrix_world @ rig.pose.bones[f'foot.{sd}'].tail for sd in ('L', 'R')]
            feet = sum(fp, Vector()) / 4; feet.z = 0.0
        # the floor under the feet, for the site's contact shadow: an ellipse round both feet, as the camera sees it
        ring = [px(feet + Vector((0.42 * math.cos(t), 0.26 * math.sin(t), 0))) for t in np.linspace(0, 2 * math.pi, 24, endpoint=False)]
        floor.append([round(min(x for x, _ in ring), 4), round(max(x for x, _ in ring), 4),
                      round(min(y for _, y in ring), 4), round(max(y for _, y in ring), 4)])
    with open(opt('--points'), 'w') as fh:
        json.dump({'frames': N, 'size': list(res()), 'p': [round(p, 5) for p, _ in STORY], 'floor': floor, 'kneeL': knee},
                  fh, separators=(',', ':'))
    print('[squat] points ->', opt('--points')); raise SystemExit(0)
for i in frames:
    t = time.time()
    p, m = STORY[i - 1]
    show(rig, studio, p, m)
    SC.render.filepath = os.path.join(OUT, f'squat-{i:03d}.png')
    bpy.ops.render.render(write_still=True, scene=SC.name)
    print(f'[squat] frame {i}/{N} (scroll {p:.3f}, motion {m:.2f}) in {time.time() - t:.0f} s', flush=True)
