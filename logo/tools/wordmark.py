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
