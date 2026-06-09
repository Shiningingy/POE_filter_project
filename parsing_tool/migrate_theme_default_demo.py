"""Part E (demo parity): mirror the theme-default migration into the static demo data.

- demo theme_sharket.json: theme_data -> rename "Stackable Currency" to "Default", drop "Currency".
- demo category_structure.json: copy each leaf's target_category from the migrated real file (by path).

Preserves each demo file's existing format (theme is minified LF; category_structure is CRLF indent=2).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "webapp", "frontend", "public", "demo_data")
REAL_CAT = os.path.join(ROOT, "filter_generation", "data", "category_structure.json")
DEMO_THEME = os.path.join(DEMO, "theme_sharket.json")
DEMO_CAT = os.path.join(DEMO, "category_structure.json")

# --- demo theme ---
wrap = json.load(open(DEMO_THEME, encoding="utf-8"))
td = wrap.get("theme_data", {})
new_td = {}
for k, v in td.items():
    if k == "Currency":
        continue
    new_td["Default" if k == "Stackable Currency" else k] = v
wrap["theme_data"] = new_td
# minified, LF
with open(DEMO_THEME, "w", encoding="utf-8", newline="\n") as f:
    f.write(json.dumps(wrap, ensure_ascii=False, separators=(",", ":")))
print(f"[E] demo theme_sharket.json: keys {len(td)} -> {len(new_td)} (Currency removed, Stackable Currency -> Default)")

# --- demo category_structure target_category from migrated real ---
real = json.load(open(REAL_CAT, encoding="utf-8"))
real_tc = {}
for g in real.get("categories", []):
    for fl in g.get("files", []):
        if fl.get("path"):
            real_tc[fl["path"]] = fl.get("target_category")

demo = json.load(open(DEMO_CAT, encoding="utf-8"))
updated = 0
for g in demo.get("categories", []):
    for fl in g.get("files", []):
        p = fl.get("path")
        if p in real_tc and fl.get("target_category") != real_tc[p]:
            fl["target_category"] = real_tc[p]
            updated += 1
raw = open(DEMO_CAT, "rb").read()
trailing = raw.endswith(b"\n")
text = json.dumps(demo, ensure_ascii=False, indent=2) + ("\n" if trailing else "")
with open(DEMO_CAT, "w", encoding="utf-8", newline="\r\n") as f:
    f.write(text)
print(f"[E] demo category_structure.json: target_category updated {updated}")
print("Done.")
