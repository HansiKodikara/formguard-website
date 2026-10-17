"""Builds logo-explorations.html (repo root) from the geometry in marks.py / wordmark.py.

Run:  logo/tools/.venv/bin/python -I logo/tools/build.py
"""
import html
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

import fg  # noqa: E402
import wordmark as W  # noqa: E402
import marks  # noqa: E402

W.FONTS = os.path.join(ROOT, "logo", "fonts")

INK, RED, CHALK = "#1B1A17", "#C62B22", "#F2EDE4"
FONT_URL = "logo/fonts/hubotsans/HubotSans[wdth,wght].ttf"
TEXT_FONT_URL = "logo/fonts/monasans/MonaSans[wdth,wght].ttf"


# ════════════════════════════════════════════════════════ svg helpers

def svg_paths(layers, box, height=None, width=None, cls="", title=None):
    """layers: [(Path, fill)]; box: (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    size = ""
    if height:
        size = f' height="{height:g}" width="{height * w / h:.2f}"'
    elif width:
        size = f' width="{width:g}" height="{width * h / w:.2f}"'
    t = f"<title>{html.escape(title)}</title>" if title else ""
    body = "".join(f'<path d="{fg.d(p)}" fill="{f}"/>' for p, f in layers if p is not None)
    c = f' class="{cls}"' if cls else ""
    return (f'<svg{c} viewBox="{x0:g} {y0:g} {w:g} {h:g}"{size} role="img" '
            f'xmlns="http://www.w3.org/2000/svg">{t}{body}</svg>')


def pad_box(b, p):
    return (b[0] - p, b[1] - p, b[2] + p, b[3] + p)


def text_box(path, cap, pad_ratio=0.0):
    """Box for outlined type: cap-height based so different words align."""
    b = path.bounds
    p = cap * pad_ratio
    return (b[0] - p, -cap - p - (cap * 0.03), b[2] + p, cap * 0.03 + p)


# ════════════════════════════════════════════════════════ wordmarks

# Hand kerning in font units, after reading the optical-gap analysis (wordmark.pair_gaps)
# and looking at each pair at 24px and 200px. Tracking is per-mille of cap height → units.
TYPE_SETTINGS = {
    "bigshoulders": {"track": 0.050, "kern": {"FO": -95, "AR": -10, "MG": 15},
                     "kern_lc": {"rm": -60, "mG": 55, "Gu": 30, "rd": -30}},
    "pathway": {"track": 0.040, "kern": {"FO": -22, "GU": -10, "AR": -8, "MG": 8},
                "kern_lc": {"mG": 22, "Gu": 8}},
    "barlow": {"track": 0.040, "kern": {"FO": -42, "AR": -22, "UA": -12, "MG": 16, "OR": 10},
               "kern_lc": {"rm": -24, "mG": 20, "rd": -20, "Gu": 8}},
    "archivo": {"track": 0.000, "kern": {"FO": -24, "GU": -14, "RM": 12, "RD": 12},
                "kern_lc": {"Gu": -12, "ar": 14, "mG": -10, "rd": 8}},
    "familjen": {"track": 0.030, "kern": {"FO": -22, "GU": -14, "AR": -12, "MG": 8},
                 "kern_lc": {"rm": -38, "Fo": 18, "mG": 12, "ar": -8}},
    "hubot": {"track": 0.045, "kern": {"FO": -30, "AR": -22, "UA": 14, "OR": 12, "MG": 12, "GU": 6, "RM": -6, "RD": -6},
              "kern_lc": {"rm": -24, "rd": -26, "ar": 12, "Gu": 8}},
}


def set_word(key, text, cap, settings=None, overrides=None, default_spacing=False, **var):
    fc = W.face(key, **var)
    st = settings or TYPE_SETTINGS[key]
    if default_spacing:
        track, kern = 0, {}
    else:
        track = st["track"] * fc.cap
        kern = st["kern"] if text.isupper() else st["kern_lc"]
    path, info = fg.set_text(fc, text, cap, tracking=track, kern=kern, glyph_override=overrides)
    return path, fc


def word_svg(key, text, cap_px, fill=INK, **kw):
    path, fc = set_word(key, text, 100, **kw)
    return svg_paths([(path, fill)], text_box(path, 100, 0.02), height=cap_px * 1.08)


# ════════════════════════════════════════════════════════ page chrome

CSS = f"""
@font-face{{font-family:Hubot;src:url('{FONT_URL}') format('truetype');font-weight:200 900;font-stretch:75% 125%}}
@font-face{{font-family:Mona;src:url('{TEXT_FONT_URL}') format('truetype');font-weight:200 900;font-stretch:75% 125%}}
:root{{--ink:{INK};--red:{RED};--chalk:{CHALK};--rule:#1B1A1726;--mute:#1B1A17A6}}
*{{box-sizing:border-box}}
html{{background:var(--chalk)}}
body{{margin:0;color:var(--ink);background:var(--chalk);font:400 15px/1.55 Mona,ui-sans-serif,system-ui,sans-serif;font-stretch:100%;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1320px;margin:0 auto;padding:0 40px}}
header.top{{padding:56px 0 40px;border-bottom:2px solid var(--ink)}}
header.top .kicker{{font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}}
h1{{font:800 56px/1 Hubot;font-stretch:110%;letter-spacing:-.01em;margin:14px 0 18px}}
h2{{font:800 34px/1.05 Hubot;font-stretch:110%;margin:0 0 6px}}
h3{{font:700 19px/1.2 Mona;font-stretch:105%;margin:0}}
p{{margin:0 0 10px;max-width:72ch}}
.lede{{font-size:18px;max-width:64ch}}
.mono{{font:500 12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}}
.mute{{color:var(--mute)}}
section{{padding:56px 0 64px;border-bottom:1px solid var(--rule)}}
.sechead{{display:grid;grid-template-columns:80px 1fr;gap:0 24px;margin-bottom:32px}}
.secnum{{font:800 34px/1.05 Mona;font-stretch:112%;color:var(--red)}}
.swatches{{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}}
.sw{{width:150px;height:64px;padding:10px 12px;display:flex;align-items:flex-end;font:600 11px ui-monospace,Menlo,monospace}}
/* type */
.tf{{display:grid;grid-template-columns:230px 1fr;gap:24px;padding:26px 0;border-top:1px solid var(--rule);align-items:start}}
.tf .meta h3{{margin-bottom:6px}}
.tf .samples{{display:flex;flex-direction:column;gap:18px;min-width:0}}
.tf .samples svg{{display:block;max-width:100%;height:auto}}
.tf .small{{display:flex;gap:28px;align-items:center;flex-wrap:wrap}}
.verdict{{display:inline-block;font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:5px 7px;margin:8px 0 0}}
.verdict.pick{{background:var(--red);color:var(--chalk)}}
.verdict.no{{border:1px solid var(--rule);color:var(--mute)}}
.trials{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}}
.trial{{background:#fff8;border:1px solid var(--rule);padding:22px}}
.trial svg{{display:block;max-width:100%;height:auto;margin:6px 0 14px}}
.dark{{background:var(--ink);color:var(--chalk)}}
.kern-table{{border-collapse:collapse;margin-top:6px}}
.kern-table td{{padding:2px 10px 2px 0;font:500 12px ui-monospace,Menlo,monospace}}
/* concepts */
.concept{{border-top:2px solid var(--ink);padding:26px 0 34px}}
.chead{{display:flex;align-items:baseline;gap:14px;margin-bottom:16px}}
.chead .n{{font:800 15px/1 Mona;font-stretch:110%;color:var(--red);min-width:28px}}
.chead h3{{font-size:22px}}
.tag{{font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:5px 7px;margin-left:auto;white-space:nowrap}}
.tag.short{{background:var(--red);color:var(--chalk)}} .tag.lead{{background:var(--ink);color:var(--chalk)}}
.tag.rej{{border:1px solid var(--rule);color:var(--mute)}} .tag.dev{{border:1px solid var(--ink)}}
.cgrid{{display:grid;grid-template-columns:repeat(2,minmax(0,190px)) 190px minmax(0,1fr);gap:14px;align-items:start}}
.big{{aspect-ratio:1;display:grid;place-items:center;padding:22px}}
.big svg{{width:100%;height:auto}}
.on-chalk{{background:var(--chalk);outline:1px solid var(--rule);outline-offset:-1px}} .on-iron{{background:var(--ink)}}
.px{{display:flex;flex-direction:column;gap:8px}}
.px .r{{display:flex;align-items:center;gap:14px;padding:10px 12px;min-height:84px}}
.px canvas{{image-rendering:pixelated;image-rendering:crisp-edges;display:block}}
.px .lbl{{font:500 10px ui-monospace,Menlo,monospace;color:var(--mute);margin-top:4px;text-align:center}}
.px .on-iron .lbl{{color:#F2EDE499}}
.crit{{font-size:13.5px;line-height:1.5}}
.crit dt{{font:700 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.07em;text-transform:uppercase;color:var(--mute);margin-top:9px}}
.crit dt:first-child{{margin-top:0}}
.crit dd{{margin:3px 0 0}}
.ai-high{{color:var(--red);font-weight:700}} .ai-med{{font-weight:700}} .ai-low{{font-weight:700}}
.lockrow{{display:grid;grid-template-columns:minmax(0,394px) 190px minmax(0,1fr);gap:14px;margin-top:14px;align-items:stretch}}
.lock{{display:flex;align-items:center;justify-content:center;padding:26px 22px;min-height:110px}}
.lock svg{{max-width:100%;height:auto}}
.two{{display:flex;gap:8px;align-items:center;justify-content:center;padding:12px}}
.two div{{padding:10px;flex:1;display:grid;place-items:center}}
.two svg{{width:100%;max-width:64px;height:auto}}
.checks{{font:500 11px/1.55 ui-monospace,Menlo,monospace;color:var(--mute)}}
.checks b{{color:#2E7D4F}} .checks b.x{{color:var(--red)}}
.sk{{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}}
.sk figure{{margin:0;width:118px}}
.sk figure div{{aspect-ratio:1;padding:14px}}
.sk figcaption{{font:500 10.5px/1.3 ui-monospace,Menlo,monospace;color:var(--mute);margin-top:5px}}
.score{{width:100%;border-collapse:collapse;font-size:13.5px}}
.score th,.score td{{padding:9px 10px;border-bottom:1px solid var(--rule);text-align:center}}
.score th{{font:700 10.5px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}}
.score td:first-child,.score th:first-child{{text-align:left}}
.score td.m{{width:44px;padding:4px}}
.score svg{{width:30px;height:30px;display:block}}
.dot{{font-size:16px}}
@media (max-width:1100px){{.cgrid{{grid-template-columns:repeat(3,minmax(0,1fr))}}.crit{{grid-column:1/-1}}.lockrow{{grid-template-columns:1fr}}}}
@media (max-width:820px){{.tf,.sechead{{grid-template-columns:1fr}}.trials{{grid-template-columns:1fr}}}}
"""

RASTER_JS = """
// Rasterise each mark at its true pixel size so 16px/32px tests show real pixels, not a scaled vector.
document.querySelectorAll('canvas[data-svg]').forEach(c => {
  const px = +c.dataset.px, img = new Image();
  c.width = px; c.height = px;
  img.onload = () => { const g = c.getContext('2d'); g.clearRect(0,0,px,px); g.drawImage(img, 0, 0, px, px); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.dataset.svg);
});
"""


def page(sections):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FormGuard logo explorations</title>
<style>{CSS}</style></head>
<body>
<div class="wrap">
<header class="top">
  <div class="kicker">FormGuard · Identity · Session 1 of 2 · Logo</div>
  <h1>Logo explorations</h1>
  <p class="lede">Coaching, without the coach. A full-body sensor suit that learns how each lifter moves,
  flags the joint that's off, and tells them how to fix it mid-set. The identity should feel like the
  tools lifters already trust: a good barbell, a calibrated instrument. Precise, strong, honest, understated.</p>
  <div class="swatches">
    <div class="sw" style="background:{INK};color:{CHALK}">Iron Black {INK}</div>
    <div class="sw" style="background:{RED};color:{CHALK}">Plate Red {RED}</div>
    <div class="sw" style="background:{CHALK};color:{INK};outline:1px solid var(--rule);outline-offset:-1px">Chalk {CHALK}</div>
  </div>
</header>
{''.join(sections)}
<footer class="mono mute" style="padding:28px 0 60px">Generated from logo/tools/build.py. Every mark is exact geometry
(logo/tools/marks.py); every wordmark is outlined from the OFL typeface with hand kerning (logo/tools/build.py, TYPE_SETTINGS).</footer>
</div>
<script>{RASTER_JS}</script>
</body></html>"""


def sechead(num, title, intro):
    return f"""<div class="sechead"><div class="secnum">{num}</div><div><h2>{title}</h2>{intro}</div></div>"""


# ════════════════════════════════════════════════════════ 01 typefaces

TYPE_NOTES = {
    "bigshoulders": ("Big Shoulders Display 850",
                     "Chicago industrial condensed. Plenty of character and very athletic, but the deep, thin-legged M "
                     "and narrow counters read as craft beer or sports team before they read as precise.",
                     "no", "Too much costume"),
    "pathway": ("Pathway Extreme 800 · width 75 · opsz 72",
                "A heavy American gothic, cut tight. Honest and dense, like the stamping on a bar sleeve. "
                "It has no tricks, so the custom work has to come from us.",
                "pick", "Pick · condensed"),
    "barlow": ("Barlow Condensed ExtraBold",
               "Technical and DIN-like, and very legible small. It's also everywhere in fitness apps and UI, "
               "and the soft corners feel generic next to a precise mark.",
               "no", "Too familiar"),
    "archivo": ("Archivo 800 · width 125",
                "Wide, stable and strong. Solid, but it's the default extended grotesk of the 2020s sports "
                "brand, so it doesn't feel ownable.",
                "no", "Solid, generic"),
    "familjen": ("Familjen Grotesk 700",
                 "Characterful and well drawn. But it tops out at 700, so it reads light for 'strong', and its "
                 "quirks (R leg, a) feel editorial rather than athletic.",
                 "no", "Too light, too editorial"),
    "hubot": ("Hubot Sans 800 · width 110",
              "An engineered grotesk with squared curves (super-ellipse O, D, G, U). It reads like the markings on a "
              "calibrated instrument: machined, calm, heavy without shouting. Distinctive without being decorative.",
              "pick", "Pick · primary"),
}


def section_typefaces():
    rows = []
    for key in ("hubot", "pathway", "bigshoulders", "archivo", "barlow", "familjen"):
        label, note, verdict, vlabel = TYPE_NOTES[key]
        caps = word_svg(key, "FORMGUARD", 74)
        mixed = word_svg(key, "FormGuard", 74)
        sm1 = word_svg(key, "FORMGUARD", 12)
        sm2 = word_svg(key, "FORMGUARD", 12, fill=CHALK)
        rows.append(f"""<div class="tf"><div class="meta"><h3>{label}</h3><p class="mute" style="font-size:13.5px">{note}</p>
<span class="verdict {verdict}">{vlabel}</span></div>
<div class="samples">{caps}{mixed}
<div class="small"><span class="mono mute">12px cap</span>{sm1}<span class="dark" style="padding:8px 12px">{sm2}</span></div></div></div>""")

    trials = type_trials()
    return f"""<section id="type">{sechead("01", "Wordmark typefaces",
        "<p>Six heavy grotesks, condensed to extended, chosen from a long list of 24 (rejected outright: Anybody and Saira for looking like games, Antonio and League Gothic for being generic, Bebas, Oswald and Space Grotesk for being AI and fitness clichés). Every sample is outlined, not live text, and spaced by hand: an optical-gap pass measures the white space between each pair on 120 scanlines, then each pair is judged by eye at 24px and 200px. "
        "<b>FORMGUARD</b> in capitals reads as equipment. <b>FormGuard</b> in camel case reads as an app. Recommendation: capitals.</p>")}
{''.join(rows)}
<h3 style="margin:44px 0 6px">Customisation trials on the two picks</h3>
<p class="mute">Small, deliberate interventions. Only the ones that carry meaning survive into round 4.</p>
<div class="trials">{trials}</div>
</section>"""


# ---- glyph surgery for the trials (font units, y-up) ------------------------------------

def hubot_F_level(fc):
    """Hubot F with its middle arm lowered so its top edge sits on the R's bowl join (406.5)."""
    g = fc.glyph(fc.gid("F"))
    # the arm is a rectangle 259.5..421.0, x from stem to 629.5; rebuild at 245..406.5
    g = fg.diff(g, fg.rect(263, 259.5 - 1, 400, 421.0 - 259.5 + 2))
    return fg.union(g, fg.rect(250, 245.0, 629.5 - 250, 161.5))


def hubot_G_level(fc):
    """Hubot G with the bar's top edge raised 402.5 → 406.5 to sit on the same level line.

    The bar's left end is measured from the outline (never guessed) so the raise can't overhang.
    """
    g = fc.glyph(fc.gid("G"))
    xmax = g.bounds[2]
    runs = fg.runs(g, (0, 330), (xmax + 10, 330), step=0.25)
    bar_start, bar_len = runs[-1]          # last run on the bar line = bar + spur
    x0 = bar_start
    return fg.union(g, fg.rect(x0, 400.0, xmax - x0, 6.5))


def hubot_G_spurless(fc):
    """G built from Hubot's O: same bowl, scaled to the G's width, opening cut at the terminal height."""
    o = fc.glyph(fc.gid("O"))
    g = fc.glyph(fc.gid("G"))
    ox0, _, ox1, _ = o.bounds
    gx0, _, gx1, _ = g.bounds
    k = (gx1 - gx0) / (ox1 - ox0)
    o = fg.xform(o, k, 0, 0, 1, gx0 - k * ox0, 0)
    opening = fg.rect(437, 402, 600, 477 - 402)
    bar = fg.rect(437, 265, gx1 - 437, 402 - 265)
    return fg.union(fg.diff(o, opening), bar)


def hubot_F_safety(fc):
    """Safety F inside the wordmark: middle arm dropped to open the counter, the bar sits inside."""
    g = fc.glyph(fc.gid("F"))
    g = fg.diff(g, fg.rect(263, 258, 500, 166))
    arm_top = 330.0
    g = fg.union(g, fg.rect(250, arm_top - 161.5, 629.5 - 250, 161.5))
    counter_lo, counter_hi = arm_top, 567.0
    r = (counter_hi - counter_lo) / 2 - 34
    cx = 263 + 34 + r + 30
    return fg.union(g, fg.circle(cx, (counter_lo + counter_hi) / 2, r))


def type_trials():
    out = []
    # 1 · spacing: default vs hand-kerned
    dflt, _ = set_word("hubot", "FORMGUARD", 100, default_spacing=True)
    kern, fc = set_word("hubot", "FORMGUARD", 100)
    gaps0 = W.pair_gaps(fc, "FORMGUARD", 0, {})
    gaps1 = W.pair_gaps(fc, "FORMGUARD", TYPE_SETTINGS["hubot"]["track"] * fc.cap, TYPE_SETTINGS["hubot"]["kern"])
    import statistics as S
    spread0 = (max(g for _, g in gaps0) - min(g for _, g in gaps0)) / fc.cap * 100
    spread1 = (max(g for _, g in gaps1) - min(g for _, g in gaps1)) / fc.cap * 100
    rows = "".join(f"<tr><td>{p}</td><td>{TYPE_SETTINGS['hubot']['kern'].get(p, 0):+d}</td></tr>"
                   for p, _ in gaps1 if TYPE_SETTINGS['hubot']['kern'].get(p, 0))
    out.append(f"""<div class="trial"><h3>Spacing · Hubot Sans</h3>
<p class="mono mute">Font default (top) · hand-kerned, +45 tracking (bottom)</p>
{svg_paths([(dflt, INK)], text_box(dflt, 100, .02), height=58)}
{svg_paths([(kern, INK)], text_box(kern, 100, .02), height=58)}
<p style="font-size:13.5px">The default spacing is uneven: FO gapes and UA pinches. The largest-to-smallest optical gap
spread falls from {spread0:.1f}% to {spread1:.1f}% of cap height. Pair adjustments, in units of 1/1000 em:</p>
<table class="kern-table">{rows}</table></div>""")

    # 2 · level line
    lv, _ = set_word("hubot", "FORMGUARD", 100, overrides={"F": hubot_F_level, "G": hubot_G_level})
    box = text_box(lv, 100, .02)
    level_y = -406.5 / fc.cap * 100
    guide = fg.rect(box[0], level_y - 0.35, box[2] - box[0], 0.7)
    out.append(f"""<div class="trial"><h3>Level line · Hubot Sans</h3>
<p class="mono mute">F arm, R bowl and G bar share one height</p>
{svg_paths([(lv, INK), (guide, RED)], box, height=58)}
<p style="font-size:13.5px">The F's middle arm (421.0) and G's bar (402.5) are moved onto the R's bowl join (406.5),
so the word holds one exact level, the way a lifter holds a bar. You don't see it, you feel it.
<b>Keep</b> for the final wordmark.</p></div>""")

    # 3 · modified G: spur kept vs spurless
    gs, _ = set_word("hubot", "FORMGUARD", 100, overrides={"G": hubot_G_spurless})
    g_def = fg.xform(fc.glyph(fc.gid("G")), 100 / fc.cap, 0, 0, -100 / fc.cap, 0, 0)
    g_sp = fg.xform(hubot_G_spurless(fc), 100 / fc.cap, 0, 0, -100 / fc.cap, 0, 0)
    gpair = fg.union(g_def, fg.translate(g_sp, 135, 0))
    out.append(f"""<div class="trial"><h3>Modified G · Hubot Sans</h3>
<p class="mono mute">Hubot's spurred G (left) · spurless G built from its own O (right)</p>
{svg_paths([(gpair, INK)], pad_box(gpair.bounds, 3), height=88)}
{svg_paths([(gs, INK)], text_box(gs, 100, .02), height=40)}
<p style="font-size:13.5px">The spurless G is drawn from Hubot's own O bowl, opened at the terminal height (477) and given
the same bar, so there's no seam. It's smoother but softer and more generic, like any geometric sans. The square spur under
the bar is what makes the word feel machined. <b>Keep the spur.</b> The G's only change is the 4-unit raise onto the level line.</p></div>""")

    # 4 · a cut
    word, _ = set_word("hubot", "FORMGUARD", 100)
    b = word.bounds
    cut = fg.diff(word, fg.rect(b[0] - 5, -47 - 2.2, b[2] - b[0] + 10, 4.4))
    out.append(f"""<div class="trial"><h3>A cut at parallel · Hubot Sans</h3>
<p class="mono mute">One horizontal cut through the word at 47% of cap height</p>
{svg_paths([(cut, INK)], text_box(cut, 100, .02), height=58)}
<p style="font-size:13.5px">The depth line as a cut. It looks like sportswear and like a stencil, and at small sizes it
closes up and adds noise. It's an effect, not an idea. <b>Rejected.</b></p></div>""")

    # 5 · pathway kerned
    pd, _ = set_word("pathway", "FORMGUARD", 100, default_spacing=True)
    pk, _ = set_word("pathway", "FORMGUARD", 100)
    out.append(f"""<div class="trial"><h3>Spacing · Pathway Extreme</h3>
<p class="mono mute">Font default (top) · hand-kerned, +40 tracking (bottom)</p>
{svg_paths([(pd, INK)], text_box(pd, 100, .02), height=58)}
{svg_paths([(pk, INK)], text_box(pk, 100, .02), height=58)}
<p style="font-size:13.5px">At opsz 72 the defaults are display-tight. They're good for a headline but too tight for a logo
that also has to work at 14px. Opened by 4% of cap height, with FO closed −22 and MG opened +8.</p></div>""")

    # 6 · joined pair
    jp, fcp = set_word("pathway", "FORMGUARD", 100, settings={"track": 0.04, "kern": {"FO": -22, "UA": -96, "AR": -8, "MG": 8}, "kern_lc": {}})
    out.append(f"""<div class="trial"><h3>Joined pair · Pathway Extreme</h3>
<p class="mono mute">U and A locked together</p>
{svg_paths([(jp, INK)], text_box(jp, 100, .02), height=58)}
<p style="font-size:13.5px">Locking the U into the A's diagonal makes a sports-club ligature. It knots up the middle of
GUARD and has nothing to do with form or guarding. <b>Rejected.</b></p></div>""")
    return "".join(out)


# ════════════════════════════════════════════════════════ 02 concepts

def mark_layers(m, one_colour=True, fill=INK, accent=RED):
    if one_colour:
        one = fg.union(m["ink"], m["accent"]) if m["accent"] is not None else m["ink"]
        return [(one, fill)]
    return [(m["ink"], fill), (m["accent"], accent)]


def square_box(path, pad_ratio=0.06):
    x0, y0, x1, y1 = path.bounds
    s = max(x1 - x0, y1 - y0)
    p = s * pad_ratio
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return (cx - s / 2 - p, cy - s / 2 - p, cx + s / 2 + p, cy + s / 2 + p)


def raster(m, px, fill, css_px=None, pad=0.04):
    """A <canvas> that the page rasterises at exactly px×px (true favicon pixels)."""
    layers = mark_layers(m, True, fill)
    box = square_box(layers[0][0], pad)
    svg = svg_paths(layers, box, height=px).replace('role="img" ', '')
    css = css_px or px
    return (f'<canvas data-px="{px}" data-svg="{html.escape(svg, quote=True)}" '
            f'style="width:{css}px;height:{css}px" aria-label="{px}px raster"></canvas>')


def lockup(m, fill=INK, cap=100, ratio=1.35, gap=0.5, word_key="hubot"):
    """Mark (scaled to ratio×cap, centred on the cap height) + FORMGUARD."""
    layers = mark_layers(m, True, fill)
    mk = layers[0][0]
    x0, y0, x1, y1 = mk.bounds
    h = ratio * cap
    k = h / (y1 - y0)
    mk = fg.xform(mk, k, 0, 0, k, -x0 * k, -cap / 2 - h / 2 - y0 * k)
    word, _ = set_word(word_key, "FORMGUARD", cap)
    wx0 = word.bounds[0]
    word = fg.translate(word, (x1 - x0) * k + gap * cap - wx0, 0)
    both = fg.union(mk, word)
    b = both.bounds
    p = cap * 0.12
    return svg_paths([(both, fill)], (b[0] - p, b[1] - p, b[2] + p, b[3] + p), height=None, width=360)


CRIT = {
    "bar-path": dict(
        idea="The side-on trace of the barbell's end through a rep, drifting once. Literally what FormGuard checks.",
        works="The truest idea here, and lifters know bar-path overlays from their own videos.",
        fails="As a picture it's a balloon on a string, and at 16px a map pin. The drift, which is the actual point, is the first thing to disappear. Disc and line make a stock pictogram with no tie to the name.",
        ai=("med", "Medium. A stock pictogram."),
        verdict=("dev", "Keep as a device"), note="Rejected as a mark. Keep it as a brand device: real bar-path traces animating on the website."),
    "parallel": dict(
        idea="The knee at parallel, the standard of a full squat, with its angle measured.",
        works="Precise, calm and instrument-like. Reads as a right angle at any size, and the arc is the measurement, so it earns the red.",
        fails="Close to generic geometry. Designers will see Figma's corner-radius icon. A knee node turns it into plumbing, and the solid sweep looks like a Bauhaus generator.",
        ai=("med", "Medium. It could be a geometry-app icon unless the proportions are made unmistakably ours."),
        verdict=("short", "Shortlist"), note="The precise route."),
    "sensor": dict(
        idea="F and G drawn as joints and links, like a skeleton.",
        works="It says 'sensors'.",
        fails="Eleven nodes. It reads as a circuit board, a molecule or a neural network, and at 16px it's noise.",
        ai=("high", "High. This is exactly what a logo generator makes for 'AI fitness'."),
        verdict=("rej", "Rejected"), note=""),
    "rom": dict(
        idea="A joint's sweep, with a rep stopped short of its mark.",
        works="Tells the partial-rep story.",
        fails="It's a speedometer, with four elements. The short-rep detail vanishes small, and it says 'dashboard', not lifting.",
        ai=("high", "High. A stock dashboard icon."),
        verdict=("rej", "Rejected"), note=""),
    "rails": dict(
        idea="The movement kept between guide rails.",
        works="Simple, and it survives 16px.",
        fails="It reads as a media control (pause, record) and says nothing about lifting or the name.",
        ai=("med", "Medium. Anonymous UI glyph."),
        verdict=("rej", "Rejected"), note=""),
    "cradle": dict(
        idea="The bar held in a J-hook, or a spotter's hands, never touching it. Guarding without a shield.",
        works="The boldest shape here. Perfect at 16px, one-colour safe, calm and confident.",
        fails="Generic. A U holding a ball could be a magnet, a cup or any brand, and it doesn't connect to the name. The J-hook profile variant reads as a 'b'.",
        ai=("med", "Medium. Clean but anonymous."),
        verdict=("short", "Shortlist"), note="The robust route."),
    "rack-f": dict(
        idea="The F is a power rack seen side-on: upright, J-hook above, safety arm below, with the bar held between them. The counter is carved into a socket, so the bar sits like a ball joint. One shape, three readings: F, rack, joint.",
        works="Ownable and specific to lifting. It's built from the letter that starts the name, so mark and wordmark share a source. Every lifter gets the rack, and everyone gets the F.",
        fails="The socket bite is subtle and closes below 32px, so it needs a drawn small-size version. With the ball smaller or nearer the stem it reads as an eye, and the plain F-plus-dot variants are generic.",
        ai=("low", "Low. A specific idea with real anatomy behind it."),
        verdict=("lead", "Shortlist · lead"), note="The ownable route."),
    "plate": dict(
        idea="A calibrated plate as the mark, or as the O.",
        works="Instantly 'gym'.",
        fails="It's a target, a record or a donut: the most expected gym-logo trope. The hub groove vanishes below 32px.",
        ai=("high", "High. A template gym logo."),
        verdict=("rej", "Rejected"), note=""),
    "buzz": dict(
        idea="A joint node and the haptic pulse that flags it.",
        works="It's the product's signature moment.",
        fails="It's the universal 'live/broadcast' icon, and a red dot with rings recalls Target.",
        ai=("high", "High."),
        verdict=("dev", "Keep as motion"), note="Rejected as a mark. Keep the pulse as UI motion."),
    "pivot-g": dict(
        idea="The G's bar as a limb on a pivot, with the range of motion around it.",
        works="A neat synthesis of joint, range and letter.",
        fails="It is Google's G with a dot.",
        ai=("high", "High. Derivative."),
        verdict=("rej", "Rejected"), note=""),
    "lights": dict(
        idea="The referee's three lights; FormGuard as the honest judge in your ear.",
        works="Deep lifting culture and an ownable meaning (three white lights).",
        fails="As a shape it's an ellipsis (⋯) or carousel dots, with zero distinctiveness. In one colour the verdict is lost.",
        ai=("med", "Medium."),
        verdict=("dev", "Keep as a device"), note="Rejected as a mark. Keep it as a product device: three-light rep verdicts."),
    "stack": dict(
        idea="Form slipping when tired: four plates aligned, the last one off.",
        works="Fatigue drift is a real, specific insight.",
        fails="It's a hamburger menu with a glitch, and glitch offsets are a tech trope.",
        ai=("high", "High."),
        verdict=("rej", "Rejected"), note=""),
}

SCORE = {  # one idea, memorable, 16px, one colour, ownable, not AI-looking   (2 yes · 1 partly · 0 no)
    "bar-path": (2, 1, 0, 2, 1, 1), "parallel": (2, 2, 2, 2, 1, 1), "sensor": (1, 0, 0, 2, 0, 0),
    "rom": (1, 0, 0, 1, 0, 0), "rails": (1, 1, 2, 2, 0, 1), "cradle": (2, 2, 2, 2, 1, 1),
    "rack-f": (2, 2, 1, 2, 2, 2), "plate": (2, 2, 1, 2, 0, 0), "buzz": (2, 2, 2, 2, 0, 0),
    "pivot-g": (2, 2, 2, 2, 0, 0), "lights": (2, 2, 2, 1, 0, 1), "stack": (2, 1, 1, 2, 0, 0),
}


def concept_card(i, key, name, m):
    c = CRIT[key]
    box = (0, 0, 120, 120)
    big_c = svg_paths(mark_layers(m, True, INK), box)
    big_i = svg_paths(mark_layers(m, True, CHALK), box)
    two_c = svg_paths(mark_layers(m, False, INK, RED), box)
    two_i = svg_paths(mark_layers(m, False, CHALK, RED), box)
    px = f"""<div class="px">
  <div class="r on-chalk"><div>{raster(m, 32, INK)}<div class="lbl">32</div></div><div>{raster(m, 16, INK)}<div class="lbl">16</div></div><div>{raster(m, 16, INK, 64)}<div class="lbl">16 ×4</div></div></div>
  <div class="r on-iron"><div>{raster(m, 32, CHALK)}<div class="lbl">32</div></div><div>{raster(m, 16, CHALK)}<div class="lbl">16</div></div><div>{raster(m, 16, CHALK, 64)}<div class="lbl">16 ×4</div></div></div>
</div>"""
    ai_cls = {"high": "ai-high", "med": "ai-med", "low": "ai-low"}[c["ai"][0]]
    note = f"<dt>Verdict</dt><dd>{c['note']}</dd>" if c["note"] else ""
    crit = f"""<dl class="crit"><dt>Idea</dt><dd>{c['idea']}</dd><dt>Works</dt><dd>{c['works']}</dd>
<dt>Fails</dt><dd>{c['fails']}</dd><dt>Would a designer guess AI?</dt><dd class="{ai_cls}">{c['ai'][1]}</dd>{note}</dl>"""
    checks = "".join(
        f"<div><b class='{'' if ok else 'x'}'>{'✓' if ok else '✗'}</b> {html.escape(label)}: "
        f"{', '.join(f'{v:.3f}' for v in got) if got else 'clear (no ink)'}</div>"
        for label, got, expect, ok in m["checks"])
    sk = ""
    if key in marks.SKETCHES:
        figs = []
        for cap_, fn in marks.SKETCHES[key]:
            sm = fn()
            figs.append(f'<figure><div class="on-chalk">{svg_paths(mark_layers(sm, False, INK, RED), box)}</div>'
                        f'<figcaption>{html.escape(cap_)}</figcaption></figure>')
        sk = f'<div class="sk">{"".join(figs)}</div>'
    vcls, vlabel = c["verdict"]
    return f"""<article class="concept" id="c-{key}">
<div class="chead"><span class="n">{i:02d}</span><h3>{name}</h3><span class="tag {vcls}">{vlabel}</span></div>
<div class="cgrid"><div class="big on-chalk">{big_c}</div><div class="big on-iron">{big_i}</div>{px}{crit}</div>
<div class="lockrow"><div class="lock on-chalk">{lockup(m)}</div>
<div class="two on-chalk"><div class="on-chalk">{two_c}</div><div class="on-iron">{two_i}</div></div>
<div class="checks">{checks}</div></div>{sk}
</article>"""


def section_concepts():
    cards = [concept_card(i, k, n, fn()) for i, (k, n, fn) in enumerate(marks.CONCEPTS, 1)]
    return f"""<section id="marks">{sechead("02", "Mark concepts",
        "<p>Twelve concepts: the seven directions in the brief plus five of my own. Each is exact geometry on a 120-unit grid, "
        "shown in one colour on Chalk and on Iron Black. The 32px and 16px tiles are <b>real rasters</b>: each mark is drawn into a 32×32 "
        "or 16×16 canvas, so you see the pixels a favicon actually gets (the ×4 tile magnifies the 16px one). Below each: the lockup with "
        "the Hubot wordmark, the two-colour version, the stroke weights and gaps measured on the final outline, and the variants I tried and dropped.</p>")}
{"".join(cards)}
</section>"""


def section_scorecard():
    cols = ["One idea", "Memorable", "16px", "One colour", "Ownable", "Not AI-looking"]
    sym = {2: "●", 1: "◐", 0: "○"}
    rows = []
    for i, (k, n, fn) in enumerate(marks.CONCEPTS, 1):
        m = fn()
        sc = SCORE[k]
        thumb = svg_paths(mark_layers(m, True, INK), (0, 0, 120, 120))
        vcls, vlabel = CRIT[k]["verdict"]
        rows.append(f"<tr><td><b>{i:02d}</b>&nbsp; {n}</td><td class='m'>{thumb}</td>" +
                    "".join(f"<td class='dot'>{sym[v]}</td>" for v in sc) +
                    f"<td><b>{sum(sc)}</b>/12</td><td><span class='tag {vcls}'>{vlabel}</span></td></tr>")
    head = "<tr><th>Concept</th><th></th>" + "".join(f"<th>{c}</th>" for c in cols) + "<th>Total</th><th>Verdict</th></tr>"
    return f"""<section id="score">{sechead("03", "Critique, side by side",
        "<p>Each concept scored against the brief's two lists (● yes, ◐ partly, ○ no). Three earn refinement: the <b>Rack F</b> "
        "(ownable), the <b>Parallel</b> angle (precise) and the <b>Cradle</b> (robust). Three ideas are too good to waste and too generic "
        "to be the logo, so they become devices: bar-path traces, the haptic pulse and three-light verdicts.</p>")}
<div style="overflow-x:auto"><table class="score">{head}{''.join(rows)}</table></div>
</section>"""


# ════════════════════════════════════════════════════════ main

def main():
    sections = [section_typefaces(), section_concepts(), section_scorecard()]
    out = os.path.join(ROOT, "logo-explorations.html")
    with open(out, "w") as f:
        f.write(page(sections))
    print("wrote", out)


if __name__ == "__main__":
    main()
