"""Scene settings, world and all materials."""
import bpy
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0; sc.unit_settings.length_unit = 'MILLIMETERS'
try:
    sc.render.engine = 'CYCLES'
except TypeError as e:
    print('engine', e)
cy = sc.cycles
cy.samples = 256
cy.use_denoising = True
cy.use_adaptive_sampling = True
try:
    _cp = bpy.context.preferences.addons['cycles'].preferences
    _cp.compute_device_type = 'METAL'
    _cp.get_devices()
    for d in bpy.context.preferences.addons['cycles'].preferences.devices:
        d.use = (d.type == 'METAL')
    cy.device = 'GPU'
except Exception as e:
    print('device', e)
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 2000, 3000, 100
vs = sc.view_settings
try:
    vs.view_transform = 'AgX'
except TypeError:
    vs.view_transform = 'Filmic'
for lk in (vs.view_transform + ' - Medium High Contrast', 'Medium High Contrast'):
    try:
        vs.look = lk; break
    except TypeError:
        pass
vs.exposure = 0.0; vs.gamma = 1.0
sc.display_settings.display_device = sc.display_settings.display_device
img = sc.render.image_settings
img.file_format = 'PNG'; img.color_depth = '16'; img.color_mode = 'RGB'; img.compression = 15
sc.render.film_transparent = False
print('view', vs.view_transform, 'look', vs.look)

# world
w = sc.world or bpy.data.worlds.new('World')
sc.world = w
w.use_nodes = True
bg = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = hex_rgba('#0B0A09')
bg.inputs['Strength'].default_value = 0.2

# materials
M = {}
M['fabric'] = add_bump(principled('FG_Fabric', '#1B1A17', rough=0.55, spec=0.3, sheen=0.4, sheen_tint='#F2EDE4'), scale=1800, strength=0.05)
M['fabric_in'] = add_bump(principled('FG_Fabric_Inner', '#0F0E0C', rough=0.7, spec=0.2, sheen=0.15, sheen_tint='#F2EDE4'), scale=1800, strength=0.05)
M['rib'] = add_bump(principled('FG_Rib', '#1B1A17', rough=0.6, spec=0.3, sheen=0.4, sheen_tint='#F2EDE4'), scale=1800, strength=0.12, rib=(1.0, 'X'))
M['waist'] = add_bump(principled('FG_Waistband', '#1B1A17', rough=0.5, spec=0.3, sheen=0.45, sheen_tint='#F2EDE4'), scale=2400, strength=0.03)
M['signal'] = principled('FG_SignalTrim', '#8F897E', rough=0.25, metallic=0.6, spec=0.5)
M['stitch'] = principled('FG_Stitch', '#4A4740', rough=0.7, spec=0.3)
M['pod_ring'] = principled('FG_PodRing', '#D9D3C8', rough=0.4, spec=0.4)
M['pod_gap'] = principled('FG_PodGap', '#151412', rough=0.5, spec=0.3)
M['pod_dot'] = principled('FG_PodDot_PlateRed', '#C62B22', rough=0.35, spec=0.4)
M['haptic'] = principled('FG_HapticRing', '#6E685F', rough=0.6, spec=0.3)
M['ctrl'] = principled('FG_ControllerPolymer', '#141311', rough=0.6, spec=0.4)
M['ctrl_edge'] = principled('FG_ControllerEdge', '#8F897E', rough=0.3, metallic=0.6, spec=0.5)
M['tab'] = principled('FG_TabPolymer', '#141311', rough=0.6, spec=0.4)
M['contact'] = principled('FG_ContactDot', '#8F897E', rough=0.25, metallic=0.6, spec=0.5)
M['logo_chalk'] = principled('FG_Logo_Chalk', '#F2EDE4', rough=0.6, spec=0.3)
M['logo_red'] = principled('FG_Logo_PlateRed', '#C62B22', rough=0.6, spec=0.3)
M['backdrop'] = principled('FG_Backdrop', '#1B1A17', rough=0.9, spec=0.3)
import builtins; builtins.FG_M = M
