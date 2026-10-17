#!/bin/sh
# Web versions of the suit renders: 8-bit WebP at 400, 800 and 1600 px wide into public/suit/.
# The originals in suit-render/FormGuard_Renders/ are only read, never changed.
#   sh scripts/suit-images.sh
set -e
SRC=suit-render/FormGuard_Renders
OUT=public/suit
mkdir -p "$OUT"
for f in "$SRC"/*.png; do
  name=$(basename "$f" .png)
  for w in 400 800 1600; do
    cwebp -quiet -q 84 -sharp_yuv -metadata none -resize "$w" 0 "$f" -o "$OUT/$name-$w.webp"
  done
  echo "$name"
done
