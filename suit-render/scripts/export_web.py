"""Export the FormGuard suit on its mannequin as one web model (glTF binary, Draco-compressed).

    blender -b suit-render/formguard_suit.blend --python suit-render/scripts/export_web.py -- [--out path.glb] [--scale 1.0] [--sheen 0.35] [--inset 0.0025] [--pods path.json]

Bakes every modifier, curve bevel and geometry-nodes detail into plain meshes, cuts each piece down to a triangle
budget (--scale multiplies every budget), and joins them into two nodes: FG_Suit (shirt, tights and all details) and
FG_Body (the stone mannequin), so a viewer can show the suit on or off the body. The .blend is not changed or saved.
Default output: ../public/models/formguard-suit.glb (next to the website's other static assets).
"""
import bpy, sys, os

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default=None):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default

HERE = os.path.dirname(os.path.abspath(__file__))
FG_ROOT = os.path.dirname(HERE)
G = globals(); G['FG_ROOT'] = FG_ROOT
for f in ('fg_lib.py', 'fg_scene.py', 'fg_stage.py'):
    exec(open(os.path.join(HERE, f)).read(), G)

OUT = os.path.abspath(opt('--out') or os.path.join(FG_ROOT, '..', 'public', 'models', 'formguard-suit.glb'))
SCALE = float(opt('--scale', 1.0))

# triangle budget per piece (by name prefix, first match wins); anything unlisted is kept as it is
BUDGET = [
    ('FG_Body_Display', 24000), ('FG_Shirt_Flatlock', 5000), ('FG_Tights_Flatlock', 5000), ('FG_Signal', 600),
    ('FG_Shirt_HemBand', 5000), ('FG_Shirt_NeckRib', 3000), ('FG_Shirt_Cuff', 2000), ('FG_Shirt', 34000),
    ('FG_Tights_Waistband', 8000), ('FG_Tights_AnkleHem', 2000), ('FG_Tights', 28000),
    ('FG_Logo_Chest', 14000), ('FG_Logo_ThighMark', 8000),
]
def budget(name):
    return next((int(b * SCALE) for p, b in BUDGET if name.startswith(p)), None)

SRC_COLLS = ['FG_Shirt_Set', 'FG_Shirt_Details', 'FG_Tights_Set', 'FG_Tights_Details']
C_OUT = collection('FG_WebExport')

def thin_curve(ob):
    """seam tubes are under 1 mm across: four sides are plenty on the web"""
    if ob.type == 'CURVE':
        ob.data.bevel_resolution = 0
        ob.data.resolution_u = min(ob.data.resolution_u, 6)

def bake(ob, dg):
    """the evaluated shape of ob (all modifiers, bevels, geometry nodes) as a new plain mesh object"""
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=False, depsgraph=dg)
    me.transform(ob.matrix_world)
    out = bpy.data.objects.new(ob.name + '_web', me)
    C_OUT.objects.link(out)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    b = budget(ob.name)
    if b and tris > b:
        m = out.modifiers.new('Decimate', 'DECIMATE'); m.ratio = b / tris; m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = out
        with bpy.context.temp_override(object=out, active_object=out):
            bpy.ops.object.modifier_apply(modifier=m.name)
    for p in out.data.polygons: p.use_smooth = True
    print(f'  {ob.name}: {tris} -> {sum(len(p.vertices) - 2 for p in out.data.polygons)} tris')
    return out

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    return ob

# show everything the body shots show
for c in SETS: bpy.data.collections[c].hide_render = bpy.data.collections[c].hide_viewport = False
set_body(True)
for cname in SRC_COLLS:
    for o in bpy.data.collections[cname].all_objects: thin_curve(o)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

# the detail collections are nested in the garment ones, so all_objects can list a piece twice
pieces = list(dict.fromkeys(o for cname in SRC_COLLS for o in bpy.data.collections[cname].all_objects
                            if o.type in ('MESH', 'CURVE') and not o.hide_render and 'Guide' not in o.name))
suit = [bake(o, dg) for o in pieces]
suit = join(suit, 'FG_Suit')
body = join([bake(shown_body, dg)], 'FG_Body')
# the decimated suit sits within ~1 mm of the decimated body (and dips under it on the buttocks and shoulder blades),
# which z-fights in the browser's depth buffer. Pull the body in a little; nobody sees 2.5 mm with the suit off.
BODY_INSET = float(opt('--inset', 0.0025))
body.data.update()
for v in body.data.vertices:
    v.co -= v.normal * BODY_INSET
# ---------------------------------------------------------------- sensor positions, for the viewer's callouts
def pod_centres(names):
    """centres of the pod dots (each dot is one small island), clustered by distance"""
    pts = []
    for n in names:
        o = bpy.data.objects[n]; e = o.evaluated_get(dg); me = e.to_mesh()
        pts += [o.matrix_world @ v.co for v in me.vertices]
        e.to_mesh_clear()
    groups = []
    for p in pts:
        g = next((g for g in groups if (g[0] - p).length < 0.03), None)
        if g: g[1].append(p)
        else: groups.append([p.copy(), [p]])
    return [sum(g[1], Vector()) / len(g[1]) for g in groups]

def pod_name(c, garment):
    side = 'L' if c.x > 0.02 else 'R' if c.x < -0.02 else ''
    if garment == 'tights':
        return ('Thigh_' if c.z > 0.45 else 'Shin_') + side
    if not side: return 'ShoulderBlades' if c.z > 1.2 else 'LowerBack'
    if c.z > 1.40 and abs(c.x) < 0.2: return 'Trap_' + side
    return ('Bicep_' if c.z > 1.12 else 'Wrist_') + side

from mathutils import Vector
from mathutils.bvhtree import BVHTree
body_bvh = BVHTree.FromObject(shown_body, dg)
PODS = []
for garment, names in (('shirt', ['FG_Shirt_Pods_Dot']), ('tights', ['FG_Tights_Pods_Dot']), ('controller', None)):
    if names is None:
        o = bpy.data.objects['FG_Controller']
        cs = [o.matrix_world @ (sum((v.co for v in o.data.vertices), Vector()) / len(o.data.vertices))]
    else:
        cs = pod_centres(names)
    for c in cs:
        hit, _, _, _ = body_bvh.find_nearest(c)
        n = (c - hit).normalized()
        PODS.append(dict(id='Controller' if names is None else pod_name(c, garment), c=c, n=n))

# stand the model on the origin: feet at 0, centred over the floor
zmin = min((o.matrix_world @ v.co).z for o in (body,) for v in o.data.vertices)
cx = sum(v.co.x for v in body.data.vertices) / len(body.data.vertices)
cy = sum(v.co.y for v in body.data.vertices) / len(body.data.vertices)
for o in (suit, body):
    o.data.transform(__import__('mathutils').Matrix.Translation((-cx, -cy, -zmin)))
for o in (suit, body):
    print(f'{o.name}: {sum(len(p.vertices) - 2 for p in o.data.polygons)} tris, materials {[m.name for m in o.data.materials]}')

# glTF sheen has a colour but no weight, so the exporter writes the tint at full strength and the black knit turns
# grey. Fold the weight into the colour (in memory only; the .blend is never saved here).
SHEEN_GAIN = float(opt('--sheen', 0.35))
for mat in {m for o in (suit, body) for m in o.data.materials if m and m.node_tree}:
    b = bsdf_of(mat)
    w = b.inputs['Sheen Weight'].default_value
    if w > 0:
        t = b.inputs['Sheen Tint'].default_value
        b.inputs['Sheen Tint'].default_value = (t[0] * w * SHEEN_GAIN, t[1] * w * SHEEN_GAIN, t[2] * w * SHEEN_GAIN, 1.0)
        b.inputs['Sheen Weight'].default_value = 1.0

# pod positions in the glTF frame (Y up, -Y forward becomes +Z): next to the viewer's code
import json
PODS_OUT = os.path.abspath(opt('--pods') or os.path.join(FG_ROOT, '..', 'src', 'three', 'suitPods.json'))
gl = lambda v: [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]
off = Vector((-cx, -cy, -zmin))
with open(PODS_OUT, 'w') as f:
    json.dump([dict(id=p['id'], p=gl(p['c'] + off), n=gl(p['n'])) for p in sorted(PODS, key=lambda p: p['id'])], f, indent=1)
print(f'[FormGuard] {len(PODS)} sensor positions -> {PODS_OUT}', sorted(p['id'] for p in PODS))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for o in (suit, body): o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
    export_texcoords=False, export_normals=True, export_materials='EXPORT',
    export_cameras=False, export_lights=False, export_animations=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
)
print(f'[FormGuard] exported {OUT} ({os.path.getsize(OUT) / 1e6:.2f} MB)')
