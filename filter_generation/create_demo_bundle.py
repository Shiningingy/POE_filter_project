"""Export ALL static data the deployed (backend-free) webapp needs.

Imports the FastAPI backend module and calls its own loaders/endpoint
functions, so the baked data is guaranteed to match what local dev serves.
Run from anywhere; output goes to webapp/frontend/public/demo_data/.

Supersedes webapp/backend/setup_demo.py (which duplicated backend logic).

NOTE: json is written WITHOUT sort_keys — tier_definition key order drives
generated-filter rule order, so insertion order must be preserved.

The output tree is GITIGNORED, so a stale bundle is invisible to git and to
anything that reads it. test_resolver_equivalence.mjs reads the editor's data
through this bundle, so a bundle that quietly failed to refresh turns that test
into a comparison against frozen data that still reports PASS — which it did, for
an entire working session.

Two things guard against that, and both are the point of this script beyond
copying files:

  * every bake writes bake_stamp.json, carrying a fingerprint of the exact
    input tree it was built from (see source_fingerprint);
  * every bake VERIFIES its own output before exiting 0 — see verify_output.

A consumer that cares whether the bundle is current recomputes the fingerprint
itself and compares. Mismatch is an error, never a fallback.
"""
import hashlib
import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
BACKEND_DIR = PROJECT_ROOT / "webapp" / "backend"
OUT_DIR = PROJECT_ROOT / "webapp" / "frontend" / "public" / "demo_data"
SOUND_DIR = PROJECT_ROOT / "sound_files"
# The tree BOTH generators read. Fingerprinting it answers exactly one question:
# "was this bundle built from the data currently on disk?"
INPUT_DIR = PROJECT_ROOT / "filter_generation" / "data"
SOUND_SUBDIRS = ("Default", "Sharket掉落音效")
# Written by every bake; read by anyone who must not trust a stale bundle.
STAMP_NAME = "bake_stamp.json"
STAMP_SCHEMA = 1

sys.path.insert(0, str(BACKEND_DIR))
import main as backend  # noqa: E402


def source_fingerprint() -> str:
    """SHA-256 over the canonical content listing of the generator input tree.

    Canonical line per file, sorted by POSIX relative path:  ``relpath\\0<sha256>\\n``

    Deliberately independent of mtime — mtimes do not survive a clone or a
    checkout, so they report "stale" on files that never changed and "fresh" on
    a tree someone rewound. Content is the only honest answer.

    Reimplemented in JS in test_resolver_equivalence.mjs on purpose: a verifier
    that calls the thing it verifies proves nothing, and "Python silently did
    nothing" is precisely the failure being guarded.
    """
    h = hashlib.sha256()
    for p in sorted(INPUT_DIR.rglob("*"), key=lambda q: q.relative_to(INPUT_DIR).as_posix()):
        if not p.is_file():
            continue
        rel = p.relative_to(INPUT_DIR).as_posix()
        h.update(rel.encode("utf-8"))
        h.update(b"\0")
        h.update(hashlib.sha256(p.read_bytes()).hexdigest().encode("ascii"))
        h.update(b"\n")
    return h.hexdigest()


def sound_counts(root: Path) -> dict:
    """Per-subdir file counts. The bundle has silently shed sound files before."""
    return {
        sub: sum(1 for q in (root / sub).rglob("*") if q.is_file())
        for sub in SOUND_SUBDIRS
        if (root / sub).is_dir()
    }


def write_json(name: str, obj) -> None:
    path = OUT_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False), encoding="utf-8")
    print(f"  {name}: {path.stat().st_size // 1024} KB")


def build_bundle() -> dict:
    bundle = {"mappings": {}, "tiers": {}, "theme": {}, "soundMap": {},
              "settings": {}, "footer": ""}
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
    footer_file = backend.CONFIG_DATA_DIR / "footer.filter"
    if footer_file.exists():
        bundle["footer"] = footer_file.read_text(encoding="utf-8")
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


def verify_output(expected: list, src_counts: dict) -> None:
    """Fail loudly rather than leave a half-written bundle looking successful.

    Exiting 0 having written nothing is the specific bug this guards: the output
    tree is gitignored, so nothing downstream notices.
    """
    problems = []
    for name in expected:
        path = OUT_DIR / name
        if not path.is_file():
            problems.append(f"missing: {name}")
        elif path.stat().st_size == 0:
            problems.append(f"empty: {name}")

    baked_counts = sound_counts(OUT_DIR / "sounds")
    for sub, want in src_counts.items():
        got = baked_counts.get(sub, 0)
        if got != want:
            problems.append(f"sounds/{sub}: baked {got} of {want} source files")

    if problems:
        print("\nBAKE FAILED — output did not verify:", file=sys.stderr)
        for p in problems:
            print(f"  * {p}", file=sys.stderr)
        raise SystemExit(1)


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

    # Fingerprint the inputs BEFORE writing, so the stamp describes the tree the
    # bundle was actually built from even if data changes while this runs.
    fingerprint = source_fingerprint()
    src_counts = sound_counts(SOUND_DIR)

    print(f"Writing static data to {OUT_DIR}...")
    written = []

    def emit(name, obj):
        write_json(name, obj)
        written.append(name)

    emit("bundle.json", build_bundle())
    emit("items_db.json", build_items_db())
    emit("category_structure.json", backend.get_category_structure())
    emit("rule_templates.json", backend.get_rule_templates())
    emit("filter_conditions.json", backend.get_filter_conditions())
    emit("class_properties.json", backend.get_class_properties())
    emit("class_hierarchy.json", backend.get_class_hierarchy())
    emit("bonus_info.json", backend.get_bonus_info())
    emit("sounds.json", backend.list_available_sounds())

    themes = backend.get_themes_list()
    emit("themes.json", themes)
    for theme_name in themes.get("themes", []):
        emit(f"theme_{theme_name}.json", backend.get_theme_data(theme_name))

    print("Copying sound files...")
    for sub in SOUND_SUBDIRS:
        src = SOUND_DIR / sub
        if src.is_dir():
            shutil.copytree(src, OUT_DIR / "sounds" / sub, dirs_exist_ok=True)

    verify_output(written, src_counts)

    # Written LAST and only on a verified bake, so the stamp's existence means
    # "this bundle is complete and came from THIS input tree" — nothing weaker.
    (OUT_DIR / STAMP_NAME).write_text(json.dumps({
        "schema": STAMP_SCHEMA,
        "source_fingerprint": fingerprint,
        "input_dir": INPUT_DIR.relative_to(PROJECT_ROOT).as_posix(),
        "files": written,
        "sound_counts": src_counts,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    sounds_total = sum(src_counts.values())
    print(f"Static web data exported: {len(written)} files, {sounds_total} sounds.")
    print(f"  source fingerprint {fingerprint[:16]}… -> {STAMP_NAME}")


if __name__ == "__main__":
    main()
