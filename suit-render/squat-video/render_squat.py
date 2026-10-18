"""Back-squat frames for the website's 'How it works' scroll: the FormGuard suit on the rigged mannequin, rendered in
Cycles in the product renders' studio. Two passes, rendered as stills:

    frames  1-37  a clean rep: standing -> bottom (frame 19) -> standing
    frames 38-74  the same rep with the left knee caving in: it starts to go late in the descent, is fully in at the
                  bottom (frame 56) and through the first half of the drive, then pushes back out (as the site's rep 7)

    B=/Applications/Blender.app/Contents/MacOS/Blender
    $B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py -- [options]

Options:
    --frames 19,56     only these frames (comma list or a-b range; default all 74)
    --samples 64       Cycles samples (adaptive, denoised)
    --res 900x1200     output size (default 900 x 1200, 3:4)
    --out DIR          where the PNGs go (default squat-video/renders, git-ignored)
    --workbench        flat viewport shading instead of Cycles (motion check only)
    --points FILE      write where the left knee pod is in each frame (0-1 image coordinates, y down) as JSON
                       and stop, without rendering; the site draws its knee callout there

Built in memory from formguard_suit.blend each run (rig, suit binding, bar, studio): the .blend is never saved.
Reuses bench-video/fg_rig.py (skeleton, weights) and the suit binding, helpers and lights of bench-video/fg_bench.py.
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
        body_masks(body)
    for c in ('FG_Shirt_Set', 'FG_Tights_Set', 'FG_Shirt_Details', 'FG_Tights_Details'):
        bpy.data.collections[c].hide_viewport = False; bpy.data.collections[c].hide_render = False
    bind_suit(body, rig, S)
    # the product scene's own suit, mannequin and stage are not part of this shot
    for c in ('FG_Shirt_Set', 'FG_Tights_Set', 'FG_Shirt_Details', 'FG_Tights_Details', 'FG_Stage'):
        if c in bpy.data.collections:
            bpy.data.collections[c].hide_render = True; bpy.data.collections[c].hide_viewport = True
    for n in ('Body_Form', 'FG_Body_Display'):
        o = bpy.data.objects.get(n)
        if o: o.hide_render = True; o.hide_viewport = True
    return rig, body, C

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
        for f, a in (('finger1', 62), ('finger2', 75), ('finger3', 55)):
            rot_world(pb[f'{f}.{side}'], (0, 1, 0), a * s)
        rot_world(pb[f'thumb1.{side}'], (0, 0, 1), -25 * s)
        rot_world(pb[f'thumb2.{side}'], (0, 0, 1), -30 * s)
    rot_world(pb['upper_chest'], (1, 0, 0), -4)                    # chest up
    bpy.context.view_layer.update()
    # the bar rides on the upper back
    bar = empty('FG_Bar', C, bar_rest(body), size=0.3)
    co = bar.constraints.new('CHILD_OF'); co.target = rig; co.subtarget = 'upper_chest'
    co.inverse_matrix = (rig.matrix_world @ pb['upper_chest'].matrix).inverted()
    # legs: feet planted, toes out; knees aim over the toes (pole in front and outside)
    feet, knee_poles = {}, {}
    for s, side in ((1, 'L'), (-1, 'R')):
        tgt = empty(f'FG_IK_Foot.{side}', C, (STANCE_X * s, 0.045, 0.085))
        tgt.rotation_quaternion = (Matrix.Rotation(math.radians(TOE_OUT * s), 3, 'Z') @ rest_rot(rig, f'foot.{side}')).to_quaternion()
        pole = empty(f'FG_Pole_Knee.{side}', C, (0.40 * s, -1.2, 0.5))
        ik = pb[f'shin.{side}'].constraints.new('IK'); ik.target = tgt; ik.pole_target = pole; ik.chain_count = 2; ik.use_tail = True
        cr = pb[f'foot.{side}'].constraints.new('COPY_ROTATION'); cr.target = tgt; cr.target_space = cr.owner_space = 'WORLD'
        feet[side], knee_poles[side] = tgt, (pole, ik)
    # arms: hands on the bar outside the shoulders, elbows down and back
    for s, side in ((1, 'L'), (-1, 'R')):
        tgt = empty(f'FG_IK_Hand.{side}', C, (GRIP_X * s, -0.025, -0.055), parent=bar)
        Q = frame_map(HAND_DIR_REST[side], (-s, 0, 0), (0.0, 0.22, 1.0), (0.15 * -s, -1.0, 0.25))
        tgt.rotation_quaternion = (Q @ rest_rot(rig, f'hand.{side}')).to_quaternion()
        pole = empty(f'FG_Pole_Elbow.{side}', C, (0.30 * s, 0.60, -0.45), parent=bar)   # rides with the bar: low and behind
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

def set_frame_pose(rig, knee_poles, f):
    """Hips (root bone) down, back and leaning; the left knee's pole swings in for the cave. Keyed on frame f."""
    p, cave = phase(f)
    d = depth(p)
    H0 = Vector((0.0, -0.01, 0.92))                                  # rest hip centre
    H = Vector((0.0, -0.01 + HIP_BOT_Y * d, HIP_TOP_Z + (HIP_BOT_Z - HIP_TOP_Z) * d))
    lean = LEAN_BOT * d ** 1.15
    target = Matrix.Translation(H) @ Matrix.Rotation(math.radians(lean), 4, 'X') @ Matrix.Translation(-H0)
    B = rig.data.bones['root'].matrix_local
    pb = rig.pose.bones['root']
    pb.matrix_basis = B.inverted() @ target @ B
    pb.keyframe_insert('location', frame=f); pb.keyframe_insert('rotation_quaternion', frame=f)
    # head: eyes forward and a little down, so the neck stays neutral as the torso leans
    nk = rig.pose.bones['neck']; nk.rotation_quaternion = (1, 0, 0, 0)
    rot_world(nk, (1, 0, 0), -lean * 0.45)
    nk.keyframe_insert('rotation_quaternion', frame=f)
    for side, (pole, ik) in knee_poles.items():
        s = 1 if side == 'L' else -1
        x = 0.40 * s
        if side == 'L': x = x + (CAVE_POLE_X - x) * cave
        pole.location = (x, -1.2, 0.5); pole.keyframe_insert('location', frame=f)

def animate(rig, knee_poles):
    for f in list(CLEAN) + list(CAVE):
        set_frame_pose(rig, knee_poles, f)
    for ob in [rig] + [p for p, _ in knee_poles.values()]:
        act = ob.animation_data.action if ob.animation_data else None
        if not act: continue
        fcs = list(act.fcurves) if hasattr(act, 'fcurves') else [fc for l in act.layers for st in l.strips for bag in st.channelbags for fc in bag.fcurves]
        for fc in fcs:
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'

# ================================================================ studio
def studio(rig):
    ST = coll('FG_Squat_Stage')
    backdrop = build_sweep_bench(ST)
    lights = bench_lights(ST)
    cd = bpy.data.cameras.new('FGS_Cam'); cd.lens = CAM['lens']; cd.sensor_width = 36.0; cd.sensor_fit = 'AUTO'
    cam = bpy.data.objects.new('FGS_Cam', cd); ST.objects.link(cam); SC.camera = cam
    # camera bearing: in front of the lifter (-Y), turned towards their left (+X)
    a, e = math.radians(CAM['az']), math.radians(CAM['el'])
    v = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    # fit the standing lifter with the loaded bar, and the bottom position
    pts = []
    for f in (1, BOTTOM, 60):
        SC.frame_set(f)
        bar = bpy.data.objects['FG_Bar'].matrix_world.translation
        for sx in (1, -1):
            for dy, dz in ((0, 0.225), (0, -0.225), (0.2, 0), (-0.2, 0)):
                pts.append(bar + Vector((sx * (SLEEVE_IN + 0.10), dy, dz)))
        pts.append(rig.matrix_world @ rig.pose.bones['head'].tail + Vector((0, 0, 0.03)))
    for sx in (1, -1):
        pts.append(Vector((sx * (STANCE_X + 0.05), -0.20, 0.0)))
    SC.frame_set(1)
    W, Hh = res()
    az_deg = math.degrees(math.atan2(v.y, v.x))
    fwd = -v
    right = fwd.cross(Vector((0, 0, 1))).normalized(); up = right.cross(fwd)
    asp = W / Hh
    half_h = 18.0 / CAM['lens']; half_w = half_h * asp               # sensor fit: 36 mm on the long (vertical) side
    tgt = sum(pts, Vector()) / len(pts)
    for _ in range(3):
        for i in range(400):
            dist = 1.5 + i * 0.02
            c = tgt - fwd * dist
            xs, ys = [], []
            for p in pts:
                q = p - c; z = q.dot(fwd)
                xs.append(q.dot(right) / z / half_w); ys.append(q.dot(up) / z / half_h)
            if max(map(abs, xs)) <= 0.95 and max(map(abs, ys)) <= 0.93: break
        cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        tgt = tgt + right * cx * dist * half_w + up * cy * dist * half_h
    cam.location = tgt - fwd * dist
    cam.rotation_euler = fwd.to_track_quat('-Z', 'Y').to_euler()
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
    for n, ob in lights.items():
        ob.location = T @ local[n]
        ob.rotation_euler = (Vector((0, 0, 1.0)) - ob.location).normalized().to_track_quat('-Z', 'Y').to_euler()
    backdrop.matrix_world = Matrix.Rotation(rot, 4, 'Z')
    print(f'[squat] camera at {dist:.2f} m, bearing {CAM["az"]} deg')

def res():
    r = opt('--res') or '900x1200'
    return tuple(int(x) for x in r.split('x'))

# ================================================================ run
t0 = time.time()
with bpy.context.temp_override(scene=SC, view_layer=SC.view_layers[0]):
    rig, body, C = build()
    SC.frame_set(1)
    bar, knee_poles = pose_rig(rig, C, body)
    animate(rig, knee_poles)
    M = equip_materials()
    # plates face the key light here (they're edge-on on the bench): darker, rougher iron so they don't read as pale discs
    M['plate'] = principled('FG_Eq_PlateIron_Squat', '#121110', rough=0.85, metallic=0.1, spec=0.25)
    proxy_bar(C, M, bar)
    studio(rig)
print(f'[squat] built in {time.time() - t0:.0f} s', flush=True)

SC.view_settings.exposure = -2.7                 # the product renders use -3.2 with the same wattages; a touch brighter for the web
W, Hh = res()
SC.render.resolution_x, SC.render.resolution_y, SC.render.resolution_percentage = W, Hh, 100
SC.render.image_settings.file_format = 'PNG'; SC.render.image_settings.color_depth = '16'
if opt('--workbench'):
    SC.render.engine = 'BLENDER_WORKBENCH'
    sh = SC.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True
    SC.view_settings.exposure = 0.0; SC.view_settings.view_transform = 'Standard'
else:
    SC.render.engine = 'CYCLES'
    SC.cycles.samples = int(opt('--samples', 64)); SC.cycles.use_denoising = True; SC.cycles.use_adaptive_sampling = True
fr = opt('--frames')
if isinstance(fr, str):
    frames = list(range(int(fr.split('-')[0]), int(fr.split('-')[1]) + 1)) if '-' in fr else [int(x) for x in fr.split(',')]
else:
    frames = list(CLEAN) + list(CAVE)
if opt("--debug"): exec(open(opt("--debug")).read()); raise SystemExit(0)
if isinstance(opt('--points'), str):
    import json
    from bpy_extras.object_utils import world_to_camera_view
    knee = []
    for f in list(CLEAN) + list(CAVE):
        SC.frame_set(f)
        # the knee: the shin bone's head, nudged to the front of the joint (where the leg's surface is)
        k = rig.matrix_world @ rig.pose.bones['shin.L'].head
        v = world_to_camera_view(SC, SC.camera, k)
        knee.append([round(v.x, 4), round(1 - v.y, 4)])
    with open(opt('--points'), 'w') as fh:
        json.dump({'frames': len(knee), 'clean': [CLEAN.start, CLEAN.stop - 1], 'cave': [CAVE.start, CAVE.stop - 1],
                   'size': list(res()), 'kneeL': knee}, fh, separators=(',', ':'))
    print('[squat] points ->', opt('--points')); raise SystemExit(0)
for f in frames:
    t = time.time()
    SC.frame_set(f)
    SC.render.filepath = os.path.join(OUT, f'squat-{f:03d}.png')
    bpy.ops.render.render(write_still=True, scene=SC.name)
    print(f'[squat] frame {f} in {time.time() - t:.0f} s', flush=True)
