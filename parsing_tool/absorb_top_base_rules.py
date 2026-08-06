#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Retire the T0/T1 "top bases" rules: absorb the armour, drop the weapons.

    python parsing_tool/absorb_top_base_rules.py            # dry run (default)
    python parsing_tool/absorb_top_base_rules.py --apply

`Rare Equipment` carries 4 rules that are a hand-written LevelSplit -- the same top-N bases
listed at `ItemLevel >= 86` (Tier 0) and `>= 84` (Tier 1), heavy weapons at `>= 83`. They
predate knowing that FilterBlade derives the band from the item CLASS, and they gate several
classes far too high: Claws at 86 where the real band is 83, Rings at 86 where it is 84.

They are also the wrong LAYER. "This base at this ilvl is worth crafting on" is the Crafting
purpose; the rare ladder is "this base is worth picking up as a rare". One idea, two homes.

★ Two author decisions meet here and both are honoured:

  1. *Keep our extra curated bases* -- the "best base for the slot" picks FilterBlade's
     crafting set does not name.
  2. *Weapon crafting bases are the cheapest part unless over-quality; turn off weapons
     besides 86+ bows.*

So the armour and jewellery targets are ABSORBED into Crafting Priority at their class band,
and the weapon targets are DROPPED. Measured before deciding: of the 66 distinct targets,
only 12 already have a plain `Crafting Gear` rung, so this is not a no-op either way.

⚠️ Dropping the weapon targets is a real reduction: a NORMAL weapon base at ilvl 86 stops
showing, because `Normal Net` hides normals at AreaLevel 68+. That follows the author's own
reasoning -- you can scour a magic to normal, and a base worth crafting hits the crafting
layer -- but it is a behaviour change, not a cleanup. The dropped list is printed in full so
restoring any of them is one edit.

⚠️ Three of the rules' targets are the long-dead Body Armours ones (`Vaal Regalia`,
`Astral Plate`, `Zodiac Leather`): their rule carries no `overrides.Tier`, so it is skipped
outright and they emit NOTHING today. Absorbing them finally fixes the recorded "Body
Armours is missing the rung all 11 of its siblings have".

⚠️ Absorbed bases go to the RANK A tier of their band, because T0 was our loudest rung and
these were our top picks. That is a curation judgement, not something measured.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, "filter_generation", "data")
RE_MAP = os.path.join(DATA, "base_mapping", "Equipment", "Rare Equipment.json")
RE_TIER = os.path.join(DATA, "tier_definition", "Equipment", "Rare Equipment.json")
CP_MAP = os.path.join(DATA, "base_mapping", "Equipment", "Crafting Priority.json")
DB = os.path.join(REPO, "data", "items_db.json")

# FilterBlade's declared LevelSplit1, verified against every base in their purpose.
BAND = {"Body Armours": 86, "Boots": 86, "Shields": 86, "Bows": 86, "Belts": 86,
        "Quivers": 86, "Amulets": 85, "Gloves": 85, "Helmets": 85,
        "Rings": 84, "Rune Daggers": 84, "Sceptres": 84, "Staves": 84, "Wands": 84,
        "Daggers": 84, "Claws": 83, "One Hand Axes": 83, "One Hand Maces": 83,
        "One Hand Swords": 83, "Thrusting One Hand Swords": 83, "Two Hand Axes": 83,
        "Two Hand Maces": 83, "Two Hand Swords": 83, "Warstaves": 83}
WEAPONS = {"Bows", "Claws", "Daggers", "Rune Daggers", "Sceptres", "Staves", "Wands",
           "One Hand Axes", "One Hand Maces", "One Hand Swords",
           "Thrusting One Hand Swords", "Two Hand Axes", "Two Hand Maces",
           "Two Hand Swords", "Warstaves"}
TARGET_TIER = {86: "Crafting Gear 86", 85: "Crafting Gear 85", 84: "Crafting Gear 84"}
T0 = "Tier 0 Rare Equipment"


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, doc):
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    db = {i["name"]: i["item_class"] for i in load(DB)["items"]}
    remap, retier = load(RE_MAP), load(RE_TIER)
    cpmap = load(CP_MAP)

    rules = remap.get("rules") or []
    if not rules:
        sys.exit("no rules left -- already run?")

    targets = []
    for r in rules:
        for t in (r.get("targets") or []):
            if t not in targets:
                targets.append(t)

    cp = cpmap["mapping"]
    absorb, drop, unknown = defaultdict(list), defaultdict(list), []
    for b in targets:
        cls = db.get(b)
        if cls is None:
            unknown.append(b)
            continue
        if cls in WEAPONS:
            drop[cls].append(b)
            continue
        band = BAND.get(cls)
        tier = TARGET_TIER.get(band)
        if tier is None:
            unknown.append(b)
            continue
        cur = cp.get(b)
        cur = (cur if isinstance(cur, list) else [cur]) if cur else []
        if tier in cur:
            continue                       # already has that exact rung
        absorb[tier].append(b)

    print("retire the T0/T1 top-base rules  (%d rules, %d distinct targets)"
          % (len(rules), len(targets)))
    print()
    print("ABSORB into Crafting Priority (armour & jewellery, at their class band):")
    for tier in sorted(absorb):
        print("  %-20s +%2d  %s" % (tier, len(absorb[tier]), ", ".join(sorted(absorb[tier]))))
    print("  total absorbed: %d" % sum(len(v) for v in absorb.values()))
    print()
    print("DROP (weapons -- 'cheapest part unless over-quality'):")
    for cls in sorted(drop):
        print("  %-26s %2d  %s" % (cls, len(drop[cls]), ", ".join(sorted(drop[cls]))))
    print("  total dropped: %d" % sum(len(v) for v in drop.values()))
    if unknown:
        print()
        print("  !! not in items_db, left alone: %s" % ", ".join(unknown))

    # Tier 0 exists only through these rules; check before removing it.
    t0_mapped = [b for b, v in (remap.get("mapping") or {}).items()
                 if T0 in (v if isinstance(v, list) else [v])]
    print()
    print("  %s holds %d bases via mapping -> %s"
          % (T0, len(t0_mapped), "REMOVE (it is rules-only)" if not t0_mapped else "KEEP"))

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    for tier, bases in absorb.items():
        for b in bases:
            cur = cp.get(b)
            if cur is None:
                cp[b] = tier
            else:
                cur = cur if isinstance(cur, list) else [cur]
                cp[b] = cur + [tier]
    cpmap["mapping"] = OrderedDict(sorted(cp.items()))

    remap["rules"] = []
    if not t0_mapped:
        retier["Rare Equipment"].pop(T0, None)
        order = (retier["Rare Equipment"].get("_meta") or {}).get("tier_order")
        if isinstance(order, list) and T0 in order:
            order.remove(T0)

    dump(CP_MAP, cpmap)
    dump(RE_MAP, remap)
    dump(RE_TIER, retier)
    print("\nwrote 3 files -- regenerate and check the trace")


if __name__ == "__main__":
    main()
