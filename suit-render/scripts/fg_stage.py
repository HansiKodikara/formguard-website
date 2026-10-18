"""Studio: sweep backdrop, key/rim/fill lights, 85 mm camera, ghost body, and the five shots."""
import bpy, bmesh, math, os, builtins, numpy as np
from mathutils import Vector, Matrix, Euler
sc = bpy.context.scene
M = builtins.FG_M
C_STAGE = collection('FG_Stage')
OUT_DIR = os.path.join(FG_ROOT, 'FormGuard_Renders')
# the brief's real-world wattages are kept; exposure brings the dark studio into range
EXPOSURE = -3.2
sc.view_settings.exposure = EXPOSURE

# ---------------------------------------------------------------- body: a ghost for the product shots, a mannequin for the body shots
body = bpy.data.objects['Body_Form']
RAYS = ('visible_camera', 'visible_shadow', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter')
# a matte, warm-stone mannequin: neutral, no red, so the suit and its pods carry the colour
M['mannequin'] = principled('FG_Mannequin', '#A39B8F', rough=0.5, spec=0.35, sheen=0.1, sheen_tint='#F2EDE4')

def display_body():
    """The body as shown in the body shots: a copy of Body_Form's mesh, so the garments (shrinkwrapped to Body_Form)
    never change. Under the tights' crotch panel the base mesh's anatomy would push through the fabric, so that small,
    fully covered patch is masked out."""
    ob = bpy.data.objects.get('FG_Body_Display')
    if ob is None:
        me = body.data.copy(); me.name = 'FG_Body_Display'
        ob = bpy.data.objects.new('FG_Body_Display', me); C_STAGE.objects.link(ob)
        ob.matrix_world = body.matrix_world.copy()
        me.materials.clear(); me.materials.append(M['mannequin'])
        for p in me.polygons: p.use_smooth = True
        vg = ob.vertex_groups.new(name='under_crotch_panel')
        c, rad, sc3 = Vector((0.0, -0.118, 0.862)), 0.062 * 1.5, (0.7, 1.3, 1.0)
        mw = ob.matrix_world
        hide = [v.index for v in me.vertices
                if sum((((mw @ v.co)[i] - c[i]) / (rad * sc3[i])) ** 2 for i in range(3)) < 1.0]
        vg.add(hide, 1.0, 'REPLACE')
        mk = ob.modifiers.new('HideUnderPanel', 'MASK'); mk.vertex_group = vg.name; mk.invert_vertex_group = True
    return ob
shown_body = display_body()

def set_body(visible):
    """visible=False: the ghost product shots. Body_Form itself is always invisible to every ray; the body shots
    show its display copy."""
    for attr in RAYS:
        setattr(body, attr, False)
        setattr(shown_body, attr, visible)
    body.hide_set(True)
    shown_body.hide_render = not visible
    shown_body.hide_set(not visible)
set_body(False)

# ---------------------------------------------------------------- backdrop sweep (local: floor at z=0, wall behind at +Y)
def build_sweep():
    remove_object('FG_Backdrop')
    prof = [(-6.0, 0.0), (1.2, 0.0)]
    R = 1.2
    for i in range(1, 17):
        a = -math.pi / 2 + (math.pi / 2) * i / 16
        prof.append((1.2 + R * math.cos(a), R + R * math.sin(a)))
    prof.append((1.2 + R, 7.0))
    verts, faces = [], []
    xs = [-7.0 + 14.0 * i / 8 for i in range(9)]
    for x in xs:
        for y, z in prof:
            verts.append((x, y, z))
    n = len(prof)
    for i in range(len(xs) - 1):
        for j in range(n - 1):
            faces.append((i * n + j, (i + 1) * n + j, (i + 1) * n + j + 1, i * n + j + 1))
    ob = new_mesh_object('FG_Backdrop', verts, faces, C_STAGE)
    for p in ob.data.polygons: p.use_smooth = True
    if ob.data.polygons[0].normal.z < 0:
        for p in ob.data.polygons: p.flip()
    ob.data.materials.append(M['backdrop'])
    return ob
backdrop = build_sweep()

# ---------------------------------------------------------------- lights (local to the rig: camera on -Y looking +Y)
def area_light(name, shape, sx, sy, watts):
    remove_object(name)
    ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, 'AREA')
    ld.type = 'AREA'; ld.shape = shape; ld.size = sx; ld.size_y = sy; ld.energy = watts
    if hasattr(ld, 'use_temperature'):
        ld.use_temperature = True; ld.temperature = 5600.0
    else:
        ld.color = (1.0, 0.925, 0.86)
    try:
        ld.use_soft_falloff = True
    except AttributeError:
        pass
    ob = bpy.data.objects.new(name, ld); C_STAGE.objects.link(ob)
    ob.visible_camera = False
    return ob

KEY_W = 400.0
LIGHTS = {
    # name: (object, local position)
    'FG_Key': (area_light('FG_Key', 'SQUARE', 2.0, 2.0, KEY_W),
               Vector((math.sin(math.radians(-25)) * math.cos(math.radians(45)), -math.cos(math.radians(25)) * math.cos(math.radians(45)), math.sin(math.radians(45)))) * 3.0),
    'FG_Rim_L': (area_light('FG_Rim_L', 'RECTANGLE', 0.3, 2.0, 600.0),
                 Vector((-math.sin(math.radians(120)) * 1.8, -math.cos(math.radians(120)) * 1.8, 0.15))),
    'FG_Rim_R': (area_light('FG_Rim_R', 'RECTANGLE', 0.3, 2.0, 600.0),
                 Vector((math.sin(math.radians(120)) * 1.8, -math.cos(math.radians(120)) * 1.8, 0.15))),
    'FG_Fill': (area_light('FG_Fill', 'SQUARE', 1.5, 1.5, KEY_W * 0.10), Vector((0.0, -2.4, -1.1))),
}

# ---------------------------------------------------------------- camera
cam_data = bpy.data.cameras.get('FG_Camera') or bpy.data.cameras.new('FG_Camera')
cam_data.lens = 85.0; cam_data.sensor_width = 36.0; cam_data.sensor_fit = 'AUTO'
cam_data.clip_start = 0.05; cam_data.clip_end = 100.0
cam = bpy.data.objects.get('FG_Camera')
if cam is None:
    cam = bpy.data.objects.new('FG_Camera', cam_data); C_STAGE.objects.link(cam)
sc.camera = cam
CHEST_H = 1.35
MARGIN = 0.15

SHOTS = [
    ('01_shirt_front', ['FG_Shirt_Set'], 0.0),
    ('02_shirt_back', ['FG_Shirt_Set'], 180.0),
    ('03_tights_front', ['FG_Tights_Set'], 0.0),
    ('04_tights_back', ['FG_Tights_Set'], 180.0),
    ('05_suit_three_quarter_back', ['FG_Shirt_Set', 'FG_Tights_Set'], 145.0),
    # the suit on the body (the mannequin is shown, stands on the floor, and is framed head to toe)
    ('06_body_front', ['FG_Shirt_Set', 'FG_Tights_Set'], 0.0, True),
    ('07_body_three_quarter_front', ['FG_Shirt_Set', 'FG_Tights_Set'], 35.0, True),
    ('08_body_back', ['FG_Shirt_Set', 'FG_Tights_Set'], 180.0, True),
]
SETS = ['FG_Shirt_Set', 'FG_Tights_Set']

def garment_points(sets, with_body=False):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    objs = [o for cname in sets for o in bpy.data.collections[cname].all_objects]
    if with_body:
        objs.append(shown_body)
    for o in objs:
        if o.type != 'MESH' or o.hide_render or 'Guide' in o.name: continue
        e = o.evaluated_get(dg); me = e.to_mesh()
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)[::7]
        mw = np.array(o.matrix_world)
        pts.append(co @ mw[:3, :3].T + mw[:3, 3])
        e.to_mesh_clear()
    return np.vstack(pts)

def look_at(ob, target, up=Vector((0, 0, 1))):
    d = (Vector(target) - ob.location).normalized()
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def setup_shot(name):
    shot = next(s for s in SHOTS if s[0] == name)
    _, show, rot = shot[:3]
    on_body = len(shot) > 3 and shot[3]
    set_body(on_body)
    for c in SETS:
        bpy.data.collections[c].hide_render = c not in show
        bpy.data.collections[c].hide_viewport = c not in show
    bpy.context.view_layer.update()
    P = garment_points(show, on_body)
    Rz = Matrix.Rotation(math.radians(rot), 3, 'Z')
    fwd = Rz @ Vector((0, 1, 0)); right = Rz @ Vector((1, 0, 0))
    u = P @ np.array(right); v = P[:, 2]; w = P @ np.array(fwd)
    uc, vc, wc = (u.min() + u.max()) / 2, (v.min() + v.max()) / 2, (w.min() + w.max()) / 2
    ar = sc.render.resolution_x / sc.render.resolution_y          # 2/3
    frame_h = max(v.max() - v.min(), (u.max() - u.min()) / ar) / (1 - 2 * MARGIN)
    vfov = 2 * math.atan(cam_data.sensor_width / 2 / cam_data.lens)
    dist = (frame_h / 2) / math.tan(vfov / 2)
    centre = right * uc + fwd * wc + Vector((0, 0, vc))
    cam.location = Vector((centre.x, centre.y, 0)) - fwd * dist + Vector((0, 0, CHEST_H))
    cam.rotation_euler = Euler((math.radians(90), 0, math.radians(rot)), 'XYZ')
    cam_data.shift_x = 0.0
    cam_data.shift_y = (vc - CHEST_H) / frame_h
    # rig transform for lights + backdrop: at the garment centre, facing the camera
    # ghost shots float 3 cm over the floor; the body stands on it
    floor = 0.0 if on_body else float(v.min()) - 0.03
    T = Matrix.Translation(Vector((centre.x, centre.y, vc))) @ Matrix.Rotation(math.radians(rot), 4, 'Z')
    for lname, (lob, lpos) in LIGHTS.items():
        if lname == 'FG_Fill':
            lpos = Vector((lpos.x, lpos.y, max(lpos.z, (floor - vc) + 0.25)))
        lob.location = T @ lpos
        look_at(lob, Vector((centre.x, centre.y, vc)))
    backdrop.matrix_world = Matrix.Translation(Vector((centre.x, centre.y, floor))) @ Matrix.Rotation(math.radians(rot), 4, 'Z')
    sc.render.filepath = os.path.join(OUT_DIR, name + '.png')
    print(f'{name}: frame_h {frame_h:.3f} m, distance {dist:.2f} m, shift_y {cam_data.shift_y:.3f}, floor {floor:.3f}')
    return dict(frame_h=frame_h, dist=dist, floor=floor)
builtins.FG_setup_shot = setup_shot
builtins.FG_SHOTS = SHOTS
