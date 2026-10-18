"""The squat video for 'How it works': render_squat.py --video's frames laid on the page's colour (Chalk) with the
soft floor shadow under the feet, then encoded to an MP4 by Blender's own FFmpeg, and the stills for phones.

    B=/Applications/Blender.app/Contents/MacOS/Blender
    $B -b --factory-startup --python suit-render/squat-video/encode_squat.py [-- --out preview.mp4]
    $B -b --factory-startup --python suit-render/squat-video/encode_squat.py -- --set curl   (or knee)

Reads  squat-video/renders/video/squat-NNN.png (transparent) and squat-video/floor-video.json (the shadow's box in
       each frame, from render_squat.py --video --points)
Writes squat-video/renders/video/comp/ (the frames on Chalk), public/squat/squat.mp4, and
       squat-video/renders/video/stills/still-K.png (the moments in STILLS; scripts/squat-frames.sh makes the WebP)

The composite works on the PNGs' own (display) values, as the browser did when the frames were transparent: the
shadow is the same radial gradient the page used to draw, and the video passes through untouched (Standard view).
"""
import bpy, os, sys, json, shutil, numpy as np
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

HERE = os.path.dirname(os.path.abspath(__file__))
# --set knee / curl: the knee or curl frames (render_squat.py --knee / --curl) instead, composited the same way and
# written as WebP frames public/demo/SET-NN.webp (no video)
SET = argv[argv.index('--set') + 1] if '--set' in argv else 'video'
SRC = os.path.join(HERE, 'renders', SET)
COMP = os.path.join(SRC, 'comp'); STILL_DIR = os.path.join(SRC, 'stills')
# --out FILE: write the MP4 elsewhere (a preview while the frames are still rendering; the last one is skipped)
PREVIEW = argv[argv.index('--out') + 1] if '--out' in argv else None
OUT = os.path.abspath(PREVIEW or os.path.join(HERE, '..', '..', 'public', 'squat', 'squat.mp4'))
FPS = 30
SIZE = (720, 960)                                     # the video (the frames are 900 x 1200)
CHALK = np.array([0xF2, 0xED, 0xE4]) / 255            # --color-chalk
SHADOW = np.array([27, 26, 23]) / 255                 # the page's ink, at 32 % in the middle, 12 % half-way out
STILLS = [0.17, 0.33, 0.57, 0.64]                     # src/sections/HowItWorks.tsx STEP_STILLS (steps 1-4)

frames = sorted(f for f in os.listdir(SRC) if f.startswith('squat-') and f.endswith('.png'))
if PREVIEW: frames = frames[:-1]
floor = json.load(open(os.path.join(HERE, f'floor-{SET}.json')))['floor']
for d in (COMP, STILL_DIR):
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)


def raw(img):
    img.colorspace_settings.name = 'Non-Color'
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


for i, f in enumerate(frames):
    img = bpy.data.images.load(os.path.join(SRC, f))
    px = raw(img); h, w = px.shape[:2]
    # rows run bottom-up in Blender; the floor box is 0-1 from the top
    box = floor[int(f[6:9]) - 1]
    if box is None:                                  # the feet are out of the shot
        sa = np.zeros((h, w, 1))
    else:
        x0, x1, y0, y1 = box
        xs = (np.arange(w) + 0.5) / w; ys = 1 - (np.arange(h) + 0.5) / h
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        d = np.sqrt(((xs[None, :] - cx) / rx) ** 2 + ((ys[:, None] - cy) / ry) ** 2)
        sa = np.interp(d, [0.0, 0.55, 1.0], [0.32, 0.12, 0.0])[..., None]
    ground = CHALK * (1 - sa) + SHADOW * sa
    a = px[..., 3:4]
    out = np.concatenate([px[..., :3] * a + ground * (1 - a), np.ones_like(a)], axis=2)
    o = bpy.data.images.new('comp', w, h, alpha=False)
    o.colorspace_settings.name = 'Non-Color'
    o.pixels.foreach_set(out.astype(np.float32).ravel())
    o.filepath_raw = os.path.join(COMP, f); o.file_format = 'PNG'; o.save()
    bpy.data.images.remove(o); bpy.data.images.remove(img)
    if i % 60 == 0: print(f'[encode] composited {i + 1}/{len(frames)}', flush=True)

n = len(frames)
if SET in ('knee', 'curl'):
    import subprocess
    pub = os.path.abspath(os.path.join(HERE, '..', '..', 'public', 'demo'))
    WEB_W = 720 if SET == 'curl' else 960          # the curl is portrait (900 x 1200), the knee landscape
    os.makedirs(pub, exist_ok=True)
    for f in frames:
        subprocess.run(['cwebp', '-quiet', '-q', '80', '-sharp_yuv', '-metadata', 'none', '-resize', str(WEB_W), '0',
                        os.path.join(COMP, f), '-o', os.path.join(pub, f'{SET}-{int(f[6:9]):02d}.webp')], check=True)
    print(f'[encode] {n} {SET} frames -> {pub}', flush=True)
    raise SystemExit(0)
for k, p in enumerate(STILLS if not PREVIEW else []):
    shutil.copy(os.path.join(COMP, frames[round(p * (n - 1))]), os.path.join(STILL_DIR, f'still-{k}.png'))

# ---------------------------------------------------------------- encode
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = *SIZE, 100
sc.render.fps = FPS; sc.frame_start = 1; sc.frame_end = n
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0.0
se = sc.sequence_editor_create()
strips = se.strips if hasattr(se, 'strips') else se.sequences
st = strips.new_image('squat', os.path.join(COMP, frames[0]), 1, 1)
for f in frames[1:]:
    st.elements.append(f)
st.colorspace_settings.name = 'sRGB'
if hasattr(st, 'fit_method'): st.fit_method = 'FIT'
ims = sc.render.image_settings
if hasattr(ims, 'media_type'): ims.media_type = 'VIDEO'
ims.file_format = 'FFMPEG'
ff = sc.render.ffmpeg
ff.format = 'MPEG4'; ff.codec = 'H264'
ff.constant_rate_factor = 'MEDIUM'; ff.ffmpeg_preset = 'BEST'
ff.gopsize = 15                                      # a keyframe every half second: the step list jumps quickly
ff.audio_codec = 'NONE'
sc.render.use_sequencer = True; sc.render.use_compositing = False
os.makedirs(os.path.dirname(OUT), exist_ok=True)
tmp = os.path.join(SRC, 'encode', 'squat-')
shutil.rmtree(os.path.dirname(tmp), ignore_errors=True)
sc.render.filepath = tmp
bpy.ops.render.render(animation=True, scene=sc.name)
made = [os.path.join(os.path.dirname(tmp), x) for x in os.listdir(os.path.dirname(tmp)) if x.endswith('.mp4')]
shutil.move(made[0], OUT)                            # Blender names it after the frame range
print(f'[encode] {OUT}: {os.path.getsize(OUT) / 1e6:.1f} MB, {n} frames', flush=True)
