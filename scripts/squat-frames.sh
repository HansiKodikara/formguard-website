#!/bin/sh
# Web frames of the squat render (suit-render/squat-video/renders, from render_squat.py): 8-bit WebP at 720 and
# 450 px wide into public/squat/, for the scroll in 'How it works'. The PNGs are only read.
#   sh scripts/squat-frames.sh
set -e
SRC=suit-render/squat-video/renders
OUT=public/squat
mkdir -p "$OUT"
for f in "$SRC"/squat-*.png; do
  n=$(basename "$f" .png | sed 's/squat-//')
  for w in 720 450; do
    cwebp -quiet -q 80 -sharp_yuv -metadata none -resize "$w" 0 "$f" -o "$OUT/$w-$n.webp"
  done
done
echo "$(ls "$OUT" | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"
