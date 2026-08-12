# -*- coding: utf-8 -*-
"""Give the special-map rules their own look, ON THE RULE — no new tier.

★ WHY NOT A TIER. Reply 18 answered the swap question in tier-shaped terms: give the
specials their own rung, floored at T2, so a modifier can raise an item's rung and never
lower it. That is correct FOR A TIER-SHAPED WORLD, and maps are no longer in one — the
plate already comes from a per-MapTier rule, so the tier ladder supplies only size, icon
and beam. Building a tier purely so a swap has a rung to sit on is inventing the axis we
just stopped using. The author's call: put the look on the rule.

WHAT EACH SPECIAL GETS:
    plate  its own BAND's plate, so a T13 influenced map still reads as a red map
    text   110 20 140, the maps swap — dark BECAUSE maps run light (their §3: a swap
           colour is chosen for the plate it speaks against; 120 235 210 measures 9.99:1
           on gear's near-black and ~1.3:1 on a 242 map plate)
    size   the band's, floored at T2's 40px, so adding a modifier never makes an item
           quieter — reply 18's "a claim may raise an item's rung and must never lower it"

⚠️ BANDS, NOT SIXTEEN TIERS. Six specials × sixteen tiers is 96 blocks for a distinction no
player reads at that resolution. The three atlas bands are what the anchors were chosen to
express in the first place, so the specials split on the same three.

⚠️ THE LOGBOOKS ARE NOT MAPS and are left alone here. No MapTier means no band and no plate
for a swap to speak against; reply 18 sends them to the expedition accent, which is a
category move rather than a look, and is not this script's job.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BM = os.path.join(ROOT, "filter_generation", "data", "base_mapping", "Maps", "Base Maps.json")
KIT = os.path.join(ROOT, "docs", "design", "handoff", "theme-presets.json")
APPLY = "--apply" in sys.argv
GEN = "map_specials"

# (label, MapTier condition, the band's plate anchor, the band's rung size)
BANDS = [
    ("red",    ">= 11", "T11", 40),
    ("yellow", "RANGE >= 6 <= 10", "T6", 40),
    ("white",  "RANGE >= 1 <= 5", "T1", 40),
]
# the rules whose look should become "this map has a claim on it"
SPECIAL = {"Conquer Influenced Maps", "Zana Memory", "Enchanted Maps",
           "8-Mod Corrupted Maps", "Elder Maps"}


def main():
    P = json.load(io.open(KIT, encoding="utf-8"))
    swap = (P.get("text_swaps", {}).get("map_special") or {}).get("text")
    anchors = (P.get("maps_tier_ramp") or {}).get("anchors") or {}
    if not swap or not anchors:
        print("kit has no map_special swap or no ramp anchors — nothing to do")
        return 1

    d = json.load(io.open(BM, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
    out, made, replaced = [], 0, 0
    for r in d["rules"]:
        if r.get("_generated") == GEN:
            continue                                  # rebuild from the source rules
        if r.get("comment") not in SPECIAL:
            out.append(r)
            continue
        replaced += 1
        for label, cond, anchor, size in BANDS:
            nr = collections.OrderedDict()
            nr["targets"] = list(r.get("targets") or [])
            c = collections.OrderedDict(r.get("conditions") or {})
            c["MapTier"] = cond
            nr["conditions"] = c
            ov = collections.OrderedDict(r.get("overrides") or {})
            plate = anchors[anchor]
            ov["BackgroundColor"] = "#" + "".join("%02x" % int(x) for x in plate.split()) + "f0"
            ov["TextColor"] = "#" + "".join("%02x" % int(x) for x in swap.split()) + "ff"
            ov["FontSize"] = size
            nr["overrides"] = ov
            nr["comment"] = "%s · %s" % (r.get("comment"), label)
            if r.get("localization"):
                nr["localization"] = r["localization"]
            nr["_generated"] = GEN
            out.append(nr)
            made += 1

    d["rules"] = out
    print("special rules rebuilt : %d source -> %d banded" % (replaced, made))
    print("swap text %s on band plates %s"
          % (swap, ", ".join(anchors[a] for _l, _c, a, _s in BANDS)))
    if APPLY:
        io.open(BM, "w", encoding="utf-8").write(
            json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        print("wrote %s" % os.path.relpath(BM, ROOT))
    else:
        print("(dry run -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
