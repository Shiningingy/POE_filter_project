#!/usr/bin/env python3
# [parsing_tool group C: ONE-SHOT] Run once, review the diff, never re-run.
"""Collapse the 23 per-class equipment ladders into one `Rare Equipment` category.

    python parsing_tool/collapse_rare_equipment.py            # dry run (default)
    python parsing_tool/collapse_rare_equipment.py --apply

★ Why this is safe, measured 2026-08-06 rather than assumed:

  * All 23 ladders are UNIFORM -- `hide_at_strictness` T1=5/T2=3/T3=2/T4=1,
    `theme.Tier` 2/3/3/4/5/9, identical sounds, identical
    `AreaLevel >= 68 · Rarity Rare`. There is no per-class distinction to lose.
  * `_meta.item_class` reaches ONLY comment headers in filterGenerator.ts
    (lines 382/416/543/614) and never an emitted condition, so merging the 23
    cannot change what the filter matches -- only how blocks are grouped.
  * 60 `item_overrides` across the 23 files, ZERO collisions.
  * Only 2 bases sit in two ladder files (`Imperial Skean`, `Piledriver`), and both
    are misfilings that the merge dissolves.

  And it is what our own data already says: our per-class T1/T2/T3 IS FilterBlade's
  `rr` ladder (259 agree, 0 disagree). One ladder, split 23 ways for no reason.

⚠️ Trinkets is deliberately NOT collapsed. It is one base (`Thief's Trinket`, a Heist
item) with no `AreaLevel` gate, its own labels, no sounds and its own theme hue. It is
a different thing that happens to live in the Jewellery folder.

⚠️ A tier key lives in FIVE places and this script must touch all of them, or the
filter breaks quietly (it did once, by 34 lines, when `rules[].overrides.Tier` and
`rerank.compiled.json[].tier_key` were missed):
    1. the key in tier_definition
    2. tier_definition `_meta.tier_order[]`
    3. base_mapping `mapping.<base>`
    4. base_mapping `rules[].overrides.Tier`
    5. `theme/sharket/rerank.compiled.json[].tier_key`  (which also carries `file`)
Plus, for THIS change only, a sixth: the theme categories keyed by class.

⚠️ THE ZH LABEL IS NOT HAND-WRITTEN. `LABEL_CH` below is copied verbatim from the
`General Gear` separator already approved in `category_structure.json`. Never
transliterate -- 11/11 hand-written names were wrong once. If a different name is
wanted, the author supplies the exact string.

★ The theme keeps ONE hue by decision (author, 2026-08-06). The tree today has three
gear-family hues -- weapons #221a16, armour #1a1e23, jewellery #242014. Collapsing
picks armour's, which covers the most bases and is the most neutral of the three. The
gear-family distinction becomes a PENDING sub-axis, recorded in docs/pending-features.md,
not silently dropped. The old 23 theme categories are LEFT IN PLACE, unread, so this is
one `git revert` away -- per the project's "leave the trace" convention.
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
TIER_DIR = os.path.join(DATA, "tier_definition", "Equipment")
MAP_DIR = os.path.join(DATA, "base_mapping", "Equipment")
NAV = os.path.join(DATA, "category_structure.json")
THEME = os.path.join(DATA, "theme", "sharket", "sharket_theme.json")
THEME_C = os.path.join(DATA, "theme", "sharket", "sharket_theme.compiled.json")
RERANK = os.path.join(DATA, "theme", "sharket", "rerank.compiled.json")

NEW_CAT = "Rare Equipment"
NEW_REL = os.path.join("Equipment", NEW_CAT + ".json").replace("\\", "/")
LABEL_EN = "Rare Equipment"
LABEL_CH = "常规装备"          # verbatim from the existing `General Gear` separator
HUE_SOURCE = "Body Armours"    # whose theme rows the merged category inherits
SKIP = {"Trinkets"}
SUBS = ["Armour", "Weapons", "Jewellery"]
TEMPLATE = "Body Armours"      # the ladder whose tier bodies become the merged ones


def rel(p):
    return os.path.relpath(p, REPO).replace("\\", "/")


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, doc):
    io.open(p, "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n")


def sources():
    """The 23 (tier, mapping, class-name) triples, in Armour → Weapons → Jewellery order."""
    out = []
    for sub in SUBS:
        d = os.path.join(TIER_DIR, sub)
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".json"):
                continue
            name = fn[:-5]
            if name in SKIP:
                continue
            out.append((os.path.join(d, fn), os.path.join(MAP_DIR, sub, fn), name, sub))
    return out


def tier_suffix(key):
    """`Tier 2 Body Armours` → `2`; `Tier Hide Bows` → `Hide`. None if not a ladder key."""
    if not key.startswith("Tier "):
        return None
    rest = key[5:].split(None, 1)
    return rest[0] if rest else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    src = sources()
    print("collapsing %d per-class ladders into %r" % (len(src), NEW_CAT))
    print("  skipped deliberately: %s" % ", ".join(sorted(SKIP)))

    # ── build the merged tier_definition from the template ────────────────────
    tdoc = load(os.path.join(TIER_DIR, "Armour", TEMPLATE + ".json"))
    tbody = tdoc[TEMPLATE]
    merged_tiers = OrderedDict()
    key_map = {}                        # (class, old key) → new key
    order = []
    for old_key, val in tbody.items():
        if old_key == "_meta":
            continue
        suf = tier_suffix(old_key)
        if suf is None:
            sys.exit("unexpected tier key in template: %r" % old_key)
        new_key = "Tier %s %s" % (suf, NEW_CAT)
        body = json.loads(json.dumps(val), object_pairs_hook=OrderedDict)
        body.pop("item_overrides", None)          # re-merged from every source below
        merged_tiers[new_key] = body
        order.append(new_key)

    for tpath, mpath, name, sub in src:
        d = load(tpath)
        cat = next(iter(d))
        for old_key in d[cat]:
            if old_key == "_meta":
                continue
            suf = tier_suffix(old_key)
            if suf is None:
                print("  !! %s: non-ladder tier key %r -- left behind" % (name, old_key))
                continue
            key_map[(name, old_key)] = "Tier %s %s" % (suf, NEW_CAT)

    # ── merge item_overrides (verified collision-free) ─────────────────────────
    ov_count = 0
    for tpath, mpath, name, sub in src:
        d = load(tpath)
        cat = next(iter(d))
        for old_key, val in d[cat].items():
            if old_key == "_meta" or not isinstance(val, dict):
                continue
            new_key = key_map.get((name, old_key))
            if not new_key:
                continue
            for base, o in (val.get("item_overrides") or {}).items():
                tgt = merged_tiers[new_key].setdefault("item_overrides", OrderedDict())
                if base in tgt and tgt[base] != o:
                    sys.exit("item_overrides collision on %r in %s" % (base, new_key))
                tgt[base] = o
                ov_count += 1

    new_tdoc = OrderedDict()
    new_tdoc[NEW_CAT] = OrderedDict()
    new_tdoc[NEW_CAT]["_meta"] = OrderedDict([
        ("theme_category", NEW_CAT),
        ("localization", OrderedDict([("en", LABEL_EN), ("ch", LABEL_CH)])),
        ("tier_order", order),
    ])
    for k in order:
        new_tdoc[NEW_CAT][k] = merged_tiers[k]

    # ── merge base_mapping ────────────────────────────────────────────────────
    mapping = OrderedDict()
    loc = OrderedDict()
    rules = []
    dup_bases, loc_conflict, dead_rules = [], [], 0
    for tpath, mpath, name, sub in src:
        m = load(mpath)
        for base, tval in (m.get("mapping") or {}).items():
            keys = tval if isinstance(tval, list) else [tval]
            new = [key_map.get((name, k), k) for k in keys]
            if base in mapping:
                dup_bases.append((base, name))
                for k in new:
                    if k not in mapping[base]:
                        mapping[base].append(k)
            else:
                mapping[base] = new
        # ⚠️ base_mapping `_meta.localization` is {lang: {base: name}}, NOT {base: name}.
        # Merging it one level too shallow silently produces a single "ch" key holding
        # only the last file's table -- i.e. it drops 900 official translations while
        # reporting success.
        for lang, table in ((m.get("_meta") or {}).get("localization") or {}).items():
            bucket = loc.setdefault(lang, OrderedDict())
            for base, name_zh in (table or {}).items():
                if base in bucket and bucket[base] != name_zh:
                    loc_conflict.append((lang, base, bucket[base], name_zh))
                bucket[base] = name_zh
        for r in (m.get("rules") or []):
            r = json.loads(json.dumps(r), object_pairs_hook=OrderedDict)
            t = (r.get("overrides") or {}).get("Tier")
            if t is None:
                dead_rules += 1
            else:
                r["overrides"]["Tier"] = key_map.get((name, t), t)
            r.setdefault("comment", "")
            r["comment"] = ("[%s] %s" % (name, r["comment"])).strip()
            rules.append(r)

    new_mdoc = OrderedDict()
    new_mdoc["_meta"] = OrderedDict([
        ("item_class", OrderedDict([("en", LABEL_EN), ("ch", LABEL_CH)])),
        ("localization", loc),
    ])
    new_mdoc["mapping"] = OrderedDict(sorted(mapping.items()))
    new_mdoc["rules"] = rules

    print("  bases      : %d distinct (%d appeared in two files: %s)"
          % (len(mapping), len(dup_bases), ", ".join(b for b, _ in dup_bases) or "-"))
    print("  tiers      : %d  (%s)" % (len(order), ", ".join(order)))
    print("  overrides  : %d carried" % ov_count)
    print("  rules      : %d carried, of which %d are DEAD (no overrides.Tier)"
          % (len(rules), dead_rules))
    print("  zh labels  : %s, %d conflicts"
          % (", ".join("%s=%d" % (k, len(v)) for k, v in loc.items()), len(loc_conflict)))
    for lang, b, a, c in loc_conflict[:8]:
        print("     !! [%s] %s: %r vs %r" % (lang, b, a, c))

    # ── nav, theme, rerank ────────────────────────────────────────────────────
    nav = load(NAV)
    old_rels = set()
    for tpath, mpath, name, sub in src:
        old_rels.add(("Equipment/%s/%s.json" % (sub, name)))
    removed, first_group = 0, None
    for gi, grp in enumerate(nav["categories"]):
        files = grp.get("files")
        if not files:
            continue
        keep = []
        for f in files:
            if f.get("path") in old_rels:
                removed += 1
                if first_group is None:
                    first_group = gi
            else:
                keep.append(f)
        grp["files"] = keep
    if first_group is None:
        sys.exit("no nav entries matched -- refusing to write")
    nav["categories"][first_group]["files"].insert(0, OrderedDict([
        ("path", NEW_REL),
        ("tier_path", "tier_definition/" + NEW_REL),
        ("mapping_path", "base_mapping/" + NEW_REL),
        ("localization", OrderedDict([("en", LABEL_EN), ("ch", LABEL_CH)])),
    ]))
    nav["categories"] = [g for g in nav["categories"]
                         if g.get("files") or g.get("separator") or g.get("subgroups")]
    print("  nav        : %d leaves removed, 1 added" % removed)

    theme = load(THEME)
    theme_c = load(THEME_C)
    for doc, label in ((theme, "sharket_theme"), (theme_c, "compiled")):
        if NEW_CAT in doc:
            sys.exit("%s already has %r" % (label, NEW_CAT))
        doc[NEW_CAT] = json.loads(json.dumps(doc[HUE_SOURCE]), object_pairs_hook=OrderedDict)
    print("  theme      : %r added from %r (old 23 left in place, unread)"
          % (NEW_CAT, HUE_SOURCE))

    rerank = load(RERANK)
    hits = 0
    for row in rerank:
        f = row.get("file", "")
        if f.startswith("Equipment/") and any(f == r for r in old_rels):
            name = os.path.basename(f)[:-5]
            row["file"] = NEW_REL
            tk = row.get("tier_key")
            if tk:
                row["tier_key"] = key_map.get((name, tk), tk)
            hits += 1
    print("  rerank     : %d rows retargeted" % hits)

    if not args.apply:
        print("\n(dry run -- pass --apply)")
        return

    dump(os.path.join(TIER_DIR, NEW_CAT + ".json"), new_tdoc)
    dump(os.path.join(MAP_DIR, NEW_CAT + ".json"), new_mdoc)
    for tpath, mpath, name, sub in src:
        os.remove(tpath)
        os.remove(mpath)
    for sub in SUBS:
        for d in (os.path.join(TIER_DIR, sub), os.path.join(MAP_DIR, sub)):
            if os.path.isdir(d) and not os.listdir(d):
                os.rmdir(d)
    dump(NAV, nav)
    dump(THEME, theme)
    dump(THEME_C, theme_c)
    dump(RERANK, rerank)
    print("\nwrote %s and %s; removed %d file pairs"
          % (rel(os.path.join(TIER_DIR, NEW_CAT + ".json")),
             rel(os.path.join(MAP_DIR, NEW_CAT + ".json")), len(src)))
    print("NOW: regenerate and diff against the baseline. Block COUNT will drop"
          " (23 categories became 1); the set of matched bases must not.")


if __name__ == "__main__":
    main()
