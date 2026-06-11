"""Export ALL static data the deployed (backend-free) webapp needs.

Imports the FastAPI backend module and calls its own loaders/endpoint
functions, so the baked data is guaranteed to match what local dev serves.
Run from anywhere; output goes to webapp/frontend/public/demo_data/.

Supersedes webapp/backend/setup_demo.py (which duplicated backend logic).

NOTE: json is written WITHOUT sort_keys — tier_definition key order drives
generated-filter rule order, so insertion order must be preserved.
"""
import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
BACKEND_DIR = PROJECT_ROOT / "webapp" / "backend"
OUT_DIR = PROJECT_ROOT / "webapp" / "frontend" / "public" / "demo_data"
SOUND_DIR = PROJECT_ROOT / "sound_files"

sys.path.insert(0, str(BACKEND_DIR))
import main as backend  # noqa: E402


def write_json(name: str, obj) -> None:
    path = OUT_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    print(f"  {name}: {path.stat().st_size // 1024} KB")


def build_bundle() -> dict:
    bundle = {"mappings": {}, "tiers": {}, "theme": {}, "soundMap": {},
              "settings": {}, "customOverrides": {}}
    base_mapping = backend.CONFIG_DATA_DIR / "base_mapping"
    tier_def = backend.CONFIG_DATA_DIR / "tier_definition"
    for p in sorted(base_mapping.rglob("*.json")):
        bundle["mappings"][p.relative_to(base_mapping).as_posix()] = json.loads(p.read_text(encoding="utf-8"))
    for p in sorted(tier_def.rglob("*.json")):
        bundle["tiers"][p.relative_to(tier_def).as_posix()] = json.loads(p.read_text(encoding="utf-8"))
    theme_file = backend.CONFIG_DATA_DIR / "theme" / "sharket" / "sharket_theme.json"
    sound_map_file = backend.CONFIG_DATA_DIR / "theme" / "sharket" / "Sharket_sound_map.json"
    if theme_file.exists():
        bundle["theme"] = json.loads(theme_file.read_text(encoding="utf-8"))
    if sound_map_file.exists():
        bundle["soundMap"] = json.loads(sound_map_file.read_text(encoding="utf-8"))
    bundle["settings"] = backend.get_settings()
    bundle["customOverrides"] = backend.get_custom_overrides()
    return bundle


def build_items_db() -> dict:
    items = {}
    for name in backend.ITEM_TO_CLASS:
        details = backend.ITEM_DETAILS.get(name, {})
        items[name] = {
            "name_ch": backend.ITEM_TRANSLATIONS.get(name, name),
            "sub_type": backend.ITEM_SUBTYPES.get(name, "Other"),
            **details,
        }
    # zh names for items that exist in GGPK translations but not in
    # BaseTypes.csv (e.g. map basetypes) — the backend falls back to
    # ITEM_TRANSLATIONS for these when they appear in mappings.
    extra_translations = {
        name: trans for name, trans in backend.ITEM_TRANSLATIONS.items()
        if name not in backend.ITEM_TO_CLASS
    }
    return {
        "classes": backend.ITEM_CLASSES,
        "items": items,
        "categoryMap": backend.CATEGORY_MAP,
        "extraTranslations": extra_translations,
    }


def main() -> None:
    print(f"Loading backend data (project: {PROJECT_ROOT})...")
    backend.load_base_types()
    backend.load_translations()
    backend.load_stack_sizes()
    backend.load_category_map()
    backend.load_class_hierarchy()
    backend.load_filter_conditions()
    backend.load_bonus_item_info()

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)

    print(f"Writing static data to {OUT_DIR}...")
    write_json("bundle.json", build_bundle())
    write_json("items_db.json", build_items_db())
    write_json("category_structure.json", backend.get_category_structure())
    write_json("rule_templates.json", backend.get_rule_templates())
    write_json("filter_conditions.json", backend.get_filter_conditions())
    write_json("class_properties.json", backend.get_class_properties())
    write_json("class_hierarchy.json", backend.get_class_hierarchy())
    write_json("bonus_info.json", backend.get_bonus_info())
    write_json("sounds.json", backend.list_available_sounds())

    themes = backend.get_themes_list()
    write_json("themes.json", themes)
    for theme_name in themes.get("themes", []):
        write_json(f"theme_{theme_name}.json", backend.get_theme_data(theme_name))

    print("Copying sound files...")
    for sub in ("Default", "Sharket掉落音效"):
        src = SOUND_DIR / sub
        if src.is_dir():
            shutil.copytree(src, OUT_DIR / "sounds" / sub, dirs_exist_ok=True)

    print("Static web data exported.")


if __name__ == "__main__":
    main()
