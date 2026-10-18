#!/bin/sh
# The squat stills for 'How it works' (phones, reduced motion, and the video's poster): the key moment of steps 1-4
# from the composited video frames (suit-render/squat-video/encode_squat.py), as WebP into public/squat/. The video
# itself (public/squat/squat.mp4) is written by encode_squat.py.
#   sh scripts/squat-frames.sh
set -e
SRC=suit-render/squat-video/renders/video/stills
OUT=public/squat
mkdir -p "$OUT"
rm -f "$OUT"/*.webp
for f in "$SRC"/still-*.png; do
  cwebp -quiet -q 78 -sharp_yuv -metadata none -resize 720 0 "$f" -o "$OUT/$(basename "$f" .png).webp"
done
echo "$(ls "$OUT" | wc -l | tr -d ' ') files, $(du -sh "$OUT" | cut -f1)"
