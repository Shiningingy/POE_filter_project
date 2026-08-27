# -*- coding: utf-8 -*-
"""Which bases does an EARLY hide block take from a LATER show block?

    python parsing_tool/check_gated_steals.py out/build.trace.json
    python parsing_tool/check_gated_steals.py out/build.trace.json --check   # exit 1 on a NEW pair

★ WHY THIS EXISTS. Found in game 2026-08-26: at uber the top ward base of each slot was the
only one invisible while its five siblings showed. `Crafting Gear 84` gates to Hide at uber
and, at `gen_order -10`, sits ~120 blocks ahead of the League category — so first-match-wins
handed it a base whose own category never hides. The same steal took 25 `Tier 1 Rare
Equipment` bases including Twilight Regalia, the author's own acceptance test.

**Every guard we had passed on it.** check_catchall_coverage (the base never reached the
catch-all — it was hidden long before), check_cross_category_claims (only looks at who
CLAIMS, not at hide-vs-show), check_shadowed_blocks (both blocks were reachable), fmtcheck,
the validator and the fixtures. The defect lives in the gap between "a block is reachable"
and "a block should not be the one that wins", and nothing measured that.

So this walks the REAL first-match-wins order and reports every pair where a hide wins a
base that a Show, later in the file, would have taken. Most such pairs are intentional — a
category hiding its own low-value tier while a generic net would have shown it is the
system working. Intent is not derivable from the file, so this does not guess: it compares
against a committed baseline of accepted pairs and fails only on a NEW one.

Run it on the strictest levels; a gate that never fires cannot steal.
"""
import argparse, csv, io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
BASETYPES = os.path.join(REPO, "data", "from_filter_blade", "BaseTypes.csv")
BASELINE = os.path.join(HERE, "gated_steals_baseline.json")

RANK = {"Normal": 0, "Magic": 1, "Rare": 2, "Unique": 3}
CMP = {"==": lambda a, b: a == b, "=": lambda a, b: a == b,
       "<=": lambda a, b: a <= b, ">=": lambda a, b: a >= b,
       "<": lambda a, b: a < b, ">": lambda a, b: a > b}

# A drop this evaluator cannot model must NOT match, so a block is only ever skipped, never
# wrongly credited with a steal. That makes every finding real and the count a floor.
FALSE_FLAGS = ("Corrupted", "Mirrored", "Identified", "FracturedItem", "SynthesisedItem",
               "AnyEnchantment", "Replica", "Scourged", "ElderItem", "ShaperItem",
               "AlternateQuality", "Enchanted", "TransfiguredGem", "ZanaMemory",
               "HasImplicitMod", "HasEaterOfWorldsImplicit", "HasSearingExarchImplicit",
               "UberBlightedMap", "BlightedMap", "Foulborn")

SCENARIOS = [
    # name                 ilvl  rarity   strands
    ("rare, ilvl 84",        84, "Rare",   0),
    ("rare, ilvl 86",        86, "Rare",   0),
    ("rare ilvl 86, 30 strands", 86, "Rare", 30),
    ("magic, ilvl 84",       84, "Magic",  0),
]


def base_facts():
    out = {}
    with io.open(BASETYPES, encoding="utf-8", errors="replace", newline="") as fh:
        for row in csv.DictReader(fh):
            try:
                dl = int(row["DropLevel"])
            except (TypeError, ValueError):
                dl = 1
            out[row["BaseType"]] = (row["Class"], dl)
    return out


def parse_block(text):
    """-> (conditions, exact_bases or None). None means 'not keyed by an exact BaseType'."""
    conds, bases, exact = [], None, True
    for ln in text.split("\n")[1:]:
        s = ln.strip()
        if not s or s.startswith(("Set", "Play", "Minimap", "Custom", "Disable", "#")):
            continue
        conds.append(s)
        if s.startswith("BaseType"):
            names = re.findall(r'"([^"]+)"', s) or s.replace("==", "").split()[1:]
            if "==" in s:
                bases = set(names)
            else:
                bases, exact = set(names), False
    return conds, (bases if exact else None), bases


def matches(cond, base, facts, item):
    key = cond.split()[0]
    rest = cond[len(key):].strip()
    if key == "BaseType":
        names = re.findall(r'"([^"]+)"', rest) or rest.replace("==", "").split()
        return base in names if "==" in rest else any(n in base for n in names)
    if key == "Class":
        names = re.findall(r'"([^"]+)"', rest)
        cls = facts.get(base, ("", 1))[0]
        if not names:
            return False
        return cls in names if "==" in rest else any(n in cls for n in names)
    if key == "Rarity":
        m = re.match(r"(>=|<=|==|=|<|>)?\s*(\w+)$", rest)
        if m and m.group(2) in RANK:
            return CMP[m.group(1) or "=="](RANK[item["Rarity"]], RANK[m.group(2)])
        return item["Rarity"] in rest.split()
    if key in FALSE_FLAGS:
        return rest.split()[-1] == "False"
    if key == "HasInfluence":
        return "None" in rest
    m = re.match(r"(>=|<=|==|=|<|>)?\s*(-?\d+)$", rest)
    if m:
        got = facts.get(base, ("", 1))[1] if key == "DropLevel" else item.get(key)
        if got is None:
            return False
        return CMP[m.group(1) or "=="](got, int(m.group(2)))
    return False


def run(blocks, facts, universe, ilvl, rarity, strands):
    item = {"ItemLevel": ilvl, "AreaLevel": ilvl - 1, "Quality": 0,
            "MemoryStrands": strands, "Sockets": 3, "LinkedSockets": 0, "StackSize": 1,
            "MapTier": 0, "GemLevel": 0, "BaseArmour": 0, "BaseEnergyShield": 0,
            "BaseEvasion": 0, "BaseWardValue": 0, "BaseDefencePercentile": 50,
            "Rarity": rarity}
    # Only blocks that could possibly name this base, plus every block not keyed by an
    # exact BaseType list (class nets, the catch-all, partial matches).
    by_base = collections.defaultdict(list)
    open_blocks = []
    for i, b in enumerate(blocks):
        if b["exact"] is None:
            open_blocks.append(i)
        else:
            for n in b["exact"]:
                by_base[n].append(i)
    found = collections.defaultdict(set)
    for base in universe:
        cand = sorted(set(by_base.get(base, [])) | set(open_blocks))
        chain = []
        for i in cand:
            b = blocks[i]
            if all(matches(c, base, facts, item) for c in b["conds"]):
                chain.append(i)
                if len(chain) == 2:
                    break
        if len(chain) < 2:
            continue
        win, nxt = blocks[chain[0]], blocks[chain[1]]
        if win["is_hide"] and not nxt["is_hide"] and chain[1] != len(blocks) - 1:
            key = (win["file"], win["tier_key"], nxt["file"], nxt["tier_key"])
            found[key].add(base)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("trace")
    ap.add_argument("--check", action="store_true", help="exit 1 on a pair not in the baseline")
    ap.add_argument("--update", action="store_true", help="rewrite the baseline from this run")
    a = ap.parse_args()

    doc = json.load(io.open(a.trace, encoding="utf-8"))
    facts = base_facts()
    blocks = []
    for rec in doc["blocks"]:
        conds, exact, named = parse_block(rec["text"])
        blocks.append({"file": rec["file"], "tier_key": rec["tier_key"],
                       "is_hide": rec["is_hide"], "conds": conds, "exact": exact})
    universe = {b for blk in doc["blocks"] for b in blk["bases"] if b in facts}
    universe |= {b for b in facts if any(b in (blk["exact"] or ()) for blk in blocks)}

    all_found = collections.defaultdict(set)
    for name, ilvl, rarity, strands in SCENARIOS:
        for key, bases in run(blocks, facts, universe, ilvl, rarity, strands).items():
            all_found[key] |= bases

    print("=== gated steals — %s" % os.path.basename(a.trace))
    print("    %d base(s) in %d pair(s), across %d scenario(s)\n"
          % (sum(len(v) for v in all_found.values()), len(all_found), len(SCENARIOS)))

    baseline = {}
    if os.path.exists(BASELINE):
        baseline = {tuple(e["pair"]): e.get("why", "") for e in
                    json.load(io.open(BASELINE, encoding="utf-8"))["accepted"]}

    new = []
    for key, bases in sorted(all_found.items(), key=lambda kv: -len(kv[1])):
        known = key in baseline
        print("  %s %s :: %s" % ("[known]" if known else "[NEW]  ", key[0], key[1]))
        print("          takes %d from  %s :: %s" % (len(bases), key[2], key[3]))
        print("          %s" % ", ".join(sorted(bases)[:10]))
        if known:
            print("          why: %s" % baseline[key])
        else:
            new.append((key, bases))
        print()

    if a.update:
        payload = {"_comment": "Accepted hide-beats-show pairs. A NEW pair fails --check; "
                               "add it here only with a reason it is intended.",
                   "accepted": [{"pair": list(k), "why": baseline.get(k, "TODO: why is this intended?")}
                                for k in sorted(all_found)]}
        io.open(BASELINE, "w", encoding="utf-8", newline="\n").write(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        print("baseline rewritten: %d pair(s)" % len(all_found))
        return 0

    if new:
        print("!! %d pair(s) NOT in the baseline." % len(new))
        print("   A hide is taking a base a later Show would have taken. If that is intended,")
        print("   add it with --update and write down WHY. If not, this is the ward-base bug.")
        return 1 if a.check else 0
    print("[OK] no new steals")
    return 0


if __name__ == "__main__":
    sys.exit(main())
