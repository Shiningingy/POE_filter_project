#!/usr/bin/env python3
"""Extract the curated GGPK table set into data/source/<label>/.

This is step 1 of the own-database pipeline (ADR-0004): a reproducible dump of
what the game actually contains, replacing the per-league scramble for
FilterBlade's BaseTypes.csv. It produces raw tables only - joining them into a
catalog is step 2's job.

Two sources, both proven:

  CDN    no game install needed; GGG's patch server. The only leg that has the
         current league during the window where the China client still lags.
             python parsing_tool/ggpk/extract.py --source cdn --patch latest

  local  reads Bundles2/_.index.bin straight out of an install (no GGPK
         extraction step). The China client is the only source of Simplified
         Chinese, and it yields English from the same dump, perfectly Id-aligned.
             python parsing_tool/ggpk/extract.py --source local \
                 --game-path "D:\\WeGameApps\\<game folder>" --label cn-3.28

Requires `npm install` in this directory first (see README.md) - the Simplified
Chinese language entry is a patch-package pin over pathofexile-dat.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
WORK = os.path.join(HERE, ".work")
SPEC_PATH = os.path.join(HERE, "tables.json")

SCHEMA_URL = "https://github.com/poe-tool-dev/dat-schema/releases/download/latest/schema.min.json"
LATEST_PATCH_URL = "https://raw.githubusercontent.com/poe-tool-dev/latest-patch-version/main/latest.txt"

# dat-schema marks each table with the game it belongs to; tables are defined
# TWICE (PoE1 and PoE2) with different column names, so picking the wrong bit
# silently gives you PoE2's shape.
VALID_FOR_POE1 = 1

# The CN client is the only Simplified Chinese source; the CDN carries the
# international set, where Traditional Chinese is the closest stand-in.
DEFAULT_LANGUAGES = {
    "cdn": ["English", "Traditional Chinese"],
    "local": ["English", "Simplified Chinese"],
}


def log(msg: str) -> None:
    print(msg, flush=True)


def die(msg: str) -> "None":
    print(f"\nERROR: {msg}", file=sys.stderr)
    sys.exit(1)


# --------------------------------------------------------------------------- #
# inputs
# --------------------------------------------------------------------------- #

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "poe-filter-project"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def resolve_patch(patch: str) -> str:
    if patch != "latest":
        return patch
    log(f"Resolving latest patch from {LATEST_PATCH_URL}")
    ver = fetch(LATEST_PATCH_URL).decode("utf-8").strip()
    if not ver:
        die("latest-patch-version returned an empty string")
    log(f"  latest = {ver}")
    return ver


def load_schema(offline: bool) -> dict:
    cache = os.path.join(WORK, "schema.min.json")
    if offline:
        if not os.path.exists(cache):
            die(f"--offline given but no cached schema at {cache}")
        log(f"Using cached schema {cache}")
        return json.load(open(cache, encoding="utf-8"))
    log(f"Fetching dat-schema from {SCHEMA_URL}")
    raw = fetch(SCHEMA_URL)
    os.makedirs(WORK, exist_ok=True)
    with open(cache, "wb") as fh:
        fh.write(raw)
    return json.loads(raw.decode("utf-8"))


def poe1_table(schema: dict, name: str) -> dict | None:
    for t in schema["tables"]:
        if t["name"] == name and (t.get("validFor", 0) & VALID_FOR_POE1):
            return t
    return None


# --------------------------------------------------------------------------- #
# config generation
# --------------------------------------------------------------------------- #

def build_config(spec: dict, schema: dict, source_key: str, source_val: str,
                 languages: list[str], only: list[str] | None,
                 dropped: set[str]) -> dict:
    """Validate every requested column against the schema, then emit config.json.

    A column that GGG renamed or removed must fail HERE, loudly, rather than
    downstream where it looks like an item simply vanished.
    """
    tables, problems = [], []
    for entry in spec["tables"]:
        name = entry["name"]
        if only and name not in only:
            continue
        sch = poe1_table(schema, name)
        if sch is None:
            problems.append(f"{name}: no PoE1 table with that name in the schema")
            continue
        available = {c["name"] for c in sch["columns"] if c.get("name")}
        wanted, skipped = [], []
        for col in entry["columns"]:
            if f"{name}.{col}" in dropped:
                skipped.append(col)
            elif col in available:
                wanted.append(col)
            else:
                problems.append(f"{name}.{col}: not in the PoE1 schema (renamed or removed?)")
        if skipped:
            log(f"  ! dropping {name}.{','.join(skipped)} (--drop-column)")
        if wanted:
            tables.append({"name": name, "columns": wanted})

    if problems:
        for p in problems:
            print(f"   {p}", file=sys.stderr)
        die(f"{len(problems)} schema mismatch(es) - tables.json is out of date with the game")

    cfg = {source_key: source_val, "translations": languages, "tables": tables}
    if spec.get("files"):
        cfg["files"] = spec["files"]
    return cfg


# --------------------------------------------------------------------------- #
# running the exporter
# --------------------------------------------------------------------------- #

def run_exporter(cfg: dict) -> None:
    entry = os.path.join(HERE, "node_modules", "pathofexile-dat", "dist", "cli", "run.js")
    if not os.path.exists(entry):
        die(f"pathofexile-dat is not installed.\n  Run:  npm install --prefix {HERE}")

    assert_patch_applied(entry, cfg.get("translations", []))

    os.makedirs(WORK, exist_ok=True)
    with open(os.path.join(WORK, "config.json"), "w", encoding="utf-8") as fh:
        json.dump(cfg, fh, ensure_ascii=False, indent=2)

    # The exporter reads ./config.json and writes ./tables and ./.cache relative
    # to the working directory, so it has to be run from inside .work/. Keeping
    # the CDN cache there means repeat runs of the same patch stay offline.
    log(f"\nRunning pathofexile-dat in {WORK}\n" + "-" * 62)
    proc = subprocess.run(
        [shutil.which("node") or "node", entry],
        cwd=WORK,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
    )
    tail = proc.stdout.strip().splitlines()
    for line in tail[-12:] if proc.returncode == 0 else tail[-40:]:
        log("  " + line)
    log("-" * 62)
    if proc.returncode != 0:
        die(
            "pathofexile-dat exited %d.\n"
            "  RangeError: Offset is outside the bounds of the DataView\n"
            "     -> the schema is newer than this client; drop the offending\n"
            "        trailing column, e.g. --drop-column BaseItemTypes.TalismanEnchants\n"
            "  NoFileInfoError\n"
            "     -> that table no longer ships in this patch; retire it in tables.json"
            % proc.returncode
        )


def assert_patch_applied(entry: str, languages: list[str]) -> None:
    """Simplified Chinese only exists because of our patch-package pin."""
    if "Simplified Chinese" not in languages:
        return
    src = open(os.path.join(os.path.dirname(entry), "export-tables.js"), encoding="utf-8").read()
    if "Data/Simplified Chinese" not in src:
        die(
            "pathofexile-dat has no Simplified Chinese entry - the patch-package pin\n"
            "  did not apply. Without it the exporter silently falls back to the\n"
            "  English tables and you get an English dump labelled zh.\n"
            f"  Run:  npm install --prefix {HERE}    (postinstall applies patches/)"
        )


# --------------------------------------------------------------------------- #
# verification
# --------------------------------------------------------------------------- #

def read_table(tables_dir: str, lang: str, name: str) -> list[dict]:
    path = os.path.join(tables_dir, lang, f"{name}.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def find_row(rows: list[dict], match: dict) -> dict | None:
    for row in rows:
        if all(row.get(k) == v for k, v in match.items()):
            return row
    return None


def verify(tables_dir: str, spec: dict, languages: list[str],
           exported: set[str]) -> dict[str, int]:
    """Assert known-true values survived the export.

    Column-name validation cannot catch a column INSERTED mid-table by a newer
    schema: every later offset shifts and the reader returns plausible garbage.
    These checks catch exactly that.
    """
    checks = spec["checks"]
    failures: list[str] = []
    counts: dict[str, int] = {}

    log("\nVerifying export")
    for name, rows_min in checks["min_rows"].items():
        if name not in exported:
            continue
        n = len(read_table(tables_dir, "English", name))
        counts[name] = n
        mark = "ok " if n >= rows_min else "FAIL"
        log(f"  [{mark}] {name:<32} {n:>6} rows (expected >= {rows_min})")
        if n < rows_min:
            failures.append(f"{name}: {n} rows, expected at least {rows_min}")

    for check in checks["values"]:
        name = check["table"]
        if name not in exported:
            continue
        rows = read_table(tables_dir, "English", name)
        row = find_row(rows, check["match"])
        if row is None:
            failures.append(f"{name}: no row matching {check['match']}")
            log(f"  [FAIL] {name:<32} no row matching {check['match']}")
            continue
        for col, want in check["expect"].items():
            got = row.get(col)
            if isinstance(want, str) and want.startswith("@"):
                # "@ItemClasses:StackableCurrency" - resolve the foreign row and
                # compare its Id. Proves the cross-table indices still line up.
                fk_table, fk_id = want[1:].split(":", 1)
                target = read_table(tables_dir, "English", fk_table)
                got = target[got]["Id"] if isinstance(got, int) and 0 <= got < len(target) else got
                want = fk_id
            mark = "ok " if got == want else "FAIL"
            log(f"  [{mark}] {name}.{col:<22} = {got!r} (expected {want!r})")
            if got != want:
                failures.append(f"{name}.{col} = {got!r}, expected {want!r}")

    probe = checks["translation_probe"]
    if probe["table"] in exported:
        for lang in languages:
            if lang == "English":
                continue
            row = find_row(read_table(tables_dir, lang, probe["table"]), probe["match"])
            got = row.get(probe["column"]) if row else None
            ok = got is not None and got != probe["english"]
            log(f"  [{'ok ' if ok else 'FAIL'}] {lang:<32} {probe['column']} = {got!r}")
            if not ok:
                failures.append(
                    f"{lang}: {probe['column']} is still {got!r} - that language folder does "
                    f"not exist in this source, so the exporter fell back to English"
                )

    if failures:
        print("", file=sys.stderr)
        for f in failures:
            print(f"   {f}", file=sys.stderr)
        die(f"{len(failures)} verification failure(s) - the dump is NOT trustworthy")
    log("  all checks passed")
    return counts


# --------------------------------------------------------------------------- #
# output
# --------------------------------------------------------------------------- #

def stage(label: str, cfg: dict, spec: dict, counts: dict[str, int],
          schema: dict, source: str) -> str:
    out = os.path.join(REPO, "data", "source", label)
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out, exist_ok=True)

    shutil.copytree(os.path.join(WORK, "tables"), os.path.join(out, "tables"))
    files_dir = os.path.join(WORK, "files")
    if os.path.isdir(files_dir):
        shutil.copytree(files_dir, os.path.join(out, "files"))

    tool_pkg = json.load(open(
        os.path.join(HERE, "node_modules", "pathofexile-dat", "package.json"), encoding="utf-8"))

    manifest = {
        "label": label,
        "source": source,
        "patch": cfg.get("patch"),
        "game_path": cfg.get("steam"),
        "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tool": f"pathofexile-dat@{tool_pkg['version']} (patched: +Simplified Chinese)",
        "schema_version": schema.get("version"),
        "languages": cfg["translations"],
        "tables": {t["name"]: {"columns": t["columns"], "rows": counts.get(t["name"])}
                   for t in cfg["tables"]},
        "caveats": [
            "GGPK says what EXISTS, not what DROPS. 3.29 still ships all 78 talismans "
            "including the 26 FilterBlade retired. Never auto-retire on absence, never "
            "assume presence means droppable.",
            "Join on Id only. Never join two language dumps on _index/_rid (94% of rows "
            "differ) and never on English Name (413 duplicates). See ADR-0004.",
        ],
    }
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)
    return out


# --------------------------------------------------------------------------- #

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Extract the curated GGPK table set into data/source/<label>/.")
    ap.add_argument("--source", choices=["cdn", "local"], required=True)
    ap.add_argument("--patch", default="latest",
                    help="cdn only: version string, or 'latest' (default)")
    ap.add_argument("--game-path", help="local only: game folder containing Bundles2/")
    ap.add_argument("--label", help="output dir under data/source/ "
                                    "(default: the patch version; required for --source local)")
    ap.add_argument("--languages", nargs="+",
                    help="default: English + Traditional Chinese (cdn), "
                         "English + Simplified Chinese (local)")
    ap.add_argument("--tables", nargs="+", help="limit to these tables (debugging)")
    ap.add_argument("--drop-column", action="append", default=[], metavar="Table.Column",
                    help="skip a column this client is too old to have")
    ap.add_argument("--offline", action="store_true",
                    help="reuse the cached schema instead of refetching")
    args = ap.parse_args()

    spec = json.load(open(SPEC_PATH, encoding="utf-8"))
    languages = args.languages or DEFAULT_LANGUAGES[args.source]

    if args.source == "cdn":
        patch = resolve_patch(args.patch)
        source_key, source_val = "patch", patch
        label = args.label or patch
        source_desc = f"GGG CDN patch {patch}"
    else:
        if not args.game_path:
            die("--source local requires --game-path")
        if not os.path.isdir(os.path.join(args.game_path, "Bundles2")):
            die(f"no Bundles2/ under {args.game_path} - is that the game folder?")
        if not args.label:
            die("--source local requires --label (the install carries no version string; "
                "name it yourself, e.g. --label cn-3.28)")
        source_key, source_val = "steam", args.game_path
        label = args.label
        source_desc = f"local install {args.game_path}"

    log(f"Source     : {source_desc}")
    log(f"Languages  : {', '.join(languages)}")
    log(f"Output     : data/source/{label}/\n")

    schema = load_schema(args.offline)
    cfg = build_config(spec, schema, source_key, source_val, languages,
                       args.tables, set(args.drop_column))
    log(f"Validated {len(cfg['tables'])} tables / "
        f"{sum(len(t['columns']) for t in cfg['tables'])} columns against schema "
        f"v{schema.get('version')}")

    run_exporter(cfg)
    exported = {t["name"] for t in cfg["tables"]}
    counts = verify(os.path.join(WORK, "tables"), spec, languages, exported)
    out = stage(label, cfg, spec, counts, schema, source_desc)

    log(f"\nWrote {os.path.relpath(out, REPO)}")
    log("  tables/<Language>/<Table>.json  +  manifest.json")
    log("\nRaw dumps are gitignored build artifacts; the manifest is committed.")


if __name__ == "__main__":
    main()
