"""Import the real FormGuard SVGs, keep their colours, scale uniformly, project onto the fabric, extrude 0.2 mm."""
import bpy, bmesh, math, os, builtins
from mathutils import Vector, Matrix
M = builtins.FG_M
ROOT = FG_ROOT
LOGO_DIR = os.path.join(ROOT, 'source', 'logos')
shirt = bpy.data.objects['FG_Shirt']; tights = bpy.data.objects['FG_Tights']
C_SG = collection('FG_Shirt_Details', collection('FG_Shirt_Set'))
C_TG = collection('FG_Tights_Details', collection('FG_Tights_Set'))

def outer_bvh(ob):
    sol = [m for m in ob.modifiers if m.type == 'SOLIDIFY']
    for m in sol: m.show_viewport = False
    bpy.context.view_layer.update()
    bvh, _ = bvh_of(ob)
    for m in sol: m.show_viewport = True
    bpy.context.view_layer.update()
    return bvh

def import_svg_mesh(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'CURVE']
    meshes = []
    for o in new:
        mat = o.data.materials[0] if o.data.materials else None
        col = mat.diffuse_color if mat else (1, 1, 1, 1)
        is_red = col[0] > 2.5 * col[1]
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        meshes.append((me, is_red))
    # remove imported curves/collections
    colls = {c for o in new for c in o.users_collection}
    for o in new:
        cu = o.data; bpy.data.objects.remove(o, do_unlink=True)
        if cu.users == 0: bpy.data.curves.remove(cu)
    for c in colls:
        if c.name != 'Scene Collection' and not c.objects and c != bpy.context.scene.collection:
            bpy.data.collections.remove(c)
    for m in [m for m in bpy.data.materials if m.name.startswith('SVGMat') and m.users == 0]:
        bpy.data.materials.remove(m)
    bm = bmesh.new()
    for me, is_red in meshes:
        tmp = bmesh.new(); tmp.from_mesh(me)
        for f in tmp.faces: f.material_index = 1 if is_red else 0
        me2 = bpy.data.meshes.new('tmp'); tmp.to_mesh(me2); tmp.free()
        bm.from_mesh(me2); bpy.data.meshes.remove(me2); bpy.data.meshes.remove(me)
    return bm

def densify(bm, max_len):
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
    for _ in range(8):
        long = [e for e in bm.edges if e.calc_length() > max_len]
        if not long: break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])

def place_logo(name, svg, garment, coll, anchor, direction, width=None, height=None):
    remove_object(name)
    bm = import_svg_mesh(os.path.join(LOGO_DIR, svg), name)
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = (width / w) if width else (height / h)          # one uniform factor: no stretch
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    for v in bm.verts:
        v.co = Vector(((v.co.x - cx) * k, (v.co.y - cy) * k, 0.0))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    densify(bm, 0.0012)
    for f in bm.faces:
        if f.normal.z < 0: f.normal_flip()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    me.materials.append(M['logo_chalk']); me.materials.append(M['logo_red'])
    bvh = outer_bvh(garment)
    loc, nor = ray_surface(bvh, anchor, direction, maxd=0.6)
    z = Vector(nor).normalized()
    x = Vector((0, 0, 1)).cross(z).normalized(); y = z.cross(x)      # upright, never rotated
    mw = Matrix.Identity(4)
    mw.col[0][:3] = x; mw.col[1][:3] = y; mw.col[2][:3] = z; mw.col[3][:3] = loc + z * 0.015
    ob.matrix_world = mw
    sw = ob.modifiers.new('Shrinkwrap', 'SHRINKWRAP')
    sw.target = garment; sw.wrap_method = 'PROJECT'; sw.use_project_z = True
    sw.use_negative_direction = True; sw.use_positive_direction = False; sw.cull_face = 'OFF'
    sw.wrap_mode = 'ON_SURFACE'; sw.offset = 0.0003
    so = ob.modifiers.new('Solidify', 'SOLIDIFY'); so.thickness = 0.0002; so.offset = 1.0; so.use_rim = True
    print(name, 'size mm', round(w * k * 1000, 1), 'x', round(h * k * 1000, 1), 'at', tuple(round(c, 3) for c in loc))
    return ob

place_logo('FG_Logo_Chest', 'formguard-stacked-reversed.svg', shirt, C_SG, (0, 0, 1.36), (0, -1, 0), width=0.090)
place_logo('FG_Logo_ThighMark', 'formguard-symbol-reversed.svg', tights, C_TG, (0.135, -0.02, 0.80), (0.35, -1, 0), height=0.050)
