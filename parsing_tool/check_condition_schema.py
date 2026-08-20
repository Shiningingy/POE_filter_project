#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Hold every copy of the condition vocabulary to `filter_conditions.yaml`.

    python parsing_tool/check_condition_schema.py
    python parsing_tool/check_condition_schema.py --quiet     # only failures

Exit 1 on any drift, so this can gate a build.

★ WHY THIS EXISTS. `filter_conditions.yaml` calls itself the "single source of truth",
and it is — but four other places restate parts of it, and by 2026-08-19 every one of
them had rotted. None of the rot was visible: each failure mode is silent.

    simulatorEngine.ts BOOL_FIELD   a bool condition the map did not name fell through
                                    to the NUMERIC comparison, where String(true) !=
                                    "True" made the rule never match. 4 conditions were
                                    in that state, and ZanaMemory is live in the tree.
    simulatorEngine.ts NON_SIMULATABLE  a `simulatable: false` condition missing here is
                                    evaluated against an item attribute that does not
                                    exist -> rejects every item (Vestigial).
    main.py SIM_FIELD               two keys named no condition at all, so they could
                                    never fire (BlightRavagedMap, ZanasMemory).
    RULE_FACTOR_LOCALIZATION        10 dead labels, incl. 5 PoE2-only keywords, and 21
                                    live conditions with no label.

The deeper cure was to stop hand-maintaining the biggest one: bools now resolve
generically in checkRuleMatch, so BOOL_FIELD carries only genuine renames. This script
guards what could not be generated away.

⚠️ THE SCHEMA IS NOT THE GAME. It says what the EDITOR offers, which is a deliberate
subset — `filter_conditions.yaml` documents an EXCLUDED list (PoE2 keywords, GGG-removed
`GemQualityType`). So "offered but unused by the tree" is fine and is only reported, never
failed: a player may want a condition we happen not to use. What fails is a MISMATCH — a
copy naming something the schema does not, or missing something it does.
"""
import argparse
import io
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YAML = os.path.join(ROOT, "filter_generation", "data", "filter_conditions.yaml")
SIMTS = os.path.join(ROOT, "webapp", "frontend", "src", "utils", "simulatorEngine.ts")
LOCTS = os.path.join(ROOT, "webapp", "frontend", "src", "utils", "localization.ts")
MAINPY = os.path.join(ROOT, "webapp", "backend", "main.py")
TREE = [os.path.join(ROOT, "filter_generation", "data", d)
        for d in ("tier_definition", "base_mapping")]

# Conditions checkRuleMatch resolves through a dedicated branch rather than the generic
# paths. Listing them here is the point: each is a deliberate exception, not an omission.
# BaseType is `simulatable: false` (the sim form has no field for it — the item already
# has a name) yet checkRuleMatch still tests it by name, which is why it is in neither
# NON_SIMULATABLE nor BOOL_FIELD and must not be reported as missing from either.
SPECIAL_CASED = {"BaseType", "Class", "Rarity", "AreaLevel", "HasInfluence", "SocketGroup",
                 "ItemLevel", "DropLevel", "Sockets", "LinkedSockets", "Quality",
                 "StackSize", "MapTier", "GemLevel", "MemoryStrands"}

problems = []
notes = []


def fail(where, msg, items=()):
    problems.append((where, msg, sorted(items)))


def read(p):
    return io.open(p, encoding="utf-8", errors="replace").read()


def ts_block(src, start, end, what):
    """Slice a literal out of a TS file.

    ⚠️ Anchor on the DECLARATION, and search for the terminator AFTER it. A first pass
    used `src.index(end)` from position 0; the terminator token appeared earlier in the
    file, the slice came out empty, and the check cheerfully reported every condition
    unhandled. An empty slice is treated as a hard failure here for that reason.
    """
    try:
        a = src.index(start)
        b = src.index(end, a + len(start))
    except ValueError:
        fail(what, "could not locate the block (%r ... %r) — was it renamed?" % (start, end))
        return ""
    body = src[a + len(start):b]
    if not body.strip():
        fail(what, "block parsed as EMPTY — the anchors matched but captured nothing")
    return body


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    import yaml
    doc = yaml.safe_load(read(YAML))
    conds = doc["conditions"]
    schema = {}
    for c in conds:
        schema.setdefault(c["key"], c)
    keys = set(schema)
    bools = {k for k, c in schema.items() if c.get("type") == "bool"}
    notsim = {k for k, c in schema.items() if not c.get("simulatable")}

    # ── 1. the tree must not use a condition the editor cannot offer ─────────────
    used = {}
    for base in TREE:
        for dp, _, fns in os.walk(base):
            for fn in fns:
                if not fn.endswith(".json"):
                    continue
                p = os.path.join(dp, fn)
                try:
                    d = json.load(io.open(p, encoding="utf-8"))
                except Exception:
                    continue
                stack = [d]
                while stack:
                    n = stack.pop()
                    if isinstance(n, dict):
                        for k, v in n.items():
                            if k == "conditions" and isinstance(v, dict):
                                for ck in v:
                                    used.setdefault(ck, set()).add(os.path.relpath(p, ROOT))
                            else:
                                stack.append(v)
                    elif isinstance(n, list):
                        stack.extend(n)
    orphan = set(used) - keys
    if orphan:
        fail("tree vs schema",
             "the tree authors conditions the editor cannot offer — they can only be "
             "edited by hand-editing JSON", orphan)
    notes.append("tree uses %d conditions, all offered" % len(used)
                 if not orphan else "tree uses %d conditions" % len(used))

    # ── 2. simulatorEngine.ts ────────────────────────────────────────────────────
    sim = read(SIMTS)
    non = set(re.findall(r"'([A-Za-z]+)'",
                         ts_block(sim, "NON_SIMULATABLE = new Set", "]);", "NON_SIMULATABLE")))
    bf_body = ts_block(sim, "const BOOL_FIELD", "};", "BOOL_FIELD")
    bf = set(re.findall(r"(\w+)\s*:", bf_body)) - {"Record"}
    generic = "BOOL_FIELD[key] || key.charAt(0).toLowerCase()" in sim

    dead = (non | bf) - keys
    if dead:
        fail("simulatorEngine.ts", "names conditions that do not exist — dead weight that "
             "reads like coverage", dead)
    miss_non = (notsim - non) - SPECIAL_CASED
    if miss_non:
        fail("simulatorEngine.ts", "`simulatable: false` in the schema but NOT in "
             "NON_SIMULATABLE — evaluated against an attribute the item lacks, so every "
             "item is rejected", miss_non)
    if not generic:
        # Also credit explicit `key === 'X'` branches, or this reports conditions that
        # ARE handled — the pre-fix engine covered Corrupted/Identified/Mirrored that way.
        explicit = set(re.findall(r"key === '(\w+)'", sim))
        unhandled = bools - non - bf - explicit - SPECIAL_CASED
        if unhandled:
            fail("simulatorEngine.ts", "bool conditions handled nowhere — these fall to the "
                 "numeric comparison, where String(true) != \"True\" never matches", unhandled)
        notes.append("⚠️  the generic bool fallback in checkRuleMatch is GONE — BOOL_FIELD is "
                     "hand-maintained again, and this check is back to enumerating")
    else:
        notes.append("bool conditions resolve generically; BOOL_FIELD carries %d renames" % len(bf))

    # ── 3. main.py SIM_FIELD ─────────────────────────────────────────────────────
    mp = read(MAINPY)
    simf = set(re.findall(r'"(\w+)":\s*"\w+"',
                          ts_block(mp, "SIM_FIELD = {", "}", "SIM_FIELD")))
    deadf = simf - keys
    if deadf:
        fail("main.py SIM_FIELD", "maps condition names that do not exist — never fires", deadf)

    # ── 4. the fallback label map ────────────────────────────────────────────────
    loc = read(LOCTS)
    lab = set(re.findall(r"\n  (\w+):\s*\{\s*en:",
                         ts_block(loc, "export const RULE_FACTOR_LOCALIZATION", "\n};",
                                  "RULE_FACTOR_LOCALIZATION")))
    deadl = lab - keys
    if deadl:
        fail("RULE_FACTOR_LOCALIZATION", "labels conditions that cannot be picked", deadl)
    missl = keys - lab
    if missl:
        fail("RULE_FACTOR_LOCALIZATION", "no fallback label — a rule carrying one renders "
             "its raw key if the schema has not loaded", missl)

    # ── 5. the retired vocabulary must stay retired ──────────────────────────────
    for stale in ("rule_templates.json", "rule_templates_v3.yaml"):
        p = os.path.join(ROOT, "filter_generation", "data", stale)
        if os.path.exists(p):
            fail("legacy fallback", "%s is back in data/. It offers PoE2-only keywords and "
                 "the IsReplica/IsFoulborn misspellings; it belongs in "
                 "archive/retired-data/" % stale)

    # ── report ───────────────────────────────────────────────────────────────────
    if not a.quiet:
        print("schema  %d conditions (%d bool, %d not simulatable)"
              % (len(keys), len(bools), len(notsim)))
        for n in notes:
            print("        %s" % n)
        unused = sorted(keys - set(used))
        print("        %d offered but unused by the tree (fine — see the docstring)"
              % len(unused))

    if problems:
        print()
        for where, msg, items in problems:
            print("FAIL  %s" % where)
            print("      %s" % msg)
            for i in items:
                print("        - %s" % i)
        print()
        print("%d problem(s). filter_generation/data/filter_conditions.yaml is the source; "
              "fix the copy, not the schema." % len(problems))
        return 1

    if not a.quiet:
        print()
        print("OK — every copy of the condition vocabulary agrees with the schema.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
