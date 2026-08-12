# -*- coding: utf-8 -*-
"""Raise the shipping theme off the floor: a size floor, and a contrast floor.

    python parsing_tool/theme/fix_visual_floor.py            # dry run, prints every change
    python parsing_tool/theme/fix_visual_floor.py --apply    # write sharket_theme.json

★ WHY THIS EDITS THE SHIPPING FILE AND NOT THE RECIPE. `compile_theme.py` deliberately never
writes `sharket_theme.json` — it writes a side file, because the shipping theme is hand-tuned
and a recompile would change every colour at once. So a fix that has to land TODAY lands here,
surgically, and the recipe change is recorded for the rework instead.

⚠️ IT TOUCHES TWO CHANNELS ONLY: `FontSize` and `TextColor`. Not the plate, not the border,
not the icon, not the beam. That is the whole reason it is safe to run over a hand-tuned file
-- the author's plate choices, beams and icons survive untouched, and a colour it does change
is one that measurably could not be read.

--------------------------------------------------------------------------------
THE SIZE FLOOR (author, 2026-08-07: "at least font size 40 for all items except the
scrolls and gold, they should be 35, gold t1 40 ofc")

Backed by measurement rather than taste. Across all seven FilterBlade strictness files the
font size barely moves -- median 45 at every level, and fewer than 20 blocks below 40 in any
of them -- while the block COUNT falls 692 -> 309. Their conclusion, which ours contradicted:

    STRICTNESS REMOVES ITEMS. IT DOES NOT SHRINK THEM.
    Anything shown at all is shown at a size you can read.

Our ladder spent 30-45px encoding VALUE, so at soft strictness (where nothing hides) 173 of
429 blocks were under 40px. That is the "too small" half of the complaint, and it is
structural, not a set of bad rows.

--------------------------------------------------------------------------------
THE CONTRAST FLOOR

The "too dim beyond T2" half has a single cause, and it is one house-fixed recipe:

    rung_recipes.T4 = { text: accent.muted, bg: 80 80 80 }

`accent.muted` is a mid-luminance desaturation of the accent, and 80 80 80 is a mid-luminance
grey, so the pair converges BY CONSTRUCTION. Measured over all 26 accents: median 3.02:1, and
**12 of 26 fall under 3.0:1**. It is not a tuning miss on a few categories; the recipe cannot
succeed. Same story one rung down, where T5 puts a darkened muted on 48 48 48.

⚠️ THE FIX LIFTS THE TEXT, NEVER THE PLATE. The kit's `_text_brightness_ladder` requires plate
luminance to descend strictly across T2 -> T3 -> T4 -> T5; that ladder is what makes rank
readable at a glance, and repainting a plate to win contrast would break the rank ordering to
fix the legibility. Lightening the text costs nothing structurally -- the plate keeps its
place in the ladder and the family hue survives, because the lift happens in HSL with the HUE
PINNED and only lightness moving.

⚠️ AND IT NEVER TOUCHES AN ABSENT `TextColor`. 441 of 998 rows omit it so the game paints
rarity (see reference_poe_filter_format). Writing a colour into those rows would paint over
the rarity signal -- the single most expensive mistake available in this file.
"""
import io, json, os, sys, colorsys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json")
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")

APPLY = "--apply" in sys.argv
SIZE_FLOOR = 40
TARGET = 4.5          # WCAG AA for large text; every rung here is >= 30px, i.e. large.

# ★ IDENTITY COLOURS ARE NEVER MOVED, AT ANY CONTRAST.
#
# An accent's authored `solid` (and its `t0_text`) is the thing a player learns the family
# by, and other rungs are built to sit against exactly that value. The author's ruling on
# Uniques, made in game and recorded in docs/pending-features.md §6d, is the general case:
#
#     "lift the PLATE, never the text, because 175 96 37 is the family hue and all four
#      other rungs depend on it being exactly that."
#
# Without this guard the sweep 'fixed' Uniques T1/T3 from #af6025 to #c36b29 — a 0.6:1 gain
# bought by desynchronising the one hue the whole ladder is keyed to. Same for the house
# red #ff0000 and Skill Gems' #1ba29b. A pairing that fails while wearing an identity
# colour is a PLATE problem, and the plate is not this script's to touch.
def _identity_rgbs():
    kit = os.path.join(ROOT, "docs", "design", "handoff", "theme-presets.json")
    out = set()
    try:
        P = json.load(io.open(kit, encoding="utf-8"))
    except Exception:
        return out
    for name, a in (P.get("accents") or {}).items():
        if not isinstance(a, dict):
            continue
        for key in ("solid", "t0_text"):
            v = a.get(key)
            if isinstance(v, str):
                try:
                    out.add(tuple(int(x) for x in v.split())[:3])
                except ValueError:
                    pass
    return out


IDENTITY = _identity_rgbs()


# ---------------------------------------------------------------- colour helpers
def unhex(s):
    """'#505050e6' -> ((80,80,80), 'e6').  Returns None for a non-hex value."""
    if not isinstance(s, str) or not s.startswith("#"):
        return None
    h = s[1:]
    if len(h) not in (6, 8):
        return None
    try:
        return ((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)), h[6:] or "")
    except ValueError:
        return None


def rehex(rgb, alpha):
    return "#" + "".join("%02x" % max(0, min(255, int(round(c)))) for c in rgb) + alpha


def lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def lift(text, plate, target=TARGET):
    """Move the text's LIGHTNESS until it clears `target` against `plate`. Hue and
    saturation are pinned, so the family colour is still the family colour.

    Direction is chosen from the plate: a dark plate wants brighter text, a light plate
    wants darker. Choosing by plate rather than by 'always brighter' is what keeps this
    correct for the light rungs (T2's accent.solid plate) as well as the dark ones."""
    # ⚠️ PURE BLACK AND PURE WHITE ARE NOT ACCENT COLOURS -- they are the T2 recipe's
    # `black_or_white_by_luminance`, i.e. a CHOICE BETWEEN TWO, not a hue to slide along.
    # Lerping one of them produced `#ffffff -> #202020`: the right decision (the plate is
    # light, so the text must be dark) expressed as an arbitrary grey. Flip it instead,
    # which is both what the recipe says and the higher contrast of the two.
    if text in ((255, 255, 255), (0, 0, 0)):
        cands = [(0, 0, 0), (255, 255, 255)]
        best = max(cands, key=lambda c: contrast(c, plate))
        return best if contrast(best, plate) >= target else None

    r, g, b = [c / 255.0 for c in text]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    up = lum(plate) < 0.18            # dark plate -> lift text toward white
    best = None
    steps = 240
    for i in range(1, steps + 1):
        nl = l + (1.0 - l) * (i / steps) if up else l * (1 - i / steps)
        nr, ng, nb = colorsys.hls_to_rgb(h, max(0.0, min(1.0, nl)), s)
        cand = (nr * 255, ng * 255, nb * 255)
        if contrast(cand, plate) >= target:
            best = tuple(int(round(x)) for x in cand)
            break
    return best


# ---------------------------------------------------------------- the size rule
# Scrolls and gold are the author's two exceptions. Neither can be expressed on a THEME
# ROW: the theme is keyed (theme_category, "Tier N") where N is the tier's `theme.Tier`,
# and `Tier 7 General` (low-value currency) and `Tier 8 General` (scrolls) both carry
# Tier 4 -- one row, two meanings. So the exceptions are written INLINE on the tier, which
# wins over the row, and only the global floor is applied to the theme itself.
INLINE_SIZE = {
    ("Currency/General.json", "General", "Tier 8 General"): 35,   # scrolls
    ("Currency/Gold.json", "Gold", "Tier 0 Gold"): 40,            # "T1" - the big pile
    ("Currency/Gold.json", "Gold", "Tier 1 Gold"): 35,
    ("Currency/Gold.json", "Gold", "Tier 2 Gold"): 35,
}


def do_inline():
    """Write the two exceptions onto their tiers. Reported separately because these are
    the only places the floor is deliberately NOT 40."""
    changed = []
    for (rel, cat, tier), size in sorted(INLINE_SIZE.items()):
        path = os.path.join(TD, *rel.split("/"))
        d = json.load(io.open(path, encoding="utf-8"))
        node = d.get(cat, {}).get(tier)
        if node is None:
            changed.append((rel, tier, "MISSING TIER", None))
            continue
        th = node.setdefault("theme", {})
        was = th.get("FontSize")
        if was == size:
            continue
        th["FontSize"] = size
        changed.append((rel, tier, was, size))
        if APPLY:
            io.open(path, "w", encoding="utf-8").write(
                json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    return changed


def sweep_inline(T):
    """Second pass: the INLINE `theme` block on a tier, which BEATS the theme row.

    ★ WHY A SECOND PASS IS NOT OPTIONAL. Fixing the rows alone moved 173 blocks under 40px
    down to 25 and 40 unreadable pairs down to 7 -- and every survivor came from here. 216
    inline style keys across 24 tier files sit on top of the theme, so a row fixed in
    `sharket_theme.json` is silently overruled wherever a tier restates it. This is the
    author's "the thing I see is not the thing the designer ships" in one sentence.

    ⚠️ THE PLATE MAY BE INHERITED WHILE THE TEXT IS INLINE. Contrast has to be measured
    against the EFFECTIVE pair -- inline value first, theme row behind it -- or a tier that
    only restates its TextColor gets compared against nothing and is skipped. That is most
    of them.
    """
    size_hits, con_hits = [], []
    exceptions = {(rel, cat, tier) for (rel, cat, tier) in INLINE_SIZE}
    for dirpath, _dirs, files in os.walk(TD):
        for fn in sorted(files):
            if not fn.endswith(".json"):
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, TD).replace("\\", "/")
            try:
                d = json.load(io.open(path, encoding="utf-8"))
            except Exception:
                continue
            dirty = False
            for cat, body in d.items():
                if not isinstance(body, dict):
                    continue
                tcat = (body.get("_meta") or {}).get("theme_category")
                rows = T.get(tcat) or {}
                for tier, node in body.items():
                    if tier == "_meta" or not isinstance(node, dict):
                        continue
                    if node.get("is_hide_tier"):
                        continue           # a hide emits no style lines at all
                    th = node.get("theme")
                    if not isinstance(th, dict):
                        continue
                    row = rows.get("Tier %s" % th.get("Tier")) or {}
                    # Same house-identity scope as the row pass: T0/T1 are the fixed
                    # red-on-white and red-plate rungs and are not in the complaint.
                    house = th.get("Tier") in (0, 1)

                    if (rel, cat, tier) not in exceptions:
                        eff = th.get("FontSize", row.get("FontSize"))
                        if isinstance(eff, int) and eff < SIZE_FLOOR:
                            size_hits.append((rel, tier, eff, SIZE_FLOOR))
                            th["FontSize"] = SIZE_FLOOR
                            dirty = True

                    tc = th.get("TextColor", row.get("TextColor"))
                    bc = th.get("BackgroundColor", row.get("BackgroundColor"))
                    t, b = unhex(tc), unhex(bc)
                    if not t or not b:
                        continue           # rarity-painted, or no plate: leave alone
                    before = contrast(t[0], b[0])
                    if before >= TARGET or t[0] in IDENTITY or house:
                        continue
                    new = lift(t[0], b[0])
                    if new is None:
                        con_hits.append((rel, tier, before, None, tc, None))
                        continue
                    th["TextColor"] = rehex(new, t[1])
                    con_hits.append((rel, tier, before, contrast(new, b[0]), tc,
                                     th["TextColor"]))
                    dirty = True
            if dirty and APPLY:
                io.open(path, "w", encoding="utf-8").write(
                    json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    return size_hits, con_hits


def main():
    T = json.load(io.open(THEME, encoding="utf-8"))

    size_hits, con_hits, skipped_rarity = [], [], 0
    for cat in sorted(T):
        rows = T[cat]
        if not isinstance(rows, dict):
            continue
        for rung in sorted(rows):
            row = rows[rung]
            if not isinstance(row, dict):
                continue

            # ---- size floor
            fs = row.get("FontSize")
            if isinstance(fs, int) and fs < SIZE_FLOOR:
                size_hits.append((cat, rung, fs, SIZE_FLOOR))
                row["FontSize"] = SIZE_FLOOR

            # ---- contrast floor
            # ⚠️ T0 AND T1 ARE HOUSE IDENTITY AND ARE LEFT ALONE. Red-on-white measures
            # 4.00:1 and has been seen in game and accepted twice; it is the single most
            # recognisable pair in the filter and it is 45px on a white plate, which is
            # what makes it legible in practice. Repainting it to buy 0.5:1 would trade
            # the filter's loudest signal for a number. The author's complaint was
            # explicitly "beyond T2", so that is exactly the scope taken here.
            if rung in ("Tier 0", "Tier 1"):
                continue
            t, b = unhex(row.get("TextColor")), unhex(row.get("BackgroundColor"))
            if row.get("TextColor") is None and row.get("BackgroundColor") is not None:
                skipped_rarity += 1
            if not t or not b:
                continue
            before = contrast(t[0], b[0])
            if before >= TARGET:
                continue
            new = lift(t[0], b[0])
            if new is None:
                con_hits.append((cat, rung, before, None, row["TextColor"], None))
                continue
            after = contrast(new, b[0])
            con_hits.append((cat, rung, before, after, row["TextColor"], rehex(new, t[1])))
            row["TextColor"] = rehex(new, t[1])

    print("=== size floor (%dpx) ===" % SIZE_FLOOR)
    print("  theme rows raised : %d" % len(size_hits))
    for cat, rung, was, now in size_hits:
        print("    %-26s %-10s %2d -> %d" % (cat[:26], rung, was, now))

    inline = do_inline()
    print()
    print("=== size exceptions, written inline on the tier (beats the row) ===")
    for rel, tier, was, now in inline:
        print("    %-24s %-18s %s -> %s" % (rel.split("/")[-1], tier, was, now))
    if not inline:
        print("    (already correct)")

    print()
    print("=== contrast floor (%.1f:1) ===" % TARGET)
    print("  rows lifted                     : %d" % len([c for c in con_hits if c[3]]))
    print("  rows that could not reach target: %d" % len([c for c in con_hits if not c[3]]))
    print("  rarity-painted rows left alone  : %d   <- never write a TextColor here"
          % skipped_rarity)
    for cat, rung, before, after, old, new in con_hits:
        if after:
            print("    %-26s %-10s %4.2f -> %4.2f   %s -> %s"
                  % (cat[:26], rung, before, after, old, new))
        else:
            print("    %-26s %-10s %4.2f -> UNREACHABLE (%s)" % (cat[:26], rung, before, old))

    isz, icon = sweep_inline(T)
    print()
    print("=== inline tier styles (these BEAT the theme row) ===")
    print("  inline sizes raised : %d" % len(isz))
    for rel, tier, was, now in isz:
        print("    %-34s %-26s %2d -> %d" % (rel[:34], tier[:26], was, now))
    print("  inline texts lifted : %d" % len([c for c in icon if c[3]]))
    for rel, tier, before, after, old, new in icon:
        if after:
            print("    %-30s %-22s %4.2f -> %4.2f  %s -> %s"
                  % (rel[:30], tier[:22], before, after, old, new))
        else:
            print("    %-30s %-22s %4.2f -> UNREACHABLE (%s)" % (rel[:30], tier[:22],
                                                                 before, old))

    if APPLY:
        io.open(THEME, "w", encoding="utf-8").write(
            json.dumps(T, ensure_ascii=False, indent=2) + "\n")
        print()
        print("wrote %s + %d tier files" % (os.path.relpath(THEME, ROOT),
                                            len({r for r, *_ in isz + [c[:1] + c[1:] for c in icon]})))
    else:
        print()
        print("(dry run -- pass --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
