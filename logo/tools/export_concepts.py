"""Step 2: export every mark concept as clean SVG (one-colour + two-colour) and run its geometry checks."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fg      # noqa: E402
import marks   # noqa: E402

INK, RED = "#1B1A17", "#C62B22"
OUT = os.path.join(HERE, "..", "svg", "concepts")


def svg(title, layers):
    paths = "\n".join(f'  <path fill="{fill}" d="{fg.d(p)}"/>' for p, fill in layers if p is not None)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">\n'
            f'  <title>{title}</title>\n{paths}\n</svg>\n')


def main():
    os.makedirs(OUT, exist_ok=True)
    failed = 0
    for i, (key, name, fn) in enumerate(marks.CONCEPTS, 1):
        m = fn()
        one = fg.union(m["ink"], m["accent"]) if m["accent"] is not None else m["ink"]
        base = f"{i:02d}-{key}"
        with open(os.path.join(OUT, base + ".svg"), "w") as f:
            f.write(svg(f"FormGuard concept {i:02d}: {name}", [(one, INK)]))
        with open(os.path.join(OUT, base + "-red.svg"), "w") as f:
            f.write(svg(f"FormGuard concept {i:02d}: {name} (two-colour)", [(m["ink"], INK), (m["accent"], RED)]))
        for label, got, expect, ok in m["checks"]:
            failed += not ok
            print(f"{'✓' if ok else '✗'} {base:14s} {label:42s} measured {got} expected {expect}")
    print(f"\n{len(marks.CONCEPTS)} concepts exported to {os.path.relpath(OUT)}; {failed} failed checks")
    return failed


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
