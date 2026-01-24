import re
import json
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
DATA_FILE = PROJECT_ROOT / "data" / "styles"
OUTPUT_DIR = PROJECT_ROOT / "filter_generation" / "data" / "theme"

# (Html Row Name, Category Group, Tier Key)
RAW_MAPPING = [
    # --- TEMPLATES (Global Source of Truth) ---
    ("Currency God Tier 1", "Templates", "Tier 0"),
    ("Currency High Tier 2", "Templates", "Tier 1"),
    ("Currency Mid Tier 2", "Templates", "Tier 2"),
    ("Currency Basic Tier 1", "Templates", "Tier 3"),
    ("Currency Basic Tier 2", "Templates", "Tier 4"),
    ("Currency Basic Tier 4", "Templates", "Tier 5"),
    ("Tier 2 rares", "Templates", "Tier 6"),
    ("Tier 3 rares", "Templates", "Tier 7"),
    ("Hide Lower Rares in High Maps 4", "Templates", "Tier 8"),

    # --- CURRENCY ---
    ("Currency God Tier 1", "Currency", "Tier 0"),
    ("Currency High Tier 2", "Currency", "Tier 1"),
    ("Currency Mid Tier 2", "Currency", "Tier 2"),
    ("Currency Basic Tier 1", "Currency", "Tier 3"),
    ("Currency Basic Tier 2", "Currency", "Tier 4"),
    ("Currency Basic Tier 4", "Currency", "Tier 5"),
    
    # --- MAPS ---
    ("Map appearance T16", "Maps", "Tier 0"),
    ("Map appearance T12", "Maps", "Tier 1"),
    ("Map appearance T9", "Maps", "Tier 2"),
    ("Map appearance T7", "Maps", "Tier 3"),
    ("Map appearance T2", "Maps", "Tier 4"),
    
    # --- FRAGMENTS ---
    ("Map Fragments T2", "Map Fragments", "Tier 1"), 
    ("Map Fragments T3", "Map Fragments", "Tier 2"),
    ("Breach Splinters & Legion Splinters T1", "Map Fragments", "Tier 0"),
    ("Betrayal Scarabs T2", "Map Fragments", "Tier 3"),
    
    # --- EQUIPMENT (Aggregated) ---
    # Uniques
    ("Uniques Tier 1", "Equipment", "Tier 0"),
    ("Uniques Tier 2", "Equipment", "Tier 1"),
    # Rares
    ("Rare rings/amulets T1", "Equipment", "Tier 2"),
    ("Rare rings/amulets T2", "Equipment", "Tier 3"),
    ("Tier 2 rares", "Equipment", "Tier 4"),
    ("Tier 3 rares", "Equipment", "Tier 5"),
    # Jewels
    ("Rare Jewels", "Equipment", "Tier 2"), 
    # Flasks
    ("Glassblower recipe top quality", "Equipment", "Tier 6")
]

# Note: In the final JSON, we might want to split Equipment into sub-types if the user wants granularity,
# but the request asked to "group those like currency to currency, equipment to equipment".
# So "Equipment" will be a broad category. 
# However, our internal structure uses "Body Armours", "Helmets" etc.
# If I map them ALL to "Equipment", the style resolver needs to know to look at "Equipment" for Body Armours.
# Currently `styleResolver` looks at `themeData[themeCategory]`.
# If `themeCategory` is "Body Armours", it won't find "Equipment".
#
# SOLUTION: I will map these styles to MULTIPLE categories in the output JSON.
# "Equipment" styles will be copied to "Body Armours", "Helmets", "Boots", "Gloves", "Weapons", "Jewellery".

EQUIPMENT_CATEGORIES = [
    "Body Armours", "Helmets", "Boots", "Gloves", "Shields", 
    "One Hand Axes", "One Hand Maces", "One Hand Swords", "Thrusting One Hand Swords", "Sceptres", "Staves", "Warstaves", "Two Hand Axes", "Two Hand Maces", "Two Hand Swords", "Wands", "Bows", "Claws", "Daggers", "Rune Daggers", "Quivers",
    "Amulets", "Rings", "Belts", "Uniques", "Jewels", "Abyss Jewels", "Flasks", "Life Flasks", "Mana Flasks", "Utility Flasks"
]

# Build Lookup Dictionary (One-to-Many)
LOOKUP = {}
for row, cat, tier in RAW_MAPPING:
    if row not in LOOKUP:
        LOOKUP[row] = []
    LOOKUP[row].append((cat, tier))

def parse_styles():
    print(f"Reading {DATA_FILE}...")
    content = DATA_FILE.read_text(encoding="utf-8")
    
    headers = re.findall(r'<th[^>]*>(.*?)</th>', content)
    style_names = [h.strip() for h in headers[1:] if h.strip()]
    print(f"Found {len(style_names)} styles.")
    
    rows = re.findall(r'<tr.*?>(.*?)</tr>', content)
    
    extracted_themes = {name: {} for name in style_names}
    
    for row in rows:
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row)
        if not cells: continue
        
        item_name_raw = cells[0]
        item_name = re.sub(r'<[^>]+>', '', item_name_raw).strip()
        
        matches = LOOKUP.get(item_name)
        if not matches: continue
        
        for category_group, tier in matches:
            for i, style_name in enumerate(style_names):
                if i + 1 >= len(cells): break
                cell_content = cells[i + 1]
                style_match = re.search(r'style="([^"]+)"', cell_content)
                if not style_match: continue
                
                style_obj = parse_css(style_match.group(1))
                if style_obj:
                    # Apply to the Group
                    if category_group == "Equipment":
                        for eq_cat in EQUIPMENT_CATEGORIES:
                            if eq_cat not in extracted_themes[style_name]: extracted_themes[style_name][eq_cat] = {}
                            extracted_themes[style_name][eq_cat][tier] = style_obj
                    
                    # Apply to specific group
                    if category_group not in extracted_themes[style_name]:
                        extracted_themes[style_name][category_group] = {}
                    extracted_themes[style_name][category_group][tier] = style_obj

    # Save
    for style_name, data in extracted_themes.items():
        safe_name = re.sub(r'[^a-zA-Z0-9]', '', style_name).lower()
        if not safe_name: continue
        
        theme_dir = OUTPUT_DIR / safe_name
        theme_dir.mkdir(parents=True, exist_ok=True)
        file_path = theme_dir / f"{safe_name}_theme.json"
        
        file_path.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")
        print(f"Updated {style_name}")

def parse_css(css):
    props = {}
    color_match = re.search(r'color:\s*(rgb\([^)]+\)|#[0-9a-fA-F]+)', css)
    if color_match: props["TextColor"] = convert_color(color_match.group(1))
        
    bg_match = re.search(r'background(?:-color)?:\s*(rgb\([^)]+\)|#[0-9a-fA-F]+)', css)
    if bg_match: props["BackgroundColor"] = convert_color(bg_match.group(1))
        
    border_match = re.search(r'border(?:-color)?:\s*(?:[^;]+)(rgb\([^)]+\)|#[0-9a-fA-F]+)', css)
    if not border_match:
         if "border:" in css:
             border_val_match = re.search(r'border:\s*[^;]+(rgb\([^)]+\)|#[0-9a-fA-F]+)', css)
             if border_val_match: props["BorderColor"] = convert_color(border_val_match.group(1))
    else: props["BorderColor"] = convert_color(border_match.group(1))

    fs_match = re.search(r'font-size:\s*([\d\.]+)px', css)
    if fs_match: props["FontSize"] = int(float(fs_match.group(1)))

    return props

def convert_color(val):
    if val.startswith("rgb"):
        nums = re.findall(r'\d+', val)
        if len(nums) >= 3:
            r, g, b = int(nums[0]), int(nums[1]), int(nums[2])
            return f"#{r:02x}{g:02x}{b:02x}FF".upper()
    elif val.startswith("#"):
        if len(val) == 4: return f"#{val[1]*2}{val[2]*2}{val[3]*2}FF".upper()
        if len(val) == 7: return f"{val}FF".upper()
    return val

if __name__ == "__main__":
    parse_styles()