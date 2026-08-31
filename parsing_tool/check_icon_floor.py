# -*- coding: utf-8 -*-
"""Does any block draw a minimap icon deeper than the pickup floor allows?

    python parsing_tool/check_icon_floor.py out/build.trace.json
    python parsing_tool/check_icon_floor.py out/build.trace.json --check   # exit 1 on a violation

★ WHY THIS EXISTS. The designer's icon floor (handoff rev 31, corrected by rev 32) is:

    An icon may be drawn at theme rung R3 or deeper ONLY IF
      (a) that rung is the TOP of its ladder, or
      (b) the category is one of four named relaxations, and the rung is exactly R3.

and — this is the part that has no other enforcement —

    ★ A LADDER IS A THEME CATEGORY, NOT A FILE.

The exemption exists because the top of a ladder is the one thing in it a player is
definitely walking to, and a ladder is precisely what a shared style row describes. So a
tier-definition FILE that is mid-ladder inside its theme category has no top to claim.

Today the two readings agree, because all 17 exemption-holders happen to be single-file
theme categories. They stop agreeing the moment a flat category grows a ladder or two
categories are merged onto one row — which is the open §7 re-tier backlog. At that point
the file-level reading would silently grant two icons to one ladder, and nothing else in
the repo would notice. Hence this.

`Base Jewels` was the one case that already diverged: its only rung is R4, so it looked
like a file-level top, while being mid-ladder in the `Jewels` theme category. It is cut.
"""
import argparse, collections, glob, io, json, os, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
TIER_DIR = os.path.join(REPO, "filter_generation", "data", "tier_definition")

# Keep R3, drop deeper. Findability cases the channel exists for (handoff rev 31 §8).
RELAXATIONS = {
    "Maps/Fragments": "fragments are pickup-always in Ruthless; one off-screen is the case",
    "Maps/Scarabs": "scarab visibility was an explicit author ask",
    "Gems/Skill": "R3 only — a net is a safety net, not a pickup",
    "Currency/Tainted Currency": "corrupted currency is worth the walk",
}
FLOOR = 3          # R3 and deeper needs an exemption
HIDE_RUNG = 9      # the hide row never draws


def theme_category_of_file() -> dict:
    """tier-definition path (no extension) -> its theme category, mirroring resolveThemeKey."""
    out = {}
    for p in glob.glob(os.path.join(TIER_DIR, "**", "*.json"), recursive=True):
        try:
            doc = json.load(io.open(p, encoding="utf-8"))
        except Exception:
            continue
        cat_key = next((k for k in doc if not k.startswith("//")), None)
        if not cat_key or not isinstance(doc.get(cat_key), dict):
            continue
        meta = doc[cat_key].get("_meta")
        tc = (meta.get("theme_category") if isinstance(meta, dict) else None) or cat_key
        rel = os.path.relpath(p, TIER_DIR).replace(os.sep, "/")[:-5]
        out[rel] = tc
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("trace")
    ap.add_argument("--check", action="store_true", help="exit 1 on a violation")
    a = ap.parse_args()

    doc = json.load(io.open(a.trace, encoding="utf-8"))
    theme_of = theme_category_of_file()

    ladder = collections.defaultdict(set)   # theme category -> rungs it spans
    icons = []                              # (file, tier_key, rung)
    total_icon_blocks = 0
    for b in doc["blocks"]:
        if b.get("is_hide"):
            continue
        f = (b.get("file") or "").replace("tier_definition/", "").replace(".json", "")
        n = b.get("tier_num")
        if isinstance(n, int) and not isinstance(n, bool) and n != HIDE_RUNG:
            ladder[theme_of.get(f, f)].add(n)
        if "MinimapIcon" in (b.get("text") or ""):
            total_icon_blocks += 1
            if isinstance(n, int) and not isinstance(n, bool) and FLOOR <= n != HIDE_RUNG:
                icons.append((f, b.get("tier_key", "?"), n))

    seen, exempt, bad = set(), [], []
    holders = collections.defaultdict(set)
    for f, key, n in icons:
        if (f, key) in seen:
            continue
        seen.add((f, key))
        tc = theme_of.get(f, f)
        top = min(ladder[tc]) if ladder[tc] else None
        if f in RELAXATIONS and n == FLOOR:
            exempt.append((f, key, n, "relaxation"))
        elif n == top:
            exempt.append((f, key, n, "ladder top of %r @R%s" % (tc, top)))
            holders[tc].add(f)
        else:
            bad.append((f, key, n, tc, top))

    print("=== icon floor — %s" % os.path.basename(a.trace))
    print("    %d block(s) draw an icon; %d tier(s) at R%d+, %d exempt, %d violating\n"
          % (total_icon_blocks, len(seen), FLOOR, len(exempt), len(bad)))

    for f, key, n, why in sorted(exempt):
        print("  [ok]  R%d %-38s %-30s %s" % (n, f[:37], key[:29], why))

    # One ladder must not show the exemption on two files — that is the rev-32 trap.
    dupes = {tc: v for tc, v in holders.items() if len(v) > 1}
    if dupes:
        print("\n!! a ladder is claiming the top-tier exemption from MORE THAN ONE file:")
        for tc, files in sorted(dupes.items()):
            print("     %s  <- %s" % (tc, ", ".join(sorted(files))))
        print("   Only the ladder's top rung may draw. One of each pair is wrong.")

    if bad:
        print("\n!! %d icon(s) below the floor with no exemption:" % len(bad))
        for f, key, n, tc, top in sorted(bad):
            print("     R%d %-38s %-30s mid-ladder in %r (top R%s)" % (n, f[:37], key[:29], tc, top))
        print("\n   Silence one with an explicit \"MinimapIcon\": null on the tier's inline")
        print("   theme — NOT by deleting the key. An absent key means the theme ROW decides,")
        print("   and the row supplies an icon for Skill Gems R4/R5 and Scarabs R4.")

    fail = len(bad) + len(dupes)
    if fail == 0:
        print("\n[OK] every R%d+ icon is a ladder top or a named relaxation" % FLOOR)
    return 1 if (fail and a.check) else 0


if __name__ == "__main__":
    sys.exit(main())
