from __future__ import annotations
from pathlib import Path
import re, time
from typing import Optional, Iterable, List
from bs4 import BeautifulSoup
import pandas as pd

from parsers import REGISTRY, available_parsers, auto_detect_parser
from helpers_item_class import infer_item_class_from_source, infer_item_class_from_html

try:
    from playwright.sync_api import sync_playwright
    HAS_PW = True
except Exception:
    HAS_PW = False

CACHE_DIR = Path("cache")
OUT_DIR = Path("out")
CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

def _slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"^https?://", "", s)
    s = re.sub(r"[^a-z0-9/_-]+", "_", s)
    s = s.strip("_")
    return s or "page"

def fetch_and_cache(url: str, overwrite: bool=False, wait_s: float=0.0) -> Path:
    if not HAS_PW:
        raise RuntimeError("Playwright not installed. `pip install playwright && playwright install`")
    path = CACHE_DIR / (_slugify(url).replace("/", "_") + ".html")
    if path.exists() and not overwrite:
        return path
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent="PoEFilterProject/1.0 (+cache)")
        page = ctx.new_page()
        page.goto(url, wait_until="networkidle")
        html = page.content()
        path.write_text(html, encoding="utf-8")
        browser.close()
    if wait_s:
        time.sleep(wait_s)
    return path

def load_html(source: str, allow_fetch: bool) -> str:
    if re.match(r"^https?://", source, re.I):
        cache_path = fetch_and_cache(source) if allow_fetch else CACHE_DIR / (_slugify(source).replace("/", "_") + ".html")
        if not cache_path.exists():
            raise FileNotFoundError(f"No cached file for URL: {source}")
        return cache_path.read_text(encoding="utf-8", errors="ignore")
    return Path(source).read_text(encoding="utf-8", errors="ignore")

def parse_dispatch(html: str, source: str, parser_key: Optional[str]) -> pd.DataFrame:
    soup = BeautifulSoup(html, "lxml")
    # resolve parser
    key = parser_key
    if not key or key == "auto":
        key = auto_detect_parser(soup)
        if not key:
            raise RuntimeError(f"Auto-detect failed. Specify a parser. Available: {available_parsers()}")
    parser_fn = REGISTRY[key]

    # infer item_class once per page (fallback to HTML heading)
    item_class = infer_item_class_from_source(source) or infer_item_class_from_html(soup)

    df = parser_fn(soup)
    if df.empty:
        return df
    df["class"] = item_class
    return df

def process_one(source: str, parser_key: Optional[str], allow_fetch: bool) -> pd.DataFrame:
    html = load_html(source, allow_fetch=allow_fetch)
    return parse_dispatch(html, source, parser_key)
