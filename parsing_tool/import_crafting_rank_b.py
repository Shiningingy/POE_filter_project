#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Add FilterBlade's `crafting->generalgear` Rank B (ilvl 86) to Crafting Priority.

    python parsing_tool/import_crafting_rank_b.py            # dry run (default)
    python parsing_tool/import_crafting_rank_b.py --apply

★ Why only this one bucket, when their purpose holds 132 bases:

The author's call is to take each purpose at the strictness SELECTION they want, not to
import everything and gate it afterwards. For high-level crafting bases that selection is
**verystrict**, because a crafting base is the cheapest thing in the drop unless it is
over-quality, and every one of them matches `Rarity Normal Magic Rare` -- so importing all
132 puts ~56 big weapon labels on screen at the default level.

Their own `%Dn` marker is the last strictness level a block is shown at, on the same
7-level ladder we use. Selecting `%D >= 4` (still shown at verystrict) yields:

    t1_86 (14)  t2_86 (19)  t1_85 (12)  t1_84 (4)   = 49 of 132

and the ONLY weapons that survive are `Reflex Bow`, `Short Bow`, `Spine Bow`,
`Thicket Bow` -- exactly the "weapons besides 86+ bows" line the author drew independently
before this was measured. Two routes, same answer, which is the reason to trust it.

We already hold t1_86, t1_85 and t1_84 (a past import took the t1 rung only). So the whole
gap at this selection is **t2_86**: one tier, 19 bases, 4 of them bows.

⚠️ This also adds the `hide_at_strictness` gates the crafting tiers never had -- they
currently never hide at any level. Their `%D` is the LAST level shown, so our gate (the
first level HIDDEN) is `%D + 1`.

⚠️ The zh label is NOT hand-written: it reuses the approved `Crafting Gear 86` string with
an ASCII rank marker appended. Rename it to whatever the author prefers.

⚠️ Rank B shares Rank A's theme row (`Tier 5`), because `Crafting Bases` only has rows
Tier 2-5 and 5 is already the dimmest. Giving the ranks distinct looks is theme work, which
is deferred until the categories settle -- recorded in docs/pending-features.md.
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
REL = os.path.join("Equipment", "Crafting Priority.json")
TIER = os.path.join(DATA, "tier_definition", REL)
MAP = os.path.join(DATA, "base_mapping", REL)
RANKS = os.path.join(REPO, "data", "from_filter_blade", "3.29", "ruthless_ranks.json")

CAT = "Crafting Priority"
AFTER = "Crafting Gear 86"
NEW = "Crafting Gear 86 Rank B"
BUCKET = "t2_86"
# their %D (last level shown) -> our gate (first level hidden)
GATES = {"Crafting Gear 86": 6, NEW: 5, "Crafting Gear 85": 5, "Crafting Gear 84": 5}


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
    blk = next((b for b in fb["purposes"]["crafting->generalgear"]["blocks"]
                if b["bucket"] == BUCKET), None)
    if blk is None:
        sys.exit("bucket %r not found" % BUCKET)
    bases = list(blk["bases"])

    tdoc, mdoc = load(TIER), load(MAP)
    body = tdoc[CAT]
    if NEW in body:
        sys.exit("%r already exists" % NEW)

    src = body[AFTER]
    new = OrderedDict([
        ("hideable", src.get("hideable", True)),
        ("conditions", OrderedDict([("Rarity", "<= Rare"),
                                    ("ItemLevel", ">= %d" % blk["item_level"])])),
        ("theme", OrderedDict([("Tier", (src.get("theme") or {}).get("Tier"))])),
        ("sound", OrderedDict(src.get("sound") or {})),
        ("localization", OrderedDict([
            ("en", "Gear base i86+ (Rank B)"),
            ("ch", (src.get("localization") or {}).get("ch", "") + " (B)"),
        ])),
        ("hide_at_strictness", GATES[NEW]),
    ])

    mapping = mdoc.setdefault("mapping", OrderedDict())
    already = {b: mapping[b] for b in bases if b in mapping}
    fresh = [b for b in bases if b not in mapping]

    print("import %s -> %r" % (BUCKET, NEW))
    print("  condition   : Rarity <= Rare, ItemLevel >= %d" % blk["item_level"])
    print("  gate        : hide_at_strictness=%d  (their %s = last shown)"
          % (GATES[NEW], blk["strictness"]))
    print("  bases       : %d in the bucket, %d new, %d already mapped here"
          % (len(bases), len(fresh), len(already)))
    for b, t in already.items():
        print("     already: %-28s -> %s" % (b, t))
    print("  adding      : %s" % ", ".join(sorted(fresh)))
    print("  gates set on: %s" % ", ".join("%s=%d" % (k, v) for k, v in GATES.items()))

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    rebuilt = OrderedDict()
    for k, v in body.items():
        rebuilt[k] = v
        if k == AFTER:
            rebuilt[NEW] = new
    body.clear()
    body.update(rebuilt)
    order = (body.get("_meta") or {}).get("tier_order")
    if isinstance(order, list) and NEW not in order:
        order.insert(order.index(AFTER) + 1, NEW)

    for k, gate in GATES.items():
        if k in body and isinstance(body[k], dict):
            body[k]["hide_at_strictness"] = gate

    for b in fresh:
        mapping[b] = NEW
    for b in already:
        cur = mapping[b]
        cur = cur if isinstance(cur, list) else [cur]
        if NEW not in cur:
            mapping[b] = cur + [NEW]

    mdoc["mapping"] = OrderedDict(sorted(mapping.items()))
    dump(TIER, tdoc)
    dump(MAP, mdoc)
    print("\nwrote both files -- regenerate and check the diff")


if __name__ == "__main__":
    main()
