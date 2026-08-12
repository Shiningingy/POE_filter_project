#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Remove the two duplicate nav homes from category_structure.json.

    python parsing_tool/dedupe_nav.py            # dry run
    python parsing_tool/dedupe_nav.py --apply

Ten of 96 nav leaves pointed at a file that was already reachable by another path. Same file,
two routes: no data divergence, but the editor showed each twice and the tier-review artifact
counted every one of those ladders twice.

Two cases, resolved DIFFERENTLY because they are different problems:

  Heist -- a SPLIT on what the items are, not a dedupe. Contracts and Blueprints are
  consumables that open an area, so they belong with the other area-openers under
  `Maps & Fragments > Heist`. Heist Equipment and Targets are gear and stay under
  `Heist Gear`. Both homes survive; the overlap does not.

  League bases -- a true duplicate. The same 8 files sat at flat `League Bases` and at nested
  `League-Specific > Exotic Bases`, and that nested wrapper's only real content WAS the
  duplicate: its other two subgroups are empty placeholders left over from the FilterBlade nav
  mirror. The flat home survives and the wrapper goes.

⚠️ Nav is not just display. `_meta.theme_category` on the tier file is what the generator
themes by, but the nav is what the EDITOR walks -- so a file with no nav leaf is uneditable,
and a file with two is editable from two places that look like different things.
"""
from __future__ import annotations

import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PATH = os.path.join(REPO, "filter_generation", "data", "category_structure.json")

# Files to drop from a named group, leaving their other home intact.
DROP_FROM = {
    "Heist Gear": ["Heist/Blueprints.json", "Heist/Contracts.json"],
}
# Whole groups to delete, matched on their English label.
DROP_GROUP = ["League-Specific"]

CHILD_KEYS = ("subgroups", "groups", "children", "chapters", "categories")


def label(node):
    if not isinstance(node, dict):
        return None
    return (node.get("_meta", {}) or {}).get("localization", {}).get("en")


def leaves(node, path=()):
    """Every (nav path, file path) pair, so duplicates can be counted before and after."""
    if isinstance(node, list):
        for c in node:
            yield from leaves(c, path)
        return
    if not isinstance(node, dict):
        return
    p = path + ((label(node),) if node.get("_meta") else ())
    for f in node.get("files", []) or []:
        yield " > ".join(x for x in p if x), f.get("path")
    for k in CHILD_KEYS:
        for c in node.get(k, []) or []:
            yield from leaves(c, p)


def prune(node, report):
    """Depth-first, in place. Returns True if the caller should delete this node."""
    if isinstance(node, list):
        keep = []
        for c in node:
            if not prune(c, report):
                keep.append(c)
        node[:] = keep
        return False
    if not isinstance(node, dict):
        return False

    name = label(node)
    if name in DROP_GROUP:
        report.append("removed group  %s" % name)
        return True

    if name in DROP_FROM:
        wanted = set(DROP_FROM[name])
        before = node.get("files", []) or []
        after = [f for f in before if f.get("path") not in wanted]
        for f in before:
            if f.get("path") in wanted:
                report.append("removed leaf   %-28s from %s" % (f.get("path"), name))
        node["files"] = after

    for k in CHILD_KEYS:
        if k in node:
            prune(node[k], report)
    return False


def duplicates(doc):
    seen = {}
    for nav, f in leaves(doc):
        if f:
            seen.setdefault(f, []).append(nav)
    return {f: n for f, n in seen.items() if len(n) > 1}


def main():
    apply = "--apply" in sys.argv
    doc = json.load(io.open(PATH, encoding="utf-8"))

    before_leaves = len(list(leaves(doc)))
    before_dupes = duplicates(doc)
    print("before : %d nav leaves, %d files reachable twice" % (before_leaves, len(before_dupes)))

    report = []
    prune(doc, report)
    for line in report:
        print("   " + line)

    after_leaves = len(list(leaves(doc)))
    after_dupes = duplicates(doc)
    print("after  : %d nav leaves, %d files reachable twice" % (after_leaves, len(after_dupes)))
    for f, navs in sorted(after_dupes.items()):
        print("   STILL DUPLICATED %s -> %s" % (f, navs))

    # A file that lost its LAST nav leaf becomes uneditable, which is worse than a duplicate.
    before_files = {f for _, f in leaves(json.load(io.open(PATH, encoding="utf-8"))) if f}
    after_files = {f for _, f in leaves(doc) if f}
    orphaned = before_files - after_files
    if orphaned:
        print("\n!! %d file(s) would lose their only nav home:" % len(orphaned))
        for f in sorted(orphaned):
            print("     %s" % f)
        sys.exit("refusing to write - that would make them uneditable")

    if not apply:
        print("\n(dry run - pass --apply)")
        return

    io.open(PATH, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    print("\nwrote %s" % os.path.relpath(PATH, REPO))


if __name__ == "__main__":
    main()
