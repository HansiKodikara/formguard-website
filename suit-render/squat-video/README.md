# Squat frames

The back squat in the website's "How it works" section. The FormGuard suit is shown on the rigged mannequin and rendered in Cycles in the product renders' studio. The site scrubs through the frames as the visitor scrolls.

The frames come in two passes:

- **Frames 1–37:** a clean rep. Frame 1 is standing, frame 19 is the bottom, and frame 37 is standing again.
- **Frames 38–74:** the same rep with the left knee caving in, timed to match the site's rep 7:
  - It starts to cave late on the way down.
  - It is fully in at the bottom (frame 56) and through the first half of the drive.
  - It pushes back out before lockout.

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

# 2. where the left knee is in each frame, for the site's knee callout
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py -- --points src/viz/squatFrames.json

# 3. the frames (Cycles, 900 x 1200, 96 samples, about 10 min) into renders/ (git-ignored)
$B -b suit-render/formguard_suit.blend --python suit-render/squat-video/render_squat.py

# 4. WebP for the site into public/squat
sh scripts/squat-frames.sh
```

`render_squat.py` options:

| Option | What it does |
| --- | --- |
| `--frames 19,56` or `--frames 1-37` | Render only some frames. |
| `--res 600x800` | Set the output size. |
| `--samples 48` | Set the Cycles sample count. |
| `--out DIR` | Write the frames to `DIR` instead of `renders/`. |
| `--simple` | Ignore the MyoSuite motion and use the plain depth curves. |
| `--dqs` | Use the bench's volume-preserving skinning, for comparison. |
| `--workbench` | Make a flat-shaded motion check. Use it only for motion checks: it doesn't show how the frames look. |

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
  - The camera: `CAM`.
  - The exposure (−2.7). This is a little brighter than the product renders' −3.2, so the frames read well on the web.
  - The plate material, which is darker so that the plates don't read as pale discs.
