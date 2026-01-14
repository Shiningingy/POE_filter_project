import json

def build_currency_section(tier_groups, theme, sound_map):
    """
    tier_groups: list of dicts {
        tier_key, 
        items: [item_names],
        group_text,
        text_ch,
        conditions,
        style_override,
        comment
    }
    """
    blocks = []
    style_map = {}

    for group_data in tier_groups:
        items = group_data["items"]
        if not items:
            continue

        # Visibility: true = Minimal (Ruthless Hide), false = Show
        is_minimal = group_data.get("hideable", False)
        visibility_keyword = "Minimal" if is_minimal else "Show"

        tier_key = group_data["tier_key"]
...
        # 3. Compose Block
        header_comment = f'{group_text}'
        if comment:
            header_comment += f' ({comment})'
            
        header = f'{visibility_keyword} #{header_comment}'
        
        # Format BaseType list: "Item 1" "Item 2"
        item_list_str = '" "'.join(items)
        lines = [header, f'    BaseType "{item_list_str}"']
        
        for key, val in conditions.items():
            lines.append(f'    {key} {val}')

        if group_data.get("raw"):
            lines.append(group_data["raw"])

        _apply_style(lines, style, sound)
        blocks.append("\n".join(lines))

    return "\n\n".join(blocks), style_map

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 8:
        return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    elif len(hex_color) == 6:
        return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return 0, 0, 0 

def _extract_style_data(style, sound):
    data = {}
    if "FontSize" in style: data["fontSize"] = style["FontSize"]
    if "BorderColor" in style: data["borderColor"] = hex_to_rgb(style["BorderColor"])
    if "TextColor" in style: data["textColor"] = hex_to_rgb(style["TextColor"])
    if "BackgroundColor" in style: data["backgroundColor"] = hex_to_rgb(style["BackgroundColor"])
    return data

def _apply_style(lines, style, sound):
    if "FontSize" in style: lines.append(f'    SetFontSize {style["FontSize"]}')
    if "BorderColor" in style:
        r, g, b = hex_to_rgb(style["BorderColor"])
        lines.append(f'    SetBorderColor {r} {g} {b}')
    if "TextColor" in style:
        r, g, b = hex_to_rgb(style["TextColor"])
        lines.append(f'    SetTextColor {r} {g} {b}')
    if "BackgroundColor" in style:
        r, g, b = hex_to_rgb(style["BackgroundColor"])
        lines.append(f'    SetBackgroundColor {r} {g} {b}')

    if sound:
        if isinstance(sound, list):
            file, vol = sound
            lines.append(f'    CustomAlertSound "{file}" {vol}')
        elif isinstance(sound, dict):
            lines.append(f'    CustomAlertSound "{sound["file"]}" {sound["volume"]}')

def _find_theme_key(group, theme):
    if group in theme: return group
    for k in theme.keys():
        if group.lower() in k.lower(): return k
    return None
