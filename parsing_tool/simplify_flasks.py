#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Cut Life/Mana flasks down to two tiers: over-quality, and the top bases.

    python parsing_tool/simplify_flasks.py            # dry run (default)
    python parsing_tool/simplify_flasks.py --apply

Author: life/mana flasks are useless unless you are specifically crafting them, so two
tiers is all they need -- T1 over-quality, always shown; T2 the plain Eternal/Divine bases,
hidden after semi-strict.

The current shape does not say that at all. `Tier 1` is LABELLED "T1: Divine/Eternal" but
holds all 18 life bases including `Small Life Flask`, and the over-quality rule points at
that same tier -- so the label lies and a Small Life Flask gets the top rung. `Tier 0` and
`Tier 2` are empty (4 of the tree's 13 standing validator warnings are these).

After:

    Tier 1  <- the over-quality RULE only (ItemLevel >= 82, Quality >= 20), no bases,
               no strictness gate: always shown
    Tier 2  <- Eternal + Divine bases, hide_at_strictness 3 (shown at semi-strict,
               hidden from strict up)
    Tier 0  removed (empty)

Everything else is unmapped and therefore not shown, which is the point: a Small Life Flask
in maps is noise.

⚠️ Hybrid flasks live in the Life file and are NOT kept. The author named Eternal/Divine;
hybrids are neither, and inventing a rung for them would be a guess. They are listed by the
script so restoring any is one edit.

⚠️ No zh is authored. T2 inherits the "Divine/Eternal" label that was already on T1 (it is
finally true there), and T1 takes 超额品质 -- the string already approved on
`Crafting Over Quality`.
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

FILES = ["Life", "Mana"]
KEEP_PREFIX = ("Eternal ", "Divine ")
GATE = 3          # shown at semistrict (2), hidden from strict (3)


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, doc):
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    for name in FILES:
        tp = os.path.join(DATA, "tier_definition", "Flasks", "%s.json" % name)
        mp = os.path.join(DATA, "base_mapping", "Flasks", "%s.json" % name)
        tdoc, mdoc = load(tp), load(mp)
        cat = next(iter(tdoc))
        body = tdoc[cat]
        T0, T1, T2 = ("Tier %d %s Flasks" % (i, name) for i in (0, 1, 2))
        if T0 not in body:
            sys.exit("%s: %r already gone -- already run?" % (name, T0))

        mapping = mdoc.get("mapping") or OrderedDict()
        keep = [b for b in mapping if b.startswith(KEEP_PREFIX)]
        drop = [b for b in mapping if b not in keep and not str(mapping[b]).count("Hide")]

        print("== %s Flasks" % name)
        print("   T2 keeps  : %s" % ", ".join(sorted(keep)))
        print("   unmapped  : %d  (%s)" % (len(drop), ", ".join(sorted(drop))))
        print("   T1        : over-quality rule only, no gate (always shown)")
        print("   T2 gate   : hide_at_strictness=%d" % GATE)
        print("   removing  : %s (empty)" % T0)

        if not args.apply:
            continue

        # T2 inherits T1's Divine/Eternal label -- true there for the first time.
        t1_loc = OrderedDict(body[T1].get("localization") or {})
        body[T2]["localization"] = t1_loc
        body[T2]["hide_at_strictness"] = GATE
        body[T1]["localization"] = OrderedDict([
            ("en", "T1: Over-quality"), ("ch", "T1: 超额品质"),
        ])
        body[T1].pop("hide_at_strictness", None)
        body.pop(T0, None)
        order = (body.get("_meta") or {}).get("tier_order")
        if isinstance(order, list) and T0 in order:
            order.remove(T0)

        for b in list(mapping):
            if b in keep:
                mapping[b] = T2
            elif b in drop:
                del mapping[b]
        mdoc["mapping"] = OrderedDict(sorted(mapping.items()))

        dump(tp, tdoc)
        dump(mp, mdoc)

    if not args.apply:
        print("\n(dry run -- pass --apply)")
    else:
        print("\nwrote both flask files")


if __name__ == "__main__":
    main()
