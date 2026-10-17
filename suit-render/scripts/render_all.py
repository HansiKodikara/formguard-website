"""Render the FormGuard suit shots from the command line (Blender in background mode).

    blender -b suit-render/formguard_suit.blend --python suit-render/scripts/render_all.py -- [options]

Options (all optional):
    --shots 01_shirt_front,02_shirt_back   only these shots (default: all five)
    --samples 256                          Cycles samples (default 256)
    --percent 100                          resolution percentage of 2000 x 3000 (default 100)
    --rebuild                              rebuild garments, details, logos and stage from Body_Form first
    --out /some/folder                     output folder (default: suit-render/FormGuard_Renders)
    --save                                 save the .blend after a --rebuild

Shots: 01_shirt_front, 02_shirt_back, 03_tights_front, 04_tights_back, 05_suit_three_quarter_back
"""
import bpy, sys, os, time, builtins

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default

HERE = os.path.dirname(os.path.abspath(__file__))
FG_ROOT = os.path.dirname(HERE)
G = globals(); G['FG_ROOT'] = FG_ROOT

if opt('--rebuild'):
    exec(open(os.path.join(HERE, 'build_all.py')).read(), G)
    if opt('--save'):
        bpy.ops.wm.save_mainfile()
else:
    for f in ('fg_lib.py', 'fg_scene.py', 'fg_stage.py'):
        exec(open(os.path.join(HERE, f)).read(), G)

sc = bpy.context.scene
sc.cycles.samples = int(opt('--samples', 256))
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 2000, 3000
sc.render.resolution_percentage = int(opt('--percent', 100))
img = sc.render.image_settings
img.file_format = 'PNG'; img.color_depth = '16'; img.color_mode = 'RGB'
out = opt('--out') or os.path.join(FG_ROOT, 'FormGuard_Renders')
os.makedirs(out, exist_ok=True)

wanted = opt('--shots')
shots = [s[0] for s in builtins.FG_SHOTS]
if isinstance(wanted, str):
    shots = [s for s in shots if s in wanted.split(',')]

for name in shots:
    t = time.time()
    builtins.FG_setup_shot(name)
    sc.render.filepath = os.path.join(out, name + '.png')
    bpy.ops.render.render(write_still=True)
    print(f'[FormGuard] rendered {name} in {time.time() - t:.0f} s -> {sc.render.filepath}', flush=True)
