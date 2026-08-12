#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Point _legacy/Legacy.json's mapping at the tier it actually has.

    python parsing_tool/fix_legacy_tier_refs.py            # dry run
    python parsing_tool/fix_legacy_tier_refs.py --apply

Legacy.json's mapping still names the tiers its items were retired FROM -- 'Tier 1 Stackable
Currency', 'Tier 1 Support Gems', 'Tier 1 Amulets' and 23 more -- but the file itself defines
only 'Tier 1 Legacy' and 'Tier Hide Legacy'. A mapping value is resolved against the tiers of
its OWN file, so all 309 entries fall through to the first non-hide tier.

They already land on `Tier 1 Legacy`, which is where retired items belong, so **the output does
not change**. What changes is that the file stops describing a structure it does not have: 26
validator warnings go away, and the next person to read this mapping is not told that legacy
items carry a Stackable-Currency ranking that nothing honours.

⚠️ Rewrites only values that do not resolve. A value naming a real tier of this file is left
alone, so an intentional Hide mapping survives.
"""
from __future__ import annotations

import collections
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, "filter_generation", "data")
REL = os.path.join("_legacy", "Legacy.json")
TIER_PATH = os.path.join(DATA, "tier_definition", REL)
MAP_PATH = os.path.join(DATA, "base_mapping", REL)


def defined_tiers(path):
    doc = json.load(io.open(path, encoding="utf-8"))
    out = set()
    for _cat, body in doc.items():
        if isinstance(body, dict):
            out |= {k for k in body if k != "_meta"}
    return out


def first_non_hide(path):
    """The tier the generator already sends these items to."""
    doc = json.load(io.open(path, encoding="utf-8"))
    for _cat, body in doc.items():
        if not isinstance(body, dict):
            continue
        order = (body.get("_meta", {}) or {}).get("tier_order") or [
            k for k in body if k != "_meta"]
        for k in order:
            if "hide" not in k.lower():
                return k
    return None


def main():
    apply = "--apply" in sys.argv

    defined = defined_tiers(TIER_PATH)
    target = first_non_hide(TIER_PATH)
    print("Legacy.json defines : %s" % sorted(defined))
    print("first non-hide tier : %s   <- where they already land" % target)
    if target is None:
        sys.exit("no non-hide tier in Legacy.json")

    doc = json.load(io.open(MAP_PATH, encoding="utf-8"))
    mapping = doc.get("mapping")
    if not isinstance(mapping, dict):
        sys.exit("Legacy.json base_mapping has no 'mapping' object")

    changed = collections.Counter()
    for base, val in list(mapping.items()):
        was_list = isinstance(val, list)
        vals = val if was_list else [val]
        new = []
        for v in vals:
            if v in defined:
                new.append(v)
            else:
                changed[v] += 1
                if target not in new:
                    new.append(target)
        mapping[base] = new if was_list else new[0]

    print()
    print("dangling names rewritten -> %r : %d entries across %d names"
          % (target, sum(changed.values()), len(changed)))
    for name, n in changed.most_common():
        print("   %-46s %3d" % (name, n))

    if not changed:
        print("\nnothing to do")
        return
    if not apply:
        print("\n(dry run - pass --apply)")
        return

    io.open(MAP_PATH, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print("\nwrote %s" % os.path.relpath(MAP_PATH, REPO))
    print("the generated filter MUST be byte-identical - check it")


if __name__ == "__main__":
    main()
