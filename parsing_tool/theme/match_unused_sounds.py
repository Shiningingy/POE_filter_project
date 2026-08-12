#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] read-only by default; --apply writes item_overrides.
"""Match unused Sharket sound files to items by their official Chinese name.

    python parsing_tool/theme/match_unused_sounds.py                     # report
    python parsing_tool/theme/match_unused_sounds.py --only Currency,Gems,Maps
    python parsing_tool/theme/match_unused_sounds.py --only Currency --apply

★ The finding: `sound_files/Sharket掉落音效/` holds 698 curated mp3s and only 380 are
reachable — 318 have never been referenced by anything. They are named in Chinese after the
item they belong to (`冰川.mp3`, `传奇装备.mp3`), and every base in the tree already carries
its OFFICIAL Chinese name in `base_mapping._meta.localization.ch`. So the mapping can be
recovered by matching names rather than guessed.

⚠️ `basetype_sounds` in `Sharket_sound_map.json` is NOT a route to the filter. It is read
only by editor components — `filterGenerator.ts` never looks at it, because auto-sound was
deleted. A sound reaches the game only as an `item_overrides` entry on the tier that claims
the base. That is what --apply writes.

★ The override must go on the tier that actually CLAIMS the base, or it is dead weight the
validator will flag ("no rule targets it, so this override never applies"). Under
first-match-wins a base in three tiers is claimed by the earliest, so the winning tier is
read from a generation TRACE, not guessed from the mapping.

⚠️ Exact-name matching only. A fuzzy match here would attach a wrong sound to a real item,
and a wrong sound is worse than none — it is indistinguishable from a curation decision.
Names that match nothing are reported, never guessed at.
"""
from __future__ import annotations

import argparse
import glob
import io
import json
import os
import re
import subprocess
import sys
from collections import OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(REPO, "filter_generation", "data")
SND_REL = "Sharket掉落音效"
SND = os.path.join(REPO, "sound_files", SND_REL)
SOUND_MAP = os.path.join(DATA, "theme", "sharket", "Sharket_sound_map.json")
DEFAULT_VOLUME = 300


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def dump(p, d):
    io.open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")


def referenced():
    """Every mp3 basename reachable today, from the sound map or the curated tree."""
    out = set()
    sm = load(SOUND_MAP)
    for grp in sm.values():
        for v in grp.values():
            f = v.get("file")
            if f:
                out.add(os.path.basename(f.replace("\\", "/")))
    pat = re.compile(r'([^"/\\]+?\.mp3)')
    for p in glob.glob(os.path.join(DATA, "**", "*.json"), recursive=True):
        if "Sharket_sound_map" in p:
            continue
        try:
            t = io.open(p, encoding="utf-8").read()
        except Exception:
            continue
        out.update(m.group(1) for m in pat.finditer(t))
    return out


def zh_index():
    """official zh name -> [(base, mapping-relpath)]; ambiguous names are kept as lists."""
    idx = defaultdict(list)
    for p in glob.glob(os.path.join(DATA, "base_mapping", "**", "*.json"), recursive=True):
        rel = os.path.relpath(p, os.path.join(DATA, "base_mapping")).replace("\\", "/")
        d = load(p)
        # ⚠️ `_meta.localization.ch` is a base->name TABLE in most files but a plain
        # category-label STRING in some. Assuming the table shape crashes on those.
        loc = ((d.get("_meta") or {}).get("localization") or {}).get("ch")
        if not isinstance(loc, dict):
            continue
        mapping = d.get("mapping") or {}
        for base, zh in loc.items():
            if base in mapping and isinstance(zh, str):
                idx[zh].append((base, rel))
    return idx


def winning_tier(trace_path):
    """base -> (mapping relpath, tier_key) for the block that actually claims it."""
    blocks = sorted(load(trace_path)["blocks"], key=lambda b: b["order"])
    win = {}
    for b in blocks:
        if "Continue" in b["text"]:
            continue
        for x in (b["bases"] or []):
            win.setdefault(x, (b["file"], b["tier_key"]))
    return win


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated path prefixes, e.g. Currency,Gems,Maps")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--volume", type=int, default=DEFAULT_VOLUME)
    args = ap.parse_args()

    files = {os.path.basename(f) for f in glob.glob(os.path.join(SND, "*.mp3"))}
    unused = sorted(files - referenced())
    idx = zh_index()

    trace = os.path.join(REPO, "filter_generation", ".sound-match.trace.json")
    subprocess.run([("node"), os.path.join(REPO, "filter_generation", "generate.mjs"),
                    "--mode", "ruthless", "--strictness", "soft",
                    "--out", os.path.join(REPO, "filter_generation", ".sound-match.filter"),
                    "--trace", trace], cwd=REPO, check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    win = winning_tier(trace)

    prefixes = [s.strip() for s in (args.only or "").split(",") if s.strip()]
    matched, ambiguous, nomatch, unclaimed = [], [], [], []
    for fn in unused:
        stem = fn[:-4]
        hits = idx.get(stem)
        if not hits:
            nomatch.append(fn)
            continue
        # A base mapped in two files is the SAME item, not an ambiguity -- only genuinely
        # different bases sharing one zh name are unresolvable.
        distinct = sorted({b for b, _ in hits})
        if len(distinct) > 1:
            ambiguous.append((fn, hits))
            continue
        base, rel = hits[0]
        w = win.get(base)
        if not w:
            unclaimed.append((fn, base, rel))
            continue
        matched.append((fn, base, w[0], w[1]))

    if prefixes:
        matched = [m for m in matched if any(m[2].startswith(p) for p in prefixes)]

    print("unused mp3s: %d   exact name matches: %d%s"
          % (len(unused), len(matched), ("  (filtered to %s)" % ",".join(prefixes)) if prefixes else ""))
    by = defaultdict(list)
    for fn, base, f, tier in matched:
        by[f].append((base, tier, fn))
    for f in sorted(by):
        print("\n  %s" % f)
        for base, tier, fn in sorted(by[f]):
            print("     %-28s -> %-30s %s" % (base, tier, fn))
    print("\n  ambiguous zh name (skipped): %d" % len(ambiguous))
    for fn, hits in ambiguous[:6]:
        print("     %-24s %s" % (fn, ", ".join(b for b, _ in hits)))
    print("  matched a base that nothing emits: %d" % len(unclaimed))
    print("  no base with that zh name: %d" % len(nomatch))

    if not args.apply:
        print("\n(report only -- pass --apply, ideally with --only)")
        return

    edits = defaultdict(list)
    for fn, base, mrel, tier in matched:
        edits[mrel].append((tier, base, fn))
    for mrel, rows in sorted(edits.items()):
        tp = os.path.join(DATA, "tier_definition", mrel)
        if not os.path.exists(tp):
            print("  !! no tier file for %s" % mrel)
            continue
        doc = load(tp)
        cat = next(iter(doc))
        n = 0
        for tier, base, fn in rows:
            entry = doc[cat].get(tier)
            if not isinstance(entry, dict):
                print("  !! %s has no tier %r" % (mrel, tier))
                continue
            ov = entry.setdefault("item_overrides", OrderedDict())
            if base in ov:
                continue
            ov[base] = OrderedDict([("PlayAlertSound",
                                     ["%s/%s" % (SND_REL, fn), args.volume])])
            n += 1
        dump(tp, doc)
        print("  %-44s +%d overrides" % (mrel, n))
    print("\nwrote %d files -- regenerate and check the diff" % len(edits))


if __name__ == "__main__":
    main()
