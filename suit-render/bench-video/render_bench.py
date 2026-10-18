"""Bench-press video: preview, final frames, web encodes and the caption events, from the command line.

Everything for the video lives in suit-render/bench-video/. The scene is kept in its own file, formguard_bench.blend,
built from a copy of ../formguard_suit.blend, so the product file and its renders are never touched.

Typical runs (from the repo root, B = /Applications/Blender.app/Contents/MacOS/Blender, V = suit-render/bench-video):

  # after adjusting the suit (saved in formguard_suit.blend): rebuild the bench file from it, then quick previews
  $B -b --python $V/render_bench.py -- --rebuild --preview --angles threequarter,side,mobile

  # same, but first re-run the suit scripts (../scripts/build_all.py) on the product file, in memory
  $B -b --python $V/render_bench.py -- --rebuild --suit --preview

  # final frames (Cycles), both angles and the 4:5 mobile crop
  $B -b $V/formguard_bench.blend -S FG_Bench --python $V/render_bench.py -- --final --angles threequarter,side,mobile

  # encode finished frames into public/video (needs ffmpeg; pass --ffmpeg /path/to/ffmpeg if it isn't on PATH)
  $B -b $V/formguard_bench.blend -S FG_Bench --python $V/render_bench.py -- --encode --angles threequarter,mobile

-S FG_Bench makes the bench scene the active one; Blender only animates the active scene in background mode.
(--rebuild takes care of this itself: it saves formguard_bench.blend, then renders from it in a fresh Blender.)

Options:
  --rebuild            rebuild formguard_bench.blend from ../formguard_suit.blend (as saved) and save it
  --suit               with --rebuild: run the suit scripts (build_all) on the product scene first; the product file is not saved
  --preview            fast Workbench preview MP4s (960 x 540, or 432 x 540 for mobile) into --out
  --final              Cycles PNG frames into --out/<angle>/####.png
  --encode             MP4 (H.264, yuv420p, faststart) + WebM (VP9) at 1920 and 960 wide, and a WebP poster, into --web
  --angles a,b         threequarter, side, mobile (default: threequarter)
  --frames s-e         frame range (default 1-240)
  --samples N          Cycles samples for --final (default 128, adaptive, denoised)
  --out DIR            frames / previews folder (default bench-video/renders, git-ignored)
  --web DIR            web copies (default <repo>/public/video)
  --ffmpeg PATH        ffmpeg binary for --encode
"""
import bpy, sys, os, time, json, shutil, subprocess, builtins

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default

HERE = os.path.dirname(os.path.abspath(__file__))          # suit-render/bench-video
FG_ROOT = os.path.dirname(HERE)                            # suit-render
SCRIPTS = os.path.join(FG_ROOT, 'scripts')                 # the product pipeline (fg_lib, fg_scene, build_all ...)
REPO = os.path.dirname(FG_ROOT)
PRODUCT_FILE = os.path.join(FG_ROOT, 'formguard_suit.blend')
BENCH_FILE = os.path.join(HERE, 'formguard_bench.blend')
G = globals(); G['FG_ROOT'] = FG_ROOT; G['BENCH_DIR'] = HERE
OUT = os.path.abspath(opt('--out') or os.path.join(HERE, 'renders'))
WEB = opt('--web') or os.path.join(REPO, 'public', 'video')
ANGLES = (opt('--angles') or 'threequarter').split(',')
os.makedirs(OUT, exist_ok=True)

def load_libs():
    for f in ('fg_lib.py', 'fg_scene.py'):
        exec(open(os.path.join(SCRIPTS, f)).read(), G)
    for f in ('fg_rig.py', 'fg_bench.py'):
        exec(open(os.path.join(HERE, f)).read(), G)

if opt('--rebuild'):
    bpy.ops.wm.open_mainfile(filepath=PRODUCT_FILE, load_ui=False)
    if opt('--suit'):
        _src = bpy.data.scenes['Scene']
        with bpy.context.temp_override(scene=_src, view_layer=_src.view_layers[0]):
            exec(open(os.path.join(SCRIPTS, 'build_all.py')).read(), G)      # product suit + studio, in memory only
    load_libs()
    report = build(write_events_to=os.path.join(OUT, 'bench-events.json'))
    print('[bench] report', json.dumps(report, default=str))
    bpy.ops.wm.save_as_mainfile(filepath=BENCH_FILE, compress=True)
    print('[bench] saved', BENCH_FILE, flush=True)
    rest = [a for a in argv if a not in ('--rebuild', '--suit', '--save')]
    if any(a in rest for a in ('--preview', '--final', '--encode')):
        # render from the saved file in a fresh Blender, with FG_Bench as the active (animated) scene
        subprocess.run([bpy.app.binary_path, '-b', BENCH_FILE, '-S', 'FG_Bench', '--python', os.path.abspath(__file__),
                        '--', *rest, '--out', OUT], check=True)
    raise SystemExit(0)

if bpy.context.scene.name != 'FG_Bench':
    raise SystemExit('[bench] open formguard_bench.blend with  -S FG_Bench  (background mode only animates the active scene),'
                     ' or use --rebuild')
load_libs()

sc = BENCH
fr = opt('--frames')
f0, f1 = (int(x) for x in fr.split('-')) if isinstance(fr, str) else (1, FRAMES)
sc.frame_start, sc.frame_end = f0, f1
write_events(os.path.join(OUT, 'bench-events.json'))

def set_engine(name):
    try:
        sc.render.engine = name
    except TypeError as e:
        print('engine', e)

def ctx():
    return bpy.context.temp_override(scene=sc, view_layer=sc.view_layers[0])

if opt('--preview'):
    for angle in ANGLES:
        with ctx():
            set_angle('threequarter' if angle == 'mobile' else angle, mobile=(angle == 'mobile'))
        set_engine('BLENDER_WORKBENCH')
        sh = sc.display.shading
        sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_shadows = True; sh.show_cavity = False
        sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0.0  # preview only (not saved)
        sc.render.resolution_percentage = 50 if angle != 'mobile' else 40
        img = sc.render.image_settings
        if hasattr(img, 'media_type'):
            img.media_type = 'VIDEO'                      # Blender 5: video output is its own media type
        img.file_format = 'FFMPEG'
        sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'
        sc.render.ffmpeg.constant_rate_factor = 'MEDIUM'; sc.render.ffmpeg.audio_codec = 'NONE'
        sc.render.filepath = os.path.join(OUT, f'preview-{angle}-')
        t = time.time()
        bpy.ops.render.render(animation=True, scene=sc.name)
        print(f'[bench] preview {angle}: {time.time() - t:.0f} s -> {OUT}', flush=True)

if opt('--final'):
    for angle in ANGLES:
        with ctx():
            set_angle('threequarter' if angle == 'mobile' else angle, mobile=(angle == 'mobile'))
        set_engine('CYCLES')
        cy = sc.cycles
        cy.samples = int(opt('--samples', 128)); cy.use_adaptive_sampling = True; cy.use_denoising = True
        try:
            cy.device = 'GPU'
            p = bpy.context.preferences.addons['cycles'].preferences
            p.compute_device_type = 'METAL'; p.get_devices()
            for d in p.devices: d.use = (d.type == 'METAL')
        except Exception as e:
            print('device', e)
        sc.render.resolution_percentage = 100
        img = sc.render.image_settings
        if hasattr(img, 'media_type'):
            img.media_type = 'IMAGE'
        img.file_format = 'PNG'; img.color_depth = '8'; img.color_mode = 'RGB'; img.compression = 15
        d = os.path.join(OUT, angle); os.makedirs(d, exist_ok=True)
        sc.render.filepath = os.path.join(d, '####')
        t = time.time()
        bpy.ops.render.render(animation=True, scene=sc.name)
        print(f'[bench] final {angle}: {time.time() - t:.0f} s for frames {f0}-{f1} -> {d}', flush=True)

if opt('--encode'):
    ff = opt('--ffmpeg') or shutil.which('ffmpeg')
    if not ff:
        raise SystemExit('[bench] --encode needs ffmpeg: install it or pass --ffmpeg /path/to/ffmpeg')
    os.makedirs(WEB, exist_ok=True)
    sizes = {}
    for angle in ANGLES:
        src = os.path.join(OUT, angle, '%04d.png')
        widths = (1080, 540) if angle == 'mobile' else (1920, 960)
        for w in widths:
            base = os.path.join(WEB, f'bench-{angle}-{w}')
            vf = f'scale={w}:-2:flags=lanczos,format=yuv420p'
            subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-start_number', str(f0), '-i', src,
                            '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-profile:v', 'high',
                            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', base + '.mp4'], check=True)
            subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-start_number', str(f0), '-i', src,
                            '-vf', vf, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1',
                            '-pix_fmt', 'yuv420p', '-an', base + '.webm'], check=True)
            for ext in ('.mp4', '.webm'):
                sizes[os.path.basename(base + ext)] = os.path.getsize(base + ext)
        poster = os.path.join(WEB, f'bench-{angle}-poster.webp')
        subprocess.run([ff, '-y', '-loglevel', 'error', '-i', os.path.join(OUT, angle, '%04d.png' % K['r1_bottom']),
                        '-vf', f'scale={widths[0]}:-2', '-c:v', 'libwebp', '-quality', '82', poster], check=True)
        sizes[os.path.basename(poster)] = os.path.getsize(poster)
    shutil.copy(os.path.join(OUT, 'bench-events.json'), os.path.join(WEB, 'bench-events.json'))
    for k, v in sizes.items():
        print(f'[bench] {k}: {v / 1e6:.2f} MB')
