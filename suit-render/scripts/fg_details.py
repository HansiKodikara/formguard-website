"""Seams (creases + flatlock stitches), tension wrinkles, sensor pods, signal seams, controller and shirt tab."""
import bpy, bmesh, math, numpy as np, builtins
from mathutils import Vector, Matrix
M = builtins.FG_M
body = bpy.data.objects['Body_Form']
shirt = bpy.data.objects['FG_Shirt']; tights = bpy.data.objects['FG_Tights']
waist = bpy.data.objects['FG_Tights_Waistband']; hemband = bpy.data.objects['FG_Shirt_HemBand']
C_SHIRT, C_TIGHTS = collection('FG_Shirt_Set'), collection('FG_Tights_Set')
C_SG = collection('FG_Shirt_Details', C_SHIRT); C_TG = collection('FG_Tights_Details', C_TIGHTS)
for c in (C_SG, C_TG):
    for o in list(c.objects):
        remove_object(o.name)
for g in [g for g in bpy.data.node_groups if g.name.startswith('FG_')]:
    bpy.data.node_groups.remove(g)
for ob in (shirt, tights):
    m = ob.modifiers.get('FabricDetail')
    if m: ob.modifiers.remove(m)

HEM_Z, WAIST_TOP, WAIST_BOT = 1.000, 1.020, 0.960
CTRL_Z = (WAIST_TOP + WAIST_BOT) / 2          # 0.990
CTRL_W, CTRL_H, CTRL_D, CTRL_R = 0.064, 0.036, 0.009, 0.008
LIFT = 0.0003 + 0.00075                        # signal seam centre above the fabric

def bvh_eval(ob):
    """BVH of the garment's outer surface only (Solidify off), so nearest-point projection can't
    snap onto the inner shell."""
    sol = [m for m in ob.modifiers if m.type == 'SOLIDIFY']
    for m in sol: m.show_viewport = False
    bpy.context.view_layer.update()
    bvh, _ = bvh_of(ob)
    for m in sol: m.show_viewport = True
    bpy.context.view_layer.update()
    return bvh

def S(bvh, spec):
    """('ray', anchor, dir) → outermost hit along dir; ('near', point) → nearest surface point."""
    if spec[0] == 'ray':
        loc, nor = ray_surface(bvh, spec[1], spec[2], maxd=0.6)
        if loc is None:
            raise RuntimeError(f'ray miss {spec}')
        return loc, nor
    return nearest(bvh, spec[1])

def mir(spec, s):
    if s == 1: return spec
    f = lambda v: (v[0] * s, v[1], v[2])
    return (spec[0], f(spec[1])) + ((f(spec[2]),) if spec[0] == 'ray' else ())

# ================================================================ seam guides (pre-detail surfaces)
bs, bt = bvh_eval(shirt), bvh_eval(tights)
def guide_path(bvh, specs, step=0.002):
    pts = [S(bvh, sp)[0] for sp in specs]
    P, N = surface_path(bvh, pts, step=step, offset=0.0, smooth_iter=4)
    return P, N

shirt_seams = []
for s in (1, -1):
    shirt_seams.append(guide_path(bs, [mir(('ray', (0.062, -0.02, 1.468), (0.45, -0.9, 0.25)), s),
                                       mir(('ray', (0.125, -0.03, 1.395), (0.25, -1, 0.35)), s),
                                       mir(('ray', (0.183, 0.0, 1.268), (0.05, -1, 0.0)), s)]))
    shirt_seams.append(guide_path(bs, [mir(('ray', (0.062, 0.02, 1.49), (0.4, 0.9, 0.3)), s),
                                       mir(('ray', (0.125, 0.03, 1.415), (0.25, 1, 0.35)), s),
                                       mir(('ray', (0.183, 0.0, 1.268), (0.05, 1, 0.0)), s)]))
tights_seams = []
GUS = dict(F=(0.0, -0.13, 0.835), L=(0.055, -0.035, 0.775), B=(0.0, 0.08, 0.80), R=(-0.055, -0.035, 0.775))
gus = {k: nearest(bt, v)[0] for k, v in GUS.items()}
for a, b in (('F', 'L'), ('L', 'B'), ('B', 'R'), ('R', 'F')):
    tights_seams.append(surface_path(bt, [gus[a], gus[b]], step=0.002, smooth_iter=2))
tights_seams.append(guide_path(bt, [('ray', (0, 0, WAIST_BOT - 0.004), (0, 1, 0)), ('ray', (0, 0, 0.90), (0, 1, 0)),
                                    ('ray', (0, 0, 0.85), (0, 1, -0.2)), ('ray', (0, 0.0, 0.83), (0, 0.6, -0.8)), ('near', gus['B'])]))
tights_seams.append(guide_path(bt, [('ray', (0.17, 0.0, 0.945), (0.6, 0.8, 0)), ('ray', (0.09, 0.0, 0.918), (0.1, 1, 0)),
                                    ('ray', (0.0, 0.0, 0.902), (0, 1, 0)), ('ray', (-0.09, 0.0, 0.918), (-0.1, 1, 0)),
                                    ('ray', (-0.17, 0.0, 0.945), (-0.6, 0.8, 0))]))

def guide_object(name, paths, coll):
    verts, edges = [], []
    for P, N in paths:
        base = len(verts)
        verts += [tuple(p) for p in P]
        edges += [(base + i, base + i + 1) for i in range(len(P) - 1)]
    ob = new_mesh_object(name, verts, [], coll, edges=edges)
    ob.hide_render = True
    return ob
g_shirt = guide_object('FG_Shirt_SeamGuide', shirt_seams, C_SG)
g_tights = guide_object('FG_Tights_SeamGuide', tights_seams, C_TG)

# ================================================================ geometry-nodes fabric detail
def build_detail_group(name, guide, zones, depth=0.0005, width=0.0016):
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes; L = ng.links
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    sp = N.new('GeometryNodeSetPosition')
    pos = N.new('GeometryNodeInputPosition'); nor = N.new('GeometryNodeInputNormal')
    def math(op, a, b=None, c=None):
        n = N.new('ShaderNodeMath'); n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: L.new(v, n.inputs[i])
        return n.outputs[0]
    def vmath(op, a, b=None):
        n = N.new('ShaderNodeVectorMath'); n.operation = op
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (tuple, list, Vector)): n.inputs[i].default_value = tuple(v)
            else: L.new(v, n.inputs[i])
        return n.outputs['Value'] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else n.outputs['Vector']
    def maprange(v, a, b, c, d):
        n = N.new('ShaderNodeMapRange'); n.data_type = 'FLOAT'; n.interpolation_type = 'SMOOTHSTEP'
        L.new(v, n.inputs['Value'])
        n.inputs['From Min'].default_value = a; n.inputs['From Max'].default_value = b
        n.inputs['To Min'].default_value = c; n.inputs['To Max'].default_value = d
        return n.outputs['Result']
    # seam crease
    oi = N.new('GeometryNodeObjectInfo'); oi.inputs['Object'].default_value = guide; oi.transform_space = 'RELATIVE'
    px = N.new('GeometryNodeProximity'); px.target_element = 'EDGES'
    tgt = px.inputs.get('Target') or px.inputs.get('Geometry')
    L.new(oi.outputs['Geometry'], tgt)
    total = math('MULTIPLY', maprange(px.outputs['Distance'], 0.0, width, 1.0, 0.0), -depth)
    # wrinkle zones
    noise = N.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 60.0
    L.new(pos.outputs['Position'], noise.inputs['Vector'])
    for z in zones:
        rel = vmath('SUBTRACT', pos.outputs['Position'], z['c'])
        scaled = vmath('DIVIDE', rel, z['r'])
        mask = maprange(vmath('LENGTH', scaled), 0.0, 1.0, 1.0, 0.0)
        d = Vector(z['dir']).normalized()
        ph = math('MULTIPLY', vmath('DOT_PRODUCT', rel, tuple(d)), 2 * math_pi / z['lam'])
        ph = math('MULTIPLY_ADD', noise.outputs['Fac'], 3.0, ph)
        s = math('SINE', ph)
        ridge = math('POWER', math('MULTIPLY_ADD', s, 0.5, 0.5), 2.0)
        total = math('ADD', total, math('MULTIPLY', math('MULTIPLY', ridge, mask), z['amp']))
    off = vmath('SCALE', nor.outputs['Normal'])
    scale_in = off.node.inputs['Scale']
    L.new(total, scale_in)
    L.new(gi.outputs[0], sp.inputs['Geometry']); L.new(off, sp.inputs['Offset']); L.new(sp.outputs['Geometry'], go.inputs[0])
    return ng
math_pi = math.pi

def add_detail(ob, ng):
    m = ob.modifiers.new('FabricDetail', 'NODES'); m.node_group = ng
    idx = list(ob.modifiers).index(ob.modifiers['Solidify'])
    ob.modifiers.move(len(ob.modifiers) - 1, idx)

ARM_UP = Vector((0.341 - 0.20, -0.013, 1.09 - 1.40)).normalized()
shirt_zones = []
for s in (1, -1):
    shirt_zones += [
        dict(c=(0.335 * s, -0.055, 1.095), r=(0.035, 0.03, 0.05), dir=(ARM_UP.x * s, ARM_UP.y, ARM_UP.z), lam=0.009, amp=0.0006),   # elbow crease
        dict(c=(0.175 * s, -0.06, 1.255), r=(0.04, 0.035, 0.05), dir=(0.75 * s, 0.0, 0.65), lam=0.012, amp=0.0005),             # armpit front
        dict(c=(0.175 * s, 0.06, 1.255), r=(0.04, 0.035, 0.05), dir=(0.75 * s, 0.0, 0.65), lam=0.012, amp=0.0005),              # armpit back
        dict(c=(0.15 * s, -0.02, 1.075), r=(0.05, 0.12, 0.035), dir=(0, 0, 1), lam=0.011, amp=0.00045),                        # waist
    ]
tights_zones = []
for s in (1, -1):
    tights_zones += [
        dict(c=(0.14 * s, 0.07, 0.535), r=(0.045, 0.035, 0.045), dir=(0, 0.1, 1), lam=0.008, amp=0.0006),                      # back of knee
        dict(c=(0.11 * s, -0.10, 0.925), r=(0.06, 0.05, 0.03), dir=(0.3 * s, 0, 1), lam=0.012, amp=0.0004),                    # waist / hip crease
    ]
add_detail(shirt, build_detail_group('FG_ShirtDetail', g_shirt, shirt_zones))
add_detail(tights, build_detail_group('FG_TightsDetail', g_tights, tights_zones))

# flatlock stitch lines: dashed 0.8 mm tube beside each seam
def stitches(name, paths, garment, coll):
    splines = []
    for P, N in paths:
        side = offset_sideways(P, N, 0.0016)
        splines += dashes(side, 0.0025, 0.0015)
    ob = poly_curve(name, splines, coll, bevel=0.0004, mat=M['stitch'], resolution=2)
    m = add_shrinkwrap(ob, garment, 0.00045, wrap='OUTSIDE_SURFACE'); m.use_apply_on_spline = True
    return ob
stitches('FG_Shirt_Flatlock', shirt_seams, shirt, C_SG)
stitches('FG_Tights_Flatlock', tights_seams, tights, C_TG)

# ================================================================ surfaces after detail
bs, bt, bw, bh = bvh_eval(shirt), bvh_eval(tights), bvh_eval(waist), bvh_eval(hemband)

# ================================================================ sensor pods
SH = Vector((0.20, 0.0, 1.40)); EL = Vector((0.341, -0.013, 1.09)); WR = Vector((0.398, -0.068, 0.945))
up_arm = (SH - EL).normalized(); fore_up = (EL - WR).normalized()
def side(v, s): return (v[0] * s, v[1], v[2])
POD_SPECS = {}
for s, tag in ((1, 'L'), (-1, 'R')):
    POD_SPECS[f'Wrist_{tag}'] = ('shirt', ('ray', side(WR + fore_up * 0.03, s), side((0.85, 0.5, 0.05), s)))
    POD_SPECS[f'Bicep_{tag}'] = ('shirt', ('ray', side(EL + up_arm * 0.18, s), side((0.75, -0.65, 0.0), s)))
    POD_SPECS[f'Trap_{tag}'] = ('shirt', ('ray', side((0.145, 0.0, 1.44), s), (0, 0.12, 1)))
    POD_SPECS[f'Thigh_{tag}'] = ('tights', ('ray', side((0.145, -0.02, 0.63), s), (0, -1, 0)))
    POD_SPECS[f'Shin_{tag}'] = ('tights', ('ray', side((0.169, 0.06, 0.30), s), side((0.75, -0.65, 0), s)))
POD_SPECS['ShoulderBlades_T5'] = ('shirt', ('ray', (0, 0, 1.37), (0, 1, 0)))
LOWBACK_Z = 1.085                               # lumbar, just above the waistband
POD_SPECS['LowerBack'] = ('shirt', ('ray', (0, 0, LOWBACK_Z), (0, 1, 0)))
PODS = {}
for k, (g, spec) in POD_SPECS.items():
    loc, nor = S(bs if g == 'shirt' else bt, spec)
    PODS[k] = (g, loc, nor)

def frame(nor, up=(0, 0, 1)):
    z = Vector(nor).normalized()
    upv = Vector(up)
    x = upv.cross(z)
    if x.length < 1e-4: x = Vector((1, 0, 0)).cross(z)
    x.normalize(); y = z.cross(x)
    return x, y, z

def ring_geom(c, nor, r0, r1, seg=64, nr=2, dash=None):
    """Annulus (r0>0) or disc (r0=0) in the tangent plane; returns verts, faces. dash=(on, off) in radians."""
    x, y, z = frame(nor)
    verts, faces = [], []
    radii = [r0 + (r1 - r0) * i / nr for i in range(nr + 1)]
    if r0 == 0:
        radii = [r1 * i / nr for i in range(1, nr + 1)]
        verts.append(c)
    base = len(verts)
    for r in radii:
        for k in range(seg):
            a = 2 * math.pi * k / seg
            verts.append(c + (x * math.cos(a) + y * math.sin(a)) * r)
    def vid(i, k): return base + i * seg + (k % seg)
    keep = lambda k: True
    if dash:
        on, off = dash
        keep = lambda k: ((2 * math.pi * (k + 0.5) / seg) % (on + off)) < on
    if r0 == 0:
        for k in range(seg):
            faces.append((0, vid(0, k), vid(0, k + 1)))
    for i in range(len(radii) - 1):
        for k in range(seg):
            if keep(k):
                faces.append((vid(i, k), vid(i + 1, k), vid(i + 1, k + 1), vid(i, k + 1)))
    return verts, faces

def pod_layer(name, garment_key, garment, coll, r0, r1, mat, lift, thick, nr=2, dash=None, skip=()):
    V, F = [], []
    for k, (g, loc, nor) in PODS.items():
        if g != garment_key or k in skip: continue
        v, f = ring_geom(loc + nor * 0.0002, nor, r0, r1, nr=nr, dash=dash)
        b = len(V); V += v; F += [tuple(i + b for i in face) for face in f]
    ob = new_mesh_object(name, V, F, coll)
    # remove verts unused by dashed faces
    ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth = False
    add_shrinkwrap(ob, garment, lift, wrap='OUTSIDE_SURFACE')
    so = ob.modifiers.new('Solidify', 'SOLIDIFY'); so.thickness = thick; so.offset = 1.0; so.use_rim = True
    return ob

for gk, garment, coll, pre in (('shirt', shirt, C_SG, 'FG_Shirt_Pods'), ('tights', tights, C_TG, 'FG_Tights_Pods')):
    pod_layer(pre + '_HapticRing', gk, garment, coll, 0.0195, 0.0205, M['haptic'], 0.00008, 0.0001, nr=1, dash=(0.16, 0.10))
    pod_layer(pre + '_Gap', gk, garment, coll, 0.0, 0.0065, M['pod_gap'], 0.00015, 0.0002, nr=4)
    pod_layer(pre + '_Ring', gk, garment, coll, 0.0085, 0.0100, M['pod_ring'], 0.00015, 0.00025, nr=2)
    pod_layer(pre + '_Dot', gk, garment, coll, 0.0, 0.0045, M['pod_dot'], 0.00035, 0.00025, nr=3)

# horizontal curvature of the waistband at the back (the shirt tab bends to it)
c_back, _ = S(bw, ('ray', (0, 0, CTRL_Z), (0, 1, 0)))
pl, _ = S(bw, ('ray', (CTRL_W / 2, 0, CTRL_Z), (0, 1, 0)))
pr, _ = S(bw, ('ray', (-CTRL_W / 2, 0, CTRL_Z), (0, 1, 0)))
sag = c_back.y - (pl.y + pr.y) / 2
R_back = (CTRL_W / 2) ** 2 / (2 * max(sag, 1e-4))

# ================================================================ controller on the outer left upper arm
# long side along the arm, bent around it; sits between the bicep pod (front) and signal c (back of the arm)
CTRL_ALONG = 0.23                              # m up the arm from the elbow
arm_out = Vector((-up_arm.z, 0.0, up_arm.x)).normalized() * -1   # outward, square to the arm, horizontal-ish
c_loc, c_nor = S(bs, ('ray', EL + up_arm * CTRL_ALONG, arm_out))
c_x, c_y, _ = frame(c_nor, up_arm)                # x around the arm, y up the arm
ql, _ = nearest(bs, c_loc + c_x * CTRL_H / 2); qr, _ = nearest(bs, c_loc - c_x * CTRL_H / 2)
sag_arm = (c_loc - (ql + qr) / 2).dot(c_nor)
R_arm = (CTRL_H / 2) ** 2 / (2 * max(sag_arm, 1e-4))
def rounded_rect(w, h, r, seg=8):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts
def build_controller():
    remove_object('FG_Controller')
    bm = bmesh.new()
    outline = rounded_rect(CTRL_H, CTRL_W, CTRL_R)
    back = [bm.verts.new((x, y, 0.0)) for x, y in outline]
    f = bm.faces.new(back)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    top_verts = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
    for v in top_verts: v.co.z = CTRL_D
    bm.normal_update()
    top_face = max(bm.faces, key=lambda fc: fc.calc_center_median().z)
    top_edges = list(top_face.edges)
    res = bmesh.ops.bevel(bm, geom=top_edges, offset=0.001, segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
    edge_faces = set(res['faces'])
    back_face = min(bm.faces, key=lambda fc: fc.calc_center_median().z)
    bres = bmesh.ops.bevel(bm, geom=list(back_face.edges), offset=0.0006, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
    # inset the top face a touch so the subdivided face stays flat
    for fc in bm.faces:
        fc.material_index = 1 if fc in edge_faces else 0
        fc.smooth = True
    # bend to the arm's curvature (parabolic, about the arm axis)
    for v in bm.verts:
        v.co.z -= v.co.x ** 2 / (2 * R_arm)
    me = bpy.data.meshes.new('FG_Controller'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('FG_Controller', me); C_SG.objects.link(ob)
    me.materials.append(M['ctrl']); me.materials.append(M['ctrl_edge'])
    x, y, z = frame(c_nor, up_arm)
    mw = Matrix.Identity(4)
    mw.col[0][:3] = x; mw.col[1][:3] = y; mw.col[2][:3] = z; mw.col[3][:3] = c_loc + c_nor * 0.0004
    ob.matrix_world = mw
    wn = ob.modifiers.new('WeightedNormal', 'WEIGHTED_NORMAL'); wn.keep_sharp = True
    return ob
ctrl = build_controller()
print('controller at', tuple(round(v, 4) for v in c_loc), 'arm radius', round(R_arm, 3))

# ================================================================ shirt tab (centre-back hem, joins the shirt and tights seams)
TAB_W, TAB_H, TAB_T = 0.024, 0.014, 0.0006
def build_tab():
    remove_object('FG_Shirt_Tab')
    t_loc, t_nor = S(bh, ('ray', (0, 0, HEM_Z + 0.004), (0, 1, 0)))
    centre = t_loc + Vector((0, 0, -0.003))
    bm = bmesh.new()
    outline = rounded_rect(TAB_W, TAB_H, 0.002, seg=4)
    f = bm.faces.new([bm.verts.new((x, y, 0)) for x, y in outline])
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.z = TAB_T
    bm.normal_update()
    for v in bm.verts: v.co.z -= v.co.x ** 2 / (2 * R_back)
    # contact dots
    for i in range(4):
        cx = (-1.5 + i) * 0.004
        circ = bmesh.ops.create_circle(bm, cap_ends=True, segments=16, radius=0.0006,
                                       matrix=Matrix.Translation((cx, -0.002, TAB_T + 0.00002 - cx * cx / (2 * R_back))))
        fs = list({f for v in circ['verts'] for f in v.link_faces})
        ex = bmesh.ops.extrude_face_region(bm, geom=fs)
        for v in [e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)]: v.co.z += 0.0002
        for fc in {f for v in [e for e in ex['geom'] if isinstance(e, bmesh.types.BMVert)] for f in v.link_faces}:
            fc.material_index = 1
        for fc in fs: fc.material_index = 1
    me = bpy.data.meshes.new('FG_Shirt_Tab'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('FG_Shirt_Tab', me); C_SG.objects.link(ob)
    me.materials.append(M['tab']); me.materials.append(M['contact'])
    x, y, z = frame(t_nor)
    mw = Matrix.Identity(4)
    mw.col[0][:3] = x; mw.col[1][:3] = y; mw.col[2][:3] = z; mw.col[3][:3] = centre + t_nor * 0.0002
    ob.matrix_world = mw
    return ob, centre
tab, tab_c = build_tab()

# ================================================================ signal seams (twin reflective lines)
def trim(P, N, centres, r):
    keep = [i for i, p in enumerate(P) if all((Vector(p) - Vector(c)).length > r for c in centres)]
    # keep the longest contiguous run
    runs, cur = [], []
    for i in keep:
        if cur and i != cur[-1] + 1:
            runs.append(cur); cur = []
        cur.append(i)
    if cur: runs.append(cur)
    run = max(runs, key=len)
    return [P[i] for i in run], [N[i] for i in run]

def signal(name, garment, bvh, specs, coll, ends=(), r_end=0.0115, extra_pts=None):
    pts = [S(bvh, sp)[0] if isinstance(sp, tuple) and isinstance(sp[0], str) else Vector(sp) for sp in specs]
    P, N = surface_path(bvh, pts, step=0.0025, offset=0.0, smooth_iter=4)
    if ends:
        P, N = trim(P, N, ends, r_end)
    lines = []
    for d in (+0.0015, -0.0015):
        Q = offset_sideways(P, N, d)
        Q2 = []
        for q in Q:
            loc, nor = nearest(bvh, q)
            Q2.append(loc + nor * LIFT)
        lines.append(Q2)
    ob = poly_curve(name, lines, coll, bevel=0.00075, mat=M['signal'], resolution=3)
    m = add_shrinkwrap(ob, garment, LIFT, wrap='OUTSIDE_SURFACE'); m.use_apply_on_spline = True
    return ob

pc = {k: v[1] for k, v in PODS.items()}
for s, tag in ((1, 'L'), (-1, 'R')):
    trap = pc[f'Trap_{tag}']
    # a. trap pod -> V down and in -> shoulder-blade pod (T5)
    signal(f'FG_Signal_a_Trap{tag}_T5', shirt, bs, [trap, ('ray', side((0.10, 0.0, 1.43), s), (0, 1, 0.25)), pc['ShoulderBlades_T5']],
           C_SG, ends=(trap, pc['ShoulderBlades_T5']))
    # c. trap pod -> over the shoulder -> back of upper arm and forearm -> wrist pod
    signal(f'FG_Signal_c_Trap{tag}_Wrist', shirt, bs, [trap,
            ('ray', side((0.20, 0.0, 1.43), s), side((0.3, 0.6, 0.75), s)),
            ('ray', side((0.255, 0.01, 1.30), s), side((0.15, 1, 0.0), s)),
            ('ray', side((0.30, 0.0, 1.17), s), side((0.2, 1, 0.0), s)),
            ('ray', side(EL + Vector((0, 0.01, 0)), s), side((0.3, 1, 0.0), s)),
            ('ray', side(EL + (WR - EL) * 0.5, s), side((0.7, 0.75, 0.05), s)),
            pc[f'Wrist_{tag}']], C_SG, ends=(trap, pc[f'Wrist_{tag}']))
    if s == 1:
        # d. trap pod -> over the shoulder -> top of the controller; bottom of the controller -> bicep pod
        c_top = nearest(bs, c_loc + c_y * (CTRL_W / 2 + 0.003))[0]
        c_bot = nearest(bs, c_loc - c_y * (CTRL_W / 2 + 0.003))[0]
        signal(f'FG_Signal_d_Trap{tag}_Controller', shirt, bs, [trap,
                ('ray', side((0.21, 0.0, 1.43), s), side((0.6, -0.1, 0.8), s)),
                c_top], C_SG, ends=(trap,))
        signal(f'FG_Signal_d_Controller_Bicep{tag}', shirt, bs, [c_bot, pc[f'Bicep_{tag}']], C_SG, ends=(pc[f'Bicep_{tag}'],))
        continue
    # d. trap pod -> down the front-outer upper arm -> bicep pod
    signal(f'FG_Signal_d_Trap{tag}_Bicep', shirt, bs, [trap,
            ('ray', side((0.21, 0.0, 1.425), s), side((0.55, -0.7, 0.45), s)),
            ('ray', side((0.26, -0.01, 1.28), s), side((0.6, -0.8, 0), s)),
            pc[f'Bicep_{tag}']], C_SG, ends=(trap, pc[f'Bicep_{tag}']))
# b. shoulder-blade pod -> straight down the spine -> lower-back pod -> centre-back hem (onto the tab)
t5, lb = pc['ShoulderBlades_T5'], pc['LowerBack']
signal('FG_Signal_b_T5_LowerBack', shirt, bs, [t5, ('ray', (0, 0, 1.20), (0, 1, 0)), lb], C_SG, ends=(t5, lb))
signal('FG_Signal_b_LowerBack_Hem', shirt, bs, [lb, ('ray', (0, 0, HEM_Z + 0.026), (0, 1, 0))], C_SG, ends=(lb,))
signal('FG_Signal_b_HemBand', hemband, bh, [('ray', (0, 0, HEM_Z + 0.0235), (0, 1, 0)), ('ray', (0, 0, HEM_Z + 0.002), (0, 1, 0))], C_SG)

# e. tab -> short drop down the centre back -> around each side of the waistband -> outer hip -> outer thigh
#    -> thigh pod -> shin pod
signal('FG_Signal_e_WaistCentre', waist, bw, [('ray', (0, 0, HEM_Z - 0.002), (0, 1, 0)), ('ray', (0, 0, CTRL_Z), (0, 1, 0))], C_TG)
for s, tag in ((1, 'L'), (-1, 'R')):
    wb = [('ray', side((0.0, 0, CTRL_Z), s), (0, 1, 0)),
          ('ray', side((0.10, 0, CTRL_Z), s), side((0.35, 1, 0), s)),
          ('ray', side((0.12, 0, CTRL_Z), s), side((1, 0.8, 0), s)),
          ('ray', side((0.12, 0, CTRL_Z), s), side((1, 0.05, 0), s)),
          ('ray', side((0.12, 0, WAIST_BOT + 0.003), s), side((1, 0.0, 0), s))]
    signal(f'FG_Signal_e_Waist{tag}', waist, bw, wb, C_TG)
    leg = [('ray', side((0.12, 0, WAIST_BOT - 0.003), s), side((1, 0.0, 0), s)),
           ('ray', side((0.12, -0.01, 0.86), s), side((1, -0.05, 0), s)),
           ('ray', side((0.12, -0.03, 0.74), s), side((1, -0.25, 0), s)),
           ('ray', side((0.13, -0.03, 0.68), s), side((0.55, -1, 0), s)),
           pc[f'Thigh_{tag}']]
    signal(f'FG_Signal_e_Thigh{tag}', tights, bt, leg, C_TG, ends=(pc[f'Thigh_{tag}'],))
    knee = [pc[f'Thigh_{tag}'],
            ('ray', side((0.15, -0.01, 0.55), s), side((0.75, -0.65, 0), s)),
            ('ray', side((0.16, 0.03, 0.44), s), side((0.8, -0.6, 0), s)),
            pc[f'Shin_{tag}']]
    signal(f'FG_Signal_e_Shin{tag}', tights, bt, knee, C_TG, ends=(pc[f'Thigh_{tag}'], pc[f'Shin_{tag}']))
print('pods', {k: tuple(round(c, 3) for c in v[1]) for k, v in PODS.items()})
