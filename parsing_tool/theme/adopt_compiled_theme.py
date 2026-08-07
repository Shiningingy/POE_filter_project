#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run blindly.
"""Adopt the compiled designer theme as the live one.

    python parsing_tool/theme/adopt_compiled_theme.py            # dry run (default)
    python parsing_tool/theme/adopt_compiled_theme.py --apply

★ Until now the designer's kit did not ship. `generate.mjs:130` reads
`sharket_theme.json` -- the hand-tuned file -- while `compile_theme.py` writes
`sharket_theme.compiled.json` beside it and NOTHING reads that. A fully specified theme
system sat unused.

Adoption is TWO halves and applying either alone breaks the filter:

  1. the ROWS   -> sharket_theme.compiled.json becomes sharket_theme.json
  2. the RE-RANK -> each tier's `theme.Tier` becomes the rung the kit assigned it
                    (rerank.compiled.json, 231 tier blocks)

⚠️ Rows alone leaves 11 visible tiers pointing at rows the compiled theme does not have,
and a tier aimed at a missing row inside an EXISTING category falls back to {} -- not to
Default -- so the block emits `SetFontSize` and no colour at all. That is the trap that has
bitten this project twice.

⚠️ Only `theme.Tier` is rewritten. Every other inline key on a tier (`PlayAlertSound`,
`FontSize`, `BackgroundColor`, ... ) is left exactly as authored -- there is hand-tuning in
there, including edits made in the editor that are not committed yet.

⚠️ `States` (the decorators) deliberately has no compiled rows: decorators carry their style
inline and never read the theme. It is excluded, not missing.

The 23 per-class equipment categories the reshape collapsed are dropped with this, because
nothing references them any more -- verified as a set: every live theme category has a
compiled entry, and the accent map's 52 keys match the tree exactly.
"""
from __future__ import annotations

import argparse
import io
import json
import os
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(REPO, "filter_generation", "data")
TH = os.path.join(DATA, "theme", "sharket")
LIVE = os.path.join(TH, "sharket_theme.json")
COMPILED = os.path.join(TH, "sharket_theme.compiled.json")
RERANK = os.path.join(TH, "rerank.compiled.json")


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, d):
    io.open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    live, comp, rr = load(LIVE), load(COMPILED), load(RERANK)

    same = [c for c in comp if c in live and live[c] == comp[c]]
    changed = [c for c in comp if c in live and live[c] != comp[c]]
    added = [c for c in comp if c not in live]
    dropped = [c for c in live if c not in comp]

    print("rows: %d live -> %d compiled" % (len(live), len(comp)))
    print("   identical : %d" % len(same))
    print("   changed   : %d  %s" % (len(changed), ", ".join(sorted(changed))))
    print("   added     : %d  %s" % (len(added), ", ".join(sorted(added)) or "-"))
    print("   dropped   : %d  (the collapsed per-class equipment categories)" % len(dropped))

    # re-rank, grouped by file
    by_file = defaultdict(list)
    for row in rr:
        by_file[row["file"]].append(row)

    moves, missing = 0, []
    for rel, rows in sorted(by_file.items()):
        tp = os.path.join(DATA, "tier_definition", rel.replace("/", os.sep))
        if not os.path.exists(tp):
            missing.append(rel)
            continue
        doc = load(tp)
        cat = next(iter(doc))
        for row in rows:
            entry = doc[cat].get(row["tier_key"])
            if not isinstance(entry, dict):
                missing.append("%s :: %s" % (rel, row["tier_key"]))
                continue
            cur = (entry.get("theme") or {}).get("Tier")
            if cur != row["Tier"]:
                moves += 1
        if args.apply:
            for row in rows:
                entry = doc[cat].get(row["tier_key"])
                if isinstance(entry, dict):
                    # ONLY the rung. Every other inline key survives untouched.
                    entry.setdefault("theme", OrderedDict())["Tier"] = row["Tier"]
            dump(tp, doc)

    print("\nre-rank: %d tier blocks, %d change their rung" % (len(rr), moves))
    if missing:
        print("  !! %d re-rank rows do not resolve: %s" % (len(missing), missing[:5]))

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    dump(LIVE, comp)
    print("\nwrote sharket_theme.json (%d categories) and %d tier files"
          % (len(comp), len(by_file)))
    print("NOW: regenerate and check that no visible block lost its style.")


if __name__ == "__main__":
    main()
