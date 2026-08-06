#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Give Fractured a base ranking, keeping the catch-all that already works.

    python parsing_tool/import_fractured_ranks.py            # dry run (default)
    python parsing_tool/import_fractured_ranks.py --apply

Today `Special/Fractured.json` is three CONDITION-ONLY rules banded by item level
(84+ / 68+ / any), with no bases at all. That is a complete safety net -- every fractured
item shows -- and in Ruthless, where a fractured drop is scarce and valuable, never losing
one matters more than it does in trade leagues.

FilterBlade instead RANKS 436 bases (fractt1 114 / fractt2 148 / fractt3 174) and adds a
class-wide `fractothers` behind them. Their ranks use no ItemLevel at all: for a fractured
item the mod is the value, so the base decides, not the roll ceiling.

★ So this is ADDITIVE, not a replacement. The ranking goes on top; the catch-all stays.
Nothing that shows today stops showing -- a fractured base outside their 436 still lands in
the net, it simply is not promoted.

Selection: **semistrict** (`%D >= 2`), the author's call for this purpose, which keeps all
436. Their `%Dn` is the LAST level shown, so our gate (first level HIDDEN) is `%D + 1`:

    fractt1  D5 -> 6      fractt2  D4 -> 5      fractt3  D2 -> 3      net  D2 -> 3

⚠️ The ItemLevel axis is deliberately dropped from the ranked tiers, because theirs has
none and the two axes would fight: a high-ilvl fractt3 would otherwise outrank a low-ilvl
fractt1. The net keeps no ilvl gate either, exactly as it behaves today.

⚠️ Also fixes two stale copy-pastes in this file: `_meta.theme_category` and
`_meta.item_class` both said "Body Armours". There is no `Fractured` theme category, and
`Rare Equipment` has byte-identical rows to `Body Armours`, so repointing is a visual no-op
that removes the stale dependency. Giving Fractured a look of its own is theme work, still
deferred.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, "filter_generation", "data")
REL = os.path.join("Equipment", "Special", "Fractured.json")
TIER = os.path.join(DATA, "tier_definition", REL)
MAP = os.path.join(DATA, "base_mapping", REL)
RANKS = os.path.join(REPO, "data", "from_filter_blade", "3.29", "ruthless_ranks.json")

CAT = "Fractured"
NET = "Tier 3 Fractured"
COND = OrderedDict([("FracturedItem", "True"), ("Mirrored", "False"),
                    ("Corrupted", "False"), ("Rarity", "<= Rare")])
# tier key <- their bucket, with our gate (= their last-shown level + 1)
PLAN = [("Tier 0 Fractured", "fractt1", 6),
        ("Tier 1 Fractured", "fractt2", 5),
        ("Tier 2 Fractured", "fractt3", 3)]


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, doc):
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    fb = load(RANKS)
    buckets = {b["bucket"]: b for b in fb["purposes"]["exotic->fractured"]["blocks"]}

    tdoc, mdoc = load(TIER), load(MAP)
    body = tdoc[CAT]
    if NET in body:
        sys.exit("%r already exists -- already run?" % NET)

    mapping = mdoc.setdefault("mapping", OrderedDict())
    if mapping:
        sys.exit("mapping is not empty (%d bases) -- refusing to overwrite" % len(mapping))

    print("Fractured: rank 436 bases, keep the catch-all")
    claimed = {}
    for tier, bucket, gate in PLAN:
        blk = buckets.get(bucket)
        if blk is None:
            sys.exit("bucket %r missing" % bucket)
        if tier not in body:
            sys.exit("tier %r missing" % tier)
        bases = blk["bases"]
        dupe = [b for b in bases if b in claimed]
        for b in bases:
            claimed.setdefault(b, tier)
        body[tier]["conditions"] = OrderedDict(COND)
        body[tier]["hide_at_strictness"] = gate
        print("  %-18s <- %-9s %3d bases  gate=%d (their %s)%s"
              % (tier, bucket, len(bases), gate, blk["strictness"],
                 "  !! %d already claimed" % len(dupe) if dupe else ""))

    # The net: condition-only, no bases -- the behaviour the three old rules provided.
    net = OrderedDict([
        ("hideable", True),
        ("conditions", OrderedDict(COND)),
        ("theme", OrderedDict([("Tier", 5)])),
        ("sound", OrderedDict([("default_sound_id", -1), ("sharket_sound_id", None)])),
        ("localization", OrderedDict([("en", "Any other fractured item"),
                                      ("ch", "其他破碎物品")])),
        ("hide_at_strictness", 3),
    ])
    print("  %-18s <- %-9s condition-only net, gate=3 (their %s)"
          % (NET, "fractothers", buckets.get("fractothers", {}).get("strictness", "-")))

    rebuilt = OrderedDict()
    for k, v in body.items():
        if k == "Tier Hide Fractured":
            rebuilt[NET] = net
        rebuilt[k] = v
    body.clear()
    body.update(rebuilt)
    order = (body.get("_meta") or {}).get("tier_order")
    if isinstance(order, list) and NET not in order:
        order.insert(order.index("Tier Hide Fractured"), NET)

    for b, tier in claimed.items():
        mapping[b] = tier
    mdoc["mapping"] = OrderedDict(sorted(mapping.items()))

    # The three old rules are replaced: their ilvl bands become the ranked tiers, and
    # their catch-all behaviour becomes the net tier above.
    old_rules = len(mdoc.get("rules") or [])
    mdoc["rules"] = []

    for doc, label in ((tdoc[CAT]["_meta"], "tier_definition"), (mdoc["_meta"], "base_mapping")):
        if doc.get("theme_category") == "Body Armours":
            doc["theme_category"] = "Rare Equipment"
        ic = doc.get("item_class")
        if isinstance(ic, dict) and ic.get("en") == "Body Armours":
            doc["item_class"] = OrderedDict(tdoc[CAT]["_meta"]["localization"])

    print("  rules      : %d -> 0 (their ilvl bands become tiers; the net keeps the behaviour)"
          % old_rules)
    print("  bases      : %d mapped" % len(mapping))
    print("  stale refs : theme_category / item_class 'Body Armours' -> 'Rare Equipment'")

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    dump(TIER, tdoc)
    dump(MAP, mdoc)
    print("\nwrote both files -- regenerate and check the trace")


if __name__ == "__main__":
    main()
