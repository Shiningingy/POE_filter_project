#!/usr/bin/env python3
"""Validate the curation tree against the rules the generator actually enforces.

Every check here exists because the failure it catches has already happened,
and every one of them failed SILENTLY - the filter generated fine and the items
were simply absent in game.

    python parsing_tool/validate_curation.py
    python parsing_tool/validate_curation.py --catalog 3.29.0.2.2   # + name checks
    python parsing_tool/validate_curation.py --file Currency/General.json

Exit code is non-zero if any ERROR is found, so it can gate a commit or a CI run.

The rules, and where they come from in generate.py:

  pairing      base_mapping/<p> is paired with tier_definition/<p> by relative
               path (generate.py:249). A mapping file with no partner is skipped
               entirely - the whole category vanishes with no message.

  dead key     generate.py:393-394 iterates the tier order and does
                   `if t_lbl not in category_data: continue`
               so a mapping value naming a tier the category does not define
               emits NOTHING. This is what silently killed 525 entries.

  lumping      For underscore folders (_legacy, _campaign) generate.py:365-379
               instead REMAPS unknown keys onto the first non-hide tier. Items
               are not lost, but they all collapse into one bucket - the
               "everything shows up in general" symptom. Warning, not error.

  no-op rule   Every branch that selects a rule's items (generate.py:527-550)
               needs either `targets` or `applyToTier`. A rule with neither
               falls through to `continue` and emits nothing - and worse, the
               items it meant to condition stay in `pending_items`, so they
               emit as an UNCONDITIONED base block instead. The intended
               "narrower" rule silently becomes a wider one.

  rule tier    A rule's overrides.Tier is compared to the tier being emitted
               (generate.py:528). Naming a tier the category does not define
               means the comparison never holds - the dead-key bug in rule form.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
DATA = os.path.join(REPO, "filter_generation", "data")
BM = os.path.join(DATA, "base_mapping")
TD = os.path.join(DATA, "tier_definition")

# Authored entries that are deliberately not base type names - the generator
# turns them into socket/link conditions rather than a BaseType line.
PSEUDO_NAMES = {"6-Link", "6-Socket", "RGB Linked", "Relics", "Heist Target"}


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str]] = []

    def add(self, level: str, where: str, msg: str) -> None:
        self.rows.append((level, where, msg))

    def count(self, level: str) -> int:
        return sum(1 for lv, _, _ in self.rows if lv == level)

    def dump(self, show_info: bool) -> None:
        order = {"ERROR": 0, "WARN": 1, "INFO": 2}
        rows = [r for r in self.rows if show_info or r[0] != "INFO"]
        if not rows:
            print("  nothing to report")
        for level, where, msg in sorted(rows, key=lambda r: (order[r[0]], r[1])):
            print(f"  [{level:<5}] {where}\n            {msg}")


def load(path: str, rel: str, rep: Report) -> dict | None:
    try:
        with open(path, encoding="utf-8-sig") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        # The corruption signature: a valid document followed by junk.
        raw = open(path, encoding="utf-8-sig", errors="replace").read()
        extra = ""
        try:
            _, end = json.JSONDecoder().raw_decode(raw.lstrip("﻿"))
            extra = (f" - a valid document ends at char {end} with "
                     f"{len(raw) - end} orphaned byte(s) after it "
                     f"(truncated-overwrite corruption)")
        except Exception:
            pass
        rep.add("ERROR", rel, f"not valid JSON: {exc}{extra}")
        return None
    except OSError as exc:
        rep.add("ERROR", rel, f"unreadable: {exc}")
        return None


def category_of(tier_doc: dict) -> tuple[str, dict] | tuple[None, None]:
    """A tier_definition holds one category under a single top-level key."""
    for key, body in tier_doc.items():
        if isinstance(body, dict) and isinstance(body.get("_meta"), dict):
            return key, body
    return None, None


def check_rules(map_doc: dict, mapping: dict, defined: set[str], rel: str,
                names: set[str], rep: Report) -> None:
    """A rule only reaches an output block through generate.py:527-550.

    Both selection branches there end in a bare `continue` when the rule names
    no items, so a conditions-only rule is not "apply to everything" - it is
    apply to nothing, with no message.
    """
    rules = map_doc.get("rules")
    if rules is None:
        return
    if not isinstance(rules, list):
        rep.add("ERROR", f"base_mapping/{rel}",
                f"'rules' is a {type(rules).__name__}; expected a list")
        return

    # Which items would be left unconditioned if a rule for their tier is a no-op.
    per_tier: dict[str, list[str]] = {}
    for item, val in mapping.items():
        for k in ([val] if isinstance(val, str) else val if isinstance(val, list) else []):
            if isinstance(k, str):
                per_tier.setdefault(k, []).append(item)

    for i, rule in enumerate(rules):
        if not isinstance(rule, dict) or rule.get("disabled"):
            continue
        where = f"base_mapping/{rel}"
        tier = (rule.get("overrides") or {}).get("Tier")
        conds = rule.get("conditions") or {}
        label = rule.get("comment") or (f"-> {tier}" if tier else f"rule #{i}")

        # A rule that brings its OWN selector - a `raw` block, or a BaseType/Class
        # condition - is legitimate with no targets: generate.py:531 emits a block
        # with no generated BaseType line and the rule's own lines do the matching.
        # That is how one partial match stands in for a whole family
        # (`BaseType "Deafening Essence of"` for all 17). Not an error.
        self_selecting = bool(rule.get("raw")) or any(
            k in conds for k in ("BaseType", "Class"))

        if not rule.get("targets") and not rule.get("applyToTier") and not self_selecting:
            # The rule is skipped. What the reader needs to know is what happens
            # INSTEAD, which depends on whether the tier has items of its own.
            stranded = per_tier.get(tier, []) if tier else []
            if stranded:
                consequence = (
                    f"the {len(stranded)} item(s) already on {tier!r} "
                    f"({', '.join(sorted(stranded)[:4])}"
                    f"{' …' if len(stranded) > 4 else ''}) emit as an UNCONDITIONED "
                    f"block instead - {' + '.join(conds) or 'the conditions'} "
                    f"never applies, so that block matches every one of them")
            elif not mapping:
                consequence = ("this category has no mapping either, so it emits "
                               "NO blocks at all")
            else:
                consequence = f"nothing is emitted for {tier!r}"
            rep.add("ERROR", where,
                    f"rule {label!r} has no 'targets' and no 'applyToTier', so "
                    f"generate.py:545 skips it - {consequence}\n            "
                    f"fix: list the base types in 'targets'; or give the rule its "
                    f"own selector - a BaseType/Class condition, or a 'raw' block "
                    f"- which lets it match without naming items; or move the "
                    f"conditions onto the tier as class_condition:true "
                    f"(generate.py:447) if they are meant to match by class")
            continue

        if tier and tier not in defined:
            rep.add("ERROR", where,
                    f"rule {label!r} overrides Tier to {tier!r}, which this "
                    f"category does not define - generate.py:528 never matches "
                    f"it, so the rule emits NOTHING\n            "
                    f"defined tiers: {', '.join(sorted(defined)[:8])}")

        if names:
            for t in rule.get("targets") or []:
                if isinstance(t, str) and t not in PSEUDO_NAMES and t not in names:
                    rep.add("WARN", where,
                            f"rule {label!r} targets {t!r}, which is not a base "
                            f"type in the catalog - it emits a BaseType line that "
                            f"never matches in game")


def validate(only: str | None, catalog: str | None) -> Report:
    rep = Report()

    names: set[str] = set()
    if catalog:
        root = os.path.join(REPO, "data", "source", catalog, "tables", "English",
                            "BaseItemTypes.json")
        if not os.path.exists(root):
            rep.add("ERROR", "(catalog)", f"no dump at {root}")
        else:
            with open(root, encoding="utf-8") as fh:
                names = {r["Name"] for r in json.load(fh) if r.get("Name")}
            uniq = os.path.join(REPO, "data", "unique_base_db.json")
            if os.path.exists(uniq):
                blob = open(uniq, encoding="utf-8-sig").read()
                names |= {n for n in names}  # keep base names
                try:
                    doc = json.loads(blob)
                    stack = [doc]
                    while stack:
                        cur = stack.pop()
                        if isinstance(cur, dict):
                            for k, v in cur.items():
                                if k in ("unique", "name") and isinstance(v, str):
                                    names.add(v)
                                else:
                                    stack.append(v)
                        elif isinstance(cur, list):
                            stack.extend(cur)
                except Exception:
                    pass

    mapping_files = sorted(glob.glob(os.path.join(BM, "**", "*.json"), recursive=True))
    for path in mapping_files:
        rel = os.path.relpath(path, BM).replace("\\", "/")
        if only and only not in rel:
            continue
        folder = rel.split("/")[0]

        map_doc = load(path, f"base_mapping/{rel}", rep)
        if map_doc is None:
            continue

        tier_path = os.path.join(TD, rel.replace("/", os.sep))
        if not os.path.exists(tier_path):
            n = len(map_doc.get("mapping") or {})
            # An empty unpaired category loses nothing today, but it is a loaded
            # gun: the first item added to it disappears with no message.
            rep.add("ERROR" if n else "WARN", f"base_mapping/{rel}",
                    "no tier_definition at the same relative path - the generator "
                    "pairs them by path, so this ENTIRE category is skipped"
                    + (f" and all {n} of its items are absent from the filter"
                       if n else "; it is empty today, so nothing is lost yet, but "
                                 "anything added here will vanish silently"))
            continue

        tier_doc = load(tier_path, f"tier_definition/{rel}", rep)
        if tier_doc is None:
            continue

        cat_key, cat = category_of(tier_doc)
        if cat is None:
            rep.add("ERROR", f"tier_definition/{rel}",
                    "no category with a _meta block - the generator cannot read it")
            continue

        defined = {k for k in cat if k != "_meta"}
        tier_order = (cat.get("_meta") or {}).get("tier_order") or []

        for t in tier_order:
            if t not in defined:
                rep.add("WARN", f"tier_definition/{rel}",
                        f"tier_order lists {t!r}, which the category does not define "
                        f"(skipped at generation)")

        mapping = map_doc.get("mapping")
        if mapping is None:
            rep.add("WARN", f"base_mapping/{rel}", "no 'mapping' block")
            mapping = {}

        # For underscore folders the generator remaps unknown keys instead of
        # dropping them - but only when it can find a "Tier*"-prefixed fallback.
        remap_targets = {k for k in defined if k.startswith("Tier")}
        has_fallback = folder.startswith("_") and any(
            t in remap_targets and not cat[t].get("is_hide_tier", False) for t in tier_order)

        dead: dict[str, list[str]] = {}
        lumped: dict[str, list[str]] = {}
        for item, val in mapping.items():
            if isinstance(val, str):
                keys = [val]
            elif isinstance(val, list):
                keys = val
                if not val:
                    rep.add("INFO", f"base_mapping/{rel}",
                            f"{item!r} maps to [] - emits nowhere (legal, but easy to do by accident)")
            else:
                rep.add("ERROR", f"base_mapping/{rel}",
                        f"{item!r} maps to a {type(val).__name__}; expected a string or a list")
                continue

            for k in keys:
                if not isinstance(k, str):
                    rep.add("ERROR", f"base_mapping/{rel}",
                            f"{item!r} has a non-string tier {k!r}")
                elif k not in defined:
                    if has_fallback and k not in remap_targets:
                        lumped.setdefault(k, []).append(item)
                    else:
                        dead.setdefault(k, []).append(item)

            if names and item not in PSEUDO_NAMES and item not in names and " of " not in item:
                rep.add("WARN", f"base_mapping/{rel}",
                        f"{item!r} is not a base type or unique in the catalog - "
                        f"a typo here never matches in game")

        for key, items in sorted(dead.items()):
            rep.add("ERROR", f"base_mapping/{rel}",
                    f"tier {key!r} is not defined by this category, so its "
                    f"{len(items)} item(s) emit NOTHING: {', '.join(sorted(items)[:4])}"
                    f"{' …' if len(items) > 4 else ''}\n            "
                    f"defined tiers: {', '.join(sorted(defined)[:8])}")
        for key, items in sorted(lumped.items()):
            rep.add("WARN", f"base_mapping/{rel}",
                    f"tier {key!r} is undefined here; its {len(items)} item(s) are "
                    f"remapped onto the first non-hide tier and lose their ranking")

        check_rules(map_doc, mapping, defined, rel, names, rep)

    # tier_definitions with no mapping partner
    for path in sorted(glob.glob(os.path.join(TD, "**", "*.json"), recursive=True)):
        rel = os.path.relpath(path, TD).replace("\\", "/")
        if only and only not in rel:
            continue
        if not os.path.exists(os.path.join(BM, rel.replace("/", os.sep))):
            rep.add("INFO", f"tier_definition/{rel}",
                    "no base_mapping partner (fine for a rules-only category)")
    return rep


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--catalog", metavar="LABEL",
                    help="also check item names against data/source/<LABEL>")
    ap.add_argument("--file", metavar="SUBSTRING", help="limit to matching paths")
    ap.add_argument("--info", action="store_true", help="show INFO rows too")
    args = ap.parse_args()

    rep = validate(args.file, args.catalog)
    print("=== curation validation ===")
    rep.dump(args.info)
    e, w, i = rep.count("ERROR"), rep.count("WARN"), rep.count("INFO")
    print(f"\n{e} error(s), {w} warning(s), {i} info"
          f"{'' if args.info else ' (--info to show)'}")
    sys.exit(1 if e else 0)


if __name__ == "__main__":
    main()
