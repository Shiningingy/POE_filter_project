# -*- coding: utf-8 -*-
"""Re-tier: make `theme.Tier` mean the same thing in every category.

    python parsing_tool/theme/retier.py           # review table
    python parsing_tool/theme/retier.py --apply   # write

★ THE PROBLEM. `theme.Tier` currently answers "how good is this FOR A THING OF THIS TYPE" —
a rank inside its own category. So `Ducats T1` (the worse ducat) and `Tier 8 General`
(Scroll of Wisdom) both landed on rung 4 and the theme painted them identically. It was
right to: they ARE the same rung. The rung was wrong.

The designer's rungs ask about the ITEM instead, with behavioural tests — "would you cross
the screen for it", "would you turn around for it" — none of which mention a category. This
pass writes those answers into `theme.Tier`.

★ ANCHORED ON CURRENCY, because currency is the yardstick everything in PoE is priced in,
and it is our most granular ladder (9 tiers against a median of 3-4).

⚠️ THE ANCHOR IS NOT `Currency Tier N = RN`. This file said that, and it was wrong — the
table below was built on it, so the table inherits the error (see the audit note at the
bottom). The SHIPPED currency ladder pairs nine tiers onto five rungs, which is what
`apply_designer_patch.py` means by "collapses nine tiers onto five rungs" and what
`docs/design/handoff/reply-05-six-rungs.md` means by "currency now uses T0-T4 and skips
only T5 (no floor below scrolls)":

    R0  T0 顶级通货                    Mirror
    R1  T1 神圣石级  + T2 高价值通货     Divine / high value
    R2  T3 崇高石级  + T4 混沌石级       Exalted / Chaos
    R3  T5 点金石级  + T6 改造石级       Alchemy / Alteration
    R4  T7 低价值通货 + T8 卷轴          low value / scrolls
    R5  --                            the floor, BELOW scroll level (currency has nothing here)

Roughly one rung per decade of value — five orders of magnitude across six rungs, which is
why "roughly that level" is precise enough and nobody has to price anything exactly.

★ RECALIBRATED 2026-08-09. The table below was first written against the WRONG labels —
"R3 = Exalted, R4 = Chaos, R5 = alch and below" — so every judgement from R2 down sat 1-2
rungs quieter than the anchor it claimed to match, and 79 tiers ended up on R5, i.e. below a
Scroll of Wisdom. The author confirmed the anchor holds for Ruthless as-is: *"currency are
rarer in ruthless but the relevant value stay the same"* — scarcer, same relative order — so
the fix is per-tier moves, not a shift of the whole ladder.

15 tiers moved, all upward, and each one is a thing that trades above the rung it was on:

    R4 -> R3   things that beat a scroll : common fragments, common oils, common omens,
               Splinters T1 (labelled 值得停下 — "worth stopping for"), common essences,
               common scarabs, low tainted currency, other uniques
    R5 -> R4   things that are not floor : single splinters, the top life/mana flasks
               (labelled 顶级 yet painted as noise), tinctures, low-value fragments,
               other blueprints, other contracts

★ The author had already found this by eye before the anchor error was traced: *"just find
lowtier oils are still somehow low visibility"* — `Oils Tier 3` was on R4, scroll level, for
an item that is not scroll-level. The in-game read and the arithmetic agreed.

Everything genuinely below scroll stays on R5: gold (auto-collected, the label is a readout),
the equipment nets, RGB linked, legacy, the trinket bottoms.

⚠️ THIS PASS IS DELIBERATELY VISUALLY NEUTRAL. Moving a tier to a rung whose row does not
exist would hand it the `{}` fallback — bare `SetFontSize 32`, no colour — which is exactly
how the Rare net shipped invisible earlier. So when a tier moves, its CURRENT row is copied
to the new rung first. The emitted filter should come out BYTE-IDENTICAL, and that is the
check: a relabel that changes a single byte of output is not a relabel.

Restyling comes later, when the theme collapses to `family x rung`. Two steps, two risks,
not one big one.

⚠️ CAMPAIGN IS EXEMPT — 61 tiers, a quarter of the tree. Its tiers are gated by `AreaLevel`
bands, not by value: a leveling weapon is not competing with a Divine Orb for attention, it
is competing with the same weapon two acts later. Forcing it onto a value scale would be
inventing an axis it does not have.

⚠️ STATES ARE EXEMPT — decorators carry no rung by design; they paint one channel and
compose via `Continue`.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket",
                     "sharket_theme.json")
APPLY = "--apply" in sys.argv

ANCHOR = {0: "顶级通货 Mirror", 1: "神圣石级 Divine", 2: "高价值通货 high",
          3: "崇高石级 Exalted", 4: "混沌石级 Chaos", 5: "点金石级 and below"}

# tier key -> rung. Written per tier rather than derived, because "what is this worth" is a
# judgement and a judgement should be readable. Grouped by category, top of each ladder
# first; the reason for the TOP of each is what matters — the rest cascade by rank.
RETIER = {
    # --- league currency: valuable but not chase; tops out around Exalted -------------
    "Enshrouding Crystals": 3, "Incursion Vials": 3, "Enshrouded Gear": 3,
    "Tier 0 Omens": 2, "Tier 1 Omens": 3, "Tier 2 Omens": 3,   # omens are priced currency
    "Tier 0 Runegrafts": 3, "Tier 1 Runegrafts": 4, "Tier 2 Runegrafts": 5,
    "Tier 1 Wombgifts": 3, "Tier 2 Wombgifts": 4, "Tier Net Wombgifts": 5,
    "Tier 0 Heist Currency": 4, "Tier 1 Heist Currency": 5,

    # --- gold: auto-collected, the label is a readout ---------------------------------
    "Tier 0 Gold": 5, "Tier 1 Gold": 5, "Tier 2 Gold": 5,

    # --- crafting bases: a perfect-defence base is a good craft, not a Mirror ----------
    "Crafting Perfect Defence": 2, "Crafting Over Quality": 3,
    "Crafting Strands 60+": 3, "Crafting Strands T1": 3,
    "Crafting Strands T2": 4, "Crafting Strands T3": 4,
    "Crafting Gear 86": 5, "Crafting Gear 86 Rank B": 5,
    "Crafting Gear 85": 5, "Crafting Gear 84": 5,

    # --- gear nets: these are "read the label" items -----------------------------------
    "Magic Good Jewellery": 4, "Magic Net": 5, "Rare Net": 4,
    "Tier 1 Rare Equipment": 3, "Tier 2 Rare Equipment": 4,
    "Tier 3 Rare Equipment": 5, "Tier 4 Rare Equipment": 5,
    "Tier 0 Fractured": 3, "Tier 1 Fractured": 4,
    "Tier 2 Fractured": 5, "Tier 3 Fractured": 5,
    "Tier 0 Influenced": 2, "Tier 1 Influenced": 3,
    "Tier 2 Influenced": 4, "Tier 3 Influenced": 5,

    # --- specific gear bases -----------------------------------------------------------
    "Relics": 4, "Breach Grasping Mail": 3, "Expedition Ward-Bases": 4,
    "Mirror of Kalandra Ring Bases": 3, "Sacrificial Garbs": 3,
    "Ritual BaseTypes T0": 4, "Ritual BaseTypes T1": 5,
    "Stygian Vise T0": 3, "Stygian Vise T1": 5,
    "Talismans T0": 3, "Talismans T1": 4, "Talismans T2": 5,
    "Tier 0 Trinkets": 2, "Tier 1 Trinkets": 3, "Tier 2 Trinkets": 4,
    "Tier 3 Trinkets": 5, "Tier 4 Trinkets": 5,
    "Heist Experimented T0": 3, "Heist Experimented T1": 4, "Heist Experimented T2": 5,
    "Chancing Normal": 5,

    # --- sockets: in Ruthless a 6-link IS a chase drop (the author's own reply 06) ------
    "6-Link": 1, "6-Socket": 3, "RGB Linked": 5,

    # --- flasks --------------------------------------------------------------------------
    # ★ the T2 flasks are labelled 顶级生命/魔力药剂 — a flask you actually use is not floor
    "Tier 1 Life Flasks": 3, "Tier i82 Life Flasks": 4,
    "Tier 2 Life Flasks": 4, "Tier Hybrid Flasks": 5,
    "Tier 1 Mana Flasks": 3, "Tier i82 Mana Flasks": 4, "Tier 2 Mana Flasks": 4,
    "Tier 0 Tinctures": 3, "Tier 1 Tinctures": 4,
    "Tier 0 Utility Flasks": 2, "Tier 1 Utility Flasks": 3, "Tier 2 Utility Flasks": 4,

    # --- heist ---------------------------------------------------------------------------
    # a blueprint or contract is runnable content, not noise
    "CustomTier 1 Heist Blueprints": 3, "Heist Blueprint T1": 4,
    "Heist Contract T0": 3, "Heist Contract T1": 4,
    "Heist Gear T1": 4, "Heist Gear T2": 5, "Heist Target": 3,

    # --- jewels: a 12-passive large cluster is a genuine chase --------------------------
    "Tier 0 Cluster Jewels": 1, "Tier 1 Cluster Jewels": 2, "Tier 2 Cluster Jewels": 3,
    "Tier 3 Cluster Jewels": 4, "Tier 4 Cluster Jewels": 4,
    "Tier 5 Cluster Jewels": 5, "Tier 6 Cluster Jewels": 5,
    "Tier 0 Abyss Jewels": 2, "Tier 1 Abyss Jewels": 3, "Tier 2 Abyss Jewels": 4,
    "Base Jewels": 4,

    # --- fragments: a clean five-step, no merge. `Tier 0` is the UBER boss set (Awakening,
    # Blazing, Cosmic, Devouring, Reality...) and `Tier 1` is the Sirus/Maven tier (Audience,
    # Maven's Writ, the invitations) — genuinely a rung apart, so collapsing them would throw
    # away the most valuable distinction in the category.
    "Tier 0 Fragments": 1, "Tier 1 Fragments": 2, "Tier 2 Fragments": 3,
    "Tier 3 Fragments": 3, "Tier 4 Fragments": 4,
    # `Tier 1 Splinters` is literally labelled 值得停下 — "worth stopping for" — and was on
    # the scroll rung; one splinter still beats a Scroll of Wisdom, so T2 leaves the floor.
    "Tier 0 Splinters": 3, "Tier 1 Splinters": 3, "Tier 2 Splinters": 4,

    # --- misc / quest --------------------------------------------------------------------
    "Misc": 3, "Legacy": 5,

    # --- uniques: the chase family, and 175 96 37 is pinned ------------------------------
    # `Other` is the unique net: in Ruthless a unique is always worth one look, so it does
    # not belong on the scroll rung.
    "T0 Chase": 0, "T1": 1, "T2": 2, "T3": 3, "Other": 3,

    # --- ★ 2026-08-09: bottoms of league ladders that trade above a scroll ----------------
    # These were never in the table — they kept the designer patch's rung, which put them on
    # R4 (scroll level). Each is a real, priced item; the author reported the oils one from
    # play before the anchor error was traced.
    "Tier 3 Oils": 3, "Tier 3 Essences": 3, "Tier 4 Scarabs": 3, "Tier 4 Tainted": 3,
}


def main():
    T = json.load(io.open(THEME, encoding="utf-8"),
                  object_pairs_hook=collections.OrderedDict)
    moves, collisions, created, missing = [], [], [], []
    files = {}

    for dp, _d, fs in os.walk(TD):
        for fn in sorted(fs):
            if not fn.endswith(".json"):
                continue
            path = os.path.join(dp, fn)
            d = json.load(io.open(path, encoding="utf-8"),
                          object_pairs_hook=collections.OrderedDict)
            dirty = False
            for cat, body in d.items():
                if not isinstance(body, dict):
                    continue
                tcat = (body.get("_meta") or {}).get("theme_category")
                # per-category record of which rungs are now claimed, to catch two tiers
                # landing on one rung with different looks
                landed = {}
                for tier, node in body.items():
                    if tier == "_meta" or not isinstance(node, dict):
                        continue
                    if node.get("is_hide_tier") or tier not in RETIER:
                        continue
                    th = node.get("theme")
                    if not isinstance(th, dict):
                        continue
                    old, new = th.get("Tier"), RETIER[tier]
                    rows = T.get(tcat) or {}
                    oldrow, newrow = "Tier %s" % old, "Tier %s" % new
                    if old != new:
                        # ⚠️ carry the look across, or the tier lands on a row that may not
                        # exist and emits bare 32px.
                        if newrow not in rows and oldrow in rows:
                            T.setdefault(tcat, collections.OrderedDict())[newrow] = \
                                json.loads(json.dumps(rows[oldrow]))
                            created.append((tcat, oldrow, newrow))
                        elif newrow not in rows:
                            missing.append((tcat, tier, newrow))
                        th["Tier"] = new
                        dirty = True
                    moves.append((tcat, tier, old, new,
                                  (node.get("localization") or {}).get("ch", "")))
                    if new in landed and landed[new] != oldrow:
                        collisions.append((tcat, landed[new], tier, new))
                    landed[new] = oldrow
            if dirty:
                files[path] = d

    print("=== re-tier :: %d tiers considered ===" % len(moves))
    ch = [m for m in moves if m[2] != m[3]]
    print("  rungs changed        : %d" % len(ch))
    print("  theme rows created   : %d  (look carried across, so nothing restyles)"
          % len(created))
    print("  ★ rung collisions    : %d" % len(collisions))
    print("  ⚠️ no row to carry    : %d" % len(missing))
    print()
    print("%-26s %-28s %-14s %s" % ("category", "tier", "rung", "now equates to"))
    print("-" * 96)
    for tcat, tier, old, new, loc in moves:
        mark = "  " if old == new else "->"
        print("%-26s %-28s %s%s %-3s  %-22s %s"
              % (str(tcat)[:26], tier[:28], old, mark, new, ANCHOR[new][:22], loc[:20]))
    if collisions:
        print()
        print("★ two tiers landing on one rung with different looks — one will win:")
        for tcat, a, b, r in collisions:
            print("   %-24s rung %s  <- %s AND %s" % (tcat, r, a, b))
    if missing:
        print()
        print("⚠️ moved to a rung with no row and no row to copy — WOULD EMIT BARE 32px:")
        for tcat, tier, row in missing:
            print("   %-24s %-26s %s" % (tcat, tier, row))

    if APPLY:
        for path, d in files.items():
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        io.open(THEME, "w", encoding="utf-8").write(
            json.dumps(T, ensure_ascii=False, indent=2) + "\n")
        print()
        print("written: %d tier files + the theme" % len(files))
    else:
        print()
        print("(review only -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
