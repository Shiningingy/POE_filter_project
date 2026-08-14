# -*- coding: utf-8 -*-
"""Port the rev-23 patch sections that CANNOT be rung-keyed rows, onto their tiers inline.

    python parsing_tool/theme/port_patch_inline.py            # review
    python parsing_tool/theme/port_patch_inline.py --apply    # write

★ WHY THESE CANNOT BE ROWS. A theme row is looked up by RUNG, so a category can hold at most
one look per rung. These sections give more looks than the category has distinct rungs:

  Maps      five authored plates (T17/T16/红/黄/白) across tiers sitting on rungs 1,2,2,3,3 —
            two pairs would collide. That is the documented `maps` exception: the plate is a
            function of MAP TIER, not of the rung. Writing them as rows is precisely what
            flattened T11-T15 onto one plate and made a red map render 200 200 200.
  Allflame  瓶中信 / 达克特 / 死者硫磺 / 海图 are four item groups in ONE theme category, and
            海图 is explicitly "own blue, one tier" — a second look at the same rung.
  Sockets   6-link / 6-socket / RGB are three authored looks whose rungs (1/3/5) happen to be
            distinct, but they are per-tier identities, not a ladder.

Inline is the right home for exactly this: a look that belongs to one block rather than to a
rung. The rest of the patch went to rows in `port_designer_patch.py`.

⚠️ NOT PORTED HERE, and not by inference either:
  Jewels (T2 white/magic/rare) and Equipment loudness (weapons_armour rare/magic/normal) are
  RARITY grammars — three looks for one tier, selected by the item's rarity. Our tiers do not
  split by rarity, so this needs rule-level work, not a style write. Left for a decision.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATCH = os.path.join(ROOT, "docs", "design", "handoff", "theme-patch-rev27-1.json")
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
APPLY = "--apply" in sys.argv

# (patch section, patch key) -> (tier file, tier key). Written out rather than matched by
# pattern: these are five different naming conventions and a fuzzy match would be a guess.
TABLE = [
    ("Maps", "Tier 0",              "Maps/Base Maps.json",                    "Tier 0 Base Maps"),
    ("Maps", "Tier 1 (T16)",        "Maps/Base Maps.json",                    "Tier 1 Base Maps"),
    ("Maps", "Tier 2 (红图)",        "Maps/Base Maps.json",                    "Tier 2 Base Maps"),
    ("Maps", "Tier 3 (黄图)",        "Maps/Base Maps.json",                    "Tier 3 Base Maps"),
    ("Maps", "Tier 4 (白图)",        "Maps/Base Maps.json",                    "Tier 4 Base Maps"),
    ("Curse of the Allflame", "R2 瓶中信",      "Curse of the Allflame/Bottles.json",       "Bottles"),
    ("Curse of the Allflame", "R3 高级达克特",   "Curse of the Allflame/Ducats.json",        "Ducats T0"),
    ("Curse of the Allflame", "R4 普通达克特",   "Curse of the Allflame/Ducats.json",        "Ducats T1"),
    ("Curse of the Allflame", "R2 大量死者硫磺", "Curse of the Allflame/Sulphur.json",       "Sulphur T0"),
    ("Curse of the Allflame", "海图 (own blue, one tier)",
     "Curse of the Allflame/Voyage Charts.json", "Voyage Charts"),
    ("Sockets & Links", "6-link",     "Equipment/VendorRecipes/Recipes.json", "6-Link"),
    ("Sockets & Links", "6-socket",   "Equipment/VendorRecipes/Recipes.json", "6-Socket"),
    ("Sockets & Links", "RGB linked", "Equipment/VendorRecipes/Recipes.json", "RGB Linked"),
]

# `MinimapIcon` is NOT in this list on purpose for Maps/Allflame: the patch's icon values are
# part of the same authored look and DO get carried. Only prose keys are dropped.
STYLE = ("TextColor", "BackgroundColor", "BorderColor", "FontSize", "MinimapIcon", "PlayEffect")


def main():
    P = json.load(io.open(PATCH, encoding="utf-8"))
    # Channels the patch has any opinion about, computed from the patch itself so a future rev
    # that starts describing beams is honoured without editing this file.
    global MODELLED
    MODELLED = {k for sec, body in P.items() if not sec.startswith("_") and isinstance(body, dict)
                for node in body.values() if isinstance(node, dict)
                for k in STYLE if k in node and node[k] is not None}
    files, wrote, missing = {}, [], []

    for section, pkey, rel, tier in TABLE:
        node = (P.get(section) or {}).get(pkey)
        if not isinstance(node, dict):
            missing.append(("%s / %s" % (section, pkey), "not in the patch"))
            continue
        path = os.path.join(TD, *rel.split("/"))
        if path not in files:
            if not os.path.exists(path):
                missing.append((rel, "no such tier file"))
                continue
            files[path] = json.load(io.open(path, encoding="utf-8"),
                                    object_pairs_hook=collections.OrderedDict)
        doc = files[path]
        target = None
        for cat, body in doc.items():
            if isinstance(body, dict) and tier in body and isinstance(body[tier], dict):
                target = body[tier]
                break
        if target is None:
            missing.append(("%s :: %s" % (rel, tier), "tier not found"))
            continue
        th = target.setdefault("theme", collections.OrderedDict())
        before = collections.OrderedDict((k, th[k]) for k in STYLE if k in th)
        # ★ AN OMITTED KEY IS A REMOVAL — but only for a channel the patch MODELS.
        # rev 25 states its icon floor (icons at R0-R2 only) by dropping MinimapIcon from the
        # rows beneath it, so for icons absence is a decision and a write-only porter cannot
        # express it — that is the half-port that made rev 23 inert.
        #
        # ⚠️ `PlayEffect` is in ZERO of the patch's 79 rows: the kit does not describe beams.
        # Deleting on absence there stripped all five map beams on the first run. Absence of
        # an opinion is not an opinion. Same rule as port_designer_patch.modelled_channels().
        for k in STYLE:
            if k in node and node[k] is not None:
                th[k] = node[k]
            elif k in th and k in MODELLED:
                del th[k]
        after = collections.OrderedDict((k, th[k]) for k in STYLE if k in th)
        if before != after:
            wrote.append((rel, tier, pkey, before, after))

    print("=== port rev-23 patch -> tier INLINE ===")
    print("  tiers updated : %d" % len(wrote))
    print("  not applied   : %d" % len(missing))
    print()
    for rel, tier, pkey, before, after in wrote:
        print("  %-38s %-20s <- %s" % (rel[-38:], tier[:20], pkey[:24]))
        print("        was %s" % json.dumps(before, ensure_ascii=False))
        print("        now %s" % json.dumps(after, ensure_ascii=False))
    for what, why in missing:
        print("  !! %-44s %s" % (what[:44], why))

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
