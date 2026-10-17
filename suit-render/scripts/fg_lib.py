"""FormGuard suit render: shared helpers. exec() this file inside Blender; it defines functions in the caller's globals."""
import bpy, bmesh, math, numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

MM = 0.001

# ---------------------------------------------------------------- colours / materials
def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hex_rgba(h, a=1.0):
    h = h.lstrip('#')
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4)) + (a,)

def bsdf_of(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')

def set_input(node, names, value):
    for n in names if isinstance(names, (list, tuple)) else [names]:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return True
    return False

def principled(name, hexcol, rough=0.5, metallic=0.0, spec=0.5, sheen=0.0, sheen_tint=None, reuse=True):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type not in ('BSDF_PRINCIPLED', 'OUTPUT_MATERIAL'):
            nt.nodes.remove(n)
    b = bsdf_of(mat)
    set_input(b, 'Base Color', hex_rgba(hexcol))
    set_input(b, 'Roughness', rough)
    set_input(b, 'Metallic', metallic)
    set_input(b, ['Specular IOR Level', 'Specular'], spec)
    set_input(b, ['Sheen Weight', 'Sheen'], sheen)
    if sheen_tint:
        set_input(b, 'Sheen Tint', hex_rgba(sheen_tint))
    set_input(b, ['Emission Strength'], 0.0)
    mat.diffuse_color = hex_rgba(hexcol)
    return mat

def add_bump(mat, scale=1500.0, strength=0.05, distance=0.0005, rib=None):
    """Fine knit bump from a high-scale noise (object space). rib=(scale, axis) adds a wave texture."""
    nt = mat.node_tree
    b = bsdf_of(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    set_input(noise, 'Detail', 2.0)
    set_input(noise, 'Roughness', 0.6)
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    height = noise.outputs['Fac']
    if rib:
        wave = nt.nodes.new('ShaderNodeTexWave')
        wave.wave_type = 'BANDS'
        wave.bands_direction = rib[1]
        wave.wave_profile = 'SIN'
        wave.inputs['Scale'].default_value = rib[0]
        set_input(wave, 'Distortion', 0.0)
        nt.links.new(tc.outputs['UV'], wave.inputs['Vector'])
        mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'MULTIPLY_ADD'
        nt.links.new(wave.outputs['Fac'], mix.inputs[0])
        mix.inputs[1].default_value = 3.0
        nt.links.new(noise.outputs['Fac'], mix.inputs[2])
        height = mix.outputs[0]
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    nt.links.new(height, bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return mat

# ---------------------------------------------------------------- objects / collections
def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c

def remove_object(name):
    o = bpy.data.objects.get(name)
    if o:
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data is not None and getattr(data, 'users', 1) == 0:
            if isinstance(data, bpy.types.Mesh): bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Curve): bpy.data.curves.remove(data)

def new_mesh_object(name, verts, faces, coll, edges=()):
    remove_object(name)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], list(edges), [tuple(f) for f in faces])
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob

def link_only(ob, coll):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)

# ---------------------------------------------------------------- surface queries
def bvh_of(ob, evaluated=True):
    dg = bpy.context.evaluated_depsgraph_get()
    if evaluated:
        bvh = BVHTree.FromObject(ob, dg)
    else:
        bvh = BVHTree.FromObject(ob, dg, deform=False)
    mw = ob.matrix_world
    return bvh, mw

def nearest(bvh, p):
    loc, nor, idx, dist = bvh.find_nearest(Vector(p))
    return loc, nor.normalized()

def ray_surface(bvh, origin, direction, maxd=1.0):
    """Cast from far outside towards origin along -direction: returns the outermost hit."""
    d = Vector(direction).normalized()
    start = Vector(origin) + d * maxd
    loc, nor, idx, dist = bvh.ray_cast(start, -d, maxd + 0.02)   # stop just past the anchor: never hit the far side
    if loc is None:
        return None, None
    return loc, nor.normalized()

def tangent_dir(nor, d):
    d = Vector(d)
    t = d - nor * d.dot(nor)
    return t.normalized() if t.length > 1e-9 else t

def surface_path(bvh, waypoints, step=0.003, offset=0.0, smooth_iter=3):
    """Polyline through 3D waypoints (already near the surface), densified and projected onto the
    surface, then lifted by offset along the normal. Returns (points, normals)."""
    pts = []
    for a, b in zip(waypoints[:-1], waypoints[1:]):
        a, b = Vector(a), Vector(b)
        n = max(2, int((b - a).length / step))
        for i in range(n):
            pts.append(a.lerp(b, i / n))
    pts.append(Vector(waypoints[-1]))
    for it in range(smooth_iter + 1):
        proj = [nearest(bvh, p)[0] for p in pts]
        if it < smooth_iter:
            pts = [proj[0]] + [(proj[i - 1] + proj[i] * 2 + proj[i + 1]) / 4 for i in range(1, len(proj) - 1)] + [proj[-1]]
        else:
            pts = proj
    out, nors = [], []
    for p in pts:
        loc, nor = nearest(bvh, p)
        out.append(loc + nor * offset); nors.append(nor)
    return out, nors

def resample(points, step):
    P = [Vector(p) for p in points]
    seg = [(P[i + 1] - P[i]).length for i in range(len(P) - 1)]
    L = sum(seg)
    n = max(2, int(L / step) + 1)
    out, acc, i = [], 0.0, 0
    for k in range(n):
        s = L * k / (n - 1)
        while i < len(seg) - 1 and acc + seg[i] < s:
            acc += seg[i]; i += 1
        t = 0 if seg[i] == 0 else (s - acc) / seg[i]
        out.append(P[i].lerp(P[i + 1], min(max(t, 0), 1)))
    return out

def path_length(points):
    return sum((Vector(points[i + 1]) - Vector(points[i])).length for i in range(len(points) - 1))

# ---------------------------------------------------------------- curves
def poly_curve(name, splines, coll, bevel=0.00075, mat=None, resolution=4):
    """splines: list of point lists. Round-bevel poly curve."""
    remove_object(name)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_mode = 'ROUND'
    cu.bevel_depth = bevel
    cu.bevel_resolution = resolution
    cu.use_fill_caps = True
    for pts in splines:
        sp = cu.splines.new('POLY')
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (p[0], p[1], p[2], 1.0)
    ob = bpy.data.objects.new(name, cu)
    coll.objects.link(ob)
    if mat:
        cu.materials.append(mat)
    return ob

def offset_sideways(points, normals, d):
    out = []
    for i, p in enumerate(points):
        a = Vector(points[max(i - 1, 0)]); b = Vector(points[min(i + 1, len(points) - 1)])
        t = (b - a).normalized()
        s = t.cross(normals[i]).normalized()
        out.append(Vector(p) + s * d)
    return out

def dashes(points, dash, gap):
    """Split a dense polyline into dash segments."""
    P = resample(points, 0.0005)
    out, cur, s = [], [], 0.0
    period = dash + gap
    for i, p in enumerate(P):
        if i:
            s += (P[i] - P[i - 1]).length
        if (s % period) < dash:
            cur.append(p)
        elif cur:
            if len(cur) > 1: out.append(cur)
            cur = []
    if len(cur) > 1: out.append(cur)
    return out

# ---------------------------------------------------------------- modifiers
def add_shrinkwrap(ob, target, offset, mode='NEAREST_SURFACEPOINT', wrap='OUTSIDE_SURFACE', name='Shrinkwrap', vgroup=None):
    m = ob.modifiers.new(name, 'SHRINKWRAP')
    m.target = target
    m.wrap_method = mode
    m.wrap_mode = wrap
    m.offset = offset
    if vgroup: m.vertex_group = vgroup
    return m

def outer_bvh(ob):
    """BVH of an object's evaluated surface with Solidify switched off (outer fabric surface only)."""
    sol = [m for m in ob.modifiers if m.type == 'SOLIDIFY']
    for m in sol: m.show_viewport = False
    bpy.context.view_layer.update()
    bvh, _ = bvh_of(ob)
    for m in sol: m.show_viewport = True
    bpy.context.view_layer.update()
    return bvh
