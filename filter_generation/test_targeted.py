import json
import re
import os
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
OUTPUT_FILE = (PROJECT_ROOT / "filter_generation" / "targeted_test.filter").resolve()

# Target files to test
TARGET_FILES = [
    "Currency/General.json",
    "Equipment/Special/Influenced.json"
]

DEFAULT_FONT_SIZE = 32
_rgba_re = re.compile(r"rgba?(d+),\s*(d+),\s*(d+)(?:,\s*(d+))?")

def parse_rgba(value, default="255 255 255 255"):
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
    if override_sound and isinstance(override_sound, list):
        file, vol = override_sound
        if file.startswith("Default/AlertSound"):
            num = re.search(r"d+", file).group(0)
            return f"PlayAlertSound {num} {vol}"
        else:
            win_path = file.replace("/", "\\")
            return f'CustomAlertSound "sound_files\\{win_path}" {vol}'

    sb = tier_entry.get("sound", {}) or {}
    if sb.get("sharket_sound_id") and sound_map and sb["sharket_sound_id"] in sound_map:
        s = sound_map[sb["sharket_sound_id"]]
        win_path = s["file"].replace("/", "\\")
        return f'CustomAlertSound "sound_files\\{win_path}" {s["volume"]}'
    if sb.get("default_sound_id") is not None and sb["default_sound_id"] != -1:
        return f'PlayAlertSound {sb["default_sound_id"]} 300'
    return None

def tier_num_from_label(label):
    if "Tier 0" in label: return 0
    if "Hide" in label: return 9
    m = re.search(r"Tier\s+(d+)", label)
    return int(m.group(1)) if m else 99

def header_line(index, text):
    return f"\n#==[{index:05d}]-{text}=="

def generate_targeted():
    theme_data = json.loads(Path(THEME_FILE).read_text(encoding="utf-8"))
    sound_map = json.loads(Path(SOUND_MAP_FILE).read_text(encoding="utf-8"))
    out_lines = []
    
    # Process only target files
    for rel_path_str in TARGET_FILES:
        map_file = BASE_MAPPING_DIR / rel_path_str
        tier_file = TIER_DEF_DIR / rel_path_str
        
        print(f"Processing {rel_path_str}...")
        if not map_file.exists(): 
            print(f"  Missing map file: {map_file}")
            continue
        if not tier_file.exists():
            print(f"  Missing tier file: {tier_file}")
            continue

        tier_doc = json.loads(tier_file.read_text(encoding="utf-8"))
        map_doc  = json.loads(map_file.read_text(encoding="utf-8"))
        
        category_key = next((k for k in tier_doc if not k.startswith("//")), None)
        if not category_key: continue
        
        category_data = tier_doc[category_key]
        meta = category_data.get("_meta", {})
        loc_en = meta.get("localization", {}).get("en", category_key)
        item_class = meta.get("item_class", category_key)
        theme_cat_key = meta.get("theme_category", category_key)
        theme_ref = theme_data.get(theme_cat_key, theme_data.get("Currency", {}))

        out_lines.append(header_line(9999, f"TEST: {loc_en}"))

        mapping = map_doc.get("mapping", {})
        items_by_tier = defaultdict(list)
        
        # --- FIXED LOGIC FOR LIST TIERS ---
        for item_name, t_val in mapping.items():
            if isinstance(t_val, list):
                for t in t_val:
                    items_by_tier[t].append(item_name)
            else:
                items_by_tier[t_val].append(item_name)
        # ----------------------------------

        tier_order = meta.get("tier_order", [])
        if not tier_order:
            tier_order = sorted(items_by_tier.keys(), key=tier_num_from_label)
        
        used_tiers = set(items_by_tier.keys())
        for t in used_tiers:
            if t not in tier_order: tier_order.append(t)

        for t_lbl in tier_order:
            if t_lbl not in category_data: continue 
            
            items = items_by_tier.get(t_lbl, [])
            tier_entry = category_data[t_lbl]
            is_hide = tier_entry.get("is_hide_tier", False)
            tnum = tier_num_from_label(t_lbl)
            
            ttheme = theme_ref.get(f"Tier {tnum}", {})
            base_text_col = parse_rgba(ttheme.get("TextColor"))
            base_border_col = parse_rgba(ttheme.get("BorderColor"))
            base_background_col = parse_rgba(ttheme.get("BackgroundColor", "0 0 0 255"))
            base_play_eff = ttheme.get("PlayEffect")
            base_mini_icon = ttheme.get("MinimapIcon")

            all_rules = map_doc.get("rules", [])
            
            # --- INJECT TEST RULE ---
            if "General" in t_lbl: # Only for General category
                all_rules.append({
                    "targets": ["Divine Orb"],
                    "overrides": { "PlayAlertSound": ["Sharket_Sound_1.mp3", 300], "TextColor": "255 0 255 255" },
                    "comment": "Test Override for Divine Orb"
                })
            # ------------------------

            pending_items = set(items)
            
            # 1. Rules
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
                            rule_matches = [item for item in rule_targets if item in pending_items]
                        else: continue
                    else: continue
                else:
                    if rule_targets:
                        rule_matches = [item for item in rule_targets if item in pending_items]
                        if not rule_matches: continue
                    else: continue
                
                if not rule_matches: continue

                exact_group = []
                partial_group = []
                for m in rule_matches:
                    mode = match_modes.get(m, "exact")
                    if mode == "exact": exact_group.append(m)
                    else: partial_group.append(m)

                for subgroup, mode_label, is_strict in [(exact_group, "Exact", True), (partial_group, "Partial", False)]:
                    if not subgroup: continue
                    
                    r_over = rule.get("overrides", {})
                    out_lines.append(f"\n# Rule Block: {rule.get('comment', 'Custom')} ({mode_label})")
                    
                    joined = '" "'.join(subgroup)
                    cmd = "Hide" if is_hide else "Show"
                    bt_operator = " == " if is_strict else " "
                    
                    block_lines = [
                        f'{cmd}',
                        f'    Class "{item_class}"',
                        f'    BaseType{bt_operator}"{joined}"'
                    ]
                    
                    if rule.get("conditions"):
                        for key, val in rule.get("conditions").items():
                            block_lines.append(f"    {key} {val}")

                    if rule.get("raw"):
                        for r_line in rule.get("raw", "").split('\n'):
                            if r_line.strip(): block_lines.append(f"    {r_line.strip()}")
                            
                    block_lines += [
                        f'    SetFontSize {r_over.get("FontSize", ttheme.get("FontSize", DEFAULT_FONT_SIZE))}',
                        f'    SetTextColor {parse_rgba(r_over.get("TextColor"), base_text_col)}',
                        f'    SetBorderColor {parse_rgba(r_over.get("BorderColor"), base_border_col)}',
                        f'    SetBackgroundColor {parse_rgba(r_over.get("BackgroundColor"), base_background_col)}'
                    ]
                    sound_line = resolve_sound(tier_entry, sound_map, r_over.get("PlayAlertSound"))
                    if sound_line: block_lines.append(f"    {sound_line}")
                    
                    out_lines.append("\n".join(block_lines))

                for m in rule_matches:
                    pending_items.discard(m)

            # 2. Base Block
            if pending_items:
                match_modes = meta.get("match_modes", {})
                exact_pending = []
                partial_pending = []
                for item in sorted(list(pending_items)):
                    if match_modes.get(item, "exact") == "exact": exact_pending.append(item)
                    else: partial_pending.append(item)

                for subgroup, mode_label, is_strict in [(exact_pending, "Exact", True), (partial_pending, "Partial", False)]:
                    if not subgroup: continue
                    
                    out_lines.append(f"\n# Base Block: {t_lbl} ({mode_label})")
                    joined = '" "'.join(subgroup)
                    cmd = "Hide" if is_hide else "Show"
                    bt_operator = " == " if is_strict else " "
                    
                    block_lines = [
                        f'{cmd}',
                        f'    Class "{item_class}"',
                        f'    BaseType{bt_operator}"{joined}"',
                        f'    SetFontSize {ttheme.get("FontSize", DEFAULT_FONT_SIZE)}',
                        f'    SetTextColor {base_text_col}',
                        f'    SetBorderColor {base_border_col}',
                        f'    SetBackgroundColor {base_background_col}'
                    ]
                    sound_line = resolve_sound(tier_entry, sound_map)
                    if sound_line: block_lines.append(f"    {sound_line}")
                    
                    out_lines.append("\n".join(block_lines))

    OUTPUT_FILE.write_text("\n".join(out_lines), encoding="utf-8")
    print(f"✅ Targeted test generated at {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_targeted()
