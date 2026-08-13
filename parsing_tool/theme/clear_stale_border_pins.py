# -*- coding: utf-8 -*-
"""Drop tier-inline `BorderColor: #00000000` where the theme row no longer pins one.

    python parsing_tool/theme/clear_stale_border_pins.py            # review
    python parsing_tool/theme/clear_stale_border_pins.py --apply    # write

★ THE OTHER HALF OF THE rev-25.2 BORDER SWEEP. The designer's ruling (reply 05 Q1):

    absent BorderColor      the row YIELDS the channel to the state decorators — the same
                            grammar 441 rows already use for TextColor vs rarity
    transparent #00000000   a deliberate SUPPRESS, legal only with a `_border: "SUPPRESS…"`
                            annotation, so "no border wanted" is always distinguishable from
                            "no opinion"

25.2 swept the rows: 57 unannotated transparent pins deleted, 2 annotated suppressors kept.
But inline wins over the row, and inline carries its own copies — reseeded back when the rows
still pinned transparent. So the sweep only got half the tree: measured after porting 25.2,
137 of 442 Show blocks still pinned SetBorderColor, and 40 of those pins are inline
transparent.

While a block pins the channel, the five state decorators ([11001]-[11005]) cannot paint on
it — a corrupted item shows no red, a 6-link no green. That is the defect request 05 Q1 was
about; clearing the rows fixed 50 blocks, and these 40 are the remainder.

⚠️ DRIVEN BY THE ROW, NEVER BLANKET-CLEARED. A tier is only cleared when the row it actually
resolves to has no BorderColor of its own. Where the row pins transparent — the two annotated
suppressors, Corpses R2 and Oils R2 — the inline pin AGREES with the kit and is left alone.
Blanket-clearing would silently un-suppress exactly the two rows the designer marked.

⚠️ Non-transparent inline borders are never touched. Those are real authored marks (the house
white, the fossil green, the map blue) and say something the row does not.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json")
APPLY = "--apply" in sys.argv
TRANSPARENT = "#00000000"


def main():
    theme = json.load(io.open(THEME, encoding="utf-8"))
    cleared, kept, files = [], [], {}

    for dp, _, fn in os.walk(TD):
        for f in sorted(fn):
            if not f.endswith(".json"):
                continue
            path = os.path.join(dp, f)
            rel = os.path.relpath(path, TD).replace(os.sep, "/")
            doc = json.load(io.open(path, encoding="utf-8"),
                            object_pairs_hook=collections.OrderedDict)
            touched = False
            for cat, body in doc.items():
                if not isinstance(body, dict):
                    continue
                tcat = (body.get("_meta") or {}).get("theme_category") or cat
                rows = theme.get(tcat) or {}
                for tkey, tier in body.items():
                    if tkey == "_meta" or not isinstance(tier, dict):
                        continue
                    th = tier.get("theme") or {}
                    if th.get("BorderColor") != TRANSPARENT:
                        continue
                    row = rows.get("Tier %s" % th.get("Tier")) or {}
                    if "BorderColor" in row:
                        kept.append((rel, tkey, tcat, row["BorderColor"]))
                        continue
                    del th["BorderColor"]
                    cleared.append((rel, tkey, tcat))
                    touched = True
            if touched:
                files[path] = doc

    print("=== clear stale inline border pins ===")
    print("  cleared : %d   (row has no BorderColor -> inline pin was blocking the states)" % len(cleared))
    print("  kept    : %d   (row pins one too -> the kit means it)" % len(kept))
    print()
    by_cat = collections.Counter(c for _, _, c in cleared)
    for c, n in by_cat.most_common():
        print("   %-26s %d" % (c, n))
    if kept:
        print()
        print("  -- kept, row agrees --")
        for rel, tkey, tcat, bc in kept:
            print("     %-26s %-24s row=%s" % (tcat[:26], tkey[:24], bc))

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
