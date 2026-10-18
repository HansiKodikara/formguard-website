# Bench-press video

An 8 s, 30 fps loop of the FormGuard suit on the rigged mannequin. Rep 1 has flared elbows and a hold at the bottom.
Rep 2 is tucked. A lockout hold at the end loops back to frame 1.

Everything for the video lives in this folder. The scene `FG_Bench` is kept in its own file, `formguard_bench.blend`,
which is built from a copy of `../formguard_suit.blend`. The product file and its renders are never modified.

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
V=suit-render/bench-video
# after adjusting the suit and saving formguard_suit.blend: rebuild the bench file from it, then make quick previews
$B -b --python $V/render_bench.py -- --rebuild --preview --angles threequarter,side,mobile
# the same, but first re-run the suit scripts (../scripts/build_all.py) on the product scene, in memory only
$B -b --python $V/render_bench.py -- --rebuild --suit --preview
# final frames (Cycles)
$B -b $V/formguard_bench.blend -S FG_Bench --python $V/render_bench.py -- --final --angles threequarter,mobile
# web encodes, posters and bench-events.json into public/video (needs ffmpeg)
$B -b $V/formguard_bench.blend -S FG_Bench --python $V/render_bench.py -- --encode --angles threequarter,mobile
```

When you render from `formguard_bench.blend`, `-S FG_Bench` is required, because Blender in background mode only
animates the active scene. `--rebuild` handles this for you. Previews and frames go to `renders/` by default, which
git ignores. Use `--out` to send them somewhere else.

| File | What it does |
| --- | --- |
| `fg_rig.py` | Builds the armature on the body's measured joint centres, assigns bone-heat weights, and adds procedural grip weights for the hands. |
| `fg_bench.py` | Builds the bench scene: the display body and its masks, the suit frozen and bound to the skeleton, the lying pose settled on the pad, leg and arm IK, the two reps, the equipment, sweep, lights, cameras and caption events. |
| `render_bench.py` | The command line: `--rebuild`, `--suit`, `--preview`, `--final`, `--encode`, `--angles`, `--frames`, `--samples`, `--out`, `--web`, `--ffmpeg`. |
| `equipment/` | The downloaded `bench.blend` and `barbell.blend`. They are scaled to a 0.44 m pad and a 2.2 m bar and given neutral matte materials. Without them, the build uses simple stand-ins (`FG_Proxy_*`). |

The shared helpers (`fg_lib.py`, `fg_scene.py`) and the suit itself come from `../scripts`.

Settings at the top of each section of `fg_bench.py`:

- **Timing:** the frame table `K` (rep start, bottoms, flare hold, lockouts). `bench-events.json` is written from it.
- **Form:**
  - `GRIP_X` sets the hand width.
  - `TOUCH_1` and `TOUCH_2` set where the bar touches the chest.
  - `FLARE_POLE_*` and `TUCK_POLE_*` set the elbow angles. The build prints the measured elbow angle and forearm lean at both bottoms.
  - The arch and grip are in `static_pose()`.
- **Cameras:** `CAMERAS` (bearing, elevation, lens) and `MOBILE`. The framing is fitted automatically to the bar, feet, head and bench.

How the suit follows the body:

- The suit's procedural modifier stacks are applied at rest (viewport subdivision).
- Every piece (garments, bands, pods, logos, signal seams, stitches, controller, tab) gets the body's weights by
  nearest-face transfer and the same Armature modifier (preserve volume).
- Skin that is fully covered by the suit (more than 22 mm inside a garment edge) is masked on the display body, so it
  can never push through the fabric.
