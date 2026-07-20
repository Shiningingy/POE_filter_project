# Campaign v5 seeder — rebuilds _campaign as SEVEN categories (user's split,
# 2026-07-19: "weapon progression, armour progression, jewellery progression,
# flask progression, links highlight, early game highlight" + the safety-net/
# declutter tail that must emit last):
#
#   10 Weapon Progression.json   16 class tiers, bands as per-tier RULES
#   20 Armour Progression.json   6 defense tiers (+rules) + Noteworthy + Boots
#   30 Jewellery Progression.json  sound-first jewellery tiers
#   40 Flask Progression.json    flasks + tinctures
#   50 Links Highlight.json      4L (to Act 5) / 3L (to Act 3)
#   60 Early Game Highlight.json act-1 whites (carried)
#   70 Safety Net.json           T3 rare net + aggressive magic hide (LAST)
#
# The numeric filename prefix pins cross-file emission order (generators walk
# base_mapping paths alphabetically, _campaign first; filters are
# first-match-wins): bands before links, everything before the net/declutter.
# Nav labels come from category_structure localization — numbers never show.
#
# LADDER v5 (selection-centric, user 2026-07-19): per class/defense TWO layers
# that emit ONLY when picked — "X Progression" (T1, band rules with AreaLevel
# windows) and "X Rares" (T2, class-wide rare catch). Unpicked groups fall to
# the T3 safety net. No boost mechanism.
# Every emitting tier AND band rule MUST be AreaLevel-guarded (<= 67).
#
# ⚠ ONE-SHOT: reads carried categories from the v4 tree, then wipes _campaign
#   and writes v5. Do not re-run after hand-tuning.

import csv
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "filter_generation" / "data"
CSV_PATH = ROOT / "data" / "from_filter_blade" / "3.28" / "BaseTypes.csv"
TIER_DIR = DATA / "tier_definition" / "_campaign"
MAP_DIR = DATA / "base_mapping" / "_campaign"
STRUCT_PATH = DATA / "category_structure.json"

# ---------------------------------------------------------------- constants

# (label, droplevel lo, droplevel hi, band Rarity, band AreaLevel cutoff)
BANDS = [
    ("Early",      1, 33, "Magic Rare", 33),
    ("Mid",       34, 45, "Rare",       50),
    ("Late",      46, 55, "Rare",       60),
    ("PreEndgame", 56, 67, "Rare",      67),
]
BAND_COMMENT = {
    "Early": "Early band (Acts 1-3, magic+rare)",
    "Mid": "Mid band (to Act 5)",
    "Late": "Late band (to Act 8)",
    "PreEndgame": "Pre-endgame band",
}
# Localized rule names: rule.localization[lang] -> comment (canonical en) -> "Rule"
BAND_COMMENT_CH = {
    "Early": "早期（1–3章，魔法+稀有）",
    "Mid": "中期（至第五章）",
    "Late": "后期（至第八章）",
    "PreEndgame": "终局前",
}
CAMPAIGN_CAP = 67

WEAPON_CLASSES = [
    "Bows", "Claws", "Daggers", "One Hand Axes", "One Hand Maces",
    "One Hand Swords", "Thrusting One Hand Swords", "Quivers", "Rune Daggers",
    "Sceptres", "Staves", "Two Hand Axes", "Two Hand Maces", "Two Hand Swords",
    "Wands", "Warstaves",
]
CASTER_CLASSES = {"Wands", "Sceptres", "Rune Daggers"}
ARMOUR_CLASSES = ["Body Armours", "Boots", "Gloves", "Helmets", "Shields"]
JEWELLERY_CLASSES = ["Amulets", "Belts", "Rings"]
DEFENSE_KEYS = ["Armour", "AR/EV", "Evasion", "EV/ES", "Energy Shield", "AR/ES"]
GOOD_JEWELLERY = ["Ruby Ring", "Sapphire Ring", "Topaz Ring", "Two-Stone Ring"]
FRONTIER_TOLERANCE = 0.97
CLASS_LIST_EQUIPMENT = WEAPON_CLASSES + ARMOUR_CLASSES

CLASS_CH = {
    "Bows": "弓", "Claws": "爪", "Daggers": "匕首", "One Hand Axes": "单手斧",
    "One Hand Maces": "单手锤", "One Hand Swords": "单手剑",
    "Thrusting One Hand Swords": "细剑", "Quivers": "箭袋", "Rune Daggers": "符文匕首",
    "Sceptres": "短杖", "Staves": "长杖", "Two Hand Axes": "双手斧",
    "Two Hand Maces": "双手锤", "Two Hand Swords": "双手剑", "Wands": "法杖",
    "Warstaves": "战杖",
}
DEFENSE_CH = {
    "Armour": "护甲", "AR/EV": "护甲/闪避", "Evasion": "闪避",
    "EV/ES": "闪避/能量护盾", "Energy Shield": "能量护盾", "AR/ES": "护甲/能量护盾",
}

# v4 carry sources (what the previous seeder wrote)
V4_ARMOUR = "20 Armour Progression.json"
V4_FLASKS = "40 Flask Progression.json"
V4_EARLY = "60 Early Game Highlight.json"


def with_ilvl(cond):
    """Add ItemLevel <= (AreaLevel+5) after a simple 'AreaLevel <= N' — genuine
    on-level drops match, endgame-ilvl gear in a campaign zone doesn't (user
    rule 2026-07-20). No-op on RANGE / missing AreaLevel / existing ItemLevel."""
    import re as _re
    if "ItemLevel" in cond:
        return cond
    al = cond.get("AreaLevel")
    m = _re.match(r"^<=\s*(\d+)$", al.strip()) if isinstance(al, str) else None
    if not m:
        return cond
    out = {}
    for k, v in cond.items():
        out[k] = v
        if k == "AreaLevel":
            out["ItemLevel"] = f"<= {int(m.group(1)) + 5}"
    return out


def class_cond(classes):
    return "== " + " ".join(f'"{c}"' for c in classes)


def sound(default_id=-1):
    return {"default_sound_id": default_id, "sharket_sound_id": None}


# ---------------------------------------------------------------- CSV load

def load_bases():
    by_class = {}
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            cls = row["Class"]
            if cls not in WEAPON_CLASSES and cls not in ARMOUR_CLASSES:
                continue
            if (row.get("SubGroup A") or "defa") != "defa":
                continue  # league-only bases don't world-drop
            try:
                dl = int(row["DropLevel"] or 0)
            except ValueError:
                continue
            if dl < 1 or dl > CAMPAIGN_CAP:
                continue
            try:
                dps = float(row.get("Game:DPS") or 0)
            except ValueError:
                dps = 0.0
            implicit = f'{row.get("Game:Implicit 1") or ""} {row.get("Game:Implicit 2") or ""}'.strip()

            def num(col):
                try:
                    return float(row.get(col) or 0)
                except ValueError:
                    return 0.0
            def_key = None
            if cls in ARMOUR_CLASSES:
                combo = (num("Game:Armour") > 0, num("Game:Evasion") > 0,
                         num("Game:Energy Shield") > 0)
                def_key = {
                    (True, False, False): "Armour",
                    (False, True, False): "Evasion",
                    (False, False, True): "Energy Shield",
                    (True, True, False): "AR/EV",
                    (True, False, True): "AR/ES",
                    (False, True, True): "EV/ES",
                }.get(combo)
                if def_key is None:
                    continue
            by_class.setdefault(cls, []).append(
                {"name": row["BaseType"], "droplevel": dl, "dps": dps,
                 "implicit": implicit, "def_key": def_key})
    return by_class


def band_of(droplevel):
    for label, lo, hi, rarity, cutoff in BANDS:
        if lo <= droplevel <= hi:
            return label
    return None


def preferred_weapons(cls, all_bases):
    """Casters keep the flat-added implicit lineage; attack classes keep the DPS
    upgrade frontier (a base that ~beats everything before it)."""
    ordered = sorted(all_bases, key=lambda b: (b["droplevel"], -b["dps"]))
    if cls in CASTER_CLASSES:
        picks = [b for b in ordered
                 if "Adds " in b["implicit"] and "Cannot Roll Caster" not in b["implicit"]]
    else:
        picks, best = [], 0.0
        for b in ordered:
            if best == 0.0 or b["dps"] >= FRONTIER_TOLERANCE * best:
                picks.append(b)
                best = max(best, b["dps"])
    return picks or ordered


# ---------------------------------------------------------------- builders

def progression_tier(en_name, ch_name, axis, key):
    """The T1 layer: band rules (level-matched good bases) ride on this tier;
    tier conditions guard the fallback base block (bases dragged in but not yet
    in a band rule). Emits only when its lv_group key is picked."""
    return {
        "_lv": True,
        "hideable": True,
        "conditions": with_ilvl({"Rarity": "Rare", "AreaLevel": f"<= {CAMPAIGN_CAP}"}),
        "theme": {"Tier": 2},  # T1 double emphasis (picked + level match)
        "sound": sound(),
        "lv_group": {"axis": axis, "key": key},
        "localization": {"en": en_name, "ch": ch_name},
    }


def rares_tier(en_name, ch_name, axis, key, conditions):
    """The T2 layer: class-wide rare catch for a PICKED group — off-window or
    non-preferred bases of the user's chosen classes. Emits only when picked."""
    return {
        "_lv": True,
        "hideable": True,
        "class_condition": True,
        "conditions": with_ilvl(conditions),
        "theme": {"Tier": 4},  # T2 emphasis (picked, not level-matched)
        "sound": sound(),
        "lv_group": {"axis": axis, "key": key},
        "localization": {"en": en_name, "ch": ch_name},
    }


def band_rules(bases_by_band):
    rules = []
    for label, lo, hi, rarity, cutoff in BANDS:
        bases = bases_by_band.get(label, [])
        if not bases:
            continue
        rules.append({
            "targets": [b["name"] for b in sorted(bases, key=lambda x: x["droplevel"])],
            "conditions": with_ilvl({"Rarity": rarity, "AreaLevel": f"<= {cutoff}"}),
            "overrides": {},
            "comment": BAND_COMMENT[label],
            "localization": {"ch": BAND_COMMENT_CH[label]},
        })
    return rules


def cc_tier(en, ch, conditions, theme_tier, snd=None, lv=None):
    return {
        "_lv": True, "hideable": True, "class_condition": True,
        "conditions": with_ilvl(conditions) if (lv or {}).get("axis") != "aggressive" else conditions,
        "theme": {"Tier": theme_tier},
        "sound": snd or sound(),
        "lv_group": lv or {"axis": "always", "key": "campaign"},
        "localization": {"en": en, "ch": ch},
    }


def load_v3(rel):
    tier_doc = json.loads((TIER_DIR / rel).read_text(encoding="utf-8"))
    map_path = MAP_DIR / rel
    map_doc = json.loads(map_path.read_text(encoding="utf-8")) if map_path.exists() else {"_meta": {}, "mapping": {}}
    cat_key = next(k for k in tier_doc if not k.startswith("//"))
    return tier_doc[cat_key], map_doc


def guard(tier):
    cond = tier.get("conditions")
    if isinstance(cond, dict) and "AreaLevel" not in cond:
        cond["AreaLevel"] = f"<= {CAMPAIGN_CAP}"
    return tier


# ---------------------------------------------------------------- main build

def main():
    bases = load_bases()
    v4_armour, _ = load_v3(V4_ARMOUR)
    v4_flasks, v4_flasks_map = load_v3(V4_FLASKS)
    v4_early, _ = load_v3(V4_EARLY)

    files = []  # (filename, category_key, meta_extra, tiers, mapping, rules, nav en, nav ch)

    # ---- 10 Weapon Progression ----
    w_tiers, w_map, w_rules = {}, {}, []
    for cls in WEAPON_CLASSES:
        by_band = {}
        for b in preferred_weapons(cls, bases.get(cls, [])):
            lbl = band_of(b["droplevel"])
            if lbl:
                by_band.setdefault(lbl, []).append(b)
        t_key = f"{cls} Progression"
        w_tiers[t_key] = progression_tier(
            f"{cls} Progression", f"{CLASS_CH.get(cls, cls)}高亮（匹配进度）", "weapon", cls)
        for band in by_band.values():
            for b in band:
                w_map[b["name"]] = t_key
        w_rules.extend(band_rules(by_band))
        w_tiers[f"{cls} Rares"] = rares_tier(
            f"{cls} Rares", f"{CLASS_CH.get(cls, cls)}稀有突显", "weapon", cls,
            {"Class": class_cond([cls]), "Rarity": "Rare",
             "AreaLevel": f"<= {CAMPAIGN_CAP}"})
    files.append(("10 Weapon Progression.json", "Weapon Progression",
                  {"en": "Weapons", "ch": "武器"}, w_tiers, w_map, w_rules,
                  "Weapon Progression", "武器进度"))

    # ---- 20 Armour Progression (defense tiers + Noteworthy + Boots Highlight) ----
    a_tiers, a_map, a_rules = {}, {}, []
    armour_by_def = {}
    for cls in ARMOUR_CLASSES:
        for b in bases.get(cls, []):
            armour_by_def.setdefault(b["def_key"], []).append(b)
    for def_key in DEFENSE_KEYS:
        by_band = {}
        for b in armour_by_def.get(def_key, []):
            lbl = band_of(b["droplevel"])
            if lbl:
                by_band.setdefault(lbl, []).append(b)
        t_key = f"{def_key} Progression"
        a_tiers[t_key] = progression_tier(
            f"{def_key} Progression", f"{DEFENSE_CH.get(def_key, def_key)}高亮（匹配进度）",
            "armour", def_key)
        for band in by_band.values():
            for b in band:
                a_map[b["name"]] = t_key
        a_rules.extend(band_rules(by_band))
        all_def_bases = sorted(b["name"] for b in armour_by_def.get(def_key, []))
        if all_def_bases:
            a_tiers[f"{def_key} Rares"] = rares_tier(
                f"{def_key} Rares", f"{DEFENSE_CH.get(def_key, def_key)}稀有突显",
                "armour", def_key,
                {"BaseType": class_cond(all_def_bases), "Rarity": "Rare",
                 "AreaLevel": f"<= {CAMPAIGN_CAP}"})
    # Movement-boot MS progression (affix->% confirmed via PoEDB): the minimum MS
    # bar rises per act; 25%+ always highlights; fall-behinds drop to the safety
    # net. HasExplicitMod needs an IDENTIFIED item, so a separate unidentified
    # catch prompts the player to ID rare boots.
    def mboot(en, ch, mods, area, theme):
        return cc_tier(en, ch, {
            "Class": '== "Boots"', "Rarity": "Magic Rare", "Identified": "True",
            "HasExplicitMod": " ".join(f'"{m}"' for m in mods),
            "AreaLevel": f"<= {area}", "ItemLevel": f"<= {area + 5}",
        }, theme, snd=sound(2))
    a_tiers["Movement Boots 25%+"] = mboot(
        "Movement Boots 25%+ MS", "移速鞋 25%+", ["Gazelle's", "Cheetah's", "Hellion's"], 67, 2)
    a_tiers["Movement Boots 20% Act3"] = mboot(
        "Movement Boots 20% (to Act 3)", "移速鞋 20%（至第三章）", ["Stallion's"], 33, 4)
    a_tiers["Movement Boots 15% Act2"] = mboot(
        "Movement Boots 15% (to Act 2)", "移速鞋 15%（至第二章）", ["Sprinter's"], 23, 4)
    a_tiers["Movement Boots 10% Act1"] = mboot(
        "Movement Boots 10% (Act 1)", "移速鞋 10%（第一章）", ["Runner's"], 13, 4)
    a_tiers["Veiled Uniques"] = cc_tier(
        "Veiled Uniques", "隐秘传奇",
        {"Rarity": "Unique", "Identified": "True", "HasExplicitMod": '"Veil"',
         "AreaLevel": f"<= {CAMPAIGN_CAP}"}, 2, snd=sound(2))
    a_tiers["Boots Highlight (Unidentified)"] = cc_tier(
        "Unidentified Rare Boots", "未鉴定稀有鞋子",
        {"Class": '== "Boots"', "Rarity": "Rare", "Identified": "False",
         "AreaLevel": f"<= {CAMPAIGN_CAP}"}, 4)
    # Emission order (specific -> general): the boot-specific tiers must precede
    # the general defense "X Rares" (which also match boot bases), so a high-MS
    # or veiled boot renders by its specific tier, not the generic rare catch.
    boot_block = ["Veiled Uniques", "Movement Boots 25%+", "Movement Boots 20% Act3",
                  "Movement Boots 15% Act2", "Movement Boots 10% Act1",
                  "Boots Highlight (Unidentified)"]
    a_tiers = {**{k: a_tiers[k] for k in boot_block},
               **{k: v for k, v in a_tiers.items() if k not in boot_block}}
    files.append(("20 Armour Progression.json", "Armour Progression",
                  {"en": "Armour", "ch": "防具"}, a_tiers, a_map, a_rules,
                  "Armour Progression", "防具进度"))

    # ---- 30 Jewellery Progression ----
    good_bt = class_cond(GOOD_JEWELLERY)
    j_tiers = {
        "Jewellery Good Rare": cc_tier(
            "Good Base (Rare)", "优质底子（稀有）",
            {"BaseType": good_bt, "Rarity": "Rare", "AreaLevel": f"<= {CAMPAIGN_CAP}"},
            4, sound(2)),
        "Jewellery Good LowRarity": cc_tier(
            "Good Base (Normal/Magic)", "优质底子（普/魔）",
            {"BaseType": good_bt, "Rarity": "Normal Magic", "AreaLevel": f"<= {CAMPAIGN_CAP}"},
            7, sound(2)),
        "Jewellery Any Rare": cc_tier(
            "Any Rare Jewellery", "稀有首饰",
            {"Class": class_cond(JEWELLERY_CLASSES), "Rarity": "Rare",
             "AreaLevel": f"<= {CAMPAIGN_CAP}"}, 6, sound(2)),
    }
    files.append(("30 Jewellery Progression.json", "Jewellery Progression",
                  {"en": "Jewellery", "ch": "首饰"}, j_tiers, {}, [],
                  "Jewellery Progression", "首饰过渡"))

    # ---- 40 Flask Progression (carried whole from v3, tinctures already merged) ----
    f_tiers = {name: guard(tv) for name, tv in v4_flasks.items()
               if name != "_meta" and isinstance(tv, dict)}
    files.append(("40 Flask Progression.json", "Flask Progression",
                  {"en": "Flasks", "ch": "药剂"}, f_tiers,
                  v4_flasks_map.get("mapping", {}), v4_flasks_map.get("rules", []),
                  "Flask Progression", "药剂过渡"))

    # ---- 50 Links Highlight ----
    l_tiers = {
        "Camp 4-Link": cc_tier(
            "4-Link (until Act 5)", "四连（至第五章）",
            {"Class": class_cond(CLASS_LIST_EQUIPMENT), "LinkedSockets": ">= 4",
             "Rarity": "<= Rare", "AreaLevel": "<= 45"}, 2),
        "Camp 3-Link": cc_tier(
            "3-Link (until Act 3)", "三连（至第三章）",
            {"Class": class_cond(CLASS_LIST_EQUIPMENT), "LinkedSockets": ">= 3",
             "Rarity": "<= Rare", "AreaLevel": "<= 33"}, 3),
    }
    files.append(("50 Links Highlight.json", "Links Highlight",
                  {"en": "Linked Gear", "ch": "连接装备"}, l_tiers, {}, [],
                  "Links Highlight", "连接突显"))

    # ---- 60 Early Game Highlight (act-1 whites carried from v3) ----
    e_tiers = {name: guard(tv) for name, tv in v4_early.items()
               if name != "_meta" and isinstance(tv, dict)}
    files.append(("60 Early Game Highlight.json", "Early Game Highlight",
                  {"en": "Equipment", "ch": "装备"}, e_tiers, {}, [],
                  "Early Game Highlight", "早期突显"))

    # ---- 70 Safety Net (must emit LAST: T3 net + aggressive declutter) ----
    s_tiers = {
        "Rare Safety Net": cc_tier(
            "Rare Safety Net", "稀有保底",
            {"Class": class_cond(CLASS_LIST_EQUIPMENT), "Rarity": "Rare",
             "AreaLevel": f"<= {CAMPAIGN_CAP}"}, 6),
        "Aggressive Magic Hide": cc_tier(
            "Hide Magic after Act 3", "隐藏魔法（三章后）",
            {"Class": class_cond(CLASS_LIST_EQUIPMENT + JEWELLERY_CLASSES),
             "Rarity": "Magic", "AreaLevel": "RANGE >= 34 <= 67"},
            9, lv={"axis": "aggressive"}),
    }
    files.append(("70 Safety Net.json", "Campaign Safety Net",
                  {"en": "Equipment", "ch": "装备"}, s_tiers, {}, [],
                  "Safety Net & Declutter", "保底与清理"))

    # ---- wipe v3, write v4 ----
    for root in (TIER_DIR, MAP_DIR):
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(parents=True)

    for fname, cat_key, item_class, tiers, mapping, rules, nav_en, nav_ch in files:
        meta = {
            "item_class": item_class,
            "localization": {"en": nav_en, "ch": nav_ch},
            "theme_category": "Campaign",
            "tier_order": list(tiers.keys()),
        }
        tier_doc = {cat_key: {"_meta": meta, **tiers}}
        (TIER_DIR / fname).write_text(
            json.dumps(tier_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        # gen_order -100: campaign emits FIRST (decoupled from nav display order).
        map_meta = {"gen_order": -100,
                    **{k: v for k, v in meta.items() if k != "tier_order"}}
        map_doc = {"_meta": map_meta, "mapping": mapping}
        if rules:
            map_doc["rules"] = rules
        (MAP_DIR / fname).write_text(
            json.dumps(map_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # ---- category_structure: Campaign chapter -> one group, seven entries ----
    struct = json.loads(STRUCT_PATH.read_text(encoding="utf-8"))
    cats = struct["categories"]
    sep_idx = next(i for i, c in enumerate(cats)
                   if c.get("separator", {}).get("en") == "Campaign")
    end_idx = next(i for i in range(sep_idx + 1, len(cats)) if "separator" in cats[i])

    entries = []
    for fname, cat_key, item_class, tiers, mapping, rules, nav_en, nav_ch in files:
        entries.append({
            "path": f"_campaign/{fname}",
            "tier_path": f"tier_definition/_campaign/{fname}",
            "mapping_path": f"base_mapping/_campaign/{fname}",
            "target_category": cat_key,
            "localization": {"en": nav_en, "ch": nav_ch},
        })
    # One single-file group per entry -> each renders as a flat top-level nav
    # item under the Campaign separator (Sidebar.isFlat), no redundant wrapper.
    new_groups = [{"_meta": {"localization": dict(e["localization"])}, "files": [e]}
                  for e in entries]
    struct["categories"] = cats[:sep_idx + 1] + new_groups + cats[end_idx:]
    STRUCT_PATH.write_text(json.dumps(struct, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for fname, cat_key, _, tiers, mapping, rules, _, _ in files:
        print(f"  {fname:34s} {len(tiers):3d} tiers, {len(mapping):3d} bases, {len(rules):2d} rules")
    print("[OK] campaign v5 written (7 categories, selection-centric ladder).")
    print("[NOTE] hand-tune from here; do NOT re-run over tuned data.")


if __name__ == "__main__":
    sys.exit(main())
