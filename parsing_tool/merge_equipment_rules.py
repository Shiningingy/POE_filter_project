#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Merge Rare Equipment's 36 per-class rules into one rule per (tier, conditions).

    python parsing_tool/merge_equipment_rules.py            # dry run (default)
    python parsing_tool/merge_equipment_rules.py --apply

The collapse concatenated each class file's rules, so `Tier 0 Rare Equipment` ended up with
22 rules that differ only in which bases they name. They were never 22 decisions -- they are
one decision written 22 times, because each class file could only speak about its own class.
They group into exactly four:

    (dead, no tier)            3 rules   3 targets
    Tier 0  ItemLevel >= 83   10 rules  23 targets
    Tier 0  ItemLevel >= 86   12 rules  40 targets
    Tier 1  ItemLevel >= 84   11 rules  37 targets

Lossless because within each group the targets are disjoint (23/23, 40/40, 37/37 distinct),
so no rule was shadowing another and the union names exactly the same bases under exactly
the same conditions.

★ What these rules ACTUALLY are: a hand-written LevelSplit. FilterBlade derives the ilvl
band from the item CLASS (86 = body armours/boots/shields/bows/belts/quivers, 85 =
amulets/gloves/helmets, 84 = caster + rings, 83 = attack weapons); we wrote it out per class
by hand, before that was known. Merging is the cleanup; replacing it with the Crafting
purpose is the open item in docs/pending-features.md.

⚠️ The 3 tier-less rules are DEAD -- a rule with conditions but no `overrides.Tier` is
skipped outright, so `Vaal Regalia`, `Astral Plate` and `Zodiac Leather` emit nothing. That
is the long-recorded "Body Armours is missing the rung all 11 of its siblings have". This
script does NOT invent a tier for them; it merges them into one clearly-labelled dead rule
so the bug is visible in the editor instead of hiding among 22 lookalikes.
"""
from __future__ import annotations

import argparse
import io
import json
import os
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
MAP = os.path.join(REPO, "filter_generation", "data", "base_mapping",
                   "Equipment", "Rare Equipment.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    doc = json.load(io.open(MAP, encoding="utf-8"), object_pairs_hook=OrderedDict)
    rules = doc.get("rules") or []

    # ⚠️ Group on the WHOLE `overrides` dict, not just `overrides.Tier`.
    # Grouping on Tier alone and rebuilding `overrides` as {Tier: ...} silently dropped
    # `overrides.PlayAlertSound` — every one of these rules carries one — so 49 bases lost
    # their rule-level sound and fell back to the tier's quieter class_sounds volume
    # (300 -> 200). Caught only by diffing the generated blocks; the merge reported success.
    groups = OrderedDict()          # (overrides, conditions) -> merged rule
    for r in rules:
        over = r.get("overrides") or {}
        tier = over.get("Tier")
        okey = json.dumps(over, sort_keys=True, ensure_ascii=False)
        cond = json.dumps(r.get("conditions") or {}, sort_keys=True, ensure_ascii=False)
        key = (okey, cond)
        g = groups.get(key)
        if g is None:
            g = OrderedDict([
                ("targets", []),
                ("conditions", json.loads(cond, object_pairs_hook=OrderedDict)),
            ])
            if over:
                g["overrides"] = json.loads(okey, object_pairs_hook=OrderedDict)
            g["comment"] = ""
            g["_n"] = 0
            g["_tier"] = tier
            groups[key] = g
        for t in (r.get("targets") or []):
            if t not in g["targets"]:
                g["targets"].append(t)
        g["_n"] += 1

    print("%d rules -> %d" % (len(rules), len(groups)))
    out = []
    for _key, g in groups.items():
        n = g.pop("_n")
        tier = g.pop("_tier")
        ilvl = (g["conditions"] or {}).get("ItemLevel", "-")
        if tier is None:
            g["comment"] = ("DEAD: no overrides.Tier, so this rule emits nothing. "
                            "These bases need a tier (Body Armours' missing rung).")
        else:
            g["comment"] = "%s, %s" % (tier, ilvl)
        print("   %-24s %-22s from %2d rules, %3d targets   %s"
              % (str(tier), ilvl, n, len(g["targets"]),
                 "<-- DEAD" if tier is None else ""))
        g["targets"] = sorted(g["targets"])
        out.append(g)

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    doc["rules"] = out
    io.open(MAP, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print("\nwrote %s" % os.path.relpath(MAP, REPO))
    print("the emitted BASES must not change -- only the number of blocks. Check the trace.")


if __name__ == "__main__":
    main()
