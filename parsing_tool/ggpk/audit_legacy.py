# -*- coding: utf-8 -*-
"""Audit `_legacy/Legacy.json` against three sources that answer three different questions.

    GGPK BaseItemTypes          what EXISTS  (ADR-0004) — proves nothing about dropping,
                                since a retired base keeps its row
    GGG filter-info timeline    what DROPS, per version, as a TIMELINE not a flag
    Ruthless wiki               what Ruthless SUBTRACTS FURTHER — droppability is per-MODE

★ Status is the item's MOST RECENT event, never the first one found. GGG brings content back
(Tattoos returned; six div cards returned in 3.26), so "appears in a removed list" is only the
answer if no LATER list re-adds it. Everything below walks the versions newest-first.
"""
import io, json, os, re, sys, collections
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEED = os.path.join(ROOT, "data", "from_ggg", "threads")
OUT = os.path.join(ROOT, "data", "from_ggg", "legacy_verdict.json")

# ── what we call legacy ─────────────────────────────────────────────────────────
lg = json.load(io.open(os.path.join(
    ROOT, "filter_generation", "data", "base_mapping", "_legacy", "Legacy.json"),
    encoding="utf-8"))
legacy = sorted(lg.get("mapping", {}))
print("bases in _legacy/Legacy.json : %d" % len(legacy))

# ── class, from GGPK ────────────────────────────────────────────────────────────
bt = json.load(io.open(os.path.join(
    ROOT, "data", "source", "3.29.0.4.2", "tables", "English", "BaseItemTypes.json"),
    encoding="utf-8"))
ic = json.load(io.open(os.path.join(
    ROOT, "data", "source", "3.29.0.4.2", "tables", "English", "ItemClasses.json"),
    encoding="utf-8"))
cn = {i: r.get("Name") for i, r in enumerate(ic)}
CLS = {}
for r in bt:
    if r.get("Name") and r["Name"] not in CLS:
        CLS[r["Name"]] = cn.get(r.get("ItemClassesKey"), "?")

# ── the feed, newest first ──────────────────────────────────────────────────────
VERSIONS = ["3.29.0", "3.28.0"]          # the two we have verbatim
feed = {}
for v in VERSIONS:
    p = os.path.join(FEED, v + ".json")
    if os.path.exists(p):
        feed[v] = json.load(io.open(p, encoding="utf-8"))

def latest_event(name):
    """-> (version, 'removed'|'new') for the most recent event naming this base."""
    for v in VERSIONS:                    # VERSIONS is newest-first
        f = feed.get(v, {})
        if name in f.get("removed_items", []):
            return v, "removed"
        if name in f.get("new_items", []):
            return v, "new"
    return None, None

# ── Ruthless ────────────────────────────────────────────────────────────────────
rw = json.load(io.open(os.path.join(
    ROOT, "data", "from_wiki", "ruthless_droppability.json"), encoding="utf-8"))
disabled = set(rw["drop_disabled"])
bullets = [b.lower() for b in rw["sections"]["removed_items"]["bullets"]]

def ruthless_subtracts(n):
    """⚠️ Applied AFTER the feed, never before. The feed answers 'does this drop in the
    GAME'; the wiki answers 'does Ruthless take it away as well'. Checking the wiki first
    would let an item the feed has since RETIRED be reported as merely mode-disabled, and
    checking it not at all reports Ruthless-dead content as live — three Incubators added in
    3.28 came out LIVE on the feed alone while the wiki disables the whole class. We ship a
    Ruthless filter, so the wiki gets the last word on anything still in the game."""
    if n in disabled:
        return "wiki"
    if CLS.get(n) == "Divination Card" and any("all divination cards" in b for b in bullets):
        return "wiki: all divination cards"
    if CLS.get(n) == "Incubators" and any("all incubators" in b for b in bullets):
        return "wiki: all incubators"
    if "delirium orb" in n.lower() and any("all delirium orbs" in b for b in bullets):
        return "wiki: all delirium orbs"
    return None


verdict = collections.OrderedDict()
for n in legacy:
    v, ev = latest_event(n)
    sub = ruthless_subtracts(n)
    if ev == "removed":
        verdict[n] = ("RETIRED %s" % v, "feed")
    elif sub:
        verdict[n] = ("drop-disabled in RUTHLESS", sub + (" (live in the game since %s)" % v if ev == "new" else ""))
    elif ev == "new":
        verdict[n] = ("LIVE since %s" % v, "feed")
    else:
        verdict[n] = ("UNKNOWN", "needs an older thread")

g = collections.Counter(v[0].split()[0] for v in verdict.values())
print()
for k, c in g.most_common():
    print("   %-14s %4d" % (k, c))

print()
print("★ CLAIMED LIVE BUT SITTING IN _legacy — these are the re-homing candidates:")
live = [(n, verdict[n]) for n in legacy if verdict[n][0].startswith("LIVE")]
bycls = collections.defaultdict(list)
for n, v in live:
    bycls[CLS.get(n, "?")].append((n, v[0]))
for c in sorted(bycls):
    print("   %s (%d)" % (c, len(bycls[c])))
    for n, why in sorted(bycls[c])[:40]:
        print("        %-42s %s" % (n, why))

print()
unk = [n for n in legacy if verdict[n][0] == "UNKNOWN"]
print("UNKNOWN — no source names them (%d):" % len(unk))
byc = collections.Counter(CLS.get(n, "(not in GGPK)") for n in unk)
for c, k in byc.most_common(14):
    print("   %-30s %4d" % (c, k))

json.dump({n: {"verdict": verdict[n][0], "source": verdict[n][1], "class": CLS.get(n)}
           for n in legacy},
          io.open(OUT, "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
