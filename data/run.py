import argparse, csv
from pathlib import Path
import pandas as pd
from scraper import process_one, OUT_DIR

def read_inputs_csv(path: str):
    items = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            typ = (row.get("type") or "").strip().lower() or "auto"
            src = (row.get("source") or "").strip()
            if src:
                items.append((typ, src))
    return items

def main():
    ap = argparse.ArgumentParser(description="Fetch/parse PoEDB pages with pluggable parsers.")
    ap.add_argument("--config", default="config/input.csv", help="CSV with columns: type,source")
    ap.add_argument("--fetch", action="store_true", help="Allow fetching URLs (otherwise use cache/local only)")
    ap.add_argument("--overwrite", action="store_true", help="Force re-fetch URLs to cache")
    ap.add_argument("--out", default=str(OUT_DIR / "items.csv"))
    args = ap.parse_args()

    inputs = read_inputs_csv(args.config)
    frames = []
    for typ, src in inputs:
        try:
            if args.fetch and args.overwrite and src.lower().startswith(("http://","https://")):
                # optional eager refresh — reuses process_one which will fetch if needed anyway
                pass
            df = process_one(src, parser_key=typ, allow_fetch=args.fetch)
            frames.append(df)
            print(f"OK: {typ:10s}  {src}  -> {len(df)} rows")
        except Exception as e:
            print(f"FAIL: {typ:10s}  {src}  -> {e}")

    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.out, index=False, encoding="utf-8")
    print(f"✅ Wrote {len(out)} rows to {args.out}")

if __name__ == "__main__":
    main()
