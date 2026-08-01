#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Validate the curation tree against the rules the generator actually enforces.

Every check here exists because the failure it catches has already happened,
and every one of them failed SILENTLY - the filter generated fine and the items
were simply absent in game.

    python parsing_tool/validate_curation.py
    python parsing_tool/validate_curation.py --catalog 3.29.0.2.2   # + name checks
    python parsing_tool/validate_curation.py --file Currency/General.json

Exit code is non-zero if any ERROR is found, so it can gate a commit or a CI run.

The rules, and where they come from in the generator
(webapp/frontend/src/utils/filterGenerator.ts - the only engine since ADR-0007;
these used to cite generate.py line numbers, which is why they name behaviour
rather than lines now):

  pairing      base_mapping/<p> is paired with tier_definition/<p> by relative
               path. A mapping file with no partner is skipped entirely - the
               whole category vanishes with no message.

  dead key     the generator walks the tier order and skips any label the
               category does not define:
                   `if (!(tLbl in categoryData)) continue`
               so a mapping value naming a tier the category does not define
               emits NOTHING. This is what silently killed 525 entries.

  lumping      For underscore folders (_legacy, _campaign) it instead REMAPS
               unknown keys onto the first non-hide tier. Items are not lost,
               but they all collapse into one bucket - the "everything shows up
               in general" symptom. Warning, not error.

  no-op rule   Every branch that selects a rule's items needs either `targets`,
               `applyToTier`, or conditions of its own. A rule with none falls
               through and emits nothing - and worse, the items it meant to
               condition stay in `pendingItems`, so they emit as an
               UNCONDITIONED base block instead. The intended "narrower" rule
               silently becomes a wider one.

  rule tier    A rule's overrides.Tier is compared to the tier being emitted.
               Naming a tier the category does not define means the comparison
               never holds - the dead-key bug in rule form.
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
DATA = os.path.join(REPO, "filter_generation", "data")
BM = os.path.join(DATA, "base_mapping")
TD = os.path.join(DATA, "tier_definition")

# Authored entries that are deliberately not base type names - the generator
# turns them into socket/link conditions rather than a BaseType line.
PSEUDO_NAMES = {"6-Link", "6-Socket", "RGB Linked", "Relics", "Heist Target"}

# Which catalogue the name checks actually used — printed, so a stale one is
# visible rather than silently producing typo reports for valid items.
LOADED_FROM: dict[str, str] = {}


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
                names: set[str], classes: set[str], rep: Report) -> None:
    """A rule only reaches an output block through the generator's rule loop.

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
        # condition - is legitimate with no targets: the generator emits a block
        # with no generated BaseType line and the rule's own lines do the matching.
        # That is how one partial match stands in for a whole family
        # (`BaseType "Deafening Essence of"` for all 17). Not an error.
        # Mirrors the generator: ANY condition is a selector, not only BaseType/Class.
        # A rule saying `Rarity Unique` + `LinkedSockets >= 6` needs no target list.
        self_selecting = bool(rule.get("raw")) or bool(conds)

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
                    f"the generator skips it - {consequence}\n            "
                    f"fix: list the base types in 'targets'; or give the rule its "
                    f"own selector - a BaseType/Class condition, or a 'raw' block "
                    f"- which lets it match without naming items; or move the "
                    f"conditions onto the tier as class_condition:true "
                    f"if they are meant to match by class")
            continue

        if tier and tier not in defined:
            rep.add("ERROR", where,
                    f"rule {label!r} overrides Tier to {tier!r}, which this "
                    f"category does not define - the rule-tier comparison never matches "
                    f"it, so the rule emits NOTHING\n            "
                    f"defined tiers: {', '.join(sorted(defined)[:8])}")

        check_operators(where, f"rule {label!r}", conds, rep)

        # `Class ==` is an EXACT match and the game's class names are PLURAL —
        # "Blueprints", not "Blueprint". The singular emits a block that cannot
        # match anything, and nothing anywhere says so.
        if classes:
            cval = conds.get("Class")
            for c in (cval if isinstance(cval, list) else [cval] if cval else []):
                if not isinstance(c, str):
                    continue
                body = c.strip()
                exact = body.startswith("==")
                body = body[2:].strip() if exact else body
                # ONLY exact matches. A partial `Class "Gems"` is a deliberate
                # substring standing in for "Skill Gems" + "Support Gems", so
                # checking it against the class list reports idiom as error.
                if not exact:
                    continue
                for token in re.findall(r'"([^"]+)"', body) or ([body] if body else []):
                    if token in classes:
                        continue
                    plural = f"{token}s"
                    hint = f" — did you mean {plural!r}?" if plural in classes else ""
                    why = ("`Class ==` is exact, so this block never matches"
                           if exact else "partial match — verify it is intended")
                    rep.add("ERROR" if exact else "WARN", where,
                            f"rule {label!r}: Class {token!r} is not an item class"
                            f"{hint}\n            {why}")

        if names:
            for t in rule.get("targets") or []:
                if isinstance(t, str) and t not in PSEUDO_NAMES and t not in names:
                    rep.add("WARN", where,
                            f"rule {label!r} targets {t!r}, which is not a base "
                            f"type in the catalog - it emits a BaseType line that "
                            f"never matches in game")


# Comparison operators PoE accepts. A value like ">=10" parses in JSON and reads
# fine, and the GAME REJECTS THE ENTIRE FILTER over it.
#
# Matched by taking the operator GREEDILY. An alternation like `(==|<=|<|=)` looks
# equivalent and is not: on "<= 67" the two-character branch fails (the next char
# is a space), the engine backtracks to the single "<", and the "=" then reads as
# the missing space — every correctly-spaced two-character operator in the tree
# reported as a violation.
_OP_RE = re.compile(r"^([=!<>]+)(.*)$")


def load_base_names() -> set[str]:
    """Every name a `BaseType` line may legally use.

    ⚠️ `BaseItemTypes` ONLY. Do NOT union `GemEffects` in here.

    23 transfigured gem names look like missing base types and are not: they are
    GemEffects rows (BladefallAltX/Y/Z), matched in a filter by
    `TransfiguredGem True`, never by name. Unioning GemEffects to make those
    "pass" silently turns every genuinely invalid name into a pass too — it was
    tried during 3.29 and converted 23 real errors into 23 green ticks.

    ⚠️ And it must be a CURRENT dump, sourced from the GGPK extraction pipeline
    (`parsing_tool/ggpk/extract.py`), which stages each run as
    `data/source/<label>/`. The MANIFESTS there are tracked while the `tables/`
    beside them are gitignored, so the newest label is always KNOWN even when its
    data is absent — and on a fresh clone or in CI it always is.

    So the manifest picks the label (newest `extracted_at`), and the tables are
    then either present or not. If not, this returns nothing and the name checks
    are SKIPPED, loudly, naming the command that would fix it.

    It deliberately does NOT fall back to `data/from_ggpk/baseitemtypes.json`:
    that is a pre-3.29 extract with 4196 names and no Enshrouding Crystals at all,
    and quietly checking 3.29 content against it reported 111 valid bases as
    typos. A name check is only ever as good as its catalogue, and a stale one is
    worse than no check — it trains you to ignore the validator.
    """
    manifests = glob.glob(os.path.join(REPO, "data", "source", "*", "manifest.json"))
    labels: list[tuple[str, str, str]] = []
    for m in manifests:
        try:
            with open(m, encoding="utf-8") as fh:
                doc = json.load(fh)
            labels.append((doc.get("extracted_at") or "",
                           doc.get("label") or os.path.basename(os.path.dirname(m)),
                           doc.get("source") or ""))
        except Exception:
            continue
    if not labels:
        LOADED_FROM["skip"] = "no data/source/*/manifest.json — run parsing_tool/ggpk/extract.py"
        return set()

    _, label, src = max(labels)
    path = os.path.join(REPO, "data", "source", label, "tables", "English", "BaseItemTypes.json")
    if not os.path.exists(path):
        LOADED_FROM["skip"] = (
            f"newest catalogue is {label!r} but its tables are not extracted here "
            f"(data/source/**  is gitignored) — name checks SKIPPED. "
            # The flag has to match how THIS label was made: cn-3.29 came from a
            # local install, so suggesting --source cdn would just fail.
            f"Run: python parsing_tool/ggpk/extract.py "
            f"--source {'local' if 'local' in src.lower() else 'cdn'} --label {label}")
        return set()

    LOADED_FROM["bases"] = f"{label} ({os.path.relpath(path, REPO)})"
    with open(path, encoding="utf-8") as fh:
        return {r["Name"] for r in json.load(fh) if r.get("Name")}


def load_class_names() -> set[str]:
    """Item class names, as `Class` conditions must spell them.

    They are PLURAL in the game data — "Blueprints", not "Blueprint" — and
    `Class ==` is an exact match, so the singular emits a block that can never
    match anything. Read from BaseTypes.csv, which is the same source the backend
    builds its class list from.
    """
    path = os.path.join(REPO, "data", "from_filter_blade", "BaseTypes.csv")
    if not os.path.exists(path):
        return set()
    out: set[str] = set()
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            cls = (row.get("Class") or "").strip()
            if cls:
                out.add(cls)
    return out


def check_style_grammar(where: str, label: str, style: dict, rep: Report) -> None:
    """Beam and icon have a grammar, and one bad line kills the whole filter.

        MinimapIcon <size 0-2> <colour> <shape>
        PlayEffect  <colour> [Temp]

    `Currency/_archived/Breach.json` carried `"RedStar"` — no size, no space —
    for as long as inline style reached nothing. The moment a tier's own beam and
    icon started being emitted it would have shipped onto the Breach splinter
    block. Generation now drops a malformed value with a warning, so this is
    about the authored intent being silently lost, not about a broken filter.
    """
    for key in ("MinimapIcon", "PlayEffect"):
        if key not in style:
            continue
        val = style[key]
        if val is None or (isinstance(val, str) and (val.startswith("disabled:") or val in ("inherit", "default"))):
            continue  # deliberately off — emits no line
        if not isinstance(val, str):
            rep.add("ERROR", where, f"{label}: {key} is {type(val).__name__}, expected a string")
            continue
        parts = val.split()
        ok = (len(parts) == 3 and parts[0] in ("0", "1", "2")) if key == "MinimapIcon" \
            else (len(parts) == 1 or (len(parts) == 2 and parts[1] == "Temp"))
        if not ok:
            expect = "'<size 0-2> <colour> <shape>', e.g. '0 Red Star'" if key == "MinimapIcon" \
                else "'<colour>' or '<colour> Temp', e.g. 'Red Temp'"
            rep.add("ERROR", where,
                    f"{label}: {key} {val!r} is malformed — expected {expect}\n            "
                    f"generation DROPS it, so the icon simply never appears")


def check_operators(where: str, label: str, conditions: dict, rep: Report) -> None:
    """`StackSize >=10` is rejected by the game; `StackSize >= 10` parses."""
    for key, val in (conditions or {}).items():
        for v in (val if isinstance(val, list) else [val]):
            if not isinstance(v, str):
                continue
            m = _OP_RE.match(v.strip())
            # A violation only when an operator is IMMEDIATELY followed by its
            # value: "RANGE >= 1 <= 5" and a bare value carry no leading operator,
            # and ">= 10" already has its space.
            if m and m.group(2) and not m.group(2).startswith(" "):
                rep.add("WARN", where,
                        f"{label}: {key} {v!r} has no space after its operator. The "
                        f"GAME REJECTS THE WHOLE FILTER over this; generation "
                        f"normalises it on emit, so fix it here before some other "
                        f"consumer does not")


def validate(only: str | None, catalog: str | None) -> Report:
    rep = Report()

    # Base and class names load by DEFAULT now, from the in-repo GGPK extract.
    # They used to need --catalog, so the checks that matter most in game were the
    # ones nobody ran. `--catalog` still layers a specific league dump on top.
    names: set[str] = load_base_names()
    classes: set[str] = load_class_names()

    if catalog:
        root = os.path.join(REPO, "data", "source", catalog, "tables", "English",
                            "BaseItemTypes.json")
        if not os.path.exists(root):
            rep.add("ERROR", "(catalog)", f"no dump at {root}")
        else:
            with open(root, encoding="utf-8") as fh:
                names |= {r["Name"] for r in json.load(fh) if r.get("Name")}
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

        # --- per-tier checks: the block's own look, and the item CARDS on it ----
        mapping_now = map_doc.get("mapping") or {}
        for t_key, entry in cat.items():
            if t_key == "_meta" or not isinstance(entry, dict):
                continue
            twhere = f"tier_definition/{rel}"
            check_style_grammar(twhere, f"{t_key} theme", entry.get("theme") or {}, rep)
            check_operators(twhere, f"{t_key} conditions", entry.get("conditions") or {}, rep)

            for base, ovr in (entry.get("item_overrides") or {}).items():
                label = f"{t_key} card {base!r}"
                if not isinstance(ovr, dict):
                    rep.add("ERROR", twhere, f"{label}: override is a {type(ovr).__name__}, expected an object")
                    continue
                check_style_grammar(twhere, label, ovr, rep)
                if names and base not in PSEUDO_NAMES and base not in names:
                    rep.add("WARN", twhere,
                            f"{label}: not a base type — the card belongs to no item")
                # A card whose base this tier never claims splits nothing. It is not
                # harmful, but it is a tuned override doing nothing, which is exactly
                # the class of silence this tree keeps producing.
                #
                # Skipped for underscore folders: there, a mapping value naming a
                # tier the category does not define is REMAPPED onto the first
                # non-hide tier rather than dropped (the "lumping" rule above), so
                # a base can legitimately land on a tier it is not mapped to. Every
                # _legacy card tripped this before the exemption.
                claimed = mapping_now.get(base)
                claims_here = (t_key in claimed) if isinstance(claimed, list) else (claimed == t_key)
                targeted = any(base in (r.get("targets") or [])
                               for r in (map_doc.get("rules") or []) if isinstance(r, dict))
                if not claims_here and not targeted and not folder.startswith("_"):
                    rep.add("WARN", twhere,
                            f"{label}: {base!r} is not mapped to {t_key!r} and no rule "
                            f"targets it, so this override never applies")

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

        check_rules(map_doc, mapping, defined, rel, names, classes, rep)

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
    # A name check is only as good as its catalogue, so say which one was used.
    # Checking 3.29 content against a pre-3.29 dump reported 111 valid bases as
    # typos, which is exactly how a validator gets ignored.
    if LOADED_FROM.get("bases"):
        print(f"  base names from: {LOADED_FROM['bases']}")
    if LOADED_FROM.get("skip"):
        print(f"  ⚠️ {LOADED_FROM['skip']}")
    rep.dump(args.info)
    e, w, i = rep.count("ERROR"), rep.count("WARN"), rep.count("INFO")
    print(f"\n{e} error(s), {w} warning(s), {i} info"
          f"{'' if args.info else ' (--info to show)'}")
    sys.exit(1 if e else 0)


if __name__ == "__main__":
    main()
