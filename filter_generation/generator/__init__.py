import json
from filter_generator import currency
from theme_loader import load_theme

# Load data
item_data = json.load(open("data/currency_data.json", encoding="utf-8"))
theme, sound_map = load_theme("sharket")

# Generate filter section
currency_filter = currency.build_currency_section(item_data, theme, sound_map)

with open("output/currency.filter", "w", encoding="utf-8") as f:
    f.write(currency_filter)