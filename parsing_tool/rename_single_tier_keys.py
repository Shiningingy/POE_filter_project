#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Drop the tier number from categories that only have one tier.

    python parsing_tool/rename_single_tier_keys.py            # dry run
    python parsing_tool/rename_single_tier_keys.py --apply

A category with a single non-hide tier does not need to call it 'T0' or 'Tier 1' -- the number
ranks it against siblings it does not have. Three spellings are in use today, which is the
actual problem: 'Enshrouding Crystals', 'Voyage Charts T0' and 'Tier 0 Delirium Orbs' are the
same idea written three ways.

SAFE because the tier key is not the theme key. Every one of these carries an explicit
`theme.Tier`, so the digit in the key is never parsed for styling -- proven by the three that
already have no digit and theme correctly anyway. The key is also not in the output: block
comments are built from `localization`, so the generated filter should be BYTE-IDENTICAL.

⚠️ A tier key is named in FIVE places and all five must move together. This list was measured
   by scanning every JSON value in data/ for known tier keys, not guessed -- the first attempt
   guessed three, missed two, and changed the filter by 34 lines:

      1. the key itself in tier_definition
      2. tier_definition _meta.tier_order[]                (lists keys)
      3. base_mapping mapping.<base>                       (string or list)
      4. base_mapping rules[].overrides.Tier               <-- MISSED FIRST TIME
      5. theme/sharket/rerank.compiled.json [].tier_key    <-- MISSED FIRST TIME

   Miss #3 or #4 and the reference silently resolves onto the first non-hide tier -- the same
   defect just cleaned out of _legacy/Legacy.json. Miss #5 and nothing breaks now, but the next
   run of apply_compiled.py skips those blocks without saying so.

   The tier key is NOT in the generated filter (block comments come from `localization`), so a
   correct rename is byte-identical. That is the check that caught the first attempt.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DATA = os.path.join(REPO, "filter_generation", "data")
TD = os.path.join(DATA, "tier_definition")
BM = os.path.join(DATA, "base_mapping")

# Names where the number is a real distinction rather than a rank, so they keep it.
KEEP = {"Chancing Normal"}

HIDE = re.compile(r"\bhide\b", re.I)
LEAD = re.compile(r"^(?:Tier|T)\s*\d+\s+", re.I)     # 'Tier 0 Delirium Orbs'
TRAIL = re.compile(r"\s+(?:Tier|T)\s*\d+$", re.I)    # 'Voyage Charts T0'


def strip_rank(key):
    new = LEAD.sub("", key)
    new = TRAIL.sub("", new)
    return new.strip()


def walk(root):
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if f.endswith(".json"):
                yield os.path.join(dirpath, f)


def plan():
    """-> {relpath: {old_key: new_key}} for categories with exactly one non-hide tier."""
    out = {}
    for p in walk(TD):
        rel = os.path.relpath(p, TD)
        doc = json.load(io.open(p, encoding="utf-8"))
        renames = {}
        for _cat, body in doc.items():
            if not isinstance(body, dict):
                continue
            keys = [k for k in body if k != "_meta"]
            real = [k for k in keys if not HIDE.search(k)]
            if len(real) != 1:
                continue
            old = real[0]
            if old in KEEP:
                continue
            new = strip_rank(old)
            if new and new != old and new not in keys:
                renames[old] = new
        if renames:
            out[rel] = renames
    return out


def apply_to_tier_file(path, renames):
    doc = json.load(io.open(path, encoding="utf-8"))
    for _cat, body in doc.items():
        if not isinstance(body, dict):
            continue
        for old, new in renames.items():
            if old in body:
                # dict order is the tier order on disk; rebuild to keep it stable
                rebuilt = {}
                for k, v in body.items():
                    rebuilt[new if k == old else k] = v
                body.clear()
                body.update(rebuilt)
        meta = body.get("_meta")
        if isinstance(meta, dict) and isinstance(meta.get("tier_order"), list):
            meta["tier_order"] = [renames.get(k, k) for k in meta["tier_order"]]
    io.open(path, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def apply_to_mapping(path, renames):
    """Rewrite every reference. Returns how many values moved."""
    doc = json.load(io.open(path, encoding="utf-8"))
    n = 0

    def fix(v):
        nonlocal n
        if isinstance(v, str) and v in renames:
            n += 1
            return renames[v]
        return v

    mapping = doc.get("mapping")
    if isinstance(mapping, dict):
        for base, val in list(mapping.items()):
            mapping[base] = [fix(x) for x in val] if isinstance(val, list) else fix(val)
    for rule in doc.get("rules", []) or []:
        if not isinstance(rule, dict):
            continue
        # A rule names its tier as overrides.Tier -- NOT rule.tier, which is what the first
        # version of this script assumed. That assumption cost 34 lines of filter.
        ov = rule.get("overrides")
        if isinstance(ov, dict) and "Tier" in ov:
            val = ov["Tier"]
            ov["Tier"] = [fix(x) for x in val] if isinstance(val, list) else fix(val)
    if n:
        io.open(path, "w", encoding="utf-8").write(
            json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
    return n


def main():
    do = "--apply" in sys.argv
    p = plan()
    total = sum(len(v) for v in p.values())
    print("categories with one non-hide tier to rename: %d" % total)
    for rel, renames in sorted(p.items()):
        for old, new in renames.items():
            print("   %-44s %-30s -> %s" % (rel, old, new))
    if not do:
        print("\n(dry run - pass --apply)")
        return

    moved = 0
    for rel, renames in p.items():
        apply_to_tier_file(os.path.join(TD, rel), renames)
        mp = os.path.join(BM, rel)
        if os.path.exists(mp):
            moved += apply_to_mapping(mp, renames)
    # A tier can be referenced from another file's mapping too, so sweep them all.
    allren = {}
    for renames in p.values():
        allren.update(renames)
    for mp in walk(BM):
        moved += apply_to_mapping(mp, allren)

    # The theme compile's record of what it re-ranked. Nothing reads it at runtime, but a
    # stale tier_key makes the next apply_compiled.py run skip that block in silence.
    rerank = os.path.join(DATA, "theme", "sharket", "rerank.compiled.json")
    if os.path.exists(rerank):
        doc = json.load(io.open(rerank, encoding="utf-8"))
        hits = 0
        for entry in doc if isinstance(doc, list) else []:
            if isinstance(entry, dict) and entry.get("tier_key") in allren:
                entry["tier_key"] = allren[entry["tier_key"]]
                hits += 1
        if hits:
            io.open(rerank, "w", encoding="utf-8").write(
                json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
        print("rerank.compiled.json: %d tier_key(s) updated" % hits)

    print("\nrewrote %d mapping/rule reference(s)" % moved)
    print("the generated filter MUST be byte-identical - check it")


if __name__ == "__main__":
    main()
