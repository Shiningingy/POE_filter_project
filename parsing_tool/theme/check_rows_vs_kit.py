# -*- coding: utf-8 -*-
"""Derive every category's ladder from the KIT and report where the theme rows disagree.

    python parsing_tool/theme/check_rows_vs_kit.py            # all categories
    python parsing_tool/theme/check_rows_vs_kit.py Oils Maps  # just these

★ WHY DERIVING BEATS CHOOSING. The tree-wide collapse assumed the theme ROWS held the design
and inline was a stale snapshot of them. Measured afterwards: of 50 theme categories, 18 are
MIXED and NOT ONE is cleanly row-authoritative — so the rows are broadly stale and the design
mostly lives inline. But that is not universal either. Oils is the exact inverse of Maps: its
rows reproduce the kit recipe byte-for-byte while its inline is old. Picking a winner per
category by eye is what broke Maps and Voyage Charts in game.

The kit removes the choice. `_rule`: *"A tier block authors exactly two values: accent + rung.
Icon, beam and plate are pure functions of those."* So the intended ladder is DERIVABLE —
`rung_recipes[rung]` x `accents[family]` — and neither stale copy has to win an argument.

⚠️ SEVEN CATEGORIES ARE EXCEPTIONS and deriving is WRONG for them. They are reported, never
compared:
  maps      plate = MAP TIER (maps_tier_ramp), not the rung — which is exactly why clearing
            its inline flattened T11-T15 onto one plate and a red map came out 200 200 200
  gold      no plate, no beam, no icon at any rung — auto-collected, the label is a readout
  heist     rung = area quality, floor T3, never the bulk rungs
  uniques / gems / divination_cards   accent substitutions
  currency  none needed — it IS the house ladder

⚠️ FontSize IS NOT COMPARED. `_rule` says presets carry no FontSize, and the recipes' `size_px`
(45/45/40/35/35/30) sits below the author's stated floor of 40 at three rungs. Size is the
author's axis; the kit supplies colour.
"""
import io, json, os, sys, collections

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HANDOFF = os.path.join(ROOT, "docs", "design", "handoff")
DATA = os.path.join(ROOT, "filter_generation", "data")

presets = json.load(io.open(os.path.join(HANDOFF, "theme-presets.json"), encoding="utf-8"))
amap = json.load(io.open(os.path.join(HANDOFF, "accent-category-map.json"), encoding="utf-8"))
T = json.load(io.open(os.path.join(DATA, "theme", "sharket", "sharket_theme.json"),
                      encoding="utf-8"))

ACCENTS = presets.get("accents") or {}
RECIPES = presets.get("rung_recipes") or {}
CAT_ACCENT = amap.get("accent_by_category") or {}
EXCEPTIONS = {k for k in (presets.get("_category_exceptions") or {}) if not k.startswith("_")}


def rgb(s):
    if not isinstance(s, str):
        return None
    p = s.split()
    return tuple(int(x) for x in p[:3]) if len(p) >= 3 and all(x.isdigit() for x in p[:3]) else None


def hexa(c, a=255):
    return "#%02x%02x%02x%02x" % (c[0], c[1], c[2], a)


def lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def resolve(expr, acc):
    """'accent.solid @ 240' / '255 255 255' / 'accent.muted' -> (rgb, alpha) or None."""
    if not expr:
        return None
    alpha = 255
    e = expr
    if "@" in e:
        e, a = e.split("@", 1)
        e, alpha = e.strip(), int(a.strip())
    e = e.strip()
    if e.startswith("accent."):
        key = e.split(".", 1)[1].split()[0]
        v = rgb(acc.get(key))
        return (v, alpha) if v else None
    v = rgb(e)
    return (v, alpha) if v else None


def intended(rung, acc, mode):
    """The kit's colours for one rung. mode: 'painted' | 'rarity_through'."""
    r = RECIPES.get("T%d" % rung)
    if not r:
        return None
    v = r.get(mode) or {}
    out = {}
    for key, ch in (("text", "TextColor"), ("bg", "BackgroundColor")):
        raw = v.get(key)
        if raw == "black_or_white_by_luminance":
            # ⚠️ NOT AN EYEBALLED THRESHOLD. Pick whichever of black/white actually gives more
            # contrast on this plate: black wins when (L+0.05)^2 > 0.05*1.05, i.e. L > 0.1791.
            # A guessed 0.45 reported white as "intended" on a dozen categories whose rows
            # correctly use black, which would have sent us rewriting good rows.
            bg = resolve(v.get("bg"), acc)
            out[ch] = "#000000ff" if (bg and lum(bg[0]) > 0.1791) else "#ffffffff"
            continue
        got = resolve(raw, acc)
        if got:
            out[ch] = hexa(got[0], got[1])
    return out


def main():
    want = [a for a in sys.argv[1:] if not a.startswith("-")]
    rows = []
    for cat, accent in sorted(CAT_ACCENT.items()):
        if want and not any(w.lower() in cat.lower() for w in want):
            continue
        acc = ACCENTS.get(accent) or {}
        have = T.get(cat)
        if have is None:
            rows.append((cat, accent, "NO ROWS", [], []))
            continue
        if accent in EXCEPTIONS:
            rows.append((cat, accent, "EXCEPTION", [], []))
            continue
        agree, differ = [], []
        for key, row in sorted(have.items()):
            if not key.startswith("Tier "):
                continue
            try:
                rung = int(key.split()[1])
            except ValueError:
                continue
            mode = "rarity_through" if "TextColor" not in row else "painted"
            want_row = intended(rung, acc, mode)
            if not want_row:
                continue
            for ch, v in want_row.items():
                got = row.get(ch)
                (agree if got == v else differ).append((key, ch, got, v))
        rows.append((cat, accent, "", agree, differ))

    print("%-24s %-14s %6s %6s  %s" % ("theme category", "accent", "match", "differ", "note"))
    print("-" * 110)
    tot_a = tot_d = 0
    for cat, accent, note, agree, differ in sorted(rows, key=lambda r: -len(r[4])):
        tot_a += len(agree)
        tot_d += len(differ)
        ex = ""
        if differ:
            k, ch, got, v = differ[0]
            ex = "%s %s: have %s  kit %s" % (k, ch, got, v)
        print("%-24s %-14s %6d %6d  %s" % (cat[:24], accent[:14], len(agree), len(differ),
                                           note or ex[:52]))
    print()
    print("channels matching the kit : %d      disagreeing : %d" % (tot_a, tot_d))
    return 0


if __name__ == "__main__":
    sys.exit(main())
