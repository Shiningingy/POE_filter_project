import json

def build_currency_section(item_data, theme, sound_map):
    """
    item_data: dict of basetypes and metadata
    theme: dict of visual appearance configs
    sound_map: dict of sound overrides
    
    Returns:
        tuple: (filter_content_string, style_map_dictionary)
    """
    blocks = []
    style_map = {}

    for baseType, meta in item_data.items():
        # Skip if marked as hideable (optional logic)
        if meta.get("hideable", False):
            continue

        group = meta.get("group", "")
        group_text = meta.get("group_text", "")
        text_ch = meta.get("text_ch", "")

        # Determine which theme style to use (e.g. "CurrencyHigh", "CurrencyLow")
        # Fallback to default if group not in theme
        theme_key = _find_theme_key(group, theme.get("currency", {}))
        style = theme.get("currency", {}).get(theme_key) if theme_key else theme.get("currency", {}).get("CurrencyDefault", {})

        # Sound: per-item sound overrides theme
        sound = sound_map.get(baseType, style.get("PlayAlertSound"))

        # Collect style data for Simulator
        item_style = _extract_style_data(style, sound)
        style_map[baseType] = item_style

        # Compose block
        header = f'Show #通货-{group_text}-{text_ch}'
        lines = [header, f'BaseType "{baseType}"']
        _apply_style(lines, style, sound)
        blocks.append("\n".join(lines))

    return "\n\n".join(blocks), style_map


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    # Assuming the format is RRGGBBAA or RRGGBB
    if len(hex_color) == 8: # RRGGBBAA
        return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    elif len(hex_color) == 6: # RRGGBB
        return int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    return 0, 0, 0 # Default if format is unexpected

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
        lines.append(f'SetFontSize {style["FontSize"]}')
    if "BorderColor" in style:
        r, g, b = hex_to_rgb(style["BorderColor"])
        lines.append(f'SetBorderColor {r} {g} {b}')
    if "TextColor" in style:
        r, g, b = hex_to_rgb(style["TextColor"])
        lines.append(f'SetTextColor {r} {g} {b}')
    if "BackgroundColor" in style:
        r, g, b = hex_to_rgb(style["BackgroundColor"])
        lines.append(f'SetBackgroundColor {r} {g} {b}')

    if sound:
        if isinstance(sound, list):
            file, vol = sound
            lines.append(f'CustomAlertSound "{file}" {vol}')
        elif isinstance(sound, dict):
            lines.append(f'CustomAlertSound "{sound["file"]}" {sound["volume"]}')


def _find_theme_key(group, theme):
    """Try to find a matching theme key based on group name"""
    # exact match first
    if group in theme:
        return group
    # fallback: try to match by keywords
    for k in theme.keys():
        if group.lower() in k.lower():
            return k
    return None
