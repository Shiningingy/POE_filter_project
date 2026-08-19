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
def _vkey(s):
    return tuple(int(x) for x in re.findall(r"\d+", s))

feed = {}
for fn in os.listdir(FEED):
    if fn.endswith(".json"):
        feed[fn[:-5]] = json.load(io.open(os.path.join(FEED, fn), encoding="utf-8"))
VERSIONS = sorted(feed, key=_vkey, reverse=True)      # NEWEST FIRST — load-bearing


def latest_event(name):
    """-> (version, 'removed'|'new'|'returning') for the MOST RECENT event naming this base.

    ⚠️ First match wins BECAUSE the list is newest-first, and that is the whole point:
    status is a timeline, not a flag. The grafts are the worked example — added in 3.27,
    removed in 3.28, so scanning oldest-first would call them live. `returning` counts as
    live: GGG brings content back (Tattoos returned in 3.24 after being removed, six div
    cards returned in 3.26), so a removal is never proof of a current state on its own.
    """
    # ⚠️ CASE-INSENSITIVE. GGG's forum prose does not always match GGPK's canonical casing —
    # the 3.20 addendum writes "Lycia's Invocation of Mind Over Matter" and "of The Agnostic"
    # where the game has "Mind over Matter" and "the Agnostic". Exact matching drops those
    # silently, which is the worst possible failure here: the row stays UNKNOWN and reads as
    # "no source names it" when a source names it plainly.
    key = name.casefold()
    for v in VERSIONS:
        f = feed.get(v, {})
        for sec, ev in (("removed_items", "removed"), ("new_items", "new"),
                        ("returning_items", "returning")):
            if any(x.casefold() == key for x in f.get(sec, [])):
                return v, ev
    return None, None

# ── Ruthless ────────────────────────────────────────────────────────────────────
rw = json.load(io.open(os.path.join(
    ROOT, "data", "from_wiki", "ruthless_droppability.json"), encoding="utf-8"))
disabled = set(rw["drop_disabled"])
# ⚠️ The wiki is the ONLY per-mode source and it is community-maintained, so it lags. The
# author's play knowledge overrides it, one base at a time, and those corrections live in
# `_author_corrections.drops_after_all` beside the parsed data — not in the parser, because
# re-parsing the saved page would otherwise silently restore the wrong answer.
disabled -= set(k for k in (rw.get("_author_corrections", {})
                            .get("drops_after_all", {}) or {}) if not k.startswith("_"))
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
    # ⚠️ GGPK's class name is PLURAL — "Divination Cards", "Incubators". The singular
    # spelling here matched nothing, so the wiki's "All divination cards" bullet never
    # fired and five cards read as UNKNOWN while the wiki disables the entire class.
    if CLS.get(n) == "Divination Cards" and any("all divination cards" in b for b in bullets):
        return "wiki: all divination cards"
    if CLS.get(n) == "Incubators" and any("all incubators" in b for b in bullets):
        return "wiki: all incubators"
    if "delirium orb" in n.lower() and any("all delirium orbs" in b for b in bullets):
        return "wiki: all delirium orbs"
    return None


# ── ★ THE PUBLICATION CLIFF ─────────────────────────────────────────────────────
# GGG published no "Removed Items" section at all until 3.16 Scourge. Before that the post
# lists ADDITIONS only, so in that window "no removal event" is a fact about the FORMAT and
# not about the item.
#
# ⚠️ This is why a pre-3.16 `new` must not resolve to LIVE. Extracting the 2.3-3.5 threads
# adds an "appeared in 2.5" event for bases like `Breach Ring` and `Vaal Breach`, and the
# naive rule would then report them LIVE since 2.5 — turning honest UNKNOWNs into confident
# wrong answers, which is strictly worse than not knowing. Breach is legacy; the feed simply
# never published the day it stopped.
#
# So a pre-cliff addition yields its own verdict: we learned WHEN it appeared, and we still
# do not know whether it drops. That is answerable only from the patch notes.
CLIFF = (3, 16, 0)


def _before_cliff(v):
    return _vkey(v) < CLIFF


# ── ★ AUTHOR STATUS — read FIRST, outranks every published source ───────────────
# The feed has three verbs (new / removed / returning). The game has more, and the extra ones
# look exactly like LIVE from here: a base that still exists, sits in no Removed Items list,
# and simply does not drop this league. GGG does that to last league's content routinely.
#
# ⚠️ This is a SHARPER limit than the 3.16 cliff. The cliff makes the feed incomplete about old
# removals; this makes it WRONG about a current one. Wildwood's charms are the proof — the feed
# reads them LIVE since 3.23 because 3.24/3.25/3.26 never name them, the 3.24 patch notes do not
# mention Wildwood at all, and FilterBlade has zero mentions. Only the author knew, from playing.
_AS = json.load(io.open(os.path.join(ROOT, "data", "from_ggg", "author_status.json"),
                        encoding="utf-8"))
AUTHOR = {}
for _k, _blk in _AS["statuses"].items():
    _label = ("drop_disabled" if _k.startswith("drop_disabled")
              else "retired" if _k.startswith("retired") else _k)
    for _i in _blk["items"]:
        AUTHOR[_i.casefold()] = (_label, _blk["_source"])

_AUTHOR_VERDICT = {"drop_disabled": "DROP DISABLED", "event_only": "EVENT ONLY",
                   "retired": "RETIRED (author)"}

verdict = collections.OrderedDict()
for n in legacy:
    v, ev = latest_event(n)
    sub = ruthless_subtracts(n)
    if n.casefold() in AUTHOR:
        _label, _src = AUTHOR[n.casefold()]
        verdict[n] = (_AUTHOR_VERDICT[_label], "author_status.json — %s" % _src)
    elif ev == "removed":
        verdict[n] = ("RETIRED %s" % v, "feed")
    elif sub:
        verdict[n] = ("drop-disabled in RUTHLESS", sub + (" (live in the game since %s)" % v if ev in ("new", "returning") else ""))
    elif ev in ("new", "returning") and _before_cliff(v):
        verdict[n] = ("ADDED %s, removal era unpublished" % v,
                      "feed:%s — pre-3.16, needs patch notes" % ev)
    elif ev in ("new", "returning"):
        verdict[n] = ("LIVE since %s" % v, "feed:" + ev)
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
