"""
Import the Uniques tierlist from a FilterBlade .filter into our two-file schema.

FilterBlade tiers uniques by `Rarity Unique` + BaseType lists (and structural
exceptions like sockets / links / corrupted / class), because a loot filter can
only see a unique's *base type*, never its name. We mirror that faithfully:

  * Each FilterBlade `Show/Hide ... $type->uniques $tier->X` block becomes ONE
    tier in tier_definition/Uniques/General.json, in FilterBlade order (= filter
    priority). Blocks WITH a BaseType list are plain tiers (their bases go into
    base_mapping); blocks WITHOUT a BaseType list (condition-only: idols, 2x
    corrupted, foulborn, 5-link, 6-socket, ...) become `class_condition` tiers
    that emit their conditions with no BaseType line — a path generate.py already
    supports (used by _campaign/Armour.json). So NO generator change is needed.

  * Every unique tier carries `conditions.Rarity = "Unique"` so it only matches
    uniques, plus any structural extras (Replica/Foulborn/Sockets/Corrupted/...).

  * A base that appears in several tiers (e.g. a jewel base in both the corrupted
    and the plain jewel rule) is stored as a list in `mapping`; tier_order keeps
    the higher-priority block first, exactly like FilterBlade.

  * `_meta.multi_unique_bases` records which bases can drop more than one notable
    unique (from bonusItemInfo) so the editor/hover can say "= <unique>" (precise
    pin) vs "could be ...".

Idempotent: re-running fully regenerates both files. Run from the project root:
    python parsing_tool/import_uniques_from_filterblade.py
"""

import json
import re
from collections import OrderedDict, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FILTER_PATH = PROJECT_ROOT / "data" / "from_filter_blade" / "3.28" / "FilterBlade_2_Semi-Strict.filter"
BONUS_PATH = PROJECT_ROOT / "data" / "from_filter_blade" / "3.28" / "bonusItemInfo.json"
TIER_OUT = PROJECT_ROOT / "filter_generation" / "data" / "tier_definition" / "Uniques" / "General.json"
MAP_OUT = PROJECT_ROOT / "filter_generation" / "data" / "base_mapping" / "Uniques" / "General.json"

# Conditions we carry through verbatim (besides BaseType, handled separately).
CARRY_CONDS = (
    "Rarity", "Class", "Sockets", "Corrupted", "CorruptedMods", "Quality",
    "LinkedSockets", "Foulborn", "Replica", "HasCruciblePassiveTree",
    "ItemLevel", "AnyEnchantment", "SocketGroup", "Mirrored",
)

# Friendly display name per FilterBlade tier token.
FRIENDLY = {
    "t1": "T1", "t2": "T2", "t3": "T3", "t3boss": "T3 Boss",
    "multi": "Multi", "multispecial": "Multi-Unique", "multispecialhigh": "Multi-Unique High",
    "hideable": "Low", "hideable2": "Low+", "restex": "Other", "any": "Other (Class)",
    "5link": "5-Link", "6s": "6-Socket", "ex6link": "6-Link", "overqual": "Over-Quality",
    "foulborn": "Foulborn", "exjewels": "Jewels", "exjewelscorrupted": "Corrupted Jewels",
    "2xabyss": "2x Abyss", "3xabyss": "3x Abyss", "4xabysshelmet": "4x Abyss Helmet",
    "2xcorrupteduniques": "2x Corrupted", "corrupteduniques": "Corrupted Gear",
    "excrucibleunique": "Crucible Tree", "exuniqueidols": "Idols",
    "exsquire": "The Squire", "extabula": "Tabula Rasa", "exkaom": "Kaom's Heart",
    "extriadgrip": "Triad Grip", "exforgesword": "Forge Sword",
    "exrationaljewel": "Rational Doctrine", "exsynth": "Synthesis Implicits",
    "exuberimpresence": "Uber Impresence", "earlyleague": "Early League",
    "recipeuniquerings": "Recipe Rings", "highvinktar": "High Vinktar",
    "2xcorrupted": "2x Corrupted", "exdust1": "Dust 1", "exdust2": "Dust 2", "exdust3": "Dust 3",
}

# theme.Tier bucket per token (styling). Falls back to 3.
THEME_TIER = {
    "t1": 1, "t2": 2, "t3": 3, "t3boss": 3,
    "multi": 3, "multispecial": 3, "multispecialhigh": 2,
    "hideable": 5, "hideable2": 4, "restex": 5, "any": 5,
    "5link": 2, "6s": 2, "ex6link": 1, "overqual": 2, "foulborn": 2,
    "exjewels": 1, "exjewelscorrupted": 2,
    "2xabyss": 2, "3xabyss": 2, "4xabysshelmet": 2,
    "2xcorrupteduniques": 2, "corrupteduniques": 3, "excrucibleunique": 2,
    "exuniqueidols": 2,
    "exsquire": 1, "extabula": 1, "exkaom": 1, "extriadgrip": 1,
    "exforgesword": 1, "exrationaljewel": 1, "exsynth": 1, "exuberimpresence": 1,
}

# default_sound_id / sharket sound per theme tier.
SOUND_BY_TIER = {
    0: (6, "超级传奇.mp3"), 1: (6, "传奇.mp3"), 2: (1, "传奇.mp3"),
    3: (1, "传奇.mp3"), 4: (-1, None), 5: (-1, None), 9: (-1, None),
}

BLOCK_RE = re.compile(r"^(Show|Hide)\b.*\$type->uniques.*\$tier->(\S+)")
QUOTED_RE = re.compile(r'"([^"]+)"')


def parse_blocks(text):
    """Return ordered list of unique rule blocks parsed from the filter."""
    lines = text.splitlines()
    blocks = []
    i = 0
    while i < len(lines):
        m = BLOCK_RE.match(lines[i])
        if not m:
            i += 1
            continue
        cmd, token = m.group(1), m.group(2)
        conds = OrderedDict()
        bases = []
        j = i + 1
        while j < len(lines) and (lines[j].startswith("\t") or lines[j].startswith("    ")):
            s = lines[j].strip()
            for c in CARRY_CONDS:
                if s == c or s.startswith(c + " ") or s.startswith(c + "="):
                    val = s[len(c):].strip()
                    if c == "BaseType":
                        break
                    conds[c] = val
                    break
            if s.startswith("BaseType"):
                bases = QUOTED_RE.findall(s)
            j += 1
        blocks.append({"cmd": cmd, "token": token, "conds": conds, "bases": bases, "order": len(blocks)})
        i = j
    return blocks


def gate_suffix(conds):
    if conds.get("Replica", "").lower().startswith("true"):
        return " (Replica)"
    if conds.get("Foulborn", "").lower().startswith("true"):
        return " (Foulborn)"
    return ""


def build(blocks, multi_bases):
    tier_def = OrderedDict()
    tier_order = []
    mapping = defaultdict(list)
    used_labels = set()

    # Keep our hand-curated chase tier at the very top (highest priority).
    tier_order.append("T0 Chase")
    tier_def["T0 Chase"] = {
        "hideable": False,
        "show_in_editor": True,
        "theme": {"Tier": 0},
        "conditions": {"Rarity": "Unique"},
        "sound": {"default_sound_id": 6, "sharket_sound_id": "超级传奇.mp3"},
        "localization": {"en": "T0: Chase Uniques", "ch": "T0: 顶级传奇"},
        "comment": "Hand-picked chase uniques (add bases in the editor).",
    }

    for b in blocks:
        token = b["token"]
        theme_tier = THEME_TIER.get(token, 3)
        friendly = FRIENDLY.get(token, token)
        label = (friendly + gate_suffix(b["conds"])).strip()
        # ensure uniqueness
        base_label = label
        n = 2
        while label in used_labels:
            label = f"{base_label} {n}"
            n += 1
        used_labels.add(label)

        conds = OrderedDict()
        conds["Rarity"] = "Unique"
        for k, v in b["conds"].items():
            if k == "Rarity":
                continue
            conds[k] = v

        sound_id, sharket = SOUND_BY_TIER.get(theme_tier, (-1, None))
        entry = {
            "hideable": theme_tier >= 4,
            "theme": {"Tier": theme_tier},
            "conditions": conds,
            "sound": {"default_sound_id": sound_id, "sharket_sound_id": sharket},
            "localization": {"en": label, "ch": label},
        }
        if b["cmd"] == "Hide":
            entry["is_hide_tier"] = True

        if b["bases"]:
            # Plain tier: bases go to mapping, conditions emitted in the base block.
            for base in b["bases"]:
                if label not in mapping[base]:
                    mapping[base].append(label)
        else:
            # Condition-only tier: emit conditions, no BaseType (reuse class_condition).
            entry["class_condition"] = True

        tier_def[label] = entry
        tier_order.append(label)

    # Explicit Hide bucket (empty by default; user can route bases here).
    tier_order.append("Hide")
    tier_def["Hide"] = {
        "hideable": True,
        "is_hide_tier": True,
        "theme": {"Tier": 9},
        "conditions": {"Rarity": "Unique"},
        "sound": {"default_sound_id": -1, "sharket_sound_id": None},
        "localization": {"en": "Hide", "ch": "隐藏"},
    }

    # collapse single-element mapping lists to scalars for readability
    final_map = OrderedDict()
    for base in sorted(mapping.keys()):
        vals = mapping[base]
        final_map[base] = vals[0] if len(vals) == 1 else vals

    tier_doc = {
        "Unique Items": {
            "_meta": {
                "theme_category": "Uniques",
                "localization": {"en": "Unique Items", "ch": "传奇物品"},
                "tier_order": tier_order,
                "multi_unique_bases": sorted(multi_bases),
            },
            **tier_def,
        }
    }

    map_doc = {
        "_meta": {
            "localization": {"ch": {}},
            "item_class": {"en": "Unique Items", "ch": "传奇物品"},
            "theme_category": "Uniques",
            "multi_unique_bases": sorted(multi_bases),
        },
        "mapping": final_map,
        "rules": [],
    }
    return tier_doc, map_doc


def load_multi_unique_bases():
    """Bases that can drop >1 notable unique, per bonusItemInfo."""
    multi = set()
    try:
        data = json.loads(BONUS_PATH.read_text(encoding="utf-8"))
        uniques = data.get("bonusItemInfo", {}).get("Uniques", {}).get("items", {})
        for base, bv in uniques.items():
            inner = bv.get("items", {}) if isinstance(bv, dict) else {}
            if len(inner) > 1:
                multi.add(base)
    except Exception as e:
        print(f"[warn] could not read bonusItemInfo: {e}")
    return multi


def main():
    text = FILTER_PATH.read_text(encoding="utf-8")
    blocks = parse_blocks(text)
    multi = load_multi_unique_bases()
    tier_doc, map_doc = build(blocks, multi)

    TIER_OUT.write_text(json.dumps(tier_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    MAP_OUT.write_text(json.dumps(map_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    n_plain = sum(1 for b in blocks if b["bases"])
    n_cond = sum(1 for b in blocks if not b["bases"])
    print(f"[ok] parsed {len(blocks)} unique rules: {n_plain} base-list tiers, {n_cond} condition-only tiers")
    print(f"[ok] {len(map_doc['mapping'])} base types mapped; {len(multi)} multi-unique bases flagged")
    print(f"[ok] wrote {TIER_OUT.relative_to(PROJECT_ROOT)} and {MAP_OUT.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
