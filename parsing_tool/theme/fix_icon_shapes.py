# -*- coding: utf-8 -*-
"""Give every block its FAMILY's minimap shape back.

    python parsing_tool/theme/fix_icon_shapes.py            # review
    python parsing_tool/theme/fix_icon_shapes.py --apply    # write

★ THE GRAMMAR, and why it was worth fixing. The designer's kit assigns exactly one shape per
accent — currency Diamond, maps Square, scarabs Hexagon, uniques Star, gems Kite, flasks
Raindrop, jewels Cross — so a minimap icon carries TWO independent facts:

    shape -> which family this is
    size  -> how it ranks   (0 largest .. 2 smallest)

What was actually emitted still carried the pre-designer convention, where Star and Diamond
meant "important" rather than naming a family. So the top tier of several families borrowed
the uniques Star or the currency Diamond and stopped saying what it was — spending the shape
channel on rank, which size already carries, at exactly the tiers where telling a map from a
unique matters most. Author, from game: *"for icons, i found map are not using squares, is
that intended?"* It was not; 势力地图 and 瓦尔密殿 wore a white Star and T16 wore a red Diamond.

⚠️ SHAPE ONLY. Size and colour are left exactly as they are — size is rank and the author
tunes it (`fix_icon_sizes.py` derives it from the rung), and colour is the accent's business.
A blind rewrite of all three would undo both.

⚠️ FAMILIES WITH NO SHAPE ARE SKIPPED, NOT BLANKED. `equipment`, `vendor` and `gold` carry
`shape: null` and `icon_floor: none` — they are meant to have no icon at all, which is a
different decision from having the wrong one, and not this tool's to make.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HANDOFF = os.path.join(ROOT, "docs", "design", "handoff")
DATA = os.path.join(ROOT, "filter_generation", "data")
APPLY = "--apply" in sys.argv

presets = json.load(io.open(os.path.join(HANDOFF, "theme-presets.json"), encoding="utf-8"))
amap = json.load(io.open(os.path.join(HANDOFF, "accent-category-map.json"), encoding="utf-8"))
SHAPE = {a: v.get("shape") for a, v in (presets.get("accents") or {}).items()
         if isinstance(v, dict)}
CAT_ACCENT = amap.get("accent_by_category") or {}


def wanted(theme_category):
    a = CAT_ACCENT.get(theme_category)
    s = SHAPE.get(a) if a else None
    return s if s and s != "None" else None


def retag(value, want):
    """'0 White Star' -> '0 White Square'. Size and colour untouched; None if not applicable."""
    if not isinstance(value, str):
        return None
    p = value.split()
    if len(p) != 3 or not re.fullmatch(r"[0-2]", p[0]):
        return None            # malformed or a sentinel — leave it for the validator
    if p[2] == want:
        return None
    return "%s %s %s" % (p[0], p[1], want)


def main():
    changed, kept = [], collections.Counter()
    files = {}
    for sub in ("tier_definition", "base_mapping"):
        root = os.path.join(DATA, sub)
        for dp, _d, fs in os.walk(root):
            for fn in sorted(fs):
                if not fn.endswith(".json"):
                    continue
                path = os.path.join(dp, fn)
                rel = "%s/%s" % (sub, os.path.relpath(path, root).replace("\\", "/"))
                try:
                    doc = json.load(io.open(path, encoding="utf-8"),
                                    object_pairs_hook=collections.OrderedDict)
                except Exception:
                    continue

                # the theme category this file's blocks belong to
                tcs = []
                if sub == "base_mapping":
                    tcs = [((doc.get("_meta") or {}).get("theme_category"), doc)]
                else:
                    for cat, body in doc.items():
                        if cat.startswith("//") or not isinstance(body, dict):
                            continue
                        tcs.append(((body.get("_meta") or {}).get("theme_category") or cat, body))

                dirty = False
                for tc, node in tcs:
                    want = wanted(tc) if tc else None
                    if not want:
                        if tc:
                            kept[tc] += 1
                        continue

                    def walk(o):
                        nonlocal dirty
                        if isinstance(o, dict):
                            for k, v in list(o.items()):
                                if k == "MinimapIcon":
                                    new = retag(v, want)
                                    if new:
                                        changed.append((rel, tc, v, new))
                                        o[k] = new
                                        dirty = True
                                else:
                                    walk(v)
                        elif isinstance(o, list):
                            for v in o:
                                walk(v)

                    walk(node)
                if dirty:
                    files[path] = doc

    print("=== icon shapes vs the family grammar ===")
    print("  shapes rewritten : %d  in %d files" % (len(changed), len(files)))
    print("  categories skipped (accent has no shape) : %d" % len(kept))
    print()
    print("  %-40s %-18s %-22s %s" % ("file", "theme category", "was", "now"))
    print("  " + "-" * 100)
    for rel, tc, was, now in changed:
        print("  %-40s %-18s %-22s %s" % (rel[-40:], tc[:18], was, now))

    if APPLY:
        for path, doc in files.items():
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        print()
        print("written: %d files" % len(files))
    else:
        print()
        print("(review only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
