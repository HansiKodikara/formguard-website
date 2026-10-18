# Squat video

The back squat in the website's "How it works" section. The FormGuard suit is shown on the rigged lifter and rendered in Cycles with the product renders' studio lights. On the site it plays as a video, and the video's time drives the story beside it.

The video is one 26-second take at 30 fps (780 frames). The lifter does the story's reps while the camera moves through five shots, one per step, always on its way to the next, as the site's earlier real-time lifter did:

1. Three-quarter front, from his left.
2. Round to his right for the warm-up.
3. Square on, where the knee caving shows.
4. In close on the knees.
5. Back out.

The lights turn with the camera. The frames are rendered transparent, then `encode_squat.py` lays them on the page's colour (Chalk) with a soft floor shadow under the feet and encodes the MP4 with Blender's own FFmpeg.

The poses come from a motion library of two reps:

- **Motion frames 1–37:** a clean rep. Frame 1 is standing, frame 19 is the bottom, and frame 37 is standing again.
- **Motion frames 38–74:** the same rep with the left knee caving in, timed to match the site's rep 7:
  - It starts to cave late on the way down.
  - It is fully in at the bottom (frame 56) and through the first half of the drive.
  - It pushes back out before lockout.

## The curl frames

"How it works" on the site uses 80 frames rendered with `--curl` (`fg_curl.py`):

- **What's shown:** just his left arm, curling a dumbbell, seen three-quarters from his front-left and a little from above. The shot is tilted (`CURL_SHOT`) so the arm runs from the shoulder at the top right down to the dumbbell at the bottom left, because the arm sits on the right of the page. The upper arm is by his side, the palm up, and the fingers are solved round the handle.
- **The two lifts:** frames 1–40 are a clean lift, bottom to top. Frames 41–80 are the same lift with the classic fault: the upper arm swings forward, late in the lift, up to `CURL_DRIFT` (35°).
- **The rest of him:** body and suit are masked to the arm, and the arm fades out towards the shoulder, so the cut never shows.
- **Skinning:** the elbow uses volume-preserving skinning plus the smoothing pass. Plain skinning pinches the elbow's point into two lobes at the top of the curl.

On the page, scrolling plays the two reps (the way down is the same frames backwards). `--points` also projects the dumbbell into every frame, and the page draws its path as a faint dotted line. On rep 2 the clean path stays as his normal, the new path turns red where the elbow leaves it, and the elbow ring goes red and pulses.

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py -- --curl --points src/viz/curlFrames.json
$B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py -- --curl --samples 96   # about 4 min
$B -b --factory-startup --python suit-render/squat-video/encode_squat.py -- --set curl                            # public/demo/curl-NN.webp
```

`--knee` makes the same kind of frames for the squat: the legs at the bottom, with the left knee caving.

The video (below) is no longer on the site, but the pipeline still works.

## How the motion is made

The squat's form follows the site's earlier Anny lifter:

- The bar stays over mid-foot.
- The pelvis tilts 0.82 times as much as the torso leans.
- The stance is about 38 cm, with the toes turned out 16°.

The joint motion is solved on MyoSuite's MyoLeg skeleton by `myo_squat.py`. MyoLeg is Rajagopal et al.'s full-body gait model in MuJoCo, and it uses the knee's real coupled roll-and-glide. For each frame, the script:

1. Sets the knee bend from the rep's depth (3° to 116°).
2. Solves the rest within MyoLeg's joint limits:
   - The feet stay planted flat.
   - The bar stays over mid-foot, with no more torso lean than balance needs. Ankle dorsiflexion runs out at 30°, so the ankle's range sets the lean.
   - Each knee stays in the plane through its hip, ankle and foot direction.
   - On the cave rep, the left knee is pulled in by hip adduction and internal rotation.

This produces `squat-motion.json`, which holds the joint centres and joint angles for every frame. At the bottom of the clean rep, the hip is at 107°, the knee at 116°, the ankle at 30° (its limit), the torso leans 24°, and the hips sit just below the knees. On the cave rep, the left knee comes in by 5–9 cm.

`render_squat.py` then poses the Blender rig from that file and renders:

- **Rig and suit:** bench-video's skeleton and suit binding.
- **Skinning:** linear, followed by a Corrective Smooth modifier. The volume-preserving skinning used for the bench made the shoulders and knees balloon.
- **From the solved motion:** the hips, pelvis tilt and torso lean, where each knee points, and where the feet stand.

```sh
# 1. the motion (any Python with mujoco, numpy and scipy, e.g. the MyoSuite venv)
~/Projects/FormGuard/MyoSuite/.venv-imu/bin/python -I suit-render/squat-video/myo_squat.py \
  --myo-sim ~/Projects/FormGuard/MyoSuite/.venv-imu/lib/python3.11/site-packages/myo_sim/models

# 2. the site's story, sampled finely: which motion frame each moment shows
node scripts/squat-timeline.mjs > suit-render/squat-video/timeline.json

# 3. the left knee in each frame, for the site's knee callout (and the floor shadow, for step 5)
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py -- --video --points src/viz/squatFrames.json

# 4. the frames (Cycles, 900 x 1200, 96 samples, about 50 min on an M5's GPU) into renders/video (git-ignored)
$B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py -- --video --samples 96

# 5. on Chalk, with the floor shadow, into public/squat/squat.mp4, plus the stills
$B -b --factory-startup --python suit-render/squat-video/encode_squat.py

# 6. the stills as WebP into public/squat
sh scripts/squat-frames.sh
```

`render_squat.py` options:

| Option | What it does |
| --- | --- |
| `--frames 19,56` or `--frames 1-37` | Render only some frames. |
| `--video` | Render the video's frames: 30 fps over 26 s, into `renders/video`. Without it, the script renders 170 stills spaced for scroll-scrubbing (`--story` sets how many). |
| `--timeline FILE` | Use a different story timeline (default `timeline.json`). |
| `--res 600x800` | Set the output size. |
| `--samples 48` | Set the Cycles sample count. |
| `--out DIR` | Write the frames to `DIR` instead of `renders/`. |
| `--simple` | Ignore the MyoSuite motion and use the plain depth curves. |
| `--dqs` | Use the bench's volume-preserving skinning, for comparison. |
| `--workbench` | Make a flat-shaded motion check. Use it only for motion checks: it doesn't show how the frames look. |

## The lifter

- **Hands:** `fg_hand.py` gives each hand a full finger skeleton: four fingers and the thumb, three bones each, on joint centres measured from the body's own hands. It weights each hand vertex to its nearest bones. Then it curls every joint, base to tip, until the bone meets the bar.
- **Skin:** `fg_skin.py` makes a light tan skin with subsurface scattering, gentle colour variation, and pores and fine creases in the bump. It also paints a buzz cut and eyebrows. All of it is placed on the body's rest shape, so nothing slides as he moves.
- **Eyes:** the eyeballs Blender Studio made for this body (`realistic_body_male` in the Human Base Meshes bundle in `../source/download_hbm`), with an iris and pupil under a wet clear coat. They're parented rigidly to the head bone. A deform modifier would rotate them in their own space, and the iris would roll out of sight as the head tilts.

The scene is built in memory from `../formguard_suit.blend` on every run. Neither that file nor its renders are ever changed.

## Settings

- **`myo_squat.py`:**
  - The knee range: `KNEE_TOP`, `KNEE_BOTTOM`.
  - The stance: `STANCE_X`, `TOE_OUT`.
  - How far the knee caves: `CAVE_IN`.
  - Where the bar sits: `BAR_UP`, `BAR_BACK`.
  - The pelvis's share of the lean: `TILT_SHARE`.
- **`render_squat.py`:**
  - The grip: `GRIP_X`.
  - The camera: `SHOTS` (lens in `CAM`).
  - The exposure (−2.7). This is a little brighter than the product renders' −3.2, so the frames read well on the web.
  - The plate material, which is darker so that the plates don't read as pale discs.
