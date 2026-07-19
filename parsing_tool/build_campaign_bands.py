# Campaign v2 seeder — rebuilds the _campaign tree as the additive T1/T2/T3 module
# (see plan "Campaign v2 — additive re-categorization"). Reads FilterBlade's
# BaseTypes.csv to generate level-banded preferred-base tiers for weapons and
# defense-typed armour, carries the hand-tuned categories (Flasks, Tinctures,
# Act 1, Noteworthy) with AreaLevel guards normalized, and rewrites the Campaign
# chapter of category_structure.json.
#
# Folder numbers control EMISSION ORDER (generators sort _campaign first, then
# paths alphabetically; first-match-wins in PoE): bands must precede nets, and
# the aggressive declutter must come last.
#
# ⚠ ONE-SHOT: output is meant to be hand-tuned afterward. Re-running OVERWRITES
#   the _campaign tree — do not re-run after tuning without a backup/commit.

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

# AreaLevel bands: (label, droplevel lo, droplevel hi, Rarity condition, area cutoff).
# Early allows magic+rare (user: "magic on-level bases stay until act 3"); later
# bands are rare-only. Cutoff = how long a band's bases stay lit (drops self-gate
# at the bottom: an area can never drop a base above its level).
BANDS = [
    ("Early",      1, 33, "Magic Rare", 33),
    ("Mid",       34, 45, "Rare",       50),
    ("Late",      46, 55, "Rare",       60),
    ("PreEndgame", 56, 67, "Rare",      67),
]
CAMPAIGN_CAP = 67  # every campaign tier must be inert past this AreaLevel

WEAPON_CLASSES = [
    "Bows", "Claws", "Daggers", "One Hand Axes", "One Hand Maces",
    "One Hand Swords", "Thrusting One Hand Swords", "Quivers", "Rune Daggers",
    "Sceptres", "Staves", "Two Hand Axes", "Two Hand Maces", "Two Hand Swords",
    "Wands", "Warstaves",
]
# Base-insensitivity is NOT binary (user): casters rank by implicit family
# (flat "Adds ..." lineages beat %-increases), attack classes rank by DPS.
CASTER_CLASSES = {"Wands", "Sceptres", "Rune Daggers"}
ARMOUR_CLASSES = ["Body Armours", "Boots", "Gloves", "Helmets", "Shields"]
JEWELLERY_CLASSES = ["Amulets", "Belts", "Rings"]

# Defense-type keys (= picker toggles / lv_group keys). Filenames avoid '/'.
DEFENSE_KEYS = {          # key -> filename stem
    "Armour": "Armour",
    "AR/EV": "AR-EV",
    "Evasion": "Evasion",
    "EV/ES": "EV-ES",
    "Energy Shield": "Energy Shield",
    "AR/ES": "AR-ES",
}

# Good jewellery bases (seed list — user curates; res capping wins campaigns).
GOOD_JEWELLERY = ["Ruby Ring", "Sapphire Ring", "Topaz Ring", "Two-Stone Ring"]

FRONTIER_TOLERANCE = 0.97  # keep a base if DPS >= tol * best-so-far (upgrade frontier)

# zh names for the two weapon classes the old tree didn't have files for.
EXTRA_CLASS_CH = {"Thrusting One Hand Swords": "细剑", "Quivers": "箭袋"}

CLASS_LIST_EQUIPMENT = WEAPON_CLASSES + ARMOUR_CLASSES  # for the nets


def class_cond(classes):
    return "== " + " ".join(f'"{c}"' for c in classes)


def sound(default_id=-1):
    return {"default_sound_id": default_id, "sharket_sound_id": None}


# ---------------------------------------------------------------- CSV load

def load_bases():
    """-> {class: [ {name, droplevel, dps, implicit, def_key} ]} (world-drop bases only)."""
    by_class = {}
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            cls = row["Class"]
            if cls not in WEAPON_CLASSES and cls not in ARMOUR_CLASSES:
                continue
            if (row.get("SubGroup A") or "defa") != "defa":
                continue  # league-only bases (heist/expedition) don't world-drop
            try:
                dl = int(row["DropLevel"] or 0)
            except ValueError:
                continue
            if dl < 1 or dl > CAMPAIGN_CAP:
                continue  # endgame-only bases are not campaign content
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
            ar, ev, es = num("Game:Armour"), num("Game:Evasion"), num("Game:Energy Shield")
            def_key = None
            if cls in ARMOUR_CLASSES:
                combo = (ar > 0, ev > 0, es > 0)
                def_key = {
                    (True, False, False): "Armour",
                    (False, True, False): "Evasion",
                    (False, False, True): "Energy Shield",
                    (True, True, False): "AR/EV",
                    (True, False, True): "AR/ES",
                    (False, True, True): "EV/ES",
                }.get(combo)  # none / all-three (StrDexInt, Demigod) -> skip
                if def_key is None:
                    continue
            by_class.setdefault(cls, []).append(
                {"name": row["BaseType"], "droplevel": dl, "dps": dps,
                 "implicit": implicit, "def_key": def_key})
    return by_class


def band_of(droplevel):
    for label, lo, hi, rarity, cutoff in BANDS:
        if lo <= droplevel <= hi:
            return label, rarity, cutoff
    return None


def preferred_weapons(cls, all_bases):
    """The class's highlight-worthy bases across the whole campaign. Casters
    prefer flat-added implicit lineages (never 'Cannot Roll Caster Modifiers'
    attack bases). Attack classes keep the DPS *upgrade frontier*: walking bases
    by DropLevel, a base is preferred when it (nearly) beats every earlier base —
    an on-level drop that's an actual upgrade. Empty preference -> keep all."""
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


# ---------------------------------------------------------------- tier builders

def band_tier(cat_en, band_label, rarity, cutoff, axis, key, extra_conditions=None):
    """A T2 band tier (boostable to T1 when its lv_group key is picked)."""
    cond = {"Rarity": rarity, "AreaLevel": f"<= {cutoff}"}
    if extra_conditions:
        cond.update(extra_conditions)
    return {
        "_lv": True,
        "hideable": True,
        "conditions": cond,
        "theme": {"Tier": 4},        # T2: emphasis (border-only band)
        "boost_theme": {"Tier": 2},  # T1: double emphasis when picked
        "sound": sound(),
        "lv_group": {"axis": axis, "key": key},
        "localization": {"en": f"{cat_en} {band_label}",
                         "ch": {"Early": "早期", "Mid": "中期", "Late": "后期",
                                "PreEndgame": "终局前"}.get(band_label, band_label)},
    }


def write_category(tier_rel, category_key, meta, tiers, mapping=None, map_meta=None):
    """Write tier_definition + base_mapping files for one category."""
    tier_path = TIER_DIR / tier_rel
    map_path = MAP_DIR / tier_rel
    tier_path.parent.mkdir(parents=True, exist_ok=True)
    map_path.parent.mkdir(parents=True, exist_ok=True)

    tier_doc = {category_key: {"_meta": dict(meta), **tiers}}
    tier_doc[category_key]["_meta"]["tier_order"] = list(tiers.keys())
    tier_path.write_text(json.dumps(tier_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    map_doc = {"_meta": dict(map_meta or meta), "mapping": mapping or {}}
    map_path.write_text(json.dumps(map_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- carry-overs

def normalize_guard(tier):
    """Campaign-first means every emitting tier MUST go inert past the cap."""
    cond = tier.get("conditions")
    if isinstance(cond, dict) and "AreaLevel" not in cond:
        cond["AreaLevel"] = f"<= {CAMPAIGN_CAP}"
    return tier


def carry(old_rel, new_rel, drop_tiers=(), old_map_rel=None):
    """Move a hand-tuned category to its new numbered home, dropping placeholder
    tiers and normalizing AreaLevel guards. Reads from the ORIGINAL tree (must
    run before cleanup)."""
    old_tier = json.loads((TIER_DIR / old_rel).read_text(encoding="utf-8"))
    old_map_path = MAP_DIR / (old_map_rel or old_rel)
    old_map = json.loads(old_map_path.read_text(encoding="utf-8")) if old_map_path.exists() else {"_meta": {}, "mapping": {}}

    cat_key = next(k for k in old_tier if not k.startswith("//"))
    cat = old_tier[cat_key]
    meta = cat.get("_meta", {})
    tiers = {}
    for name, tv in cat.items():
        if name == "_meta" or not isinstance(tv, dict) or name in drop_tiers:
            continue
        tiers[name] = normalize_guard(tv)
    mapping = {k: v for k, v in old_map.get("mapping", {}).items()
               if (v if isinstance(v, str) else None) in tiers or isinstance(v, list)}
    write_category(new_rel, cat_key, meta, tiers, mapping, old_map.get("_meta"))
    return cat_key


# ---------------------------------------------------------------- main build

def main():
    bases = load_bases()
    missing = [c for c in WEAPON_CLASSES + ARMOUR_CLASSES if c not in bases]
    if missing:
        print(f"[WARN] classes with no CSV bases: {missing}")

    # Old-tree metadata we want to keep (zh class names from the v1 files).
    old_weapon_meta = {}
    for cls in WEAPON_CLASSES:
        p = MAP_DIR / "Weapons" / f"{cls}.json"
        if p.exists():
            old_weapon_meta[cls] = json.loads(p.read_text(encoding="utf-8")).get("_meta", {})

    # Carry hand-tuned categories FIRST (reads the old tree).
    carried = []
    carried.append(carry("Rare/Noteworthy.json", "30_Special/Noteworthy.json",
                         drop_tiers=("Special Noteworthy Drops T1", "Special Noteworthy Drops Hide")))
    carried.append(carry("Flasks.json", "50_Consumables/Flasks.json",
                         drop_tiers=("Camp Flask Quality",)))  # glassblower recipe: retired for Ruthless
    carried.append(carry("Tinctures.json", "50_Consumables/Tinctures.json",
                         drop_tiers=("Tinctures T1", "Tinctures Hide")))
    carried.append(carry("Act/Act 1.json", "70_Act1/Act 1.json",
                         drop_tiers=("Act 1 T1", "Act 1 Hide")))

    staged = []  # (rel, category_key, meta, tiers, mapping, map_meta) written after cleanup

    # ---- 10_Weapons: level-banded preferred-base tiers, one file per class ----
    for cls in WEAPON_CLASSES:
        by_band = {}
        for b in preferred_weapons(cls, bases.get(cls, [])):
            hit = band_of(b["droplevel"])
            if hit:
                by_band.setdefault(hit[0], []).append(b)

        cat_en = f"Campaign {cls}"
        old_meta = old_weapon_meta.get(cls, {})
        ch_class = old_meta.get("item_class", {}).get("ch") or EXTRA_CLASS_CH.get(cls, cls)
        ch_cat = old_meta.get("localization", {}).get("ch") or f"过渡{ch_class}"
        meta = {
            "item_class": {"en": cls, "ch": ch_class},
            "localization": {"en": cat_en, "ch": ch_cat},
            "theme_category": "Campaign",
        }
        tiers, mapping = {}, {}
        for label, lo, hi, rarity, cutoff in BANDS:
            picks = by_band.get(label, [])
            if not picks:
                continue
            t_name = f"Camp {cls} {label}"
            tiers[t_name] = band_tier(cat_en, label, rarity, cutoff, "weapon", cls)
            for b in sorted(picks, key=lambda x: x["droplevel"]):
                mapping[b["name"]] = t_name
        staged.append((f"10_Weapons/{cls}.json", cat_en, meta, tiers, mapping, meta))

    # ---- 20_Armour: defense-typed banded tiers (all slots incl. boots/shields) ----
    armour_by_def = {}
    for cls in ARMOUR_CLASSES:
        for b in bases.get(cls, []):
            armour_by_def.setdefault(b["def_key"], []).append(b)
    for def_key, stem in DEFENSE_KEYS.items():
        def_bases = armour_by_def.get(def_key, [])
        cat_en = f"Campaign {def_key}"
        meta = {
            "item_class": {"en": "Armour", "ch": "防具"},
            "localization": {"en": cat_en, "ch": f"过渡防具 {def_key}"},
            "theme_category": "Campaign",
        }
        tiers, mapping = {}, {}
        for label, lo, hi, rarity, cutoff in BANDS:
            band_bases = [b for b in def_bases if band_of(b["droplevel"]) and band_of(b["droplevel"])[0] == label]
            if not band_bases:
                continue
            t_name = f"Camp {stem} {label}"
            tiers[t_name] = band_tier(cat_en, label, rarity, cutoff, "armour", def_key)
            for b in sorted(band_bases, key=lambda x: x["droplevel"]):
                mapping[b["name"]] = t_name
        staged.append((f"20_Armour/{stem}.json", cat_en, meta, tiers, mapping, meta))

    # ---- 40_Nets: boots always-highlight + sound-first jewellery ----
    boots_meta = {"item_class": {"en": "Boots", "ch": "鞋子"},
                  "localization": {"en": "Campaign Boots", "ch": "过渡鞋子"},
                  "theme_category": "Campaign"}
    boots_tiers = {
        "Camp Boots Any Rare": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"Class": class_cond(["Boots"]), "Rarity": "Rare",
                           "AreaLevel": f"<= {CAMPAIGN_CAP}"},
            "theme": {"Tier": 4},  # T2 by default: movement speed is huge
            "sound": sound(),
            "lv_group": {"axis": "always", "key": "boots"},
            "localization": {"en": "Any Rare Boots", "ch": "稀有鞋子"},
        },
    }
    staged.append(("40_Nets/Boots.json", "Campaign Boots", boots_meta, boots_tiers, {}, boots_meta))

    jew_meta = {"item_class": {"en": "Jewellery", "ch": "首饰"},
                "localization": {"en": "Campaign Jewellery", "ch": "过渡首饰"},
                "theme_category": "Campaign"}
    good_bt = class_cond(GOOD_JEWELLERY)
    jew_tiers = {
        "Camp Jewellery Good Rare": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"BaseType": good_bt, "Rarity": "Rare",
                           "AreaLevel": f"<= {CAMPAIGN_CAP}"},
            "theme": {"Tier": 4}, "sound": sound(2),  # emphasis + voice
            "lv_group": {"axis": "always", "key": "jewellery"},
            "localization": {"en": "Good Base (Rare)", "ch": "优质底子（稀有）"},
        },
        "Camp Jewellery Good LowRarity": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"BaseType": good_bt, "Rarity": "Normal Magic",
                           "AreaLevel": f"<= {CAMPAIGN_CAP}"},
            "theme": {"Tier": 7}, "sound": sound(2),  # voice only
            "lv_group": {"axis": "always", "key": "jewellery"},
            "localization": {"en": "Good Base (Normal/Magic)", "ch": "优质底子（普通/魔法）"},
        },
        "Camp Jewellery Any Rare": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"Class": class_cond(JEWELLERY_CLASSES), "Rarity": "Rare",
                           "AreaLevel": f"<= {CAMPAIGN_CAP}"},
            "theme": {"Tier": 6}, "sound": sound(2),  # T3 visuals + voice
            "lv_group": {"axis": "always", "key": "jewellery"},
            "localization": {"en": "Any Rare Jewellery", "ch": "稀有首饰"},
        },
    }
    staged.append(("40_Nets/Jewellery.json", "Campaign Jewellery", jew_meta, jew_tiers, {}, jew_meta))

    # ---- 60_Links: 4-link until act 5, 3-link until act 3 (any rarity <= Rare) ----
    links_meta = {"item_class": {"en": "Linked Gear", "ch": "连接装备"},
                  "localization": {"en": "Campaign Links", "ch": "过渡连接"},
                  "theme_category": "Campaign"}
    links_tiers = {
        "Camp 4-Link": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"Class": class_cond(CLASS_LIST_EQUIPMENT), "LinkedSockets": ">= 4",
                           "Rarity": "<= Rare", "AreaLevel": "<= 45"},
            "theme": {"Tier": 2}, "sound": sound(),
            "lv_group": {"axis": "always", "key": "links"},
            "localization": {"en": "4-Link (until Act 5)", "ch": "四连（至第五章）"},
        },
        "Camp 3-Link": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"Class": class_cond(CLASS_LIST_EQUIPMENT), "LinkedSockets": ">= 3",
                           "Rarity": "<= Rare", "AreaLevel": "<= 33"},
            "theme": {"Tier": 3}, "sound": sound(),
            "lv_group": {"axis": "always", "key": "links"},
            "localization": {"en": "3-Link (until Act 3)", "ch": "三连（至第三章）"},
        },
    }
    staged.append(("60_Links/Links.json", "Campaign Links", links_meta, links_tiers, {}, links_meta))

    # ---- 80_Net: the T3 rare safety net (campaign drops always read special) ----
    net_meta = {"item_class": {"en": "Equipment", "ch": "装备"},
                "localization": {"en": "Campaign Rares", "ch": "过渡稀有"},
                "theme_category": "Campaign"}
    net_tiers = {
        "Camp Rare Net": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"Class": class_cond(CLASS_LIST_EQUIPMENT), "Rarity": "Rare",
                           "AreaLevel": f"<= {CAMPAIGN_CAP}"},
            "theme": {"Tier": 6},  # T3: mild emphasis vs endgame plain rare
            "sound": sound(),
            "lv_group": {"axis": "always", "key": "net"},
            "localization": {"en": "Rare Safety Net", "ch": "稀有保底"},
        },
    }
    staged.append(("80_Net/Rares.json", "Campaign Rares", net_meta, net_tiers, {}, net_meta))

    # ---- 90_Aggressive: declutter blocks, emitted ONLY under hide_unselected ----
    agg_meta = {"item_class": {"en": "Equipment", "ch": "装备"},
                "localization": {"en": "Campaign Declutter", "ch": "过渡清理"},
                "theme_category": "Campaign"}
    agg_tiers = {
        "Aggressive Magic Hide": {
            "_lv": True, "hideable": True, "class_condition": True,
            "conditions": {"Class": class_cond(CLASS_LIST_EQUIPMENT + JEWELLERY_CLASSES),
                           "Rarity": "Magic",
                           "AreaLevel": "RANGE >= 34 <= 67"},
            "theme": {"Tier": 9},
            "sound": sound(),
            "lv_group": {"axis": "aggressive"},
            "localization": {"en": "Hide Magic after Act 3", "ch": "隐藏魔法（三章后）"},
        },
    }
    staged.append(("90_Aggressive/Magic Hide.json", "Campaign Declutter", agg_meta, agg_tiers, {}, agg_meta))

    # ---- cleanup: remove the ENTIRE old tree, then write the new one ----
    # (numbered folders = the v2 tree; carried categories are already in theirs)
    for root in (TIER_DIR, MAP_DIR):
        for child in sorted(root.iterdir()):
            if child.name[:2].isdigit():
                continue
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()

    for rel, cat_key, meta, tiers, mapping, map_meta in staged:
        write_category(rel, cat_key, meta, tiers, mapping, map_meta)

    # ---- category_structure: replace the Campaign chapter's groups ----
    struct = json.loads(STRUCT_PATH.read_text(encoding="utf-8"))
    cats = struct["categories"]
    sep_idx = next(i for i, c in enumerate(cats)
                   if c.get("separator", {}).get("en") == "Campaign")
    end_idx = next(i for i in range(sep_idx + 1, len(cats)) if "separator" in cats[i])

    def entry(rel, target, en, ch):
        return {"path": f"_campaign/{rel}",
                "tier_path": f"tier_definition/_campaign/{rel}",
                "mapping_path": f"base_mapping/_campaign/{rel}",
                "target_category": target,
                "localization": {"en": en, "ch": ch}}

    def group(en, ch, entries):
        return {"_meta": {"localization": {"en": en, "ch": ch}}, "files": entries}

    weapon_entries = [entry(f"10_Weapons/{c}.json", f"Campaign {c}", c,
                            old_weapon_meta.get(c, {}).get("item_class", {}).get("ch")
                            or EXTRA_CLASS_CH.get(c, c))
                      for c in WEAPON_CLASSES]
    armour_entries = [entry(f"20_Armour/{stem}.json", f"Campaign {key}", key, key)
                      for key, stem in DEFENSE_KEYS.items()]
    new_groups = [
        group("Weapon Progression", "武器过渡", weapon_entries),
        group("Armour by Defense", "防具过渡", armour_entries),
        group("Boots & Jewellery", "鞋子与首饰", [
            entry("40_Nets/Boots.json", "Campaign Boots", "Boots", "鞋子"),
            entry("40_Nets/Jewellery.json", "Campaign Jewellery", "Jewellery", "首饰"),
            entry("30_Special/Noteworthy.json", "Special Noteworthy Drops", "Noteworthy", "特殊掉落"),
        ]),
        group("Campaign Flasks", "药剂", [
            entry("50_Consumables/Flasks.json", "Campaign Flasks", "Flask Progression", "药剂过渡"),
            entry("50_Consumables/Tinctures.json", "Tinctures", "Tinctures", "酊剂"),
        ]),
        group("Colors & Links", "色与连", [
            entry("60_Links/Links.json", "Campaign Links", "Linked Gear", "连接装备"),
        ]),
        group("Act 1", "第一章", [
            entry("70_Act1/Act 1.json", "Act 1", "Act 1", "第一章"),
        ]),
        group("Safety Net & Declutter", "保底与清理", [
            entry("80_Net/Rares.json", "Campaign Rares", "Rare Safety Net", "稀有保底"),
            entry("90_Aggressive/Magic Hide.json", "Campaign Declutter", "Aggressive Declutter", "激进清理"),
        ]),
    ]
    struct["categories"] = cats[:sep_idx + 1] + new_groups + cats[end_idx:]
    STRUCT_PATH.write_text(json.dumps(struct, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    n_files = len(staged) + len(carried)
    print(f"[OK] campaign v2 tree written: {n_files} categories "
          f"({len(weapon_entries)} weapon, {len(armour_entries)} armour, {len(carried)} carried)")
    print("[NOTE] hand-tune from here; do NOT re-run over tuned data without a commit.")


if __name__ == "__main__":
    sys.exit(main())
