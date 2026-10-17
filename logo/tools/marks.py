"""FormGuard mark concepts. Every shape is exact geometry on a 120-unit canvas.

Each concept returns {"ink": Path, "accent": Path|None, "checks": [(label, measured, expected, ok)]}.
"ink" is the structure; "accent" is the one element allowed to be Plate Red.
The one-colour mark is ink ∪ accent. Checks probe the *final* outline with fg.runs().
"""
import math
import fg


def probe(path, checks):
    """checks: [(label, p0, p1, expected_runs)] -> [(label, measured, expected, ok)]"""
    out = []
    for label, p0, p1, expect in checks:
        got = [r[1] for r in fg.runs(path, p0, p1, step=0.01)]
        ok = len(got) == len(expect) and all(abs(g - e) <= 0.03 for g, e in zip(got, expect))
        out.append((label, got, expect, ok))
    return out


def _F(W=20, top=80, mid=70, mid_y=62, x=14, y=10, H=100):
    return fg.union(fg.rect(x, y, W, H), fg.rect(x, y, top, W), fg.rect(x, mid_y, mid, W))


# 01 ─ Bar path
def bar_path():
    W = 14
    disc = fg.circle(52, 28, 22)
    upper = fg.rect(52 - W / 2, 28, W, 32)
    a = math.degrees(math.atan2(4, 3))                     # offset 12 over 24 → R 15, sweep 53.13°
    bend = fg.union(fg.sector_band(67, 60, 15 + W / 2, 15 - W / 2, 180, 180 + a),
                    fg.sector_band(49, 84, 15 + W / 2, 15 - W / 2, 0, a))
    lower = fg.union(fg.rect(64 - W / 2, 84, W, 22), fg.circle(64, 106, W / 2))
    ink = fg.union(disc, upper, lower)
    one = fg.union(ink, bend)
    return {"ink": ink, "accent": bend, "checks": probe(one, [
        ("path above the drift", (30, 50), (80, 50), [W]),
        ("path below the drift", (30, 96), (90, 96), [W]),
        ("bar end ⌀", (20, 28), (90, 28), [44]),
    ])}


# 02 ─ Joint angle · Parallel
def parallel():
    W, g, aw = 20, 6, 12
    ink = fg.union(fg.rect(14, 14, 96, W), fg.rect(14, 14, W, 96))
    # arc centred on the knee (centre-line intersection 24,24); ends cut parallel to the limbs
    arc = fg.intersect(fg.ring(24, 24, 54 + aw, 54), fg.rect(34 + g, 34 + g, 90, 90))
    one = fg.union(ink, arc)
    d = 1 / math.sqrt(2)
    return {"ink": ink, "accent": arc, "checks": probe(one, [
        ("thigh", (90, 0), (90, 36), [W]),
        ("shin", (0, 90), (36, 90), [W]),
        ("arc, on the 45° diagonal", (24 + 50 * d, 24 + 50 * d), (24 + 70 * d, 24 + 70 * d), [aw]),
        ("clear gap, arc end → thigh", (40.5, 34.01), (40.5, 39.99), []),
    ])}


# 03 ─ Sensor monogram
def sensor_monogram():
    L, N = 8, 9
    F = [(16, 16), (52, 16), (16, 58), (44, 58), (16, 104)]
    G = [(104, 16), (68, 16), (68, 104), (104, 104), (104, 64), (86, 64)]
    links = [fg.bar(F[0], F[1], L), fg.bar(F[0], F[4], L), fg.bar(F[2], F[3], L)]
    links += [fg.bar(G[i], G[i + 1], L) for i in range(len(G) - 1)]
    nodes = [fg.circle(x, y, N) for (x, y) in F + G[:-1]]
    ink = fg.union(*links, *nodes)
    accent = fg.circle(*G[-1], N)
    return {"ink": ink, "accent": accent, "checks": probe(fg.union(ink, accent), [
        ("link", (30, 0), (30, 30), [L]),
        ("node ⌀", (44, 40), (44, 76), [2 * N]),
    ])}


# 04 ─ Range of motion
def range_of_motion():
    W = 12
    cx, cy = 60, 80
    sweep = fg.sector_band(cx, cy, 52, 52 - W, 24, 180)
    target = fg.sector_band(cx, cy, 58, 34, -4, 4)
    pivot = fg.circle(cx, cy, 11)
    limb = fg.bar((cx, cy), fg.pt(cx, cy, 30, 24), 10)
    ink = fg.union(sweep, pivot, limb)
    return {"ink": ink, "accent": target, "checks": probe(fg.union(ink, target), [
        ("sweep", (60, 0), (60, 40), [W]),
    ])}


# 05 ─ Guard · Rails
def rails():
    ink = fg.union(fg.rect(12, 10, 16, 100), fg.rect(92, 10, 16, 100))
    accent = fg.circle(60, 60, 18)
    return {"ink": ink, "accent": accent, "checks": probe(fg.union(ink, accent), [
        ("rail | bar | rail", (0, 60), (120, 60), [16, 36, 16]),
    ])}


# 06 ─ Guard · Cradle
def cradle():
    W = 20
    arms = fg.union(fg.rect(10, 12, W, 50), fg.rect(110 - W, 12, W, 50))
    bowl = fg.sector_band(60, 62, 50, 30, 180, 360)
    node = fg.circle(60, 62, 21)
    ink = fg.union(arms, bowl)
    d = 1 / math.sqrt(2)
    return {"ink": ink, "accent": node, "checks": probe(fg.union(ink, node), [
        ("arms", (0, 40), (120, 40), [W, W]),
        ("held bar, then bowl", (60, 62), (60, 120), [21, W]),
        ("even 9-unit gap at 45°", (60 + 21.01 * d, 62 + 21.01 * d), (60 + 29.99 * d, 62 + 29.99 * d), []),
    ])}


# 07 ─ Guard · Rack F: the counter is a socket, the bar sits in it like a ball joint
def rack_f():
    W, R, g = 20, 22, 6
    F = _F(top=82, mid=72, mid_y=64)
    cx, cy = 34 + R, 47                       # tangent to the stem's inner edge; centred in the counter (30..64)
    ink = fg.diff(F, fg.circle(cx, cy, R))
    ball = fg.circle(cx, cy, R - g)
    return {"ink": ink, "accent": ball, "checks": probe(fg.union(ink, ball), [
        ("stem", (0, 100), (60, 100), [W]),
        ("J-hook (top arm)", (90, 0), (90, 60), [W]),
        ("safety (middle arm)", (80, 40), (80, 100), [W]),
        ("top arm thinned by the socket", (cx, 0), (cx, 26), [15]),
        ("ball, with an even gap to stem and arms", (34.01, cy), (78, cy), [2 * (R - g)]),
    ])}


# 08 ─ Plate
def plate():
    disc = fg.circle(60, 60, 54)
    ink = fg.diff(disc, fg.circle(60, 60, 13), fg.ring(60, 60, 44, 40))
    return {"ink": ink, "accent": None, "checks": probe(ink, [
        ("rim | body to the hole", (0, 60), (60, 60), [10, 27]),
    ])}


# 09 ─ The buzz
def buzz():
    node = fg.circle(60, 60, 17)
    pulse = fg.union(fg.sector_band(60, 60, 47, 35, -42, 42), fg.sector_band(60, 60, 47, 35, 138, 222))
    return {"ink": pulse, "accent": node, "checks": probe(fg.union(pulse, node), [
        ("pulse | node | pulse", (0, 60), (120, 60), [12, 34, 12]),
    ])}


# 10 ─ Pivot G
def pivot_g():
    W, R = 18, 54
    ringp = fg.sector_band(60, 60, R, R - W, 46, 360)
    limb = fg.intersect(fg.rect(60, 60 - W / 2, 70, W), fg.circle(60, 60, R))
    pivot = fg.circle(60, 60, 14)
    ink = fg.union(ringp, limb)
    return {"ink": ink, "accent": pivot, "checks": probe(fg.union(ink, pivot), [
        ("ring", (0, 60), (40, 60), [W]),
        ("limb", (90, 45), (90, 75), [W]),
    ])}


# 11 ─ Three lights
def three_lights():
    r = 16
    ink = fg.union(fg.circle(20, 60, r), fg.circle(60, 60, r))
    accent = fg.circle(100, 60, r)
    return {"ink": ink, "accent": accent, "checks": probe(fg.union(ink, accent), [
        ("light | light | light", (0, 60), (120, 60), [32, 32, 32]),
    ])}


# 12 ─ Stack: form slipping when tired
def stack():
    h, gap = 14, 8                                  # 5×14 + 4×8 = 102 → centred: y 9..111
    bars = [fg.rect(22, 9 + i * (h + gap), 76, h) for i in range(4)]
    off = fg.rect(34, 9 + 4 * (h + gap), 76, h)
    return {"ink": fg.union(*bars), "accent": off, "checks": probe(fg.union(*bars, off), [
        ("five plates, all on canvas", (60, 0), (60, 120), [h] * 5),
        ("the last plate is 12 off the line", (0, 104), (120, 104), [76]),
    ])}


CONCEPTS = [
    ("bar-path", "Bar path", bar_path),
    ("parallel", "Joint angle · Parallel", parallel),
    ("sensor", "Sensor monogram", sensor_monogram),
    ("rom", "Range of motion", range_of_motion),
    ("rails", "Guard · Rails", rails),
    ("cradle", "Guard · Cradle", cradle),
    ("rack-f", "Guard · Rack F", rack_f),
    ("plate", "Plate", plate),
    ("buzz", "The buzz", buzz),
    ("pivot-g", "Pivot G", pivot_g),
    ("lights", "Three lights", three_lights),
    ("stack", "Stack", stack),
]


# ════════════════════════════════════════════════════════ variants tried along the way
def _v(ink, accent):
    return {"ink": ink, "accent": accent, "checks": []}


def sketch_rack_plain():
    return _v(_F(top=80, mid=70, mid_y=66), fg.circle(66, 48, 13))


def sketch_rack_eye():
    return _v(_F(), fg.circle(54, 46, 12))


def sketch_rack_caliper():
    return _v(_F(top=74, mid=74), fg.circle(70, 46, 12))


def sketch_rack_hook():
    W = 20
    F = fg.union(fg.rect(14, 26, W, 84), fg.rect(14, 46, 76, W), fg.rect(70, 26, W, 40), fg.rect(14, 88, 62, W - 2))
    return _v(F, fg.circle(52, 30, 12))


def sketch_par_node():
    W = 20
    ink = fg.union(fg.rect(24, 14, 86, W), fg.rect(14, 24, W, 86), fg.circle(24, 24, 14))
    return _v(ink, fg.intersect(fg.ring(24, 24, 66, 54), fg.rect(40, 40, 90, 90)))


def sketch_par_swept():
    W = 20
    ink = fg.union(fg.rect(14, 14, 96, W), fg.rect(14, 14, W, 96))
    return _v(ink, fg.intersect(fg.circle(24, 24, 66), fg.rect(40, 40, 90, 90)))


def sketch_par_ripple():
    ink = fg.diff(fg.rect(14, 14, 96, 96), fg.rrect(34, 34, 120, 120, 22))
    return _v(ink, fg.intersect(fg.ring(56, 56, 42, 30), fg.rect(56, 56, 80, 80)))


def sketch_par_knee():
    W, J = 20, 18
    ink = fg.union(fg.circle(34, 34, J), fg.rect(34, 34 - W / 2, 76, W), fg.rect(34 - W / 2, 34, W, 76))
    return _v(ink, fg.intersect(fg.ring(34, 34, 62, 50), fg.rect(50, 50, 80, 80)))


def sketch_cradle_jhook():
    W = 20
    ink = fg.union(fg.rect(12, 10, W, 64), fg.sector_band(58, 74, 46, 26, 180, 360), fg.rect(84, 54, W, 20))
    return _v(ink, fg.circle(58, 74, 18))


def sketch_cradle_square():
    outer = fg.rrect(12, -40, 96, 150, 44)
    inner = fg.rrect(32, -40, 56, 130, 26)
    return _v(fg.diff(fg.intersect(outer, fg.rect(0, 12, 120, 120)), inner), fg.circle(60, 70, 17))


def sketch_depth():
    return _v(fg.rect(10, 40, 100, 14), fg.circle(60, 82, 24))


def sketch_f_path():
    W = 16
    ink = fg.union(fg.rect(40, 44, W, 66), fg.sector_band(70, 44, 30 + W / 2, 30 - W / 2, 0, 180), fg.rect(22, 58, 52, 14))
    return _v(ink, fg.circle(100, 50, 11))


SKETCHES = {
    "rack-f": [("plain F + bar: generic", sketch_rack_plain), ("bar by the stem: an eye", sketch_rack_eye),
               ("equal jaws: reads as E", sketch_rack_caliper), ("J-hook profile: a robot", sketch_rack_hook)],
    "parallel": [("knee node: plumbing", sketch_par_knee), ("node + arc", sketch_par_node),
                 ("swept: Bauhaus generator", sketch_par_swept), ("ripple: reads as r", sketch_par_ripple)],
    "cradle": [("J-hook: reads as b", sketch_cradle_jhook), ("squared bowl", sketch_cradle_square)],
    "bar-path": [("f as a clean's bar path", sketch_f_path), ("depth line: a sunset", sketch_depth)],
}
