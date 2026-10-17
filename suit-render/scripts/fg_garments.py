"""Shirt and tights base meshes cut from the Body_Form surface, plus rib/waist bands."""
import bpy, bmesh, math, numpy as np, builtins
from mathutils import Vector
M = builtins.FG_M
body = bpy.data.objects['Body_Form']
C_SHIRT = collection('FG_Shirt_Set')
C_TIGHTS = collection('FG_Tights_Set')

# ---- landmarks (metres, Blender coords: +X = wearer's left, -Y = front, Z up)
HEM_Z = 1.000            # shirt hem (bottom edge), mid-hip
WAIST_TOP = HEM_Z + 0.020  # tights waistband overlaps the hem by 20 mm
WAIST_H = 0.060
ANKLE_Z = 0.095          # tights end at the ankle bone
ELBOW = Vector((0.341, -0.013, 1.090))
WRIST = Vector((0.398, -0.068, 0.945))   # cuff end, at the wrist bone
FORE = (WRIST - ELBOW).normalized()

def neck_centre_y(z):
    return -0.005 - (z - 1.48) * 0.35

def neck_cut_z(x, y, z):
    th = math.atan2(abs(x), -(y - neck_centre_y(z)))   # 0 = front, pi = back
    zf, zs, zb = 1.478, 1.535, 1.522
    a1 = (zf - zb) / 2; a0 = (zf + zb + 2 * zs) / 4; a2 = (zf + zb) / 2 - a0
    return a0 + a1 * math.cos(th) + a2 * math.cos(2 * th)

def mirror(v, s):
    return Vector((v.x * s, v.y, v.z))

def cut_garment(name, keep_fn, planes):
    bm = bmesh.new()
    bm.from_mesh(body.data)
    for co, no, sel in planes:
        geom = [e for e in bm.edges if all(sel(v.co) for v in e.verts)] + [f for f in bm.faces if all(sel(v.co) for v in f.verts)]
        geom += list({v for e in geom if isinstance(e, bmesh.types.BMEdge) for v in e.verts})
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, dist=1e-6)
    dead = [v for v in bm.verts if not keep_fn(v.co)]
    bmesh.ops.delete(bm, geom=dead, context='VERTS')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0015)
    bmesh.ops.dissolve_degenerate(bm, dist=0.0005, edges=bm.edges)
    # keep the largest connected piece
    bm.verts.ensure_lookup_table()
    seen, parts = set(), []
    for v in bm.verts:
        if v in seen: continue
        stack, comp = [v], []
        seen.add(v)
        while stack:
            a = stack.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b not in seen: seen.add(b); stack.append(b)
        parts.append(comp)
    parts.sort(key=len, reverse=True)
    for comp in parts[1:]:
        bmesh.ops.delete(bm, geom=comp, context='VERTS')
    remove_object(name)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    return ob

# ---------------------------------------------------------------- SHIRT
EPS = 1e-5
def shirt_keep(c):
    if c.z > 1.56: return False
    r = math.hypot(c.x, c.y - neck_centre_y(c.z))
    if r < 0.13 and c.z > 1.40 and c.z > neck_cut_z(c.x, c.y, c.z) + EPS: return False
    if abs(c.x) < 0.25 and c.z < HEM_Z - EPS: return False
    s = 1 if c.x > 0 else -1
    if abs(c.x) > 0.27 and (c - mirror(WRIST, s)).dot(mirror(FORE, s)) > EPS: return False
    return True

planes = [((0, 0, HEM_Z), (0, 0, 1), lambda c: abs(c.x) < 0.25)]
for s in (1, -1):
    planes.append((tuple(mirror(WRIST, s)), tuple(mirror(FORE, s)), (lambda s: lambda c: c.x * s > 0.27 and c.z < 1.06)(s)))
shirt = cut_garment('FG_Shirt', shirt_keep, planes)
C_SHIRT.objects.link(shirt)

# ---------------------------------------------------------------- TIGHTS
def tights_keep(c):
    return abs(c.x) < 0.27 and ANKLE_Z - EPS <= c.z <= WAIST_TOP + EPS
tights = cut_garment('FG_Tights', tights_keep, [((0, 0, WAIST_TOP), (0, 0, 1), lambda c: abs(c.x) < 0.27),
                                                ((0, 0, ANKLE_Z), (0, 0, 1), lambda c: abs(c.x) < 0.27)])
C_TIGHTS.objects.link(tights)

body_bvh, _ = bvh_of(body)

# ---------------------------------------------------------------- boundary loops
def boundary_loops(ob):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bedges = [e for e in bm.edges if e.is_boundary]
    adj = {}
    for e in bedges:
        a, b = e.verts
        adj.setdefault(a.index, []).append(b.index); adj.setdefault(b.index, []).append(a.index)
    loops, used = [], set()
    for start in adj:
        if start in used: continue
        loop, prev, cur = [start], None, start
        used.add(start)
        while True:
            nxt = [n for n in adj[cur] if n != prev and n not in used]
            if not nxt: break
            prev, cur = cur, nxt[0]
            loop.append(cur); used.add(cur)
        loops.append(loop)
    # interior neighbour direction per boundary vertex
    bm.verts.ensure_lookup_table()
    inward = {}
    for i in adj:
        v = bm.verts[i]
        acc = Vector()
        for e in v.link_edges:
            if not e.is_boundary:
                acc += (e.other_vert(v).co - v.co).normalized()
        inward[i] = acc
    bm.free()
    return loops, inward

def smooth_loop(pts, it=6):
    P = [Vector(p) for p in pts]
    n = len(P)
    for _ in range(it):
        P = [(P[i - 1] + P[i] * 2 + P[(i + 1) % n]) / 4 for i in range(n)]
        P = [nearest(body_bvh, p)[0] for p in P]
    return P

def resample_closed(P, step):
    Q = P + [P[0]]
    out = resample(Q, step)
    return out[:-1]

def band_strip(name, loop_pts, inward_dirs, width, extend, coll, rib_period=None, rows_step=0.004):
    """Strip from 'extend' beyond the garment edge to 'width' into the garment, marched row by row on the
    body surface; each row is smoothed along the loop so the band edge stays clean."""
    n = len(loop_pts)
    nrow = max(1, round(width / rows_step))
    dists = [-extend] + [width * k / nrow for k in range(nrow + 1)]
    base = [nearest(body_bvh, p) for p in loop_pts]
    cur = [b[0] for b in base]
    dirs = [tangent_dir(b[1], d) for b, d in zip(base, inward_dirs)]
    rows = {1: cur}
    rows[0] = [nearest(body_bvh, p - d * extend)[0] for p, d in zip(cur, dirs)]
    for k in range(2, len(dists)):
        step = dists[k] - dists[k - 1]
        nxt = []
        for p, d in zip(cur, dirs):
            nxt.append(p + d * step)
        # smooth along the loop, then project back to the surface
        for _ in range(2):
            nxt = [(nxt[i - 1] + nxt[i] * 2 + nxt[(i + 1) % n]) / 4 for i in range(n)]
        proj = [nearest(body_bvh, q) for q in nxt]
        newdirs = []
        for i in range(n):
            q, qn = proj[i]
            t = tangent_dir(qn, q - cur[i])
            newdirs.append(t if t.length > 0.5 else tangent_dir(qn, dirs[i]))
        cur = [q for q, _ in proj]; dirs = newdirs
        rows[k] = cur
    R = len(dists)
    verts, faces = [], []
    for i in range(n):
        for k in range(R):
            verts.append(nearest(body_bvh, rows[k][i])[0])   # on the body; band_stack seats it on the garment
    for i in range(n):
        j = (i + 1) % n
        for k in range(R - 1):
            faces.append((i * R + k, j * R + k, j * R + k + 1, i * R + k + 1))
    ob = new_mesh_object(name, verts, faces, coll)
    me = ob.data
    uvl = me.uv_layers.new(name='UVMap')
    arc = [0.0]
    for i in range(1, n + 1):
        arc.append(arc[-1] + (Vector(loop_pts[i % n]) - Vector(loop_pts[i - 1])).length)
    per = rib_period or 0.0015
    k_u = (2 * math.pi / 20) / per
    for poly in me.polygons:
        cols = [me.loops[l].vertex_index // R for l in poly.loop_indices]
        wrap = (0 in cols) and (n - 1 in cols)
        for li in poly.loop_indices:
            i, k = divmod(me.loops[li].vertex_index, R)
            ii = n if (wrap and i == 0) else i
            uvl.data[li].uv = (arc[ii] * k_u, dists[k])
    for p in me.polygons: p.use_smooth = True
    return ob

def order_loop(pts):
    P = np.array([tuple(p) for p in pts])
    c = P.mean(0)
    u, sv, vt = np.linalg.svd(P - c)
    n = vt[2]; a = vt[0]; b = vt[1]
    ang = np.arctan2((P - c) @ b, (P - c) @ a)
    order = np.argsort(ang)
    return order

def loop_bands(ob, specs, coll):
    loops, inward = boundary_loops(ob)
    me = ob.data
    out = []
    for loop in loops:
        if len(loop) < 8:
            continue
        pts = [me.vertices[i].co.copy() for i in loop]
        c = sum(pts, Vector()) / len(pts)
        spec = next((s for s in specs if s['match'](c)), None)
        if spec is None:
            print('unmatched loop at', c, len(loop)); continue
        order = order_loop(pts)
        loop = [loop[k] for k in order]
        pts = [pts[k] for k in order]
        sm = smooth_loop(pts, spec.get('smooth', 1))
        for i, p in zip(loop, sm):
            me.vertices[i].co = p
        P = resample_closed(sm, 0.004)
        P = smooth_loop(P, 2)
        D = [Vector(spec['inward'](p)) for p in P]
        b = band_strip(spec['name'], P, D, spec['width'], spec.get('extend', 0.0015), coll, spec.get('rib'))
        me_b = b.data
        flips = 0
        bvh_b = body_bvh
        votes = 0
        for f in me_b.polygons:
            loc, nor = nearest(bvh_b, f.center)
            votes += 1 if f.normal.dot(nor) > 0 else -1
        if votes < 0:
            for f in me_b.polygons: f.flip()
        me_b.update()
        out.append((spec, b))
    me.update()
    return out

def weight_group(ob, name, fn):
    vg = ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name)
    for v in ob.data.vertices:
        w = fn(v.co)
        if w > 0: vg.add([v.index], min(1.0, w), 'REPLACE')
        else: vg.remove([v.index])
    return vg

def falloff(c, centre, radius, scale=(1, 1, 1)):
    d = Vector(((c.x - centre[0]) / scale[0], (c.y - centre[1]) / scale[1], (c.z - centre[2]) / scale[2])).length
    t = max(0.0, 1.0 - d / radius)
    return t * t * (3 - 2 * t)

CROTCH = ((0.0, -0.118, 0.862), 0.062, (0.7, 1.3, 1.0))

def garment_stack(ob, offset, thickness, mat_out, mat_in, subdiv=2, crotch=False, pin=lambda c: 1.0):
    ob.modifiers.clear()
    bm = bmesh.new(); bm.from_mesh(ob.data)
    ring = {v.index for v in bm.verts if v.is_boundary}
    for _ in range(2):
        ring |= {e.other_vert(v).index for v in bm.verts if v.index in ring for e in v.link_edges}
    bm.free()
    weight_group(ob, 'smooth_w', lambda c: 0.0)
    vg = ob.vertex_groups['smooth_w']
    for v in ob.data.vertices:
        w = 0.0 if v.index in ring else pin(v.co)
        if w > 0: vg.add([v.index], w, 'REPLACE')
    if crotch:
        weight_group(ob, 'crotch', lambda c: falloff(c, *CROTCH))
        weight_group(ob, 'wrap_w', lambda c: 1.0 - falloff(c, *CROTCH))
        m = ob.modifiers.new('CrotchMembrane', 'SMOOTH'); m.factor = 1.0; m.iterations = 80; m.vertex_group = 'crotch'
    m = ob.modifiers.new('BridgeSmooth', 'SMOOTH'); m.factor = 0.5; m.iterations = 6; m.vertex_group = 'smooth_w'
    # tension: Laplacian relax (no volume preservation: that rescales the whole mesh), then the
    # Shrinkwrap pushes anything that sank inside back out, so the fabric bridges hollows only.
    ls = ob.modifiers.new('FabricTension', 'LAPLACIANSMOOTH')
    ls.iterations = 6; ls.lambda_factor = 1.0; ls.lambda_border = 0.0; ls.use_volume_preserve = False
    ls.use_normalized = True; ls.vertex_group = 'smooth_w'
    add_shrinkwrap(ob, body, offset, wrap='OUTSIDE', vgroup='wrap_w' if crotch else None)
    s = ob.modifiers.new('Subdivision', 'SUBSURF'); s.levels = 1; s.render_levels = subdiv; s.quality = 3
    so = ob.modifiers.new('Solidify', 'SOLIDIFY'); so.thickness = thickness; so.offset = -1.0
    so.use_even_offset = False; so.use_quality_normals = True; so.thickness_clamp = 1.0
    so.use_rim = True; so.material_offset = 1; so.material_offset_rim = 0
    ob.data.materials.clear(); ob.data.materials.append(mat_out); ob.data.materials.append(mat_in)
    for p in ob.data.polygons: p.use_smooth = True; p.material_index = 0

def band_stack(ob, garment, lift, thickness, mat_out, mat_in):
    """Seat the band 'lift' above the garment's outer surface (ray-cast along the body normal),
    then solidify it inward by 'thickness' so it wraps the garment's cut edge."""
    ob.modifiers.clear()
    gb = outer_bvh(garment)
    for v in ob.data.vertices:
        q, qn = nearest(body_bvh, v.co)
        loc, nor, _, _ = gb.ray_cast(q + qn * 0.012, -qn, 0.03)
        if loc is None:                       # beyond the garment's cut edge: follow the body at garment height
            v.co = q + qn * (0.002 + lift)
            continue
        nor = nor.normalized()
        if nor.dot(qn) < 0: nor = -nor
        v.co = loc + nor * lift
    ob.data.update()
    so = ob.modifiers.new('Solidify', 'SOLIDIFY'); so.thickness = thickness; so.offset = -1.0
    so.use_even_offset = False; so.use_quality_normals = True; so.use_rim = True
    so.material_offset = 1; so.material_offset_rim = 0
    s = ob.modifiers.new('Subdivision', 'SUBSURF'); s.levels = 1; s.render_levels = 2; s.quality = 3
    ob.data.materials.clear(); ob.data.materials.append(mat_out); ob.data.materials.append(mat_in)

# ---- shirt bands
RIB = 0.0016
shirt_specs = [
    dict(name='FG_Shirt_NeckRib', match=lambda c: c.z > 1.40, width=0.015, smooth=8, rib=RIB, inward=lambda p: (p.x * 0.6, (p.y - neck_centre_y(p.z)) * 0.6, -0.12)),
    dict(name='FG_Shirt_HemBand', match=lambda c: abs(c.z - HEM_Z) < 0.01 and abs(c.x) < 0.1, width=0.025, rib=None, inward=lambda p: (0, 0, 1)),
    dict(name='FG_Shirt_Cuff_L', match=lambda c: c.x > 0.3 and c.z < 1.0, width=0.020, rib=RIB, inward=lambda p: tuple(-mirror(FORE, 1))),
    dict(name='FG_Shirt_Cuff_R', match=lambda c: c.x < -0.3 and c.z < 1.0, width=0.020, rib=RIB, inward=lambda p: tuple(-mirror(FORE, -1))),
]
shirt_bands = loop_bands(shirt, shirt_specs, C_SHIRT)
def ramp(z, z0, z1):
    t = min(1.0, max(0.0, (z - z0) / (z1 - z0)))
    return t * t * (3 - 2 * t)
# both garments hug the body where they overlap at the waist (hem / waistband); bridging elsewhere
garment_stack(shirt, 0.0020, 0.0012, M['fabric'], M['fabric_in'], pin=lambda c: ramp(c.z, HEM_Z + 0.03, HEM_Z + 0.08))
for spec, b in shirt_bands:
    band_stack(b, shirt, 0.0010, 0.0026, M['rib'] if spec['rib'] else M['waist'], M['fabric_in'])

tights_specs = [
    dict(name='FG_Tights_Waistband', match=lambda c: c.z > WAIST_TOP - 0.01, width=WAIST_H, rib=None, inward=lambda p: (0, 0, -1)),
    dict(name='FG_Tights_AnkleHem_L', match=lambda c: c.z < 0.2 and c.x > 0, width=0.012, rib=None, inward=lambda p: (0, 0, 1)),
    dict(name='FG_Tights_AnkleHem_R', match=lambda c: c.z < 0.2 and c.x < 0, width=0.012, rib=None, inward=lambda p: (0, 0, 1)),
]
tights_bands = loop_bands(tights, tights_specs, C_TIGHTS)
garment_stack(tights, 0.0020, 0.0012, M['fabric'], M['fabric_in'], crotch=True,
              pin=lambda c: ramp(-c.z, -(WAIST_TOP - WAIST_H - 0.005), -(WAIST_TOP - WAIST_H - 0.055)))
for spec, b in tights_bands:
    if 'Waistband' in spec['name']:
        band_stack(b, tights, 0.0016, 0.0030, M['waist'], M['fabric_in'])
    else:
        band_stack(b, tights, 0.0006, 0.0020, M['fabric'], M['fabric_in'])
print('shirt verts', len(shirt.data.vertices), 'tights verts', len(tights.data.vertices))
print([o.name for o in C_SHIRT.objects], [o.name for o in C_TIGHTS.objects])
