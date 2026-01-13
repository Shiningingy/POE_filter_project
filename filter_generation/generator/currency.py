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

        tier_key = group_data["tier_key"]
        group_text = group_data["group_text"]
        text_ch = group_data["text_ch"]
        conditions = group_data["conditions"]
        overrides = group_data["style_override"]
        comment = group_data["comment"]

        # 1. Resolve Style
        # Use tier_key to find base style (e.g. "Tier 1")
        theme_key = _find_theme_key(tier_key, theme.get("currency", {}))
        style = theme.get("currency", {}).get(theme_key) if theme_key else theme.get("currency", {}).get("CurrencyDefault", {})
        style = style.copy()
        style.update(overrides)

        # 2. Resolve Sound
        sound = overrides.get("PlayAlertSound")
        if not sound:
            # For lists, we use the style's sound. Item-specific sound maps don't apply well to groups
            # unless all items in group share it. For now, group uses Tier sound.
            sound = style.get("PlayAlertSound")

        # Update style map for simulator (just for the first item in list for preview)
        style_map[items[0]] = _extract_style_data(style, sound)

        # 3. Compose Block
        header_comment = f'{group_text}'
        if comment:
            header_comment += f' ({comment})'
            
        header = f'Show #{header_comment}'
        
        # Format BaseType list: "Item 1" "Item 2"
        item_list_str = '" "'.join(items)
        lines = [header, f'    BaseType "{item_list_str}"']
        
        for key, val in conditions.items():
            lines.append(f'    {key} {val}')

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
