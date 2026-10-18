"""Anatomically correct squat kinematics from MyoSuite's MyoLeg (Rajagopal 2016 full-body gait model, in MuJoCo),
for render_squat.py to pose the suited mannequin with.

Run it with a Python that has mujoco, numpy and scipy (e.g. the FormGuard MyoSuite venv), pointing at myo_sim/models:

    ~/Projects/FormGuard/MyoSuite/.venv-imu/bin/python -I suit-render/squat-video/myo_squat.py \\
        --myo-sim ~/Projects/FormGuard/MyoSuite/.venv-imu/lib/python3.11/site-packages/myo_sim/models

For each frame of the render (the same 74 as render_squat.py: a clean rep, then the rep with the left knee caving),
the knee bend is set from the rep's depth and the skeleton is solved, within MyoLeg's joint limits, for:
  - both feet planted flat where they stand (16 deg toe-out), the subtalar joint near neutral
  - the bar (on the upper traps, carried by the torso lean) over mid-foot, as a balanced squat must be, leaning no
    more than that needs (so the ankle's range sets the lean, as it does for a real lifter): the form
    reference is the site's earlier Anny lifter (pelvis tilt 0.82 x the torso lean, the bar-over-mid-foot rule)
  - the knees tracking over the toes; on the cave rep the left knee is pulled in by hip adduction and internal
    rotation, as a real valgus collapse is
The knee's coupled translations and rotations (MyoLeg's polynomial constraints) are applied on every evaluation.
Writes squat-motion.json next to this file: per frame, the joint centres (MyoLeg axes = Blender's: +X the lifter's
left, -Y forward, Z up) and the joint angles, in metres and degrees.
"""
import argparse, json, math, os, tempfile
import numpy as np
import mujoco
from scipy.optimize import least_squares

ap = argparse.ArgumentParser()
ap.add_argument('--myo-sim', required=True, help='path to myo_sim/models')
ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'squat-motion.json'))
A = ap.parse_args()
M = os.path.abspath(os.path.expanduser(A.myo_sim))

XML = f"""<mujoco model="fg_squat_legs">
  <compiler meshdir="{M}" texturedir="{M}"/>
  <include file="{M}/leg/assets/myolegs_assets.xml"/>
  <worldbody><body name="root" pos="0 0 0"><freejoint name="root"/>
    <include file="{M}/leg/assets/myolegs_chain.xml"/></body></worldbody>
</mujoco>"""
with tempfile.NamedTemporaryFile('w', suffix='.xml', delete=False) as fh:
    fh.write(XML)
m = mujoco.MjModel.from_xml_path(fh.name); d = mujoco.MjData(m)
os.unlink(fh.name)

jid = lambda n: mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_JOINT, n)
bid = lambda n: mujoco.mj_name2id(m, mujoco.mjtObj.mjOBJ_BODY, n)
qadr = lambda n: m.jnt_qposadr[jid(n)]
rng = lambda n: tuple(m.jnt_range[jid(n)])
# MyoLeg's knee: dependent joints driven by knee_angle through 4th-order polynomials (equality constraints)
COUPLED = [(m.jnt_qposadr[m.eq_obj1id[i]], m.jnt_qposadr[m.eq_obj2id[i]], m.eq_data[i][:5].copy())
           for i in range(m.neq) if m.eq_type[i] == mujoco.mjtEq.mjEQ_JOINT]

# ---------------------------------------------------------------- the frames (as render_squat.py)
CLEAN, CAVE = range(1, 38), range(38, 75)
def sstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def depth(p): return math.sin(math.pi * p) ** 2
def phase(f):
    if f in CLEAN: return (f - 1) / 36.0, 0.0
    p = (f - 38) / 36.0; dd = depth(p)
    return p, (sstep(0.8, 1.0, dd) if p <= 0.5 else sstep(0.2, 0.75, dd))

KNEE_TOP, KNEE_BOTTOM = 3.0, 116.0     # deg; MyoLeg's knee stops at 120
TOE_OUT = 16.0
STANCE_X = 0.17                        # heel (calcaneus origin) from the midline, m (ankles ~0.38 m apart, as Anny's)
CAVE_IN = 0.14                         # how far the left knee comes in at the worst of the cave, m
# the bar over the hips' centre, upright (from render_squat.py's bar on the traps, scaled to MyoLeg): up, back
BAR_UP, BAR_BACK = 0.605, 0.041
TILT_SHARE = 0.82                      # pelvis tilt / torso lean (Anny)

SIDES = ('r', 'l')
LEG = ['hip_flexion', 'hip_adduction', 'hip_rotation', 'ankle_angle', 'subtalar_angle']
NAMES = ['px', 'py', 'pz', 'pitch'] + [f'{j}_{s}' for s in SIDES for j in LEG]
LO = np.array([-0.5, -0.5, 0.2, -0.2] + [rng(f'{j}_{s}')[0] for s in SIDES for j in LEG])
HI = np.array([0.5, 0.5, 1.2, 1.2] + [rng(f'{j}_{s}')[1] for s in SIDES for j in LEG])

def set_pose(x, knee):
    d.qpos[:] = 0
    px, py, pz, pitch = x[:4]
    tilt = pitch * TILT_SHARE
    d.qpos[0:3] = (px, py, pz)
    d.qpos[3:7] = (math.cos(tilt / 2), math.sin(tilt / 2), 0, 0)      # +X rotation: leans forward (-Y)
    for k, n in enumerate(NAMES[4:]):
        d.qpos[qadr(n)] = x[4 + k]
    for s in SIDES:
        d.qpos[qadr(f'knee_angle_{s}')] = math.radians(knee[s])
    for dep, ind, c in COUPLED:
        q = d.qpos[ind]; d.qpos[dep] = c[0] + c[1] * q + c[2] * q ** 2 + c[3] * q ** 3 + c[4] * q ** 4
    mujoco.mj_kinematics(m, d)

P = lambda n: d.xpos[bid(n)].copy()
R = lambda n: d.xmat[bid(n)].reshape(3, 3).copy()

def rotvec(Rm):
    """rotation vector of a 3x3 rotation matrix"""
    c = max(-1.0, min(1.0, (np.trace(Rm) - 1) / 2)); a = math.acos(c)
    if a < 1e-9: return np.zeros(3)
    v = np.array([Rm[2, 1] - Rm[1, 2], Rm[0, 2] - Rm[2, 0], Rm[1, 0] - Rm[0, 1]])
    return v / (2 * math.sin(a)) * a

def hip_centre(): return (P('femur_r') + P('femur_l')) / 2

def bar_pos(pitch):
    return hip_centre() + np.array([0.0, BAR_BACK * math.cos(pitch) - BAR_UP * math.sin(pitch), BAR_UP * math.cos(pitch) + BAR_BACK * math.sin(pitch)])

# ---------------------------------------------------------------- planted feet
def foot_targets():
    """Flat feet on the floor at the stance, toes out: from the rest foot, yawed and moved."""
    set_pose(np.zeros(len(NAMES)) + np.r_[0, 0, 0.95, 0, [0] * 10], {'r': 0, 'l': 0})
    T = {}
    for s, sx in (('r', -1), ('l', 1)):
        Rc = R(f'calcn_{s}'); pc = P(f'calcn_{s}')
        yaw = math.radians(TOE_OUT) * sx
        Rz = np.array([[math.cos(yaw), -math.sin(yaw), 0], [math.sin(yaw), math.cos(yaw), 0], [0, 0, 1]])
        T[s] = (np.array([sx * STANCE_X, pc[1], 0.025]), Rz @ Rc)
    return T
FEET = foot_targets()

def residuals(x, knee, cave):
    set_pose(x, knee)
    r = []
    for s in SIDES:
        pt, Rt = FEET[s]
        r += list((P(f'calcn_{s}') - pt) * 20)                      # planted: 5 cm off = 1
        r += list(rotvec(Rt.T @ R(f'calcn_{s}')) * 6)               # flat and toed out
    # balance: the bar over mid-foot (halfway between heel and the toes' base)
    mid = np.mean([(P(f'calcn_{s}') + P(f'toes_{s}')) / 2 for s in SIDES], axis=0)
    r.append((bar_pos(x[3])[1] - mid[1]) * 15)
    # knees track the toes: each knee stays in the plane through its hip and ankle that holds the foot's direction
    # (a straight leg lies in it whatever the stance); on the cave rep the left knee leaves it towards the midline
    for s, sx in (('r', -1), ('l', 1)):
        h, k, a = P(f'femur_{s}'), P(f'tibia_{s}'), P(f'talus_{s}')
        u = P(f'toes_{s}') - P(f'calcn_{s}'); u[2] = 0; u /= np.linalg.norm(u)
        n = np.cross(a - h, u); n /= np.linalg.norm(n)
        if n[0] * sx < 0: n = -n                                   # n points to the lifter's outside
        want = -(cave * CAVE_IN) if s == 'l' else 0.0
        r.append(((k - h) @ n - want) * 12)
    # lean only as much as balance needs: with the heels down, ankle dorsiflexion (30 deg in MyoLeg) runs out first
    r.append(x[3] * 0.8)
    # stay near neutral where nothing asks otherwise
    for s in SIDES:
        r.append(x[NAMES.index(f'subtalar_angle_{s}')] * 0.6)
        r.append(x[NAMES.index(f'hip_rotation_{s}')] * 0.15)
    return np.array(r)

def angles_report(x, knee):
    a = {n: round(math.degrees(v), 2) for n, v in zip(NAMES[3:], x[3:])}
    a.update({f'knee_angle_{s}': round(knee[s], 2) for s in SIDES})
    return a

out, x = [], np.r_[0.0, 0.0, 0.92, 0.05, [0.0] * 10]
at_limit = set()
for f in list(CLEAN) + list(CAVE):
    p, cave = phase(f)
    kn = KNEE_TOP + (KNEE_BOTTOM - KNEE_TOP) * depth(p)
    knee = {'r': kn, 'l': kn}
    starts = [x]
    if f == 1:
        # the first frame has no previous pose to start from: try the toes turned out by either hip rotation sign,
        # legs in or out, and keep the best (least squares finds the nearest minimum, not the best one)
        starts = [np.r_[0.0, 0.05, 0.94, 0.05, [0.0, ad, rot * sgn, 0.05, 0.0] * 2] for rot in (0.0, 0.28) for sgn in (1, -1) for ad in (-0.12, 0.0)]
    sol = min((least_squares(residuals, np.clip(x0, LO + 1e-6, HI - 1e-6), bounds=(LO, HI), args=(knee, cave), xtol=1e-10, ftol=1e-10, max_nfev=600)
               for x0 in starts), key=lambda r: r.cost)
    x = sol.x
    set_pose(x, knee)
    for n, v, lo, hi in zip(NAMES, x, LO, HI):
        if n not in ('px', 'py', 'pz', 'pitch') and (v - lo < 1e-3 or hi - v < 1e-3): at_limit.add(n)
    J = lambda n: [round(float(c), 4) for c in P(n)]
    out.append(dict(
        frame=f, phase=round(p, 4), depth=round(depth(p), 4), cave=round(cave, 4), cost=round(float(sol.cost), 6),
        pitch=round(math.degrees(x[3]), 2), pelvis_tilt=round(math.degrees(x[3] * TILT_SHARE), 2),
        hip_c=[round(float(c), 4) for c in hip_centre()], bar=[round(float(c), 4) for c in bar_pos(x[3])],
        hipL=J('femur_l'), hipR=J('femur_r'), kneeL=J('tibia_l'), kneeR=J('tibia_r'),
        ankleL=J('talus_l'), ankleR=J('talus_r'), heelL=J('calcn_l'), heelR=J('calcn_r'), toesL=J('toes_l'), toesR=J('toes_r'),
        angles=angles_report(x, knee)))
    if f in (1, 19, 56):
        o = out[-1]
        print(f'frame {f}: knee {kn:.0f}, hip flex r {o["angles"]["hip_flexion_r"]:.0f}, ankle r {o["angles"]["ankle_angle_r"]:.0f}, '
              f'torso lean {o["pitch"]:.0f}, hip centre z {o["hip_c"][2]:.3f}, cost {sol.cost:.5f}')

with open(A.out, 'w') as fh:
    json.dump({'source': 'MyoSuite MyoLeg (Rajagopal et al. 2016), solved by suit-render/squat-video/myo_squat.py',
               'axes': '+X lifter\'s left, -Y forward, Z up; metres, degrees', 'frames': out,
               'joints_at_limit': sorted(at_limit)}, fh, indent=1)
print('wrote', A.out, '| joints that reached a limit:', sorted(at_limit))
