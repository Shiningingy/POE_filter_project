#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Extract Ruthless droppability lists from a saved copy of the wiki page.

The page (https://www.poewiki.net/wiki/Ruthless_mode) is the only source that
states which items DROP in Ruthless - GGPK ships every base type regardless
(see docs/adr/0004 and CONTEXT.md). It cannot be fetched: direct, r.jina.ai,
?action=raw and api.php all return 403 behind Cloudflare/Anubis. So the page is
saved by hand and parsed here.

    python parsing_tool/parse_ruthless_wiki.py                     # auto-find
    python parsing_tool/parse_ruthless_wiki.py --html "data/Ruthless mode.html"

Writes data/from_wiki/ruthless_droppability.json and prints a reconcile against
our own tree: items we show that cannot drop, and Ruthless-exclusives we miss.
"""

from __future__ import annotations

import argparse
import glob
import html
import json
import os
import re
import collections

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
BM = os.path.join(REPO, "filter_generation", "data", "base_mapping")

# Section headings we care about, by their MediaWiki anchor id.
WANTED = {
    "Ruthless-removed_items": "removed",
    "Drop-disabled_items": "removed_items",
    "Drop-disabled_currency": "removed_currency",
    "Drop-disabled_gems": "removed_gems",
    "Ruthless-exclusive_items": "exclusive",
}


def find_html(explicit: str | None) -> str:
    if explicit:
        return explicit if os.path.isabs(explicit) else os.path.join(REPO, explicit)
    pats = [os.path.join(REPO, "data", "*uthless*.htm*"),
            os.path.join(REPO, "data", "from_wiki", "*.htm*"),
            os.path.join(REPO, "*uthless*.htm*")]
    for pat in pats:
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[0]
    raise SystemExit("No saved page found. Pass --html <path>, or drop it in data/ "
                     "with 'Ruthless' in the filename.")


def strip_tags(fragment: str) -> str:
    fragment = re.sub(r"(?is)<(script|style).*?</\1>", " ", fragment)
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def sections(raw: str) -> dict:
    """Split the page body by <h2>/<h3> anchors into {anchor_id: html}."""
    heads = list(re.finditer(
        r'<h([23])[^>]*>\s*<span[^>]*class="mw-headline"[^>]*id="([^"]+)"', raw))
    out = {}
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(raw)
        out[m.group(2)] = raw[m.end():end]
    return out


def item_names(fragment: str) -> list[str]:
    """Item names, in page order.

    The wiki wraps every ITEM in a `c-item-hoverbox` span (the tooltip widget)
    while plain links are places, NPCs and mechanics - Hillock, Einhar,
    The Twilight Strand, Beastcrafting. Matching the hoverbox therefore
    separates items from prose links exactly, with no keyword blacklist.

    Note hrefs are absolute (https://www.poewiki.net/wiki/...) in a browser
    "save complete page", not root-relative as they are when served, so the
    title attribute is used rather than the href.
    """
    names, seen = [], set()
    for m in re.finditer(r'c-item-hoverbox__activator.*?<a\b[^>]*title="([^"]+)"',
                         fragment, re.S):
        text = html.unescape(m.group(1)).strip()
        if text and text.lower() not in seen:
            seen.add(text.lower())
            names.append(text)
    return names


def bullets(fragment: str) -> list[str]:
    return [t for t in (strip_tags(li) for li in re.findall(r"(?is)<li[^>]*>(.*?)</li>", fragment)) if t]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--html")
    ap.add_argument("--write", action="store_true", help="save the extracted JSON")
    args = ap.parse_args()

    path = find_html(args.html)
    print(f"reading {os.path.relpath(path, REPO)}")
    raw = open(path, encoding="utf-8", errors="replace").read()
    secs = sections(raw)
    print(f"  {len(secs)} sections found")

    found = {}
    for anchor, key in WANTED.items():
        frag = secs.get(anchor)
        if frag is None:
            print(f"  [miss] {anchor}")
            continue
        names = item_names(frag)
        found[key] = {"names": names, "bullets": bullets(frag)[:40]}
        print(f"  [ok  ] {anchor:<28} {len(names)} item link(s)")

    disabled = sorted({n for k, v in found.items() if k.startswith("removed")
                       for n in v["names"]})
    exclusive = sorted(set(found.get("exclusive", {}).get("names", [])))
    print(f"\ndrop-disabled: {len(disabled)}   ruthless-exclusive: {len(exclusive)}")

    # --- reconcile against our tree ---------------------------------------- #
    where, excluded = collections.defaultdict(dict), set()
    for p in glob.glob(os.path.join(BM, "**", "*.json"), recursive=True):
        rel = os.path.relpath(p, BM).replace("\\", "/")
        try:
            d = json.load(open(p, encoding="utf-8-sig"))
        except Exception:
            continue
        if "ruthless" in ((d.get("_meta") or {}).get("excluded_modes") or []):
            excluded.add(rel)
        for n, v in (d.get("mapping") or {}).items():
            where[n][rel] = v

    def live(name):
        return {f: v for f, v in where.get(name, {}).items()
                if not f.startswith("_legacy/") and f not in excluded}

    shown_but_dead = {n: live(n) for n in disabled if live(n)}
    missing_exclusive = [n for n in exclusive if not live(n)]

    print(f"\n=== SHOWN but cannot drop in Ruthless ({len(shown_but_dead)}) ===")
    for n, files in sorted(shown_but_dead.items()):
        for f, v in files.items():
            print(f"   {n:<30} {f:<40} {v}")
    print(f"\n=== Ruthless-EXCLUSIVE but not mapped ({len(missing_exclusive)}) ===")
    for n in missing_exclusive:
        print(f"   {n}")

    if args.write:
        out_dir = os.path.join(REPO, "data", "from_wiki")
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, "ruthless_droppability.json")
        with open(out, "w", encoding="utf-8") as fh:
            json.dump({"source": "poewiki.net/wiki/Ruthless_mode (saved by hand; the "
                                 "page 403s to every fetch route)",
                       "drop_disabled": disabled, "ruthless_exclusive": exclusive,
                       "sections": found}, fh, ensure_ascii=False, indent=2)
        print(f"\nwrote {os.path.relpath(out, REPO)}")
    else:
        print("\n(--write to save data/from_wiki/ruthless_droppability.json)")


if __name__ == "__main__":
    main()
