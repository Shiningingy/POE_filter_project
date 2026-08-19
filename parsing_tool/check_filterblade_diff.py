# -*- coding: utf-8 -*-
"""Cross-check our BaseType coverage against FilterBlade's, in BOTH directions.

    python parsing_tool/check_filterblade_diff.py out/build.filter
    python parsing_tool/check_filterblade_diff.py out/build.filter --fb "C:/path/FilterBlade.ruthlessfilter"

★ THE AUTHOR'S RULE (2026-08-19): *"a good way to check is to refer to filterblade, as they are
polished for a longtime — if something is there, something should be here, vice versa."*

That is a BIDIRECTIONAL claim and this tool implements both halves, because they catch opposite
mistakes:

    THEY NAME IT, WE DO NOT   -> we may be missing live content, or curating it under a
                                 stale name. This half found nothing in the tree by accident;
                                 it is the half that catches a league we under-curated.
    WE NAME IT, THEY DO NOT   -> we may be carrying dead content. This is the half that
                                 corroborated the Wildwood charms: the feed still read them
                                 LIVE, and FilterBlade's zero mentions was the second opinion
                                 that agreed with the author.

⚠️ IT IS A SECOND OPINION, NOT AN ORACLE. Three standing reasons a difference is legitimate:

  1. **Their snapshot has a date.** Ours is a file on disk, not a live feed, and it goes stale
     within days of a league. This script prints its mtime and annotates every "ours only" base
     with the version our own timeline says it entered — so content newer than their file is
     labelled instead of shouted about.
  2. **We are a different filter.** Ruthless-first, Simplified Chinese, deliberately curating
     less in some places and more in others. A base they cherry-pick and we cover with a class
     net is not a miss — see the cherry-pick + safety-net + catch-all model in CONTEXT.md.
  3. **They are not infallible.** Already proven here once: the Ruthless wiki and FilterBlade
     disagreed about Thief's Trinket and the wiki was wrong. Treat a difference as a question.

So this exits 0 always. It is a review instrument; the things it finds need a human.
"""
import io, os, re, sys, json, time, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FB_DEFAULT = os.path.join(os.path.expanduser("~"), "Documents", "My Games",
                          "Path of Exile", "FilterBlade.ruthlessfilter")


def show_path(p):
    """relpath raises ValueError across Windows drives; the filters live on C: and the repo on G:."""
    try:
        return os.path.relpath(p, ROOT)
    except ValueError:
        return p


def basetypes(path):
    """Every BaseType a filter NAMES, exact or partial.

    Partials are kept separate: `BaseType "Tattoo of"` is a family claim, not a base, and
    counting it as one would report 50 tattoos missing from whichever side used the partial.
    """
    exact, partial = set(), set()
    for line in io.open(path, encoding="utf-8", errors="replace"):
        s = line.strip()
        if not s.startswith("BaseType"):
            continue
        rest = s[len("BaseType"):].lstrip()
        is_exact = rest.startswith("==")
        vals = re.findall(r'"([^"]*)"', rest)
        (exact if is_exact else partial).update(v for v in vals if v)
    return exact, partial


def covered_by_partial(name, partials):
    low = name.lower()
    return any(p.lower() in low for p in partials)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ours_path = args[0] if args else os.path.join(ROOT, "out", "fix.filter")
    fb_path = FB_DEFAULT
    if "--fb" in sys.argv:
        fb_path = sys.argv[sys.argv.index("--fb") + 1]
    if not os.path.exists(fb_path):
        print("no FilterBlade filter at %s" % fb_path)
        return 0

    ours_e, ours_p = basetypes(ours_path)
    fb_e, fb_p = basetypes(fb_path)

    print("ours        %s   (%d exact, %d partial)" % (show_path(ours_path), len(ours_e), len(ours_p)))
    print("FilterBlade %s" % show_path(fb_path))
    print("            %d exact, %d partial — file dated %s" % (
        len(fb_e), len(fb_p), time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(fb_path)))))

    # ── when did our own timeline first see each base? labels the age of a difference ──
    entered = {}
    feed_dir = os.path.join(ROOT, "data", "from_ggg", "threads")
    if os.path.isdir(feed_dir):
        def vkey(s):
            return tuple(int(x) for x in re.findall(r"\d+", s))
        for fn in sorted(os.listdir(feed_dir), key=vkey):
            if not fn.endswith(".json"):
                continue
            doc = json.load(io.open(os.path.join(feed_dir, fn), encoding="utf-8"))
            for n in doc.get("new_items") or []:
                entered.setdefault(n.casefold(), fn[:-5])

    # ★ "Do we NAME it" is the wrong question; "does our filter HANDLE it" is the right one.
    #
    # Our coverage model is cherry-pick + a Class safety net + the catch-all (CONTEXT.md), so
    # hundreds of bases we never name are claimed by `Class == "Skill Gems"` and friends and are
    # not misses at all. Asking the naming question reported 625 of them. So each base FilterBlade
    # names is run through our filter, and only the ones that fall all the way to the catch-all
    # count — that is the same question check_catchall_coverage.py asks, from the other side.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from check_catchall_coverage import parse as cparse, winner  # noqa: E402

    blocks = cparse(ours_path)
    net = blocks[-1]
    G = os.path.join(ROOT, "data", "source", "cn-3.29", "tables")
    cls_by_base = {}
    if os.path.isdir(G):
        en = json.load(io.open(os.path.join(G, "English", "BaseItemTypes.json"), encoding="utf-8"))
        ic = json.load(io.open(os.path.join(G, "English", "ItemClasses.json"), encoding="utf-8"))
        names = {i: (r.get("Name") or r.get("Id")) for i, r in enumerate(ic)}
        for r in en:
            if r.get("Name"):
                cls_by_base.setdefault(r["Name"], names.get(r.get("ItemClassesKey"), "?"))

    def uncovered(name):
        """True only if our filter drops this base all the way to the catch-all."""
        item = {"Class": cls_by_base.get(name, "?"), "BaseType": name, "rarity": 0,
                "AreaLevel": 75, "ItemLevel": 77, "Quality": 0, "Sockets": 0, "LinkedSockets": 0,
                "StackSize": 1, "MapTier": 0, "GemLevel": 20, "BaseDefencePercentile": 50,
                "Identified": False, "Corrupted": False, "Mirrored": False, "MemoryStrands": 0}
        return winner(blocks, item) is net

    theirs_only = sorted(n for n in fb_e - ours_e
                         if not covered_by_partial(n, ours_p) and uncovered(n))
    ours_only = sorted(n for n in ours_e - fb_e if not covered_by_partial(n, fb_p))

    print()
    print("=" * 78)
    print("THEY NAME IT AND OUR FILTER LOSES IT — %d" % len(theirs_only))
    print("  a base a long-polished filter gives a line, which falls to OUR catch-all.")
    print("  Bases we cover with a Class net rather than by name are excluded — not misses.")
    print("=" * 78)
    # Grouped BY CLASS, because that is what makes the answer readable: the first run of this
    # buried four real findings under 453 divination cards, which are a DELIBERATE deferral
    # (Ruthless has no div cards; they wait for the softcore port). A known deferral reported as
    # a defect is how a review tool gets switched off.
    DEFERRED = {"Divination Cards": "deliberate — Ruthless has no div cards, deferred to the softcore port"}
    byc = collections.defaultdict(list)
    for n in theirs_only:
        byc[cls_by_base.get(n, "?")].append(n)
    for k in sorted(byc, key=lambda k: -len(byc[k])):
        names = sorted(byc[k])
        tag = "   ← %s" % DEFERRED[k] if k in DEFERRED else ""
        print("  %-24s %4d%s" % (k, len(names), tag))
        if k not in DEFERRED:
            for n in names:
                print("       %-34s entered %s" % (n, entered.get(n.casefold(), "—")))
    real = sum(len(v) for k, v in byc.items() if k not in DEFERRED)
    print("  ── %d once the deliberate deferrals are set aside." % real)

    print()
    print("=" * 78)
    print("WE NAME IT, THEY DO NOT — %d" % len(ours_only))
    print("  content we carry that they have dropped. ⚠️ Anything entering AFTER their file's")
    print("  date is explained by staleness, not by a defect — read the 'entered' column first.")
    print("=" * 78)
    by2 = collections.Counter()
    for n in ours_only:
        by2[entered.get(n.casefold(), "—")] += 1
    for v, c in sorted(by2.items()):
        names = [n for n in ours_only if entered.get(n.casefold(), "—") == v]
        print("  entered %-8s %3d   %s" % (v, c, ", ".join(names[:6]) + (" …" if len(names) > 6 else "")))

    print()
    print("agreed on %d exact base names." % len(ours_e & fb_e))
    print("(review only — this never fails a build; a difference is a question, not a verdict)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
