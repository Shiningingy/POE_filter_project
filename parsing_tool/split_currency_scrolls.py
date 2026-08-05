#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Split the scrolls out of Currency `Tier 7 General` so they can hide first.

    python parsing_tool/split_currency_scrolls.py            # dry run
    python parsing_tool/split_currency_scrolls.py --apply

T7 was three unrelated things sharing a rung -- scrolls, shards, and the two low orbs -- so
there was no way to say "hide scrolls before transmutes". The split names a distinction that
was already there rather than inventing one.

★ The two halves keep `theme.Tier: 4`, so they look IDENTICAL. The tier key is identity, the
`theme.Tier` is the look, and they are separate on purpose -- Currency/General.json already
pairs T3/T4 on theme row 2 and T5/T6 on row 3. So this needs nothing from the designer, which
is what keeps it inside the "structure now, theme later" decision.

The alternative considered and rejected was injecting a hide block at generate time. It would
be invisible filter logic, it would reimplement `hide_at_strictness` (a mechanism 98 equipment
tiers already rely on), and it would hardcode item names that GGG renames between leagues.

⚠️ `item_overrides` is keyed by base name and holds each item's custom sound. Moving a base
between tiers must carry its override across or the sound is silently lost.
"""
from __future__ import annotations

import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, "filter_generation", "data")
REL = os.path.join("Currency", "General.json")
TIER = os.path.join(DATA, "tier_definition", REL)
MAP = os.path.join(DATA, "base_mapping", REL)

FROM_TIER = "Tier 7 General"
NEW_TIER = "Tier 8 General"
# Scroll Fragment combines into Scroll of Wisdom, so it belongs with them.
SCROLLS = ["Scroll of Wisdom", "Portal Scroll", "Scroll Fragment"]
# Hides at `regular` (index 1) -- the first step off soft, per the author's ordering:
# scrolls first, scrap/whetstone next.
GATE = 1
LABEL = {"en": "T8: 卷轴", "ch": "T8: 卷轴"}


def main():
    do = "--apply" in sys.argv
    tdoc = json.load(io.open(TIER, encoding="utf-8"))
    mdoc = json.load(io.open(MAP, encoding="utf-8"))

    cat = next(k for k, v in tdoc.items() if isinstance(v, dict) and FROM_TIER in v)
    body = tdoc[cat]
    src = body[FROM_TIER]

    if NEW_TIER in body:
        sys.exit("%s already exists" % NEW_TIER)

    # Carry each moved base's custom sound across with it.
    src_ov = src.get("item_overrides", {}) or {}
    moved_ov = {b: src_ov[b] for b in SCROLLS if b in src_ov}

    new = {
        "hideable": src.get("hideable", False),
        "theme": {"Tier": src.get("theme", {}).get("Tier")},   # same look as T7, deliberately
        "sound": dict(src.get("sound", {})),
        "localization": dict(LABEL),
        "hide_at_strictness": GATE,
    }
    if moved_ov:
        new["item_overrides"] = moved_ov

    mapping = mdoc.get("mapping", {})
    to_move = [b for b in SCROLLS if b in mapping]
    missing = [b for b in SCROLLS if b not in mapping]

    print("split %s -> %s" % (FROM_TIER, NEW_TIER))
    print("  look        : theme.Tier=%s  (identical to %s)" % (new["theme"]["Tier"], FROM_TIER))
    print("  gate        : hide_at_strictness=%d" % GATE)
    print("  bases moved : %s" % ", ".join(to_move))
    print("  sounds moved: %s" % (", ".join(moved_ov) or "none"))
    if missing:
        print("  !! not in mapping, skipped: %s" % ", ".join(missing))
    left = [b for b, t in mapping.items()
            if FROM_TIER in (t if isinstance(t, list) else [t]) and b not in to_move]
    print("  %s keeps    : %s" % (FROM_TIER, ", ".join(sorted(left))))

    if not do:
        print("\n(dry run - pass --apply)")
        return

    # tier_definition: insert directly after the tier it came from, in both the object and
    # the explicit tier_order the generator walks.
    rebuilt = {}
    for k, v in body.items():
        rebuilt[k] = v
        if k == FROM_TIER:
            rebuilt[NEW_TIER] = new
    body.clear()
    body.update(rebuilt)
    meta = body.get("_meta")
    if isinstance(meta, dict) and isinstance(meta.get("tier_order"), list):
        order = meta["tier_order"]
        order.insert(order.index(FROM_TIER) + 1, NEW_TIER)

    for b in to_move:
        val = mapping[b]
        if isinstance(val, list):
            mapping[b] = [NEW_TIER if x == FROM_TIER else x for x in val]
        else:
            mapping[b] = NEW_TIER
    for b in moved_ov:
        src_ov.pop(b, None)
    if not src_ov:
        src.pop("item_overrides", None)

    io.open(TIER, "w", encoding="utf-8").write(
        json.dumps(tdoc, ensure_ascii=False, indent=2) + "\n")
    io.open(MAP, "w", encoding="utf-8").write(
        json.dumps(mdoc, ensure_ascii=False, indent=2) + "\n")
    print("\nwrote both files")
    print("the filter SHOULD change by exactly one block splitting into two - check the diff")


if __name__ == "__main__":
    main()
