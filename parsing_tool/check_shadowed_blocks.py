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
import io, json, os, re, sys, time, collections

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
                   "conds": set(), "ex": [], "sub": [], "cls": None, "snd": None}
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
        m = re.match(r"Class\s+(==\s*)?(.*)$", s)
        if m:
            cur["cls"] = re.findall(r'"([^"]+)"', m.group(2)) or None
        cur["conds"].add(s)
    return out


def label(h):
    m = re.match(r"#==\[(\d+)\]-\s*(.*?)\s*==$", h)
    return "[%s] %s" % (m.group(1), m.group(2)) if m else "(no header)"


def newest_data_mtime():
    """When the curation last changed — the thing a filter is supposed to be built FROM."""
    newest, where = 0.0, None
    for root in ("filter_generation/data/tier_definition",
                 "filter_generation/data/base_mapping",
                 "filter_generation/data/theme"):
        for dp, _d, fs in os.walk(os.path.join(ROOT, root)):
            for fn in fs:
                if not fn.endswith(".json"):
                    continue
                t = os.path.getmtime(os.path.join(dp, fn))
                if t > newest:
                    newest, where = t, os.path.join(os.path.basename(dp), fn)
    return newest, where


def main():
    # ★ TAKE THE PATH. This ignored argv entirely and always read the hardcoded
    # `out/audit.filter`, so every invocation that passed a filter — `... check.py
    # out/nets.filter` — silently reported on a DIFFERENT, older file and printed a
    # confident "0 SHOW blocks hidden". An entire session's worth of green guards were
    # measured against a snapshot from the previous day.
    #
    # ⚠️ THIS IS THE THIRD TIME THIS EXACT SHAPE HAS BITTEN. `create_demo_bundle.py`
    # no-ops as a CLI script so the parity test compared fresh output against a frozen
    # bundle and reported 16/16; `reconcile.py` read a hardcoded Traditional-Chinese leg
    # while Simplified sat beside it. A tool that quietly substitutes its own input for
    # yours does not fail — it passes, which is why it survives.
    path = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("-") \
        else FILTER
    if not os.path.exists(path):
        print("no %s — run: node filter_generation/generate.mjs --out %s"
              % (os.path.relpath(path, ROOT), os.path.relpath(path, ROOT)))
        return 2

    # ⚠️ AND SAY WHEN THE ANSWER IS ABOUT A STALE FILE. Shadowing is a property of the
    # EMITTED filter, so a filter older than the curation it came from answers a question
    # about the past. Loud, because the failure mode is a PASS.
    fm = os.path.getmtime(path)
    dm, where = newest_data_mtime()
    print("reading %s" % os.path.relpath(path, ROOT))
    if dm > fm:
        print("  ⚠️  STALE: this filter is older than the curation it should be built from")
        print("      filter   %s" % time.strftime("%Y-%m-%d %H:%M", time.localtime(fm)))
        print("      data     %s  (%s)" % (time.strftime("%Y-%m-%d %H:%M", time.localtime(dm)),
                                           where))
        print("      -> regenerate before trusting anything below")
    print()

    blocks = parse(path)

    # base -> the blocks naming it, in emission order. Substring matchers are expanded
    # against the names any block mentions, which is enough: a base no block names cannot
    # be shadowed by a BaseType rule.
    # ⚠️ CLASS-ONLY BLOCKS MUST COUNT. The first version skipped any block with no BaseType,
    # which silently excluded every class net — and a class-wide HIDE swallowing a base a
    # later Show block names is precisely the failure the author says is the only one that
    # matters. Reporting "0 items never appear" while unable to see the commonest cause is
    # worse than reporting nothing. Class membership comes from GGPK (ADR-0004).
    bt = json.load(io.open(os.path.join(ROOT, "data", "source", "3.29.0.4.2", "tables",
                                        "English", "BaseItemTypes.json"), encoding="utf-8"))
    ic = json.load(io.open(os.path.join(ROOT, "data", "source", "3.29.0.4.2", "tables",
                                        "English", "ItemClasses.json"), encoding="utf-8"))
    cnm = {i: r.get("Name") for i, r in enumerate(ic)}
    CLS = {}
    for r in bt:
        if r.get("Name") and r["Name"] not in CLS:
            CLS[r["Name"]] = cnm.get(r.get("ItemClassesKey"))

    universe = set()
    for b in blocks:
        universe |= set(b["ex"]) | set(b["sub"])

    # ★ AND A CLASS BLOCK'S UNIVERSE IS ITS WHOLE CLASS, not just the bases somebody named.
    #
    # `matched` is intersected with this universe, and a block is called dead when every base
    # it matches is taken. For a class NET that is exactly backwards: the whole point of
    # `Class == "Breachstones"` is the 24 breachstones NO block names, so its match set came
    # out EMPTY — and an empty set trivially equals the empty taken-set, so every net was
    # reported as unreachable. The Heist gear net was reported dead behind the 14 bases its
    # T1 lists, while it is the only thing showing the other 46.
    #
    # A net exists precisely for the bases nothing names, so those bases have to be in the
    # universe or the check inverts on the one block shape it most needs to get right.
    named_classes = set()
    for b in blocks:
        if b["cls"]:
            named_classes |= set(b["cls"])
    if named_classes:
        universe |= {n for n, c in CLS.items() if c in named_classes}

    claims = collections.defaultdict(list)
    for i, b in enumerate(blocks):
        named = bool(b["ex"] or b["sub"])
        if not named and not b["cls"]:
            continue
        for n in universe:
            if b["cls"] and CLS.get(n) not in b["cls"]:
                continue
            if not named or n in b["ex"] or any(p in n for p in b["sub"]):
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

    # ★ SEVERITY, and the author's framing is the right one: "stricter blocks have priority
    # over more general ones" is the DESIGN, not a defect. A corrupted unique jewel losing to
    # the plain unique-jewel rule is correct — it is a unique jewel and should read as one.
    #
    # So Show-behind-Show is almost never worth acting on: the item still appears, with a
    # different look or sound. What actually costs the player something is:
    #
    #   SHOW BEHIND HIDE — the item is claimed by a hiding block first and never appears.
    #   That is the only shadow that loses information rather than nuance.
    #
    # Reported in that order, and the exit code follows the hidden ones alone, so a
    # cosmetic overlap can never fail a build.
    hidden = {i: d for i, d in dead.items()
              if blocks[i]["cmd"] == "Show" and blocks[d["by"]]["cmd"] != "Show"}
    lost = {i: d for i, d in dead.items()
            if i not in hidden and blocks[i]["snd"]
            and blocks[i]["snd"] != blocks[d["by"]]["snd"]}

    print("=== shadowed blocks ===")
    print("  emitted blocks                    : %d" % len(blocks))
    print("  blocks nothing can reach          : %d" % len(dead))
    print("  ★ SHOW blocks hidden by an earlier block : %d" % len(hidden))
    print("  ...cosmetic (Show behind Show, different sound) : %d" % len(lost))
    print()
    if hidden:
        print("★★ ITEMS THAT NEVER APPEAR — a Show block claimed by a hiding block first:")
        for i in sorted(hidden):
            d = dead[i]
            print("  %s" % label(blocks[i]["hdr"]))
            print("      HIDDEN BY %s  [%s]" % (label(blocks[d["by"]]["hdr"]),
                                                blocks[d["by"]]["cmd"]))
            print("      e.g. %s" % ", ".join(sorted(d["bases"])[:6]))
    if lost:
        print()
        print("cosmetic — the dead block plays a different sound, item still shows:")
        for i in sorted(lost):
            d = dead[i]
            print("  %-56s <- %s" % (label(blocks[i]["hdr"])[:56],
                                     label(blocks[d["by"]]["hdr"])[:46]))
    return 1 if hidden else 0


if __name__ == "__main__":
    sys.exit(main())
