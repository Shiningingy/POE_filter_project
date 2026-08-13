# -*- coding: utf-8 -*-
"""Replace retired icon shapes with the shape the kit assigns that category.

    python parsing_tool/theme/apply_icon_shapes.py            # review
    python parsing_tool/theme/apply_icon_shapes.py --apply    # write

rev 25.2 `shapes_by_category` binds SHAPE TO ITEM CATEGORY, so a player can tell what is on
the ground at a glance, and reply 05 Q2 retires the three shapes that predate it:

    Circle            was the rev-23 band grammar; rev 24 moved currency-kin to Diamond
    UpsideDownHouse   pre-kit
    Pentagon          pre-kit

Rule, their words: *any shape not in `shapes_by_category` is invalid; replace on sight.*

★ ONLY WHERE THE KIT NAMES THE CATEGORY. This script is a LOOKUP, never an inference.
Replacing a shape in a category the table names is reading the table. Replacing one in a
category it never mentions is a guess, and guessing shapes from tree usage is precisely what
caused a reverted pass (`0573c7b`, reverted in `d155a60`): 21 correct blocks were "fixed"
against a stale bank, and the author's *"maps are not using squares, is that intended?"* was
right — it was.

So 50 blocks are rewritten here and 33 are left alone and reported, because the kit does not
say what they should be:

    Crafting Bases 25 (UpsideDownHouse) · Heist contracts/blueprints/targets 4 (Pentagon)
    Mercenary Warrants · Voyage Charts · Enshrouding Crystals · Incursion Vials (Circle)

⚠️ SIZE AND COLOUR ARE UNTOUCHED. Only the third token changes. Size encodes the rung and
colour is the family's, and neither is what Q2 retired — rewriting them here would smuggle a
second, unreviewed change into a shape pass.

⚠️ This does NOT decide WHICH tiers carry an icon. That is the promise-not-paint floor, and
the per-category table for it is still owed by the designer. A block with no icon today gets
none here.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
BM = os.path.join(ROOT, "filter_generation", "data", "base_mapping")
APPLY = "--apply" in sys.argv

VALID = {"Diamond", "Square", "Hexagon", "Triangle", "Raindrop", "Kite", "Cross", "Star", "Moon"}
RETIRED = {"Circle", "UpsideDownHouse", "Pentagon"}

# theme_category -> shape, transcribed from shapes_by_category. `General` is our name for the
# currency category (the porter maps the patch's "Currency" section onto it), which is why it
# takes the currency-kin Diamond.
BY_CATEGORY = {
    "General": "Diamond", "Fossils": "Diamond", "Oils": "Diamond", "Harvest": "Diamond",
    "Delirium Orbs": "Diamond", "Wombgifts": "Diamond", "Tainted Currency": "Diamond",
    "Essences": "Raindrop",
    "Corpses": "Kite",
    "Scarabs": "Hexagon",
    "Skill Gems": "Triangle", "Support Gems": "Triangle",
    "Jewels": "Cross", "Class Nets": "Cross",
    "Trinkets": "Moon", "Talismans": "Moon", "Heist Experimented": "Moon",
}

# The kit names ducats and sulphur inside the Allflame category, but not its other contents,
# so this is per TIER rather than per category. Bottles, Mercenary Warrants and Voyage Charts
# are deliberately absent — see the report.
BY_TIER = {
    ("Curse of the Allflame", "Ducats T0"): "Diamond",
    ("Curse of the Allflame", "Ducats T1"): "Diamond",
    ("Curse of the Allflame", "Sulphur T0"): "Diamond",
    ("Curse of the Allflame", "Sulphur T1"): "Diamond",
}

ICON = re.compile(r"^(\s*)(\S+)\s+(\S+)\s+(\S+)\s*$")


def target_shape(tcat, tkey):
    return BY_TIER.get((tcat, tkey)) or BY_CATEGORY.get(tcat)


def retag(value, shape):
    """`1 Yellow Circle` -> `1 Yellow Diamond`. Size and colour untouched."""
    m = ICON.match(value or "")
    if not m:
        return None
    return "%s%s %s %s" % (m.group(1), m.group(2), m.group(3), shape)


def main():
    changed, left, files = [], [], {}

    for dp, _, fn in os.walk(TD):
        for f in sorted(fn):
            if not f.endswith(".json"):
                continue
            path = os.path.join(dp, f)
            doc = json.load(io.open(path, encoding="utf-8"),
                            object_pairs_hook=collections.OrderedDict)
            touched = False
            for cat, body in doc.items():
                if not isinstance(body, dict):
                    continue
                tcat = (body.get("_meta") or {}).get("theme_category") or cat
                for tkey, tier in body.items():
                    if tkey == "_meta" or not isinstance(tier, dict):
                        continue
                    th = tier.get("theme") or {}
                    icon = th.get("MinimapIcon")
                    m = ICON.match(icon or "") if isinstance(icon, str) else None
                    if not m or m.group(4) not in RETIRED:
                        continue
                    shape = target_shape(tcat, tkey)
                    if not shape:
                        left.append((tcat, tkey, m.group(4)))
                        continue
                    th["MinimapIcon"] = retag(icon, shape)
                    changed.append((tcat, tkey, icon, th["MinimapIcon"]))
                    touched = True
            if touched:
                files[path] = doc

    print("=== apply rev-25.2 icon shapes ===")
    print("  rewritten : %d   (category named in shapes_by_category)" % len(changed))
    print("  left alone: %d   (kit does not name it — needs a ruling)" % len(left))
    print()
    for tcat, tkey, old, new in changed[:40]:
        print("   %-24s %-26s %-18s -> %s" % (tcat[:24], tkey[:26], old, new))
    if len(changed) > 40:
        print("   … +%d more" % (len(changed) - 40))
    if left:
        print()
        print("  -- NOT touched, no entry in shapes_by_category --")
        for (tcat, shape), n in collections.Counter((c, s) for c, _, s in left).most_common():
            print("     %-26s %-16s x%d" % (tcat[:26], shape, n))

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
