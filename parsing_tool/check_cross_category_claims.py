# -*- coding: utf-8 -*-
"""Which curated bases are claimed by a block from a DIFFERENT category?

    python parsing_tool/check_cross_category_claims.py out/ruthless.filter

★ THE GAP THIS FILLS. `check_shadowed_blocks.py` finds blocks nothing can reach. It is blind
to the opposite failure: a block that IS reachable, gets there first, and quietly takes bases
another category curated on purpose. That is how the Influenced net (`gen_order -40`, no
`Class`) beat `Base Maps` (alphabetical, ~121000) by eighty thousand positions and ate every
influenced map — caught only because the author photographed a purple border in game.

`docs/pending-features.md` ranks the `gen_order` audit ahead of everything else for this
reason: 52 of ~67 categories carry no explicit `gen_order` and sort by FILENAME, so the order
deciding all of this is mostly an accident of naming.

METHOD. Walk the emitted filter in order. For each base in some `base_mapping.mapping`, find
the first block that can match it and compare that block's category against the file that
curated it. Two verdicts, kept apart because they need different responses:

    DEFINITE  the winner has no gate beyond the name/class match, so it always wins and the
              curated entry is dead
    POSSIBLE  the winner also carries ItemLevel / Rarity / StackSize / sockets / AreaLevel,
              so whether it steals depends on the item that dropped

⚠️ A cross-category claim is NOT automatically a bug. A deliberate substring rule
(`BaseType "Runegraft of"`) is SUPPOSED to win, `_legacy` entries are supposed to lose, and a
21/23 support gem is supposed to be claimed by the gem-quality rule rather than its own tier.
The output is a list to read. What deserves attention is a LIVE category losing to another
LIVE one, which is what the final section isolates.

⚠️ THREE TRAPS, ALL PAID FOR ONCE — do not reintroduce them:

  1. CATEGORY IDENTITY IS THE GROUP HEADER, NOT THE BLOCK HEADER. A block header leads with
     the category's LOCALIZED name and those are not unique: `Scarabs` displays as 地图碎片,
     the same string the real Fragments category uses. Keying off it reported all 124 scarabs
     as stolen by Fragments when their own ladder claims them. 230 findings -> 101.
  2. NAME CONDITIONS AND, THEY DO NOT ALTERNATE. `BaseType "Vaal"` + `Class == "Skill Gems"`
     is a guarded rule; testing BaseType and returning early makes the guard invisible and
     reports `Timeless Vaal Emblem` (a Map Fragment) as eaten by the Vaal-gem block. That is
     precisely the defect this tool hunts, committed by the tool. 101 -> 97.
  3. A BLOCK WITH NEITHER CONDITION IS A FLOOR, NOT A THIEF. The catch-all matches everything
     by design; counting it would drown the report in 2204 rows.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "source", "cn-3.29", "tables")
BM = os.path.join(ROOT, "filter_generation", "data", "base_mapping")

# Conditions that make a match depend on the item rolled rather than on its identity.
GATES = ("ItemLevel", "AreaLevel", "Rarity", "StackSize", "Sockets", "LinkedSockets",
         "Quality", "GemLevel", "MapTier", "Corrupted", "Mirrored", "Identified",
         "FracturedItem", "SynthesisedItem", "AnyEnchantment", "HasInfluence",
         "EnchantmentPassiveNum", "BaseDefencePercentile", "TransfiguredGem", "Replica")

# Winners that are correct by construction: the sockets/links highlight is meant to outrank a
# rare's own tier, and the campaign AreaLevel ladders are meant to outrank endgame nets while
# you are in the campaign (ADR-0006).
BY_DESIGN = ("Links Highlight", "Progression")


def parse_blocks(path):
    """(order, id, category, header, command, conditions) per emitted block, in file order."""
    out, cur_hdr, cur_group = [], None, "?"
    lines = io.open(path, encoding="utf-8").read().split("\n")
    i = 0
    while i < len(lines):
        s = lines[i]
        m = re.match(r"#==\[(\d+)\]-\s*(.*?)\s*==$", s.strip())
        if m:
            bid, body = m.group(1), m.group(2)
            if bid.endswith("000"):                       # a GROUP header — see trap 1
                tail = body.split(" - ")[-1]
                en = re.findall(r"[A-Za-z][A-Za-z' &-]*", tail)
                cur_group = (max(en, key=len).strip() if en else tail.strip())
            cur_hdr = (bid, body)
            i += 1
            continue
        if s.strip() in ("Show", "Hide", "Minimal"):
            cmd, conds = s.strip(), {}
            i += 1
            while i < len(lines) and lines[i].startswith("    "):
                t = lines[i].strip()
                k = t.split(" ")[0]
                conds.setdefault(k, []).append(t[len(k):].strip())
                i += 1
            bid, hdr = cur_hdr or ("?", "?")
            out.append((len(out), bid, cur_group, hdr, cmd, conds))
            continue
        i += 1
    return out


def names(spec):
    """`== "A" "B"` -> (True, [A, B]); `"A"` -> (False, [A]) — bare means SUBSTRING in PoE."""
    ex = spec.strip().startswith("==")
    body = spec.strip()[2:] if ex else spec.strip()
    vals = re.findall(r'"([^"]*)"', body)
    return ex, [v for v in (vals or [body.strip()]) if v]


def matches(blk, base, klass):
    """None if the block cannot claim this base, else DEFINITE / POSSIBLE. See trap 2."""
    conds = blk[5]
    if "BaseType" not in conds and "Class" not in conds:
        return None                                        # a floor — see trap 3
    for key, subject in (("BaseType", base), ("Class", klass)):
        if key not in conds:
            continue
        ok = False
        for spec in conds[key]:
            ex, vals = names(spec)
            if subject and ((subject in vals) if ex else any(v in subject for v in vals)):
                ok = True
                break
        if not ok:
            return None
    return "POSSIBLE" if any(g in conds for g in GATES) else "DEFINITE"


def norm(s):
    return s.lower().replace(" ", "")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    filt = args[0] if args else os.path.join(ROOT, "out", "ruthless.filter")
    if not os.path.exists(filt):
        print("no filter at %s — generate one first" % filt)
        return 2

    blocks = parse_blocks(filt)

    bi = json.load(io.open(os.path.join(SRC, "English", "BaseItemTypes.json"), encoding="utf-8"))
    ic = json.load(io.open(os.path.join(SRC, "English", "ItemClasses.json"), encoding="utf-8"))
    bi = bi if isinstance(bi, list) else bi.get("rows", bi)
    ic = ic if isinstance(ic, list) else ic.get("rows", ic)
    cls = {i: r.get("Name") for i, r in enumerate(ic)}
    bclass = {}
    for r in bi:
        c = r.get("ItemClassesKey", r.get("ItemClass"))
        if isinstance(c, dict):
            c = c.get("rowid")
        if r.get("Name"):
            bclass.setdefault(r["Name"], cls.get(c))

    curated = {}
    for dp, _d, fs in os.walk(BM):
        for fn in fs:
            if not fn.endswith(".json"):
                continue
            p = os.path.join(dp, fn)
            try:
                d = json.load(io.open(p, encoding="utf-8"))
            except Exception:
                continue
            rel = os.path.relpath(p, BM).replace(os.sep, "/")
            for b, t in (d.get("mapping") or {}).items():
                curated.setdefault(b, (rel, t if isinstance(t, str) else "|".join(t)))

    definite, possible = [], []
    for base, (src, tier) in curated.items():
        klass = bclass.get(base)
        for blk in blocks:
            v = matches(blk, base, klass)
            if not v:
                continue
            owner = src.rsplit("/", 1)[-1].replace(".json", "")
            winner = blk[2]
            if norm(owner) not in norm(winner) and norm(winner) not in norm(owner):
                (definite if v == "DEFINITE" else possible).append(
                    (base, src, tier, blk[1], winner))
            break

    print("=== cross-category claims :: %d blocks, %d curated bases ==="
          % (len(blocks), len(curated)))
    print("  claimed by another category : %d definite, %d condition-dependent"
          % (len(definite), len(possible)))

    live_d = [r for r in definite
              if "_legacy" not in r[1] and not r[1].startswith("Legacy")
              and not any(k in r[4] for k in BY_DESIGN)]
    live_p = [r for r in possible
              if "_legacy" not in r[1] and not r[1].startswith("Legacy")
              and not any(k in r[4] for k in BY_DESIGN)]
    print("  ★ LIVE category beaten by another LIVE one : %d definite, %d possible"
          % (len(live_d), len(live_p)))
    print()
    for label, lst in (("DEFINITE — the curated entry is dead", live_d),
                       ("POSSIBLE — depends on the item's roll", live_p)):
        print("--- %s : %d ---" % (label, len(lst)))
        print("   %-30s %-36s %s" % ("base", "curated as", "claimed instead by"))
        for base, src, tier, bid, winner in sorted(lst, key=lambda r: (r[4], r[0])):
            owner = src.rsplit("/", 1)[-1].replace(".json", "")
            print("   %-30s %-36s [%s] %s"
                  % (base[:30], ("%s :: %s" % (owner, tier))[:36], bid, winner))
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
