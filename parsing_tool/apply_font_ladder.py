#!/usr/bin/env python3
"""Re-space the theme's font-size ladder, touching ONLY FontSize.

sharket_theme.json is hand-tuned - colours, effects and icons are the
designer's and the user's work and must not be regenerated. This edits the one
property the ladder decision owns, leaving every other key byte-identical.

    python parsing_tool/apply_font_ladder.py            # show what would change
    python parsing_tool/apply_font_ladder.py --write
"""
from __future__ import annotations

import argparse
import collections
import json
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
THEME = os.path.join(REPO, "filter_generation", "data", "theme", "sharket", "sharket_theme.json")

# The ladder, exactly as specified - seven values for the seven standard slots.
# Tier 0-5 are the visible ranks; 9 is the hide/minimal slot, which still
# renders under Ruthless (Hide becomes Minimal) and so is no longer shrunk to
# near-invisibility.
#
# Tier 6 and 7 exist only in Maps and Campaign and are deliberately NOT in this
# table: no value was specified for them, so they are left exactly as they are
# and reported rather than guessed at.
LADDER = {0: 45, 1: 42, 2: 40, 3: 38, 4: 36, 5: 34, 9: 30}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    with open(THEME, encoding="utf-8-sig") as fh:
        theme = json.load(fh)

    changes = collections.Counter()
    unknown = []
    touched = 0
    for cat, node in theme.items():
        if not isinstance(node, dict):
            continue
        for tier_key, style in node.items():
            if not isinstance(style, dict) or "FontSize" not in style:
                continue
            try:
                n = int(str(tier_key).split()[-1])
            except ValueError:
                unknown.append(f"{cat}/{tier_key}")
                continue
            if n not in LADDER:
                unknown.append(f"{cat}/{tier_key}")
                continue
            old, new = style["FontSize"], LADDER[n]
            if old != new:
                changes[(n, old, new)] += 1
                style["FontSize"] = new
                touched += 1

    print(f"{'WOULD CHANGE' if not args.write else 'CHANGED'} {touched} FontSize values\n")
    print(f"  {'tier':<6} {'old':>4} -> {'new':>4}   categories")
    for (n, old, new), count in sorted(changes.items()):
        print(f"  Tier {n:<2} {old:>4} -> {new:>4}   {count}")
    if unknown:
        print(f"\n  LEFT ALONE - no value specified for these slots ({len(unknown)}):")
        for u in unknown:
            cat, tier = u.split("/")
            print(f"     {cat:<12} {tier}  (currently {theme[cat][tier]['FontSize']})")

    if args.write:
        tmp = THEME + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(theme, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp, THEME)
        print(f"\nwrote {os.path.relpath(THEME, REPO)}")
    else:
        print("\n(dry run - pass --write to apply)")


if __name__ == "__main__":
    main()
