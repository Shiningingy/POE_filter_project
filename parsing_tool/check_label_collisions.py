# -*- coding: utf-8 -*-
"""Where the look on the ground does not match the look that was authored.

    node filter_generation/generate.mjs --mode ruthless --strictness soft \
         --out out/diag.filter --trace filter_generation/traces/ruthless-soft.json
    python parsing_tool/check_label_collisions.py

Answers the author's in-game report — *"some items have themes not intended, but just a small
portion"* — by separating the three different things that produce that one symptom. They need
three different responses and three different people, which is why finding them mixed together
makes the whole class feel unfixable.

★ 1. A DESIGNER ROW THAT NEVER REACHES THE GAME. Since workstream B the tier block owns its
look: `resolveTierTheme` starts from the theme row and then lets inline overwrite it. So a tier
carrying inline colours is IMMUNE to a theme-row edit. Port rev 23 into the rows and the tiers
whose inline still holds the pre-port value keep rendering the pre-port value, silently.

⚠️ INLINE IS NOT AUTOMATICALLY STALE. That premise, applied tree-wide, cost a revert (`986ad1f`):
Maps' plate is a function of MAP TIER rather than rung and is authored inline on purpose, and
`Currency/Gold.json` uses `disabled:` sentinels inline to silence channels deliberately. So this
reports the divergence and says which side is rev-23-authored; it never picks a winner.

★ 2 and 3. TWO TIERS THAT READ THE SAME. A dropped item is a LABEL: font size, text colour,
border, plate. That is what the eye reads at a glance. Beam and minimap icon are secondary —
they tell you an item is there, not what it is — so two tiers that differ only in beam colour
still read as the same item on the ground.

So the label is the key, and the beam/icon are reported alongside rather than folded in.

★ THE ONE DISTINCTION THAT DECIDES WHO FIXES IT. Every look is resolved as
`theme[theme_category]["Tier N"]`, where N is the tier's declared `theme.Tier` — its RUNG. So:

  SAME RUNG      the theme did exactly what it was told; two tiers asked for one rung and got
                 one look. Nothing is broken in the palette. The open question is whether these
                 tiers should share a rung at all — a TIERING decision, and the author's.
  DIFFERENT RUNG two rungs paint identically. The ladder asked for a step and did not get one.
                 That is a THEME defect and ours to fix.

Reporting them together is what makes this class of bug feel unfixable: half the rows need a
palette edit and half need a re-tier, and no one can tell which without opening both files.

⚠️ A COLLISION IS NOT AUTOMATICALLY A BUG. Some are authored on purpose and are marked BY
DESIGN below:
  - the six class nets share ONE fixed look — the designer's spec says so in as many words
    ("ONE fixed look per item-class net, emitted last ahead of the magenta. No ladder, no icon")
  - a band family (currency, fossils, omens, runegrafts) walks five authored bands; more than
    five tiers means some MUST share, by construction
  - hide blocks carry no style at all (Ruthless cannot Hide; HIDE_CMD is Minimal and we emit no
    style lines), so they are excluded rather than reported as 40 identical labels

Output: a standing HTML report. Stable filename, no timestamp — it is overwritten in place.
"""
import io, json, os, sys, collections, html

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACE = os.path.join(ROOT, "filter_generation", "traces", "ruthless-soft.json")
TD = os.path.join(ROOT, "filter_generation", "data", "tier_definition")
OUT = os.path.join(os.path.expanduser("~"), "Documents", "poe-filter-tier-collisions.html")

LABEL = ("SetFontSize", "SetTextColor", "SetBorderColor", "SetBackgroundColor")
EXTRA = ("PlayEffect", "MinimapIcon", "CustomAlertSound", "PlayAlertSound")

# Families that own no colour of their own — they walk the five authored currency bands, so a
# category with more than five live tiers is REQUIRED to repeat one. Reply 03: "for these the
# generator must not run".
BAND_FAMILIES = {"General", "Fossils", "Omens", "Runegrafts", "Tainted Currency"}

# ── which side of an inline/row divergence is the rev-23 value ────────────────────────────────
# Not a judgement call — these are the two porting tables, copied from the scripts that wrote
# them, so the report can say which side was authored most recently instead of guessing.
#
#   port_designer_patch.py MAP        rev 23 went into the theme ROW for these categories,
#                                     so inline that still differs is the OLDER value.
#   port_patch_inline.py  TABLE       rev 23 went onto the tier INLINE for these tiers,
#                                     because their look cannot be keyed by rung. Inline is
#                                     correct here and the row is what is stale.
ROW_PORTED_CATEGORIES = {
    "General", "Skill Gems", "Corpses", "Oils", "Fossils", "Essences",
    "Delirium Orbs", "Harvest", "Scarabs", "Tainted Currency",
}
INLINE_PORTED_TIERS = {
    ("Maps/Base Maps.json", "Tier 0 Base Maps"), ("Maps/Base Maps.json", "Tier 1 Base Maps"),
    ("Maps/Base Maps.json", "Tier 2 Base Maps"), ("Maps/Base Maps.json", "Tier 3 Base Maps"),
    ("Maps/Base Maps.json", "Tier 4 Base Maps"),
    ("Curse of the Allflame/Bottles.json", "Bottles"),
    ("Curse of the Allflame/Ducats.json", "Ducats T0"),
    ("Curse of the Allflame/Ducats.json", "Ducats T1"),
    ("Curse of the Allflame/Sulphur.json", "Sulphur T0"),
    ("Curse of the Allflame/Voyage Charts.json", "Voyage Charts"),
    ("Equipment/VendorRecipes/Recipes.json", "6-Link"),
    ("Equipment/VendorRecipes/Recipes.json", "6-Socket"),
    ("Equipment/VendorRecipes/Recipes.json", "RGB Linked"),
    # rev-23 "Jewels (normal & abyss)" — a RARITY grammar, three looks for one rung, so it
    # cannot be a rung row either. Split into three tiers each; the plate IS the rarity.
    ("Jewels/Base Jewels.json", "Base Jewels Rare"),
    ("Jewels/Base Jewels.json", "Base Jewels Magic"),
    ("Jewels/Base Jewels.json", "Base Jewels Normal"),
    ("Jewels/Abyss Jewels.json", "Tier 2 Abyss Jewels Rare"),
    ("Jewels/Abyss Jewels.json", "Tier 2 Abyss Jewels Magic"),
    ("Jewels/Abyss Jewels.json", "Tier 2 Abyss Jewels Normal"),
}
STYLE_KEYS = ("TextColor", "BackgroundColor", "BorderColor", "FontSize", "MinimapIcon", "PlayEffect")


def shadowed_rows(theme):
    """Inline channels that overwrite a DIFFERENT theme-row value, with a provenance verdict.

    `disabled:` / null values are a deliberate silence (styleOff turns them into an omitted
    line), not a stale colour — flagged separately so they are never mistaken for drift.
    """
    out = []
    for dp, _, fn in os.walk(TD):
        for f in sorted(fn):
            if not f.endswith(".json"):
                continue
            rel = os.path.relpath(os.path.join(dp, f), TD).replace(os.sep, "/")
            try:
                doc = json.load(io.open(os.path.join(dp, f), encoding="utf-8"))
            except Exception:
                continue
            for cat, body in doc.items():
                if not isinstance(body, dict):
                    continue
                meta = body.get("_meta") or {}
                tcat = meta.get("theme_category") or cat
                rows = theme.get(tcat) or theme.get("Default") or {}
                for tkey, tier in body.items():
                    if tkey == "_meta" or not isinstance(tier, dict) or tier.get("is_hide_tier"):
                        continue
                    inline = tier.get("theme") or {}
                    row = rows.get("Tier %s" % inline.get("Tier")) or {}
                    for k in STYLE_KEYS:
                        if k not in inline or k not in row or row[k] == inline[k]:
                            continue
                        v = inline[k]
                        if v is None or (isinstance(v, str) and v.startswith("disabled:")):
                            verdict, why = "deliberate", "inline silences this channel on purpose"
                        elif (rel, tkey) in INLINE_PORTED_TIERS:
                            verdict, why = "inline is rev 23", "ported to inline — cannot be a rung row"
                        elif tcat in ROW_PORTED_CATEGORIES:
                            verdict, why = "row is rev 23", "rev-23 row is being shadowed by an older inline value"
                        else:
                            verdict, why = "unknown", "neither side was touched by the rev-23 port"
                        out.append({"file": rel, "tier": tkey, "tcat": tcat, "key": k,
                                    "row": row[k], "inline": v, "verdict": verdict, "why": why,
                                    "ch": (tier.get("localization") or {}).get("ch") or tkey})
    return out


def styles_of(text, keys):
    d = {}
    for line in text.split("\n"):
        s = line.strip()
        for k in keys:
            if s.startswith(k + " "):
                d[k] = s[len(k) + 1:]
    return d


def load_tiers():
    """(rel_path, tier_key) -> {rung, ch, en, theme_category}."""
    out = {}
    for dp, _, fn in os.walk(TD):
        for f in sorted(fn):
            if not f.endswith(".json"):
                continue
            path = os.path.join(dp, f)
            rel = os.path.relpath(path, TD).replace(os.sep, "/")
            try:
                doc = json.load(io.open(path, encoding="utf-8"))
            except Exception:
                continue
            for cat, body in doc.items():
                if not isinstance(body, dict):
                    continue
                meta = body.get("_meta") or {}
                tcat = meta.get("theme_category") or cat
                for tkey, tier in body.items():
                    if tkey == "_meta" or not isinstance(tier, dict):
                        continue
                    loc = tier.get("localization") or {}
                    out[(rel, tkey)] = {
                        "rung": (tier.get("theme") or {}).get("Tier"),
                        "ch": loc.get("ch") or tkey,
                        "en": loc.get("en") or tkey,
                        "tcat": tcat,
                    }
    return out


def rgba(v, dflt="0 0 0 255"):
    p = (v or dflt).split()
    while len(p) < 4:
        p.append("255")
    r, g, b, a = p[:4]
    return "rgba(%s,%s,%s,%s)" % (r, g, b, round(int(a) / 255.0, 3))


def main():
    if not os.path.exists(TRACE):
        print("no trace at %s — run generate.mjs --trace first" % TRACE)
        return 2
    tr = json.load(io.open(TRACE, encoding="utf-8"))
    tiers = load_tiers()

    # One row per (file, tier_key): a tier can emit several blocks (rules, item cards) and they
    # share the tier's look unless a rule deviates. Keep the FIRST block's label as the tier's.
    seen, rows = set(), []
    for b in sorted(tr["blocks"], key=lambda x: x["order"]):
        if b["is_hide"]:
            continue
        key = (b["file"], b["tier_key"])
        if key in seen:
            continue
        seen.add(key)
        info = tiers.get(key) or {"rung": None, "ch": b["tier_key"], "en": b["tier_key"],
                                  "tcat": b["file"].rsplit("/", 1)[0]}
        lab = styles_of(b["text"], LABEL)
        rows.append({
            "file": b["file"], "tier": b["tier_key"], "order": b["order"],
            "label": tuple(lab.get(k, "") for k in LABEL),
            "extra": styles_of(b["text"], EXTRA),
            "bases": len(b["bases"]),
            **info,
        })

    groups = collections.defaultdict(list)
    for r in rows:
        groups[(r["tcat"], r["label"])].append(r)

    same_rung, mixed_rung = [], []
    for (tcat, label), members in groups.items():
        if len(members) < 2:
            continue
        rungs = {m["rung"] for m in members}
        rec = {"tcat": tcat, "label": label, "members": sorted(members, key=lambda m: m["order"]),
               "rungs": sorted(r for r in rungs if r is not None),
               "by_design": tcat in BAND_FAMILIES or tcat.lower().startswith("net")}
        (same_rung if len(rungs) == 1 else mixed_rung).append(rec)

    same_rung.sort(key=lambda g: (-len(g["members"]), g["tcat"]))
    mixed_rung.sort(key=lambda g: (-len(g["members"]), g["tcat"]))

    theme = json.load(io.open(os.path.join(
        ROOT, "filter_generation", "data", "theme", "sharket", "sharket_theme.json"), encoding="utf-8"))
    shadow = shadowed_rows(theme)

    n_same = sum(len(g["members"]) for g in same_rung)
    n_mixed = sum(len(g["members"]) for g in mixed_rung)
    by_verdict = collections.Counter(s["verdict"] for s in shadow)
    print("tier blocks compared       : %d" % len(rows))
    print("inline shadowing a row     : %d channels" % len(shadow))
    for v, n in by_verdict.most_common():
        print("     %-16s %3d" % (v, n))
    print("SAME rung, same label      : %d tiers in %d groups  (tiering decision)" % (n_same, len(same_rung)))
    print("DIFFERENT rungs, same label: %d tiers in %d groups  (theme defect)" % (n_mixed, len(mixed_rung)))
    for g in mixed_rung:
        print("   %-24s rungs %-12s %s" % (g["tcat"][:24], g["rungs"],
                                           " == ".join(m["tier"] for m in g["members"])[:70]))

    write_html(rows, same_rung, mixed_rung, shadow)
    print("\n[OK] %s" % OUT)
    return 0


def swatch(label, text):
    fs, tc, bc, bg = label
    size = max(11, min(22, int(fs or 32) * 0.42))
    style = ("font-size:%.0fpx;background:%s;color:%s;border:2px solid %s;"
             % (size, rgba(bg, "0 0 0 0"), rgba(tc, "200 200 200 255"), rgba(bc, "0 0 0 0")))
    return '<span class="sw" style="%s">%s</span>' % (style, html.escape(text))


def chip(v):
    """A colour value as a swatch + its literal text; non-colours render as plain code."""
    s = str(v)
    if s.startswith("#") and len(s) in (7, 9):
        r, g, b = (int(s[i:i + 2], 16) for i in (1, 3, 5))
        a = int(s[7:9], 16) / 255.0 if len(s) == 9 else 1.0
        return ('<span class="chip"><i style="background:rgba(%d,%d,%d,%.2f)"></i>'
                '<code>%s</code></span>' % (r, g, b, a, html.escape(s)))
    return '<code>%s</code>' % html.escape(s)


VERDICT_CLASS = {"row is rev 23": "bad", "inline is rev 23": "ok",
                 "deliberate": "ok", "unknown": "warn"}


def write_html(rows, same_rung, mixed_rung, shadow):
    def shadow_html():
        by_cat = collections.defaultdict(list)
        for s in shadow:
            by_cat[(s["tcat"], s["verdict"])].append(s)
        order = {"row is rev 23": 0, "unknown": 1, "inline is rev 23": 2, "deliberate": 3}
        out = []
        for (tcat, verdict), items in sorted(by_cat.items(), key=lambda kv: (order[kv[0][1]], -len(kv[1]))):
            body = "".join(
                '<tr><td>%s</td><td class="mono">%s</td><td class="mono dim">%s</td>'
                '<td>%s</td><td>%s</td></tr>'
                % (html.escape(s["ch"]), html.escape(s["tier"]), html.escape(s["key"]),
                   chip(s["row"]), chip(s["inline"]))
                for s in sorted(items, key=lambda x: (x["tier"], x["key"])))
            out.append(
                '<section class="grp %s"><div class="ghead"><span class="cat">%s</span>'
                '<span class="tag %s">%s</span><span class="rung">%s</span></div>'
                '<table><thead><tr><th>tier</th><th>key</th><th>channel</th>'
                '<th>theme row says</th><th>inline says (this is what ships)</th></tr></thead>'
                '<tbody>%s</tbody></table></section>'
                % (VERDICT_CLASS[verdict], html.escape(tcat), VERDICT_CLASS[verdict],
                   html.escape(verdict), html.escape(items[0]["why"]), body))
        return "".join(out)

    def group_html(g, kind):
        m = g["members"]
        head = ('<div class="ghead"><span class="cat">%s</span>'
                '<span class="rung">rung %s</span>%s</div>'
                % (html.escape(g["tcat"]),
                   "/".join(str(r) for r in g["rungs"]) or "—",
                   '<span class="tag design">by design</span>' if g["by_design"] else ""))
        items = []
        for r in m:
            beam = r["extra"].get("PlayEffect", "")
            icon = r["extra"].get("MinimapIcon", "")
            snd = "yes" if ("CustomAlertSound" in r["extra"] or "PlayAlertSound" in r["extra"]) else "—"
            items.append(
                '<tr><td>%s</td><td class="mono">%s</td><td class="mono dim">%s</td>'
                '<td class="num">%d</td><td class="mono dim">%s</td><td class="mono dim">%s</td>'
                '<td class="dim">%s</td></tr>'
                % (swatch(g["label"], r["ch"]), html.escape(r["tier"]),
                   html.escape(r["file"]), r["bases"], html.escape(beam or "—"),
                   html.escape(icon or "—"), snd))
        return ('<section class="grp %s">%s<table><thead><tr><th>as it reads</th><th>tier key</th>'
                '<th>file</th><th>bases</th><th>beam</th><th>icon</th><th>sound</th></tr></thead>'
                '<tbody>%s</tbody></table></section>' % (kind, head, "".join(items)))

    n_same = sum(len(g["members"]) for g in same_rung)
    n_mixed = sum(len(g["members"]) for g in mixed_rung)
    doc = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tier label collisions — Sharket 3.29 Ruthless</title>
<style>
:root{--bg:#14120f;--panel:#1c1a16;--line:#2e2a24;--ink:#e8e2d6;--dim:#948c7c;
      --warn:#e0623c;--ok:#7d9b6a;--accent:#d9a441}
*{box-sizing:border-box}
body{margin:0;padding:2.5rem 1.5rem 5rem;background:var(--bg);color:var(--ink);
     font:15px/1.55 "Segoe UI",system-ui,sans-serif}
main{max-width:1180px;margin:0 auto}
h1{font-size:1.6rem;margin:0 0 .35rem;letter-spacing:-.01em}
.sub{color:var(--dim);margin:0 0 2rem;max-width:70ch}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1rem;margin-bottom:2.5rem}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:1rem 1.15rem}
.card .n{font-size:2rem;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}
.card .t{color:var(--dim);font-size:.85rem;margin-top:.3rem}
.card.warn .n{color:var(--warn)} .card.ok .n{color:var(--ok)}
h2{font-size:1.05rem;margin:2.5rem 0 .4rem;padding-bottom:.5rem;border-bottom:1px solid var(--line)}
h2 .lede{display:block;font-weight:400;font-size:.85rem;color:var(--dim);margin-top:.4rem;
         border:0;padding:0;max-width:78ch}
.grp{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--line);
     border-radius:6px;margin:.9rem 0;padding:.85rem 1rem}
.grp.mixed,.grp.bad{border-left-color:var(--warn)}
.grp.same,.grp.warn{border-left-color:var(--accent)}
.grp.ok{border-left-color:var(--ok)}
.ghead{display:flex;align-items:center;gap:.7rem;margin-bottom:.6rem;flex-wrap:wrap}
.cat{font-weight:600}
.rung{color:var(--dim);font-size:.82rem;font-variant-numeric:tabular-nums}
.tag{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;padding:.15rem .45rem;
     border-radius:3px;background:#2b3326;color:var(--ok)}
.tag.bad{background:#3a221c;color:var(--warn)}
.tag.warn{background:#3a3222;color:var(--accent)}
.chip{display:inline-flex;align-items:center;gap:.35rem}
.chip i{width:13px;height:13px;border-radius:2px;border:1px solid rgba(255,255,255,.22);
        flex:0 0 auto}
code{font-family:Consolas,"Cascadia Mono",monospace;font-size:.78rem;color:var(--dim)}
table{overflow-x:auto}
.wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;font-weight:500;color:var(--dim);font-size:.72rem;text-transform:uppercase;
   letter-spacing:.05em;padding:.25rem .5rem;border-bottom:1px solid var(--line)}
td{padding:.32rem .5rem;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
tr:last-child td{border-bottom:0}
.mono{font-family:Consolas,"Cascadia Mono",monospace;font-size:.8rem}
.dim{color:var(--dim)} .num{font-variant-numeric:tabular-nums;text-align:right}
.sw{display:inline-block;padding:.18rem .6rem;border-radius:2px;white-space:nowrap;
    font-family:"Microsoft YaHei",sans-serif}
</style></head><body><main>
<h1>Where the look doesn't match the intent</h1>
<p class="sub">Three different faults produce one symptom — an item wearing a theme that wasn't
meant for it. They need three different fixes, so they're separated here. Built from the
ruthless / soft trace against the current data tree.</p>
<div class="cards">
  <div class="card warn"><div class="n">__SHADOW__</div><div class="t">inline channels overwriting a different theme row</div></div>
  <div class="card warn"><div class="n">__MIXED__</div><div class="t">different rungs, same label — a <b>theme</b> defect</div></div>
  <div class="card ok"><div class="n">__SAME__</div><div class="t">same rung, same label — a <b>tiering</b> question</div></div>
  <div class="card"><div class="n">__ROWS__</div><div class="t">tier blocks compared</div></div>
</div>

<h2>The theme row never reaches the game
<span class="lede">Since the tier block started owning its look, inline style overwrites the
theme row. So a tier holding inline colours is immune to a row edit — port a new palette into
the rows and these tiers keep rendering the old one, with nothing to show for it. The right-hand
column is what actually ships. <b>Inline is not automatically stale</b>: Maps is authored inline
because its plate follows map tier rather than rung, and Gold silences channels inline on
purpose. So each group is labelled with which side rev 23 actually wrote.</span></h2>
__SHADOWHTML__

<h2>Different rungs, same label
<span class="lede">The ladder asked for a step between these tiers and did not get one. Whatever
the rungs say, the eye sees one item. This half is ours to fix in the palette.</span></h2>
__MIXEDHTML__

<h2>Same rung, same label
<span class="lede">The theme did exactly what it was told — these tiers all declare the same rung,
so of course they share a look. Nothing is broken in the palette. The question is whether they
should be separate tiers at all, which is an authoring call. Groups marked <b>by design</b> are
expected: the class nets share one fixed look by the designer's spec, and a band family walks
five authored bands, so a sixth tier must repeat one.</span></h2>
__SAMEHTML__
</main></body></html>"""
    doc = (doc.replace("__ROWS__", str(len(rows)))
              .replace("__SAME__", str(n_same))
              .replace("__MIXED__", str(n_mixed))
              .replace("__SHADOW__", str(len(shadow)))
              .replace("__SHADOWHTML__", shadow_html() or
                       '<p class="dim">None — every tier agrees with its theme row.</p>')
              .replace("__MIXEDHTML__", "".join(group_html(g, "mixed") for g in mixed_rung) or
                       '<p class="dim">None — every collision is between tiers that asked for the same rung.</p>')
              .replace("__SAMEHTML__", "".join(group_html(g, "same") for g in same_rung)))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8").write(doc)


if __name__ == "__main__":
    sys.exit(main())
