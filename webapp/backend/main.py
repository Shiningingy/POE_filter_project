from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import json
import subprocess
import sys
import time
import re
import csv
from pathlib import Path
from typing import List, Dict, Optional
from pydantic import BaseModel

app = FastAPI()

# --- Models ---
class UpdateItemOverrideRequest(BaseModel):
    item_name: str
    overrides: dict
    source_file: str

class UpdateItemTierRequest(BaseModel):
    item_name: str
    new_tier: Optional[str] = None
    source_file: str
    is_append: bool = False
    old_tier: Optional[str] = None
    new_tiers: Optional[List[str]] = None

class TierItemsRequest(BaseModel):
    tier_keys: List[str]
    class_filter: Optional[str] = None

# --- Path Definitions ---
PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
FILTER_GEN_DIR = (PROJECT_ROOT / "filter_generation").resolve()
CONFIG_DATA_DIR = (FILTER_GEN_DIR / "data").resolve()
SOUND_FILES_DIR = (PROJECT_ROOT / "sound_files").resolve()
DATA_DIR = PROJECT_ROOT / "data"

VENV_PYTHON = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe" if sys.platform == "win32" else PROJECT_ROOT / ".venv" / "bin" / "python"
PYTHON_EXECUTABLE = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

# --- Globals ---
ITEM_CLASSES = []
CLASS_TO_ITEMS = {} # Class -> Set(BaseTypes)
ITEM_TO_CLASS = {}  # BaseType -> Class
ITEM_TRANSLATIONS = {} # English Name -> Chinese Name
CATEGORY_MAP = {} # mapping_path -> ch_name
CLASS_TO_FILE = {} # item_class -> mapping_path (relative to base_mapping)

ITEM_SUBTYPES = {} # BaseType -> STR/DEX/INT
ITEM_DETAILS = {} # BaseType -> {drop_level, implicit, ...}

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    print(f"DEBUG: {request.method} {request.url.path} -> {response.status_code} ({duration:.4f}s)")
    return response

# --- Helper ---
def safe_join(base: Path, path: str):
    full_path = (base / path).resolve()
    try:
        full_path.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path traversal")
    return full_path

def load_base_types():
    global ITEM_CLASSES, CLASS_TO_ITEMS, ITEM_TO_CLASS, ITEM_SUBTYPES
    csv_path = DATA_DIR / "from_filter_blade" / "BaseTypes.csv"
    if not csv_path.exists():
        print("Warning: BaseTypes.csv not found.")
        return

    print("Loading BaseTypes.csv...")
    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cls = row.get("Class", "").strip()
                name = row.get("BaseType", "").strip()
                if cls and name:
                    if cls not in CLASS_TO_ITEMS:
                        CLASS_TO_ITEMS[cls] = set()
                    CLASS_TO_ITEMS[cls].add(name)
                    ITEM_TO_CLASS[name] = cls
                    
                    # Parse attributes and assign game-facing sub-types only for relevant classes
                    subtype = "Other"
                    if cls in ["Body Armours", "Gloves", "Boots", "Helmets", "Shields"]:
                        s = int(row.get("Game:Strength") or 0)
                        d = int(row.get("Game:Dexterity") or 0)
                        i = int(row.get("Game:Intelligence") or 0)
                        
                        if s > 0 and d == 0 and i == 0: subtype = "Armour"
                        elif d > 0 and s == 0 and i == 0: subtype = "Evasion Rating"
                        elif i > 0 and s == 0 and d == 0: subtype = "Energy Shield"
                        elif s > 0 and d > 0 and i == 0: subtype = "Evasion / Armour"
                        elif s > 0 and i > 0 and d == 0: subtype = "Armour / ES"
                        elif d > 0 and i > 0 and s == 0: subtype = "ES / Evasion"
                        elif s > 0 and d > 0 and i > 0: subtype = "Armour / Evasion / ES"
                    
                    ITEM_SUBTYPES[name] = subtype
                    
                    # Parse detailed stats
                    details = {
                        "drop_level": int(row.get("DropLevel") or 0),
                        "width": int(row.get("Width") or 1),
                        "height": int(row.get("Height") or 1),
                        "implicit": [],
                        "armour": int(row.get("Game:Armour") or 0),
                        "armour_max": int(row.get("Game:Armour Max") or 0),
                        "evasion": int(row.get("Game:Evasion") or 0),
                        "evasion_max": int(row.get("Game:Evasion Max") or 0),
                        "energy_shield": int(row.get("Game:Energy Shield") or 0),
                        "energy_shield_max": int(row.get("Game:Energy Shield Max") or 0),
                        "damage_min": int(row.get("Game:Damage From") or 0),
                        "damage_max": int(row.get("Game:Damage To") or 0),
                        "aps": float(row.get("Game:APS") or 0),
                        "crit": float(row.get("Game:Crit") or 0),
                        "dps": float(row.get("Game:DPS") or 0),
                        "req_str": int(row.get("Game:Strength") or 0),
                        "req_dex": int(row.get("Game:Dexterity") or 0),
                        "req_int": int(row.get("Game:Intelligence") or 0),
                        "item_class": cls,
                    }
                    imp1 = row.get("Game:Implicit 1")
                    imp2 = row.get("Game:Implicit 2")
                    if imp1: details["implicit"].append(imp1)
                    if imp2: details["implicit"].append(imp2)
                    
                    ITEM_DETAILS[name] = details
        
        ITEM_CLASSES = sorted(list(CLASS_TO_ITEMS.keys()))
        print(f"Loaded {len(ITEM_CLASSES)} item classes.")
    except Exception as e:
        print(f"Error loading BaseTypes.csv: {e}")

def load_translations():
    global ITEM_TRANSLATIONS
    print("Loading translations...")
    en_map = {}
    try:
        en_path = DATA_DIR / "from_ggpk" / "baseitemtypes.json"
        if en_path.exists():
            with open(en_path, "r", encoding="utf-8") as f:
                en_data = json.load(f)
                for item in en_data:
                    if "Id" in item and "Name" in item:
                        en_map[item["Id"]] = item["Name"]
    except Exception as e: 
        print(f"Error loading EN base types: {e}")
        return

    try:
        ch_path = DATA_DIR / "from_ggpk" / "ch_simplified" / "baseitemtypes.json"
        if ch_path.exists():
            with open(ch_path, "r", encoding="utf-8") as f:
                ch_data = json.load(f)
                for item in ch_data:
                    if "Id" in item and "Name" in item:
                        en_name = en_map.get(item["Id"])
                        if en_name:
                            ITEM_TRANSLATIONS[en_name] = item["Name"]
        print(f"Loaded {len(ITEM_TRANSLATIONS)} translations.")
    except Exception as e:
        print(f"Error loading CH base types: {e}")

def load_category_map():
    global CATEGORY_MAP
    print("Loading category map...")
    try:
        with open(CONFIG_DATA_DIR / "category_structure.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            def traverse(node):
                if "files" in node:
                    for file in node["files"]:
                        if "mapping_path" in file and "localization" in file:
                            CATEGORY_MAP[file["mapping_path"]] = file["localization"].get("ch", "")
                if "subgroups" in node:
                    for sub in node["subgroups"]:
                        traverse(sub)
                if "categories" in node:
                    for cat in node["categories"]:
                        traverse(cat)
            traverse(data)
        print(f"Loaded {len(CATEGORY_MAP)} category mappings.")
    except Exception as e:
        print(f"Error loading category map: {e}")

# --- Specific Endpoints (Top Priority) ---

@app.get("/")
def root():
    return {"message": "Hello"}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": "1.0.3"}

@app.get("/api/sounds/list")
def list_available_sounds():
    try:
        default_dir = SOUND_FILES_DIR / "Default"
        sharket_dir = SOUND_FILES_DIR / "Sharket掉落音效"
        defaults = [f"Default/{f.name}" for f in default_dir.iterdir() if f.suffix.lower() == '.mp3'] if default_dir.is_dir() else []
        sharket = [f"Sharket掉落音效/{f.name}" for f in sharket_dir.iterdir() if f.suffix.lower() == '.mp3'] if sharket_dir.is_dir() else []
        return {"defaults": sorted(defaults), "sharket": sorted(sharket)}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sounds/proxy")
def proxy_local_sound(path: str):
    p = Path(path)
    if not p.is_file(): raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(path)

@app.get("/api/generated-filter")
def get_generated_filter():
    path = FILTER_GEN_DIR / "complete_filter.filter"
    if not path.exists(): raise HTTPException(status_code=404, detail="Not generated")
    return FileResponse(path)

@app.get("/api/category-structure")
def get_category_structure():
    path = CONFIG_DATA_DIR / "category_structure.json"
    if not path.exists(): return {"categories": []}
    with open(path, "r", encoding="utf-8") as f: return json.load(f)

@app.get("/api/themes")
def get_themes_list():
    themes_dir = CONFIG_DATA_DIR / "theme"
    return {"themes": [d.name for d in themes_dir.iterdir() if d.is_dir()]} if themes_dir.is_dir() else {"themes": []}

@app.get("/api/rule-templates")
def get_rule_templates():
    path = CONFIG_DATA_DIR / "rule_templates.json"
    if not path.exists(): return {"categories": []}
    with open(path, "r", encoding="utf-8") as f: return json.load(f)

@app.get("/api/search-items")
def search_items(q: str):
    if not q: return {"results": []}
    q_lower = q.lower()
    results_map = {} # name -> result_obj (to deduplicate)

    # 1. Search in Mappings (Tiered items)
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                trans = data.get("_meta", {}).get("localization", {}).get("ch", {})
                
                # Resolve category CH name
                rel_path = file_path.relative_to(CONFIG_DATA_DIR).as_posix()
                cat_ch = CATEGORY_MAP.get(rel_path, "")

                for item_name, tier_val in mapping.items():
                    name_ch = trans.get(item_name, "")
                    if q_lower in item_name.lower() or (name_ch and q_lower in name_ch.lower()):
                        details = ITEM_DETAILS.get(item_name, {})
                        tiers = tier_val if isinstance(tier_val, list) else [tier_val]
                        results_map[item_name] = {
                            "name": item_name, 
                            "name_ch": name_ch or item_name, 
                            "current_tier": tiers[0] if tiers else None,
                            "current_tiers": tiers,
                            "category_ch": cat_ch,
                            "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                            "source_file": file_path.relative_to(mappings_dir).as_posix(),
                            **details
                        }
        except: continue
    
    # 2. Search in BaseTypes (Untiered items)
    for cls, items in CLASS_TO_ITEMS.items():
        for item_name in items:
            if item_name in results_map: continue
            
            name_ch = ITEM_TRANSLATIONS.get(item_name, item_name)
            
            if q_lower in item_name.lower() or q_lower in name_ch.lower():
                details = ITEM_DETAILS.get(item_name, {})
                results_map[item_name] = {
                    "name": item_name,
                    "name_ch": name_ch,
                    "current_tier": None,
                    "current_tiers": [],
                    "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                    "source_file": None,
                    **details
                }

    results = list(results_map.values())
    results.sort(key=lambda x: x["name"])
    
    if len(results) > 50: results = results[:50]
    return {"results": results}

@app.get("/api/item-classes")
def get_item_classes():
    return {"classes": ITEM_CLASSES}

@app.get("/api/class-items/{item_class}")
def get_items_by_class(item_class: str):
    # Items to explicitly include (based on class filter)
    if item_class == "All":
        requested_items = set(ITEM_TO_CLASS.keys())
    else:
        requested_items = CLASS_TO_ITEMS.get(item_class, set())
    
    item_data = {} 
    
    # Pre-populate requested items
    for name in requested_items:
        details = ITEM_DETAILS.get(name, {})
        item_data[name] = {
            "name": name,
            "name_ch": ITEM_TRANSLATIONS.get(name, name),
            "sub_type": ITEM_SUBTYPES.get(name, "Other"),
            **details,
            "current_tier": [], 
            "source_file": None
        }

    # Scan all mappings to find current tiers AND include tiered items from other classes
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                rules = data.get("rules", [])
                trans = data.get("_meta", {}).get("localization", {}).get("ch", {})
                
                # Items specifically in this category
                all_possible_items = set(mapping.keys())
                for r in rules:
                    all_possible_items.update(r.get("targets", []))

                for item_name in all_possible_items:
                    # If item is not in requested_items but is in a mapping/rule, we still want it!
                    if item_name not in item_data:
                        details = ITEM_DETAILS.get(item_name, {})
                        item_data[item_name] = {
                            "name": item_name,
                            "name_ch": ITEM_TRANSLATIONS.get(item_name, item_name),
                            "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                            **details,
                            "current_tier": [],
                            "source_file": None
                        }
                    
                    current_list = item_data[item_name]["current_tier"]
                    
                    # Add base mapping tier
                    if item_name in mapping:
                        t_val = mapping[item_name]
                        tiers = t_val if isinstance(t_val, list) else [t_val]
                        for t in tiers:
                            if t not in current_list:
                                current_list.append(t)
                    
                    # Add rule tiers
                    for r in rules:
                        r_targets = r.get("targets", [])
                        if not r_targets or item_name in r_targets:
                            tier_override = r.get("overrides", {}).get("Tier")
                            if tier_override and tier_override not in current_list:
                                current_list.append(tier_override)

                    item_data[item_name]["source_file"] = file_path.relative_to(mappings_dir).as_posix()
                    if item_name in trans:
                        item_data[item_name]["name_ch"] = trans[item_name]
        except: continue
        
    return {"items": list(item_data.values())}

# --- Action Endpoints ---

@app.post("/api/update-item-tier")
def update_item_tier(request: UpdateItemTierRequest):
    if not request.source_file:
        raise HTTPException(status_code=422, detail="Source file is required")
    
    if request.source_file.startswith("base_mapping/"):
        file_path = safe_join(CONFIG_DATA_DIR, request.source_file)
    else:
        file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", request.source_file)

    try:
        with open(file_path, "r", encoding="utf-8") as f: data = json.load(f)
        mapping = data.get("mapping", {})
        
        # 1. Update Localization
        if "_meta" not in data: data["_meta"] = {}
        if "localization" not in data["_meta"]: data["_meta"]["localization"] = {"en": {}, "ch": {}}
        
        # Ensure 'ch' dict exists
        if "ch" not in data["_meta"]["localization"]: data["_meta"]["localization"]["ch"] = {}
        
        if request.item_name not in data["_meta"]["localization"]["ch"]:
            trans = ITEM_TRANSLATIONS.get(request.item_name)
            if trans:
                data["_meta"]["localization"]["ch"][request.item_name] = trans

        # 2. Update Mapping
        if request.new_tiers is not None:
            # Set exact list (bulk editor)
            # Ensure we don't accidentally remove T0 tiers if the bulk editor didn't see them
            # (though the current editor should see them now)
            mapping[request.item_name] = request.new_tiers
        elif not request.new_tier:
            # DELETE logic
            if request.item_name in mapping:
                current = mapping[request.item_name]
                if request.old_tier and isinstance(current, list):
                    if request.old_tier in current:
                        current.remove(request.old_tier)
                    if not current: del mapping[request.item_name]
                    else: mapping[request.item_name] = current
                elif request.old_tier and current == request.old_tier:
                    del mapping[request.item_name]
                elif not request.old_tier: # Delete all
                    del mapping[request.item_name]
        else:
            current = mapping.get(request.item_name)
            if request.is_append:
                if current:
                    if isinstance(current, list):
                        if request.new_tier not in current:
                            current.append(request.new_tier)
                            mapping[request.item_name] = current
                    elif current != request.new_tier:
                        mapping[request.item_name] = [current, request.new_tier]
                else:
                    mapping[request.item_name] = request.new_tier
            elif request.old_tier and current:
                # Move specific instance
                if isinstance(current, list):
                    if request.old_tier in current:
                        current.remove(request.old_tier)
                    if request.new_tier not in current:
                        current.append(request.new_tier)
                    mapping[request.item_name] = current
                elif current == request.old_tier:
                    mapping[request.item_name] = request.new_tier
            else:
                # Overwrite (Reset)
                mapping[request.item_name] = request.new_tier
            
        data["mapping"] = mapping
        with open(file_path, "w", encoding="utf-8") as f: json.dump(data, f, indent=2, ensure_ascii=False)
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update-item-override")
def update_item_override(request: UpdateItemOverrideRequest):
    if request.source_file.startswith("base_mapping/"):
        file_path = safe_join(CONFIG_DATA_DIR, request.source_file)
    else:
        file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", request.source_file)

    try:
        with open(file_path, "r", encoding="utf-8") as f: data = json.load(f)
        rules = data.get("rules", [])
        found = False
        for rule in rules:
            if rule.get("targets") == [request.item_name] and not rule.get("conditions"):
                rule["overrides"].update(request.overrides); found = True; break
        if not found:
            rules.append({"targets": [request.item_name], "conditions": {}, "overrides": request.overrides, "comment": f"Override for {request.item_name}"})
        data["rules"] = rules
        with open(file_path, "w", encoding="utf-8") as f: json.dump(data, f, indent=2, ensure_ascii=False)
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tier-items")
def get_items_by_tier(request: TierItemsRequest):
    tier_keys_set = set(request.tier_keys)
    result = {k: [] for k in tier_keys_set}
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                rules = data.get("rules", [])
                trans = data.get("_meta", {}).get("localization", {}).get("ch", {})
                
                # Evaluate all possible items in this file context
                all_involved = set(mapping.keys())
                for r in rules: all_involved.update(r.get("targets", []))

                for item_name in all_involved:
                    if request.class_filter:
                        item_class = ITEM_TO_CLASS.get(item_name)
                        if item_class != request.class_filter:
                            continue
                    
                    # Calculate final tiers for this item
                    final_tiers = []
                    if item_name in mapping:
                        t_val = mapping[item_name]
                        final_tiers += t_val if isinstance(t_val, list) else [t_val]
                    
                    for r in rules:
                        r_targets = r.get("targets", [])
                        if not r_targets or item_name in r_targets:
                            t_over = r.get("overrides", {}).get("Tier")
                            if t_over and t_over not in final_tiers:
                                final_tiers.append(t_over)

                    # Distribute to results
                    for tier_key in final_tiers:
                        if tier_key in tier_keys_set:
                            details = ITEM_DETAILS.get(item_name, {})
                            result[tier_key].append({
                                "name": item_name, 
                                "name_ch": trans.get(item_name, item_name), 
                                "sub_type": ITEM_SUBTYPES.get(item_name, "Other"),
                                "current_tiers": final_tiers,
                                "source": file_path.relative_to(mappings_dir).as_posix(),
                                **details
                            })
        except: continue
    
    return {"items": result}

@app.post("/api/generate")
def generate_filter_file():
    try:
        subprocess.run([PYTHON_EXECUTABLE, str(FILTER_GEN_DIR / "generate.py")], check=True, cwd=PROJECT_ROOT)
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# --- Generic Path Endpoints (Bottom Priority) ---

@app.get("/api/themes/{theme_name}")
def get_theme_data(theme_name: str):
    theme_dir = safe_join(CONFIG_DATA_DIR / "theme", theme_name)
    theme_file = theme_dir / f"{theme_name}_theme.json"
    sound_map = list(theme_dir.glob("*_sound_map.json"))
    try:
        t_data = json.load(open(theme_file, "r", encoding="utf-8")) if theme_file.exists() else {}
        s_data = json.load(open(sound_map[0], "r", encoding="utf-8")) if sound_map else {}
        return {"theme_name": theme_name, "theme_data": t_data, "sound_map_data": s_data}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mapping-info/{file_name:path}")
def get_mapping_info(file_name: str):
    path = safe_join(CONFIG_DATA_DIR / "base_mapping", file_name)
    try:
        with open(path, "r", encoding="utf-8") as f: mapping_content = json.load(f)
        theme_category = mapping_content.get("_meta", {}).get("theme_category")
        available_tiers = []
        if theme_category:
            for tf_path in (CONFIG_DATA_DIR / "tier_definition").rglob("*.json"):
                try:
                    tier_defs = json.load(open(tf_path, "r", encoding="utf-8"))
                    target_key = f"Default {theme_category}"
                    if target_key in tier_defs:
                        category_data = tier_defs[target_key]
                        cat_loc = category_data.get("_meta", {}).get("localization", {})
                        cat_en = cat_loc.get("en", theme_category); cat_ch = cat_loc.get("ch", cat_en)
                        for k, v in category_data.items():
                            if k.startswith("Tier"):
                                t_num = v.get("theme", {}).get("Tier", "?")
                                available_tiers.append({
                                    "key": k, 
                                    "label_en": f"Tier {t_num} {cat_en}", 
                                    "label_ch": f"T{t_num} {cat_ch}",
                                    "show_in_editor": v.get("show_in_editor", True),
                                    "is_hide_tier": v.get("is_hide_tier", False)
                                })
                        break
                except: continue
        available_tiers.sort(key=lambda x: int(re.search(r"Tier (\d+)", x["key"]).group(1)) if re.search(r"Tier (\d+)", x["key"]) else 999)
        return {"content": mapping_content, "theme_category": theme_category, "available_tiers": available_tiers, "item_translations": mapping_content.get("_meta", {}).get("localization", {}).get("ch", {})}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/{config_path:path}")
def get_config_content(config_path: str):
    path = safe_join(CONFIG_DATA_DIR, config_path)
    try: return {"content": json.load(open(path, "r", encoding="utf-8"))}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/config/{config_path:path}")
async def save_config_file_v2(config_path: str, content: dict = Body(...)):
    path = safe_join(CONFIG_DATA_DIR, config_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f: json.dump(content, f, indent=2, ensure_ascii=False)
    return {"message": "Success"}

# --- Mounts ---
if SOUND_FILES_DIR.exists():
    app.mount("/sounds", StaticFiles(directory=str(SOUND_FILES_DIR)), name="sounds")

@app.on_event("startup")
async def startup_event():
    print(f"Backend 1.0.3 started. Project: {PROJECT_ROOT}")
    load_base_types()
    load_translations()
    load_category_map()