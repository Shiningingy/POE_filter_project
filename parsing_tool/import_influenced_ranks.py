#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Give Influenced a base ranking, keeping the class-wide net that already works.

    python parsing_tool/import_influenced_ranks.py            # dry run (default)
    python parsing_tool/import_influenced_ranks.py --apply

Today `Special/Influenced.json` is two `class_condition` tiers banded by item level, with
no bases. FilterBlade's section is far bigger -- a 3-rank matrix PLUS six per-influence base
lists (Shaper / Elder / Crusader / Hunter / Redeemer / Warlord) PLUS seven per-influence
class lists.

★ **Ruthless takes the simple half: BaseType + any influence** (author). The per-influence
breakdown is trade-shaped -- knowing a base is specifically Hunter matters when you are
listing it for sale, not when you are deciding to pick it up. Dropping it removes 13 of
their 18 blocks and loses nothing we would act on.

    Tier 0 <- t1exotic   32 bases   never hidden (their %D9 exceeds the 7-level ladder)
    Tier 1 <- t1top      44 bases   gate 6 (their D5, last shown uber)
    Tier 2 <- t2high     99 bases   gate 5 (their D4, verystrict)
    Tier 3 <- the net    condition-only, gate 4 (their `any` D3, strict)

Same shape as the Fractured import, and additive for the same reason: an influenced base
outside their 175 still lands in the net, it is simply not promoted.

⚠️ `Rarity <= Rare` is kept, NOT their `Rarity Rare`. Their influenced->all section only
handles rares because their per-influence lists (which we are dropping) catch the normal and
magic influenced bases separately. Narrowing to Rare here would silently stop showing
influenced NORMAL bases -- which in Ruthless are exactly the crafting targets worth having.

⚠️ ItemLevel is dropped from the ranked tiers, as it was for Fractured: the influence is the
value, and an ilvl axis alongside a rank axis makes a high-ilvl rank-3 outrank a low-ilvl
rank-1. Their t2high does carry ilvl 84; we deliberately do not.

⚠️ The net needs `class_condition: true`. A tier with conditions but no bases and no rule
emits NOTHING -- the validator caught exactly this on the Fractured net.
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
REL = os.path.join("Equipment", "Special", "Influenced.json")
TIER = os.path.join(DATA, "tier_definition", REL)
MAP = os.path.join(DATA, "base_mapping", REL)
RANKS = os.path.join(REPO, "data", "from_filter_blade", "3.29", "ruthless_ranks.json")

CAT = "Influenced"
HIDE = "Tier Hide Influenced"
NET = "Tier 3 Influenced"
INFLUENCE = "Shaper Elder Crusader Hunter Redeemer Warlord"
# key, bucket, theme.Tier, gate (None = never hidden)
PLAN = [("Tier 0 Influenced", "t1exotic", 3, None),
        ("Tier 1 Influenced", "t1top", 3, 6),
        ("Tier 2 Influenced", "t2high", 4, 5)]


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, doc):
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def cond():
    return OrderedDict([("HasInfluence", INFLUENCE), ("Rarity", "<= Rare")])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    fb = load(RANKS)
    buckets = {b["bucket"]: b for b in fb["purposes"]["influenced->all"]["blocks"]}

    tdoc, mdoc = load(TIER), load(MAP)
    body = tdoc[CAT]
    if NET in body:
        sys.exit("%r already exists -- already run?" % NET)
    mapping = mdoc.setdefault("mapping", OrderedDict())
    if mapping:
        sys.exit("mapping is not empty (%d bases) -- refusing to overwrite" % len(mapping))

    zh0 = (body["Tier 0 Influenced"].get("localization") or {}).get("ch", "")
    zh1 = (body["Tier 1 Influenced"].get("localization") or {}).get("ch", "")

    print("Influenced: BaseType + any influence (per-influence breakdown dropped)")
    claimed = {}
    for key, bucket, tnum, gate in PLAN:
        blk = buckets.get(bucket)
        if blk is None:
            sys.exit("bucket %r missing" % bucket)
        bases = [b for b in blk["bases"] if b not in claimed]
        for b in bases:
            claimed[b] = key
        if key in body:
            t = body[key]
            t.pop("class_condition", None)      # it names bases now
            t["conditions"] = cond()
        else:
            t = OrderedDict([
                ("hideable", True),
                ("conditions", cond()),
                ("theme", OrderedDict([("Tier", tnum)])),
                ("sound", OrderedDict([("default_sound_id", -1), ("sharket_sound_id", None)])),
                ("localization", OrderedDict([("en", "Influenced, rank %s" % bucket),
                                              ("ch", "%s %s" % (zh1, bucket.upper()))])),
            ])
            body[key] = t
        t.pop("hide_at_strictness", None)
        if gate is not None:
            t["hide_at_strictness"] = gate
        print("  %-20s <- %-9s %3d bases  gate=%-4s (their %s)"
              % (key, bucket, len(bases), gate if gate is not None else "none", blk["strictness"]))

    net = OrderedDict([
        ("class_condition", True),
        ("hideable", True),
        ("conditions", cond()),
        ("theme", OrderedDict([("Tier", 5)])),
        ("sound", OrderedDict([("default_sound_id", -1), ("sharket_sound_id", None)])),
        ("localization", OrderedDict([("en", "Any other influenced item"),
                                      ("ch", zh0 + " (net)")])),
        ("hide_at_strictness", 4),
    ])
    body[NET] = net
    print("  %-20s <- %-9s condition-only net, gate=4 (their %s)"
          % (NET, "any", buckets.get("any", {}).get("strictness", "-")))

    order = (body.get("_meta") or {}).get("tier_order")
    if isinstance(order, list):
        for k, _, _, _ in PLAN:
            if k not in order:
                order.insert(order.index(HIDE), k)
        if NET not in order:
            order.insert(order.index(HIDE), NET)
    rebuilt = OrderedDict()
    for k in ["_meta"] + [x for x in order]:
        if k in body:
            rebuilt[k] = body[k]
    for k, v in body.items():
        rebuilt.setdefault(k, v)
    body.clear()
    body.update(rebuilt)

    for b, key in claimed.items():
        mapping[b] = key
    mdoc["mapping"] = OrderedDict(sorted(mapping.items()))
    print("  bases mapped: %d" % len(mapping))
    print("  dropped     : their 6 per-influence base lists + 7 per-influence class lists")

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    dump(TIER, tdoc)
    dump(MAP, mdoc)
    print("\nwrote both files -- regenerate and check the trace")


if __name__ == "__main__":
    main()
