#!/usr/bin/env python3
# [parsing_tool group A: LIVE TOOL] read-only. Writes one HTML file outside the repo.
"""Build the designer handoff: every theme category x tier that now exists, with swatches.

    python parsing_tool/theme/build_designer_handoff.py

Writes C:/Users/shini/Documents/poe-filter-theme-handoff.html (stable name, no timestamp).

★ Why this exists: the project decided **structure before theme** — lock categories,
subcategories and tiers first "so the designer can make a perfect fit theme for us instead
of guessing what might be at there". The equipment reshape finished that, so this is the
tree they were waiting for.

It shows, per category and in emission order: each tier's labels, how many bases it claims,
its strictness gate, and its ACTUAL current colours as swatches — plus three flags the
designer needs:

  * SHARED   — this row is used by N tiers, so they are indistinguishable in game
  * NO ROW   — the tier points at a theme row that does not exist (emits font size only)
  * BORROWED — the category has no theme entry of its own and reads another's

⚠️ `sharket_theme.json` is HAND-TUNED. This tool only READS it. Nothing here regenerates a
theme; `build_standard_theme.py` is group B for that reason.
"""
from __future__ import annotations

import io
import json
import os
import re
from collections import Counter, OrderedDict, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(REPO, "filter_generation", "data")
THEME = os.path.join(DATA, "theme", "sharket", "sharket_theme.json")
OUT = r"C:\Users\shini\Documents\poe-filter-theme-handoff.html"

UNIQUE_TEXT = "#af6025"      # PoE's own unique-item text colour


def load(p):
    return json.load(io.open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)


def lum(h):
    h = (h or "").lstrip("#")[:6]
    if len(h) < 6:
        return None
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    if la is None or lb is None:
        return None
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def css(c, fallback="transparent"):
    if not c:
        return fallback
    h = c.lstrip("#")
    return "#" + h[:6] if len(h) >= 6 else fallback


def collect():
    theme = load(THEME)
    cats = []
    for root, _dirs, files in os.walk(os.path.join(DATA, "tier_definition")):
        for fn in sorted(files):
            if not fn.endswith(".json"):
                continue
            p = os.path.join(root, fn)
            rel = os.path.relpath(p, os.path.join(DATA, "tier_definition")).replace("\\", "/")
            mp = os.path.join(DATA, "base_mapping", os.path.relpath(p, os.path.join(DATA, "tier_definition")))
            counts = Counter()
            gen_order = 0
            if os.path.exists(mp):
                md = load(mp)
                for b, t in (md.get("mapping") or {}).items():
                    for k in (t if isinstance(t, list) else [t]):
                        counts[k] += 1
                gen_order = (md.get("_meta") or {}).get("gen_order", 0)
            doc = load(p)
            for cat, body in doc.items():
                meta = body.get("_meta") or {}
                tc = meta.get("theme_category") or cat
                rows = theme.get(tc)
                order = meta.get("tier_order") or [k for k in body if k != "_meta"]
                tiers = []
                for k in order:
                    v = body.get(k)
                    if not isinstance(v, dict):
                        continue
                    n = (v.get("theme") or {}).get("Tier")
                    row = "Tier %s" % n if n is not None else None
                    style = (rows or {}).get(row) if row else None
                    tiers.append(OrderedDict([
                        ("key", k),
                        ("en", (v.get("localization") or {}).get("en") or k),
                        ("ch", (v.get("localization") or {}).get("ch") or ""),
                        ("row", row),
                        ("style", style),
                        ("bases", counts.get(k, 0)),
                        ("gate", v.get("hide_at_strictness")),
                        ("hide", bool(v.get("is_hide_tier"))),
                        ("cond_only", bool(v.get("class_condition"))),
                    ]))
                cats.append(OrderedDict([
                    ("file", rel), ("cat", cat), ("theme_cat", tc),
                    ("borrowed", tc != cat), ("has_rows", rows is not None),
                    ("gen_order", gen_order), ("tiers", tiers),
                ]))
    # how many tiers share each (theme_cat, row)
    share = defaultdict(list)
    for c in cats:
        for t in c["tiers"]:
            if t["row"] and t["style"] is not None:
                share[(c["theme_cat"], t["row"])].append("%s / %s" % (c["cat"], t["key"]))
    return theme, cats, share


def html(theme, cats, share):
    o = []
    a = o.append
    a("<title>POE Filter — theme handoff</title>")
    a("""<style>
:root{--bg:#14161a;--fg:#e6e8ec;--dim:#9aa0ab;--line:#2a2d35;--card:#1b1e24;--warn:#e0b93a;--bad:#e05a5a}
@media (prefers-color-scheme: light){:root{--bg:#f7f7f9;--fg:#1a1c20;--dim:#5c626e;--line:#dcdee3;--card:#fff}}
:root[data-theme="dark"]{--bg:#14161a;--fg:#e6e8ec;--dim:#9aa0ab;--line:#2a2d35;--card:#1b1e24}
:root[data-theme="light"]{--bg:#f7f7f9;--fg:#1a1c20;--dim:#5c626e;--line:#dcdee3;--card:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);
 font:15px/1.55 ui-sans-serif,system-ui,"Segoe UI",sans-serif;padding:32px}
.wrap{max-width:1180px;margin:0 auto}
h1{font-size:1.7rem;margin:0 0 4px}h2{font-size:1.05rem;margin:30px 0 8px;
 padding-bottom:5px;border-bottom:1px solid var(--line)}
.sub{color:var(--dim);margin:0 0 22px}
.note{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--warn);
 padding:12px 16px;border-radius:5px;margin:16px 0}
table{width:100%;border-collapse:collapse;font-size:.86rem}
th{text-align:left;color:var(--dim);font-weight:600;padding:5px 8px;border-bottom:1px solid var(--line)}
td{padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.sw{display:inline-block;padding:3px 12px;border-radius:3px;font-weight:600;white-space:nowrap;
 border:1px solid rgba(128,128,128,.35);min-width:150px;text-align:center}
.mono{font-family:ui-monospace,Consolas,monospace;font-size:.8rem;color:var(--dim)}
.num{font-variant-numeric:tabular-nums;text-align:right}
.tag{font-size:.7rem;padding:1px 6px;border-radius:3px;border:1px solid var(--line);color:var(--dim);
 margin-left:5px;white-space:nowrap}
.tag.shared{border-color:var(--warn);color:var(--warn)}
.tag.norow{border-color:var(--bad);color:var(--bad)}
.tag.hide{opacity:.55}
.scroll{overflow-x:auto}
.cat-meta{color:var(--dim);font-size:.8rem;font-weight:400;margin-left:8px}
</style>""")
    a('<div class="wrap">')
    a("<h1>Theme handoff — the settled tree</h1>")
    a('<p class="sub">Every theme category and tier that exists after the equipment reshape, '
      'in emission order, with its current colours. This is the tree to design against.</p>')

    dup = {k: v for k, v in share.items() if len(v) > 1}
    # A HIDE tier's missing row is not a finding: in Ruthless a hide emits `Minimal` with no
    # style lines, so its colours never reach the game. Counting them buried the one real
    # case under 59 that cannot matter.
    norow = [(c["cat"], t["key"], t["row"]) for c in cats for t in c["tiers"]
             if t["row"] and t["style"] is None and c["has_rows"] and not t["hide"]]
    borrowed = [(c["cat"], c["theme_cat"]) for c in cats if c["borrowed"]]

    a('<div class="note"><b>What needs a decision</b><ul>')
    a("<li><b>%d theme rows are shared by 2 or more tiers</b> — those tiers are "
      "indistinguishable in game. Some are deliberate (Campaign's per-class rare tiers); the "
      "ranked tiers added by the reshape are not.</li>" % len(dup))
    a("<li><b>Uniques / Jewels carry an explicit <span class='mono'>TextColor</span> on every "
      "row.</b> Dropping it so the game paints the rarity colour would make 7 of 8 rows "
      "unreadable — <span class='mono'>Uniques Tier 2</span> is exactly 1.00:1, because its "
      "background <em>is</em> the unique orange <span class='mono'>%s</span>. Going "
      "rarity-through needs new backgrounds, not just a key removal.</li>" % UNIQUE_TEXT)
    a("<li><b>Gear family was collapsed to one hue.</b> Weapons "
      "<span class='mono'>#221a16</span>, armour <span class='mono'>#1a1e23</span> and "
      "jewellery <span class='mono'>#242014</span> became one category; armour's hue won. "
      "Whether that distinction returns, and how, is open.</li>")
    if borrowed:
        a("<li><b>%d categories have no theme entry of their own</b> and read another's: %s</li>"
          % (len(borrowed), ", ".join("%s → %s" % b for b in borrowed[:6])))
    if norow:
        a("<li>%d tier(s) point at a row that does not exist: %s</li>"
          % (len(norow), ", ".join("%s / %s (%s)" % n for n in norow)))
    a("</ul></div>")
    a('<div class="note"><b>An absent colour key is meaningful.</b> Leaving '
      "<span class='mono'>TextColor</span> unset lets the game paint the item's own rarity "
      "colour — 441 of 998 rows do this on purpose. Setting a default paints over it. Same "
      "for border and beam. Also: a <b>hide</b> block in Ruthless emits "
      "<span class='mono'>Minimal</span> with <em>no</em> style lines, so its colours never "
      "show and never need designing.</div>")

    for c in sorted(cats, key=lambda x: (x["gen_order"], x["file"])):
        if not c["tiers"]:
            continue
        extra = []
        if c["borrowed"]:
            extra.append("theme: %s" % c["theme_cat"])
        if not c["has_rows"]:
            extra.append("NO THEME ENTRY")
        if c["gen_order"]:
            extra.append("gen_order %s" % c["gen_order"])
        a('<h2>%s<span class="cat-meta">%s%s</span></h2>'
          % (c["cat"], c["file"], (" · " + " · ".join(extra)) if extra else ""))
        a('<div class="scroll"><table><tr><th>tier</th><th>label</th><th class="num">bases</th>'
          '<th class="num">gate</th><th>row</th><th>appearance</th><th>keys</th></tr>')
        for t in c["tiers"]:
            st = t["style"] or {}
            bg, fg = css(st.get("BackgroundColor"), "#222"), css(st.get("TextColor"), UNIQUE_TEXT)
            fs = st.get("FontSize") or 32
            size = max(11, min(20, int(fs) * 0.42))
            tags = ""
            if t["hide"]:
                tags += '<span class="tag hide">hide</span>'
            if t["cond_only"]:
                tags += '<span class="tag">condition-only</span>'
            n = len(share.get((c["theme_cat"], t["row"]), []))
            if n > 1:
                tags += '<span class="tag shared">shared ×%d</span>' % n
            if t["row"] and t["style"] is None and c["has_rows"] and not t["hide"]:
                tags += '<span class="tag norow">no row</span>'
            if t["hide"]:
                look = '<span class="mono">Minimal — no style</span>'
            else:
                look = ('<span class="sw" style="background:%s;color:%s;font-size:%dpx">%s</span>'
                        % (bg, fg, size, t["ch"] or t["en"]))
                if not st.get("TextColor"):
                    look += '<span class="tag">rarity text</span>'
            a("<tr><td class='mono'>%s</td><td>%s%s<br><span class='mono'>%s</span></td>"
              "<td class='num'>%s</td><td class='num'>%s</td><td class='mono'>%s</td>"
              "<td>%s</td><td class='mono'>%s</td></tr>"
              % (t["key"], t["en"], tags, t["ch"], t["bases"] or "",
                 t["gate"] if t["gate"] is not None else "",
                 t["row"] or "—", look, ", ".join(sorted(st)) or "—"))
        a("</table></div>")

    a("<h2>Rows shared by more than one tier</h2>")
    a('<div class="scroll"><table><tr><th>theme category</th><th>row</th><th class="num">tiers</th>'
      "<th>which</th></tr>")
    for (tc, row), ks in sorted(dup.items(), key=lambda kv: -len(kv[1])):
        a("<tr><td>%s</td><td class='mono'>%s</td><td class='num'>%d</td><td class='mono'>%s</td></tr>"
          % (tc, row, len(ks), ", ".join(ks)))
    a("</table></div></div>")
    return "\n".join(o)


def main():
    theme, cats, share = collect()
    page = html(theme, cats, share)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8").write(
        "<!doctype html><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>" + page)
    tiers = sum(len(c["tiers"]) for c in cats)
    print("categories %d, tiers %d, shared rows %d"
          % (len(cats), tiers, len([1 for v in share.values() if len(v) > 1])))
    print("wrote %s" % OUT)


if __name__ == "__main__":
    main()
