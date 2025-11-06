import json
import re
from pathlib import Path
from collections import defaultdict

# ===========================
# CONFIG
# ===========================
TIER_DEF_DIR = Path(r"data\tier_definition")
BASE_MAPPING_DIR = Path(r"data\base_mapping")
THEME_FILE = Path(r"data\theme\sharket\sharket_theme.json")
OUTPUT_FILE = Path("complete_filter.filter")

# Folder holding custom sound files (for sharket_sound_id)
SOUND_FILE_PATH = Path("Sharket掉落音效")

# Build only these sections and in this order (base file names, no .json).
# Example: "normal_currency" -> tier_definitions/normal_currency.json + base_mapping/normal_currency.json
BUILD_ORDER = [
    # Add the sections you want, in order:
    # "normal_currency",
    # "currency_essence",
    # "currency_oil",
    # "wormborngifts",
    "grafts",
    "wormborngifts"
]

# Default font size if you don't carry it in the theme
DEFAULT_FONT_SIZE = 45


_rgba_re = re.compile(r"rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)")

# ---------- UTILITIES ----------
def parse_rgba(value,default="255 255 255 255"):
    """Return 'R G B A' string from rgba() string or [r,g,b,a] list. Fallback to white."""
    if isinstance(value, list) and len(value) >= 3:
        r, g, b = value[:3]
        a = value[3] if len(value) > 3 else 255
        return f"{int(r)} {int(g)} {int(b)} {int(a)}"
    if isinstance(value, str):
        m = _rgba_re.match(value)
        if m:
            r, g, b, a = m.groups()
            return f"{r} {g} {b} {a or 255}"
        # Hex (#RRGGBB or #RRGGBBAA)
        if value.startswith("#"):
            hexv = value[1:]
            if len(hexv) in (6, 8):
                r = int(hexv[0:2], 16)
                g = int(hexv[2:4], 16)
                b = int(hexv[4:6], 16)
                a = int(hexv[6:8], 16) if len(hexv) == 8 else 255
                return f"{r} {g} {b} {a}"
    return default

def resolve_sound(tier_entry, custom_sound=None):
    """Priority: explicit custom → sharket → default"""
    if custom_sound:
        if "default_sound_id" in custom_sound:
            return f'PlayAlertSound {custom_sound["default_sound_id"]} 300'
        if "custom_path" in custom_sound:
            return f'CustomAlertSound "{custom_sound["custom_path"]}" 300'
        if "sharket_sound_id" in custom_sound:
            return f'CustomAlertSound "{SOUND_FILE_PATH / custom_sound["sharket_sound_id"]}.mp3" 300'
        return None
    sb = tier_entry.get("sound", {}) or {}
    if sb.get("sharket_sound_id") is not None:
        return f'CustomAlertSound "{SOUND_FILE_PATH / sb["sharket_sound_id"]}.mp3" 300'
    if sb.get("default_sound_id") is not None:
        return f'PlayAlertSound {sb["default_sound_id"]} 300'
    return None

def tier_num_from_label(label):
    m = re.search(r"Tier\s+(\d+)", label)
    return int(m.group(1)) if m else 0

def header_line(index, text):
    return f"#==[{index:05d}]-{text}=="

def minimal_block(cat_zh, tier_short, item_class, basetypes):
    joined = '" "'.join(basetypes)
    return (
        f'#Minimal #隐藏-{cat_zh}-{tier_short} {cat_zh}\n'
        f'#    Class "{item_class}"\n'
        f'#    BaseType "{joined}"\n'
    )

def show_block(cat_zh, tier_short, item_class, basetypes,
               font_size, text_color, border_color, sound_line,
               play_effect=None, minimap_icon=None, extra_conditions=None):
    joined = '" "'.join(basetypes)
    lines = [
        f'Show #{cat_zh}-{tier_short}{cat_zh}',
        f'  Class "{item_class}"',
        f'  BaseType "{joined}"'
    ]
    if extra_conditions:
        for cond_key, cond_val in extra_conditions.items():
            lines.append(f"  {cond_key} {cond_val}")
    lines += [
        f'  SetFontSize {font_size}',
        f'  SetTextColor {text_color}',
        f'  SetBorderColor {border_color}',
    ]
    if sound_line:  lines.append(f"  {sound_line}")
    if play_effect: lines.append(f"  PlayEffect {play_effect}")
    if minimap_icon: lines.append(f"  MinimapIcon {minimap_icon[0]} {minimap_icon[1]} {minimap_icon[2]}")
    return "\n".join(lines) + "\n"

def apply_rules(mapping_data):
    """
    Expand mapping into list of (BaseType, Tier, Condition, Overrides, Comment)
    using optional 'rules' section.
    """
    mapping = mapping_data.get("mapping", {})
    rules   = mapping_data.get("rules", [])
    expanded = []
    for bt, tier_label in mapping.items():
        expanded.append((bt, tier_label, None, {}, None))  # default entry
        for rule in rules:
            if bt in rule.get("targets", []):
                conds = rule.get("conditions", {})
                over  = rule.get("overrides", {})
                comment = rule.get("comment", "")
                tier_override = over.get("Tier", tier_label)
                expanded.append((bt, tier_override, conds, over, comment))
    return expanded
# ---------- MAIN ----------
def main():
    theme_data = json.loads(Path(THEME_FILE).read_text(encoding="utf-8"))
    overview = [
        "#========================================",
        "#  FILTER OVERVIEW",
        "#========================================",
        "#  [00000] 自定义规则"
    ]

    out_lines = []

    # Insert the [00000] Custom Rules anchor
    out_lines.append(header_line(0, "自定义规则"))
    out_lines.append("#在此添加自定义规则将会覆盖所有过滤器设定.\n")

    area_counter = 0
    for name in (BUILD_ORDER or sorted(p.stem for p in TIER_DEF_DIR.glob("*.json"))):
        tier_file = TIER_DEF_DIR / f"{name}.json"
        map_file  = BASE_MAPPING_DIR / f"{name}.json"
        if not (tier_file.exists() and map_file.exists()):
            print(f"⚠️ Missing pair for {name}, skipping.")
            continue

        tier_doc = json.loads(tier_file.read_text(encoding="utf-8"))
        map_doc  = json.loads(map_file.read_text(encoding="utf-8"))
        # remove comment-like keys
        tier_doc = {k:v for k,v in tier_doc.items() if not k.startswith("//")}
        category = next(iter(tier_doc))
        tier_def = tier_doc[category]
        meta = tier_def.get("_meta", {})
        loc_en = meta.get("localization", {}).get("en", category)
        loc_zh = meta.get("localization", {}).get("zh", loc_en)
        item_class = meta.get("item_class", category)
        theme_key  = meta.get("theme_category", name)
        theme_ref  = theme_data.get(theme_key, {})

        area_counter += 1
        area_index = area_counter * 10000
        overview.append(f"#  [{area_index:05d}] {loc_zh} {loc_en}")
        out_lines.append(header_line(area_index, f"{loc_zh} {loc_en}"))

        # --- Expand mapping with rules ---
        entries = apply_rules(map_doc)
        # group entries by Tier label
        grouped = defaultdict(list)
        for bt, tier_lbl, conds, over, comment in entries:
            grouped[tier_lbl].append((bt, conds, over, comment))

        # order tiers numerically
        tier_labels = sorted(grouped.keys(), key=tier_num_from_label)
        for t_lbl in tier_labels:
            tnum = tier_num_from_label(t_lbl)
            tier_index = area_index + (tnum+1)*100
            t_short = f"T{tnum}"
            out_lines.append(header_line(tier_index, f"{t_lbl} {loc_zh}"))
            ttheme = theme_ref.get(f"Tier {tnum}", {})
            base_text_col  = parse_rgba(ttheme.get("TextColor", "rgba(255,255,255,255)"))
            base_border_col= parse_rgba(ttheme.get("BorderColor", "rgba(255,255,255,255)"))
            play_eff       = ttheme.get("PlayEffect")
            mini_icon      = ttheme.get("MinimapIcon")

            entries_sorted = sorted(grouped[t_lbl], key=lambda x: 0 if x[1] else 1)
            # ---- NEW GROUPING ----
            group_buckets = defaultdict(list)
            for bt, conds, over, comment in entries_sorted:
                text_color  = parse_rgba(over.get("TextColor", -1), base_text_col)
                border_color= parse_rgba(over.get("BorderColor", -1), base_border_col)
                font_size   = over.get("FontSize", DEFAULT_FONT_SIZE)
                sound_line  = resolve_sound(tier_def.get(t_lbl, {}), over.get("custom_sound"))
                eff         = over.get("PlayEffect", play_eff)
                icon        = over.get("MinimapIcon", mini_icon)
                hideable_tier = tier_def.get(t_lbl, {}).get("hideable", False)
                hideable_over = over.get("hideable", None)
                hideable = hideable_over if hideable_over is not None else hideable_tier

                key = json.dumps({
                    "TextColor": text_color,
                    "BorderColor": border_color,
                    "FontSize": font_size,
                    "Sound": sound_line,
                    "PlayEffect": eff,
                    "MinimapIcon": icon,
                    "Hideable": hideable,
                    "Condition": conds or {}
                }, sort_keys=True)
                group_buckets[key].append((bt, conds, comment))

            block_count = 1
            for key, items in group_buckets.items():
                config = json.loads(key)
                bts = [i[0] for i in items]
                conds = items[0][1] if items else None
                hideable = config.get("Hideable", False)
                idx = tier_index + block_count
                block_count += 1
                cmt = " ".join([i[2] for i in items if i[2]]) or f"{t_lbl} Group"
                if conds:
                    out_lines.append(header_line(idx, cmt))
                if hideable:
                    out_lines.append(minimal_block(loc_zh, t_short, item_class, bts))
                out_lines.append(show_block(
                    loc_zh, t_short, item_class, bts,
                    config["FontSize"],
                    config["TextColor"],
                    config["BorderColor"],
                    config["Sound"],
                    config["PlayEffect"],
                    config["MinimapIcon"],
                    conds
                ))

    overview.append("#========================================\n")
    text = "\n".join(overview) + "\n" + "\n".join(out_lines) + "\n"
    OUTPUT_FILE.write_text(text, encoding="utf-8")
    print(f"✅ Complete filter generated at {OUTPUT_FILE}")

if __name__ == "__main__":
    main()