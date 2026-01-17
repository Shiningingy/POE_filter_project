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
OUTPUT_FILE = (PROJECT_ROOT / "filter_generation" / "complete_filter.filter").resolve()

# Folder holding custom sound files (for sharket_sound_id)
SOUND_FILE_PATH = Path("sound_files")

# Default font size if you don't carry it in the theme
DEFAULT_FONT_SIZE = 32

_rgba_re = re.compile(r"rgba?(\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?")

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

    sb = tier_entry.get("sound", {}) or {}
    # 1. Sharket Sound
    if sb.get("sharket_sound_id") and sound_map and sb["sharket_sound_id"] in sound_map:
        s = sound_map[sb["sharket_sound_id"]]
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

def show_block(cat_zh, tier_short, item_class, basetypes,
               font_size, text_color, border_color, background_color, sound_line,
               play_effect=None, minimap_icon=None, extra_conditions=None, raw_code=None, is_hide=False):
    
    cmd = "Hide" if is_hide else "Show"
    lines = [
        f'{cmd} #{cat_zh}-{tier_short}',
        f'    Class "{item_class}"'
    ]
    
    # Only add BaseType if we have specific targets
    if basetypes:
        joined = '" "'.join(basetypes)
        lines.append(f'    BaseType "{joined}"')
    
    if is_hide:
        # Simplified block for hiding
        return "\n".join(lines) + "\n"

    # 1. Extra Conditions (Handle RANGE and Operator-less keys)
    if extra_conditions:
        for key, val in extra_conditions.items():
            if val.startswith("RANGE "):
                parts = val.split(" ")
                if len(parts) >= 5:
                    lines.append(f"    {key} {parts[1]} {parts[2]}")
                    lines.append(f"    {key} {parts[3]} {parts[4]}")
            elif key == "Rarity":
                # Strip operator if present
                clean_val = val.replace("==", "").replace("=", "").strip()
                lines.append(f"    {key} {clean_val}")
            else:
                lines.append(f"    {key} {val}")

    # 2. Raw Code (Indented)
    if raw_code:
        for r_line in raw_code.split('\n'):
            if r_line.strip():
                lines.append(f"    {r_line.strip()}")

    # 3. Visuals
    lines += [
        f'    SetFontSize {font_size}',
        f'    SetTextColor {text_color}',
        f'    SetBorderColor {border_color}',
        f'    SetBackgroundColor {background_color}'
    ]
    if sound_line:  lines.append(f"    {sound_line}")
    if play_effect: lines.append(f"    PlayEffect {play_effect}")
    if minimap_icon: lines.append(f"    MinimapIcon {minimap_icon}")
    
    return "\n".join(lines) + "\n"

# ---------- MAIN ----------
def generate_filter():
    theme_data = json.loads(Path(THEME_FILE).read_text(encoding="utf-8"))
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

    area_counter = 0
    # Process all JSON files in base_mapping
    for map_file in sorted(BASE_MAPPING_DIR.rglob("*.json")):
        rel_path = map_file.relative_to(BASE_MAPPING_DIR)
        tier_file = TIER_DEF_DIR / rel_path
        
        if not tier_file.exists():
            continue

        tier_doc = json.loads(tier_file.read_text(encoding="utf-8"))
        map_doc  = json.loads(map_file.read_text(encoding="utf-8"))
        
        category_key = next((k for k in tier_doc if not k.startswith("//")), None)
        if not category_key: continue
        
        category_data = tier_doc[category_key]
        meta = category_data.get("_meta", {})
        loc_en = meta.get("localization", {}).get("en", category_key)
        loc_zh = meta.get("localization", {}).get("ch", loc_en)
        item_class = meta.get("item_class", category_key)
        theme_cat_key = meta.get("theme_category", category_key)
        theme_ref = theme_data.get(theme_cat_key, theme_data.get("Currency", {})) # Fallback to Currency theme if missing

        area_counter += 1
        area_index = area_counter * 10000
        overview.append(f"#  [{area_index:05d}] {loc_zh} {loc_en}")
        out_lines.append(header_line(area_index, f"{loc_zh} {loc_en}"))

        # Map items to their tiers
        mapping = map_doc.get("mapping", {})
        items_by_tier = defaultdict(list)
        for item_name, t_lbl in mapping.items():
            items_by_tier[t_lbl].append(item_name)

        # Determine Tier Order
        # Use _meta["tier_order"] if available, otherwise sort numerically
        tier_order = meta.get("tier_order", [])
        if not tier_order:
            tier_order = sorted(items_by_tier.keys(), key=tier_num_from_label)
        
        # Ensure all used tiers are in the order list
        used_tiers = set(items_by_tier.keys())
        for t in used_tiers:
            if t not in tier_order:
                tier_order.append(t)

        block_counter = 0
        
        for t_lbl in tier_order:
            if t_lbl not in category_data: continue 
            
            items = items_by_tier.get(t_lbl, [])
            tier_entry = category_data[t_lbl]
            is_hide = tier_entry.get("is_hide_tier", False)
            tnum = tier_num_from_label(t_lbl)
            
            # Base Theme for this Tier
            ttheme = theme_ref.get(f"Tier {tnum}", {})
            base_text_col = parse_rgba(ttheme.get("TextColor"))
            base_border_col = parse_rgba(ttheme.get("BorderColor"))
            base_background_col = parse_rgba(ttheme.get("BackgroundColor", "0 0 0 255"))
            base_play_eff = ttheme.get("PlayEffect")
            base_mini_icon = ttheme.get("MinimapIcon")

            all_rules = map_doc.get("rules", [])
            pending_items = set(items)
            
            for rule in all_rules:
                if rule.get("disabled"): continue
                
                rule_targets = rule.get("targets", [])
                rule_tier_override = rule.get("overrides", {}).get("Tier")
                
                # A rule applies to this TIER block if:
                # 1. It explicitly targets this tier via override
                # 2. It has targets that exist in this tier (and no tier override)
                
                matches = []
                is_class_wide = False

                if rule_tier_override:
                    if rule_tier_override == t_lbl:
                        if rule_targets:
                            matches = [item for item in rule_targets if item in pending_items]
                        else:
                            is_class_wide = True # Targets entire class within this tier
                    else:
                        continue # Rule targets a different tier
                else:
                    # No tier override, match items by name
                    if rule_targets:
                        matches = [item for item in rule_targets if item in pending_items]
                        if not matches: continue
                    else:
                        continue # Rule has no targets and no tier override - skip or handle as global?
                
                if not matches and not is_class_wide:
                    continue

                # Generate Block
                block_counter += 1
                tier_index = area_index + block_counter
                t_short = f"T{tnum}"
                
                r_over = rule.get("overrides", {})
                
                out_lines.append(header_line(tier_index, f"{t_lbl} - Rule: {rule.get('comment', 'Custom')}"))
                out_lines.append(show_block(
                    loc_zh, t_short, item_class, matches, # empty matches if is_class_wide
                    r_over.get("FontSize", ttheme.get("FontSize", DEFAULT_FONT_SIZE)),
                    parse_rgba(r_over.get("TextColor"), base_text_col),
                    parse_rgba(r_over.get("BorderColor"), base_border_col),
                    parse_rgba(r_over.get("BackgroundColor"), base_background_col),
                    resolve_sound(tier_entry, sound_map, r_over.get("PlayAlertSound")),
                    r_over.get("PlayEffect", base_play_eff),
                    r_over.get("MinimapIcon", base_mini_icon),
                    rule.get("conditions"),
                    rule.get("raw"),
                    is_hide=is_hide
                ))
                
                # Remove matched items from pending
                if not is_class_wide:
                    for m in matches:
                        pending_items.discard(m)
                else:
                    # If it's class wide for this tier, we've covered everything!
                    pending_items.clear()

            # 3. Base Block for Remaining Items
            if pending_items:
                block_counter += 1
                tier_index = area_index + block_counter
                t_short = f"T{tnum}"
                out_lines.append(header_line(tier_index, f"{t_lbl} {loc_zh}"))
                
                out_lines.append(show_block(
                    loc_zh, t_short, item_class, sorted(list(pending_items)),
                    ttheme.get("FontSize", DEFAULT_FONT_SIZE),
                    base_text_col, base_border_col, base_background_col,
                    resolve_sound(tier_entry, sound_map),
                    base_play_eff, base_mini_icon,
                    is_hide=is_hide
                ))

    overview.append("#========================================\n")
    final_text = "\n".join(overview) + "\n" + "\n".join(out_lines) + "\n"
    OUTPUT_FILE.write_text(final_text, encoding="utf-8")
    print(f"✅ Complete filter generated at {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_filter()