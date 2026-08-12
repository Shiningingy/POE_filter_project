# -*- coding: utf-8 -*-
"""Copy FilterBlade's palette onto our categories. Author's call, 2026-08-07.

    python parsing_tool/theme/apply_filterblade_palette.py           # dry run
    python parsing_tool/theme/apply_filterblade_palette.py --apply   # write

★ WHY COPY RATHER THAN DESIGN. The author's words: "given the unclear direction and urgent
fixing, I would like call the copy instead of propose ourself." Two proposals had already
failed the only test that counts — looking at it — and every value below is MEASURED out of
`data/from_filter_blade/3.29/FilterBlade_0_Soft.filter`, not chosen. Nothing here is taste.

--------------------------------------------------------------------------------
WHAT THE MEASUREMENT SAID, AND WHY OUR THEME COULD NOT BE TUNED INTO IT

Text luminance median: theirs 0.660, ours 0.213. Plate luminance median: theirs 0.051, ours
0.159. They hold the two 0.61 apart; we held them 0.05 apart. Of their 529 styled blocks,
TWO put text and plate both in the middle band. The rule is not a palette:

    ONE OF TEXT AND PLATE MUST BE EXTREME. NEVER BOTH IN THE MIDDLE.

Our `rung_recipes.T4 = accent.muted on 80 80 80` broke it by construction — median 3.02:1
across the 26 accents, 12 of them under 3.0:1 — which is why raising contrast to 4.5:1 did
not help. A less grey grey is still grey.

--------------------------------------------------------------------------------
AND WHY 25 ACCENTS COLLAPSE TO 11

Measured on their side: a (text, plate) PAIR encodes the item's ROLE and is reused wherever
that role occurs. `0 240 190 on 20 20 0` covers 22 different categories; `255 0 255 on
100 0 100` covers 21 and its tier is literally named `anyremaining`. 60% of their pairs are
shared across categories. Ours were 41% private.

⚠️ THE EVIDENCE CONTRADICTED THE BRIEF ON ONE POINT, AND IT IS RECORDED RATHER THAN QUIETLY
FOLLOWED. The author named fossil and essence as families that should keep a private hue.
FilterBlade gives them NONE — essence, fossil, oil, delirium, harvest, breach, ritual and
expedition all wear the shared currency ladder (`0 0 0` on `249 150 25` / `213 159 0` /
`240 90 35`). The essence blue in our data came from SHARKET, not FilterBlade. Kept here as
the author's stated exception, flagged so the choice stays visible.

--------------------------------------------------------------------------------
SCOPE

  T0 / T1   UNTOUCHED. House identity — red-on-white and the red plate, seen in game and
            accepted twice. Not part of the complaint, which was explicitly "beyond T2".
  Maps      UNTOUCHED. The author hand-picked the 16 MapTier band plates last session and
            a generator that consumed its source already destroyed them once.
  equipment UNTOUCHED text. Its 13 categories are rarity_through: they omit TextColor so the
            game paints rarity. Their half of the complaint was size, already fixed.
  sizes     UNTOUCHED. Already floored at 40 (scrolls and gold 35) in a previous pass.
"""
import io, json, os, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket",
                     "sharket_theme.json")
MAPFILE = os.path.join(ROOT, "docs", "design", "handoff", "accent-category-map.json")
APPLY = "--apply" in sys.argv

# ★ SHARKET FIRST, FILTERBLADE TO FILL THE GAPS — the author's ordering, and the right one:
# this is a Sharket-derived CN filter and its players already read Sharket's vocabulary.
# Sharket's own filter annotates every colour with its theme name (`SetTextColor 0 0 0
# # T4通货`), so its palette is extracted BY NAME rather than inferred. 74 named entries.
#
# Its low rungs already are the idiom we needed, and have been all along:
#     T5通货      170 158 130 on 0 0 0     7.92:1
#     T3命运卡     14 186 255  on 0 0 0     9.49:1
#     T1~T5蓝地图  136 136 255 on 0 0 0     7.01:1
#     T1~T5白地图  200 200 200 on 0 0 0    12.55:1
# FAMILY COLOUR ON PURE BLACK. Our `accent.muted on 80 80 80` was a corruption of exactly
# this — same idea with both values dragged into the middle.
DARK = "0 0 0"            # Sharket's low-rung plate

# ★★ THE FAMILY COLOUR SURVIVES EVERY RUNG. NO NEUTRAL GREY RUNG EXISTS.
#
# The first version of this ladder ended `200 200 200` then `140 140 140` on black, on the
# reasoning that a bottom rung is "bulk". The author rejected it on the right grounds:
#
#   "support gems are not good ... they tiered low in their category doesn't mean they are
#    invaluable. neither sharket/filterblade apply this theme to supportgem/essence right?"
#
# Correct, and Sharket settles it. It has FOUR gem tiers and the cyan `27 162 155` is in
# every one of them:
#     T1技能宝石   27 162 155  on 255 255 255      family colour as text
#     T2技能宝石   255 0 0     on 27 162 155       family colour as plate
#     T3技能宝石   0 0 0       on 27 162 155       family colour as plate
#     T4技能宝石   27 162 155  on 27 51 52         family colour as text, dark TINTED plate
# and its lowest currency rung is `170 158 130 on 0 0 0` — the tan, not a grey.
#
# ⚠️ `200 200 200` DOES appear in Sharket, and reading it as a bulk marker is what caused
# this: it is the WHITE MAP colour (白地图), a family colour in its own right. Sharket has
# no neutral rung at all. Rank at the bottom is carried by the PLATE (dark tint -> black)
# and by size, never by draining the hue out of the label.

# ---------------------------------------------------------------------------
# THE LADDER. Every pair below appears verbatim in their soft filter; the count
# is how many of their blocks wear it, so a value with a high count is one of
# their load-bearing looks rather than an incidental one.
#
#   T2  black-or-white on the family's BRIGHT plate   "worth picking up"
#   T3  the family colour on the family's DARK TINT   "a good one of these"
#   T4  the family colour on PURE BLACK               "one of these"
#   T5  the same at 80% opacity                       "bulk"
LADDER = {
    #  family        T2 bright plate  T3/T4 family text    source
    # --- SHARKET, by its own theme name -------------------------------------
    "currency":    ("255 165 0",     "170 158 130"),  # T3通货 10.63:1 / T5通货 7.92:1
    "uniques":     ("175 96 37",     "175 96 37"),    # T2传奇② 4.52 / T3传奇 — already ours
    "gems":        ("27 162 155",    "27 162 155"),   # T3技能宝石 6.69:1
    "div_cards":   ("14 186 255",    "14 186 255"),   # T2命运卡 9.49 / T3命运卡 9.49
    "quest":       ("74 230 58",     "74 230 58"),    # 任务物品 — PoE's own quest green
    "flasks":      ("184 218 242",   "184 218 242"),  # T2词缀装, Sharket's flask blue
    "essences":    ("60 130 255",    "130 180 255"),  # kit: "unchanged from Sharket"
    "fossils":     ("210 178 135",   "200 165 110"),
    # --- FILTERBLADE, where Sharket has no usable entry ----------------------
    # ⚠️ Sharket HAS fragments (T1-T3地图碎片) and they are its weakest rows —
    # 2.39:1, 2.08:1, 4.82:1, and the 80 80 80 plate we inherited the bug from.
    # Covered but not good, so this is a fill, not a gap.
    "fragments":   ("180 0 255",     "180 0 255"),    # FB x3 black-on-purple 4.38:1
    # ★ SCARABS KEEP THEIR OWN GREEN (author, 2026-08-07: "also found on scarab").
    # Folding them into fragments was wrong on the author's own rule — hues go to
    # CATEGORIES, not league mechanics, and scarabs are core atlas content with a real
    # four-step value ladder of their own. Sharket 3.15 predates the scarab rework so it
    # has no entry, and its 地图碎片 rows are its weakest anywhere (2.39:1, 2.08:1, and the
    # 80 80 80 plate this whole bug came from) — so the green comes from the kit's own
    # `scarabs` accent, itself recorded as "Sharket's scarab green, near the atlas family
    # without joining it". Black on it is 4.34:1, so T2 takes white automatically.
    "scarabs":     ("0 130 90",      "0 130 90"),
    # ★ OILS KEEP THEIR OWN YELLOW (author, 2026-08-07: "low tier oils are still somehow
    # low visibility"). Their contrast was fine — 7.00:1 and 7.92:1 — so this was never a
    # legibility fault; it was SATURATION. The currency tan (184 174 151 / 170 158 130) is
    # a desaturated beige and reads quiet on a busy screen, and oils are colour-coded in
    # game, so draining them to beige throws away a signal the game already gives.
    # ⚠️ Folding oils into currency also undid a separation the kit made deliberately:
    # blight_oils is "held clear of currency orange so a Golden Oil is never a Divine" —
    # and the merged Oils T1 was emitting 0 0 0 on 255 165 0, the currency orange, which is
    # exactly that collision. Sharket 3.15 predates Blight and has no oil rows, so this is
    # the kit's own authored value rather than a fill.
    "blight_oils": ("255 230 80",    "255 230 80"),
    "jewels":      ("150 0 255",     "150 0 255"),    # FB x8 / x9
    "heist":       ("245 190 0",     "245 190 0"),    # FB x4 on 20 20 0, 10.84:1
    "gold":        ("235 200 110",   "235 200 110"),  # FB x1 on 20 20 0, 11.52:1
}

# Our 25 accents -> the 11 families above. This IS the collapse: eleven league
# mechanics that are, to a player, "currency you pick up" stop having eleven hues.
COLLAPSE = {
    "currency": "currency", "allflame": "currency", "corpses": "currency",
    "harvest": "currency", "delirium": "currency", "tainted": "currency",
    "breach": "currency", "ritual": "currency", "expedition": "currency",
    "blight_oils": "blight_oils", "wombgifts": "currency", "recipes": "currency",
    "vendor": "currency",
    "essences": "essences", "fossils": "fossils",
    "fragments": "fragments", "scarabs": "scarabs",
    "div_cards": "div_cards", "uniques": "uniques", "gems": "gems",
    "jewels": "jewels", "heist": "heist", "quest": "quest",
    "flasks": "flasks", "gold": "gold",
}

# ⚠️ SHARKET'S LOW-RUNG TEXTS ARE ALL LIGHT TINTS — `170 158 130`, `136 136 255`,
# `14 186 255`, `200 200 200`, `255 255 119`. Not one is a dark colour, because a dark
# colour on a black plate is the same failure as a mid colour on a mid plate. So a family
# whose hue is dark (Jewels' `150 0 255` reaches only 3.74:1 on black) gets that hue
# BRIGHTENED with the hue pinned, rather than a different colour.
T3_TARGET = 7.0

# The exception: a pairing the author already fixed in game. Uniques' `175 96 37` is the
# family hue every other unique rung is keyed to — "lift the plate, never the text" — and
# Sharket ships exactly this pair at 4.01:1 (T3传奇). Taken verbatim, not brightened.
PINNED = {"uniques": ("175 96 37", "30 15 8")}

SKIP_ACCENT = {"equipment"}          # rarity_through: never write a TextColor
# ⚠️ GOLD IS TEXT-ONLY AND ITS THREE TIERS SHARE ONE RUNG. The kit is explicit — "it never
# emits SetBackgroundColor at ANY rung", because gold is auto-collected and its label is a
# readout rather than a call to action. On top of that all three of its tiers carry
# `theme.Tier 5`, so a rung-keyed rewrite would give 大量/较多/金币 one identical look AND
# hand them a plate. Gold was only ever a SIZE complaint (35px, T1 40px), already fixed.
SKIP_CATEGORY = {"Maps", "Gold"}     # hand-picked MapTier bands; gold's no-plate rule
SKIP_RUNG = {"Tier 0", "Tier 1"}     # house identity


def lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def con(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def rgb(s):
    return tuple(int(x) for x in s.split())[:3]


def hx(s, alpha="ff"):
    return "#" + "".join("%02x" % v for v in rgb(s)) + alpha


def lighten(colour, plate, target=T3_TARGET):
    """Raise a family hue's lightness until it clears `target` on the plate, HUE AND
    SATURATION PINNED — so it is still recognisably that family, just at the brightness
    Sharket's own low-rung texts already sit at."""
    import colorsys
    c = rgb(colour)
    if con(c, rgb(plate)) >= target:
        return colour
    h, l, s = colorsys.rgb_to_hls(*[v / 255.0 for v in c])
    for i in range(1, 261):
        nl = l + (1.0 - l) * (i / 260.0)
        cand = tuple(int(round(v * 255)) for v in colorsys.hls_to_rgb(h, min(1.0, nl), s))
        if con(cand, rgb(plate)) >= target:
            return "%d %d %d" % cand
    return "255 255 255"


def deepen(colour):
    """The family's own near-black — Sharket's `27 51 52` under its `27 162 155` gems.
    Hue and saturation pinned, lightness dropped to ~11%, so the plate still belongs to the
    family instead of being a neutral black."""
    import colorsys
    h, l, s = colorsys.rgb_to_hls(*[v / 255.0 for v in rgb(colour)])
    c = colorsys.hls_to_rgb(h, 0.11, min(1.0, s * 0.75))
    return "%d %d %d" % tuple(int(round(v * 255)) for v in c)


def rungs_for(fam):
    """Four rungs, all Sharket idioms, and the FAMILY COLOUR IS IN EVERY ONE:

        T2  black-or-white on the family's BRIGHT plate   "worth picking up"
        T3  the family colour on the family's DARK TINT   "a good one of these"
        T4  the family colour on PURE BLACK               "one of these"
        T5  the same, at 80% opacity                      "bulk"

    The PLATE descends (bright -> family near-black -> pure black) and size carries the
    rest. The hue never drains out, because a low tier inside a category is not a low-value
    item — a T4 support gem is still a support gem."""
    bright, accent = LADDER[fam]
    # T2's text is black-or-white BY PLATE LUMINANCE — Sharket's own rule, and both
    # references carry each pairing (`0 0 0 on 175 96 37` and `255 255 255 on 175 96 37`
    # are both FilterBlade blocks). Black is preferred and only yields when it drops under
    # 4.5:1, which keeps the author's hand-tuned Uniques T2 (4.52:1 on black) exactly as
    # shipped while rescuing the genuinely dark plates: Jewels 3.74 -> 5.61, Fragments
    # 4.38 -> 4.79. Choosing "whichever is higher" instead would have flipped Uniques for
    # a 0.12 gain and overwritten work that was already accepted in game.
    t2 = "0 0 0" if con((0, 0, 0), rgb(bright)) >= 4.5 else "255 255 255"
    tint = deepen(bright)
    if fam in PINNED:
        t3_txt, t3_bg = PINNED[fam]
    else:
        t3_txt, t3_bg = lighten(accent, tint), tint
    low = lighten(accent, DARK)
    return {
        "Tier 2": (hx(t2), hx(bright, "f0"), con(rgb(t2), rgb(bright))),
        "Tier 3": (hx(t3_txt), hx(t3_bg, "f0"), con(rgb(t3_txt), rgb(t3_bg))),
        "Tier 4": (hx(low), hx(DARK, "f0"), con(rgb(low), rgb(DARK))),
        "Tier 5": (hx(low, "cc"), hx(DARK, "f0"), con(rgb(low), rgb(DARK))),
    }


# ⚠️ WITHOUT THIS THE PALETTE NEVER REACHES THE SCREEN. An inline `theme` block on a tier
# BEATS the theme row, and 42 tiers across 15 files carry one. Proof from the first run:
# after rewriting every currency row, `General -T5:点金石级` still emitted
# `0 0 0 on 255 170 0` — the inline value — and 19 General blocks stayed in the thin band.
# This is the author's "the thing I see is not the thing the designer ships", exactly.
#
# Only the two COLOUR keys are removed. FontSize, Tier, icons, beams and sounds are left
# alone, so nothing but the palette moves.
# ★ CURRENCY GETS ITS LADDER WRITTEN PER TIER, NOT PER RUNG.
#
# The theme is keyed by rung and there are six of them, but `Currency/General.json` has
# NINE tiers. Left to the rung, T3 (Exalt level) and T4 (Chaos level) both land on rung
# Tier 2 and become one look — and so do T5/T6 and T7/T8. That is a real loss in the most
# used category in the filter, so its steps are written directly onto the tiers.
#
# The ladder is Sharket's own, in its own order, by its own names:
#     超级通货   255 0 0     on 255 255 255    4.00:1
#     高级通货   255 255 255 on 255 0 0        4.00:1
#     T3通货    0 0 0       on 255 165 0     10.63:1
#     T4通货    0 0 0       on 170 158 130    7.92:1
#     T5通货    170 158 130 on 0 0 0          7.92:1
# with one added bottom step (140 140 140 on black, 6.6:1) so the ninth tier still descends.
#
# ⚠️ Tier 8 (scrolls) is ABSENT from this table on purpose — it carries `disabled:`
# sentinels so it emits no colour lines at all, and the author asked for scrolls to stay
# quiet at 35px.
CURRENCY_LADDER = {
    "Tier 0 General": ("255 0 0", "255 255 255"),        # 超级通货
    "Tier 1 General": ("255 0 0", "255 255 255"),        # 超级通货
    "Tier 2 General": ("255 255 255", "255 0 0"),        # 高级通货
    "Tier 3 General": ("255 255 255", "255 0 0"),        # 高级通货
    "Tier 4 General": ("0 0 0", "255 165 0"),            # T3通货
    "Tier 5 General": ("0 0 0", "255 165 0"),            # T3通货
    "Tier 6 General": ("0 0 0", "170 158 130"),          # T4通货
    "Tier 7 General": ("170 158 130", "0 0 0"),          # T5通货
}

STRIP_EXEMPT_FILES = {
    "Maps/Base Maps.json",        # hand-picked MapTier bands; a rebuild destroyed them once
    "Uniques/General.json",       # the author's ladder, accepted in game, already Sharket's
    "Currency/Gold.json",         # text-only by rule; see SKIP_CATEGORY
    "Currency/General.json",      # written per tier by CURRENCY_LADDER instead
}


def write_currency_ladder():
    """Write Sharket's currency steps straight onto the tiers, so nine tiers keep nine
    positions instead of folding into the six the rung grid can express."""
    path = os.path.join(ROOT, "filter_generation", "data", "tier_definition",
                        "Currency", "General.json")
    d = json.load(io.open(path, encoding="utf-8"))
    out = []
    for cat, body in d.items():
        if not isinstance(body, dict):
            continue
        for tier, spec in CURRENCY_LADDER.items():
            node = body.get(tier)
            if not isinstance(node, dict):
                continue
            th = node.setdefault("theme", {})
            t, b = spec
            was = (th.get("TextColor"), th.get("BackgroundColor"))
            th["TextColor"], th["BackgroundColor"] = hx(t), hx(b, "f0")
            out.append((tier, was, th["TextColor"], th["BackgroundColor"],
                        con(rgb(t), rgb(b))))
    if APPLY:
        io.open(path, "w", encoding="utf-8").write(
            json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    return out


def strip_inline(T):
    """Remove inline TextColor/BackgroundColor so the rewritten rows govern.

    ⚠️ TWO VALUES MUST SURVIVE, and both were caught by reading the dry run:

    1. A `disabled:` value is an OMIT-SENTINEL, not a colour. `Tier 8 General`
       (the scrolls) carries `disabled:#ffffffff` so the block emits no TextColor line at
       all. Deleting it does not restore a default — it hands the rung to the theme row and
       PAINTS the scrolls, which is the opposite of what the author asked for.

    2. Only rungs this script actually rewrote may be stripped. T0/T1 rows were left as
       house identity on purpose, so an inline T0 removed here would fall through to a row
       that may not even exist, and the block would emit no colour at all."""
    TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
    hits, kept = [], []
    for dp, _dirs, fs in os.walk(TD):
        for fn in sorted(fs):
            if not fn.endswith(".json"):
                continue
            path = os.path.join(dp, fn)
            rel = os.path.relpath(path, TD).replace(os.sep, "/")
            if rel in STRIP_EXEMPT_FILES:
                continue
            d = json.load(io.open(path, encoding="utf-8"))
            dirty = False
            for cat, body in d.items():
                if not isinstance(body, dict):
                    continue
                tcat = (body.get("_meta") or {}).get("theme_category")
                if tcat in SKIP_CATEGORY:
                    continue
                rows = T.get(tcat) or {}
                for tier, node in body.items():
                    if tier == "_meta" or not isinstance(node, dict):
                        continue
                    th = node.get("theme")
                    if not isinstance(th, dict):
                        continue
                    rung = "Tier %s" % th.get("Tier")
                    if th.get("Tier") not in (2, 3, 4, 5) or rung not in rows:
                        kept.append((rel, tier, "rung %s not rewritten" % rung))
                        continue
                    for key in ("TextColor", "BackgroundColor"):
                        if key not in th:
                            continue
                        val = th[key]
                        if isinstance(val, str) and val.startswith("disabled:"):
                            kept.append((rel, tier, "%s is an omit-sentinel" % key))
                            continue
                        hits.append((rel, tier, key, th.pop(key)))
                        dirty = True
            if dirty and APPLY:
                io.open(path, "w", encoding="utf-8").write(
                    json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    return hits, kept


def main():
    T = json.load(io.open(THEME, encoding="utf-8"))
    M = json.load(io.open(MAPFILE, encoding="utf-8"))
    by_cat = {k: v for k, v in M["accent_by_category"].items() if not k.startswith("_")}

    changed, skipped, worst = [], [], (99.0, "")
    for cat in sorted(T):
        rows = T[cat]
        if not isinstance(rows, dict):
            continue
        accent = by_cat.get(cat)
        if cat in SKIP_CATEGORY or accent in SKIP_ACCENT or accent is None:
            skipped.append((cat, accent or "?",
                            "hand-tuned bands" if cat in SKIP_CATEGORY else
                            "rarity_through" if accent in SKIP_ACCENT else "no accent"))
            continue
        fam = COLLAPSE.get(accent)
        if not fam:
            skipped.append((cat, accent, "unmapped accent"))
            continue
        spec = rungs_for(fam)
        for rung, row in rows.items():
            if rung in SKIP_RUNG or rung not in spec or not isinstance(row, dict):
                continue
            t, b, ratio = spec[rung]
            was_t, was_b = row.get("TextColor"), row.get("BackgroundColor")
            # ⚠️ A rarity-painted row has NO TextColor on purpose. Only 441-of-998 such rows
            # exist filter-wide, but writing one would paint over the rarity colour, so a
            # row that omits text keeps omitting it and takes the plate only.
            if was_t is not None:
                row["TextColor"] = t
            row["BackgroundColor"] = b
            changed.append((cat, accent, fam, rung, was_t, was_b, t, b, ratio,
                            was_t is None))
            if ratio < worst[0]:
                worst = (ratio, "%s %s" % (cat, rung))

    fams = {}
    for c in changed:
        fams.setdefault(c[2], set()).add(c[0])
    print("=== copy FilterBlade palette ===")
    print("  categories restyled : %d" % len({c[0] for c in changed}))
    print("  rows rewritten      : %d" % len(changed))
    print("  accents collapsed   : %d -> %d families"
          % (len({c[1] for c in changed}), len(fams)))
    print("  ★ worst contrast anywhere : %.2f:1  (%s)" % worst)
    print()
    print("--- the collapse ---")
    for fam in sorted(fams):
        bright, accent = LADDER[fam]
        print("  %-11s <- %-2d categories   T2 bg %-13s  T3 text %s"
              % (fam, len(fams[fam]), bright, accent))
        print("      %s" % ", ".join(sorted(fams[fam])))
    print()
    print("--- untouched ---")
    for cat, accent, why in skipped:
        print("  %-26s %-11s %s" % (cat[:26], accent[:11], why))
    print()
    print("--- every rewritten row ---")
    for cat, accent, fam, rung, wt, wb, t, b, ratio, keptnull in sorted(changed):
        print("  %-24s %-8s %-7s %s on %s -> %s on %s  %5.2f:1%s"
              % (cat[:24], rung, fam, (wt or "(rarity)")[:7], (wb or "-")[:9],
                 t[:7], b[:9], ratio, "   [text left absent]" if keptnull else ""))

    # ⚠️ THE GENERAL FORM OF THE GOLD BUG. The theme is keyed by RUNG, but several tiers in a
    # category can carry the same `theme.Tier`. Strip their inline colours and they collapse
    # into one identical look — three gold tiers, one grey. Distinct tiers usually exist
    # because the author wanted them told apart, so this is reported rather than assumed
    # harmless.
    TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
    collisions = []
    for dp, _dirs, fs in os.walk(TD):
        for fn in sorted(fs):
            if not fn.endswith(".json"):
                continue
            rel = os.path.relpath(os.path.join(dp, fn), TD).replace(os.sep, "/")
            d = json.load(io.open(os.path.join(dp, fn), encoding="utf-8"))
            for cat, body in d.items():
                if not isinstance(body, dict):
                    continue
                tcat = (body.get("_meta") or {}).get("theme_category")
                if tcat in SKIP_CATEGORY or by_cat.get(tcat) in SKIP_ACCENT:
                    continue
                seen = {}
                for tier, node in body.items():
                    if tier == "_meta" or not isinstance(node, dict) \
                            or node.get("is_hide_tier"):
                        continue
                    n = (node.get("theme") or {}).get("Tier")
                    if n in (2, 3, 4, 5):
                        seen.setdefault(n, []).append(tier)
                for n, tiers in seen.items():
                    if len(tiers) > 1:
                        collisions.append((rel, n, tiers))

    cur_rows = write_currency_ladder()
    print()
    print("--- currency: Sharket's ladder written per tier (%d) ---" % len(cur_rows))
    for tier, was, t, b, ratio in cur_rows:
        print("  %-18s %s on %s -> %s on %s   %5.2f:1"
              % (tier, (was[0] or "-")[:9], (was[1] or "-")[:9], t, b, ratio))

    stripped, kept = strip_inline(T)
    if collisions:
        print()
        print("--- ⚠️ tiers sharing one rung: these now look IDENTICAL ---")
        for rel, n, tiers in collisions:
            print("  %-38s Tier %d  <- %s" % (rel[:38], n, ", ".join(tiers)))
    print()
    print("--- inline colours removed so the rows can govern (%d) ---" % len(stripped))
    for rel, tier, key, val in stripped:
        print("  %-38s %-24s %-16s was %s" % (rel[:38], tier[:24], key, val))
    print()
    print("--- inline colours DELIBERATELY kept (%d) ---" % len(kept))
    for rel, tier, why in kept:
        print("  %-38s %-24s %s" % (rel[:38], tier[:24], why))
    print("  exempt files: %s" % ", ".join(sorted(STRIP_EXEMPT_FILES)))

    if APPLY:
        io.open(THEME, "w", encoding="utf-8").write(
            json.dumps(T, ensure_ascii=False, indent=2) + "\n")
        print()
        print("wrote %s" % os.path.relpath(THEME, ROOT))
    else:
        print()
        print("(dry run -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
