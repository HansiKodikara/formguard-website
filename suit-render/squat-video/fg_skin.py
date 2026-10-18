"""Skin and eyes for the squat lifter (the product renders keep their mannequin).

    skin_material()          light tan skin: subsurface scattering (random walk, skin), colour that varies gently
                             over the body, and pores and fine creases in the bump; roughness varies with them
    add_eyes(rig, coll)      the eyeballs Blender Studio made for this body (realistic_body_male in the Human Base
                             Meshes bundle, which Body_Form is, scaled to 1.80 m), parented to the head bone
"""
import bpy, math, os, numpy as np
from mathutils import Vector, Matrix

HBM = os.path.join(FG_ROOT, 'source', 'download_hbm', 'human-base-meshes-bundle-v1.4.1', 'human_base_meshes_bundle.blend')
# Body_Form = the bundle's GEO-body_male_realistic, feet on the floor and scaled to 1.80 m
HBM_LIFT, HBM_SCALE = 0.00555, 1.06514


def _node(nt, kind, loc, **inputs):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def _hex(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


class _Ex:
    """Tiny node-expression helper: math nodes from sockets and numbers."""
    def __init__(self, nt): self.nt, self.y = nt, 600
    def __call__(self, op, a, b=None, c=None):
        n = self.nt.nodes.new('ShaderNodeMath'); n.operation = op; n.location = (-200, self.y); self.y -= 40
        for i, v in enumerate((a, b, c)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: self.nt.links.new(v, n.inputs[i])
        return n.outputs[0]
    def band(self, x, a0, a1, b0, b1):
        """1 between a1 and b0, easing to 0 at a0 and b1"""
        up = self('MULTIPLY', self('SUBTRACT', x, a0), 1.0 / (a1 - a0)); dn = self('MULTIPLY', self('SUBTRACT', b1, x), 1.0 / (b1 - b0))
        return self('MINIMUM', self('MAXIMUM', self('MINIMUM', up, dn), 0.0), 1.0)


def _io(sockets, ident):
    return next(x for x in sockets if x.identifier == ident)


def skin_material(body, name='FG_Skin'):
    """All the texturing is placed on the body's rest shape (generated coordinates, back in metres), so pores, hair
    and brows stay on the skin as it moves."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); L = nt.links; E = _Ex(nt)
    out = _node(nt, 'ShaderNodeOutputMaterial', (900, 0))
    bs = _node(nt, 'ShaderNodeBsdfPrincipled', (600, 0))
    bs.subsurface_method = 'RANDOM_WALK_SKIN'
    bs.inputs['Subsurface Weight'].default_value = 1.0
    bs.inputs['Subsurface Radius'].default_value = (1.0, 0.36, 0.18)
    bs.inputs['Subsurface Scale'].default_value = 0.0045
    bs.inputs['IOR'].default_value = 1.4
    bs.inputs['Specular IOR Level'].default_value = 0.45
    L.new(bs.outputs[0], out.inputs[0])
    # rest-shape position in metres
    V = np.array([v.co[:] for v in body.data.vertices]); lo, hi = V.min(0), V.max(0)
    tc = _node(nt, 'ShaderNodeTexCoord', (-1600, 0))
    sc = nt.nodes.new('ShaderNodeVectorMath'); sc.operation = 'MULTIPLY_ADD'; sc.location = (-1400, 0)
    L.new(tc.outputs['Generated'], sc.inputs[0]); sc.inputs[1].default_value = tuple(hi - lo); sc.inputs[2].default_value = tuple(lo)
    P = sc.outputs[0]
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); sep.location = (-1200, 600); L.new(P, sep.inputs[0])
    X, Y, Z = sep.outputs
    # colour: a light tan that drifts warmer and cooler over the body, a few centimetres at a time
    big = _node(nt, 'ShaderNodeTexNoise', (-900, 300), Scale=6.0, Detail=3.0, Roughness=0.55)
    L.new(P, big.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.location = (-650, 300)
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = _hex('#C49A82')
    ramp.color_ramp.elements[1].position = 0.65; ramp.color_ramp.elements[1].color = _hex('#D5B099')
    L.new(big.outputs['Fac'], ramp.inputs['Fac'])
    # freckle-scale mottling, very faint
    fine = _node(nt, 'ShaderNodeTexNoise', (-900, 80), Scale=180.0, Detail=2.0)
    L.new(P, fine.inputs['Vector'])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.location = (-350, 250)
    _io(mix.inputs, 'Factor_Float').default_value = 0.10
    L.new(ramp.outputs['Color'], _io(mix.inputs, 'A_Color')); L.new(fine.outputs['Color'], _io(mix.inputs, 'B_Color'))
    # a buzz cut: above a hairline that runs from the forehead (z 1.755) down to the nape (z 1.635)
    stub = nt.nodes.new('ShaderNodeTexVoronoi'); stub.location = (-900, -700)
    stub.feature = 'F1'; stub.inputs['Scale'].default_value = 2600.0
    L.new(P, stub.inputs['Vector'])
    # the hairline (measured on Body_Form: forehead at y -0.15, the ears stand out at z 1.62-1.70 back to y 0.05,
    # the back of the skull at y 0.06 and the nape curving in under it): (a) the front, from the forehead (z 1.755)
    # through the temple down to just over the ear (1.705); (b) behind the ears, down to 1.60; (c) the back of the
    # head between the ears (|x| < 0.065), down to the nape at 1.575. The skull's side is |x| < 0.075; the ears stand
    # out past it
    yn = nt.nodes.new('ShaderNodeMapRange'); yn.location = (-700, -900)
    yn.inputs['From Min'].default_value = -0.16; yn.inputs['From Max'].default_value = 0.0
    L.new(Y, yn.inputs['Value'])
    fc = nt.nodes.new('ShaderNodeFloatCurve'); fc.location = (-500, -900)
    cv = fc.mapping.curves[0]
    pts = [(0.0, 0.82), (0.0625, 0.82), (0.375, 0.68), (0.69, 0.62), (1.0, 0.62)]
    cv.points[0].location = pts[0]; cv.points[1].location = pts[-1]
    for q in pts[1:-1]: cv.points.new(*q)
    fc.mapping.update()
    L.new(yn.outputs['Result'], fc.inputs['Value'])
    hz = E('MULTIPLY_ADD', fc.outputs['Value'], 0.25, 1.55)
    edge = _node(nt, 'ShaderNodeTexNoise', (-700, -1100), Scale=320.0, Detail=1.0)
    L.new(P, edge.inputs['Vector'])
    Zr = E('MULTIPLY_ADD', E('SUBTRACT', edge.outputs['Fac'], 0.5), 0.004, Z)     # a soft, uneven edge
    hair = E.band(E('SUBTRACT', Zr, hz), -0.006, 0.006, 9.0, 9.1)
    behind = E('MULTIPLY', E('MULTIPLY', E.band(Y, -0.03, 0.02, 9.0, 9.1), E.band(E('ABSOLUTE', X), -1.0, -0.99, 0.073, 0.079)),
               E.band(Zr, 1.594, 1.606, 9.0, 9.1))
    nape = E('MULTIPLY', E('MULTIPLY', E.band(E('ABSOLUTE', X), -1.0, -0.99, 0.058, 0.068), E.band(Y, -0.02, 0.0, 9.0, 9.1)),
             E.band(Zr, 1.569, 1.581, 9.0, 9.1))
    hair = E('MAXIMUM', E('MAXIMUM', hair, behind), nape)
    dots = E('SUBTRACT', 1.0, E('MINIMUM', E('MULTIPLY', stub.outputs['Distance'], 2.2), 1.0))
    hair = E('MULTIPLY', hair, E('MULTIPLY_ADD', dots, 0.12, 0.9))
    # eyebrows: an arch over each eye (eye centres at x 0.035, z 1.682), thinning towards the temple
    ax = E('ABSOLUTE', X)
    t = E('MULTIPLY', E('SUBTRACT', ax, 0.013), 1.0 / 0.050)
    zc = E('ADD', E('MULTIPLY', E('SINE', E('MULTIPLY', E('MINIMUM', E('MAXIMUM', t, 0.0), 1.0), math.pi * 0.9)), 0.0055), 1.7015)
    half = E('MULTIPLY_ADD', t, -0.0016, 0.0036)
    dz = E('ABSOLUTE', E('SUBTRACT', Z, zc))
    brow = E('SUBTRACT', 1.0, E('MINIMUM', E('MAXIMUM', E('DIVIDE', E('SUBTRACT', dz, E('MULTIPLY', half, 0.55)), E('MULTIPLY', half, 0.45)), 0.0), 1.0))
    brow = E('MULTIPLY', brow, E.band(ax, 0.011, 0.016, 0.058, 0.064))
    brow = E('MULTIPLY', brow, E.band(Y, -0.5, -0.49, -0.108, -0.098))
    brow = E('MULTIPLY', brow, E('MULTIPLY_ADD', dots, 0.1, 0.92))
    dark = E('MINIMUM', E('ADD', E('MULTIPLY', hair, 0.97), E('MULTIPLY', brow, 0.97)), 0.97)
    mix2 = nt.nodes.new('ShaderNodeMix'); mix2.data_type = 'RGBA'; mix2.location = (300, 250)
    L.new(dark, _io(mix2.inputs, 'Factor_Float')); L.new(_io(mix.outputs, 'Result_Color'), _io(mix2.inputs, 'A_Color'))
    _io(mix2.inputs, 'B_Color').default_value = _hex('#1E1712')
    L.new(_io(mix2.outputs, 'Result_Color'), bs.inputs['Base Color'])
    # pores (cells about half a millimetre across) and fine creases, in the bump
    por = nt.nodes.new('ShaderNodeTexVoronoi'); por.location = (-900, -200)
    por.feature = 'F1'; por.inputs['Scale'].default_value = 1900.0; por.inputs['Randomness'].default_value = 1.0
    L.new(P, por.inputs['Vector'])
    crease = _node(nt, 'ShaderNodeTexNoise', (-900, -450), Scale=420.0, Detail=6.0, Roughness=0.6)
    L.new(P, crease.inputs['Vector'])
    h = E('MULTIPLY_ADD', por.outputs['Distance'], 0.7, crease.outputs['Fac'])
    h = E('MULTIPLY_ADD', dots, E('MULTIPLY', hair, 0.6), h)
    bump = _node(nt, 'ShaderNodeBump', (300, -300), Strength=0.22, Distance=0.00035)
    L.new(h, bump.inputs['Height'])
    L.new(bump.outputs['Normal'], bs.inputs['Normal'])
    # roughness: 0.40-0.52 on skin, a touch shinier on the high points; matte where the hair is
    rr = nt.nodes.new('ShaderNodeMapRange'); rr.location = (0, -60)
    rr.inputs['To Min'].default_value = 0.40; rr.inputs['To Max'].default_value = 0.52
    L.new(crease.outputs['Fac'], rr.inputs['Value'])
    L.new(E('MULTIPLY_ADD', dark, 0.25, rr.outputs['Result']), bs.inputs['Roughness'])
    return m


def _eye_material(fwd):
    """Sclera, iris and pupil by the angle from the eye's forward axis (object space), under a wet clear coat."""
    m = bpy.data.materials.get('FG_Eye') or bpy.data.materials.new('FG_Eye')
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear(); L = nt.links
    out = _node(nt, 'ShaderNodeOutputMaterial', (900, 0))
    bs = _node(nt, 'ShaderNodeBsdfPrincipled', (600, 0))
    bs.inputs['Roughness'].default_value = 0.35
    bs.inputs['Coat Weight'].default_value = 1.0; bs.inputs['Coat Roughness'].default_value = 0.02
    bs.inputs['Coat IOR'].default_value = 1.376
    bs.inputs['Subsurface Weight'].default_value = 0.3; bs.inputs['Subsurface Scale'].default_value = 0.002
    L.new(bs.outputs[0], out.inputs[0])
    tc = _node(nt, 'ShaderNodeTexCoord', (-1000, 0))
    nrm = nt.nodes.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'; nrm.location = (-800, 0)
    L.new(tc.outputs['Object'], nrm.inputs[0])
    dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'; dot.location = (-600, 0)
    L.new(nrm.outputs[0], dot.inputs[0]); dot.inputs[1].default_value = tuple(fwd)
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.location = (-350, 0)
    cr = ramp.color_ramp; cr.interpolation = 'EASE'
    # cos of the angle from forward: sclera out past ~33 deg, a dark limbal ring, brown iris, pupil inside ~10 deg
    stops = [(0.83, '#D8D0C6'), (0.858, '#3A2A20'), (0.872, '#5A3B26'), (0.976, '#6B4A30'), (0.983, '#0B0806')]
    cr.elements[0].position, cr.elements[0].color = stops[0][0], _hex(stops[0][1])
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], _hex(stops[-1][1])
    for pos, col in stops[1:-1]:
        e = cr.elements.new(pos); e.color = _hex(col)
    L.new(dot.outputs['Value'], ramp.inputs['Fac'])
    L.new(ramp.outputs['Color'], bs.inputs['Base Color'])
    return m


def add_eyes(rig, coll):
    names = ['GEO-body_male_realistic', 'GEO-body_male_realistic.eye.L', 'GEO-body_male_realistic.eye.R']
    with bpy.data.libraries.load(HBM) as (src, dst):
        dst.objects = names
    base, *eyes = dst.objects
    S = Matrix.Diagonal((HBM_SCALE, HBM_SCALE, HBM_SCALE, 1.0)) @ Matrix.Translation((0, 0, HBM_LIFT))
    made = []
    for e in eyes:
        W = base.matrix_world @ e.matrix_parent_inverse @ e.matrix_basis
        me = e.data.copy(); me.transform(S @ W)                 # into Body_Form space, applied
        ob = bpy.data.objects.new('FG_' + e.name.split('.', 1)[1].replace('.', '_'), me); coll.objects.link(ob)
        P = np.array([v.co[:] for v in me.vertices]); c = P.mean(0)
        me.transform(Matrix.Translation(Vector(-c))); ob.location = Vector(c)   # origin at the eye's centre
        P = P - c
        fwd = np.array((0.0, -1.0, -0.08)); fwd /= np.linalg.norm(fwd)   # looking ahead (-Y), a little down
        me.materials.clear(); me.materials.append(_eye_material(fwd))
        for p in me.polygons: p.use_smooth = True
        # rigidly on the head bone (a deform modifier would move the vertices in the eye's own space, and the iris,
        # placed in that space, would roll out of sight as the head tilts)
        hb = rig.data.bones['head']
        ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = 'head'
        ob.matrix_parent_inverse = (rig.matrix_world @ hb.matrix_local @ Matrix.Translation((0, hb.length, 0))).inverted()
        made.append(ob)
        print(f'[eyes] {ob.name} at {tuple(round(x, 4) for x in c)}, d = {2 * np.linalg.norm(P, axis=1).max() * 1000:.1f} mm, looks {tuple(round(x, 2) for x in fwd)}')
    for o in (base, *eyes):
        bpy.data.objects.remove(o)
    return made
