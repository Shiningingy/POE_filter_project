# -*- coding: utf-8 -*-
"""Propose a per-category ladder that CANNOT be dim, and report it for review.

    python parsing_tool/theme/propose_ladder.py          # print the summary
    python parsing_tool/theme/propose_ladder.py --html    # + write the review report

★ WRITES NOTHING INTO THE FILTER. This is a proposal for the author to argue with; the
applying script is separate and comes after the discussion.

--------------------------------------------------------------------------------
WHY THE SHIPPED LADDER CANNOT BE RESCUED BY TUNING

    rung_recipes.T4 = { text: accent.muted, bg: 80 80 80 }

Measured over the emitted filter: our text luminance median is 0.213 and our plate
luminance median is 0.159 -- the two sit 0.05 apart, both in the murky middle. FilterBlade
runs 0.660 against 0.051, a gap of 0.61, and only 2 of their 529 styled blocks put both
values in the middle band. Raising such a pair to 4.5:1 does not make it readable; it makes
it a marginally less grey grey. The author's words: "raising the contrast is not a fix".

THE RULE, TAKEN FROM THEIR NUMBERS RATHER THAN THEIR PALETTE:

    ONE OF TEXT AND PLATE MUST BE EXTREME. Never both in the middle.

--------------------------------------------------------------------------------
THE PROPOSAL

Reply 04 already reached this and was then walked back. It measured NeverSink across deep
categories and found ~50 consecutive blocks sharing one plate:

    "One plate per category, held constant across the whole ladder. The plate is a
     CATEGORY signal, never a tier signal."

So T3/T4/T5 share `accent.deep`, a near-black tinted with the family hue, and the rung is
carried by the TEXT. Where this proposal departs from reply 04 is what that text does:
reply 04 ran `accent.solid -> accent.muted -> muted darkened .15`, i.e. it still dimmed, just
against a better plate. Here the ladder never dims -- it DESATURATES:

    T3   bright accent    coloured  -> "a good one of these"
    T4   255 255 255      neutral   -> "one of these"
    T5   180 180 180      quiet     -> "bulk"     (FilterBlade's own low-tier grey)

Every rung clears 7:1 against a near-black plate BY CONSTRUCTION, for all 26 accents, so
there is no per-accent tuning left to get wrong. Quieter means less coloured, never less
visible.

⚠️ `accent.muted` IS RETIRED. It was authored per-accent in reply 12 precisely because the
formula never reproduced either golden; it is the single value the whole complaint traces
back to, and nothing in this ladder needs it.

--------------------------------------------------------------------------------
THE BORDER

The author's observation, and the kit already proves it -- `state_budget` lists
`currency/shards/fragments/scarabs/div_cards: []`. Those families can never be corrupted,
linked, influenced, fractured or enchanted, so the border channel reserved for state
deviations is, for them, permanently idle. It carries `accent.solid` instead, which hands
back the family identity that a white T4 gives up, at no risk to the state system.

Families that CAN take a state (gems, flasks, maps, heist, jewels, uniques, equipment) keep
the border empty, exactly as reply 11's constraint requires.
"""
import io, json, os, sys, colorsys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
KIT = os.path.join(ROOT, "docs", "design", "handoff", "theme-presets.json")
MAP = os.path.join(ROOT, "docs", "design", "handoff", "accent-category-map.json")
THEME = os.path.join(ROOT, "filter_generation", "data", "theme", "sharket",
                     "sharket_theme.json")
REPORT = os.path.join(os.path.expanduser("~"), "Documents",
                      "poe-filter-theme-proposal.html")

TARGET = 7.0          # not 4.5: the point is to leave the marginal band entirely
T5_BASE = (180, 180, 180)     # FilterBlade's own bulk grey, used where it already clears

# ⚠️ ONLY THE `equipment` ACCENT IS rarity_through, and its 13 categories are NOT part of
# this proposal's text ladder. They omit `TextColor` ON PURPOSE so the game paints the
# rarity colour; writing white into them would paint over the single most informative
# signal a gear drop has. Their rung is carried by plate alpha on the same deep plate,
# exactly as reply 04 specified, and their half of the complaint was SIZE, which is already
# fixed. Reported separately so the distinction cannot be lost.
RARITY_THROUGH = {"equipment"}

# Families that can carry a state border, from the kit's measured `state_budget`.
# Everything not listed here has an idle border and may spend it on the accent.
STATEFUL = {"gems", "flasks", "maps", "heist", "jewels", "uniques", "equipment"}


def lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def rgb(s):
    return tuple(int(x) for x in s.split())[:3]


def hexs(c):
    return "#" + "".join("%02x" % max(0, min(255, int(round(v)))) for v in c)


def brighten(c, plate, target=TARGET):
    """Raise the accent's lightness until it clears `target` on its own deep plate, hue and
    saturation pinned. This is what keeps 26 families distinguishable while removing any
    possibility of a dim rung -- the hue is preserved exactly, only the lightness moves."""
    r, g, b = [v / 255.0 for v in c]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    best, steps = None, 260
    for i in range(steps + 1):
        nl = l + (1.0 - l) * (i / steps)
        nr, ng, nb = colorsys.hls_to_rgb(h, min(1.0, nl), s)
        cand = tuple(int(round(v * 255)) for v in (nr, ng, nb))
        if contrast(cand, plate) >= target:
            best = cand
            break
    return best or (255, 255, 255)


def neutral_for(plate, target=TARGET):
    """T5's grey, derived rather than fixed. `180 180 180` is FilterBlade's own bulk grey and
    clears 7:1 on most deep plates, but a few accents (blight_oils, delirium) have a lighter
    `deep` and it only reached 5.3:1 there. A fixed constant would have quietly reintroduced
    exactly the marginal band this proposal exists to leave, so the grey moves instead."""
    if contrast(T5_BASE, plate) >= target:
        return T5_BASE
    for v in range(181, 256):
        if contrast((v, v, v), plate) >= target:
            return (v, v, v)
    for v in range(179, -1, -1):          # very light plate: go dark instead
        if contrast((v, v, v), plate) >= target:
            return (v, v, v)
    return (0, 0, 0)


def build():
    P = json.load(io.open(KIT, encoding="utf-8"))
    M = json.load(io.open(MAP, encoding="utf-8"))
    cur = json.load(io.open(THEME, encoding="utf-8"))
    by_cat = {k: v for k, v in M["accent_by_category"].items() if not k.startswith("_")}

    rows = []
    for cat in sorted(by_cat):
        aname = by_cat[cat]
        a = (P.get("accents") or {}).get(aname)
        if not isinstance(a, dict) or "solid" not in a:
            continue
        solid, deep = rgb(a["solid"]), rgb(a.get("deep", "0 0 0"))
        t3 = brighten(solid, deep)
        free = aname not in STATEFUL
        now = cur.get(cat) or {}

        def before(rung):
            r = now.get(rung) or {}
            t, b = r.get("TextColor"), r.get("BackgroundColor")
            if not (isinstance(t, str) and isinstance(b, str)):
                return None
            try:
                tt = tuple(int(t[1:][i:i + 2], 16) for i in (0, 2, 4))
                bb = tuple(int(b[1:][i:i + 2], 16) for i in (0, 2, 4))
            except Exception:
                return None
            return (t, b, contrast(tt, bb))

        t5 = neutral_for(deep)
        rows.append({
            "cat": cat, "accent": aname, "solid": solid, "deep": deep,
            "t3": t3, "t5": t5, "free": free,
            "rarity": aname in RARITY_THROUGH,
            "c3": contrast(t3, deep),
            "c4": contrast((255, 255, 255), deep),
            "c5": contrast(t5, deep),
            "c2": contrast((0, 0, 0), solid),
            "was3": before("Tier 3"), "was4": before("Tier 4"), "was5": before("Tier 5"),
        })
    return rows


def main():
    rows = build()
    painted = [r for r in rows if not r["rarity"]]
    worst = min(painted, key=lambda r: min(r["c3"], r["c4"], r["c5"]))
    print("=== proposed ladder :: %d categories, %d accents ==="
          % (len(rows), len({r["accent"] for r in rows})))
    print()
    print("  painted categories (text ladder applies) : %d" % len(painted))
    print("  rarity-through / equipment (text stays ABSENT, plate only) : %d"
          % (len(rows) - len(painted)))
    print("  every painted rung clears %.1f:1 by construction" % TARGET)
    print("  worst painted rung : %.2f:1  (%s / %s)"
          % (min(worst["c3"], worst["c4"], worst["c5"]), worst["cat"], worst["accent"]))
    print("  border freed to the accent : %d of %d categories"
          % (sum(1 for r in rows if r["free"]), len(rows)))
    print()
    print("%-24s %-12s %-9s %-9s %-9s %s"
          % ("category", "accent", "T3", "T4", "T5", "border"))
    print("-" * 80)
    for r in sorted(rows, key=lambda r: (r["rarity"], r["accent"], r["cat"])):
        was = r["was4"][2] if r["was4"] else None
        if r["rarity"]:
            print("%-24s %-12s   rarity-through: no text, plate only          %s"
                  % (r["cat"][:24], r["accent"][:12], "-- (states)"))
            continue
        print("%-24s %-12s %6.1f:1  %6.1f:1  %6.1f:1  %s%s"
              % (r["cat"][:24], r["accent"][:12], r["c3"], r["c4"], r["c5"],
                 "accent" if r["free"] else "-- (states)",
                 "   was T4 %.2f:1" % was if was else ""))

    if "--html" in sys.argv:
        write_html(rows)
        print()
        print("report -> %s" % REPORT)
    return 0


def swatch(fg, bg, label, ratio, bd=None):
    b = ("border:3px solid %s;" % hexs(bd)) if bd else "border:3px solid transparent;"
    return ("<div class='sw' style='background:%s;%s'>"
            "<span style='color:%s'>%s</span>"
            "<em>%.1f:1</em></div>" % (hexs(bg), b, hexs(fg), label, ratio))


def write_html(rows):
    css = """
:root{--bg:#f6f4f0;--fg:#191714;--mut:#6d6862;--line:#ddd8d0;--card:#fffdfa;--acc:#8a4b1f}
:root:not([data-theme=light]){}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#14120f;--fg:#eee9e2;--mut:#9b948a;--line:#2e2a25;--card:#1c1916;--acc:#e0904a}}
:root[data-theme=dark]{--bg:#14120f;--fg:#eee9e2;--mut:#9b948a;--line:#2e2a25;--card:#1c1916;--acc:#e0904a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
 font:16px/1.6 "Iowan Old Style",Palatino,Georgia,serif;padding:0 0 6rem}
.wrap{max-width:1180px;margin:0 auto;padding:0 1.5rem}
header{border-bottom:3px solid var(--fg);margin-bottom:2.5rem;padding:3.5rem 0 1.5rem}
h1{font-size:2.6rem;margin:0 0 .4rem;letter-spacing:-.02em;text-wrap:balance}
.sub{color:var(--mut);font-size:1.05rem;margin:0}
h2{font-size:1.5rem;margin:3rem 0 .3rem;padding-top:1.6rem;border-top:1px solid var(--line)}
h2 .n{color:var(--acc);font-family:ui-monospace,monospace;font-size:1rem;margin-right:.6rem}
p{max-width:68ch}
.lede{font-size:1.1rem}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.87em;
 background:var(--card);border:1px solid var(--line);border-radius:3px;padding:.08em .35em}
table{width:100%;border-collapse:collapse;margin:1.2rem 0;font-size:.9rem;
 font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
th{text-align:left;border-bottom:2px solid var(--fg);padding:.5rem .6rem;font-size:.78rem;
 letter-spacing:.09em;text-transform:uppercase}
td{border-bottom:1px solid var(--line);padding:.45rem .6rem}
.scroll{overflow-x:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(325px,1fr));gap:1rem;margin:1.4rem 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:.9rem 1rem 1rem}
.card h3{margin:0 0 .1rem;font-size:1.05rem}
.card .meta{color:var(--mut);font-size:.76rem;font-family:ui-monospace,monospace;
 margin:0 0 .7rem;letter-spacing:.03em}
.sw{border-radius:5px;padding:.5rem .7rem;margin-bottom:.35rem;display:flex;
 align-items:center;justify-content:space-between;font-size:1.02rem;
 font-family:"Segoe UI",system-ui,sans-serif}
.sw em{font-style:normal;font-size:.72rem;opacity:.62;font-family:ui-monospace,monospace;
 color:#fff;mix-blend-mode:difference}
.flag{display:inline-block;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;
 padding:.12em .5em;border-radius:99px;border:1px solid var(--line);color:var(--mut)}
.free{border-color:var(--acc);color:var(--acc)}
.big{font-size:2.1rem;font-family:ui-monospace,monospace;color:var(--acc);
 font-variant-numeric:tabular-nums}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:1rem;margin:1.5rem 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:.9rem 1rem}
.stat p{margin:.15rem 0 0;font-size:.8rem;color:var(--mut);max-width:none}
blockquote{margin:1.2rem 0;padding:.2rem 0 .2rem 1.2rem;border-left:3px solid var(--acc);
 color:var(--mut);font-style:italic}
"""
    free_n = sum(1 for r in rows if r["free"])
    painted = [r for r in rows if not r["rarity"]]
    allc = [c for r in painted for c in (r["c3"], r["c4"], r["c5"])]

    cards = []
    for r in sorted(rows, key=lambda r: (r["rarity"], r["accent"], r["cat"])):
        bd = r["solid"] if r["free"] else None
        if r["rarity"]:
            cards.append(
                "<div class='card'><h3>%s</h3>"
                "<p class='meta'>%s &nbsp;·&nbsp; deep %s<br>"
                "<span class='flag'>rarity-through — text stays absent</span></p>"
                "<div class='sw' style='background:%s;border:3px solid transparent'>"
                "<span style='color:#e5c76b'>T2 · the game paints rarity</span>"
                "<em>a 245</em></div>"
                "<div class='sw' style='background:%s;border:3px solid transparent'>"
                "<span style='color:#8a8ae0'>T3 · same plate, lower alpha</span>"
                "<em>a 240</em></div>"
                "<div class='sw' style='background:%s;border:3px solid transparent'>"
                "<span style='color:#c8c8c8'>T4 · same plate, lower alpha</span>"
                "<em>a 225</em></div></div>"
                % (r["cat"], r["accent"], hexs(r["deep"]),
                   hexs(r["deep"]), hexs(r["deep"]), hexs(r["deep"])))
            continue
        cards.append(
            "<div class='card'><h3>%s</h3>"
            "<p class='meta'>%s &nbsp;·&nbsp; solid %s &nbsp;·&nbsp; deep %s<br>"
            "<span class='flag %s'>%s</span></p>%s%s%s%s</div>"
            % (r["cat"], r["accent"], hexs(r["solid"]), hexs(r["deep"]),
               "free" if r["free"] else "",
               "border → accent" if r["free"] else "border reserved for states",
               swatch((0, 0, 0), r["solid"], "T2 · worth picking up", r["c2"], bd),
               swatch(r["t3"], r["deep"], "T3 · a good one", r["c3"], bd),
               swatch((255, 255, 255), r["deep"], "T4 · one of these", r["c4"], bd),
               swatch(r["t5"], r["deep"], "T5 · bulk", r["c5"], bd)))

    trows = "".join(
        "<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%.1f:1</td>"
        "<td>%.1f:1</td><td>%.1f:1</td></tr>"
        % (r["cat"], r["accent"], r["was4"][1] if r["was4"] else "—",
           ("%.2f:1" % r["was4"][2]) if r["was4"] else "—", r["c3"], r["c4"], r["c5"])
        for r in sorted([x for x in rows if not x["rarity"]],
                        key=lambda r: (r["was4"][2] if r["was4"] else 99)))

    html = """<title>Theme ladder — proposal for review</title>
<style>%s</style>
<div class='wrap'>
<header>
<h1>A ladder that cannot be dim</h1>
<p class='sub'>Proposal for review · nothing applied · %d categories, %d accents</p>
</header>

<p class='lede'>The complaint was <em>&ldquo;dim background plus dim text&rdquo;</em>, and it is
right: our text and plate luminances sit <strong>0.05 apart</strong>, both in the murky
middle. Raising such a pair to 4.5:1 does not make it readable, it makes it a less grey grey.
This proposal changes the structure instead.</p>

<div class='stats'>
<div class='stat'><div class='big'>0.05</div><p>our text-vs-plate luminance gap today</p></div>
<div class='stat'><div class='big'>0.61</div><p>FilterBlade's gap, measured over 529 blocks</p></div>
<div class='stat'><div class='big'>%.1f:1</div><p>worst rung under this proposal</p></div>
<div class='stat'><div class='big'>%d/%d</div><p>categories whose border is provably idle</p></div>
</div>

<h2><span class='n'>01</span>The rule, taken from their numbers</h2>
<p>FilterBlade puts <strong>2 of 529</strong> styled blocks in the middle band. Everything else
is bright-on-near-black or black-on-bright. That is not a palette, it is a constraint:</p>
<blockquote>One of text and plate must be extreme. Never both in the middle.</blockquote>
<p>Their commonest single look is <code>0 240 190</code> on <code>20 20 0</code> at 12.6:1,
used in 62 blocks. Ours was <code>accent.muted</code> on <code>80 80 80</code> — two mid-tones,
converging by construction, median 3.02:1 across the 26 accents with <strong>12 under
3.0:1</strong>.</p>

<h2><span class='n'>02</span>One plate per category — which the designer already found</h2>
<p>Reply 04 measured NeverSink on deep categories and reached exactly this, then it was walked
back three replies later:</p>
<blockquote>One plate per category, held constant across the whole ladder … the plate is a
CATEGORY signal, never a tier signal.</blockquote>
<p>So <code>T3/T4/T5</code> share <code>accent.deep</code> — a near-black tinted with the family
hue — and the rung is carried by the text. Where this departs from reply 04: that version still
ran <code>accent.solid → accent.muted → muted darkened .15</code>, so it kept dimming, just
against a better plate. <strong><code>accent.muted</code> is retired here.</strong> It is the one
value the whole complaint traces back to.</p>

<h2><span class='n'>03</span>Rank by colour, not by dimness</h2>
<p>On one dark plate, the ladder desaturates rather than darkens — so a quieter rung is
<em>less coloured</em>, never <em>less visible</em>:</p>
<table><tr><th>rung</th><th>text</th><th>reads as</th></tr>
<tr><td>T3</td><td>accent, brightened to clear 7:1</td><td>a good one of these</td></tr>
<tr><td>T4</td><td><code>255 255 255</code></td><td>one of these</td></tr>
<tr><td>T5</td><td><code>180 180 180</code></td><td>bulk — FilterBlade's own low-tier grey</td></tr></table>
<p>Every rung clears 7:1 against a near-black plate for all 26 accents <em>by construction</em>,
so there is no per-accent tuning left to get wrong.</p>

<h2><span class='n'>04</span>The idle border carries the family</h2>
<p>Your observation, and the kit already proves it — <code>state_budget</code> records
<code>currency/shards/fragments/scarabs/div_cards: []</code>. Those families can never be
corrupted, linked, influenced, fractured or enchanted, so the border reserved for state
deviations is permanently idle for them. It takes <code>accent.solid</code> instead, handing
back the identity a white T4 gives up. <strong>%d of %d categories</strong> qualify; the rest
keep the border empty exactly as reply 11 requires.</p>

<h2><span class='n'>05</span>The one exception: gear</h2>
<p>The <code>equipment</code> accent's <strong>13 categories are rarity-through</strong> — they
omit <code>TextColor</code> deliberately so the game paints the rarity colour, which is the most
informative thing a gear drop has. <strong>No white text goes there.</strong> Their rung is
carried by plate alpha on the same deep plate, as reply 04 specified, and their half of your
complaint was <em>size</em> — already fixed by the 40px floor.</p>

<h2><span class='n'>06</span>Every category, as proposed</h2>
<p>Swatches are the real emitted colours. A coloured outline means the border is free and
carries the accent. Gear cards show the rarity colour the game would paint, not a colour we set.</p>
<div class='grid'>%s</div>

<h2><span class='n'>07</span>What each T4 was, and becomes</h2>
<p>Sorted worst-first by what ships today. Gear is excluded — it has no text to compare.</p>
<div class='scroll'><table>
<tr><th>category</th><th>accent</th><th>T4 plate today</th><th>T4 today</th>
<th>T3 proposed</th><th>T4 proposed</th><th>T5 proposed</th></tr>%s</table></div>

<h2><span class='n'>08</span>What this does not touch</h2>
<p>T0 and T1 stay exactly as they are — the house red-on-white and red-plate rungs are the
filter's loudest signal, seen in game and accepted. Identity hues are never moved: an accent's
authored <code>solid</code> is what the family is learned by, and the ruling from the Uniques
work holds generally — <em>lift the plate, never the text</em>. Sizes, icons, beams and sounds
are untouched.</p>
</div>""" % (css, len(rows), len({r["accent"] for r in rows}), min(allc), free_n, len(rows),
             free_n, len(rows), "".join(cards), trows)

    io.open(REPORT, "w", encoding="utf-8").write(html)
    return REPORT


if __name__ == "__main__":
    sys.exit(main())
