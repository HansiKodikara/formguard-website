"""Real-world materials for the gym, sized for the web.

    scripts/figure/.venv/bin/python scripts/figure/export_textures.py

Sources (all CC0), downloaded into scripts/figure/cache/tex-src/:
  ambientCG  https://ambientcg.com — WoodFloor062, Rubber001, Rubber004, Metal009, Metal027, Leather026,
             Fabric062 (1K-JPG), e.g. https://ambientcg.com/get?file=WoodFloor062_1K-JPG.zip
  Poly Haven https://polyhaven.com/a/brown_photostudio_02 — the 1k .hdr, for image-based light

Writes public/textures/gym/<name>-{color,normal,orm}.webp (orm: R ambient occlusion · G roughness ·
B metalness, the channels three.js reads), a generated knurl normal map, and public/env/studio.hdr
(the HDRI halved to 512×256, RLE RGBE).
"""
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "cache", "tex-src")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "textures", "gym")
ENV = os.path.join(ROOT, "public", "env")

# site name: (ambientCG id, colour/normal size, orm size)
MATERIALS = {
    "wood": ("WoodFloor062", 1024, 512),
    "rubber": ("Rubber001", 512, 256),
    "plate": ("Rubber004", 512, 256),
    "steel": ("Metal009", 512, 256),
    "powder": ("Metal027", 512, 256),
    "leather": ("Leather026", 512, 256),
    "fabric": ("Fabric062", 512, 512),
}


def webp(im, path, quality=84):
    im.save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path) // 1024


def map_of(aid, kind):
    p = os.path.join(SRC, aid, f"{aid}_1K-JPG_{kind}.jpg")
    return Image.open(p) if os.path.exists(p) else None


def materials():
    os.makedirs(OUT, exist_ok=True)
    for name, (aid, size, orm_size) in MATERIALS.items():
        color = map_of(aid, "Color").convert("RGB").resize((size, size), Image.LANCZOS)
        normal = map_of(aid, "NormalGL").convert("RGB").resize((size, size), Image.LANCZOS)
        def chan(kind, default):
            m = map_of(aid, kind)
            if m is None:
                return Image.new("L", (orm_size, orm_size), default)
            return m.convert("L").resize((orm_size, orm_size), Image.LANCZOS)
        orm = Image.merge("RGB", (chan("AmbientOcclusion", 255), chan("Roughness", 128), chan("Metalness", 0)))
        kb = (webp(color, os.path.join(OUT, f"{name}-color.webp")),
              webp(normal, os.path.join(OUT, f"{name}-normal.webp"), 90),
              webp(orm, os.path.join(OUT, f"{name}-orm.webp"), 88))
        print(f"  {name:8s} {aid:13s} color {kb[0]:4d} KB  normal {kb[1]:4d} KB  orm {kb[2]:4d} KB")


def knurl(size=128, cells=8, depth=5.0):
    """A bar's knurling: two helical grooves crossing, leaving a field of small diamonds. Tiles."""
    y, x = np.mgrid[0:size, 0:size] / size * cells
    tri = lambda t: 1 - 2 * np.abs(t - np.floor(t) - 0.5)
    h = np.minimum(tri(x + y), tri(x - y))
    h = np.clip(h * 1.25, 0, 1)                               # flat tops on the diamonds
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * depth
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * depth
    n = np.stack([-gx, gy, np.ones_like(h)], -1)              # OpenGL: +Y up
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    im = Image.fromarray(((n * 0.5 + 0.5) * 255).round().astype(np.uint8))
    print(f"  knurl    generated      normal {webp(im, os.path.join(OUT, 'knurl-normal.webp'), 92):4d} KB")


# ── Radiance RGBE ───────────────────────────────────────────────────────────────────────

def read_hdr(path):
    data = open(path, "rb").read()
    i = data.index(b"\n\n") + 2
    j = data.index(b"\n", i)
    _, H, _, W = data[i:j].decode().split()
    H, W = int(H), int(W)
    pos = j + 1
    img = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        if data[pos] == 2 and data[pos + 1] == 2 and ((data[pos + 2] << 8) | data[pos + 3]) == W:
            pos += 4
            for c in range(4):
                x = 0
                while x < W:
                    n = data[pos]; pos += 1
                    if n > 128:
                        n -= 128
                        img[y, x:x + n, c] = data[pos]; pos += 1
                    else:
                        img[y, x:x + n, c] = np.frombuffer(data, np.uint8, n, pos); pos += n
                    x += n
        else:
            img[y] = np.frombuffer(data, np.uint8, W * 4, pos).reshape(W, 4); pos += W * 4
    e = img[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return (img[..., :3].astype(np.float64) + 0.5) * f[..., None]


def _rle(row):
    out, i, n = bytearray(), 0, len(row)
    while i < n:
        j = i
        while j < n and j - i < 127 and row[j] == row[i]:
            j += 1
        if j - i >= 4:
            out += bytes([128 + j - i, row[i]]); i = j
            continue
        k = i
        while k < n and k - i < 128:
            r = 1
            while k + r < n and r < 4 and row[k + r] == row[k]:
                r += 1
            if r >= 4:
                break
            k += 1
        out += bytes([k - i]) + bytes(row[i:k]); i = k
    return out


def write_hdr(path, rgb):
    H, W, _ = rgb.shape
    m = rgb.max(-1)
    mant, exp = np.frexp(m)
    scale = np.where(m > 1e-32, mant * 256.0 / np.maximum(m, 1e-32), 0)
    rgbe = np.zeros((H, W, 4), np.uint8)
    rgbe[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(m > 1e-32, exp + 128, 0).astype(np.uint8)
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n" + f"-Y {H} +X {W}\n".encode())
        for y in range(H):
            f.write(bytes([2, 2, W >> 8, W & 255]))
            for c in range(4):
                f.write(_rle(rgbe[y, :, c]))


def environment():
    os.makedirs(ENV, exist_ok=True)
    rgb = read_hdr(os.path.join(SRC, "brown_photostudio_02_1k.hdr"))
    H, W, _ = rgb.shape
    half = rgb.reshape(H // 2, 2, W // 2, 2, 3).mean((1, 3))
    out = os.path.join(ENV, "studio.hdr")
    write_hdr(out, half)
    print(f"  env      brown_photostudio_02 → {half.shape[1]}×{half.shape[0]}  {os.path.getsize(out) // 1024} KB  "
          f"(mean {half.mean():.2f}, max {half.max():.1f})")


if __name__ == "__main__":
    materials()
    knurl()
    environment()
