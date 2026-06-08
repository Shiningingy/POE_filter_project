#!/usr/bin/env python3
"""Build the standard role-based theme: per-category accent x per-role intensity.

Writes a complete `filter_generation/data/theme/sharket/sharket_theme.json` covering
EVERY theme_category our data uses (so nothing falls back to the generic "Currency"
style) for tiers 0-5 + 9. Each category has its own accent HUE; the role (= absolute
tier number, see roles.json) controls SIZE/BRIGHTNESS. Decorator (Tier 0) is rendered
in the category's own accent so top highlights aren't all identical.

theme_category list is read live from tier_definition so coverage stays in sync.
Re-runnable. Run: python parsing_tool/build_standard_theme.py
"""

import glob
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]
TIER_DEF = ROOT / "filter_generation" / "data" / "tier_definition"
OUT = ROOT / "filter_generation" / "data" / "theme" / "sharket" / "sharket_theme.json"

# --- Accent hues (R,G,B) -------------------------------------------------------
GEAR = (130, 150, 175)  # neutral blue-steel; all weapons/armour/jewellery share it
GEAR_CATS = {
    "Bows", "Wands", "Claws", "Daggers", "Rune Daggers", "Sceptres", "Staves",
    "Warstaves", "One Hand Axes", "One Hand Maces", "One Hand Swords",
    "Two Hand Axes", "Two Hand Maces", "Two Hand Swords", "Thrusting One Hand Swords",
    "Boots", "Gloves", "Helmets", "Shields", "Quivers", "Body Armours",
    "Amulets", "Rings", "Belts", "Trinkets",
}
ACCENT = {
    # general currency
    "Stackable Currency": (212, 175, 55),
    "Currency": (212, 175, 55),          # generate.py fallback key — keep present
    "Gold": (232, 184, 48),
    # mechanic currencies (own theme_category)
    "Essences": (64, 110, 255),
    "Fossils": (255, 140, 26),
    "Delirium Orbs": (180, 162, 210),
    "Harvest": (60, 200, 90),
    # endgame / drops
    "Uniques": (190, 105, 40),
    "Divination Cards": (40, 200, 200),
    "Maps": (70, 135, 205),
    "Map Fragments": (200, 168, 96),
    "Jewels": (224, 70, 196),
    "Skill Gems": (32, 190, 172),
    "Support Gems": (44, 172, 150),
    # consumables
    "Life Flasks": (210, 70, 70),
    "Mana Flasks": (70, 100, 210),
    "Utility Flasks": (150, 100, 210),
    "Tinctures": (164, 178, 70),
    # misc / quest / league
    "Quest Items": (52, 200, 52),
    "Labyrinth Items": (52, 180, 180),
    "Idols": (132, 70, 180),
    "Wombgifts": (210, 116, 162),
    "Campaign": (160, 160, 165),
    "Legacy": (162, 130, 52),
    "Chancing": (96, 162, 210),
    "Vendor Recipes": (178, 130, 66),
    # editor template fallback
    "Templates": (180, 180, 110),
}

# --- PoE named colours (for PlayEffect + MinimapIcon) --------------------------
NAMED = {
    "Red": (255, 0, 0), "Green": (0, 255, 0), "Blue": (60, 90, 255),
    "Brown": (150, 90, 40), "White": (255, 255, 255), "Yellow": (255, 230, 60),
    "Cyan": (0, 230, 230), "Grey": (140, 140, 150), "Orange": (255, 150, 40),
    "Pink": (255, 110, 170), "Purple": (170, 60, 210),
}


def nearest_named(c):
    return min(NAMED, key=lambda n: sum((a - b) ** 2 for a, b in zip(NAMED[n], c)))


def clamp(x):
    return max(0, min(255, int(round(x))))


def scale(c, f):
    return tuple(clamp(x * f) for x in c)


def mix(c1, c2, t):
    return tuple(clamp(c1[i] * (1 - t) + c2[i] * t) for i in range(3))


def lum(c):
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255.0


def hx(c, a=255):
    return f"#{clamp(c[0]):02x}{clamp(c[1]):02x}{clamp(c[2]):02x}{clamp(a):02x}"


def role_style(accent, tier):
    """Render a category accent at the given role/tier intensity."""
    A = accent
    pe = nearest_named(A)
    if tier == 0:  # Decorator — brightest, accent-filled spotlight
        text = (0, 0, 0) if lum(A) > 0.6 else (255, 255, 255)
        return {"FontSize": 45, "TextColor": hx(text), "BorderColor": hx((255, 255, 255)),
                "BackgroundColor": hx(A), "PlayEffect": pe, "MinimapIcon": f"0 {pe} Star"}
    if tier == 1:  # High Value
        return {"FontSize": 42, "TextColor": hx((255, 255, 255)), "BorderColor": hx(A),
                "BackgroundColor": hx(scale(A, 0.20)), "PlayEffect": pe, "MinimapIcon": f"1 {pe} Diamond"}
    if tier == 2:  # Valuable
        return {"FontSize": 39, "TextColor": hx(mix(A, (255, 255, 255), 0.15)), "BorderColor": hx(A),
                "BackgroundColor": hx((16, 16, 22)), "MinimapIcon": f"1 {pe} Circle"}
    if tier == 3:  # Notable
        return {"FontSize": 36, "TextColor": hx(mix(A, (255, 255, 255), 0.30)),
                "BorderColor": hx(scale(A, 0.55)), "BackgroundColor": hx((10, 10, 13))}
    if tier == 4:  # Useful
        return {"FontSize": 34, "TextColor": hx(mix(A, (150, 150, 158), 0.55)),
                "BorderColor": hx(scale(A, 0.30)), "BackgroundColor": hx((0, 0, 0), 0)}
    if tier == 5:  # Bulk / Leveling
        return {"FontSize": 31, "TextColor": hx((150, 150, 160)),
                "BorderColor": hx((60, 60, 70)), "BackgroundColor": hx((0, 0, 0), 0)}
    # tier 9 — Hide (style irrelevant)
    return {"FontSize": 18, "TextColor": hx((90, 90, 100), 170),
            "BorderColor": hx((45, 45, 52), 120), "BackgroundColor": hx((0, 0, 0), 0)}


TIERS = [0, 1, 2, 3, 4, 5, 9]


def live_theme_categories():
    cats = set()
    for f in glob.glob(str(TIER_DEF / "**" / "*.json"), recursive=True):
        try:
            d = json.loads(Path(f).read_text(encoding="utf-8"))
        except Exception:
            continue
        for gk, gv in d.items():
            if gk.startswith("//"):
                continue
            tc = gv.get("_meta", {}).get("theme_category")
            if tc:
                cats.add(tc)
    return cats


def main():
    needed = live_theme_categories()
    # Always include the generate.py fallback key + editor template.
    universe = set(ACCENT) | GEAR_CATS | needed | {"Currency", "Templates"}

    theme = {}
    missing_accent = []
    for cat in sorted(universe):
        accent = GEAR if cat in GEAR_CATS else ACCENT.get(cat)
        if accent is None:
            missing_accent.append(cat)
            accent = (150, 150, 160)  # safe neutral
        theme[cat] = {f"Tier {t}": role_style(accent, t) for t in TIERS}

    # Coverage check: every live theme_category must be themed.
    uncovered = sorted(needed - set(theme))
    assert not uncovered, f"Uncovered theme_categories: {uncovered}"

    OUT.write_text(json.dumps(theme, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} — {len(theme)} categories x {len(TIERS)} tiers.")
    print(f"Live theme_categories needed: {len(needed)}; all covered.")
    if missing_accent:
        print(f"[note] no explicit accent (used neutral) for: {missing_accent}")


if __name__ == "__main__":
    main()
