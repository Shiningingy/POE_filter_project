"""Reconcile GGG's official filter-info timeline against our curation.

GGG publishes an Item Filter Information post every league (data/from_ggg/). This resolves
each item's CURRENT status from its LAST event — removal is not permanent, GGG returns
drop-disabled content — and then answers two questions:

  1. Which bases do we still curate that GGG has retired?     (dead weight in the filter)
  2. Which filter conditions does the game accept that we      (features we do not know about)
     have never used?

    python parsing_tool/ggg_filter_info/reconcile.py
    python parsing_tool/ggg_filter_info/reconcile.py --json out.json

⚠️ Reports a floor, not a census. Sections flagged `_complete: false` were captured
truncated, so "not listed as removed" never proves "still live".
"""
import json, io, os, re, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
GGG = os.path.join(ROOT, "data", "from_ggg")
DATA = os.path.join(ROOT, "filter_generation", "data")
BM = os.path.join(DATA, "base_mapping")
TD = os.path.join(DATA, "tier_definition")


def load(p):
    with io.open(p, encoding="utf-8") as f:
        return json.load(f)


def version_key(v):
    return tuple(int(x) for x in re.findall(r"\d+", v))


def flatten(section):
    """A removed/returning block is either {items: [...]} or {ClassName: [...]}."""
    out = []
    for k, v in (section or {}).items():
        if k.startswith("_"):
            continue
        if isinstance(v, list):
            out += v
    return out


def resolve_status():
    """base name -> (status, version, complete) taking the LAST event per item."""
    tl = load(os.path.join(GGG, "timeline.json"))["versions"]
    events = collections.defaultdict(list)
    for ver in sorted(tl, key=version_key):
        v = tl[ver]
        rm = v.get("removed_items") or {}
        rt = v.get("returning_items") or {}
        for name in flatten(rm):
            events[name].append(("removed", ver, rm.get("_complete", False)))
        for name in flatten(rt):
            events[name].append(("returning", ver, rt.get("_complete", False)))
    return {n: ev[-1] for n, ev in events.items()}, events


def our_bases():
    """base name -> [files that curate it]"""
    out = collections.defaultdict(list)
    for dp, dn, fns in os.walk(BM):
        for fn in fns:
            if not fn.endswith(".json"):
                continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, BM).replace(os.sep, "/")
            try:
                d = load(p)
            except Exception:
                continue
            for b in (d.get("mapping") or {}):
                out[b].append(rel)
            for r in (d.get("rules") or []):
                for b in (r.get("targets") or []):
                    out[b].append(rel)
    return out


def our_conditions():
    seen = collections.Counter()

    def rec(o):
        if isinstance(o, dict):
            if isinstance(o.get("conditions"), dict):
                for k in o["conditions"]:
                    seen[k] += 1
            for k, v in o.items():
                if k != "mapping":
                    rec(v)
        elif isinstance(o, list):
            for x in o:
                rec(x)

    for root in (TD, BM):
        for dp, dn, fns in os.walk(root):
            for fn in fns:
                if fn.endswith(".json"):
                    try:
                        rec(load(os.path.join(dp, fn)))
                    except Exception:
                        pass
    return seen


def main():
    status, events = resolve_status()
    mine = our_bases()
    conds = our_conditions()
    tl = load(os.path.join(GGG, "timeline.json"))["versions"]

    dead, returned_ok = [], []
    for base, files in sorted(mine.items()):
        st = status.get(base)
        if not st:
            continue
        kind, ver, complete = st
        if kind == "removed":
            dead.append((base, ver, sorted(set(files)), complete))
        else:
            returned_ok.append((base, ver))

    print("=== 1. BASES WE CURATE THAT GGG HAS RETIRED ===")
    if not dead:
        print("   none")
    by_file = collections.defaultdict(list)
    for base, ver, files, complete in dead:
        for f in files:
            by_file[f].append((base, ver))
    for f in sorted(by_file):
        print("   %s  (%d)" % (f, len(by_file[f])))
        for base, ver in sorted(by_file[f]):
            print("        %-42s removed in %s" % (base, ver))
    print("   TOTAL: %d bases across %d files" % (len(dead), len(by_file)))
    print()

    if returned_ok:
        print("=== 2. bases we curate that were removed AND CAME BACK (correctly kept) ===")
        for base, ver in sorted(returned_ok)[:20]:
            print("   %-44s returning in %s" % (base, ver))
        print("   TOTAL: %d" % len(returned_ok))
        print()

    print("=== 3. FILTER CONDITIONS THE GAME ACCEPTS THAT WE NEVER USE ===")
    for ver in sorted(tl, key=version_key, reverse=True):
        for c in tl[ver].get("new_conditions") or []:
            n = c["name"]
            mark = "USED x%d" % conds[n] if conds.get(n) else "*** NEVER USED ***"
            print("   %-18s (%s, added %s)   %s" % (n, c.get("values", "?"), ver, mark))
    print()

    print("=== 4. conditions GGG REMOVED that we might still emit ===")
    any_bad = False
    for ver in sorted(tl, key=version_key):
        for c in tl[ver].get("removed_conditions") or []:
            n = c["name"]
            if conds.get(n):
                any_bad = True
                print("   ⚠️ %-18s removed in %s but WE USE IT x%d" % (n, ver, conds[n]))
    if not any_bad:
        print("   none")
    print()

    # ⚠️ A rename does NOT prove the old name is dead: GGG re-uses retired names for new
    # items. "Veiled Chaos Orb" became "Veiled Orb" in 3.24, that became "Veiled Exalted Orb"
    # in 3.26 — and a NEW "Veiled Chaos Orb" exists in the 3.29 dump. So cross-check the live
    # GGPK before calling a name stale. This is the repo's standing split: GGPK says what
    # EXISTS, the timeline says what DROPS.
    live_names = set()
    try:
        gg = load(os.path.join(ROOT, "data", "source", "cn-3.29", "tables",
                               "English", "BaseItemTypes.json"))
        rows = gg if isinstance(gg, list) else gg.get("rows", gg.get("data", []))
        live_names = {r.get("Name") for r in rows if r.get("Name")}
    except Exception as e:
        print("   (could not load GGPK for the rename cross-check: %s)" % e)

    print("=== 5. renames: do we still curate the OLD name? ===")
    hits = 0
    for ver in sorted(tl, key=version_key):
        for old, new in (tl[ver].get("renamed_items") or {}).get("pairs", []):
            if old not in mine:
                continue
            if live_names and old in live_names:
                print("   ok  %-38s renamed in %s, but the name EXISTS in the 3.29 dump "
                      "— re-used for a different item, not stale" % (old, ver))
                continue
            hits += 1
            print("   ⚠️ %-40s -> %-40s (%s)  in %s" %
                  (old, new, ver, ", ".join(sorted(set(mine[old])))))
    if not hits:
        print("   no stale names")
    print()

    # A base that is not in BaseItemTypes matches NOTHING — silently. The one legitimate
    # exception is transfigured gems, which are GemEffects rows, not BaseItemTypes
    # (CLAUDE.md); those are matched with `TransfiguredGem True`, never by name.
    if live_names:
        print("=== 6. bases we curate that are NOT in the 3.29 BaseItemTypes dump ===")
        missing = collections.defaultdict(list)
        for base, files in mine.items():
            if base not in live_names:
                for f in sorted(set(files)):
                    missing[f].append(base)
        if not missing:
            print("   none")
        for f in sorted(missing, key=lambda k: -len(missing[k])):
            print("   %-46s %d" % (f, len(missing[f])))
            for b in sorted(missing[f])[:6]:
                print("        %s" % b)
            if len(missing[f]) > 6:
                print("        ... +%d more" % (len(missing[f]) - 6))
        print("   TOTAL: %d base names across %d files" % (
            sum(len(v) for v in missing.values()), len(missing)))
        print()

    incomplete = [v for v in tl if not (tl[v].get("removed_items") or {}).get("_complete", True)]
    if incomplete:
        print("⚠️ removed-item lists captured INCOMPLETE for: %s" % ", ".join(sorted(incomplete)))
        print("   Those versions report a floor. 'Not listed' does not mean 'still live'.")

    if "--json" in sys.argv:
        dest = sys.argv[sys.argv.index("--json") + 1]
        io.open(dest, "w", encoding="utf-8").write(json.dumps({
            "retired_but_curated": [{"base": b, "removed_in": v, "files": f} for b, v, f, _ in dead],
            "unused_conditions": [c["name"] for ver in tl for c in (tl[ver].get("new_conditions") or [])
                                  if not conds.get(c["name"])],
        }, ensure_ascii=False, indent=1) + "\n")
        print("\nwrote %s" % dest)


if __name__ == "__main__":
    main()
