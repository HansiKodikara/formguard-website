#!/bin/sh
# Web versions of the suit renders the site uses (the 3D viewer's stand-ins): 8-bit WebP at 400, 800 and
# 1600 px wide into public/suit/.
# The originals in suit-render/FormGuard_Renders/ are only read, never changed.
#   sh scripts/suit-images.sh
set -e
SRC=suit-render/FormGuard_Renders
OUT=public/suit
mkdir -p "$OUT"
for name in 07_body_three_quarter_front 05_suit_three_quarter_back; do
  f="$SRC/$name.png"
  for w in 400 800 1600; do
    cwebp -quiet -q 84 -sharp_yuv -metadata none -resize "$w" 0 "$f" -o "$OUT/$name-$w.webp"
  done
  echo "$name"
done
