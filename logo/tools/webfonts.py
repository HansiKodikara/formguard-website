"""Build the site's self-hosted web fonts from the OFL sources in logo/fonts.

Subsetting and axis-limiting make these Modified Versions under the OFL, and all three sources declare
Reserved Font Names ("Hubot", "Mona", "Plex"), so the outputs are renamed: FG Display / FG Text / FG Mono.
Copyright and licence name records are kept; each OFL.txt is copied next to the files.
"""
import os
import shutil
import sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "logo", "fonts")
OUT = os.path.join(ROOT, "public", "fonts")

UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x2010, 0x2028)) +
            [0x2030, 0x2032, 0x2033, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2264, 0x2265])
FEATURES = ["kern", "liga", "calt", "case", "tnum", "pnum", "lnum", "zero", "ss01", "ss02", "ss03", "ss04", "frac", "sups"]

JOBS = [
    # source, output, rename map, axis limits
    ("hubotsans/HubotSans[wdth,wght].ttf", "fg-display.woff2",
     {"Hubot Sans": "FG Display", "HubotSans": "FGDisplay", "Hubot": "FG"}, {"wght": (600, 900), "wdth": (100, 125)}),
    ("monasans/MonaSans[wdth,wght].ttf", "fg-text.woff2",
     {"Mona Sans": "FG Text", "MonaSans": "FGText", "Mona": "FG"}, {"wght": (380, 900), "wdth": (100, 125)}),
    ("ibmplexmono/IBMPlexMono-Regular.ttf", "fg-mono-400.woff2",
     {"IBM Plex Mono": "FG Mono", "IBMPlexMono": "FGMono", "Plex": "FG"}, None),
    ("ibmplexmono/IBMPlexMono-Medium.ttf", "fg-mono-500.woff2",
     {"IBM Plex Mono": "FG Mono", "IBMPlexMono": "FGMono", "Plex": "FG"}, None),
    ("ibmplexmono/IBMPlexMono-SemiBold.ttf", "fg-mono-600.woff2",
     {"IBM Plex Mono": "FG Mono", "IBMPlexMono": "FGMono", "Plex": "FG"}, None),
]
RENAME_IDS = {1, 3, 4, 6, 16, 17, 21, 22, 25}


def rename(font, mapping):
    for rec in font["name"].names:
        if rec.nameID in RENAME_IDS:
            s = rec.toUnicode()
            for a, b in mapping.items():
                s = s.replace(a, b)
            rec.string = s


def set_family(font, mapping):
    """Clean family naming after instancing: nameID 1/16 = family, 4 = full, 6/25 = PostScript."""
    family = next(v for k, v in mapping.items() if " " in k)
    ps = family.replace(" ", "")
    style = font["name"].getDebugName(17) or font["name"].getDebugName(2) or "Regular"
    if "fvar" in font:
        style = "Regular"
    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (2, 17):
            rec.string = style
        elif rec.nameID == 4:
            rec.string = f"{family} {style}".replace(" Regular", "") if style == "Regular" else f"{family} {style}"
        elif rec.nameID == 6:
            rec.string = f"{ps}-{style.replace(' ', '')}"
        elif rec.nameID == 25:
            rec.string = ps


def main():
    os.makedirs(OUT, exist_ok=True)
    for src, out, mapping, axes in JOBS:
        font = TTFont(os.path.join(SRC, src))
        before = os.path.getsize(os.path.join(SRC, src))
        opts = subset.Options()
        opts.layout_features = FEATURES
        opts.name_IDs = ["*"]
        opts.name_languages = ["*"]
        opts.notdef_outline = True
        opts.flavor = "woff2"
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        if axes:
            font = instancer.instantiateVariableFont(font, axes)
        rename(font, mapping)
        set_family(font, mapping)
        font.flavor = "woff2"
        font.save(os.path.join(OUT, out))
        fam = font["name"].getDebugName(1)
        leftover = [r.toUnicode() for r in font["name"].names if r.nameID in RENAME_IDS and any(k in r.toUnicode() for k in ("Hubot", "Mona", "Plex"))]
        print(f"{out:20s} {before // 1024:4d} KB → {os.path.getsize(os.path.join(OUT, out)) // 1024:3d} KB  family '{fam}'  glyphs {len(font.getGlyphOrder())}  leftover RFN: {leftover}")
    for d, lic in (("hubotsans", "OFL-FG-Display.txt"), ("monasans", "OFL-FG-Text.txt"), ("ibmplexmono", "OFL-FG-Mono.txt")):
        shutil.copy(os.path.join(SRC, d, "OFL.txt"), os.path.join(OUT, lic))


if __name__ == "__main__":
    sys.exit(main())
