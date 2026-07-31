#!/usr/bin/env python3
# [parsing_tool group B: CAREFUL] Rerunnable, but it OVERWRITES hand-tuned data.
# Check `git status` is clean first. See parsing_tool/README.md.
"""Port FilterBlade's uniques tiering into our curation, once, with a paper trail.

This is a ONE-TIME import by the user's decision (2026-07-29): take 3.29's tiering
now, then maintain our own database from next league on. It is written as a tool
rather than a script-shaped edit so the result is auditable and re-derivable
rather than a 500-line unexplained diff.

    python parsing_tool/import_uniques_tiers.py                 # report only
    python parsing_tool/import_uniques_tiers.py --snapshot      # + write derived/
    python parsing_tool/import_uniques_tiers.py --apply add     # safe class only
    python parsing_tool/import_uniques_tiers.py --apply add,retier   # everything

WHY IT IS NOT A BLIND OVERWRITE
-------------------------------
FilterBlade tiers uniques by BASE TYPE against the STANDARD TRADE ECONOMY. Ours
is a Ruthless filter, where there is no trade and drop rates are a fraction. Our
tree has been hand-tuned against that, so their tier is evidence, not truth --
150 of our base types sit >=3 rungs from their 3.29 call and many of those are
deliberate. Changes are therefore split into classes you opt into:

  add      base types FilterBlade lists that we do not curate at all. Pure
           addition - it cannot overwrite a decision, because there is none.
  retier   base types we both carry, where their 3.29 rung differs from ours.
           THIS IS THE ONE THAT OVERWRITES HAND TUNING. Opt in deliberately.

Never applied automatically, reported only:
  dropped  base types FilterBlade stopped listing. Whether an item still drops is
           a per-MODE question the wiki and the user answer, not FilterBlade -
           see docs/adr/0005 and the Ruthless droppability work.

PROVENANCE
----------
--snapshot writes data/from_filter_blade/derived/uniques_tiers_<version>.json,
stamped with the FilterBlade version string parsed out of the source filter. That
file is the input to next league's diff: it makes "what did they change" a query
instead of an archaeology exercise, and it means our tree never points at their
file at runtime.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "ggpk"))
from jsonio import read_json, write_json  # noqa: E402

SRC = os.path.join(REPO, "data", "from_filter_blade", "3.29", "FilterBlade.filter")
PREV = os.path.join(REPO, "data", "from_filter_blade", "3.28",
                    "FilterBlade_1_Regular.filter")
MAP = os.path.join(REPO, "filter_generation", "data", "base_mapping",
                   "Uniques", "General.json")
TIERS = os.path.join(REPO, "filter_generation", "data", "tier_definition",
                     "Uniques", "General.json")
DERIVED = os.path.join(REPO, "data", "from_filter_blade", "derived")

TAG = re.compile(r"\$type->(uniques[a-z0-9>_-]*)(?:\s+\$tier->([a-z0-9_>-]+))?")

# FilterBlade rung -> our tier. Their ladder is finer than ours at the bottom;
# t3boss ("this base only matters because a boss drops a chase unique on it")
# collapses into T3, which is what our tree already does.
LADDER = {
    "t1": "T1", "t2": "T2", "t3": "T3", "t3boss": "T3",
    "multispecialhigh": "T2", "multispecial": "T3", "multi": "T3",
    "hideable2": "Low+", "hideable": "Low",
}
# Blocks that are exceptions rather than rungs. They become RULES in our model
# (see plan-bound-variants), so a name appearing only there is not something this
# importer can place - it is reported and left alone.
EXCEPTION = re.compile(r"^(ex|[0-9]x|vestige|foulborn|corrupted|overqual|5link|6s|restex)")


def parse_filter(path: str) -> tuple[dict, str]:
    """name -> {tag: rung}, keeping EVERY list a base type appears in.

    A base type is routinely in several: `Ancient Spirit Shield` is in the main
    ladder AND in foulborn:t3. Collapsing those to whichever block comes first
    (as the game does) is right for matching but wrong for tiering - it would
    re-tier a base type's main entry from its foulborn rung. They are separate
    ladders and, in our model, separate mechanisms: the main ladder is `mapping`,
    replicas and foulborn are RULES carrying a Replica/Foulborn condition.
    """
    raw = open(path, encoding="utf-8").read()
    m = re.search(r"^# VERSION:\s*(\S+)", raw, re.M)
    version = m.group(1) if m else "unknown"
    out: dict[str, dict[str, str]] = collections.defaultdict(dict)
    for block in re.split(r"\n(?=Show|Hide)", raw):
        t = TAG.search(block)
        if not t:
            continue
        tag, rung = t.group(1), t.group(2) or "-"
        for bt in re.finditer(r"^\s*BaseType\s*(==)?\s*(.+)$", block, re.M):
            for name in re.findall(r'"([^"]+)"', bt.group(2)):
                out[name].setdefault(tag, rung)
    return dict(out), version


def our_tiers(doc: dict) -> dict[str, list[str]]:
    return {n: (v if isinstance(v, list) else [v])
            for n, v in (doc.get("mapping") or {}).items()}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", default="", help="comma list: add,retier")
    ap.add_argument("--snapshot", action="store_true",
                    help="write the provenance snapshot under derived/")
    args = ap.parse_args()
    classes = {c.strip() for c in args.apply.split(",") if c.strip()}
    unknown = classes - {"add", "retier"}
    if unknown:
        print(f"unknown --apply class: {', '.join(sorted(unknown))}")
        return 2

    new, version = parse_filter(SRC)
    old, prev_version = parse_filter(PREV)
    doc, style = read_json(MAP)
    ours = our_tiers(doc)
    declared = set()
    tdoc, _ = read_json(TIERS)
    for k, body in tdoc.items():
        if isinstance(body, dict) and isinstance(body.get("_meta"), dict):
            declared = set(body["_meta"].get("tier_order", []))

    print(f"FilterBlade {version} ({len(new)} unique base types) "
          f"vs {prev_version} ({len(old)})")
    print(f"ours: {len(ours)} base types, tiers declared: {len(declared)}\n")

    add, retier, sub_ladder, unplaceable = {}, {}, [], []
    for name, tags in sorted(new.items()):
        rung = tags.get("uniques")          # the MAIN ladder only
        if rung is None:
            # Only ever seen in a replica/foulborn/maps/heist list. Those are
            # rules in our model, not mapping rungs - report, never place.
            sub_ladder.append((name, sorted(tags.items()), ours.get(name)))
            continue
        if EXCEPTION.match(rung):
            unplaceable.append((name, "uniques", rung, ours.get(name)))
            continue
        dest = LADDER.get(rung)
        if dest is None or dest not in declared:
            unplaceable.append((name, "uniques", rung, ours.get(name)))
            continue
        if name not in ours:
            add[name] = (dest, "uniques", rung)
        elif dest not in ours[name]:
            retier[name] = (ours[name], dest, "uniques", rung)

    dropped = {n: old[n].get("uniques", "-") for n in sorted(set(old) - set(new))
               if n in ours}

    print(f"  add       {len(add):>4}   main-ladder base types we do not curate")
    print(f"  retier    {len(retier):>4}   we both carry, their 3.29 main rung differs")
    print(f"  dropped   {len(dropped):>4}   FB stopped listing, we still carry "
          f"(REPORTED ONLY - droppability is a per-mode call)")
    print(f"  sub-list  {len(sub_ladder):>4}   only in replicas/foulborn/maps/heist; "
          f"those are RULES here, never placed by this tool")
    print(f"  skipped   {len(unplaceable):>4}   main-list EXCEPTION blocks (ex*/abyss/"
          f"corrupted); also rules")

    if add:
        print("\n--- add ---")
        for n, (dest, tag, rung) in sorted(add.items()):
            print(f"   {n:34} -> {dest:6}  (FB {tag.replace('uniques','u')}:{rung})")
    if retier:
        print("\n--- retier ---")
        by = collections.Counter()
        for n, (cur, dest, tag, rung) in sorted(retier.items()):
            by[(tuple(cur), dest)] += 1
            print(f"   {n:34} {','.join(cur):10} -> {dest:6}  "
                  f"(FB {tag.replace('uniques','u')}:{rung})")
        print("\n   shape of the move:")
        for (cur, dest), c in by.most_common():
            print(f"     {','.join(cur):12} -> {dest:8} {c}")
    if dropped:
        print("\n--- dropped by FilterBlade, still ours (review, not applied) ---")
        for n, rung in dropped.items():
            print(f"   {n:34} ours={ours[n]}  was FB u:{rung}")

    if args.snapshot:
        os.makedirs(DERIVED, exist_ok=True)
        out = os.path.join(DERIVED, f"uniques_tiers_{version}.json")
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            json.dump({
                "_source": {
                    "tool": "parsing_tool/import_uniques_tiers.py",
                    "filterblade_version": version,
                    "source_file": os.path.relpath(SRC, REPO).replace("\\", "/"),
                    "note": ("Derived snapshot for provenance and next-league "
                             "diffing. Our curation never reads this at runtime."),
                },
                # every list a base type appears in, not just the first match
                "tiers": {n: {t: r for t, r in sorted(tags.items())}
                          for n, tags in sorted(new.items())},
            }, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print(f"\nsnapshot -> {os.path.relpath(out, REPO)}")

    if not classes:
        print("\n(report only; pass --apply add[,retier] to write)")
        return 0

    mapping = doc["mapping"]
    changed = 0

    def put(name: str, dest: str) -> None:
        """Write in the shape this file already uses.

        The tree stores a single tier as a bare string and only uses a list for
        genuine multi-homing. Writing ["T3"] where "T3" was would triple the line
        count of every touched entry and bury an 87-line change in a 341-line
        diff - unreviewable, which is the whole point of jsonio existing.
        """
        prev = mapping.get(name)
        mapping[name] = [dest] if isinstance(prev, list) and len(prev) > 1 else dest

    if "add" in classes:
        for n, (dest, _, _) in add.items():
            put(n, dest)
            changed += 1
    if "retier" in classes:
        for n, (cur, dest, _, _) in retier.items():
            put(n, dest)
            changed += 1
    if changed:
        write_json(MAP, doc, style)
        print(f"\nwrote {changed} entr(y|ies) to "
              f"{os.path.relpath(MAP, REPO).replace(chr(92), '/')}")
        print("Formatting preserved via ggpk/jsonio. Review with `git diff`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
