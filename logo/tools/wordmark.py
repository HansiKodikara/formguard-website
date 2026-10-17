"""Wordmark setting: typeface instances, optical spacing analysis, hand kerning tables."""
import math
import statistics
import fg

FONTS = None  # set by caller: absolute path to logo/fonts

FACES = {
    # key: (label, file, variations, note)
    "bigshoulders": ("Big Shoulders Display", "bigshouldersdisplay/BigShouldersDisplay[wght].ttf", {"wght": 850},
                     "Heavy condensed · Chicago industrial"),
    "pathway": ("Pathway Extreme", "pathwayextreme/PathwayExtreme[opsz,wdth,wght].ttf",
                {"wght": 800, "wdth": 75, "opsz": 72}, "Heavy condensed gothic"),
    "barlow": ("Barlow Condensed", "barlowcondensed/BarlowCondensed-ExtraBold.ttf", {}, "Condensed DIN-like"),
    "archivo": ("Archivo Expanded", "archivo/Archivo[wdth,wght].ttf", {"wght": 800, "wdth": 125},
                "Extended grotesk"),
    "familjen": ("Familjen Grotesk", "familjengrotesk/FamiljenGrotesk[wght].ttf", {"wght": 700},
                 "Characterful grotesk"),
    "hubot": ("Hubot Sans", "hubotsans/HubotSans[wdth,wght].ttf", {"wght": 800, "wdth": 110},
              "Engineered grotesk, squared curves"),
}

_face_cache = {}


def face(key, **override):
    label, f, var, _ = FACES[key]
    var = dict(var, **override)
    ck = (key, tuple(sorted(var.items())))
    if ck not in _face_cache:
        _face_cache[ck] = fg.Face(f"{FONTS}/{f}", var)
    return _face_cache[ck]


# ---------------------------------------------------------------- optical spacing

def profile(path, cap, n=120):
    """Left/right ink edge per scanline over [0, cap] (font units, y-up). None where no ink."""
    xmin, _, xmax, _ = path.bounds
    out = []
    for i in range(n):
        y = cap * (i + 0.5) / n
        slab = fg.intersect(path, fg.rect(xmin - 1, y - 0.5, xmax - xmin + 2, 1.0))
        if slab.area > 0:
            b = slab.bounds
            out.append((b[0], b[2]))
        else:
            out.append(None)
    return out, xmin, xmax


def _capped(prof, xmin, xmax, depth):
    L, R = [], []
    for e in prof:
        if e is None:
            L.append(xmin + depth)
            R.append(xmax - depth)
        else:
            L.append(min(e[0], xmin + depth))
            R.append(max(e[1], xmax - depth))
    return L, R


def pair_gaps(fc, text, tracking=0, kern=None, depth_ratio=0.16, overrides=None):
    """Mean optical gap (font units) for each adjacent pair, after kerning + tracking."""
    kern = kern or {}
    overrides = overrides or {}
    cap = fc.cap
    depth = cap * depth_ratio
    shaped = fc.shape(text)
    glyphs, advs = [], []
    for i, (info, pos) in enumerate(shaped):
        ch = text[info.cluster]
        g = overrides[ch](fc) if ch in overrides else fc.glyph(info.codepoint)
        glyphs.append((ch, g))
        advs.append(pos.x_advance)
    profs = {}
    for ch, g in glyphs:
        if ch not in profs:
            pr, xmin, xmax = profile(g, cap)
            profs[ch] = _capped(pr, xmin, xmax, depth)
    out = []
    for i in range(len(glyphs) - 1):
        a, b = glyphs[i][0], glyphs[i + 1][0]
        shift = advs[i] + tracking + kern.get(a + b, 0)
        La, Ra = profs[a]
        Lb, Rb = profs[b]
        gaps = [shift + Lb[k] - Ra[k] for k in range(len(Ra))]
        out.append((a + b, statistics.fmean(gaps)))
    return out


def balance(fc, text, tracking, target=None, depth_ratio=0.16, overrides=None, weight=1.0):
    """Kerning that equalises optical gaps to `target` (default: median gap)."""
    gaps = pair_gaps(fc, text, tracking, {}, depth_ratio, overrides)
    if target is None:
        target = statistics.median(g for _, g in gaps)
    return {p: round((target - g) * weight) for p, g in gaps}, target


# ════════════════════════════════════════════════════════ the final wordmark
FINAL = {"key": "hubot", "var": {"wght": 760, "wdth": 110}, "track": 0.045,
         # hand kerning at 760/110 (font units), read from pair_gaps() then judged by eye
         "kern": {"FO": -28, "OR": 11, "RM": -6, "MG": 11, "GU": 6, "UA": 14, "AR": -23, "RD": -6}}


def _vruns(g, x, cap):
    return [(-50 + s, -50 + s + l) for s, l in fg.runs(g, (x, -50), (x, cap + 50), step=0.5)]


def _hruns(g, y, xmax):
    return [(-50 + s, -50 + s + l) for s, l in fg.runs(g, (-50, y), (xmax + 50, y), step=0.5)]


def anatomy(fc):
    """Measure the parts the level line touches, from the outlines (never hard-coded)."""
    cap = fc.cap
    F = fc.glyph(fc.gid("F"))
    R = fc.glyph(fc.gid("R"))
    G = fc.glyph(fc.gid("G"))
    fb, rb, gb = F.bounds, R.bounds, G.bounds
    stem_r = _hruns(F, cap * 0.1, fb[2])[0][1]                         # F stem right edge
    arms = _vruns(F, stem_r + 40, cap)                                  # [(mid arm), (top arm)]
    mid_lo, mid_hi = arms[0]
    mid_end = _hruns(F, (mid_lo + mid_hi) / 2, fb[2])[0][1]             # F middle arm right end
    r_join = _vruns(R, rb[0] + 0.35 * (rb[2] - rb[0]), cap)[0][1]       # top of R's lower bowl stroke
    g_runs = _vruns(G, gb[2] - 40, cap)                                 # spur+bar column, then terminal
    g_bar_top = g_runs[0][1]
    bar_line = _hruns(G, (g_bar_top + cap * 0.3) / 2, gb[2])            # a line through the bar
    g_bar_start = bar_line[-1][0]
    return dict(cap=cap, stem_r=stem_r, mid_lo=mid_lo, mid_hi=mid_hi, mid_end=mid_end,
                r_join=r_join, g_bar_top=g_bar_top, g_bar_start=g_bar_start, g_xmax=gb[2])


def level_overrides(fc):
    """F's middle arm and G's bar moved onto the R's bowl join, so the word holds one level."""
    a = anatomy(fc)
    level = a["r_join"]
    th = a["mid_hi"] - a["mid_lo"]

    def F(fc_):
        g = fc_.glyph(fc_.gid("F"))
        g = fg.diff(g, fg.rect(a["stem_r"], a["mid_lo"] - 1, a["mid_end"] - a["stem_r"] + 50, th + 2))
        return fg.union(g, fg.rect(a["stem_r"] - 10, level - th, a["mid_end"] - a["stem_r"] + 10, th))

    def G(fc_):
        g = fc_.glyph(fc_.gid("G"))
        x0, x1 = a["g_bar_start"], a["g_xmax"]
        if a["g_bar_top"] < level:
            return fg.union(g, fg.rect(x0, a["g_bar_top"] - 2, x1 - x0, level - a["g_bar_top"] + 2))
        return fg.diff(g, fg.rect(x0 - 1, level, x1 - x0 + 2, a["g_bar_top"] - level + 1))

    return {"F": F, "G": G}, a
