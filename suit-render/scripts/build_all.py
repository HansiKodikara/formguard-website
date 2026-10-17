"""Run inside Blender: rebuilds the whole FormGuard suit scene from Body_Form."""
import bpy, time
FG_ROOT = globals().get("FG_ROOT") or "/Users/lehangajanayake/Projects/formguard-website/suit-render"
_S = FG_ROOT + "/scripts/"
_G = globals(); _G['FG_ROOT'] = FG_ROOT
_t = time.time()
for _f in ("fg_lib.py", "fg_scene.py", "fg_garments.py", "fg_details.py", "fg_logos.py", "fg_stage.py"):
    exec(open(_S + _f).read(), _G)
print("build_all done in", round(time.time() - _t, 1), "s")
