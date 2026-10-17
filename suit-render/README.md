# FormGuard suit render

A Blender 5.2 scene of the FormGuard sensor suit: a long-sleeve compression shirt and full-length
compression tights, shown ghost-mannequin style on a dark studio sweep. Everything in the scene is
built by the Python scripts in `scripts/`, so it can be rebuilt and re-rendered at any time.

## Re-render

From the repo root:

```sh
# all five shots, final quality (2000 x 3000, 256 samples, 16-bit PNG) into FormGuard_Renders/
/Applications/Blender.app/Contents/MacOS/Blender -b suit-render/formguard_suit.blend \
  --python suit-render/scripts/render_all.py

# quick draft of two shots
/Applications/Blender.app/Contents/MacOS/Blender -b suit-render/formguard_suit.blend \
  --python suit-render/scripts/render_all.py -- --shots 01_shirt_front,05_suit_three_quarter_back --percent 25 --samples 32

# rebuild the whole suit from the body form after editing a script, render, and save the .blend
/Applications/Blender.app/Contents/MacOS/Blender -b suit-render/formguard_suit.blend \
  --python suit-render/scripts/render_all.py -- --rebuild --save
```

Options: `--shots`, `--samples`, `--percent`, `--out`, `--rebuild`, `--save`.

Shots: `01_shirt_front`, `02_shirt_back`, `03_tights_front`, `04_tights_back`, `05_suit_three_quarter_back`.

Inside the Blender UI, run `scripts/build_all.py` from the Text Editor to rebuild, then call
`FG_setup_shot("02_shirt_back")` in the Python console to frame a shot.

## Scripts

| File | What it builds |
| --- | --- |
| `fg_lib.py` | Helpers: hex colours, Principled materials, surface projection, curves, dashes. |
| `fg_scene.py` | Cycles, 256 samples, denoising, 2000 x 3000, AgX Medium High Contrast, world, all materials. |
| `fg_garments.py` | Shirt and tights cut from the body surface; Shrinkwrap 2 mm, Subdivision 2, Solidify 1.2 mm; rib neck, hem, cuffs, waistband. Landmark heights are at the top. |
| `fg_details.py` | Raglan, centre-back, yoke and gusset seams; tension wrinkles; 12 sensor pods; signal seams; controller; shirt tab. |
| `fg_logos.py` | Imports the brand SVGs, keeps their colours, scales uniformly, projects onto the fabric, extrudes 0.2 mm. |
| `fg_stage.py` | Sweep backdrop, key, rim and fill lights, 85 mm camera, ghost body, shot framing, exposure. |
| `build_all.py` | Runs all of the above in order. |
| `render_all.py` | Command-line renderer. |

## Sources and credits

- Body form: Blender Studio, Human Base Meshes bundle v1.4.1, realistic male body, CC0.
  Downloaded from https://www.blender.org/download/demo/asset-bundles/ into `source/download_hbm/`.
  Multires applied at level 1 (42k faces), scaled to 1.80 m. It is invisible to every render ray.
- Logos: `source/logos/` holds copies of `FormGuard-design-system/logos/formguard-stacked-reversed.svg` and
  `formguard-symbol-reversed.svg`, the current Rack F artwork. The files named in the original brief
  (`formguard-logo-stacked-reversed.svg`, `formguard-mark-reversed.svg`) are the retired dot-in-halo logo in
  `logos/deprecated/`. To use them instead, copy them into `source/logos/` and change the two file
  names at the bottom of `fg_logos.py`.

## Notes

- Light wattages follow the brief (key 400 W, rims 600 W, fill 40 W). The dark look comes from
  camera exposure -3.2 (`EXPOSURE` in `fg_stage.py`).
- Each shot rotates the camera, lights and backdrop around the garment. The floor sits 3 cm under the
  lowest point of what is shown, so every shot has a contact shadow.
- The camera stays at chest height (1.35 m) and uses a vertical lens shift to centre the garment, so
  verticals stay straight.
