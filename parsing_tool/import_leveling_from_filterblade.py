"""
Import NeverSink/FilterBlade campaign LEVELING rules into our `_campaign` tiers,
tagged for the FilterBlade-style "Auto-Adjust: Campaign" picker (a leveling MODULE).

Source: data/FilterBlade.filter (NeverSink, campaign auto-adjust enabled, used
with NeverSink's permission). The leveling section tags every block
`$type->leveling->...`. We translate the ACTIVE (Show) blocks into our
`class_condition` tiers (the generator emits arbitrary condition keys with NO
BaseType line and resolves colours from the theme table, so we store conditions
only, never colours).

Every emitted tier carries an `lv_group: {axis, key}` tag that the picker toggles
against, and the generator reads via `--leveling-selection`:
  * axis "weapon"  -> gated by the picker's weapon-class row (per item Class,
    incl. Shields/Quivers). This is the per-class *substrate* — kept per-class.
  * axis "armour"  -> gated by the picker's armour DEFENSE-type row. The per-slot
    NeverSink armour rares are REPLACED by 6 BaseType-list tiers, one per defense
    category (Armour, AR/EV, Evasion, EV/ES, Energy Shield, AR/ES), classified
    from data/from_filter_blade/BaseTypes.csv (Game:Armour/Evasion/Energy Shield).
  * axis "vendor"  -> gated by the vendor-rare LVL bands. The 24-class
    `remaining underlevelNN` blocks are COLLAPSED to 4 all-class band tiers.
  * axis "minion"  -> gated by "Minion Focused".
  * axis "always"  -> never gated (flasks, tinctures, early normal/magic, jewellery,
    movement boots/veiled, 4-link rares). Magic->remaining is collapsed to grouped
    band tiers (was 24-class per band).

Ruthless-first: import only SHOW/highlight blocks; SKIP the aggressive Hide blocks
(the progression-hide — magic blockers, wand-progression). Those are now the
picker's "Hide Unselected Gear Aggressively" toggle (`hide_unselected`), applied at
generation time, not baked in here. DROP the RGB/chromatic blocks (deferred until
GGG confirms the 3.29 chromatic change).

Scanner note: FilterBlade emits the `Class ==` line at COLUMN 0 (unindented) in
some blocks. A block body runs until the next blank line / comment / Show|Hide
header — NOT until the first unindented line.

Idempotent: imported tiers carry `_lv: true`; a re-run removes the old ones and
re-adds fresh, preserving any hand-authored (non-`_lv`) tiers + `_meta`.
Run from the project root:  python parsing_tool/import_leveling_from_filterblade.py
"""

import csv
import json
import re
from collections import OrderedDict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FILTER_PATH = PROJECT_ROOT / "data" / "FilterBlade.filter"
CSV_PATH = PROJECT_ROOT / "data" / "from_filter_blade" / "BaseTypes.csv"
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
ARMOUR_RELPATH = "Rare/Jewellery Armours.json"

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

# Armour defense categories in picker order + their attribute signature + zh labels.
ARMOUR_SLOTS = {"Body Armours", "Boots", "Gloves", "Helmets"}
DEFENSE_CATS = ["Armour", "AR/EV", "Evasion", "EV/ES", "Energy Shield", "AR/ES"]
DEFENSE_BY_ATTRS = {
    ("AR",): "Armour", ("EV",): "Evasion", ("ES",): "Energy Shield",
    ("AR", "EV"): "AR/EV", ("AR", "ES"): "AR/ES", ("EV", "ES"): "EV/ES",
}
DEFENSE_ZH = {
    "Armour": "护甲", "AR/EV": "护甲/闪避", "Evasion": "闪避",
    "EV/ES": "闪避/能量护盾", "Energy Shield": "能量护盾", "AR/ES": "护甲/能量护盾",
}

# `remaining underlevelNN` tier -> picker vendor-rare band key.
VENDOR_BANDS = {"underlevel16": "1-16", "underlevel24": "16-24",
                "underlevel42": "24-42", "underlevel68": "42-68"}

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


def strip_class(conds):
    return OrderedDict((k, v) for k, v in conds.items() if k != "Class")


def make_tier(key, en, ch, conditions, theme_tier, lv_group, source):
    """Assemble one class_condition tier dict (Rarity first, `lv_group` tagged)."""
    conds = OrderedDict()
    if "Rarity" in conditions:
        conds["Rarity"] = conditions["Rarity"]
    for k, v in conditions.items():
        if k != "Rarity":
            conds[k] = v
    sound_id, sharket = SOUND_BY_TIER.get(theme_tier, (-1, None))
    return key, OrderedDict([
        ("_lv", True),
        ("class_condition", True),
        ("conditions", conds),
        ("hideable", True),
        ("theme", {"Tier": theme_tier}),
        ("sound", {"default_sound_id": sound_id, "sharket_sound_id": sharket}),
        ("lv_group", lv_group),
        ("localization", {"en": en, "ch": ch}),
        ("_source", source),
    ])


def _src(b):
    return {"path": b["path"], "tier": b["tier"], "order": b["order"]}


def _add(per_file, relpath, order, theme_tier, key, tier):
    per_file.setdefault(relpath, []).append((order, theme_tier, key, tier))


def emit_grouped(b, theme_tier, lv_group, en, ch, per_file, relpath):
    """One tier preserving the block's conditions verbatim (multi-class / BaseType kept)."""
    leaf = b["path"].split("->")[-1]
    key = f"Lv {leaf} {b['tier']}"
    _, tier = make_tier(key, en, ch, b["conds"], theme_tier, lv_group, _src(b))
    _add(per_file, relpath, b["order"], theme_tier, key, tier)


def emit_per_class(b, theme_tier, axis, per_file, relpath):
    """Split a multi-class block into one tier per single Class (or one tier if none)."""
    leaf = b["path"].split("->")[-1]
    tag = b["tier"]
    for cls in (class_values(b["conds"]) or [None]):
        conds = strip_class(b["conds"])
        if cls:
            conds["Class"] = f'== "{cls}"'
        key = f"Lv {leaf} {tag}" + (f" {cls}" if cls else "")
        en = f"Leveling: {leaf} {tag}" + (f" ({cls})" if cls else "")
        ch = "过渡: " + (CLASS_ZH.get(cls, cls) if cls else leaf) + f" {tag}"
        lv = {"axis": "weapon", "key": cls} if (cls and axis == "weapon") \
            else {"axis": "always", "key": cls or leaf}
        _, tier = make_tier(key, en, ch, conds, theme_tier, lv, _src(b))
        _add(per_file, relpath, b["order"], theme_tier, key, tier)


def emit_weapon_single(b, theme_tier, cls, per_file, relpath):
    """A single-class weapon-axis tier (Shields / Quivers pulled out of rare->armours)."""
    leaf = b["path"].split("->")[-1]
    tag = b["tier"]
    conds = strip_class(b["conds"])
    conds["Class"] = f'== "{cls}"'
    key = f"Lv {leaf} {tag} {cls}"
    en = f"Leveling: {leaf} {tag} ({cls})"
    ch = "过渡: " + CLASS_ZH.get(cls, cls) + f" {tag}"
    _, tier = make_tier(key, en, ch, conds, theme_tier, {"axis": "weapon", "key": cls}, _src(b))
    _add(per_file, relpath, b["order"], theme_tier, key, tier)


def load_armour_defense():
    """Classify every Body/Boots/Gloves/Helmets base into a defense category via the CSV."""
    def has(v):
        return v not in (None, "", "0")
    result = OrderedDict((c, []) for c in DEFENSE_CATS)
    unmapped = []
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["Class"] not in ARMOUR_SLOTS:
                continue
            present = []
            if has(row.get("Game:Armour")):
                present.append("AR")
            if has(row.get("Game:Evasion")):
                present.append("EV")
            if has(row.get("Game:Energy Shield")):
                present.append("ES")
            cat = DEFENSE_BY_ATTRS.get(tuple(present))
            if cat is None:  # triple-stat league bases + cosmetic (Demigod) — skip
                unmapped.append(row["BaseType"])
                continue
            result[cat].append(row["BaseType"])
    for c in result:
        result[c].sort()
    return result, unmapped


def emit_armour_defense(per_file):
    """6 BaseType-list armour tiers (one per defense category) replacing per-slot rares."""
    defense, unmapped = load_armour_defense()
    for i, defcat in enumerate(DEFENSE_CATS):
        bases = defense.get(defcat, [])
        if not bases:
            continue
        conds = OrderedDict([
            ("Rarity", "Rare"),
            ("BaseType", "== " + " ".join(f'"{b}"' for b in bases)),
        ])
        key = f"Lv armour {defcat}"
        en = f"Leveling: armour ({defcat})"
        ch = f"过渡: 防具 {DEFENSE_ZH[defcat]}"
        src = {"path": "leveling->rare->armours", "tier": "defense", "order": 900 + i}
        _, tier = make_tier(key, en, ch, conds, 4, {"axis": "armour", "key": defcat}, src)
        _add(per_file, ARMOUR_RELPATH, 900 + i, 4, key, tier)
    return unmapped


def main():
    text = FILTER_PATH.read_text(encoding="utf-8")
    blocks = parse_blocks(text)

    dropped_rgb, skipped_hide, unrouted = [], [], []
    per_file = {}  # relpath -> list of (order, theme_tier, key, tier_dict)

    for b in blocks:
        if is_rgb(b):
            dropped_rgb.append(f'{b["path"]} ${b["tier"]}')
            continue
        if b["cmd"] == "Hide":  # progression-hide -> now the picker's hide_unselected toggle
            skipped_hide.append(f'{b["path"]} ${b["tier"]}')
            continue
        dest = route(b["path"])
        if not dest:
            unrouted.append(b["path"])
            continue
        relpath, theme_tier = dest
        path = b["path"]

        # armour rares: Shields/Quivers -> weapon axis; body/boots/gloves/helmets ->
        # dropped here, replaced by the 6 CSV defense-type tiers (emit_armour_defense).
        if "rare->armours" in path:
            classes = class_values(b["conds"])
            if "Shields" in classes:
                emit_weapon_single(b, theme_tier, "Shields", per_file, relpath)
            elif "Quivers" in classes:
                emit_weapon_single(b, theme_tier, "Quivers", per_file, relpath)
            continue

        # movement boots / veiled: always-highlight, keep block verbatim
        if "rare->exotics" in path:
            emit_grouped(b, theme_tier, {"axis": "always", "key": "exotics"},
                         f"Leveling: {b['tier']}", f"过渡: {b['tier']}", per_file, relpath)
            continue

        # 4-link rares: always-highlight, one grouped tier (full class list kept)
        if "rare->socketslinks" in path:
            emit_grouped(b, theme_tier, {"axis": "always", "key": "4link"},
                         "Leveling: 4-link rares", "过渡: 四连稀有", per_file, relpath)
            continue

        # vendor-rare bands: collapse the 24-class block to ONE all-class band tier
        if "rare->remaining" in path:
            band = VENDOR_BANDS.get(b["tier"])
            if not band:
                unrouted.append(path)
                continue
            emit_grouped(b, theme_tier, {"axis": "vendor", "key": band},
                         f"Leveling: vendor rares {band}", f"过渡: 商店稀有 {band}",
                         per_file, relpath)
            continue

        # magic remaining: collapse the 24-class band to ONE grouped tier (never gated)
        if "magic->remaining" in path:
            emit_grouped(b, theme_tier, {"axis": "always", "key": f"magic {b['tier']}"},
                         f"Leveling: magic {b['tier']}", f"过渡: 魔法 {b['tier']}",
                         per_file, relpath)
            continue

        # minion bases: gated by "Minion Focused"
        if "rare->minion" in path:
            emit_grouped(b, theme_tier, {"axis": "minion", "key": "minion"},
                         "Leveling: minion bases", "过渡: 召唤物底材", per_file, relpath)
            continue

        # jewellery (rings/amulets/belts): always
        if "rare->universal" in path:
            emit_grouped(b, theme_tier, {"axis": "always", "key": "jewellery"},
                         "Leveling: jewellery", "过渡: 首饰", per_file, relpath)
            continue

        # weapon rares (archer / melee / caster): per-class substrate, gated by weapon row
        if path.startswith("leveling->rare->"):
            emit_per_class(b, theme_tier, "weapon", per_file, relpath)
            continue

        # flasks / tinctures / early normal / firstlevels: always
        emit_per_class(b, theme_tier, "always", per_file, relpath)

    unmapped_armour = emit_armour_defense(per_file)

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
    print(f"[ok] skipped {len(skipped_hide)} Hide blocks (now the hide_unselected toggle): {skipped_hide}")
    print(f"[ok] armour defense tiers: {len(DEFENSE_CATS)} categories; "
          f"{len(unmapped_armour)} unmapped armour bases skipped (triple-stat/cosmetic)")
    if unrouted:
        print(f"[warn] {len(unrouted)} unrouted subtypes: {sorted(set(unrouted))}")


if __name__ == "__main__":
    main()
