"""FormGuard logo toolkit: exact geometry, boolean outlines, outlined type, numeric checks.

Coordinates are SVG units (y grows downward). Angles are in degrees,
measured counter-clockwise from 3 o'clock (90 = 12 o'clock), so the maths
reads the way a designer talks about a drawing.
"""
import math
import uharfbuzz as hb
import pathops
from fontTools.pens.svgPathPen import SVGPathPen

KAPPA_MAX_SEG = 90.0  # split arcs into <=90deg cubic segments


# ---------------------------------------------------------------- numbers

def ntos(v):
    """Compact number formatting for SVG output (3 dp, no trailing zeros)."""
    s = f"{v:.3f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pt(cx, cy, r, deg):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy - r * math.sin(a))


# ---------------------------------------------------------------- primitives

def _arc_cubics(pen, cx, cy, r, a0, a1):
    """Append cubic segments for an arc from a0 to a1 (pen already at a0)."""
    sweep = a1 - a0
    n = max(1, math.ceil(abs(sweep) / KAPPA_MAX_SEG - 1e-9))
    step = sweep / n
    k = 4.0 / 3.0 * math.tan(math.radians(abs(step)) / 4.0) * r
    sgn = 1 if step > 0 else -1
    for i in range(n):
        s, e = a0 + i * step, a0 + (i + 1) * step
        p0, p3 = pt(cx, cy, r, s), pt(cx, cy, r, e)
        # tangent direction (counter-clockwise in maths sense, y flipped)
        t0 = (-math.sin(math.radians(s)), -math.cos(math.radians(s)))
        t1 = (-math.sin(math.radians(e)), -math.cos(math.radians(e)))
        c1 = (p0[0] + sgn * k * t0[0], p0[1] + sgn * k * t0[1])
        c2 = (p3[0] - sgn * k * t1[0], p3[1] - sgn * k * t1[1])
        pen.curveTo(c1, c2, p3)


def circle(cx, cy, r):
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo(pt(cx, cy, r, 0))
    _arc_cubics(pen, cx, cy, r, 0, 360)
    pen.closePath()
    return p


def ring(cx, cy, r_out, r_in):
    return diff(circle(cx, cy, r_out), circle(cx, cy, r_in))


def sector_band(cx, cy, r_out, r_in, a0, a1):
    """Annular sector from angle a0 to a1 (counter-clockwise), flat radial ends."""
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo(pt(cx, cy, r_out, a0))
    _arc_cubics(pen, cx, cy, r_out, a0, a1)
    pen.lineTo(pt(cx, cy, r_in, a1))
    _arc_cubics(pen, cx, cy, r_in, a1, a0)
    pen.closePath()
    return p


def wedge(cx, cy, r, a0, a1):
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo((cx, cy))
    pen.lineTo(pt(cx, cy, r, a0))
    _arc_cubics(pen, cx, cy, r, a0, a1)
    pen.closePath()
    return p


def poly(points):
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo(points[0])
    for q in points[1:]:
        pen.lineTo(q)
    pen.closePath()
    return p


def rect(x, y, w, h):
    return poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])


def rrect(x, y, w, h, r):
    """Rounded rectangle with true circular corners."""
    if r <= 0:
        return rect(x, y, w, h)
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo((x + r, y))
    pen.lineTo((x + w - r, y))
    _arc_cubics(pen, x + w - r, y + r, r, 90, 0)
    pen.lineTo((x + w, y + h - r))
    _arc_cubics(pen, x + w - r, y + h - r, r, 0, -90)
    pen.lineTo((x + r, y + h))
    _arc_cubics(pen, x + r, y + h - r, r, -90, -180)
    pen.lineTo((x, y + r))
    _arc_cubics(pen, x + r, y + r, r, 180, 90)
    pen.closePath()
    return p


def bar(p0, p1, w, cap="butt"):
    """A straight stroke of width w from p0 to p1, butt or round caps."""
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    nx, ny = -(y1 - y0) / L * w / 2, (x1 - x0) / L * w / 2
    body = poly([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny), (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)])
    if cap == "round":
        body = union(body, circle(x0, y0, w / 2), circle(x1, y1, w / 2))
    return body


def stroke_path(points, w, cap="butt", join="miter", closed=False):
    """Stroke a polyline with skia (exact offsets, real joins)."""
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo(points[0])
    for q in points[1:]:
        pen.lineTo(q)
    if closed:
        pen.closePath()
    else:
        pen.endPath()
    capm = {"butt": pathops.LineCap.BUTT_CAP, "round": pathops.LineCap.ROUND_CAP,
            "square": pathops.LineCap.SQUARE_CAP}[cap]
    joinm = {"miter": pathops.LineJoin.MITER_JOIN, "round": pathops.LineJoin.ROUND_JOIN,
             "bevel": pathops.LineJoin.BEVEL_JOIN}[join]
    p.stroke(w, capm, joinm, 10)
    return simplify(p)


# ---------------------------------------------------------------- booleans

def simplify(p):
    q = pathops.Path()
    q.addPath(p)
    q.simplify(fix_winding=True)
    return q


def union(*paths):
    out = pathops.Path()
    for p in paths:
        out = pathops.op(out, p, pathops.PathOp.UNION, fix_winding=True)
    return out


def diff(a, *bs):
    out = a
    for b in bs:
        out = pathops.op(out, b, pathops.PathOp.DIFFERENCE, fix_winding=True)
    return out


def intersect(a, b):
    return pathops.op(a, b, pathops.PathOp.INTERSECTION, fix_winding=True)


def xform(p, a=1, b=0, c=0, d=1, e=0, f=0):
    q = pathops.Path()
    q.addPath(p)
    return q.transform(a, b, c, d, e, f)


def translate(p, dx, dy):
    return xform(p, 1, 0, 0, 1, dx, dy)


def scale(p, s, ox=0, oy=0):
    return xform(p, s, 0, 0, s, ox - s * ox, oy - s * oy)


def rotate(p, deg, ox, oy):
    """Rotate counter-clockwise (visually) by deg around (ox, oy)."""
    a = math.radians(-deg)
    ca, sa = math.cos(a), math.sin(a)
    return xform(p, ca, sa, -sa, ca, ox - ca * ox + sa * oy, oy - sa * ox - ca * oy)


def mirror_x(p, axis_x):
    return xform(p, -1, 0, 0, 1, 2 * axis_x, 0)


# ---------------------------------------------------------------- output

def d(p):
    pen = SVGPathPen(None, ntos=ntos)
    p.draw(pen)
    return pen.getCommands()


def bounds(p):
    return p.bounds  # (xmin, ymin, xmax, ymax)


# ---------------------------------------------------------------- measuring

def runs(p, p0, p1, step=0.01):
    """Filled runs along the segment p0->p1, as list of (start_t_len, length).

    Used to verify stroke weights on the *final* outline, not the intent.
    """
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0)
    n = int(L / step)
    out, inside, start = [], False, 0.0
    for i in range(n + 1):
        t = i * step
        x, y = x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L
        c = p.contains((x, y))
        if c and not inside:
            inside, start = True, t
        elif not c and inside:
            inside = False
            out.append((round(start, 2), round(t - start, 2)))
    if inside:
        out.append((round(start, 2), round(L - start, 2)))
    return out


# ---------------------------------------------------------------- type

class Face:
    """A shaped, outlined instance of a (variable) font."""

    def __init__(self, path, variations=None, features=None):
        self.blob = hb.Blob.from_file_path(path)
        self.face = hb.Face(self.blob)
        self.font = hb.Font(self.face)
        if variations:
            self.font.set_variations(variations)
        self.upm = self.face.upem
        self.features = features or {"kern": True, "liga": False, "calt": False}
        self.cap = self.extents("H")[1]

    def gid(self, ch):
        return self.font.get_nominal_glyph(ord(ch))

    def extents(self, ch):
        e = self.font.get_glyph_extents(self.gid(ch))
        return (e.x_bearing, e.y_bearing, e.width, e.height)  # y_bearing = top (y-up)

    def glyph(self, gid):
        p = pathops.Path()
        self.font.draw_glyph_with_pen(gid, p.getPen())
        return simplify(p)

    def shape(self, text):
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.font, buf, self.features)
        return list(zip(buf.glyph_infos, buf.glyph_positions))

    def stem(self, ch="H", at=0.25):
        """Measure a vertical stem: first filled run across ch at mid cap height."""
        g = self.glyph(self.gid(ch))
        y = self.cap * at
        r = runs(g, (-50, y), (self.upm * 1.5, y), step=0.5)
        return r[0][1] if r else None


def set_text(face, text, size_cap, tracking=0, kern=None, glyph_override=None, origin=(0, 0)):
    """Outline `text`.

    size_cap: target cap height in output units.
    tracking: added after every glyph, in font units (per-mille of em is face.upm/1000).
    kern: {"AB": units} extra pair adjustments in font units (hand kerning).
    glyph_override: {char: callable(face) -> pathops.Path in font units (y-up)}.
    Returns (path, info) with info = {"advance", "scale", "baseline"}.
    """
    kern = kern or {}
    glyph_override = glyph_override or {}
    s = size_cap / face.cap
    ox, oy = origin
    pen_x = 0.0
    out = pathops.Path()
    shaped = face.shape(text)
    for i, (info, pos) in enumerate(shaped):
        ch = text[info.cluster]
        g = glyph_override[ch](face) if ch in glyph_override else face.glyph(info.codepoint)
        gx = pen_x + pos.x_offset
        out = union(out, xform(g, s, 0, 0, -s, ox + gx * s, oy))
        adv = pos.x_advance + tracking
        if i + 1 < len(shaped):
            nxt = text[shaped[i + 1][0].cluster]
            adv += kern.get(ch + nxt, 0)
        pen_x += adv
    return out, {"advance": (pen_x - tracking) * s, "scale": s, "baseline": oy}
