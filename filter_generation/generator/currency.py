import json

def build_currency_section(item_blocks, theme, sound_map):
    """
    item_blocks: list of dicts {name, group, group_text, text_ch, hideable, conditions, style_override, comment}
    theme: dict of visual appearance configs
    sound_map: dict of sound overrides
    
    Returns:
        tuple: (filter_content_string, style_map_dictionary)
    """
    blocks = []
    style_map = {}

    for block_data in item_blocks:
        baseType = block_data["name"]
        
        # Skip if marked as hideable (optional logic)
        if block_data.get("hideable", False):
            continue

        group = block_data.get("group", "")
        group_text = block_data.get("group_text", "")
        text_ch = block_data.get("text_ch", "")
        conditions = block_data.get("conditions", {})
        overrides = block_data.get("style_override", {})
        comment = block_data.get("comment", "")

        # 1. Base Style from Theme
        theme_key = _find_theme_key(group, theme.get("currency", {}))
        style = theme.get("currency", {}).get(theme_key) if theme_key else theme.get("currency", {}).get("CurrencyDefault", {})
        
        # Deep copy style to avoid mutating the theme
        style = style.copy()
        
        # 2. Merge overrides from the rule
        style.update(overrides)

        # 3. Sound: rule override -> global sound map -> theme style
        # Priority logic
        sound = overrides.get("PlayAlertSound")
        if not sound:
            sound = sound_map.get(baseType, style.get("PlayAlertSound"))

        # Collect style data for Simulator (use base name as key, might overwrite if multiple rules, but okay for now)
        item_style = _extract_style_data(style, sound)
        style_map[baseType] = item_style

        # 4. Compose block
        header_comment = f'#通货-{group_text}-{text_ch}'
        if comment:
            header_comment += f' ({comment})'
            
        header = f'Show #{header_comment}'
        lines = [header, f'    BaseType "{baseType}"']
        
        # Add Conditions (the "Factors")
        for key, val in conditions.items():
            # If value contains operators like '>=', we just append it
            # If it's just a value, we might need to assume '=' or handled by user input
            lines.append(f'    {key} {val}')

        _apply_style(lines, style, sound)
        blocks.append("\n".join(lines))

    return "\n\n".join(blocks), style_map


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 8: # RRGGBBAA
        return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    elif len(hex_color) == 6: # RRGGBB
        return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return 0, 0, 0 

def _extract_style_data(style, sound):
    """Extracts style data into a dictionary for JSON export"""
    data = {}
    if "FontSize" in style:
        data["fontSize"] = style["FontSize"]
    
    if "BorderColor" in style:
        data["borderColor"] = hex_to_rgb(style["BorderColor"])
    if "TextColor" in style:
        data["textColor"] = hex_to_rgb(style["TextColor"])
    if "BackgroundColor" in style:
        data["backgroundColor"] = hex_to_rgb(style["BackgroundColor"])
        
    return data

def _apply_style(lines, style, sound):
    """Append visual/sound settings from theme or sound map"""
    if "FontSize" in style:
        lines.append(f'    SetFontSize {style["FontSize"]}')
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
    """Try to find a matching theme key based on group name"""
    if group in theme:
        return group
    for k in theme.keys():
        if group.lower() in k.lower():
            return k
    return None