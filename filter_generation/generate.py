import json
import re
import os
import sys
import argparse
from pathlib import Path
from collections import defaultdict

# ===========================
# CONFIG
# ===========================
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
TIER_DEF_DIR = (PROJECT_ROOT / "filter_generation" / "data" / "tier_definition").resolve()
BASE_MAPPING_DIR = (PROJECT_ROOT / "filter_generation" / "data" / "base_mapping").resolve()
THEME_FILE = (PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "sharket_theme.json").resolve()
SOUND_MAP_FILE = (PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "Sharket_sound_map.json").resolve()
OUTPUT_FILE = (PROJECT_ROOT / "filter_generation" / "complete_filter.filter").resolve()

# Folder holding custom sound files (for sharket_sound_id)
SOUND_FILE_PATH = Path("sound_files")

# Default font size if you don't carry it in the theme
DEFAULT_FONT_SIZE = 32

_args = argparse.ArgumentParser(add_help=False)
_args.add_argument("--mode", default="standard", choices=["standard", "ruthless"])
_args.add_argument("--game-version", default="poe1", choices=["poe1", "poe2"])
_parsed = _args.parse_known_args()[0]
MODE = _parsed.mode
GAME_VERSION = _parsed.game_version
HIDE_CMD = "Minimal" if MODE == "ruthless" else "Hide"

if GAME_VERSION == "poe2":
    print("[ERROR] POE2 filter generation is not yet supported.")
    sys.exit(1)

_rgba_re = re.compile(r"rgba?(\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?")

# Localization Terms
TERMS = {
    "en": {"Rule": "Rule", "Base": "Base", "Auto-Sound": "Auto-Sound", "Exact": "Exact", "Partial": "Partial"},
    "ch": {"Rule": "规则", "Base": "基础", "Auto-Sound": "自动音效", "Exact": "精确", "Partial": "模糊"}
}
# Current output language (can be made configurable)
LANG = "ch" 

# Folder Localization Map
FOLDER_LOCALIZATION = {
    "Currency": "通货",
    "Equipment": "装备",
    "Divination Cards": "命运卡",
    "Gems": "宝石",
    "Maps": "地图",
    "Misc": "杂项",
    "Special": "特殊",
    "Weapons": "武器",
    "Armour": "防具",
    "Jewellery": "首饰",
    "Flasks": "药剂",
    "Quest": "任务",
    "Uniques": "传奇",
    "_campaign": "过渡",
    "Heist": "赏金猎人"
}

def tr(key):
    return TERMS.get(LANG, TERMS["en"]).get(key, key)

# ---------- UTILITIES ----------
def parse_rgba(value, default="255 255 255 255"):
    """Return 'R G B A' string from rgba() string or [r,g,b,a] list. Fallback to white."""
    if not value or value == -1: return default
    if isinstance(value, str) and value.startswith("disabled:"): return default
    
    if isinstance(value, str) and value.startswith("#"):
        hexv = value.lstrip("#")
        if len(hexv) in (6, 8):
            r = int(hexv[0:2], 16)
            g = int(hexv[2:4], 16)
            b = int(hexv[4:6], 16)
            a = int(hexv[6:8], 16) if len(hexv) == 8 else 255
            return f"{r} {g} {b} {a}"
    return default

def resolve_sound(tier_entry, sound_map, override_sound=None):
    """Priority: override sound -> sharket -> default"""
    # If user provided a specific override [file, vol] in a rule
    if override_sound and isinstance(override_sound, list):
        file, vol = override_sound
        if file.startswith("Default/AlertSound"):
            num = re.search(r"\d+", file).group(0)
            return f"PlayAlertSound {num} {vol}"
        else:
            win_path = file.replace("/", "\\")
            return f'CustomAlertSound "sound_files\\{win_path}" {vol}'

    # Handle the new sound_map structure (dict with basetype_sounds and class_sounds)
    sb = tier_entry.get("sound", {})
    
    # Check if sound_map has tiered default IDs
    if sb.get("sharket_sound_id") and "class_sounds" in sound_map and sb["sharket_sound_id"] in sound_map["class_sounds"]:
        s = sound_map["class_sounds"][sb["sharket_sound_id"]]
        win_path = s["file"].replace("/", "\\")
        return f'CustomAlertSound "sound_files\\{win_path}" {s["volume"]}'
    
    # 2. Default Sound
    if sb.get("default_sound_id") is not None and sb["default_sound_id"] != -1:
        return f'PlayAlertSound {sb["default_sound_id"]} 300'
    
    return None

def tier_num_from_label(label):
    if "Tier 0" in label: return 0
    if "Hide" in label: return 9
    m = re.search(r"Tier\s+(\d+)", label)
    return int(m.group(1)) if m else 99

def header_line(index, text):
    return f"\n#==[{index:05d}]-{text}=="

def load_merged_theme():
    # 1. Load Settings to find Base Theme
    settings_path = PROJECT_ROOT / "data" / "config" / "settings.json"
    base_theme_name = "sharket"
    if settings_path.exists():
        try:
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            base_theme_name = settings.get("base_theme", "sharket")
        except: pass
    
    print(f"Using Base Theme: {base_theme_name}")

    # 2. Load Base Theme
    base_theme_file = PROJECT_ROOT / "filter_generation" / "data" / "theme" / base_theme_name / f"{base_theme_name}_theme.json"
    if not base_theme_file.exists():
        print(f"Warning: Base theme file not found: {base_theme_file}. Falling back to sharket.")
        base_theme_file = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "sharket" / "sharket_theme.json"
    
    theme_data = json.loads(base_theme_file.read_text(encoding="utf-8"))

    # 3. Load Overrides
    overrides_file = PROJECT_ROOT / "filter_generation" / "data" / "theme" / "custom_overrides.json"
    if overrides_file.exists():
        try:
            overrides = json.loads(overrides_file.read_text(encoding="utf-8"))
            # Merge Overrides
            for cat, tiers in overrides.items():
                if cat not in theme_data:
                    theme_data[cat] = {}
                for tier, style in tiers.items():
                    # If base has style, merge. Else set.
                    if tier in theme_data[cat]:
                        theme_data[cat][tier].update(style)
                    else:
                        theme_data[cat][tier] = style
            print("Loaded Custom Overrides.")
        except Exception as e:
            print(f"Error loading overrides: {e}")

    return theme_data

# ---------- MAIN ----------
def generate_filter():
    theme_data = load_merged_theme()
    # SOUND_MAP_FILE is usually tied to Sharket currently, but ideally should follow theme or use a global map.
    # For now, we assume Sound Map is consistent or handled by frontend overrides.
    sound_map = json.loads(Path(SOUND_MAP_FILE).read_text(encoding="utf-8"))
    
    overview = [
        "#========================================",
        "#  FILTER OVERVIEW",
        "#========================================",
        "#  [00000] 自定义规则"
    ]

    out_lines = []
    out_lines.append(header_line(0, "自定义规则"))
    out_lines.append("# 在此添加自定义规则将会覆盖所有过滤器设定.\n")

    current_major_cat = ""
    major_counter = 0 # 10000, 20000...
    sub_counter = 0   # 11000, 12000...

    # Process all JSON files in base_mapping
    # Sort: underscore-prefixed folders (_campaign, _legacy, _unclassified) go after all standard folders
    def _sort_key(p):
        rel = p.relative_to(BASE_MAPPING_DIR)
        parts = list(rel.parts)
        parts[0] = parts[0].replace("_", "~", 1) if parts[0].startswith("_") else parts[0]
        return parts

    for map_file in sorted(BASE_MAPPING_DIR.rglob("*.json"), key=_sort_key):
        rel_path = map_file.relative_to(BASE_MAPPING_DIR)
        tier_file = TIER_DEF_DIR / rel_path
        
        if not tier_file.exists():
            continue

        # Extract Folder Name (First part of path)
        folder = rel_path.parts[0]

        # --- Major Category Header ---
        if folder != current_major_cat:
            current_major_cat = folder
            major_counter += 10000
            sub_counter = major_counter # Reset sub counter base
            
            # Localize folder name
            folder_localized = FOLDER_LOCALIZATION.get(folder, folder)
            header_text = f"{folder_localized} {folder}" if LANG == "ch" else folder
            
            out_lines.append(f"\n#===================================================================================================================")
            out_lines.append(f"# [[{major_counter:05d}]] {header_text}")
            out_lines.append(f"#===================================================================================================================")
            overview.append(f"#  [{major_counter:05d}] {header_text}")

        # --- Sub Category (File) ---
        sub_counter += 1000
        block_index = sub_counter # 11000 start

        tier_doc = json.loads(tier_file.read_text(encoding="utf-8"))
        map_doc  = json.loads(map_file.read_text(encoding="utf-8"))

        # Skip files excluded for current mode (e.g. Divination Cards in ruthless)
        if MODE in map_doc.get("_meta", {}).get("excluded_modes", []):
            continue

        category_key = next((k for k in tier_doc if not k.startswith("//")), None)
        if not category_key: continue
        
        category_data = tier_doc[category_key]
        meta = category_data.get("_meta", {})
        loc_en = meta.get("localization", {}).get("en", category_key)
        
        # Load Item Translations from Base Mapping (map_doc), NOT Tier Definition
        map_meta = map_doc.get("_meta", {})
        
        # Generic Localization Loading
        loc_data = map_meta.get("localization", {}).get(LANG, {})
        
        if isinstance(loc_data, dict):
            # It's a dictionary of baseType -> translation. The class label now lives
            # canonically in _meta.item_class (was the magic localization.ch.__class_name__ key).
            loc_cat = map_meta.get("item_class", {}).get(LANG) or meta.get("localization", {}).get("ch", loc_en)
            item_trans = loc_data # The whole dict is the translation map
        else:
            # It's a string (like 'en' usually is) or missing
            loc_cat = loc_data if loc_data else loc_en
            item_trans = {}
        
        item_class_raw = meta.get("item_class", category_key)
        if isinstance(item_class_raw, dict):
            # For filter syntax (Class "...") we MUST use English
            item_class = item_class_raw.get("en", category_key)
            # For comment/header we can use localized version
            if isinstance(item_class_raw.get(LANG), str):
                 item_class_header = item_class_raw.get(LANG)
            else:
                 item_class_header = item_class
        else:
            item_class = item_class_raw
            item_class_header = item_class

        theme_cat_key = meta.get("theme_category", category_key)
        theme_ref = theme_data.get(theme_cat_key, theme_data.get("Default", {}))

        # --- Construct Full Hierarchy Header ---
        breadcrumbs = []
        for i, p in enumerate(rel_path.parts):
            if i == len(rel_path.parts) - 1:
                # Last part is file -> use Category Name from JSON
                breadcrumbs.append(f"{loc_cat} {loc_en}")
            else:
                # Folder -> use FOLDER_LOCALIZATION
                loc_folder = FOLDER_LOCALIZATION.get(p, p)
                breadcrumbs.append(f"{loc_folder} {p}")
        
        full_header_text = " - ".join(breadcrumbs)

        # Add Subcategory to Overview
        overview.append(f"#    [{sub_counter:05d}] {full_header_text}")
        out_lines.append(header_line(sub_counter, full_header_text))

        # Map items to their tiers
        mapping = map_doc.get("mapping", {})
        items_by_tier = defaultdict(list)
        for item_name, t_val in mapping.items():
            if isinstance(t_val, list):
                for t in t_val:
                    items_by_tier[t].append(item_name)
            else:
                items_by_tier[t_val].append(item_name)

        # For underscore-prefix folders (_legacy, _campaign), mapping values may reference
        # cross-category tier keys that don't exist in this tier_def.
        # Remap all such items to the first non-hide tier defined in this tier_def.
        if folder.startswith("_"):
            valid_tier_keys = set(k for k in category_data if k.startswith("Tier"))
            default_show_tier = next(
                (t for t in meta.get("tier_order", [])
                 if t in valid_tier_keys and not category_data[t].get("is_hide_tier", False)),
                None
            )
            if default_show_tier:
                remapped = defaultdict(list)
                for t_key, item_list in items_by_tier.items():
                    if t_key in valid_tier_keys:
                        remapped[t_key].extend(item_list)
                    else:
                        remapped[default_show_tier].extend(item_list)
                items_by_tier = remapped

        # Determine Tier Order
        tier_order = meta.get("tier_order", [])
        if not tier_order:
            tier_order = sorted(items_by_tier.keys(), key=tier_num_from_label)
        
        used_tiers = set(items_by_tier.keys())
        for t in used_tiers:
            if t not in tier_order:
                tier_order.append(t)

        block_counter = 0
        
        for t_lbl in tier_order:
            if t_lbl not in category_data: continue

            items = items_by_tier.get(t_lbl, [])
            tier_entry = category_data[t_lbl]

            # Skip tiers excluded for current mode (e.g. Chaos Recipe in ruthless)
            if MODE in tier_entry.get("excluded_modes", []):
                continue

            is_hide = tier_entry.get("is_hide_tier", False)
            tnum = tier_num_from_label(t_lbl)
            # Honor explicit theme.Tier for tiers with non-standard label names (e.g. "Camp Bows Early")
            theme_tier_override = tier_entry.get("theme", {}).get("Tier")
            if theme_tier_override is not None:
                tnum = theme_tier_override
            ttheme = theme_ref.get(f"Tier {tnum}", {})
            base_text_col = parse_rgba(ttheme.get("TextColor"))
            base_border_col = parse_rgba(ttheme.get("BorderColor"))
            base_background_col = parse_rgba(ttheme.get("BackgroundColor", "0 0 0 255"))
            base_play_eff = ttheme.get("PlayEffect")
            base_mini_icon = ttheme.get("MinimapIcon")

            # --- Class-Condition Mode (e.g. _campaign/Armour.json) ---
            if tier_entry.get("class_condition"):
                tier_conditions = tier_entry.get("conditions", {})
                if not tier_conditions:
                    continue  # No conditions defined — skip this tier
                # Use theme tier from tier_entry directly (label-based tnum is unreliable for custom keys)
                theme_tnum = tier_entry.get("theme", {}).get("Tier", tnum)
                ttheme = theme_ref.get(f"Tier {theme_tnum}", ttheme)
                base_text_col = parse_rgba(ttheme.get("TextColor"))
                base_border_col = parse_rgba(ttheme.get("BorderColor"))
                base_background_col = parse_rgba(ttheme.get("BackgroundColor", "0 0 0 255"))
                base_play_eff = ttheme.get("PlayEffect")
                base_mini_icon = ttheme.get("MinimapIcon")
                block_index += 1
                tier_display = tier_entry.get("localization", {}).get("en") or t_lbl
                out_lines.append(f"\n#==[{block_index:05d}]- {item_class_header} -{tier_display} {loc_cat} - Class Condition==")
                cmd = HIDE_CMD if is_hide else "Show"
                block_lines = [f'{cmd}']
                for key, val in tier_conditions.items():
                    if isinstance(val, list):
                        # Repeated condition lines (AND), e.g. two HasInfluence lines
                        for v in val:
                            block_lines.append(f"    {key} {v}")
                    elif val.startswith("RANGE "):
                        parts = val.split()
                        block_lines.append(f"    {key} {parts[1]} {parts[2]}")
                        block_lines.append(f"    {key} {parts[3]} {parts[4]}")
                    elif key == "Rarity":
                        clean_val = val[2:].strip() if val.strip().startswith("==") else val
                        block_lines.append(f"    {key} {clean_val}")
                    else:
                        block_lines.append(f"    {key} {val}")
                block_lines += [
                    f'    SetFontSize {ttheme.get("FontSize", DEFAULT_FONT_SIZE)}',
                    f'    SetTextColor {base_text_col}',
                    f'    SetBorderColor {base_border_col}',
                    f'    SetBackgroundColor {base_background_col}'
                ]
                sound_line = resolve_sound(tier_entry, sound_map)
                if sound_line:
                    block_lines.append(f"    {sound_line}")
                if base_play_eff:
                    block_lines.append(f"    PlayEffect {base_play_eff}")
                if base_mini_icon:
                    block_lines.append(f"    MinimapIcon {base_mini_icon}")
                out_lines.append("\n".join(block_lines) + "\n")
                continue  # Skip normal BaseType processing for this tier

            all_rules = map_doc.get("rules", [])
            
            # --- AUTO-INJECT SOUND RULES FROM MAP ---
            bt_sounds = sound_map.get("basetype_sounds", {})
            for item_name in items:
                if item_name in bt_sounds:
                    s_data = bt_sounds[item_name]
                    # Check if a rule already targets this item specifically
                    already_handled = any(item_name in r.get("targets", []) for r in all_rules)
                    if not already_handled:
                        all_rules.append({
                            "targets": [item_name],
                            "overrides": { "PlayAlertSound": [s_data["file"], s_data["volume"]] },
                            "comment": f"__AUTO_SOUND__:{item_name}"
                        })
            # -----------------------------------------

            pending_items = set(items)
            
            rule_counter = 0
            for rule in all_rules:
                if rule.get("disabled"): continue
                
                rule_targets = rule.get("targets", [])
                rule_tier_override = rule.get("overrides", {}).get("Tier")
                apply_to_tier = rule.get("applyToTier", False)
                match_modes = rule.get("targetMatchModes", {})
                
                rule_matches = []

                if rule_tier_override:
                    if rule_tier_override == t_lbl:
                        if apply_to_tier:
                            rule_matches = list(pending_items)
                        elif rule_targets:
                            # Strict instruction: If rule targets this tier, pull it in!
                            rule_matches = rule_targets
                        else:
                            continue
                    else:
                        # Rule is for another tier. Ignore it in this tier loop.
                        continue
                else:
                    # No tier override: only applies to items native to this tier loop
                    if rule_targets:
                        rule_matches = [item for item in rule_targets if item in pending_items]
                        if not rule_matches: continue
                    else:
                        continue
                
                if not rule_matches: continue

                exact_group = []
                partial_group = []
                for m in rule_matches:
                    mode = match_modes.get(m, "exact")
                    if mode == "exact": exact_group.append(m)
                    else: partial_group.append(m)

                for subgroup, mode_label, is_strict in [(exact_group, "Exact", True), (partial_group, "Partial", False)]:
                    if not subgroup: continue
                    
                    block_index += 1
                    
                    r_over = rule.get("overrides", {})
                    
                    raw_comment = rule.get('comment', '')
                    if raw_comment.startswith("__AUTO_SOUND__:"):
                        # Implicit Auto-Sound Rule
                        item_key = raw_comment.split(":", 1)[1].strip()
                        item_name_local = item_trans.get(item_key, item_key)
                        
                        rule_part = f"{tr('Auto-Sound')}：{item_name_local}"
                    else:
                        # Explicit User Rule
                        rule_counter += 1
                        rule_name = raw_comment or tr('Rule')
                        rule_part = f"#{rule_counter} {rule_name}"

                    final_mode = tr(mode_label)
                    tier_display_r = tier_entry.get("localization", {}).get("en") or f"Tier {tnum}"
                    out_lines.append(f"\n#==[{block_index:05d}]- {item_class_header} -{tier_display_r} {loc_cat} - {rule_part} - {final_mode}==")
                    
                    joined = '" "'.join(subgroup)
                    cmd = HIDE_CMD if is_hide else "Show"
                    bt_operator = " == " if is_strict else " "
                    
                    block_lines = [
                        f'{cmd}',
                        f'    BaseType{bt_operator}"{joined}"'
                    ]
                    
                    extra_conditions = rule.get("conditions")
                    if extra_conditions:
                        for key, val in extra_conditions.items():
                            if isinstance(val, list):
                                # Repeated condition lines (AND), e.g. two HasInfluence lines
                                for v in val:
                                    block_lines.append(f"    {key} {v}")
                            elif val.startswith("RANGE "):
                                parts = val.split(" ")
                                if len(parts) >= 5:
                                    block_lines.append(f"    {key} {parts[1]} {parts[2]}")
                                    block_lines.append(f"    {key} {parts[3]} {parts[4]}")
                            elif key == "Rarity":
                                clean_val = val[2:].strip() if val.strip().startswith("==") else val
                                block_lines.append(f"    {key} {clean_val}")
                            else:
                                block_lines.append(f"    {key} {val}")

                    if rule.get("raw"):
                        for r_line in rule.get("raw").split('\n'):
                            if r_line.strip(): block_lines.append(f"    {r_line.strip()}")

                    block_lines += [
                        f'    SetFontSize {r_over.get("FontSize", ttheme.get("FontSize", DEFAULT_FONT_SIZE))}',
                        f'    SetTextColor {parse_rgba(r_over.get("TextColor"), base_text_col)}',
                        f'    SetBorderColor {parse_rgba(r_over.get("BorderColor"), base_border_col)}',
                        f'    SetBackgroundColor {parse_rgba(r_over.get("BackgroundColor"), base_background_col)}'
                    ]
                    
                    sound_line = resolve_sound(tier_entry, sound_map, r_over.get("PlayAlertSound"))
                    if sound_line:  block_lines.append(f"    {sound_line}")
                    if r_over.get("PlayEffect", base_play_eff): block_lines.append(f"    PlayEffect {r_over.get('PlayEffect', base_play_eff)}")
                    if r_over.get("MinimapIcon", base_mini_icon): block_lines.append(f"    MinimapIcon {r_over.get('MinimapIcon', base_mini_icon)}")
                    
                    out_lines.append("\n".join(block_lines) + "\n")

                for m in rule_matches:
                    pending_items.discard(m)

            # 3. Base Block for Remaining Items
            if pending_items:
                match_modes = meta.get("match_modes", {})
                
                exact_pending = []
                partial_pending = []
                for item in sorted(list(pending_items)):
                    if match_modes.get(item, "exact") == "exact":
                        exact_pending.append(item)
                    else:
                        partial_pending.append(item)

                for subgroup, mode_label, is_strict in [(exact_pending, "Exact", True), (partial_pending, "Partial", False)]:
                    if not subgroup: continue
                    
                    block_index += 1
                    final_mode = tr(mode_label)
                    base_label = tr("Base")
                    tier_display = tier_entry.get("localization", {}).get("en") or f"Tier {tnum}"
                    out_lines.append(f"\n#==[{block_index:05d}]- {item_class_header} -{tier_display} {loc_cat} - {base_label} - {final_mode}==")
                    
                    joined = '" "'.join(subgroup)
                    cmd = HIDE_CMD if is_hide else "Show"
                    bt_operator = " == " if is_strict else " "
                    
                    block_lines = [
                        f'{cmd}',
                        f'    BaseType{bt_operator}"{joined}"',
                    ]

                    # Emit tier-level conditions (e.g. ItemLevel, Rarity, DropLevel)
                    tier_conditions = tier_entry.get("conditions", {})
                    for key, val in tier_conditions.items():
                        if isinstance(val, list):
                            # Repeated condition lines (AND), e.g. two HasInfluence lines
                            for v in val:
                                block_lines.append(f"    {key} {v}")
                        elif val.startswith("RANGE "):
                            parts = val.split()
                            block_lines.append(f"    {key} {parts[1]} {parts[2]}")
                            block_lines.append(f"    {key} {parts[3]} {parts[4]}")
                        elif key == "Rarity":
                            clean_val = val[2:].strip() if val.strip().startswith("==") else val
                            block_lines.append(f"    {key} {clean_val}")
                        else:
                            block_lines.append(f"    {key} {val}")

                    block_lines += [
                        f'    SetFontSize {ttheme.get("FontSize", DEFAULT_FONT_SIZE)}',
                        f'    SetTextColor {base_text_col}',
                        f'    SetBorderColor {base_border_col}',
                        f'    SetBackgroundColor {base_background_col}'
                    ]

                    sound_line = resolve_sound(tier_entry, sound_map)
                    if sound_line:  block_lines.append(f"    {sound_line}")
                    if base_play_eff: block_lines.append(f"    PlayEffect {base_play_eff}")
                    if base_mini_icon: block_lines.append(f"    MinimapIcon {base_mini_icon}")
                    
                    out_lines.append("\n".join(block_lines) + "\n")

    overview.append("#========================================\n")
    final_text = "\n".join(overview) + "\n" + "\n".join(out_lines) + "\n"
    OUTPUT_FILE.write_text(final_text, encoding="utf-8")
    print(f"[OK] Complete filter generated at {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_filter()
