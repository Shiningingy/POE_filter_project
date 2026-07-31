"""One-shot: rewrite every tier's inline `theme` as its fully RESOLVED style.

Usage:  python filter_generation/reseed_tier_styles.py [--check]

Step B2 of the theme-pipeline rewrite, and the thing that makes "the tier block
owns its look" safe to switch on.

The problem it solves: inline `theme` cannot be trusted today. The editor writes
the RESOLVED theme back into a tier whenever it saves, so the field holds a mix
of deliberate authoring and stale snapshots. Measured against the theme as it
stood before the designer's port (c3a0937): of 358 inline style keys, 176 already
agree with the theme row, and of the 182 that differ, 87 are EXACTLY the
pre-designer value and 67 more look like editor defaults (#FFFFFF, #AAAAAA).
Flipping "inline wins" against that data would silently undo the designer's port.

So: overwrite inline with what the tier actually resolves to right now. After
this the two are equal by construction for every tier, which means flipping the
priority changes NO output — that is the whole point, and it is checked by
generating before and after and comparing bytes.

What is preserved and what is replaced:

  * STYLE channels are replaced wholesale by the resolved theme row. Keys ABSENT
    from the row stay absent — never filled in with a default. An absent colour
    means "let the game paint it" (441 of 998 theme rows omit TextColor so the
    rarity colour shows through), so materialising a default here would paint
    over exactly the thing the designer left open.
  * `Tier` is kept. It stops being a style input and becomes the pointer at which
    preset the block was seeded from (workstream E).
  * `PlayAlertSound` is kept untouched — sound has its own priority chain, and
    per-item sound is moving to the item card, not into this block.

Idempotent: running it twice is a no-op, because the second run resolves to what
the first wrote.
"""
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
TIER_DEF_DIR = PROJECT_ROOT / "filter_generation" / "data" / "tier_definition"
THEME_FILE = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "sharket_theme.json"

# Imported from the generator so this migration cannot drift from what actually
# emits — including the beam/icon promotion and its well-formedness guard.
sys.path.insert(0, str(PROJECT_ROOT / "filter_generation"))
from generate import resolve_tier_theme, tier_num_from_label  # noqa: E402

# Style channels the block owns. `Tier` and `PlayAlertSound` are deliberately not
# here — see the module docstring.
STYLE_KEYS = ("FontSize", "TextColor", "BorderColor", "BackgroundColor",
              "PlayEffect", "MinimapIcon")


def reseed(check_only: bool) -> int:
    theme = json.loads(THEME_FILE.read_text(encoding="utf-8"))
    changed_files = 0
    changed_tiers = 0
    added = replaced = dropped = 0
    empty_rows = []

    for path in sorted(TIER_DEF_DIR.rglob("*.json")):
        original = path.read_text(encoding="utf-8")
        doc = json.loads(original)
        category_key = next((k for k in doc if not k.startswith("//")), None)
        if not category_key:
            continue
        category = doc[category_key]
        theme_cat = category.get("_meta", {}).get("theme_category", category_key)
        theme_ref = theme.get(theme_cat, theme.get("Default", {}))

        for tier_key, tier_entry in category.items():
            if tier_key == "_meta" or not isinstance(tier_entry, dict):
                continue
            old = tier_entry.get("theme") or {}
            tnum = old.get("Tier", tier_num_from_label(tier_key))
            row = resolve_tier_theme(theme_ref, tier_entry, tnum)

            new = {}
            if "Tier" in old:
                new["Tier"] = old["Tier"]
            for k in STYLE_KEYS:
                if k in row:
                    new[k] = row[k]
            if "PlayAlertSound" in old:
                new["PlayAlertSound"] = old["PlayAlertSound"]

            if not any(k in row for k in STYLE_KEYS):
                # No theme row at all: the block emits SetFontSize 32 and nothing
                # else. Not fatal, but it means the block has no look to own.
                empty_rows.append(f"{path.relative_to(TIER_DEF_DIR).as_posix()} :: {tier_key}")

            if new != old:
                changed_tiers += 1
                for k in STYLE_KEYS:
                    if k in new and k not in old:
                        added += 1
                    elif k in new and old.get(k) != new[k]:
                        replaced += 1
                    elif k in old and k not in new:
                        dropped += 1
                if new:
                    tier_entry["theme"] = new
                elif "theme" in tier_entry:
                    del tier_entry["theme"]

        updated = json.dumps(doc, ensure_ascii=False, indent=2) + ("\n" if original.endswith("\n") else "")
        if updated != original:
            changed_files += 1
            if not check_only:
                path.write_text(updated, encoding="utf-8")

    verb = "would change" if check_only else "changed"
    print(f"{verb} {changed_tiers} tiers across {changed_files} files")
    print(f"  style keys: +{added} added, {replaced} replaced, {dropped} dropped")
    if empty_rows:
        print(f"  ⚠️ {len(empty_rows)} tiers resolve to NO theme row (they emit font size only):")
        for e in empty_rows[:15]:
            print(f"      {e}")
        if len(empty_rows) > 15:
            print(f"      … +{len(empty_rows) - 15} more")
    return changed_files


if __name__ == "__main__":
    reseed("--check" in sys.argv)
