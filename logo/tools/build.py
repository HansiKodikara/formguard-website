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
import refined as RF  # noqa: E402
import mockups as MK  # noqa: E402

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
<style>{CSS}{MK.MOCK_CSS}{REFINED_CSS}</style></head>
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


# ════════════════════════════════════════════════════════ 04 refined

REFINED_CSS = """
.refined{border-top:2px solid var(--ink);padding:30px 0 40px}
.rhead{display:grid;grid-template-columns:44px 1fr;gap:4px 14px;margin-bottom:20px}
.rhead .n{font:800 34px/1 Mona;font-stretch:112%;color:var(--red);grid-row:span 2}
.rhead h3{font-size:26px}
.rhead p{margin:4px 0 0;font-size:16px;max-width:80ch}
.rgrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr);gap:14px}
.rgrid .sheet{background:#fff;outline:1px solid var(--rule);outline-offset:-1px;padding:6px}
.rgrid .sheet svg,.rgrid .master svg{width:100%;height:auto;display:block}
.rgrid .master{display:grid;place-items:center;padding:16%}
.lk{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;margin-top:14px}
.lk > div{display:grid;place-items:center;padding:34px 26px;min-height:150px}
.lk svg{max-width:100%;height:auto}
.lk .cap{font:500 10.5px ui-monospace,Menlo,monospace;color:var(--mute);justify-self:start;align-self:end;margin-top:10px}
.lk .on-iron .cap{color:#F2EDE499}
.pxrow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:14px}
.pxrow > div{padding:14px;display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}
.pxrow canvas{image-rendering:pixelated;display:block}
.pxrow .lbl{font:500 10.5px/1.3 ui-monospace,Menlo,monospace;color:var(--mute);width:100%}
.pxrow .on-iron .lbl{color:#F2EDE499}
.spec{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px 30px;margin-top:16px;font-size:13.5px}
.spec h6{font:700 10.5px/1 ui-monospace,Menlo,monospace;letter-spacing:.07em;text-transform:uppercase;color:var(--mute);margin:0 0 8px}
.spec ul{margin:0;padding-left:18px}
.choose{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.choose article{outline:1px solid var(--rule);outline-offset:-1px;display:flex;flex-direction:column}
.choose article.rec{outline:2px solid var(--ink);outline-offset:-2px}
.choose .sym{display:grid;place-items:center;padding:34px;background:var(--ink)}
.choose .sym svg{width:46%;height:auto}
.choose .lock{padding:22px 20px;display:grid;place-items:center;border-bottom:1px solid var(--rule)}
.choose .lock svg{max-width:100%;height:auto}
.choose .txt{padding:18px 20px 22px}
.choose .txt h3{display:flex;gap:10px;align-items:baseline;margin-bottom:8px}
.choose .txt p{font-size:14px;margin:0}
.recbox{margin-top:26px;padding:24px 26px;background:var(--ink);color:var(--chalk)}
.recbox h3{color:var(--chalk);margin-bottom:10px}
.recbox p{max-width:96ch;margin:0 0 10px}
@media (max-width:1100px){.rgrid,.lk,.pxrow,.spec,.choose{grid-template-columns:1fr}}
"""

ONE_LINERS = {
    "rack-f": "The F is a power rack holding the bar: the name's first letter, a lifter's tool and a joint in one shape. The most ownable.",
    "parallel": "The knee at parallel, measured. A precise, instrument-like mark for a brand that sells accuracy.",
    "cradle": "The bar held, never dropped. The simplest and boldest of the three, built to survive any size.",
}
LETTER = {"rack-f": "A", "parallel": "B", "cradle": "C"}


def kit(key):
    m = RF.MARKS[key]()
    hz = RF.lockup_initial(m) if key == "rack-f" else RF.lockup_horizontal(m, height_ratio=1.6, gap_ratio=0.7)
    st = RF.lockup_stacked(m, mark_ratio=3.2, gap_ratio=0.8)
    return {"key": key, "name": m.name, "mark": m, "px16": RF.PX[key](16), "px32": RF.PX[key](32), "hz": hz, "st": st}


def _lock_svg(L, ink, accent, width=None, height=None, pad_ratio=0.18):
    lay = [(L["ink"], ink), (L["accent"], accent), (L["word"], ink)]
    u = fg.union(L["ink"], L["word"], L["accent"]) if L["accent"] is not None else fg.union(L["ink"], L["word"])
    b = u.bounds
    p = L["cap"] * pad_ratio
    return svg_paths(lay, (b[0] - p, b[1] - p, b[2] + p, b[3] + p), width=width, height=height)


def construction_sheet(m):
    """Grid, construction circles, centres and the key dimensions, drawn from the mark's own dims."""
    R_, ink = RED, INK
    x0, y0, x1, y1 = -16, -16, 134, 120
    grid = []
    for v in range(0, 101, 10):
        w = .28 if v % 50 else .45
        grid.append(f'<line x1="{v}" y1="-4" x2="{v}" y2="104" stroke="{ink}" stroke-opacity=".10" stroke-width="{w}"/>')
        grid.append(f'<line x1="-4" y1="{v}" x2="104" y2="{v}" stroke="{ink}" stroke-opacity=".10" stroke-width="{w}"/>')
    body = f'<path d="{fg.d(m.one)}" fill="{ink}" fill-opacity=".09" stroke="{ink}" stroke-width=".42"/>'
    cons = []
    for c in m.construction:
        if c[0] == "circle":
            cons.append(f'<circle cx="{c[1]:g}" cy="{c[2]:g}" r="{c[3]:g}" fill="none" stroke="{R_}" stroke-width=".32" stroke-dasharray="1.2 1"/>')
        elif c[0] == "cross":
            cons.append(f'<path d="M{c[1]-2.2:g} {c[2]:g}h4.4M{c[1]:g} {c[2]-2.2:g}v4.4" stroke="{R_}" stroke-width=".4"/>')
        elif c[0] == "hline":
            cons.append(f'<line x1="-4" y1="{c[1]:g}" x2="104" y2="{c[1]:g}" stroke="{R_}" stroke-opacity=".55" stroke-width=".25" stroke-dasharray=".8 .8"/>')
        elif c[0] == "vline":
            cons.append(f'<line x1="{c[1]:g}" y1="-4" x2="{c[1]:g}" y2="104" stroke="{R_}" stroke-opacity=".55" stroke-width=".25" stroke-dasharray=".8 .8"/>')

    def t(x, y, s, anchor="middle"):
        return (f'<text x="{x:g}" y="{y:g}" font-family="ui-monospace,Menlo,monospace" font-size="3.3" '
                f'fill="{R_}" text-anchor="{anchor}">{html.escape(s)}</text>')

    def dh(xa, xb, y, s):
        return (f'<path d="M{xa:g} {y:g}H{xb:g}M{xa:g} {y-1.4:g}v2.8M{xb:g} {y-1.4:g}v2.8" stroke="{R_}" stroke-width=".3"/>'
                + t((xa + xb) / 2, y - 1.6, s))

    def dv(ya, yb, x, s):
        return (f'<path d="M{x:g} {ya:g}V{yb:g}M{x-1.4:g} {ya:g}h2.8M{x-1.4:g} {yb:g}h2.8" stroke="{R_}" stroke-width=".3"/>'
                + t(x + 2.2, (ya + yb) / 2 + 1.1, s, "start"))

    def rad(cx, cy, r, ang, s, lx=None, ly=None):
        ex, ey = fg.pt(cx, cy, r, ang)
        out = f'<line x1="{cx:g}" y1="{cy:g}" x2="{ex:.2f}" y2="{ey:.2f}" stroke="{R_}" stroke-width=".3"/>'
        lx = ex if lx is None else lx
        ly = ey if ly is None else ly
        return out + t(lx, ly, s)

    d = m.dims
    ann = []
    if m.key == "rack-f":
        cx, cy = d["centre"]
        ann += [dh(0, d["stem"], 106, f"stem {d['stem']:g}"), dh(0, d["top_arm"], -6, f"J-hook {d['top_arm']:g}"),
                dh(0, d["mid_arm"], 80, f"safety {d['mid_arm']:g}"),
                dv(0, d["arm"], 96, f"{d['arm']:g}"), dv(d["arm"], d["mid_arm_y"], 96, f"counter {d['counter']:g}"),
                dv(d["mid_arm_y"], d["mid_arm_y"] + d["arm"], 96, f"{d['arm']:g}"), dv(d["mid_arm_y"] + d["arm"], 100, 96, f"{100 - d['mid_arm_y'] - d['arm']:g}"),
                rad(cx, cy, d["socket_r"], 128, f"R {d['socket_r']:g}", cx - 21, cy - 19),
                rad(cx, cy, d["ball_r"], -38, f"bar r {d['ball_r']:g}", cx + 20, cy + 13),
                t(cx + 4, cy - d["ball_r"] - 1.3, f"gap {d['gap']:g}", "start")]
    elif m.key == "parallel":
        kx, ky = d["knee"]
        ann += [dh(0, d["shin"], 106, f"shin {d['shin']:g}"), dv(0, d["thigh"], 106, f"thigh {d['thigh']:g}"),
                rad(kx, ky, d["arc_r_out"], -45, f"r {d['arc_r_in']:g} / {d['arc_r_out']:g}", kx + 50, ky + 54),
                dv(d["thigh"], d["thigh"] + d["gap"], 60, f"gap {d['gap']:g}"),
                dh(d["shin"], d["shin"] + d["gap"], 62, ""), t(d["shin"] + 3, 67, f"gap {d['gap']:g}"),
                t(kx + 15, ky + 16, "90°"), dh(0, 100, -6, "100")]
    else:
        cx, cy = d["centre"]
        ann += [dh(0, d["stroke"], -6, f"stroke {d['stroke']:g}"), dh(80, 100, -6, f"{d['stroke']:g}"),
                rad(cx, cy, d["bowl_r"], -128, f"R {d['bowl_r']:g}", cx - 33, cy + 44),
                rad(cx, cy, d["inner_r"], -52, f"r {d['inner_r']:g}", cx + 25, cy + 30),
                rad(cx, cy, d["ball_r"], 90, f"bar r {d['ball_r']:g}", cx + 9, cy - 21),
                dh(cx - d["inner_r"], cx - d["ball_r"], cy, ""), t(cx - 25, cy - 2, f"gap {d['gap']:g}")]
    return (f'<svg viewBox="{x0} {y0} {x1 - x0} {y1 - y0}" xmlns="http://www.w3.org/2000/svg" role="img">'
            f'<title>{html.escape(m.name)} construction</title>{"".join(grid)}{body}{"".join(cons)}{"".join(ann)}</svg>')


def px_tile(p, fill, accent, px, css, two=True):
    body = (f'<path d="{fg.d(p.ink)}" fill="{fill}"/>' +
            (f'<path d="{fg.d(p.accent)}" fill="{accent if two else fill}"/>' if p.accent is not None else ""))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {px} {px}" width="{px}" height="{px}">{body}</svg>'
    return f'<canvas data-px="{px}" data-svg="{html.escape(svg, quote=True)}" style="width:{css}px;height:{css}px"></canvas>'


def refined_card(key):
    k = kit(key)
    m = k["mark"]
    master2 = svg_paths([(m.ink, INK), (m.accent, RED)], square_box(m.one, 0.02))
    master1 = svg_paths([(m.one, CHALK)], square_box(m.one, 0.02))
    hz_c = _lock_svg(k["hz"], INK, RED, width=520)
    hz_i = _lock_svg(k["hz"], CHALK, RED, width=420)
    st_c = _lock_svg(k["st"], INK, RED, height=190)
    p16, p32 = k["px16"], k["px32"]
    pxs = []
    for fill, cls in ((INK, "on-chalk"), (CHALK, "on-iron")):
        pxs.append(f'<div class="{cls}">{px_tile(p16, fill, RED, 16, 16)}{px_tile(p32, fill, RED, 32, 16)}{px_tile(p32, fill, RED, 32, 32)}'
                   f'<div class="lbl">16px cut · 32px cut at 16pt (Retina tab) · 32px cut</div></div>')
        pxs.append(f'<div class="{cls}">{px_tile(p16, fill, RED, 16, 64)}{raster({"ink": m.ink, "accent": m.accent}, 16, fill, 64)}'
                   f'<div class="lbl">16px: pixel cut vs master scaled (×4)</div></div>')
    checks = "".join(f"<li>{'✓' if ok else '✗'} {html.escape(lbl)}: {', '.join(f'{v:.3f}' for v in got) if got else 'clear (no ink)'}</li>"
                     for lbl, got, exp, ok in m.checks)
    hz_note = ("Drop-cap lockup: the symbol is the F of FORMGUARD, its stem weight-matched to the wordmark (1.00×) and "
               "baseline-aligned. The raised J-hook overhangs the O, and the O sits as far from the safety arm as it does from "
               "a regular F. No repeated F.") if key == "rack-f" else (
               "Symbol at 1.6× cap height, centred on the caps, gap 0.7 cap. The symbol's stroke is 1.18× the wordmark stem: "
               "at a strict 1.00× match it reads as an extra letter.")
    return f"""<article class="refined" id="r-{key}">
<div class="rhead"><span class="n">{LETTER[key]}</span><h3>{m.name}</h3><p>{ONE_LINERS[key]}</p></div>
<div class="rgrid"><div class="sheet">{construction_sheet(m)}</div><div class="master on-chalk">{master2}</div><div class="master on-iron">{master1}</div></div>
<div class="lk"><div class="on-chalk">{hz_c}<span class="cap">Horizontal lockup</span></div><div class="on-chalk">{st_c}<span class="cap">Stacked lockup</span></div></div>
<div class="lk"><div class="on-iron">{hz_i}<span class="cap">Horizontal, reversed</span></div><div class="on-iron">{_lock_svg(k["st"], CHALK, RED, height=150)}<span class="cap">Stacked, reversed</span></div></div>
<div class="pxrow">{"".join(pxs)}</div>
<div class="spec"><div><h6>Construction</h6><p>{spec_text(key, m)}</p><p>{hz_note}</p></div>
<div><h6>Measured on the final outline</h6><ul class="checks">{checks}</ul></div></div>
</article>"""


def spec_text(key, m):
    d = m.dims
    if key == "rack-f":
        return (f"100-unit height. Stem {d['stem']:g}; arms {d['arm']:g}, lighter by 10% so they look equal to the stem, matching "
                f"Hubot's own F. Counter {d['counter']:g}. The socket (R {d['socket_r']:g}) is tangent to the stem's inner edge and bites "
                f"{d['bite']:g} into each arm. The bar (r {d['ball_r']:g}) is concentric, so the gap is {d['gap']:g} everywhere. J-hook "
                f"{d['top_arm']:g} wide, safety {d['mid_arm']:g} (0.9 of the J-hook, like Hubot's F). Two-colour: only the bar is Plate Red.")
    if key == "parallel":
        return (f"100 × 100. Shin {d['shin']:g}, thigh {d['thigh']:g} (horizontal lightened 10% for optical equality). The arc is "
                f"centred on the knee, the intersection of the limbs' centre-lines, between r {d['arc_r_in']:g} and {d['arc_r_out']:g}. Its "
                f"ends are cut parallel to the limbs at a constant {d['gap']:g}-unit gap. Symmetric about the 45° diagonal.")
    return (f"100 × 100. Stroke {d['stroke']:g}; the bowl is a true semicircle (R {d['bowl_r']:g}, r {d['inner_r']:g}). The bar "
            f"(r {d['ball_r']:g}) is concentric, so the gap is {d['gap']:g} all round. Ratios: bar ⌀ = 2 × stroke, gap = ½ × stroke.")


def section_refined():
    cards = "".join(refined_card(k) for k in ("rack-f", "parallel", "cradle"))
    fc = W.face(W.FINAL["key"], **W.FINAL["var"])
    ov, a = W.level_overrides(fc)
    word, _ = RF.wordmark(100)
    b = word.bounds
    lv = fg.rect(b[0] - 6, -a["r_join"] / fc.cap * 100 - 0.35, b[2] - b[0] + 12, 0.7)
    kern = " · ".join(f"{p} {v:+d}" for p, v in W.FINAL["kern"].items())
    wm = svg_paths([(word, INK), (lv, RED)], (b[0] - 6, -112, b[2] + 6, 12), width=760)
    return f"""<section id="refined">{sechead("04", "Refined: the three",
        "<p>Clean geometry, final weights and kerned lockups. All three share one wordmark: <b>Hubot Sans 760 at width 110</b>, "
        "tracked +4.5% of cap height and hand-kerned. The F's middle arm and the G's bar are moved onto the R's bowl join, so the word holds "
        "one level, which is the faint red line below. Each mark comes with pixel-drawn 16px and 32px cuts, because a master scaled down "
        "to 16px turns to mush. Compare the ×4 tiles.</p>")}
<div class="on-chalk" style="padding:30px 26px;margin-bottom:10px;display:grid;place-items:center">{wm}</div>
<p class="mono mute" style="margin-bottom:24px">Kerning on top of the font's own (units/1000 em): {kern} · level line at {a['r_join']:.2f}/{fc.cap:g} of cap height (F arm, R join, G bar measured identical to 0.01 unit)</p>
{cards}
</section>"""


def section_contexts():
    kits = [kit(k) for k in ("rack-f", "parallel", "cradle")]
    def row(title, note, fn):
        cols = "".join(f'<div><h5>{LETTER[k["key"]]} · {k["name"]}</h5>{fn(k)}</div>' for k in kits)
        return f'<div class="ctxhead"><h3>{title}</h3><p>{note}</p></div><div class="ctx">{cols}</div>'

    def tab(k):
        z = (f'<div class="favzoom">{px_tile(k["px16"], INK, RED, 16, 64)}{px_tile(k["px32"], INK, RED, 32, 64)}'
             f'<span>16px and 32px favicons, ×4 and ×2</span></div>')
        return MK.browser_tab(k, "light") + '<div style="height:10px"></div>' + MK.browser_tab(k, "dark") + z

    def icon(k):
        return MK.home_screen(k)

    def suit(k):
        return f'<div class="suitbox">{MK.suit(k)}</div>'

    def post(k):
        return f'<div class="posterbox">{MK.poster(k)}</div>'

    heads = "".join(f'<h5 style="margin-top:22px">{LETTER[k["key"]]} · {k["name"]}</h5>{MK.web_header(k)}' for k in kits)
    return f"""<section id="context">{sechead("05", "In context",
        "<p>The same five templates for each mark: a browser tab (light and dark, favicon drawn at real pixels), an app icon, the chest "
        "of a black compression suit (flat, front; one sensor node flagged red), a gym poster, and a website header. Flat and honest: no "
        "fake photography, no shadows.</p>")}
{row("Favicon in a browser tab", "Real 16pt tab size. On a Retina screen the browser uses the 32px cut.", tab)}
{row("App icon", "Home screen at 60pt; the icon at 180, 120 and 60px.", icon)}
{row("On the suit", "Centre chest, one colour, Chalk on Iron Black. The red dot is a sensor node buzzing at the left elbow.", suit)}
{row("Gym poster", "A2 portrait, Iron Black. The symbol at full strength, the headline set in Hubot 800.", post)}
<div class="ctxhead"><h3>Website header</h3><p>Identical page, only the lockup changes.</p></div>{heads}
</section>"""


def section_choose():
    kits = [kit(k) for k in ("rack-f", "parallel", "cradle")]
    cards = []
    for k in kits:
        m = k["mark"]
        sym = svg_paths([(m.ink, CHALK), (m.accent, RED)], square_box(m.one, 0.02))
        lock = _lock_svg(k["hz"], INK, RED, width=330)
        rec = k["key"] == "rack-f"
        tag = '<span class="tag lead">Recommended</span>' if rec else ""
        cards.append(f"""<article class="{'rec' if rec else ''}"><div class="sym">{sym}</div><div class="lock">{lock}</div>
<div class="txt"><h3>{LETTER[k['key']]} · {m.name} {tag}</h3><p>{ONE_LINERS[k['key']]}</p></div></article>""")
    return f"""<section id="choose">{sechead("06", "Choose",
        "<p>Three directions, one wordmark. Pick one, or tell me what to push. Nothing is final until you do.</p>")}
<div class="choose">{''.join(cards)}</div>
<div class="recbox"><h3>Recommendation: A, Rack F</h3>
<p>It's the only one of the three that couldn't belong to another company. It comes from the name's first letter, says "guard" through a
lifter's own equipment rather than a shield, and has real anatomy: rack, joint, bar. The drop-cap lockup makes the symbol the first letter of the
wordmark, so mark and word are literally one design. Its pixel cuts hold from a 16px tab to the chest of the suit.</p>
<p><b>What it asks of us:</b> always use the master artwork (the socket is a precise detail), use the pixel cuts below 48px, and keep red for the bar alone.
<b>Parallel</b> is the safer, more abstract instrument. <b>Cradle</b> is the most robust but the least ownable.</p></div>
</section>"""


# ════════════════════════════════════════════════════════ main

def main():
    sections = [section_typefaces(), section_concepts(), section_scorecard(), section_refined(), section_contexts(), section_choose()]
    out = os.path.join(ROOT, "logo-explorations.html")
    with open(out, "w") as f:
        f.write(page(sections))
    print("wrote", out)


if __name__ == "__main__":
    main()
