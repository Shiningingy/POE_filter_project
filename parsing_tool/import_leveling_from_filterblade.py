"""
Import NeverSink/FilterBlade campaign LEVELING rules into our `_campaign` tiers.

Source: data/FilterBlade.filter (NeverSink, campaign auto-adjust enabled, used
with NeverSink's permission). The leveling section tags every block
`$type->leveling->...`. We translate the ACTIVE (Show) blocks into our
`class_condition` tiers (the format `_campaign/Armour.json` already uses — the
generator emits arbitrary condition keys with NO BaseType line and resolves
colours from the theme table, so we store conditions only, never colours).

Design (per user):
  * Ruthless-first: this imports into the current (Ruthless) tree. Ruthless shows
    more, so we import only the SHOW/highlight blocks and SKIP the aggressive
    Hide blocks (magic blockers, wand-progression). Softcore's future overlay can
    add the harsher hides.
  * DROP the RGB/chromatic-recipe blocks (SocketGroup "RGB") — deferred until GGG
    confirms the 3.29 chromatic change (see TODO print).
  * SPLIT multi-class blocks into one class_condition tier PER single item class
    (each independently tunable; sets up a future per-class customizer).
  * Colours/sounds/icons are stripped (theme table owns them).

Scanner note: FilterBlade emits the `Class ==` line at COLUMN 0 (unindented) in
some blocks (socketslinks / normalmagic 4l/3l). So a block body runs until the
next blank line / comment / Show|Hide header — NOT until the first unindented
line.

Idempotent: imported tiers carry `_lv: true`; a re-run removes the old ones and
re-adds fresh, preserving any hand-authored (non-`_lv`) tiers + `_meta`.
Run from the project root:  python parsing_tool/import_leveling_from_filterblade.py
"""

import json
import re
from collections import OrderedDict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FILTER_PATH = PROJECT_ROOT / "data" / "FilterBlade.filter"
TIER_DIR = PROJECT_ROOT / "filter_generation" / "data" / "tier_definition" / "_campaign"

# A block header: Show/Hide + $type->leveling->... + $tier->X. Only active
# (Show/Hide) lines match; commented `#Show` never matches (starts with '#').
BLOCK_RE = re.compile(r'^(?P<cmd>Show|Hide)\b.*\$type->(?P<path>leveling->\S+)\s.*\$tier->(?P<tier>\S+)')
QUOTED_RE = re.compile(r'"([^"]+)"')

# Style/action lines to strip (theme table owns colours/sounds/icons).
STYLE_PREFIXES = (
    "SetFontSize", "SetTextColor", "SetBorderColor", "SetBackgroundColor",
    "PlayAlertSound", "PlayEffect", "MinimapIcon", "CustomAlertSound",
    "DisableDropSound", "EnableDropSound", "Continue",
)

# subtype substring (after `leveling->`) -> (target file under _campaign, theme.Tier).
# Ordered; first match wins. Loud highlights get low Tier numbers; generic gets high.
ROUTING = [
    ("rare->exotics",      ("Rare/Noteworthy.json",        2)),  # movement boots / veiled
    ("rare->socketslinks", ("Rare/Remaining.json",         3)),  # 4-link rares
    ("rare->archer",       ("Rare/Weapon Highlight.json",  4)),
    ("rare->melee",        ("Rare/Weapon Highlight.json",  4)),
    ("rare->caster",       ("Rare/Weapon Highlight.json",  4)),
    ("rare->armours",      ("Rare/Jewellery Armours.json", 4)),
    ("rare->minion",       ("Rare/Jewellery Armours.json", 4)),
    ("rare->universal",    ("Rare/Jewellery Armours.json", 4)),
    ("rare->remaining",    ("Rare/Remaining.json",         5)),
    ("flasks->quality",    ("QualityFlasks.json",          4)),
    ("flasks",             ("Flasks.json",                 5)),
    ("tincture",           ("Tinctures.json",              4)),
    ("normalmagic->4l",    ("Normal Early.json",           5)),
    ("normalmagic->3l",    ("Normal Early.json",           5)),
    ("normalmagic",        ("Normal Early.json",           6)),
    ("firstlevels",        ("Act/Act 1.json",              6)),
    ("magic->remaining",   ("Magic.json",                  7)),
]

CLASS_ZH = {
    "Body Armours": "胸甲", "Helmets": "头部", "Gloves": "手套", "Boots": "鞋子",
    "Shields": "盾", "Bows": "弓", "Quivers": "箭袋", "Claws": "爪", "Daggers": "匕首",
    "Rune Daggers": "符文匕首", "One Hand Swords": "单手剑",
    "Thrusting One Hand Swords": "刺剑", "One Hand Axes": "单手斧",
    "One Hand Maces": "单手锤", "Sceptres": "短杖", "Wands": "法杖",
    "Two Hand Swords": "双手剑", "Two Hand Axes": "双手斧", "Two Hand Maces": "双手锤",
    "Staves": "长杖", "Warstaves": "战杖", "Amulets": "护身符", "Rings": "戒指",
    "Belts": "腰带", "Life Flasks": "生命药剂", "Mana Flasks": "魔力药剂",
    "Hybrid Flasks": "复合药剂", "Utility Flasks": "功能药剂", "Tinctures": "酊剂",
}

SOUND_BY_TIER = {2: (2, None), 3: (2, None), 4: (-1, None), 5: (-1, None),
                 6: (-1, None), 7: (-1, None)}


def parse_blocks(text):
    """Ordered list of active leveling blocks. Body = header .. next blank/comment/header."""
    lines = text.splitlines()
    blocks, i, n = [], 0, len(lines)
    while i < n:
        m = BLOCK_RE.match(lines[i])
        if not m:
            i += 1
            continue
        conds = OrderedDict()
        j = i + 1
        while j < n:
            s = lines[j].strip()
            if s == "" or s.startswith("#") or re.match(r'^(Show|Hide|Minimal)\b', s):
                break
            j += 1
            if any(s.startswith(p) for p in STYLE_PREFIXES):
                continue
            key, _, val = s.partition(" ")
            val = val.strip()
            if key in conds:  # repeated key = AND
                prev = conds[key]
                conds[key] = (prev if isinstance(prev, list) else [prev]) + [val]
            else:
                conds[key] = val
        blocks.append({"cmd": m.group("cmd"), "path": m.group("path"),
                       "tier": m.group("tier"), "conds": conds, "order": len(blocks)})
        i = j
    return blocks


def route(path):
    for needle, dest in ROUTING:
        if needle in path:
            return dest
    return None


def is_rgb(block):
    if "->rgb" in block["path"] or "chromatic" in block["tier"].lower():
        return True
    sg = block["conds"].get("SocketGroup", "")
    return "RGB" in (sg if isinstance(sg, str) else " ".join(sg))


def class_values(conds):
    """Return list of individual class names from a `Class == "A" "B"` condition, or []."""
    cl = conds.get("Class")
    if not cl:
        return []
    cl = cl if isinstance(cl, str) else " ".join(cl)
    return QUOTED_RE.findall(cl)


def build_tier(block, theme_tier, cls):
    """One class_condition tier for `block`, optionally pinned to a single class `cls`."""
    conds = OrderedDict()
    for k, v in block["conds"].items():
        if k == "Class":
            continue  # replaced below (or dropped if no class)
        conds[k] = v
    if cls:
        conds["Class"] = f'== "{cls}"'
    leaf = block["path"].split("->")[-1]
    tag = block["tier"]
    key = f"Lv {leaf} {tag}" + (f" {cls}" if cls else "")
    en = f"Leveling: {leaf} {tag}" + (f" ({cls})" if cls else "")
    ch = "过渡: " + (CLASS_ZH.get(cls, cls) if cls else leaf) + f" {tag}"
    sound_id, sharket = SOUND_BY_TIER.get(theme_tier, (-1, None))
    return key, {
        "_lv": True,
        "class_condition": True,
        "conditions": OrderedDict([("Rarity", conds.pop("Rarity")), *conds.items()])
        if "Rarity" in conds else conds,
        "hideable": True,
        "theme": {"Tier": theme_tier},
        "sound": {"default_sound_id": sound_id, "sharket_sound_id": sharket},
        "localization": {"en": en, "ch": ch},
        "_source": {"path": block["path"], "tier": tag, "order": block["order"]},
    }


def main():
    text = FILTER_PATH.read_text(encoding="utf-8")
    blocks = parse_blocks(text)

    dropped_rgb, skipped_hide, unrouted = [], [], []
    per_file = {}  # relpath -> list of (order, theme_tier, key, tier_dict)

    for b in blocks:
        if is_rgb(b):
            dropped_rgb.append(f'{b["path"]} ${b["tier"]}')
            continue
        if b["cmd"] == "Hide":  # ruthless shows more — skip aggressive hides for now
            skipped_hide.append(f'{b["path"]} ${b["tier"]}')
            continue
        dest = route(b["path"])
        if not dest:
            unrouted.append(b["path"])
            continue
        relpath, theme_tier = dest
        classes = class_values(b["conds"])
        targets = classes if classes else [None]
        for cls in targets:
            key, tier = build_tier(b, theme_tier, cls)
            per_file.setdefault(relpath, []).append((b["order"], theme_tier, key, tier))

    written = 0
    for relpath, entries in sorted(per_file.items()):
        tier_file = TIER_DIR / relpath
        if not tier_file.exists():
            print(f"[warn] target tier file missing, skipped: {relpath}")
            continue
        doc = json.loads(tier_file.read_text(encoding="utf-8"))
        cat_key = next((k for k in doc if not k.startswith("//")), None)
        cat = doc[cat_key]
        meta = cat.get("_meta", {})

        # drop previously-imported (_lv) tiers, keep hand-authored ones
        kept = OrderedDict((k, v) for k, v in cat.items()
                           if k != "_meta" and not (isinstance(v, dict) and v.get("_lv")))

        # dedupe keys, order imported by (theme_tier, source order)
        entries.sort(key=lambda e: (e[1], e[0]))
        seen, new_tiers = set(), OrderedDict()
        for _order, _tt, key, tier in entries:
            uk, n = key, 2
            while uk in seen or uk in kept:
                uk = f"{key} #{n}"; n += 1
            seen.add(uk)
            new_tiers[uk] = tier

        rebuilt = OrderedDict()
        rebuilt["_meta"] = meta
        for k, v in new_tiers.items():
            rebuilt[k] = v
        for k, v in kept.items():
            rebuilt[k] = v
        meta["tier_order"] = list(new_tiers.keys()) + [k for k in kept]

        tier_file.write_text(
            json.dumps({cat_key: rebuilt}, ensure_ascii=False, indent=2), encoding="utf-8")
        written += 1
        print(f"[ok] {relpath}: +{len(new_tiers)} leveling tiers ({len(kept)} kept)")

    print(f"\n[ok] parsed {len(blocks)} leveling blocks → {written} category files")
    print(f"[ok] dropped {len(dropped_rgb)} RGB/chromatic blocks (TODO 3.29 chroma): {dropped_rgb}")
    print(f"[ok] skipped {len(skipped_hide)} Hide blocks (ruthless shows more): {skipped_hide}")
    if unrouted:
        print(f"[warn] {len(unrouted)} unrouted subtypes: {sorted(set(unrouted))}")


if __name__ == "__main__":
    main()
