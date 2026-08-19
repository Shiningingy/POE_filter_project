# -*- coding: utf-8 -*-
"""Which real items fall through every block and hit the final show-all catch-all?

    python parsing_tool/check_catchall_coverage.py out/build.filter
    python parsing_tool/check_catchall_coverage.py out/build.filter --check   # exit 1 on a loss

★ WHY THIS EXISTS. The catch-all is a safety net for bases we have NOT curated — it shows
them on a bright green plate with a "please update the filter" alert, deliberately loud so
an uncurated base gets a home. That is working as designed. What is NOT designed is a base
the tree *does* curate reaching it anyway, and until this script there was no way to see it:
generation succeeded, the validator passed, parity passed, the shadowed-block guard passed,
and the fixtures passed. Three separate defects shipped in V6.94 through that gap, all found
by a player in game:

  - every life/mana flask past its campaign band (13 of 15 life bases at AreaLevel 67).
    The class hide carried `AreaLevel >= 68` on the belief that _campaign covered below it;
    _campaign only HIGHLIGHTS a flask while on-level, so an outgrown one matched nothing.
  - six utility flasks (Gold/Corundum/Silver/Amethyst/Diamond/Quicksilver) below ilvl 82,
    at EVERY area level. A rule CONSUMES its targets from the tier's pending list, so an
    `ItemLevel >= 82` rule quietly emptied them out of the ungated base block.
  - ~2 of every 3 Normal and ALL Magic equipment bases in Act 1. The declutter starts at
    AreaLevel 10 ("hide after Act 1") and nothing showed them before 10.

Each is invisible to every other check because each block, on its own, is well-formed. Only
asking "what claims THIS item?" finds them — and that question is answered by CONDITIONS,
not by emission order (see analyze_trace.py, and the same lesson relearned three times).

⚠️ LIMITS, so a clean run is not read as more than it is. The probe carries no game state:
no influence, no corruption, no fracture, no map tier, no stack size, no sockets beyond a
plain 2. So a block gated on state is correctly treated as not matching, but a base that
only ever drops WITH that state looks lost when it is not — that is what KNOWN below is for.
It under-reports too: it walks a ladder of area levels, not every level.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS_DB = os.path.join(ROOT, "data", "items_db.json")

RARITY = {"Normal": 0, "Magic": 1, "Rare": 2, "Unique": 3}
RARS = [("Normal", 0), ("Magic", 1), ("Rare", 2), ("Unique", 3)]
LADDER = [1, 3, 5, 9, 12, 20, 34, 45, 60, 67, 68, 72, 75, 80, 83]

EQUIPMENT = {
    "Body Armours", "Boots", "Gloves", "Helmets", "Shields", "Quivers", "Amulets",
    "Belts", "Rings", "Bows", "Claws", "Daggers", "Rune Daggers", "Sceptres", "Staves",
    "Warstaves", "Wands", "One Hand Axes", "One Hand Maces", "One Hand Swords",
    "Thrusting One Hand Swords", "Two Hand Axes", "Two Hand Maces", "Two Hand Swords",
}

# Bases this probe reports but which are NOT defects, each with the reason it cannot see.
# Keep this list SHORT and evidenced — it is the place a real bug hides most comfortably.
KNOWN = {
    "Fishing Rod": "not obtainable as a normal drop; named only inside a unique's BaseType list",
    "Vaal Temple Map": "only exists at MapTier 16 and its block says so; the probe carries no map tier",
}

def show_path(path):
    """A readable path that survives a DIFFERENT DRIVE.

    ⚠️ `os.path.relpath` raises ValueError across Windows mounts, and the shipped filter always
    lives under Documents on C: while this repo is on G:. `check_shadowed_blocks.py` carried
    exactly this crash for months — it read as a clean pass to anything piping the output — and
    this script reproduced it on its very first run against a real deliverable. Same fix.
    """
    try:
        return os.path.relpath(path, ROOT)
    except ValueError:
        return path


NUMERIC = {"ItemLevel", "AreaLevel", "DropLevel", "Quality", "Sockets", "LinkedSockets",
           "StackSize", "MapTier", "GemLevel", "BaseDefencePercentile", "Height", "Width",
           "EnchantmentPassiveNum", "CorruptedMods", "MemoryStrands"}
BOOL = {"Corrupted", "Identified", "Mirrored", "FracturedItem", "SynthesisedItem",
        "AnyEnchantment", "Replica", "Foulborn", "TransfiguredGem", "ZanaMemory",
        "Vestigial", "HasCruciblePassiveTree", "ElderItem", "ShaperItem", "Enchanted"}
LIST = {"Class", "BaseType", "HasInfluence", "HasExplicitMod", "SocketGroup",
        "HasEnchantment", "ArchnemesisMod"}


# ---------------------------------------------------------------- parse

def parse(path):
    """Blocks in emission order, each with its conditions and whether it Continues."""
    blocks, cur, comment = [], None, ""
    for ln, raw in enumerate(io.open(path, encoding="utf-8"), 1):
        s = raw.strip()
        if s.startswith("#"):
            if s.startswith("#==["):
                comment = s[4:].rstrip("=").strip()
            continue
        if not s:
            continue
        head = s.split()[0]
        if head in ("Show", "Hide", "Minimal"):
            cur = {"cmd": head, "line": ln, "conds": [], "name": comment, "cont": False}
            blocks.append(cur)
        elif cur is None:
            continue
        elif s == "Continue":
            cur["cont"] = True
        elif head.startswith("Set") or head in ("MinimapIcon", "PlayEffect", "CustomAlertSound",
                                                "PlayAlertSound", "DisableDropSound",
                                                "EnableDropSound"):
            pass
        else:
            cur["conds"].append(s)
    return blocks


# ---------------------------------------------------------------- match

def _cmp(op, a, b):
    return {"<": a < b, "<=": a <= b, ">": a > b, ">=": a >= b, "=": a == b, "==": a == b}[op]


_PARSED = {}


def _parse(cond):
    """Split a condition line once and keep it.

    The sweep evaluates this several million times (bases × rarities × levels × blocks), so
    re-splitting and re-regexing every line turned a 20-second run into a multi-minute one
    once substring matching was added. Parse is pure, so caching on the line text is exact.
    """
    hit = _PARSED.get(cond)
    if hit is None:
        hit = _PARSED[cond] = _parse_cond(cond)
    return hit


def _parse_cond(cond):
    """-> (key, op, explicit, rest, vals, vals_lower, num)"""
    tok = cond.split(None, 1)
    key, rest = tok[0], (tok[1] if len(tok) > 1 else "")
    # ⚠️ `explicit` is load-bearing, not bookkeeping. For BaseType and Class the game reads a
    # BARE key as a SUBSTRING match and `==` as exact, so defaulting op to "==" and forgetting
    # which one was written makes every partial-match block invisible to this probe. The tree
    # uses partials for whole families — `BaseType "Runegraft of"` and `"Tattoo of"` each claim
    # every base in their family in one line — and treating those as exact reported all of them
    # lost when they are caught. It fails toward false ALARMS rather than false silence, which
    # is the right direction for a guard, but a guard that cries wolf gets switched off.
    op, explicit = "==", False
    m = re.match(r"^(<=|>=|==|<|>|=|!)\s*(.*)$", rest)
    if m:
        op, rest, explicit = m.group(1), m.group(2), True
    rest = rest.strip()

    vals = re.findall(r'"([^"]*)"', rest) if '"' in rest else rest.split()
    lows = [v.lower() for v in vals]
    rar = [RARITY[w] for w in rest.split() if w in RARITY]
    try:
        num = int(rest.split()[0])
    except (ValueError, IndexError):
        num = None
    return key, op, explicit, vals, lows, rar, num


def match_cond(cond, item):
    key, op, explicit, vals, lows, rar, num = _parse(cond)

    if key == "Rarity":
        # `Rarity Normal Magic` is a set, not a comparison.
        if not rar:
            return True
        if op in ("==", "=") and len(rar) > 1:
            return item["rarity"] in rar
        return _cmp(op, item["rarity"], rar[0])
    if key in NUMERIC:
        if num is None:
            return True
        have = item.get(key)
        return False if have is None else _cmp(op, have, num)
    if key in BOOL:
        return bool(item.get(key, False)) == bool(vals and vals[0].lower().startswith("true"))
    if key in LIST:
        have = item.get(key)
        if have is None:
            return False
        # Bare key = substring, `==` = exact. True for BaseType as well as Class; getting the
        # Class half wrong is the documented plural trap ("Blueprints", never "Blueprint").
        if not explicit and key in ("Class", "BaseType"):
            hl = have.lower()
            return any(v in hl for v in lows)
        return have in vals
    return True    # an unmodelled condition must not silently kill the block


def winner(blocks, item):
    """The block that CLAIMS this item: the first match that does not Continue."""
    last = None
    for b in blocks:
        if all(match_cond(c, item) for c in b["conds"]):
            last = b
            if not b["cont"]:
                return b
    return last


# ---------------------------------------------------------------- report

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    strict = "--check" in sys.argv
    path = args[0] if args else os.path.join(ROOT, "filter_generation", "complete_filter.filter")

    blocks = parse(path)
    net = blocks[-1]
    print("reading %s  (%d blocks)" % (show_path(path), len(blocks)))

    named = set()
    for b in blocks:
        for c in b["conds"]:
            if c.startswith("BaseType"):
                named.update(re.findall(r'"([^"]*)"', c))

    db = json.load(io.open(ITEMS_DB, encoding="utf-8"))["items"]
    db = list(db.values()) if isinstance(db, dict) else db
    seen, items = set(), []
    for it in db:                       # items_db carries duplicate rows
        k = (it["name"], it["item_class"])
        if k not in seen:
            seen.add(k)
            items.append(it)

    def probe(it, rv, a):
        return winner(blocks, {
            "Class": it["item_class"], "BaseType": it["name"], "rarity": rv,
            "AreaLevel": a, "ItemLevel": a + (2 if rv >= 2 else 1),
            "Quality": 0, "Sockets": 2, "LinkedSockets": 2, "StackSize": 1,
            "MapTier": 0, "GemLevel": 1, "BaseDefencePercentile": 50,
            "Identified": False, "Corrupted": False, "Mirrored": False, "MemoryStrands": 0,
        })

    # --- 1. a base the tree NAMES, yet which still reaches the catch-all ---
    lost = collections.defaultdict(list)
    for it in items:
        if it["name"] not in named or it["name"] in KNOWN:
            continue
        dl = it.get("drop_level") or 1
        for rname, rv in RARS:
            bad = [a for a in LADDER if a >= dl and probe(it, rv, a) is net]
            if bad:
                lost[(it["item_class"], rname)].append((it["name"], bad))

    print()
    print("=== CURATED bases reaching the catch-all ===")
    print("    (the tree names them somewhere, and the output still loses them)")
    if not lost:
        print("    none")
    for (cls, rname), rows in sorted(lost.items()):
        print("  %-22s %-7s  %d base(s)" % (cls, rname, len(rows)))
        for name, bad in sorted(rows)[:10]:
            print("      %-30s at AreaLevel %s" % (name, ",".join(map(str, bad))))
        if len(rows) > 10:
            print("      … +%d more" % (len(rows) - 10))

    # --- 2. equipment is class-netted, so ANY equipment base reaching it is a hole ---
    eq = [i for i in items if i["item_class"] in EQUIPMENT]
    print()
    print("=== EQUIPMENT reaching the catch-all, by area level ===")
    print("    (equipment is covered by CLASS nets, so a base here means a gap in the ladder)")
    eq_bad = 0
    for a in LADDER:
        row = []
        for rname, rv in RARS:
            drops = [i for i in eq if (i.get("drop_level") or 1) <= a]
            n = sum(1 for i in drops if probe(i, rv, a) is net)
            eq_bad += n
            row.append("%s %d/%d" % (rname[:4], n, len(drops)))
        flag = "  <-- HOLE" if any(not r.split()[1].startswith("0/") for r in row) else ""
        print("  A%-3d  %s%s" % (a, "   ".join("%-12s" % r for r in row), flag))

    print()
    if KNOWN:
        print("known non-defects, excluded above:")
        for k, why in sorted(KNOWN.items()):
            print("  %-22s %s" % (k, why))
        print()

    total = sum(len(v) for v in lost.values())
    print("curated bases lost: %d   equipment probes lost: %d" % (total, eq_bad))
    if strict and (total or eq_bad):
        print("FAIL: something the tree curates falls to the catch-all.")
        return 1
    print("[OK]" if not (total or eq_bad) else "(review only — pass --check to fail a build)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
