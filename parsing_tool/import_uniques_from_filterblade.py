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

  * Replica / Foulborn gated tierlists are SIMPLIFIED (user decision): keep
    FilterBlade's small t1/t2 highlight base-lists, drop the big multi/t3 lists,
    and let everything else fall into one mid-tier condition catch-all per gate
    (FB's own `restex` block, restyled Tier 3). This keeps the editor mapping
    clean (a base no longer sits in 3+ tiers) while still highlighting the
    valuable replicas/foulborns.

  * The mapping `_meta.localization.ch` is filled for every mapped base via the
    GGPK EN->CH join (baseitemtypes.json x ch_simplified/baseitemtypes.json),
    mirroring the backend's load_translations().

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
GGPK_EN = PROJECT_ROOT / "data" / "from_ggpk" / "baseitemtypes.json"
GGPK_CH = PROJECT_ROOT / "data" / "from_ggpk" / "ch_simplified" / "baseitemtypes.json"
TIER_OUT = PROJECT_ROOT / "filter_generation" / "data" / "tier_definition" / "Uniques" / "General.json"
MAP_OUT = PROJECT_ROOT / "filter_generation" / "data" / "base_mapping" / "Uniques" / "General.json"

BASETYPES_CSV = PROJECT_ROOT / "data" / "from_filter_blade" / "3.28" / "BaseTypes.csv"

# Style/action lines (everything else inside a block is a CONDITION — no
# whitelist: an early whitelist silently dropped HasInfluence/SynthesisedItem
# and made several detections over-match).
STYLE_PREFIXES = (
    "SetFontSize", "SetTextColor", "SetBorderColor", "SetBackgroundColor",
    "PlayAlertSound", "PlayEffect", "MinimapIcon", "CustomAlertSound",
    "DisableDropSound", "EnableDropSound", "Continue",
)

# Bases of these classes are stripped from the unique mapping/rules: they are
# caught wholesale by class-level tiers in their own categories ("Unique Maps"
# in Maps/Base Maps.json, "Unique Contracts" in Heist/Contracts.json).
EXCLUDED_CLASSES = {"Maps", "Contracts", "Blueprints"}

# Hand corrections on top of FilterBlade's detections (user QA).
# Tabula: FB only checks LinkedSockets 6, which also matches Skin of the
# Loyal/Lords on the same base — require the 6 linked sockets to be WHITE.
EXTRA_RULE_CONDS = {
    "extabula": {"SocketGroup": "WWWWWW"},
}

# ---------------------------------------------------------------------------
# Single ladder + rules (user decision): instead of one tier per FB block (which
# yielded duplicate-looking "Replica T1" / "T1" / "Foulborn T1" tiers), FB blocks
# that HAVE a BaseType list become RULES inside the matching ladder tier
# (editable in RuleManager; the rule carries the extra conditions and a Tier
# override). Only condition-only blocks (no BaseType possible) remain as
# class_condition catch tiers. The Mid catch-alls sit AFTER T2 so the T1/T2
# replica/foulborn rules fire first.
# ---------------------------------------------------------------------------

TIER_ORDER = [
    "T0 Chase", "T1", "T2",
    "Replica Mid", "Foulborn Mid",
    "6-Link", "Idols", "2x Corrupted", "Crucible Tree",
    "Over-Quality", "5-Link", "6-Socket", "Corrupted Gear",
    "T3", "Low+", "Low", "Other", "Hide",
]

# Plain ladder tiers: regular base-list tokens map straight into the mapping.
MAPPING_TIER = {
    "t1": "T1", "t2": "T2", "multispecialhigh": "T2",
    "multispecial": "T3", "t3boss": "T3", "t3": "T3",
    "hideable2": "Low+", "hideable": "Low",
}

# Base-list blocks that become RULES: token -> (ladder tier, rule comment).
# The precisely-pinned chase detections go to T0 Chase (user decision).
# Comments are bilingual (zh + EN) since the rule comment is one free-text
# field shown as-is in RuleManager for both languages.
RULE_SPEC = {
    "exuberimpresence": ("T0 Chase", "隐逝 Uber Impresence（塑界+裂界双重影响）"),
    "exkaom": ("T0 Chase", "冈姆的壮志 Kaom's Heart（无插槽）"),
    "exsquire": ("T0 Chase", "侍从 The Squire（三白孔）"),
    "extriadgrip": ("T0 Chase", "三重扣 Triad Grip（四白孔）"),
    "exforgesword": ("T0 Chase", "鬼弑 Oni-Goroshi（受影响基底）"),
    "exrationaljewel": ("T0 Chase", "理性主义 Rational Doctrine（忆境物品）"),
    "extabula": ("T1", "无尽之衣 Tabula Rasa（六连全白）"),
    "exsynth": ("T1", "忆境基底 Synthesis Bases"),
    "exjewels": ("T1", "传奇珠宝 Unique Jewels"),
    "exjewelscorrupted": ("T2", "已腐化传奇珠宝 Corrupted Jewels"),
    "4xabysshelmet": ("T2", "四深渊孔头盔 4x Abyss Helmet"),
    "3xabyss": ("T2", "三深渊孔 3x Abyss"),
    "2xabyss": ("T2", "双深渊孔 2x Abyss"),
}
# Gated (Replica/Foulborn) t1/t2 highlight lists also become rules:
GATED_RULE_TIER = {"t1": "T1", "t2": "T2"}
GATE_CH = {"Replica": "仿品", "Foulborn": "秽生"}

# Condition-only blocks -> catch tier label (class_condition tiers).
COND_TIER = {
    "ex6link": "6-Link", "exuniqueidols": "Idols",
    "2xcorrupteduniques": "2x Corrupted", "excrucibleunique": "Crucible Tree",
    "overqual": "Over-Quality", "5link": "5-Link", "6s": "6-Socket",
    "corrupteduniques": "Corrupted Gear", "restex": "Other",
}

# Ladder tier definitions: theme bucket, hideable, localization.
LADDER = {
    "T1": (1, False, {"en": "T1: High Value", "ch": "T1: 高价值"}),
    "T2": (2, False, {"en": "T2: Good Value", "ch": "T2: 优质"}),
    "T3": (3, False, {"en": "T3: Regular", "ch": "T3: 普通"}),
    "Low+": (4, True, {"en": "T4: Low", "ch": "T4: 低价值"}),
    "Low": (5, True, {"en": "T5: Lowest", "ch": "T5: 最低价值"}),
}
COND_TIER_DEFS = {
    "Replica Mid": (3, {"en": "Replica (Other)", "ch": "仿品（其他）"}, {"Replica": "True"}),
    "Foulborn Mid": (3, {"en": "Foulborn (Other)", "ch": "秽生（其他）"}, {"Foulborn": "True"}),
    "6-Link": (1, {"en": "6-Link", "ch": "六连"}, None),
    "Idols": (2, {"en": "Idols", "ch": "神像"}, None),
    "2x Corrupted": (2, {"en": "2x Corrupted", "ch": "双重腐化"}, None),
    "Crucible Tree": (2, {"en": "Crucible Tree", "ch": "坩埚天赋"}, None),
    "Over-Quality": (2, {"en": "Over-Quality", "ch": "超额品质"}, None),
    "5-Link": (2, {"en": "5-Link", "ch": "五连"}, None),
    "6-Socket": (2, {"en": "6-Socket", "ch": "六孔"}, None),
    "Corrupted Gear": (3, {"en": "Corrupted Gear", "ch": "腐化装备"}, None),
    "Other": (3, {"en": "Other Uniques", "ch": "其他传奇"}, None),
}

# default_sound_id / sharket sound per theme tier.
SOUND_BY_TIER = {
    0: (6, "超级传奇.mp3"), 1: (6, "传奇.mp3"), 2: (1, "传奇.mp3"),
    3: (1, "传奇.mp3"), 4: (-1, None), 5: (-1, None), 9: (-1, None),
}

# Subtype chapters: ->replicas / ->foulborn are part of the unique tierlist and
# ARE imported. ->maps / ->heist are intentionally NOT: in our generation order
# the Maps/Heist sections come BEFORE Uniques, so those catches live as
# class_condition tiers in their own ladders ("Unique Maps" in Maps/Base Maps.json,
# "Unique Contracts" in Heist/Contracts.json).
BLOCK_RE = re.compile(r"^(Show|Hide)\b.*\$type->uniques(?:->(?:replicas|foulborn))?\s.*\$tier->(\S+)")
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
            if s and not s.startswith("#") and not any(s.startswith(p) for p in STYLE_PREFIXES):
                key, _, val = s.partition(" ")
                val = val.strip()
                if key == "BaseType":
                    bases = QUOTED_RE.findall(s)
                elif key in conds:
                    # Repeated condition key (e.g. two HasInfluence lines = AND)
                    prev = conds[key]
                    conds[key] = (prev if isinstance(prev, list) else [prev]) + [val]
                else:
                    conds[key] = val
            j += 1
        blocks.append({"cmd": cmd, "token": token, "conds": conds, "bases": bases, "order": len(blocks)})
        i = j
    return blocks


def gate_of(conds):
    """'Replica' / 'Foulborn' for gated tierlist blocks, else None."""
    if str(conds.get("Replica", "")).lower().startswith("true"):
        return "Replica"
    if str(conds.get("Foulborn", "")).lower().startswith("true"):
        return "Foulborn"
    return None


def load_base_classes():
    """BaseType -> Class from FilterBlade's BaseTypes.csv."""
    import csv
    cls = {}
    try:
        with open(BASETYPES_CSV, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                cls[row["BaseType"]] = row["Class"]
    except Exception as e:
        print(f"[warn] BaseTypes.csv unavailable: {e}")
    return cls


def load_zh_basetype_map():
    """GGPK EN->CH base type name join (mirrors backend load_translations)."""
    try:
        en_map = {}
        for item in json.loads(GGPK_EN.read_text(encoding="utf-8")):
            if "Id" in item and "Name" in item:
                en_map[item["Id"]] = item["Name"]
        zh = {}
        for item in json.loads(GGPK_CH.read_text(encoding="utf-8")):
            en_name = en_map.get(item.get("Id"))
            if en_name and item.get("Name"):
                zh[en_name] = item["Name"]
        return zh
    except Exception as e:
        print(f"[warn] GGPK zh join unavailable: {e}")
        return {}


def build(blocks, multi_bases, zh_map, base_classes):
    tier_def = OrderedDict()
    tier_order = []
    mapping = defaultdict(list)

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

    rules = []
    cond_conds = {}  # catch-tier label -> conditions captured from the FB block
    stripped = []

    for b in blocks:
        token = b["token"]
        gate = gate_of(b["conds"])

        # Bases of class-caught categories (unique maps/contracts/blueprints)
        # are handled by their own categories' class-level tiers.
        kept_bases = []
        for base in b["bases"]:
            if base_classes.get(base) in EXCLUDED_CLASSES:
                stripped.append(base)
            else:
                kept_bases.append(base)
        b = {**b, "bases": kept_bases}

        conds = OrderedDict()
        conds["Rarity"] = "Unique"
        for k, v in b["conds"].items():
            if k != "Rarity":
                conds[k] = v
        for k, v in EXTRA_RULE_CONDS.get(token, {}).items():
            conds[k] = v

        if gate:
            # Gated tierlists: t1/t2 highlight lists -> rules in T1/T2; restex
            # -> "<gate> Mid" catch tier; the big multi/t3 lists are dropped
            # (their bases fall through to the Mid catch-all). FB's dead
            # regular-tierlist `foulborn` block is skipped too.
            if token in GATED_RULE_TIER and b["bases"]:
                tier = GATED_RULE_TIER[token]
                rules.append({
                    "comment": f"{GATE_CH.get(gate, '')} {gate} {tier}".strip(),
                    "targets": b["bases"],
                    "conditions": dict(conds),
                    "overrides": {"Tier": tier},
                })
            elif token == "restex":
                cond_conds[f"{gate} Mid"] = dict(conds)
            continue

        if token in RULE_SPEC and b["bases"]:
            tier, comment = RULE_SPEC[token]
            rules.append({
                "comment": comment,
                "targets": b["bases"],
                "conditions": dict(conds),
                "overrides": {"Tier": tier},
            })
        elif token in MAPPING_TIER and b["bases"]:
            t = MAPPING_TIER[token]
            for base in b["bases"]:
                if t not in mapping[base]:
                    mapping[base].append(t)
        elif token in COND_TIER and not b["bases"]:
            cond_conds[COND_TIER[token]] = dict(conds)
        else:
            print(f"[warn] unhandled block: token={token} gate={gate} bases={len(b['bases'])}")

    if stripped:
        print(f"[ok] stripped {len(stripped)} class-caught bases (maps/contracts/blueprints): {stripped}")

    # Materialize the fixed ladder + catch tiers in TIER_ORDER.
    for label in TIER_ORDER:
        if label in ("T0 Chase", "Hide"):
            continue
        if label in LADDER:
            theme_tier, hideable, loc = LADDER[label]
            sound_id, sharket = SOUND_BY_TIER.get(theme_tier, (-1, None))
            tier_def[label] = {
                "hideable": hideable,
                "theme": {"Tier": theme_tier},
                "conditions": {"Rarity": "Unique"},
                "sound": {"default_sound_id": sound_id, "sharket_sound_id": sharket},
                "localization": dict(loc),
            }
        else:
            theme_tier, loc, fallback_conds = COND_TIER_DEFS[label]
            conds = cond_conds.get(label)
            if conds is None:
                conds = {"Rarity": "Unique", **(fallback_conds or {})}
            sound_id, sharket = SOUND_BY_TIER.get(theme_tier, (-1, None))
            tier_def[label] = {
                "class_condition": True,
                "hideable": False,
                "theme": {"Tier": theme_tier},
                "conditions": conds,
                "sound": {"default_sound_id": sound_id, "sharket_sound_id": sharket},
                "localization": dict(loc),
            }
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

    # zh names for every base we reference (mapping keys AND rule targets).
    all_bases = set(final_map) | {t for r in rules for t in r["targets"]}
    map_doc = {
        "_meta": {
            "localization": {"ch": {b: zh_map[b] for b in sorted(all_bases) if b in zh_map}},
            "item_class": {"en": "Unique Items", "ch": "传奇物品"},
            "theme_category": "Uniques",
            "multi_unique_bases": sorted(multi_bases),
        },
        "mapping": final_map,
        "rules": rules,
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
    zh_map = load_zh_basetype_map()
    base_classes = load_base_classes()
    tier_doc, map_doc = build(blocks, multi, zh_map, base_classes)

    TIER_OUT.write_text(json.dumps(tier_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    MAP_OUT.write_text(json.dumps(map_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    n_tiers = len(tier_doc["Unique Items"]["_meta"]["tier_order"])
    n_rules = len(map_doc["rules"])
    n_zh = len(map_doc["_meta"]["localization"]["ch"])
    print(f"[ok] parsed {len(blocks)} FB blocks -> {n_tiers} tiers + {n_rules} rules")
    print(f"[ok] {len(map_doc['mapping'])} base types mapped ({n_zh} zh-localized); {len(multi)} multi-unique bases flagged")
    print(f"[ok] wrote {TIER_OUT.relative_to(PROJECT_ROOT)} and {MAP_OUT.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
