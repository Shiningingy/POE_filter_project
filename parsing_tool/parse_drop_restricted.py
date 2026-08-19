#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] Safe to run. See parsing_tool/README.md.
"""Extract the wiki's drop-restriction lists from a saved copy of the page.

    python parsing_tool/parse_drop_restricted.py
    python parsing_tool/parse_drop_restricted.py --html "data/from_wiki/Drop-restricted item _ PoE Wiki.html"

★ WHY THIS IS THE SOURCE WE WERE MISSING. GGG's filter-info feed has three verbs — new,
removed, returning — and cannot express "exists, but not this league". FilterBlade defines a
`NonDrop` tag and applies it to zero of 1067 items. The author had to supply that state from
memory, which is how `data/from_ggg/author_status.json` came to exist.

This page states it directly, and in THREE grades that map onto exactly the distinctions we
had been guessing at:

    usable      drop-disabled but can still be used — no new copies drop, existing ones work
    defunct     drop-disabled AND has no function in the current version
    removed     introduced in a league and later REMOVED FROM THE GAME ENTIRELY

The third grade is the one the author asked for from the start: *"sometimes ggg will just
delete that item instead of leaving a legacy."*

⚠️ It cannot be fetched. Direct, r.jina.ai, ?action=raw and api.php all sit behind
Cloudflare/Anubis and return 403 — the same wall documented in parse_ruthless_wiki.py, which
this file deliberately mirrors in shape. The page is saved by hand into data/from_wiki/.

⚠️ ENTRIES ARE PROSE, NOT KEYS. The page says "Lure", "Incubators", "Charms", "Runes" — family
words, not BaseTypes. So this writes both the raw phrases and a resolved base list, and the
resolution is a SUBSTRING match against GGPK BaseItemTypes that a human has to review. A
phrase like "Nets" matches far more than it means; the report flags any phrase resolving to a
suspiciously large set rather than silently expanding it.
"""
import argparse
import collections
import glob
import html
import io
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "from_wiki", "drop_restricted.json")

# The three sentences that introduce the lists, and the grade each one confers.
LEADS = [
    ("usable",  "drop-disabled but can be used"),
    ("defunct", "drop-disabled but have no function"),
    ("removed", "removed from the game entirely"),
]

# A phrase resolving to more bases than this is reported, never auto-expanded.
WIDE = 12


def strip(h):
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h))).strip()


def find_html():
    hits = glob.glob(os.path.join(ROOT, "data", "from_wiki", "*Drop-restricted*.html"))
    hits += glob.glob(os.path.join(ROOT, "data", "*Drop-restricted*.html"))
    return hits[0] if hits else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html")
    a = ap.parse_args()
    path = a.html or find_html()
    if not path or not os.path.exists(path):
        print("no saved page found — save https://www.poewiki.net/wiki/Drop-restricted_item "
              "into data/from_wiki/ as HTML")
        return 1
    print("reading %s" % os.path.basename(path))
    raw = io.open(path, encoding="utf-8", errors="replace").read()

    # Each list runs from its lead sentence to the next lead (or the next h2).
    text_pos = []
    for grade, lead in LEADS:
        i = raw.find(lead)
        if i < 0:
            print("  ⚠️  lead sentence not found for grade %r — page layout changed" % grade)
            continue
        text_pos.append((i, grade, lead))
    text_pos.sort()

    graded = collections.OrderedDict()
    for n, (i, grade, lead) in enumerate(text_pos):
        end = text_pos[n + 1][0] if n + 1 < len(text_pos) else i + 30000
        # ⚠️ TAKE THE <li> ELEMENTS, DO NOT STRIP FIRST. Stripping the tags before reading the
        # bullets destroys the only boundary the list has, and a first pass that split the
        # stripped prose on capital letters shredded every multi-word name — "Chaos Shard,
        # Regal Shard" came out as "Chaos", "Shard", "Regal". The markup IS the delimiter.
        phrases = []
        for li in re.findall(r"<li[^>]*>(.*?)</li>", raw[i:end], re.S):
            t = strip(li)
            if not t or len(t) > 200:
                continue
            # "League: a , b , c" -> the items after the colon; otherwise the bullet itself.
            body = t.split(":", 1)[1] if ":" in t and len(t.split(":", 1)[0]) < 40 else t
            for p in re.split(r"\s*,\s*", body):
                p = p.strip(" .")
                if p and not p.lower().startswith(("obtained", "primarily", "drops", "can drop")):
                    phrases.append(p)
        graded[grade] = [p for p in dict.fromkeys(phrases) if p]

    # ── resolve phrases to real BaseTypes, conservatively ──────────────────────
    G = os.path.join(ROOT, "data", "source", "cn-3.29", "tables", "English", "BaseItemTypes.json")
    bases = []
    if os.path.exists(G):
        bases = sorted({r["Name"] for r in json.load(io.open(G, encoding="utf-8")) if r.get("Name")})

    doc = collections.OrderedDict()
    doc["_source"] = ("https://www.poewiki.net/wiki/Drop-restricted_item — saved by hand; the "
                      "wiki 403s every fetch method (see parse_ruthless_wiki.py).")
    doc["_grades"] = {g: l for g, l in LEADS}
    doc["_warning"] = ("`phrases` is what the page literally says and is AUTHORITATIVE. `resolved` "
                       "is a substring expansion against GGPK and is a SUGGESTION — review it. A "
                       "phrase marked wide matched more bases than it plausibly means.")
    for grade in ("usable", "defunct", "removed"):
        ph = graded.get(grade, [])
        res, wide = {}, {}
        for p in ph:
            hits = [b for b in bases if p.lower() in b.lower()] or ([p] if p in bases else [])
            (wide if len(hits) > WIDE else res)[p] = hits
        doc[grade] = {"phrases": ph, "resolved": res, "wide_needs_review": wide}

    io.open(OUT, "w", encoding="utf-8").write(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")

    print()
    for grade, lead in LEADS:
        d = doc.get(grade) or {}
        n_ph = len(d.get("phrases") or [])
        n_res = sum(len(v) for v in (d.get("resolved") or {}).values())
        n_wide = len(d.get("wide_needs_review") or {})
        print("  %-8s %2d phrases -> %3d bases   (%d phrases too wide to expand)"
              % (grade, n_ph, n_res, n_wide))
        for p in (d.get("phrases") or [])[:40]:
            print("       %s" % p)
        print()
    print("wrote %s" % os.path.relpath(OUT, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
