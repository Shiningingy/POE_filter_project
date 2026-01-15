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
    new_tier: str
    source_file: str

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
    global ITEM_CLASSES, CLASS_TO_ITEMS, ITEM_TO_CLASS
    csv_path = DATA_DIR / "from_filter_blade" / "BaseTypes.csv"
    if not csv_path.exists():
        print("Warning: BaseTypes.csv not found.")
        return

    print("Loading BaseTypes.csv...")
    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cls = row.get("Class", "").strip()
                name = row.get("BaseType", "").strip()
                if cls and name:
                    if cls not in CLASS_TO_ITEMS:
                        CLASS_TO_ITEMS[cls] = set()
                    CLASS_TO_ITEMS[cls].add(name)
                    ITEM_TO_CLASS[name] = cls
        
        ITEM_CLASSES = sorted(list(CLASS_TO_ITEMS.keys()))
        print(f"Loaded {len(ITEM_CLASSES)} item classes.")
    except Exception as e:
        print(f"Error loading BaseTypes.csv: {e}")

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
    results = []
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                trans = data.get("_meta", {}).get("localization", {}).get("ch", {})
                for item_name, tier_key in mapping.items():
                    name_ch = trans.get(item_name, "")
                    if q_lower in item_name.lower() or (name_ch and q_lower in name_ch.lower()):
                        results.append({"name": item_name, "name_ch": name_ch or item_name, "current_tier": tier_key, "source_file": file_path.relative_to(mappings_dir).as_posix()})
                        if len(results) >= 20: return {"results": results}
        except: continue
    return {"results": results}

@app.get("/api/item-classes")
def get_item_classes():
    return {"classes": ITEM_CLASSES}

# --- Action Endpoints ---

@app.post("/api/update-item-tier")
def update_item_tier(request: UpdateItemTierRequest):
    file_path = safe_join(CONFIG_DATA_DIR / "base_mapping", request.source_file)
    try:
        with open(file_path, "r", encoding="utf-8") as f: data = json.load(f)
        mapping = data.get("mapping", {})
        if not request.new_tier:
            if request.item_name in mapping: del mapping[request.item_name]
        else:
            mapping[request.item_name] = request.new_tier
        data["mapping"] = mapping
        with open(file_path, "w", encoding="utf-8") as f: json.dump(data, f, indent=2, ensure_ascii=False)
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/update-item-override")
def update_item_override(request: UpdateItemOverrideRequest):
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
    found_items = set() # Track found items to calculate untiered
    
    mappings_dir = CONFIG_DATA_DIR / "base_mapping"
    for file_path in mappings_dir.rglob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("mapping", {})
                trans = data.get("_meta", {}).get("localization", {}).get("ch", {})
                
                for item_name, tier_key in mapping.items():
                    # If class filter is active, skip mismatch
                    if request.class_filter:
                        item_class = ITEM_TO_CLASS.get(item_name)
                        if item_class != request.class_filter:
                            continue
                    
                    if tier_key in tier_keys_set:
                        result[tier_key].append({"name": item_name, "name_ch": trans.get(item_name, item_name), "source": file_path.relative_to(mappings_dir).as_posix()})
                        if request.class_filter:
                            found_items.add(item_name)
        except: continue
        
    untiered = []
    if request.class_filter:
        all_class_items = CLASS_TO_ITEMS.get(request.class_filter, set())
        for item_name in all_class_items:
            if item_name not in found_items:
                # Untiered items don't have a source file yet, so we might need to decide where to put them later.
                # Or we return them without source.
                # For update-item-tier, we need source_file.
                # We can default to the first file encountered or let frontend decide?
                # Actually, usually untiered items are new.
                # We'll just return them. Frontend needs to pick a source file to add them to.
                # Or we pass "default" source?
                untiered.append({"name": item_name, "name_ch": item_name}) # TODO: CH translation for CSV items?
    
    return {"items": result, "untiered": untiered}

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
                                available_tiers.append({"key": k, "label_en": f"Tier {t_num} {cat_en}", "label_ch": f"T{t_num} {cat_ch}"})
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