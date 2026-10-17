"""Step 0 of the website session: export the chosen Rack F identity exactly as refined.

Nothing here draws new geometry. Every path comes from refined.py / wordmark.py, the same
functions that produced logo-explorations.html (section 04, A · Rack F).

Writes:
  brand/svg/…            lockups, symbol, stacked, pixel cuts × colourways
  brand/favicon/…        favicon.svg (light/dark aware), apple-touch-icon + 512 sources (PNG via rasterize.mjs)
  src/brand/logo-data.ts the same path data for the single <Logo> component
  brand/manifest.json    list of PNGs for rasterize.mjs to render (1x/2x, favicons)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

import fg  # noqa: E402
import wordmark as W  # noqa: E402

W.FONTS = os.path.join(ROOT, "logo", "fonts")
import refined as R  # noqa: E402

INK, RED, CHALK = R.INK, R.RED, R.CHALK
BRAND = os.path.join(ROOT, "brand")
SVG = os.path.join(BRAND, "svg")
FAV = os.path.join(BRAND, "favicon")
TS = os.path.join(ROOT, "src", "brand", "logo-data.ts")

# Colourways. Plate Red is only ever the bar; one-colour versions are Iron or Chalk, never all red.
TONES = {
    "primary": (INK, RED),     # on Chalk / light backgrounds
    "reversed": (CHALK, RED),  # on Iron Black / dark backgrounds
    "iron": (INK, INK),        # one colour, Iron Black
    "chalk": (CHALK, CHALK),   # one colour, Chalk
}


def nice(v):
    return float(f"{v:.3f}")


def normalise(parts):
    """Translate parts so the tight bounds start at (0, 0). Returns (parts, (w, h))."""
    u = fg.union(*[p for p in parts.values() if p is not None])
    x0, y0, x1, y1 = u.bounds
    out = {k: (fg.translate(p, -x0, -y0) if p is not None else None) for k, p in parts.items()}
    return out, (nice(x1 - x0), nice(y1 - y0))


def svg_doc(title, w, h, layers):
    body = "\n".join(f'  <path fill="{fill}" d="{fg.d(p)}"/>' for p, fill in layers if p is not None)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}">\n'
            f'  <title>{title}</title>\n{body}\n</svg>\n')


def main():
    os.makedirs(SVG, exist_ok=True)
    os.makedirs(FAV, exist_ok=True)
    os.makedirs(os.path.dirname(TS), exist_ok=True)

    m = R.rack_f()                              # the refined master (H = 100)
    L = R.lockup_initial(m)                     # drop-cap horizontal lockup
    S = R.lockup_stacked(m, mark_ratio=3.2, gap_ratio=0.8)
    p16, p32 = R.rack_f_px(16), R.rack_f_px(32)

    # a mark is two layers: "ink" (everything except the bar) and "bar" (the Plate Red bar)
    art = {
        "lockup": normalise({"ink": fg.union(L["ink"], L["word"]), "bar": L["accent"]}),
        "symbol": normalise({"ink": m.ink, "bar": m.accent}),
        "stacked": normalise({"ink": fg.union(S["ink"], S["word"]), "bar": S["accent"]}),
    }
    # pixel cuts keep their pixel grid (the 1px / 2px margins are part of the design)
    art["symbol-16"] = ({"ink": p16.ink, "bar": p16.accent}, (16.0, 16.0))
    art["symbol-32"] = ({"ink": p32.ink, "bar": p32.accent}, (32.0, 32.0))

    titles = {"lockup": "FormGuard", "symbol": "FormGuard symbol", "stacked": "FormGuard",
              "symbol-16": "FormGuard symbol, 16px cut", "symbol-32": "FormGuard symbol, 32px cut"}
    manifest = []
    for name, (parts, (w, h)) in art.items():
        for tone, (ink, bar) in TONES.items():
            fn = f"formguard-{name}-{tone}.svg"
            with open(os.path.join(SVG, fn), "w") as f:
                f.write(svg_doc(titles[name], w, h, [(parts["ink"], ink), (parts["bar"], bar)]))
            if name.startswith("symbol-"):
                px = int(w)
                manifest.append({"svg": f"svg/{fn}", "png": f"png/{fn[:-4]}.png", "w": px, "h": px})
            else:
                # PNG at a practical display size: lockup 320px wide, symbol 256px tall, stacked 400px wide
                if name == "lockup":
                    pw = 320; ph = round(320 * h / w)
                elif name == "symbol":
                    ph = 256; pw = round(256 * w / h)
                else:
                    pw = 400; ph = round(400 * h / w)
                for scale in (1, 2):
                    manifest.append({"svg": f"svg/{fn}", "png": f"png/{fn[:-4]}@{scale}x.png", "w": pw * scale, "h": ph * scale})

    # ---- favicons ------------------------------------------------------------------------
    # favicon.svg: the 32px pixel cut (what Retina tabs actually show), Iron on light tabs, Chalk on dark.
    ink32 = fg.d(p32.ink)
    bar32 = fg.d(p32.accent)
    favsvg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
              f'  <style>.i{{fill:{INK}}}@media (prefers-color-scheme:dark){{.i{{fill:{CHALK}}}}}</style>\n'
              f'  <path class="i" d="{ink32}"/>\n  <path fill="{RED}" d="{bar32}"/>\n</svg>\n')
    with open(os.path.join(FAV, "favicon.svg"), "w") as f:
        f.write(favsvg)
    # touch / app icons: master artwork (above 48px), Chalk symbol + red bar on a full-bleed Iron square
    sym, (sw, sh) = art["symbol"]
    for size, fn in ((180, "apple-touch-icon"), (512, "icon-512")):
        gh = size * 0.56
        k = gh / sh
        x = (size - sw * k) / 2
        y = (size - gh) / 2
        ink = fg.xform(sym["ink"], k, 0, 0, k, x, y)
        bar = fg.xform(sym["bar"], k, 0, 0, k, x, y)
        doc = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">\n'
               f'  <rect width="{size}" height="{size}" fill="{INK}"/>\n'
               f'  <path fill="{CHALK}" d="{fg.d(ink)}"/>\n  <path fill="{RED}" d="{fg.d(bar)}"/>\n</svg>\n')
        with open(os.path.join(FAV, fn + ".svg"), "w") as f:
            f.write(doc)
        manifest.append({"svg": f"favicon/{fn}.svg", "png": f"favicon/{fn}.png", "w": size, "h": size})
    manifest.append({"svg": "svg/formguard-symbol-32-primary.svg", "png": "favicon/favicon-32.png", "w": 32, "h": 32})
    manifest.append({"svg": "svg/formguard-symbol-16-primary.svg", "png": "favicon/favicon-16.png", "w": 16, "h": 16})

    with open(os.path.join(BRAND, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)

    # ---- data for the one <Logo> component ---------------------------------------------
    entries = []
    for name, (parts, (w, h)) in art.items():
        key = name.replace("-", "")
        entries.append(f'  {key}: {{ w: {w:g}, h: {h:g}, ink: "{fg.d(parts["ink"])}", bar: "{fg.d(parts["bar"])}" }},')
    lockup_w, lockup_h = art["lockup"][1]
    sym_w, sym_h = art["symbol"][1]
    clear = 2 * m.dims["ball_r"]                # clear space unit: the bar's diameter
    ts = f"""// GENERATED by logo/tools/export_brand.py — do not edit by hand.
// Path data for the FormGuard identity (A · Rack F), exactly as refined in logo-explorations.html.
// "ink" is everything except the bar; "bar" is the Plate Red bar (the only red in the logo).

export const LOGO = {{
{chr(10).join(entries)}
}} as const;

/** Clear space = the bar's diameter, as a fraction of the symbol's height. */
export const CLEAR_SPACE_OF_SYMBOL_HEIGHT = {clear / sym_h:.4f};
/** The symbol (the F) is this fraction of the drop-cap lockup's height. */
export const SYMBOL_HEIGHT_IN_LOCKUP = {nice(L['mark_h'] / lockup_h * 1):.4f};
export const COLORS = {{ iron: "{INK}", chalk: "{CHALK}", red: "{RED}" }} as const;
"""
    with open(TS, "w") as f:
        f.write(ts)

    print(f"lockup {lockup_w}×{lockup_h}  symbol {sym_w}×{sym_h}  stacked {art['stacked'][1]}")
    print(f"{len(os.listdir(SVG))} SVGs, {len(manifest)} PNG jobs, logo-data.ts written")
    print(f"clear space unit (bar ⌀) = {clear:g} of symbol height {sym_h:g} = {clear / sym_h:.3f}")


if __name__ == "__main__":
    main()
