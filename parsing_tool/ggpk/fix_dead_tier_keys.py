#!/usr/bin/env python3
# [parsing_tool group D: SPENT ONE-SHOT, 2026-07] Already applied to the tree.
# Re-running reverts that region to its 2026-07 state and destroys curation done
# since. Kept as the record of how the tree got its shape. See parsing_tool/README.md.
"""Repair mapping entries whose tier key does not exist, so they emit nothing.

A tier key absent from the category's `_meta.tier_order` does NOT error. The
generator appends it to the order and then skips it for having no tier entry
(generate.py:386-394), so those items produce no output at all. Underscore
folders (`_legacy`, `_campaign`) are exempt - they remap undeclared keys to
their first non-hide tier on purpose (generate.py:365).

Found by `reconcile.py`; every dead key turned out to be the item CLASS name
where the category's tier suffix was wanted ("Tier 1 Divination Cards" against a
declared "Tier 1 Cards"), so these are renames, not re-tierings - almost
certainly fallout from an old bulk-generation script.

    python parsing_tool/ggpk/fix_dead_tier_keys.py --label 3.29.0.2.2
    python parsing_tool/ggpk/fix_dead_tier_keys.py --label 3.29.0.2.2 --write

Dry run by default. The rename is chosen by matching the dead key's tier NUMBER
against the declared ladder ("Tier 1 Maps" -> "Tier 1 Base Maps"); anything that
does not match unambiguously is reported and left alone rather than guessed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import jsonio  # noqa: E402  (sibling module; keeps the diff free of reformatting)

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BASE_MAPPING = os.path.join(REPO, "filter_generation", "data", "base_mapping")


def rename_for(dead: str, declared: list[str]) -> str | None:
    """'Tier 1 Maps' + ['Tier 0 Base Maps','Tier 1 Base Maps',...] -> 'Tier 1 Base Maps'."""
    m = re.match(r"^(Tier\s+\S+)\b", dead)
    if not m:
        return None
    prefix = m.group(1)
    hits = [d for d in declared if d.startswith(prefix) and "Hide" not in d]
    return hits[0] if len(hits) == 1 else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--label", required=True, help="dump whose reconcile.json to read")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--skip", nargs="*", default=["Divination Cards/Cards.json"],
                    help="files to leave alone (default: div cards - deferred to the "
                         "softcore port, and their category is excluded from ruthless anyway)")
    args = ap.parse_args()

    rep_path = os.path.join(REPO, "data", "source", args.label, "reconcile.json")
    if not os.path.exists(rep_path):
        sys.exit(f"ERROR: no {rep_path}\n  Run reconcile.py --label {args.label} first")
    with open(rep_path, encoding="utf-8") as fh:
        rep = json.load(fh)

    planned, ambiguous, skipped = {}, [], []
    for d in rep["tier_key_drift"]:
        if not d["drops"]:
            continue                       # underscore folders remap by design
        if d["file"] in args.skip:
            skipped.append((d["file"], sum(d["undeclared"].values())))
            continue
        for dead, count in sorted(d["undeclared"].items(), key=lambda kv: -kv[1]):
            new = rename_for(dead, d["declared"])
            if new is None:
                ambiguous.append((d["file"], dead, count, d["declared"]))
            else:
                planned.setdefault(d["file"], []).append((dead, new, count))

    total = sum(c for rows in planned.values() for _, _, c in rows)
    print(f"{total} entries across {len(planned)} files\n")
    for rel, rows in sorted(planned.items()):
        print(f"  {rel}")
        for dead, new, count in rows:
            print(f"     {dead!r:<34} -> {new!r}   ({count} entries)")

    if skipped:
        print("\n  skipped by request:")
        for rel, n in skipped:
            print(f"     {rel}  ({n} entries)")
    if ambiguous:
        print("\n  AMBIGUOUS - left alone, decide by hand:")
        for rel, dead, count, declared in ambiguous:
            print(f"     {rel}  {dead!r} x{count}\n        declared: {declared}")

    if not args.write:
        print("\nDry run - nothing written. Re-run with --write to apply.")
        return

    for rel, rows in sorted(planned.items()):
        path = os.path.join(BASE_MAPPING, rel)
        doc, style = jsonio.read_json(path)
        table = {dead: new for dead, new, _ in rows}
        mapping = doc.get("mapping") or {}
        for name, tier in list(mapping.items()):
            if isinstance(tier, list):
                mapping[name] = [table.get(t, t) for t in tier]
            elif tier in table:
                mapping[name] = table[tier]
        jsonio.write_json(path, doc, style)
    print(f"\nWrote {total} entries across {len(planned)} files.")
    print("Next: python filter_generation/generate.py --mode ruthless")


if __name__ == "__main__":
    main()
