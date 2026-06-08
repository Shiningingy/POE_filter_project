#!/usr/bin/env python3
"""Generate placeholder base_mapping + tier_definition pairs for the nav rebuild.

The FilterBlade-aligned nav adds many new categories (Endgame special rares,
League-specific bases, Campaign sections) that have no data yet. Rather than
hand-write each file, this manifest-driven helper emits a valid
`base_mapping/<path>` + `tier_definition/<path>` pair for every manifest entry.

It is idempotent: files that already exist are skipped (never overwritten), so
re-running after partially editing some files is safe.

Two kinds:
  * "empty" — `mapping: {}` + a normal Tier 1 + Hide tier. `generate.py` emits
    nothing until the editor fills in base types. The nav slot + editor work.
  * "class" — class_condition Show tier (model: Heist/Targets.json). Emits a
    `Class "..."` block immediately.

Usage:
    python parsing_tool/make_placeholder_categories.py [--dry-run]
"""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_MAPPING = ROOT / "filter_generation" / "data" / "base_mapping"
TIER_DEF = ROOT / "filter_generation" / "data" / "tier_definition"

# (path, en, ch, kind, ruthless, classes)
# classes only used when kind == "class".
MANIFEST = [
    # --- Endgame Gear (Equipment/*) ---
    ("Equipment/Relics.json", "Relics", "遗物", "class", False,
     '"Relics" "Small Relics" "Medium Relics" "Large Relics" "Sanctified Relics"'),
    ("Equipment/Crafting.json", "Crafting Bases", "精品底材", "empty", False, None),
    ("Equipment/MemoryStranded.json", "Memory-Stranded", "追忆物品", "empty", False, None),
    ("Equipment/Veiled.json", "Veiled Items", "隐匿物品", "empty", True, None),
    ("Equipment/Linked.json", "Linked Items", "高连物品", "empty", True, None),
    # --- League-Specific (Equipment/League/*) ---
    ("Equipment/League/Breach Rings.json", "Breach Rings", "裂隙戒指", "empty", False, None),
    ("Equipment/League/Talismans.json", "Talismans", "护身符", "empty", False, None),
    ("Equipment/League/Expedition Ward-Bases.json", "Expedition Ward-Bases", "探险结界底材", "empty", False, None),
    ("Equipment/League/Breach Grasping Mail.json", "Breach Grasping Mail", "扼杀链甲", "empty", False, None),
    ("Equipment/League/Stygian Vise.json", "Stygian Vise", "深渊腰带", "empty", False, None),
    ("Equipment/League/Sacrificial Garbs.json", "Sacrificial Garbs", "祭礼束衣", "empty", False, None),
    ("Equipment/League/Ritual BaseTypes.json", "Ritual BaseTypes", "仪式底材", "empty", False, None),
    ("Equipment/League/Corpses for Spectres.json", "Corpses for Spectres", "召唤尸体", "empty", False, None),
    ("Equipment/League/Heist Experimented.json", "Heist Experimented", "夺宝实验底材", "empty", False, None),
    ("Equipment/League/Mirror Ring Bases.json", "Mirror of Kalandra Ring Bases", "魔镜戒指底材", "empty", False, None),
    ("Equipment/League/Abyss Socketed.json", "Abyss Socketed Items", "深渊插槽物品", "empty", False, None),
    ("Equipment/League/Blight Anointed.json", "Blight Anointed Items", "枯萎涂油物品", "empty", False, None),
    ("Equipment/League/ID Incursion.json", "ID Mods: Incursion", "鉴定词缀：神庙", "empty", True, None),
    ("Equipment/League/ID Delve.json", "ID Mods: Delve", "鉴定词缀：地心", "empty", True, None),
    ("Equipment/League/ID Essence.json", "ID Mods: Essence", "鉴定词缀：精华", "empty", False, None),
    ("Equipment/League/ID Mercenaries.json", "ID Mods: Mercenaries", "鉴定词缀：佣兵", "empty", False, None),
    ("Equipment/League/ID Bestiary.json", "ID Mods: Bestiary", "鉴定词缀：狩猎", "empty", False, None),
    ("Equipment/League/ID Warband.json", "ID Mods: Warband", "鉴定词缀：匪帮", "empty", False, None),
    # --- Campaign (FilterBlade-mirror placeholders, _campaign/*) ---
    ("_campaign/ChromaticRecipe.json", "Chromatic Recipe Items", "色卡配方物品", "empty", False, None),
    ("_campaign/QualityFlasks.json", "Quality Flasks", "品质药剂", "empty", False, None),
    ("_campaign/Tinctures.json", "Tinctures", "酊剂", "empty", False, None),
    ("_campaign/Rare/Noteworthy.json", "Special Noteworthy Drops", "特殊瞩目掉落", "empty", False, None),
    ("_campaign/Rare/Jewellery Armours.json", "Jewellery & Armours", "首饰与护甲", "empty", False, None),
    ("_campaign/Rare/Weapon Highlight.json", "Weapon Highlight", "武器突显", "empty", False, None),
    ("_campaign/Rare/Remaining.json", "Remaining Rares", "其余稀有", "empty", False, None),
    ("_campaign/Act/Act 1.json", "Act 1", "第一章", "empty", False, None),
    ("_campaign/Act/Act 2-3.json", "Act 2/3", "第二、三章", "empty", False, None),
    ("_campaign/Act/Act 4-6.json", "Act 4/5/6", "第四至六章", "empty", False, None),
    ("_campaign/Act/Jewels.json", "Jewels", "珠宝", "empty", False, None),
    ("_campaign/Act/Quivers.json", "Quivers", "箭袋", "empty", False, None),
    ("_campaign/Act/Summoner.json", "Summoner Gear", "召唤流装备", "empty", False, None),
    ("_campaign/Act/Attack Wands.json", "Attack Wands", "攻击手杖", "empty", False, None),
    ("_campaign/Magic.json", "Magic Items", "魔法物品", "empty", False, None),
    ("_campaign/Normal Early.json", "Normal Items - Early", "早期普通物品", "empty", False, None),
]

SILENT_SOUND = {"default_sound_id": -1, "sharket_sound_id": None}


def build_base(en, ch, kind, ruthless, t1_key):
    meta = {}
    if ruthless:
        meta["excluded_modes"] = ["ruthless"]
    # Class label lives canonically in item_class; localization.ch is baseType->zh only.
    meta["localization"] = {"ch": {}}
    meta["item_class"] = {"en": en, "ch": ch}
    meta["theme_category"] = "Stackable Currency"
    mapping = {en: t1_key} if kind == "class" else {}
    return {"_meta": meta, "mapping": mapping, "rules": []}


def build_tier(en, ch, kind, classes, t1_key, hide_key):
    t1 = {
        "hideable": kind != "class",
        "theme": {"Tier": 2 if kind == "class" else 5},
        "sound": dict(SILENT_SOUND),
        "localization": {"en": en, "ch": ch},
    }
    if kind == "class":
        t1["class_condition"] = True
        t1["conditions"] = {"Class": classes}
        t1["hideable"] = False
    hide = {
        "hideable": True,
        "is_hide_tier": True,
        "theme": {"Tier": 9},
        "sound": dict(SILENT_SOUND),
        "localization": {"en": "Hide", "ch": "隐藏"},
    }
    return {
        en: {
            "_meta": {
                "theme_category": "Stackable Currency",
                "localization": {"en": en, "ch": ch},
                "tier_order": [t1_key, hide_key],
            },
            t1_key: t1,
            hide_key: hide,
        }
    }


def write_json(path, data, dry_run):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not dry_run:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)
            fh.write("\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    created = skipped = 0
    for path, en, ch, kind, ruthless, classes in MANIFEST:
        base_path = BASE_MAPPING / path
        tier_path = TIER_DEF / path
        if base_path.exists() and tier_path.exists():
            skipped += 1
            print(f"  skip (exists): {path}")
            continue
        t1_key = f"{en} T1"
        hide_key = f"{en} Hide"
        write_json(base_path, build_base(en, ch, kind, ruthless, t1_key), args.dry_run)
        write_json(tier_path, build_tier(en, ch, kind, classes, t1_key, hide_key), args.dry_run)
        created += 1
        tag = " [class]" if kind == "class" else (" [ruthless-excluded]" if ruthless else "")
        print(f"  + {path}  ({en} / {ch}){tag}")

    print(f"\nDone. {created} pairs created, {skipped} skipped (already existed).")
    if args.dry_run:
        print("[DRY RUN] nothing written.")


if __name__ == "__main__":
    main()
