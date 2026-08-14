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
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json")
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
    # rev 27.1 binds ONE Crafting Bases tier: "Crafting Bases chase -> 1 Yellow Moon; its other
    # 24 retired-shape icons sit below the floor and drop". The chase is `Crafting Perfect
    # Defence` — rung 2, FS45, white plate — and rung 2 is exactly the R0-R2 floor, so the
    # binding and the floor agree without either being assumed.
    ("Crafting Bases", "Crafting Perfect Defence"): "Moon",
}

# ★ rev 27.1: "a category NOT in shapes_by_category has no icon license — its retired-shape
# icons DROP at port, they are not re-shaped." Before this rule the pass left them alone and
# reported them, because re-shaping without a binding would have been a guess. Dropping is not
# a guess: the kit says an unnamed category has no license at all.
DROP_IF_UNNAMED = True

ICON = re.compile(r"^(\s*)(\S+)\s+(\S+)\s+(\S+)\s*$")


def target_shape(tcat, tkey):
    return BY_TIER.get((tcat, tkey)) or BY_CATEGORY.get(tcat)


def retag(value, shape):
    """`1 Yellow Circle` -> `1 Yellow Diamond`. Size and colour untouched."""
    m = ICON.match(value or "")
    if not m:
        return None
    return "%s%s %s %s" % (m.group(1), m.group(2), m.group(3), shape)


def tier_paths(tcat):
    """Every tier-definition file declaring this theme category."""
    out = []
    for dp, _, fn in os.walk(TD):
        for f in sorted(fn):
            if not f.endswith(".json"):
                continue
            path = os.path.join(dp, f)
            try:
                doc = json.load(io.open(path, encoding="utf-8"))
            except Exception:
                continue
            for cat, body in doc.items():
                if isinstance(body, dict) and ((body.get("_meta") or {}).get("theme_category") or cat) == tcat:
                    out.append(path)
    return out


def main():
    changed, left, dropped, files = [], [], [], {}

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
                        if DROP_IF_UNNAMED:
                            del th["MinimapIcon"]
                            dropped.append((tcat, tkey, icon))
                            touched = True
                        else:
                            left.append((tcat, tkey, m.group(4)))
                        continue
                    th["MinimapIcon"] = retag(icon, shape)
                    changed.append((tcat, tkey, icon, th["MinimapIcon"]))
                    touched = True
            if touched:
                files[path] = doc

    print("=== apply rev-25.2 icon shapes ===")
    print("  rewritten : %d   (category named in shapes_by_category)" % len(changed))
    print("  dropped   : %d   (rev 27.1: an unnamed category has no icon license)" % len(dropped))
    print("  left alone: %d" % len(left))
    print()
    for tcat, tkey, old, new in changed[:40]:
        print("   %-24s %-26s %-18s -> %s" % (tcat[:24], tkey[:26], old, new))
    if len(changed) > 40:
        print("   … +%d more" % (len(changed) - 40))
    if dropped:
        print()
        print("  -- DROPPED, category not in shapes_by_category --")
        for tcat, tkey, icon in dropped:
            print("     %-24s %-30s was %s" % (tcat[:24], tkey[:30], icon))
    if left:
        print()
        print("  -- NOT touched, no entry in shapes_by_category --")
        for (tcat, shape), n in collections.Counter((c, s) for c, _, s in left).most_common():
            print("     %-26s %-16s x%d" % (tcat[:26], shape, n))

    # ★ THE ROWS TOO. Inline is only half the tree: a tier with no inline icon takes the theme
    # ROW's, so clearing inline alone left five retired shapes still emitting — Ducats,
    # Enshrouding Crystals, Incursion Vials, Mercenary Warrants, Voyage Charts. Same rule
    # applies: rewrite where the category is named, drop where it is not.
    theme = json.load(io.open(THEME, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
    rows_changed, rows_dropped, row_icon_was = [], [], {}
    for tcat, rows in theme.items():
        if not isinstance(rows, dict):
            continue
        for row, v in rows.items():
            if not isinstance(v, dict):
                continue
            icon = v.get("MinimapIcon")
            m = ICON.match(icon or "") if isinstance(icon, str) else None
            if not m or m.group(4) not in RETIRED:
                continue
            shape = BY_CATEGORY.get(tcat)
            if shape:
                v["MinimapIcon"] = retag(icon, shape)
                rows_changed.append((tcat, row, icon, v["MinimapIcon"]))
            else:
                del v["MinimapIcon"]
                rows_dropped.append((tcat, row, icon))
                row_icon_was[(tcat, row)] = icon
    # ★ A SHARED ROW CANNOT SAY TWO THINGS. `Curse of the Allflame` is one theme category
    # holding several item groups, and the kit names only SOME of them — "ducats/sulphur" take
    # the currency-kin Diamond, while Voyage Charts and Mercenary Warrants are named nowhere and
    # so have no icon license. Dropping the shared row satisfies the unlicensed ones; the named
    # tiers get theirs planted INLINE, which is the only place that can distinguish them.
    #
    # Size and colour are carried over from the row that was dropped, so only the shape changes
    # — the same restraint the rest of this pass observes.
    planted = []
    for (tcat, tkey), shape in BY_TIER.items():
        for path, doc in list(files.items()) + [(p2, json.load(io.open(p2, encoding="utf-8"),
                                                 object_pairs_hook=collections.OrderedDict))
                                                for p2 in tier_paths(tcat) if p2 not in files]:
            for cat, bodyd in doc.items():
                if not isinstance(bodyd, dict):
                    continue
                if ((bodyd.get("_meta") or {}).get("theme_category") or cat) != tcat:
                    continue
                tier = bodyd.get(tkey)
                if not isinstance(tier, dict):
                    continue
                th = tier.setdefault("theme", collections.OrderedDict())
                if th.get("MinimapIcon"):
                    continue
                was = row_icon_was.get((tcat, "Tier %s" % th.get("Tier")))
                if not was:
                    continue
                th["MinimapIcon"] = retag(was, shape)
                planted.append((tcat, tkey, was, th["MinimapIcon"]))
                files[path] = doc
    if planted:
        print()
        print("  -- planted inline (row was shared and dropped) --")
        for tcat, tkey, was, now in planted:
            print("     %-24s %-22s %-18s -> %s" % (tcat[:24], tkey[:22], was, now))

    print()
    print("  theme rows rewritten: %d   dropped: %d" % (len(rows_changed), len(rows_dropped)))
    for tcat, row, old, new in rows_changed:
        print("     %-26s %-9s %-22s -> %s" % (tcat[:26], row, old, new))
    for tcat, row, old in rows_dropped:
        print("     %-26s %-9s %-22s -> (none)" % (tcat[:26], row, old))

    if APPLY:
        for path, doc in files.items():
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        io.open(THEME, "w", encoding="utf-8").write(
            json.dumps(theme, ensure_ascii=False, indent=2) + "\n")
        print()
        print("written: %d tier file(s) + the theme rows" % len(files))
    else:
        print()
        print("(review only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
