# -*- coding: utf-8 -*-
"""Find emitted blocks that nothing can ever reach, and the sounds they take down with them.

★ WHY THIS IS A SEPARATE TOOL FROM validate_curation.py. Shadowing is a property of the
EMITTED FILTER, not of the curation: it depends on the order blocks come out in, which
depends on `_meta.gen_order`, on rule order inside a file, and on the walk. Two files can
each be perfectly valid and still produce a dead block between them. So this reads the
generated filter, the way `who_claims.py` does.

THE TEST. Block A (earlier) makes block B (later) unreachable when

    A and B can match the same base, AND A's conditions are a SUBSET of B's

because anything satisfying B's conditions then also satisfies A's, and first-match-wins
gives it to A. A subset test is deliberately CONSERVATIVE — it will not flag two blocks
whose conditions merely overlap (`MapTier >= 11` vs `MapTier == 16`), so it under-reports
rather than crying wolf. Every row it does report is a block that cannot fire.

WHAT IT CATCHES, all of which happened in this project:
  - a per-item sound ported onto a base an earlier block already claims (Chronicle of
    Atzoatl: the author added it via the bulk editor, saw nothing change, and the reason
    was a competing rule in Misc)
  - a mapping entry left behind after a rule takes over the same base (Thief's Trinket)
  - a curated sound lost to a broader net (Prismatic Jewel -> Legacy, Contract:
    Smuggler's Den -> Misc)

⚠️ IT DOES NOT CATCH A DELETED BLOCK. A block that stopped being emitted at all is a
different failure and needs a count, not this.
"""
import io, json, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILTER = os.path.join(ROOT, "out", "audit.filter")

STYLE_PREFIX = ("Set", "Play", "Minimap", "CustomAlert", "Continue", "DisableDropSound")


def parse(path):
    """-> [(header, command, [conditions], [basetypes exact], [basetypes substring], sound)]"""
    out, pending, cur = [], [], None
    for ln in io.open(path, encoding="utf-8").read().split("\n"):
        if ln.startswith("#==["):
            pending.append(ln)
            continue
        m = re.match(r"^(Show|Hide|Minimal)\b", ln)
        if m:
            cur = {"hdr": pending[-1] if pending else "", "cmd": m.group(1),
                   "conds": set(), "ex": [], "sub": [], "snd": None}
            out.append(cur)
            pending = []
            continue
        if cur is None or not ln.startswith((" ", "\t")) or not ln.strip():
            continue
        s = ln.strip()
        if s.startswith("CustomAlertSound"):
            cur["snd"] = s
            continue
        if s.startswith(STYLE_PREFIX):
            continue
        m = re.match(r"BaseType\s+(==\s*)?(.*)$", s)
        if m:
            names = re.findall(r'"([^"]+)"', m.group(2))
            (cur["ex"] if m.group(1) else cur["sub"]).extend(names)
            continue
        cur["conds"].add(s)
    return out


def label(h):
    m = re.match(r"#==\[(\d+)\]-\s*(.*?)\s*==$", h)
    return "[%s] %s" % (m.group(1), m.group(2)) if m else "(no header)"


def main():
    if not os.path.exists(FILTER):
        print("no %s — run: node filter_generation/generate.mjs --out out/audit.filter"
              % os.path.relpath(FILTER, ROOT))
        return 2
    blocks = parse(FILTER)

    # base -> the blocks naming it, in emission order. Substring matchers are expanded
    # against the names any block mentions, which is enough: a base no block names cannot
    # be shadowed by a BaseType rule.
    universe = set()
    for b in blocks:
        universe |= set(b["ex"]) | set(b["sub"])
    claims = collections.defaultdict(list)
    for i, b in enumerate(blocks):
        if not (b["ex"] or b["sub"]):
            continue
        for n in universe:
            if n in b["ex"] or any(p in n for p in b["sub"]):
                claims[n].append(i)

    # ⚠️ A BLOCK IS DEAD ONLY IF **EVERY** BASE IT MATCHES IS TAKEN. A first version flagged
    # a block as soon as ONE of its bases was shadowed, which reported every safety net in
    # the tree: `Essences T3 剩余` matches `Essence of` and loses four named essences to T0,
    # while still being the only block that shows the other thirty. That is the net working.
    # Requiring the whole match set turns "some overlap" into "cannot fire", which is the
    # only version worth acting on.
    shadowed_bases = collections.defaultdict(set)   # block index -> bases taken from it
    matched = collections.defaultdict(set)          # block index -> bases it matches
    culprit = collections.defaultdict(collections.Counter)   # block -> who took them
    for n, idxs in claims.items():
        for i in idxs:
            matched[i].add(n)
        for a in range(len(idxs)):
            A = blocks[idxs[a]]
            for bi in idxs[a + 1:]:
                if A["conds"] <= blocks[bi]["conds"]:
                    shadowed_bases[bi].add(n)
                    culprit[bi][idxs[a]] += 1      # ⚠️ the block that ACTUALLY took it
                    break
    dead = {}
    for bi, taken in shadowed_bases.items():
        if taken == matched[bi]:
            # Report the block responsible for the most of them. A first version reported
            # the EARLIEST block sharing any shadowed base, which is not the same thing and
            # named a block that shared no base at all — an attribution that reads as a
            # false positive and would have got the whole check ignored.
            by = culprit[bi].most_common(1)[0][0]
            dead[bi] = {"by": by, "bases": sorted(taken)}

    lost = {i: d for i, d in dead.items()
            if blocks[i]["snd"] and blocks[i]["snd"] != blocks[d["by"]]["snd"]}

    print("=== shadowed blocks ===")
    print("  emitted blocks              : %d" % len(blocks))
    print("  blocks nothing can reach    : %d" % len(dead))
    print("  ...of which lose a SOUND    : %d" % len(lost))
    print()
    if lost:
        print("★ SOUND LOSSES — the dead block plays something the winner does not:")
        for i in sorted(lost):
            d = dead[i]
            print("  %s" % label(blocks[i]["hdr"]))
            print("      shadowed by %s" % label(blocks[d["by"]]["hdr"]))
            print("      would have played %s" % (blocks[i]["snd"] or "")[:70])
            print("      e.g. %s" % ", ".join(sorted(d["bases"])[:4]))
    return 1 if lost else 0


if __name__ == "__main__":
    sys.exit(main())
