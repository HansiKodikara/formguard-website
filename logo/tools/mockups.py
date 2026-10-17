"""Context mockups. Every concept goes through the same templates so the comparison is fair.

A "kit" is: {"key", "name", "mark" (refined.Mark), "px16", "px32", "hz" (horizontal lockup dict),
"st" (stacked lockup dict)}. Mockups are flat and honest: no shadows, no fake photography.
"""
import html
import math
import fg
import refined as R
import wordmark as W

INK, RED, CHALK = R.INK, R.RED, R.CHALK


# ════════════════════════════════════════════════════════ helpers

def svg_wrap(body, box, width=None, height=None, extra=""):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    size = f' width="{width}"' if width else ""
    size += f' height="{height}"' if height else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:g} {y0:g} {w:g} {h:g}"{size} {extra}>'
            f'{body}</svg>')


def path(p, fill, extra=""):
    return f'<path d="{fg.d(p)}" fill="{fill}" {extra}/>' if p is not None else ""


def place(layers, cx, cy, height):
    """Scale + centre mark layers to `height` at (cx, cy). Returns [(Path, role)]."""
    out = []
    allb = fg.union(*[p for p, _ in layers if p is not None]).bounds
    k = height / (allb[3] - allb[1])
    w = (allb[2] - allb[0]) * k
    for p, role in layers:
        if p is None:
            continue
        out.append((fg.xform(p, k, 0, 0, k, cx - w / 2 - allb[0] * k, cy - height / 2 - allb[1] * k), role))
    return out


def mark_layers(kit, two_colour=True, small=None):
    m = kit["px%d" % small] if small else kit["mark"]
    return [(m.ink, "ink"), (m.accent, "accent" if two_colour else "ink")]


def paint(layers, ink, accent=RED):
    return "".join(path(p, accent if role == "accent" else ink) for p, role in layers)


def lockup_layers(L):
    return [(L["ink"], "ink"), (L["accent"], "accent"), (L["word"], "ink")]


def canvas_px(kit, px, fill, accent, css, two_colour=True, rid=""):
    """A canvas rasterised at true device pixels from the pixel cut (32 cut for 2× screens)."""
    m = kit["px%d" % px]
    body = path(m.ink, fill) + path(m.accent, accent if two_colour else fill)
    svg = svg_wrap(body, (0, 0, px, px), width=px, height=px)
    return (f'<canvas data-px="{px}" data-svg="{html.escape(svg, quote=True)}" '
            f'style="width:{css}px;height:{css}px" aria-label="favicon {px}px"></canvas>')


def headline(text, cap, wght=800, wdth=100, track=0.0):
    fc = W.face("hubot", wght=wght, wdth=wdth)
    p, _ = fg.set_text(fc, text, cap, tracking=track * fc.cap)
    return p


# ════════════════════════════════════════════════════════ 1 · browser tab

def browser_tab(kit, theme="light"):
    dark = theme == "dark"
    fav = canvas_px(kit, 32, CHALK if dark else INK, RED, 16)
    ph = '<span class="ph"></span>'
    return f"""<div class="browser {theme}">
  <div class="tabstrip">
    <div class="tab active">{fav}<span class="tt">FormGuard · Coaching, without the coach</span><span class="x">×</span></div>
    <div class="tab">{ph}<span class="tt">Training log · Week 6</span><span class="x">×</span></div>
    <div class="tab">{ph}<span class="tt">Squat depth notes</span><span class="x">×</span></div>
    <div class="plus">+</div>
  </div>
  <div class="omni"><span class="navs">&#8249;&nbsp;&nbsp;&#8250;&nbsp;&nbsp;&#8635;</span><div class="url">FormGuard</div></div>
</div>"""


# ════════════════════════════════════════════════════════ 2 · app icon

def squircle(size, n=5.0, steps=160):
    """Superellipse |x|^n + |y|^n = 1 scaled to size (the continuous-corner app icon shape)."""
    a = size / 2
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        x = a + a * math.copysign(abs(c) ** (2 / n), c)
        y = a + a * math.copysign(abs(s) ** (2 / n), s)
        pts.append((x, y))
    return fg.poly(pts)


def app_icon(kit, size=180, bg=INK, fg_=CHALK, accent=RED, glyph=0.56):
    shape = squircle(size)
    lay = place(mark_layers(kit), size / 2, size / 2, size * glyph)
    return svg_wrap(path(shape, bg) + paint(lay, fg_, accent), (0, 0, size, size), width=size, height=size)


def home_screen(kit):
    icons = [app_icon(kit, 120)]
    labels = ["FormGuard", "Timer", "Notes", "Music"]
    glyphs = [fg.circle(60, 60, 24), fg.rect(38, 38, 44, 44), fg.poly([(60, 34), (86, 82), (34, 82)])]
    tones = ["#6B6760", "#8A857B", "#57534C"]
    for g, t in zip(glyphs, tones):
        icons.append(svg_wrap(path(squircle(120), t) + path(g, "#F2EDE4CC"), (0, 0, 120, 120), width=120, height=120))
    cells = "".join(f'<figure><div class="ic">{i}</div><figcaption>{l}</figcaption></figure>' for i, l in zip(icons, labels))
    sizes = "".join(f'<div class="sz">{app_icon(kit, s)}<span>{s}</span></div>' for s in (180, 120, 60))
    return f'<div class="home">{cells}</div><div class="sizes">{sizes}</div>'


# ════════════════════════════════════════════════════════ 3 · compression suit (flat, front)

def _suit_paths():
    """Front flat of a long-sleeve compression top on a 600-unit canvas, symmetric about x = 300.
    Athletic block: shoulders 280 wide, waist 164, hem 176; sleeves taper bicep → wrist."""
    p = fg.pathops.Path()
    pen = p.getPen()
    pen.moveTo((300, 86))
    pen.curveTo((322, 86), (336, 72), (340, 56))          # front neckline
    pen.curveTo((372, 62), (412, 70), (440, 82))          # shoulder line
    pen.curveTo((462, 92), (476, 116), (478, 146))        # shoulder cap (deltoid)
    pen.curveTo((494, 230), (532, 340), (566, 430))       # outer sleeve
    pen.lineTo((526, 446))                                # cuff
    pen.curveTo((496, 360), (452, 262), (420, 198))       # inner sleeve
    pen.curveTo((414, 188), (408, 188), (404, 196))       # underarm
    pen.curveTo((400, 260), (380, 310), (382, 360))       # side seam to the waist
    pen.curveTo((384, 420), (390, 480), (388, 520))       # waist to hem
    pen.curveTo((360, 524), (330, 526), (300, 526))       # hem
    pen.closePath()
    right = fg.simplify(p)
    return fg.union(right, fg.mirror_x(right, 300))


SEAMS = [  # right-half seams (mirrored for the left)
    "M328 78 C350 112 380 162 406 194",        # raglan
    "M400 206 C386 284 366 384 360 523",       # side panel
    "M462 116 C482 214 514 330 546 438",       # sleeve panel
]


def _seam_paths():
    out = []
    for d_ in SEAMS:
        for sign in (1, -1):
            nums = d_.replace("M", "").replace("C", "").split()
            pts = [tuple(map(float, nums[i:i + 2])) for i in range(0, len(nums), 2)]
            pts = [(300 + sign * (x - 300), y) for x, y in pts]
            d = f"M{pts[0][0]:g} {pts[0][1]:g} C" + " ".join(f"{x:g} {y:g}" for x, y in pts[1:])
            sd = f"M{pts[0][0] - sign * 5:g} {pts[0][1]:g} C" + " ".join(f"{x - sign * 5:g} {y:g}" for x, y in pts[1:])
            out.append(f'<path d="{d}" fill="none" stroke="#33312C" stroke-width="2.2" stroke-linecap="round"/>')
            out.append(f'<path d="{sd}" fill="none" stroke="#45423B" stroke-width="1" stroke-dasharray="3 3"/>')
    out.append('<path d="M266 70 C280 92 320 92 334 70" fill="none" stroke="#33312C" stroke-width="2.2"/>')  # neck rib
    return "".join(out)


SUIT_PODS = [((456, 116), 58), ((514, 302), 70), ((546, 412), 70), ((374, 500), 88)]


def suit(kit, flag=1):
    body = _suit_paths()
    pods = ""
    for i, ((x, y), ang) in enumerate(SUIT_PODS):
        for sign in (1, -1):
            px = 300 + sign * (x - 300)
            a = ang if sign == 1 else 180 - ang
            col = RED if (i == flag and sign == 1) else "#3D3B35"
            pods += (f'<rect x="{px - 9}" y="{y - 4.5}" width="18" height="9" rx="4.5" fill="{col}" '
                     f'transform="rotate({90 - a:g} {px} {y})"/>')
    lay = place(mark_layers(kit, two_colour=False), 300, 158, 58)
    chest = paint(lay, CHALK)
    return svg_wrap(path(body, INK) + _seam_paths() + pods + chest, (24, 36, 576, 546), extra='class="suit"')


# ════════════════════════════════════════════════════════ 4 · poster

def poster(kit):
    Wd, Ht = 420, 594
    bg = f'<rect width="{Wd}" height="{Ht}" fill="{INK}"/>'
    # symbol: large, two-colour, anchored to the grid
    lay = place(mark_layers(kit), 210, 238, 250)
    sym = paint(lay, CHALK, RED)
    # headline outlined in Hubot
    h1 = headline("COACHING,", 38, wght=800, wdth=110, track=0.02)
    h2 = headline("WITHOUT THE COACH.", 38, wght=800, wdth=110, track=0.02)
    b1, b2 = h1.bounds, h2.bounds
    s = (Wd - 56) / max(b1[2] - b1[0], b2[2] - b2[0])
    lead = 1.3 * 38 * s                                   # baseline-to-baseline: 1.3 × cap
    h1 = fg.xform(h1, s, 0, 0, s, 28 - b1[0] * s, 500)
    h2 = fg.xform(h2, s, 0, 0, s, 28 - b2[0] * s, 500 + lead)
    # wordmark small, top-left
    word, _ = R.wordmark(100)
    wb = word.bounds
    ws = 12 / 100
    word = fg.xform(word, ws, 0, 0, ws, 28 - wb[0] * ws, 40)
    small = (f'<text x="392" y="40" text-anchor="end" font-family="Mona" font-size="8.5" font-weight="600" '
             f'letter-spacing=".6" fill="{CHALK}99">EVERY REP · EVERY JOINT</text>'
             f'<line x1="28" y1="462" x2="392" y2="462" stroke="{CHALK}40" stroke-width="1"/>'
             f'<text x="28" y="574" font-family="Mona" font-size="8.5" fill="{CHALK}aa">A full-body sensor suit that learns how you move, flags the joint '
             f'that\'s off,</text><text x="28" y="585" font-family="Mona" font-size="8.5" fill="{CHALK}aa">and tells you how '
             f'to fix it, mid-set.</text>')
    return svg_wrap(bg + sym + path(word, CHALK) + path(h1, CHALK) + path(h2, CHALK) + small, (0, 0, Wd, Ht),
                    extra='class="poster"')


# ════════════════════════════════════════════════════════ 5 · website header

def bar_path_device(w=360, h=300):
    """The brand device that concept 01 became: real-looking bar-path traces, one with a drift."""
    out = []
    xs = [60, 120, 180, 240, 300]
    for i, x in enumerate(xs):
        drift = (i == 3)
        if drift:
            d = f"M{x} 24 L{x} 140 C{x} 160 {x + 16} 166 {x + 16} 186 C{x + 16} 206 {x} 212 {x} 232 L{x} {h - 24}"
            col, wdt = RED, 3
        else:
            d = f"M{x} 24 L{x} {h - 24}"
            col, wdt = INK + "40", 2
        out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{wdt}" stroke-linecap="round"/>')
        out.append(f'<circle cx="{x}" cy="24" r="7" fill="{INK}"/>')
    return svg_wrap("".join(out), (0, 0, w, h), extra='class="device"')


def web_header(kit, theme="chalk"):
    L = kit["hz"]
    lay = lockup_layers(L)
    b = fg.union(*[p for p, _ in lay if p is not None]).bounds
    pad = 2
    logo = svg_wrap(paint(lay, INK, RED), (b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad), height=28,
                    extra='class="logo"')
    return f"""<div class="site">
  <nav><a class="brand" aria-label="FormGuard">{logo}</a>
    <div class="links"><a>How it works</a><a>The suit</a><a>Pricing</a><a>Sign in</a><a class="cta">Join the waitlist</a></div></nav>
  <div class="hero"><div class="copy"><div class="eyebrow">Sensor suit · AI coach · earbuds</div>
    <h4>Coaching,<br>without the coach.</h4>
    <p>FormGuard learns how you move, buzzes at the joint that's off and tells you how to fix it, mid-set. A coach at every joint for the price of one session a month.</p>
    <div class="btns"><a class="cta">Join the waitlist</a><a class="ghost">See how it works</a></div></div>
    {bar_path_device()}</div>
</div>"""


MOCK_CSS = """
.ctx{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.ctx > div{min-width:0}
.ctx h5{font:700 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.07em;text-transform:uppercase;color:var(--mute);margin:0 0 8px}
.ctxhead{display:flex;align-items:baseline;gap:12px;margin:40px 0 14px}
.ctxhead h3{font-size:20px} .ctxhead p{margin:0;color:var(--mute);font-size:13.5px}
/* browser */
.browser{border-radius:10px;overflow:hidden;font:12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;outline:1px solid #0000001a}
.browser .tabstrip{display:flex;align-items:flex-end;gap:2px;padding:8px 8px 0;background:#DFE1E5;height:42px}
.browser .tab{display:flex;align-items:center;gap:8px;padding:0 10px;height:34px;min-width:0;flex:1;max-width:240px;border-radius:8px 8px 0 0;color:#3C4043}
.browser .tab .tt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.browser .tab .x{opacity:.55;font-size:13px}
.browser .tab.active{background:#fff;color:#1F1F1F}
.browser .tab canvas{flex:none;image-rendering:auto}
.browser .ph{width:16px;height:16px;border-radius:4px;background:#9AA0A6;flex:none;opacity:.7}
.browser .plus{padding:0 10px 9px;font-size:18px;color:#5F6368}
.browser .omni{display:flex;align-items:center;gap:12px;background:#fff;padding:7px 12px 9px;border-bottom:1px solid #DADCE0}
.browser .navs{color:#5F6368;font-size:15px;letter-spacing:.02em}
.browser .url{flex:1;background:#F1F3F4;border-radius:14px;padding:7px 14px;color:#3C4043}
.browser.dark .tabstrip{background:#202124}
.browser.dark .tab{color:#BDC1C6} .browser.dark .tab.active{background:#35363A;color:#E8EAED}
.browser.dark .omni{background:#35363A;border-color:#202124} .browser.dark .url{background:#202124;color:#E8EAED}
.browser.dark .navs,.browser.dark .plus{color:#9AA0A6}
.favzoom{display:flex;gap:10px;align-items:center;margin-top:10px}
.favzoom canvas{image-rendering:pixelated;outline:1px solid var(--rule)}
.favzoom span{font:500 10.5px ui-monospace,Menlo,monospace;color:var(--mute)}
/* app icon */
.home{display:flex;gap:16px;justify-content:center;padding:26px 14px 18px;background:#5B574F;border-radius:14px}
.home figure{margin:0;width:72px;text-align:center}
.home .ic svg{width:64px;height:64px;display:block;margin:0 auto}
.home figcaption{font:500 11px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;color:#F7F4EE;margin-top:6px}
.sizes{display:flex;gap:14px;align-items:flex-end;justify-content:center;padding:18px 0 0}
.sizes .sz{display:flex;flex-direction:column;align-items:center;gap:6px}
.sizes .sz:nth-child(1) svg{width:120px;height:120px} .sizes .sz:nth-child(2) svg{width:80px;height:80px} .sizes .sz:nth-child(3) svg{width:40px;height:40px}
.sizes span{font:500 10.5px ui-monospace,Menlo,monospace;color:var(--mute)}
/* suit + poster */
.suitbox{background:#E9E3D8;padding:18px;display:grid;place-items:center}
.suitbox svg{width:100%;height:auto;max-width:380px}
.posterbox{background:#D9D2C5;padding:22px;display:grid;place-items:center}
.posterbox svg{width:100%;height:auto;max-width:330px;outline:1px solid #0000001f}
/* website header */
.site{background:var(--chalk);outline:1px solid var(--rule);font-family:Mona,sans-serif;margin-bottom:18px}
.site nav{display:flex;align-items:center;justify-content:space-between;padding:20px 36px;border-bottom:1px solid var(--rule)}
.site .brand{display:flex;align-items:center}
.site .links{display:flex;gap:26px;align-items:center;font-size:14px;font-weight:500}
.site a{color:var(--ink);text-decoration:none}
.site .cta{background:var(--ink);color:var(--chalk);padding:10px 16px;font-weight:600}
.site .ghost{border:1.5px solid var(--ink);padding:9px 15px;font-weight:600}
.site .hero{display:grid;grid-template-columns:1.25fr .75fr;gap:40px;align-items:center;padding:56px 36px 50px}
.site .eyebrow{font:600 11.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--red);margin-bottom:18px}
.site h4{font:800 68px/.98 Hubot;font-stretch:110%;letter-spacing:-.01em;margin:0 0 20px;text-transform:uppercase}
.site p{font-size:17px;max-width:46ch;margin:0 0 26px}
.site .btns{display:flex;gap:12px}
.site .device{width:100%;height:auto;max-width:300px;justify-self:center}
@media (max-width:1100px){.ctx{grid-template-columns:1fr}.site .hero{grid-template-columns:1fr}.site h4{font-size:48px}}
"""
