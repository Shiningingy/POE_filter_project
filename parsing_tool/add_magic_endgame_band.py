#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Hide trash magic equipment from AreaLevel 72 up -- progression, not strictness.

    python parsing_tool/add_magic_endgame_band.py            # dry run (default)
    python parsing_tool/add_magic_endgame_band.py --apply

★ The complaint this answers (author, from play): magic equipment still shows in high maps,
and the only lever for it was raising strictness. *"This should be something auto-fit in
progress, not a strictness control"* -- like the campaign's hide-magic-after-Act-3.

We already had the mechanism and it stopped dead at 67. The campaign uses AreaLevel RANGES
(`Magic Declutter` 10-67, `Aggressive Magic Hide` 34-67); above 68 there was a single flat
layer, so a white map and a T16 were treated identically. This is the continuation.

Inserts ONE hide tier between `Magic Good Jewellery` and `Magic Net`:

    Class == <the 24 equipment classes>
    Rarity Magic
    AreaLevel >= 72
    Identified False

Order is what makes it correct, and every piece was verified before writing:

  * `Magic Good Jewellery` stays FIRST, so the 43 talismans mapped into it are claimed
    before this hide can see them -- the author's "talismans drop magic and can still be
    good". Their protection is by NAME, not by class, so it survives.
  * `Magic Net` (Show, AreaLevel >= 68) stays AFTER, so magic in area 68-71 still shows and
    an IDENTIFIED magic item shows at any level -- someone identified it for its mods.
  * The whole category is `gen_order 5`, the LAST equipment category, behind
    `Crafting Priority` (-10) and `Rare Equipment` (3). So a good base is claimed by the
    crafting layer before this hide ever runs. That was the author's constraint that the
    hide must never swallow a base worth keeping, and it already held.

⚠️ `Identified False` is the load-bearing exception. Without it this hides a magic item that
someone deliberately identified for its mods, which is the one magic item worth showing.

⚠️ Area 72 is map tier 5 by the standard `area = 67 + tier` formula; tier 6 is area 73. The
author wrote "below 72 (Tier 6)". 72 is used here as the literal number given -- change
BOUNDARY to 73 if the intent was "from T6 onward".

⚠️ NOT a strictness gate on purpose. A gate would make this another thing the player has to
know to switch on; the point is that it follows where you are.
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
REL = os.path.join("Equipment", "Magic Net.json")
TIER = os.path.join(DATA, "tier_definition", REL)

CAT = "Magic Net"
NEW = "Magic Hide Endgame"
BEFORE = "Magic Net"
BOUNDARY = 72


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    tdoc = load(TIER)
    body = tdoc[CAT]
    if NEW in body:
        sys.exit("%r already exists -- already run?" % NEW)

    src = body[BEFORE]
    classes = (src.get("conditions") or {}).get("Class")
    if not classes:
        sys.exit("could not read the Class list from %r" % BEFORE)

    # zh is NOT authored here: reuse the approved string from the tier this sits beside.
    zh = (src.get("localization") or {}).get("ch", "")

    new = OrderedDict([
        ("class_condition", True),
        ("hideable", True),
        ("is_hide_tier", True),
        ("conditions", OrderedDict([
            ("Class", classes),
            ("Rarity", "Magic"),
            ("AreaLevel", ">= %d" % BOUNDARY),
            ("Identified", "False"),
        ])),
        ("theme", OrderedDict([("Tier", 9)])),
        ("sound", OrderedDict([("default_sound_id", -1), ("sharket_sound_id", None)])),
        ("localization", OrderedDict([
            ("en", "Hide unidentified magic gear (area %d+)" % BOUNDARY),
            ("ch", "%s %d+" % (zh, BOUNDARY)),
        ])),
    ])

    order = (body.get("_meta") or {}).get("tier_order") or []
    print("magic band: hide unidentified magic from AreaLevel >= %d" % BOUNDARY)
    print("  inserting %r before %r" % (NEW, BEFORE))
    print("  emission order after this change:")
    for k in order:
        mark = ""
        if k == BEFORE:
            print("     %-24s  <-- NEW hide" % NEW)
        t = body.get(k) or {}
        c = t.get("conditions") or {}
        print("     %-24s  %s%s" % (k, "HIDE " if t.get("is_hide_tier") else "show ",
                                    json.dumps({x: c[x] for x in c if x != "Class"},
                                               ensure_ascii=False)))
    print()
    print("  talismans stay protected: Magic Good Jewellery is first and claims them by NAME")
    print("  identified magic still shows: `Identified False` on the hide lets it fall through")
    print("  crafting still wins: this category is gen_order 5, the last equipment category")

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    rebuilt = OrderedDict()
    for k, v in body.items():
        if k == BEFORE:
            rebuilt[NEW] = new
        rebuilt[k] = v
    body.clear()
    body.update(rebuilt)
    if NEW not in order:
        order.insert(order.index(BEFORE), NEW)

    io.open(TIER, "w", encoding="utf-8").write(
        json.dumps(tdoc, ensure_ascii=False, indent=2) + "\n")
    print("\nwrote %s" % os.path.relpath(TIER, REPO))


if __name__ == "__main__":
    main()
