"""
One-off migration: per-category theming that mirrors the nav.

Part A (theme data):
  - sharket_theme.json: rename "Stackable Currency" -> "Default", delete orphan "Currency".
  - custom_overrides.json: drop the dead "Currency" entry.

Part B (self-key the shared categories):
  - Every tier_definition/**/*.json whose _meta.theme_category == "Stackable Currency"
    is repointed to its OWN top-level key (self). If that key collides with an existing
    distinct theme entry (campaign Jewels/Quivers/Tinctures), it is namespaced "Campaign <key>"
    so it still falls through to "Default" (output-stable).
  - category_structure.json: every leaf's target_category is set to the resolution key its
    tier_definition now uses (theme_category, defaulting to the top-level key), so nav/editor
    and generator agree.

Idempotent. Preserves each file's indent (2 or 4) and CRLF line endings.
"""
import json
import glob
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "filter_generation", "data")
THEME = os.path.join(DATA, "theme", "sharket", "sharket_theme.json")
OVERRIDES = os.path.join(DATA, "theme", "custom_overrides.json")
TIER_DIR = os.path.join(DATA, "tier_definition")
CAT_STRUCT = os.path.join(DATA, "category_structure.json")


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def dump(path, obj, indent):
    """Write JSON preserving CRLF + trailing newline + given indent."""
    raw = open(path, "rb").read()
    trailing = raw.endswith(b"\r\n") or raw.endswith(b"\n")
    text = json.dumps(obj, ensure_ascii=False, indent=indent)
    if trailing:
        text += "\n"
    with open(path, "w", encoding="utf-8", newline="\r\n") as f:
        f.write(text)


def top_key(doc):
    for k in doc:
        if not k.startswith("//"):
            return k
    return None


# ---------- Part A: theme data ----------
theme = load(THEME)
remaining_keys = set(theme.keys()) - {"Currency", "Stackable Currency"}

new_theme = {}
for k, v in theme.items():
    if k == "Currency":
        continue  # delete orphan
    if k == "Stackable Currency":
        new_theme["Default"] = v  # rename in place (preserves position)
    else:
        new_theme[k] = v
if "Default" not in new_theme and "Default" in theme:
    new_theme = theme  # already migrated
dump(THEME, new_theme, 2)
print(f"[A] theme: Currency removed, Stackable Currency -> Default "
      f"(keys {len(theme)} -> {len(new_theme)})")

ov = load(OVERRIDES)
if "Currency" in ov:
    del ov["Currency"]
    print("[A] custom_overrides: dropped dead 'Currency' entry")
dump(OVERRIDES, ov, 4)

# ---------- Part B: self-key shared categories ----------
repointed = 0
collisions = []
for f in glob.glob(os.path.join(TIER_DIR, "**", "*.json"), recursive=True):
    doc = load(f)
    k = top_key(doc)
    if not k:
        continue
    meta = doc[k].get("_meta", {})
    if meta.get("theme_category") != "Stackable Currency":
        continue
    if k in remaining_keys:
        new_key = f"Campaign {k}"  # disambiguate collisions (campaign Jewels/Quivers/Tinctures)
        collisions.append((k, new_key))
    else:
        new_key = k
    meta["theme_category"] = new_key
    doc[k]["_meta"] = meta
    dump(f, doc, 2)
    repointed += 1
print(f"[B] tier_definitions repointed off 'Stackable Currency': {repointed}")
if collisions:
    print(f"[B] disambiguated collisions: {collisions}")

# ---------- Part B: regenerate category_structure target_category ----------
cat = load(CAT_STRUCT)
updated = 0
missing = []
for group in cat.get("categories", []):
    for leaf in group.get("files", []):
        tp = leaf.get("tier_path")
        if not tp:
            continue
        tier_file = os.path.join(DATA, tp.replace("/", os.sep))
        if not os.path.exists(tier_file):
            missing.append(tp)
            continue
        doc = load(tier_file)
        tk = top_key(doc)
        if not tk:
            continue
        resolved = doc[tk].get("_meta", {}).get("theme_category", tk)
        if leaf.get("target_category") != resolved:
            leaf["target_category"] = resolved
            updated += 1
dump(CAT_STRUCT, cat, 2)
print(f"[B] category_structure target_category updated: {updated}")
if missing:
    print(f"[B] WARNING tier files referenced by nav but missing ({len(missing)}): {missing[:8]}")
print("Done.")
