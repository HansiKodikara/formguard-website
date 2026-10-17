"""The three refined marks, their small-size cuts, construction data and lockups.

Masters are drawn on a 100-unit height. Lockups scale each master so its stem equals the
wordmark's stem exactly (weight matching), then place it by explicit, documented rules.
"""
import math
import fg
import wordmark as W

INK, RED, CHALK = "#1B1A17", "#C62B22", "#F2EDE4"


# ════════════════════════════════════════════════════════ masters (H = 100)

class Mark:
    def __init__(self, key, name, ink, accent, dims, construction, checks=None):
        self.key, self.name = key, name
        self.ink, self.accent = ink, accent
        self.dims = dims                  # named construction values (documented on the sheet)
        self.construction = construction  # drawing primitives for the construction sheet
        # checks arrive as (label, runs, expected); keep (label, lengths, expected, ok)
        self.checks = []
        for label, runs, expect in (checks or []):
            got = [round(r[1], 3) for r in runs]
            ok = len(got) == len(expect) and all(abs(a - b) <= 0.01 for a, b in zip(got, expect))
            self.checks.append((label, got, expect, ok))

    @property
    def one(self):
        return fg.union(self.ink, self.accent) if self.accent is not None else self.ink


def rack_f(W_=20, A=18, C=34, L1=84, L2=76, bite=5, g=6):
    """Rack F. Stem W, arms A (optically lighter), counter C; socket tangent to the stem,
    biting `bite` into each arm; the bar (ball) sits concentric with an even gap g."""
    m = A + C                              # middle arm top
    R = C / 2 + bite                       # socket radius
    cx, cy = W_ + R, A + C / 2
    F = fg.union(fg.rect(0, 0, W_, 100), fg.rect(0, 0, L1, A), fg.rect(0, m, L2, A))
    ink = fg.diff(F, fg.circle(cx, cy, R))
    ball = fg.circle(cx, cy, R - g)
    dims = dict(stem=W_, arm=A, counter=C, socket_r=R, ball_r=R - g, gap=g, bite=bite,
                top_arm=L1, mid_arm=L2, mid_arm_y=m, centre=(cx, cy))
    cons = [("circle", cx, cy, R), ("circle", cx, cy, R - g), ("cross", cx, cy),
            ("hline", A), ("hline", m), ("hline", m + A), ("vline", W_)]
    one = fg.union(ink, ball)
    checks = [
        ("stem", fg.runs(one, (-5, 90), (60, 90)), [W_]),
        ("top arm (J-hook)", fg.runs(one, (L1 - 4, -5), (L1 - 4, 60)), [A]),
        ("middle arm (safety)", fg.runs(one, (L2 - 4, A + 1), (L2 - 4, 99)), [A]),
        ("arms under the socket", fg.runs(one, (cx, -5), (cx, 100)), [A - bite, 2 * (R - g), A - bite]),
        ("gap | bar | gap across the counter", fg.runs(one, (W_ + 0.01, cy), (cx + R + 0.5, cy)), [2 * (R - g)]),
    ]
    return Mark("rack-f", "Rack F", ink, ball, dims, cons, checks)


def parallel(W_=20, T=18, aw=12, g=6, r_in=52):
    """Joint angle at parallel. Shin W (vertical), thigh T (optically lighter); the arc is
    centred on the knee (centre-line intersection), its ends cut parallel to the limbs."""
    kx, ky = W_ / 2, T / 2
    ink = fg.union(fg.rect(0, 0, 100, T), fg.rect(0, 0, W_, 100))
    arc = fg.intersect(fg.ring(kx, ky, r_in + aw, r_in), fg.rect(W_ + g, T + g, 100, 100))
    dims = dict(shin=W_, thigh=T, arc=aw, gap=g, arc_r_in=r_in, arc_r_out=r_in + aw, knee=(kx, ky))
    cons = [("circle", kx, ky, r_in), ("circle", kx, ky, r_in + aw), ("cross", kx, ky),
            ("hline", T), ("hline", T + g), ("vline", W_), ("vline", W_ + g)]
    one = fg.union(ink, arc)
    d = 1 / math.sqrt(2)
    checks = [
        ("shin", fg.runs(one, (-5, 90), (40, 90)), [W_]),
        ("thigh", fg.runs(one, (90, -5), (90, 40)), [T]),
        ("arc on the diagonal", fg.runs(one, (kx + (r_in - 4) * d, ky + (r_in - 4) * d), (kx + (r_in + aw + 4) * d, ky + (r_in + aw + 4) * d)), [aw]),
        ("gap: arc end ↔ thigh", fg.runs(one, (W_ + g + 1, T + 0.01), (W_ + g + 1, T + g - 0.01)), []),
        ("gap: arc end ↔ shin", fg.runs(one, (W_ + 0.01, T + g + 1), (W_ + g - 0.01, T + g + 1)), []),
    ]
    return Mark("parallel", "Parallel", ink, arc, dims, cons, checks)


def cradle(W_=20, R=50, ball=20):
    """Cradle. A U of stroke W whose bowl is a true semicircle; the bar is concentric, so the gap
    is the same everywhere: gap = (R - W) - ball. Defaults give gap = W/2, ball ⌀ = 2W."""
    cx, cy = R, R
    arms = fg.union(fg.rect(0, 0, W_, R), fg.rect(2 * R - W_, 0, W_, R))
    bowl = fg.sector_band(cx, cy, R, R - W_, 180, 360)
    ink = fg.union(arms, bowl)
    node = fg.circle(cx, cy, ball)
    g = R - W_ - ball
    dims = dict(stroke=W_, bowl_r=R, inner_r=R - W_, ball_r=ball, gap=g, centre=(cx, cy))
    cons = [("circle", cx, cy, R), ("circle", cx, cy, R - W_), ("circle", cx, cy, ball), ("cross", cx, cy),
            ("hline", R)]
    one = fg.union(ink, node)
    d = 1 / math.sqrt(2)
    checks = [
        ("arms", fg.runs(one, (-5, 20), (2 * R + 5, 20)), [W_, W_]),
        ("bar ⌀ + bowl (vertical)", fg.runs(one, (cx, 0), (cx, 2 * R + 5)), [2 * ball, W_]),
        ("even gap at 45°", fg.runs(one, (cx + (ball + 0.01) * d, cy + (ball + 0.01) * d), (cx + (R - W_ - 0.01) * d, cy + (R - W_ - 0.01) * d)), []),
        ("even gap at 0° (left)", fg.runs(one, (cx - ball - 0.01, cy), (cx - (R - W_) + 0.01, cy)), []),
    ]
    return Mark("cradle", "Cradle", ink, node, dims, cons, checks)


MARKS = {"rack-f": rack_f, "parallel": parallel, "cradle": cradle}


# ════════════════════════════════════════════════════════ wordmark (final)

def wordmark(cap=100, origin=(0, 0)):
    fc = W.face(W.FINAL["key"], **W.FINAL["var"])
    ov, _ = W.level_overrides(fc)
    path, info = fg.set_text(fc, "FORMGUARD", cap, tracking=W.FINAL["track"] * fc.cap,
                             kern=W.FINAL["kern"], glyph_override=ov, origin=origin)
    return path, fc


def word_stem_ratio():
    fc = W.face(W.FINAL["key"], **W.FINAL["var"])
    return fc.stem("H") / fc.cap


# ════════════════════════════════════════════════════════ lockups

def _fit(path, h_target, stroke, stem):
    """Scale factor so that `stroke` (master units) renders at `stem`; returns k."""
    return stem / stroke


def place_mark(mark, k, x, y):
    """Mark scaled by k with its top-left at (x, y)."""
    a = fg.xform(mark.ink, k, 0, 0, k, x, y)
    b = fg.xform(mark.accent, k, 0, 0, k, x, y) if mark.accent is not None else None
    return a, b


def lockup_horizontal(mark, cap=100, gap_ratio=0.62, stroke=20, height_ratio=None):
    """Mark centred on the cap height; gap = gap_ratio × cap.

    Default: weight-matched (mark stroke = wordmark stem). With height_ratio, the mark is set to
    that multiple of the cap height instead (a symbol size), and its stroke is reported.
    """
    word, fc = wordmark(cap)
    stem = word_stem_ratio() * cap
    b = mark.one.bounds
    k = stem / stroke if height_ratio is None else height_ratio * cap / (b[3] - b[1])
    mh = (b[3] - b[1]) * k
    mw = (b[2] - b[0]) * k
    ink, acc = place_mark(mark, k, -b[0] * k, -cap / 2 - mh / 2 - b[1] * k)
    wx0 = word.bounds[0]
    word = fg.translate(word, mw + gap_ratio * cap - wx0, 0)
    return dict(ink=ink, accent=acc, word=word, k=k, mark_h=mh, mark_w=mw, cap=cap, gap=gap_ratio * cap)


def lockup_stacked(mark, cap=100, mark_ratio=2.6, gap_ratio=0.62):
    """Mark centred above the wordmark; mark height = mark_ratio × cap (a display size, not weight-matched)."""
    word, fc = wordmark(cap)
    wb = word.bounds
    b = mark.one.bounds
    mh = mark_ratio * cap
    k = mh / (b[3] - b[1])
    mw = (b[2] - b[0]) * k
    cx = (wb[0] + wb[2]) / 2
    top = -cap - gap_ratio * cap - mh
    ink, acc = place_mark(mark, k, cx - mw / 2 - b[0] * k, top - b[1] * k)
    return dict(ink=ink, accent=acc, word=word, k=k, mark_h=mh, mark_w=mw, cap=cap)


def lockup_initial(mark, cap=100, stroke=20):
    """Rack F as the initial of FORMGUARD: weight-matched, baseline-aligned, then ORMGUARD.

    Spacing rule: the O sits exactly as far from the big F's safety arm as it sits from the
    middle arm of the regular F in the plain wordmark. The raised J-hook simply overhangs.
    """
    fc = W.face(W.FINAL["key"], **W.FINAL["var"])
    ov, a = W.level_overrides(fc)
    word, _ = wordmark(cap)
    s_ = cap / fc.cap
    # gap in the plain wordmark: F middle-arm end → O's left extreme
    f_mid_end = (a["mid_end"] + fc.glyph(fc.gid("F")).bounds[0] * 0) * s_
    f_left = fc.glyph(fc.gid("F")).bounds[0] * s_
    o_left = fg.runs(word, (0, -cap / 2), (word.bounds[2], -cap / 2))[1][0]   # second run at mid-height = the O
    gap = o_left - (f_mid_end - f_left + word.bounds[0])
    stem = word_stem_ratio() * cap
    k = stem / stroke
    b = mark.one.bounds
    mh = (b[3] - b[1]) * k
    ink, acc = place_mark(mark, k, -b[0] * k, -mh - b[1] * k)
    rest, _ = fg.set_text(fc, "ORMGUARD", cap, tracking=W.FINAL["track"] * fc.cap,
                          kern=W.FINAL["kern"], glyph_override=ov)
    o_rest = fg.runs(rest, (-cap, -cap / 2), (rest.bounds[2], -cap / 2))[0][0] - cap
    rest = fg.translate(rest, mark.dims["mid_arm"] * k + gap - o_rest, 0)
    return dict(ink=ink, accent=acc, word=rest, k=k, mark_h=mh, cap=cap, gap=gap)


# ════════════════════════════════════════════════════════ small-size cuts (pixel grid)
# Drawn on an n×n pixel grid with integer edges so stems land on whole pixels.
# The 32px cut is also what a Retina browser shows at 16pt.

def rack_f_px(n):
    if n == 16:
        F = fg.union(fg.rect(2, 1, 3, 14), fg.rect(2, 1, 12, 2), fg.rect(2, 9, 11, 2))
        return Mark("rack-f", "Rack F 16", F, fg.circle(8, 6, 2), {}, [])
    # 32: stem 6, arms 5, counter 10, socket bites 1px into each arm, ball ⌀8, gap 2
    F = fg.union(fg.rect(4, 2, 6, 28), fg.rect(4, 2, 24, 5), fg.rect(4, 17, 21, 5))
    F = fg.diff(F, fg.circle(16, 12, 6))
    return Mark("rack-f", "Rack F 32", F, fg.circle(16, 12, 4), {}, [])


def parallel_px(n):
    if n == 16:
        ink = fg.union(fg.rect(1, 1, 3, 14), fg.rect(1, 1, 14, 2))
        arc = fg.intersect(fg.ring(2.5, 2, 9, 7), fg.rect(5, 4, 11, 11))
        return Mark("parallel", "Parallel 16", ink, arc, {}, [])
    ink = fg.union(fg.rect(2, 2, 6, 28), fg.rect(2, 2, 28, 5))
    arc = fg.intersect(fg.ring(5, 4.5, 18, 15), fg.rect(10, 9, 21, 21))
    return Mark("parallel", "Parallel 32", ink, arc, {}, [])


def cradle_px(n):
    if n == 16:
        ink = fg.union(fg.rect(1, 1, 3, 7), fg.rect(12, 1, 3, 7), fg.sector_band(8, 8, 7, 4, 180, 360))
        return Mark("cradle", "Cradle 16", ink, fg.circle(8, 8, 3), {}, [])
    ink = fg.union(fg.rect(1, 1, 6, 15), fg.rect(25, 1, 6, 15), fg.sector_band(16, 16, 15, 9, 180, 360))
    return Mark("cradle", "Cradle 32", ink, fg.circle(16, 16, 6), {}, [])


PX = {"rack-f": rack_f_px, "parallel": parallel_px, "cradle": cradle_px}
