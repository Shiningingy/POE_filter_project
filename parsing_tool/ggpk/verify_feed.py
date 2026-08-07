# -*- coding: utf-8 -*-
"""Verify a WebFetch-extracted GGG feed list against GGPK BaseItemTypes.

⚠️ WebFetch answers with a SMALL FAST MODEL over the page, so its output is a summary,
not a transcript. On the 3.29.0 thread its own section counts disagreed with its own lists
in 5 of 7 sections. So nothing it returns may reach curation unchecked.

GGPK is the check that works, and the README says exactly why: a RETIRED base stays in
BaseItemTypes -- retirement stops the drop, it does not delete the row. So every real name
from any section (new, removed, returning, renamed) must resolve in BaseItemTypes. A name
that does not resolve is the fetch's invention or its typo, never a retirement.
"""
import io, json, os, sys, re, unicodedata
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_names():
    """-> dict normalised_name -> canonical Name, from the newest English dump."""
    cands = [
        os.path.join(ROOT, "data", "source", "3.29.0.4.2", "tables", "English", "BaseItemTypes.json"),
        os.path.join(ROOT, "data", "source", "3.29.0.2.2", "tables", "English", "BaseItemTypes.json"),
        os.path.join(ROOT, "data", "from_ggpk", "baseitemtypes.json"),
    ]
    for p in cands:
        if not os.path.exists(p):
            continue
        d = json.load(io.open(p, encoding="utf-8"))
        rows = d if isinstance(d, list) else (d.get("rows") or d.get("data") or [])
        out = {}
        for r in rows:
            if not isinstance(r, dict):
                continue
            n = r.get("Name") or r.get("name")
            if n:
                out.setdefault(norm(n), n)
        if out:
            return p, out
    return None, {}

def norm(s):
    s = unicodedata.normalize("NFKC", str(s)).strip().lower()
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    s = re.sub(r"\s+", " ", s)
    return s

def check(label, names, table):
    hit = [n for n in names if norm(n) in table]
    miss = [n for n in names if norm(n) not in table]
    print(f"  {label:<22} {len(names):>3} claimed | {len(hit):>3} resolve | {len(miss):>3} DO NOT")
    for m in miss:
        print(f"        ✗ {m}")
    return hit, miss

if __name__ == "__main__":
    src, table = load_names()
    print(f"BaseItemTypes: {len(table)} names from {os.path.relpath(src, ROOT) if src else '(none found)'}\n")
    payload = json.load(io.open(sys.argv[1], encoding="utf-8"))
    allmiss = {}
    for sec, names in payload.items():
        if sec.startswith("_"):
            continue
        _, miss = check(sec, names, table)
        if miss:
            allmiss[sec] = miss
    print()
    print(json.dumps({"unresolved": allmiss}, ensure_ascii=False, indent=1))
