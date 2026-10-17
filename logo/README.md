# FormGuard logo workshop

Everything on `../logo-explorations.html` is generated from code. Nothing is hand-placed in a drawing app,
so every stroke weight, angle and kerning value can be checked and reproduced.

- `tools/fg.py`: exact geometry (circles, arcs, bars) → boolean-merged outlines (skia-pathops), outlined
  type via HarfBuzz, and `runs()`, which measures stroke weights on the *final* outline.
- `tools/wordmark.py`: typeface instances and the optical-gap analysis used to guide hand kerning.
- `tools/marks.py`: the mark concepts.
- `tools/build.py`: assembles `logo-explorations.html`.
- `tools/shot.mjs`: Playwright screenshots (`node shot.mjs <html> <png> --sel .css --scale 2`).
- `fonts/`: the OFL typefaces used (each with its OFL.txt).

Rebuild:

```sh
cd logo/tools
python3 -m venv .venv && .venv/bin/pip install fonttools uharfbuzz skia-pathops
npm install
.venv/bin/python -I build.py
```
