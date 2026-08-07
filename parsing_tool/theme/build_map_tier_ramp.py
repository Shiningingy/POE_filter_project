# -*- coding: utf-8 -*-
"""Expand the designer's 7 map-plate anchors into one rule per MapTier.

★ THE KIT ASSUMES A SHAPE WE DO NOT HAVE. Reply 17 specifies a plate per MAP TIER,
interpolated from 7 anchors, and says "Maps/Base Maps.json stays exactly as it is". It
cannot: our ladder is four BANDS (T16 / T11-15 / T6-10 / T1-5), and four blocks cannot emit
sixteen plates. The rung is not the axis the ramp runs on, so the ramp has to live where the
MapTier condition lives — on the rules.

So each band rule becomes N per-MapTier rules carrying an inline `overrides.BackgroundColor`.
That is the mechanism the designer described ("only its plate is overridden"): rule overrides
beat the theme row, the row still supplies size, icon and beam, and `Base Maps.json`'s tier
ladder is untouched and becomes a pure size ladder exactly as reply 17 wants.

⚠️ This is the first user of `overrides.BackgroundColor` — the channel existed with zero
users (only PlayAlertSound and BorderColor had any), so it is exercised here for the first
time and the emitted output is checked rather than assumed.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
KIT = os.path.join(ROOT, "docs", "design", "handoff", "theme-presets.json")
BM = os.path.join(ROOT, "filter_generation", "data", "base_mapping", "Maps", "Base Maps.json")
APPLY = "--apply" in sys.argv
GEN_TAG = "map_tier_ramp"   # marks rules this script owns, so a re-run rebuilds them

BAND_TIERS = {           # our band rule -> the MapTiers it covers, best-first
    # ⚠️ DO NOT put "Tier 0 Base Maps" here. BAND_TIERS is keyed on the TIER, and that tier
    # holds the ten SPECIAL-map rules (influenced, Zana, enchanted, 8-mod, Elder, Shaper
    # Guardian, both logbooks, Vaal Temple) — not a band. Adding it replaced all ten with a
    # single generated T17 rule and silently deleted the whole special-map ladder. T17 needs
    # the ramp plate on the TOP RUNG, which is a job for the special-map rebuild, not for a
    # band table that assumes one tier means one contiguous MapTier range.
    "Tier 1 Base Maps": [16],
    "Tier 2 Base Maps": [15, 14, 13, 12, 11],
    "Tier 3 Base Maps": [10, 9, 8, 7, 6],
    "Tier 4 Base Maps": [5, 4, 3, 2, 1],
}


def ramp(anchors):
    """-> {maptier: 'r g b'}; linear in sRGB between the bracketing anchors."""
    pts = sorted((int(k[1:]), [int(x) for x in v.split()]) for k, v in anchors.items())
    out = {}
    for t in range(1, 18):
        lo = max((p for p in pts if p[0] <= t), default=pts[0], key=lambda p: p[0])
        hi = min((p for p in pts if p[0] >= t), default=pts[-1], key=lambda p: p[0])
        if lo[0] == hi[0]:
            out[t] = lo[1][:]
            continue
        f = (t - lo[0]) / float(hi[0] - lo[0])
        out[t] = [int(round(a + (b - a) * f)) for a, b in zip(lo[1], hi[1])]
    return {t: " ".join(str(x) for x in v) for t, v in out.items()}


def main():
    P = json.load(io.open(KIT, encoding="utf-8"))
    spec = P.get("maps_tier_ramp") or {}
    anchors = spec.get("anchors")
    if not anchors:
        print("no maps_tier_ramp.anchors in the kit — nothing to do")
        return
    R = ramp(anchors)
    print("interpolated plate per MapTier:")
    for t in range(1, 18):
        mark = "  (anchor)" if ("T%d" % t) in anchors else ""
        print("   T%-3d %s%s" % (t, R[t], mark))

    # ⚠️ HEX, not "r g b". `parseRgba` takes `#rrggbbaa`; handed a space-separated triple it
    # cannot parse it, falls back to the theme value, and emits the OLD plate with no error —
    # 16 rules carrying a correct override that silently did nothing. Found by diffing the
    # emitted filter, which is the only place it showed.
    #
    # The ALPHA is taken from the rung's own row rather than invented, because reply 17 says
    # only the plate's hue moves: "the rung keeps size, icon and beam". Alpha is part of the
    # rung's plate treatment, so overriding it would be taking a second thing.
    theme = json.load(io.open(os.path.join(
        ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json"),
        encoding="utf-8")).get("Maps", {})
    td = json.load(io.open(os.path.join(
        ROOT, "filter_generation", "data", "tier_definition", "Maps", "Base Maps.json"),
        encoding="utf-8"))
    tcat = td[list(td)[0]]

    def alpha_for(tier_key):
        rung = ((tcat.get(tier_key) or {}).get("theme") or {}).get("Tier")
        bg = (theme.get("Tier %s" % rung) or {}).get("BackgroundColor") or "#000000ff"
        return bg[-2:] if len(bg) == 9 else "ff"

    def icon_for(mt):
        """Reply 18 §2(4): THREE values, not sixteen — Red T11-17, Yellow T6-10, White T1-5.
        The anchors are the atlas bands precisely so plate and icon never disagree; one icon
        colour across sixteen tiers is the minimap half of the design going silent. The SIZE
        stays the rung's, so only the colour is overridden."""
        band = "Red" if mt >= 11 else ("Yellow" if mt >= 6 else "White")
        return band

    def hexify(rgb, a):
        return "#" + "".join("%02x" % int(x) for x in rgb.split()) + a

    d = json.load(io.open(BM, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
    rules = d["rules"]
    out, made, dropped = [], 0, 0
    for r in rules:
        tier = (r.get("overrides") or {}).get("Tier")
        # Idempotent: a previous run already split the bands, so re-running must rebuild
        # rather than multiply. ⚠️ Drop only rules WE generated, identified by an explicit
        # tag. A first version inferred it from shape ("comment starts with T" + an `== N`
        # MapTier) and ate the original T16 band rule, which legitimately looks exactly like
        # a generated one — 15 rules instead of 16. Shape is not identity.
        # ⚠️ UPDATE in place, never drop-and-rebuild. The band rules are consumed on the
        # first run, so a second run that drops the generated ones has nothing left to
        # rebuild from and empties the ladder — 16 rules to 0, silently, because "0 replaced,
        # 0 made" reads like a no-op. The generated rule carries its own MapTier, so it is
        # its own source: recompute its plate and keep it.
        if r.get("_generated") == GEN_TAG:
            mt = int(str(r["conditions"]["MapTier"]).split()[-1])
            r["overrides"]["BackgroundColor"] = hexify(R[mt], alpha_for(tier))
            base_icon = ((theme.get("Tier %s" % (((tcat.get(tier) or {}).get("theme") or {})
                          .get("Tier"))) or {}).get("MinimapIcon") or "")
            if base_icon:
                parts = base_icon.split()
                if len(parts) == 3:
                    r["overrides"]["MinimapIcon"] = "%s %s %s" % (parts[0], icon_for(mt), parts[2])
            out.append(r)
            made += 1
            continue
        if tier in BAND_TIERS:
            dropped += 1
            for mt in BAND_TIERS[tier]:
                nr = collections.OrderedDict()
                nr["targets"] = []
                nr["conditions"] = collections.OrderedDict(
                    [("Class", '== "Maps"'), ("MapTier", "== %d" % mt)])
                ov = collections.OrderedDict(r.get("overrides") or {})
                ov["Tier"] = tier
                ov["BackgroundColor"] = hexify(R[mt], alpha_for(tier))
                base_icon = ((theme.get("Tier %s" % (((tcat.get(tier) or {}).get("theme") or {})
                              .get("Tier"))) or {}).get("MinimapIcon") or "")
                if base_icon:
                    parts = base_icon.split()
                    if len(parts) == 3:
                        ov["MinimapIcon"] = "%s %s %s" % (parts[0], icon_for(mt), parts[2])
                nr["overrides"] = ov
                nr["comment"] = "T%d" % mt
                nr["_generated"] = GEN_TAG
                out.append(nr)
                made += 1
            continue
        out.append(r)
    d["rules"] = out
    print("\nband rules replaced : %d  ->  per-MapTier rules: %d" % (dropped, made))
    if APPLY:
        io.open(BM, "w", encoding="utf-8").write(
            json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        print("wrote %s" % os.path.relpath(BM, ROOT))
    else:
        print("(dry run -- pass --apply)")


if __name__ == "__main__":
    main()
