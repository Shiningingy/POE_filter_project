#!/usr/bin/env python3
"""Render reconcile.json into a standalone league-maintenance triage console.

One self-contained HTML file, no build step and no network: open it, work
through the queue, export the decisions as JSON. Progress is kept in
localStorage keyed by the patch label, so closing the tab does not lose work.

Called by reconcile.py --html PATH, or directly:

    python parsing_tool/ggpk/render_console.py --label 3.29.0.2.2 \
        --out "C:/Users/<you>/Documents/poe-league-maintenance.html"
"""

from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))


def slim(rep: dict) -> dict:
    """Only what the page draws - the raw dump columns stay on disk."""

    def item(r, with_files=False):
        row = {"n": r["name"], "c": r["class_name"] or "(unclassed)",
               "l": r["drop_level"], "z": r["zh"]}
        if r.get("ids"):
            row["i"], row["k"] = r["ids"][0], len(r["ids"])
        if with_files:
            row["f"] = r.get("files")
        return row

    suppressed = {
        "non_drop": sum(rep["excluded_non_drop_classes"].values()),
        "dead_league": sum(rep["quiet_dead_league"].values()),
        "class_rules": len(rep["class_covered"]),
    }
    return {
        "label": rep["label"],
        "baseline": rep["baseline"],
        "totals": rep["totals"],
        "suppressed": suppressed,
        "new": [item(r) for r in rep["new_items"]],
        "removed": [{"n": r["name"], "f": r["files"]} for r in rep["removed_items"]],
        "backlog": [item(r) for r in rep["backlog"]],
        "legacy": [item(r, True) for r in rep["legacy_only"]],
        "unmatched": [{"n": r["name"], "r": r["reason"], "f": r["files"]}
                      for r in rep["unmatched"]],
        "headers": [m for m in rep["class_mismatch"] if m["kind"] != "umbrella"],
    }


TEMPLATE = r"""<title>League Maintenance &mdash; __LABEL__</title>
<style>
/* ---- tokens ------------------------------------------------------------ */
/* Palette taken from the game's own UI rather than a generic dashboard:
   warm stone ground, aged-gold accent, and decision colours borrowed from
   gem-green / leather-brown so they read as material, not as traffic lights. */
:root {
  --ground:#F3EEE3; --surface:#FBF8F1; --raise:#ECE4D5; --line:#DCD2C0;
  --ink:#2A2018; --dim:#6B5F52; --faint:#9A8D7C;
  --accent:#8A6210; --accent-ink:#FFF9EC; --accent-soft:#EFE0BC;
  --map:#54711F; --legacy:#8A5A38; --skip:#8B8073; --alert:#A33B21;
  --shadow:0 1px 2px rgba(42,32,24,.07), 0 6px 20px -12px rgba(42,32,24,.28);
}
@media (prefers-color-scheme: dark) {
  :root {
    --ground:#16120E; --surface:#1E1913; --raise:#292219; --line:#3B3226;
    --ink:#EFE6D6; --dim:#A2968A; --faint:#6E6154;
    --accent:#D6A63E; --accent-ink:#1B1408; --accent-soft:#3A2E17;
    --map:#9DB554; --legacy:#B98459; --skip:#7C7165; --alert:#D9694C;
    --shadow:0 1px 2px rgba(0,0,0,.5), 0 8px 26px -14px rgba(0,0,0,.8);
  }
}
:root[data-theme="light"] {
  --ground:#F3EEE3; --surface:#FBF8F1; --raise:#ECE4D5; --line:#DCD2C0;
  --ink:#2A2018; --dim:#6B5F52; --faint:#9A8D7C;
  --accent:#8A6210; --accent-ink:#FFF9EC; --accent-soft:#EFE0BC;
  --map:#54711F; --legacy:#8A5A38; --skip:#8B8073; --alert:#A33B21;
  --shadow:0 1px 2px rgba(42,32,24,.07), 0 6px 20px -12px rgba(42,32,24,.28);
}
:root[data-theme="dark"] {
  --ground:#16120E; --surface:#1E1913; --raise:#292219; --line:#3B3226;
  --ink:#EFE6D6; --dim:#A2968A; --faint:#6E6154;
  --accent:#D6A63E; --accent-ink:#1B1408; --accent-soft:#3A2E17;
  --map:#9DB554; --legacy:#B98459; --skip:#7C7165; --alert:#D9694C;
  --shadow:0 1px 2px rgba(0,0,0,.5), 0 8px 26px -14px rgba(0,0,0,.8);
}

--FONTS--

* { box-sizing:border-box; }
body {
  margin:0; background:var(--ground); color:var(--ink);
  font:var(--fs-b)/1.5 var(--sans);
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3 { margin:0; text-wrap:balance; font-family:var(--serif); font-weight:600; }
button { font:inherit; color:inherit; }

/* ---- masthead ---------------------------------------------------------- */
.masthead {
  display:flex; flex-wrap:wrap; align-items:baseline; gap:.5rem 1rem;
  padding:1.6rem clamp(1rem,4vw,2.5rem) 1.1rem;
  border-bottom:1px solid var(--line);
}
.masthead h1 { font-size:clamp(1.35rem,3vw,1.9rem); letter-spacing:-.01em; }
.patch {
  font-family:var(--mono); font-size:var(--fs-s); letter-spacing:.02em;
  padding:.16rem .5rem; border:1px solid var(--line); border-radius:3px;
  background:var(--raise); color:var(--dim); font-variant-numeric:tabular-nums;
}
.lede { flex:1 1 22rem; color:var(--dim); font-size:var(--fs-s); max-width:62ch; margin:0; }
.provenance { flex:1 1 100%; font-family:var(--mono); font-size:var(--fs-xs);
  color:var(--faint); max-width:none; }

/* ---- summary ----------------------------------------------------------- */
.summary {
  display:grid; gap:1px; background:var(--line);
  grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));
  border-bottom:1px solid var(--line);
}
.card {
  background:var(--surface); border:0; border-top:2px solid transparent;
  padding:.9rem clamp(1rem,4vw,2.5rem) 1rem; text-align:left; cursor:pointer;
  display:flex; flex-direction:column; gap:.15rem;
  transition:background .12s ease, border-color .12s ease;
}
.card:hover { background:var(--raise); }
.card[aria-selected="true"] { border-top-color:var(--accent); background:var(--raise); }
.card .num {
  font-family:var(--mono); font-size:1.55rem; font-variant-numeric:tabular-nums;
  line-height:1.1; letter-spacing:-.02em;
}
.card .lbl { font-size:var(--fs-xs); text-transform:uppercase; letter-spacing:.09em; color:var(--dim); }
.card .sub { font-size:var(--fs-xs); color:var(--faint); }
.card:focus-visible, .rail button:focus-visible, .act:focus-visible,
.tool:focus-visible, .chip:focus-visible {
  outline:2px solid var(--accent); outline-offset:2px;
}

/* ---- progress ---------------------------------------------------------- */
.progress { padding:.7rem clamp(1rem,4vw,2.5rem); border-bottom:1px solid var(--line);
  display:flex; align-items:center; gap:.85rem; flex-wrap:wrap; background:var(--surface); }
.bar { flex:1 1 12rem; height:5px; background:var(--raise); border-radius:99px; overflow:hidden;
  border:1px solid var(--line); }
.bar span { display:block; height:100%; width:0; background:var(--accent); transition:width .25s ease; }
.progress .txt { font-family:var(--mono); font-size:var(--fs-s); color:var(--dim);
  font-variant-numeric:tabular-nums; }

/* ---- layout ------------------------------------------------------------ */
main { display:grid; grid-template-columns:15rem minmax(0,1fr); gap:0; align-items:start; }
@media (max-width:820px) { main { grid-template-columns:1fr; } .rail { position:static !important; } }

.rail {
  position:sticky; top:0; align-self:start; max-height:100vh; overflow-y:auto;
  border-right:1px solid var(--line); padding:1.1rem 0 2rem;
}
.rail h2 { font-size:var(--fs-xs); text-transform:uppercase; letter-spacing:.09em;
  color:var(--faint); font-family:var(--sans); font-weight:600;
  padding:0 clamp(.75rem,2vw,1.25rem) .5rem; }
.rail button {
  display:flex; width:100%; gap:.5rem; align-items:baseline; text-align:left;
  background:none; border:0; border-left:2px solid transparent; cursor:pointer;
  padding:.32rem clamp(.75rem,2vw,1.25rem); font-size:var(--fs-s); color:var(--dim);
}
.rail button:hover { background:var(--raise); color:var(--ink); }
.rail button[aria-pressed="true"] { border-left-color:var(--accent); color:var(--ink);
  background:var(--accent-soft); font-weight:600; }
.rail .cnt { margin-left:auto; font-family:var(--mono); font-size:var(--fs-xs);
  color:var(--faint); font-variant-numeric:tabular-nums; }

.pane { padding:1.1rem clamp(1rem,4vw,2.5rem) 5rem; min-width:0; }

/* ---- toolbar ----------------------------------------------------------- */
.toolbar { display:flex; flex-wrap:wrap; gap:.6rem; align-items:center; margin-bottom:1rem; }
.toolbar input[type=search] {
  flex:1 1 14rem; min-width:0; font:inherit; color:var(--ink);
  background:var(--surface); border:1px solid var(--line); border-radius:4px;
  padding:.42rem .6rem;
}
.toolbar input[type=search]:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
.tool {
  background:var(--surface); border:1px solid var(--line); border-radius:4px;
  padding:.42rem .7rem; cursor:pointer; font-size:var(--fs-s); color:var(--dim);
}
.tool:hover { background:var(--raise); color:var(--ink); }
.tool[aria-pressed="true"] { background:var(--accent-soft); color:var(--ink); border-color:var(--accent); }
.tool.primary { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); font-weight:600; }
.tool.primary:hover { filter:brightness(1.08); }

.note { font-size:var(--fs-s); color:var(--dim); margin:0 0 1rem; max-width:70ch;
  border-left:2px solid var(--line); padding-left:.8rem; }
.note strong { color:var(--ink); font-weight:600; }

/* ---- rows -------------------------------------------------------------- */
.rows { list-style:none; margin:0; padding:0; border:1px solid var(--line);
  border-radius:5px; overflow:hidden; background:var(--surface); box-shadow:var(--shadow); }
.row { display:flex; gap:.9rem; padding:.55rem .8rem; align-items:center;
  border-top:1px solid var(--line); border-left:3px solid transparent; }
.row .body { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:.15rem; }
.row:first-child { border-top:0; }
.row.cursor { background:var(--raise); }
.row[data-d="map"]    { border-left-color:var(--map); }
.row[data-d="legacy"] { border-left-color:var(--legacy); }
.row[data-d="skip"]   { border-left-color:var(--skip); opacity:.55; }
.row .nm { font-weight:600; overflow-wrap:anywhere; }
.row .zh { color:var(--dim); font-weight:400; margin-left:.5rem; font-size:var(--fs-s); }
.row .meta { display:flex; flex-wrap:wrap; align-items:center; gap:.4rem .7rem;
  font-size:var(--fs-xs); color:var(--faint); font-family:var(--mono); }
.row .meta .id { overflow-wrap:anywhere; }
.chip { display:inline-block; font-size:var(--fs-xs); font-family:var(--sans);
  padding:.05rem .4rem; border:1px solid var(--line); border-radius:99px; color:var(--dim); }
.acts { flex:0 0 auto; display:flex; gap:.3rem; }
.act { background:var(--surface); border:1px solid var(--line); border-radius:4px;
  padding:.22rem .55rem; font-size:var(--fs-xs); cursor:pointer; color:var(--dim); }
.act:hover { background:var(--raise); color:var(--ink); }
.act[aria-pressed="true"] { color:var(--accent-ink); font-weight:600; }
.act[data-v="map"][aria-pressed="true"]    { background:var(--map); border-color:var(--map); }
.act[data-v="legacy"][aria-pressed="true"] { background:var(--legacy); border-color:var(--legacy); }
.act[data-v="skip"][aria-pressed="true"]   { background:var(--skip); border-color:var(--skip); }

.reason { font-size:var(--fs-s); color:var(--dim); grid-column:1; }
.reason.unknown { color:var(--alert); font-weight:600; }
.files { font-family:var(--mono); font-size:var(--fs-xs); color:var(--faint); grid-column:1; }

/* ---- header-audit table ------------------------------------------------ */
.audit { width:100%; border-collapse:collapse; font-size:var(--fs-s); }
.audit th { text-align:left; font-size:var(--fs-xs); text-transform:uppercase;
  letter-spacing:.08em; color:var(--faint); font-weight:600; padding:.4rem .6rem;
  border-bottom:1px solid var(--line); }
.audit td { padding:.5rem .6rem; border-bottom:1px solid var(--line); vertical-align:top; }
.audit tr:last-child td { border-bottom:0; }
.audit .f { font-family:var(--mono); font-size:var(--fs-xs); overflow-wrap:anywhere; }
.kind { font-size:var(--fs-xs); text-transform:uppercase; letter-spacing:.06em;
  padding:.1rem .45rem; border-radius:3px; font-weight:600; }
.kind.wrong { background:var(--alert); color:var(--accent-ink); }
.kind.mixed { background:var(--raise); color:var(--dim); border:1px solid var(--line); }
.scroller { overflow-x:auto; border:1px solid var(--line); border-radius:5px;
  background:var(--surface); box-shadow:var(--shadow); }

.empty { padding:2.5rem 1rem; text-align:center; color:var(--faint); font-size:var(--fs-s); }

/* ---- export ------------------------------------------------------------ */
dialog {
  border:1px solid var(--line); border-radius:6px; background:var(--surface);
  color:var(--ink); padding:0; max-width:min(46rem,92vw); width:100%; box-shadow:var(--shadow);
}
dialog::backdrop { background:rgba(0,0,0,.45); }
.dlg-head { display:flex; align-items:center; gap:1rem; padding:1rem 1.2rem .6rem; }
.dlg-head h2 { font-size:1.1rem; }
.dlg-head .tool { margin-left:auto; }
dialog p { margin:0 1.2rem .7rem; font-size:var(--fs-s); color:var(--dim); max-width:64ch; }
dialog textarea {
  display:block; width:calc(100% - 2.4rem); margin:0 1.2rem 1.2rem; height:16rem;
  font:var(--fs-xs)/1.5 var(--mono); background:var(--ground); color:var(--ink);
  border:1px solid var(--line); border-radius:4px; padding:.6rem; resize:vertical;
}
.kbd { font-family:var(--mono); font-size:var(--fs-xs); background:var(--raise);
  border:1px solid var(--line); border-bottom-width:2px; border-radius:3px; padding:.02rem .3rem; }

@media (prefers-reduced-motion: reduce) { * { transition:none !important; } }
</style>

<header class="masthead">
  <h1>League Maintenance</h1>
  <span class="patch">__LABEL__</span>
  <p class="lede">
    Every difference between the game data and our curation. Nothing here is
    applied automatically &mdash; GGPK tells you what <em>exists</em>, not what
    <em>drops</em>, so each row is a question. Decisions are kept in this
    browser; export when you are done.
  </p>
  <p class="lede provenance" id="prov"></p>
</header>

<div class="summary" role="tablist" id="tabs"></div>

<div class="progress">
  <div class="bar"><span id="barfill"></span></div>
  <span class="txt" id="prog">0 decided</span>
  <span class="txt" style="color:var(--faint)">
    <span class="kbd">J</span>/<span class="kbd">K</span> move
    &middot; <span class="kbd">M</span> map
    &middot; <span class="kbd">L</span> legacy
    &middot; <span class="kbd">S</span> skip
    &middot; <span class="kbd">U</span> undo
  </span>
</div>

<main>
  <aside class="rail" id="rail"><h2>Item class</h2></aside>
  <div class="pane">
    <div class="toolbar">
      <input type="search" id="q" placeholder="Filter by name, translation, or metadata id" aria-label="Filter rows">
      <button class="tool" id="hide" aria-pressed="false">Hide decided</button>
      <button class="tool primary" id="exp">Export decisions</button>
    </div>
    <p class="note" id="note"></p>
    <div id="view"></div>
  </div>
</main>

<dialog id="dlg">
  <div class="dlg-head">
    <h2>Decisions</h2>
    <button class="tool" id="copy">Copy</button>
    <button class="tool" id="close">Close</button>
  </div>
  <p>Paste this back into the session, or save it next to the dump. Only decided
     rows are included &mdash; anything untouched stays an open question.</p>
  <textarea id="out" readonly spellcheck="false"></textarea>
</dialog>

<script>
const DATA = __DATA__;
const KEY = "poe-league-maint:" + DATA.label;
let decisions = {};
try { decisions = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { decisions = {}; }

const TABS = [
  { id:"new",       label:"New this league", sub:"added by the patch, uncovered", act:true  },
  { id:"removed",   label:"Removed",         sub:"gone from the game, still mapped", act:true  },
  { id:"backlog",   label:"Backlog",         sub:"never mapped, not new", act:true  },
  { id:"legacy",    label:"Retired",         sub:"we retired it, still shipping", act:true  },
  { id:"unmatched", label:"Not in the game", sub:"we map it, GGPK has no such base", act:false },
  { id:"headers",   label:"Class headers",   sub:"declared class vs real class", act:false },
];
const NOTES = {
  "new":"Bases this patch added that no mapping names and no <strong>Class</strong> rule covers. This is the league's actual work. Anything already handled is counted in the header, not listed here.",
  removed:"Bases the previous patch had that this one does not, which we still map. Rare \u2014 GGG disables drops rather than deleting, so a name genuinely disappearing usually means a rename.",
  backlog:"Bases the game ships that we have never mapped, carried over from earlier leagues. <strong>Most are meant to be here</strong> \u2014 pre-3.22 scarabs and retired talismans still exist in the data with drops disabled. Not league work; dip in when you have time.",
  legacy:"Names we moved to <strong>_legacy</strong> that are still present in the game data. Expected: GGG disables drops rather than deleting. Worth a look only when a mechanic comes back.",
  unmatched:"Names we map that no base type, unique, or unique map carries. Transfigured gems are composed from other tables and are <strong>absent by design</strong> \u2014 not typos; FilterBlade matches them with <code>TransfiguredGem True</code> instead of naming them. Anything marked unknown is worth checking by hand.",
  headers:"Files whose declared <strong>item_class</strong> header disagrees with the real class of their members. That is a display label only, so generation is unaffected \u2014 but the editor header is misleading.",
};

let tab = "new", cls = null, cursor = 0, hideDone = false, query = "";
const $ = (s) => document.querySelector(s);

const RAILED = new Set(["new", "backlog", "legacy"]);

function rowsFor(t) {
  let rs = DATA[t] || [];
  if (RAILED.has(t) && cls) rs = rs.filter(r => r.c === cls);
  if (query) {
    const q = query.toLowerCase();
    rs = rs.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }
  if (hideDone && isActionable(t)) rs = rs.filter(r => !decisions[key(t, r)]);
  return rs;
}
const isActionable = (t) => TABS.find(x => x.id === t).act;
const key = (t, r) => t + "\u241f" + r.n;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

// Progress is scoped to the tab you are on. A single global bar would drown
// this league's 21 rows in the several hundred carried over from earlier ones.
function tabProgress() {
  const all = DATA[tab] || [];
  if (!isActionable(tab)) return null;
  const done = all.filter(r => decisions[key(tab, r)]).length;
  return { done, total: all.length };
}

function drawTabs() {
  $("#tabs").innerHTML = TABS.map(t => `
    <button class="card" role="tab" data-t="${t.id}" aria-selected="${t.id === tab}">
      <span class="num">${(DATA[t.id] || []).length}</span>
      <span class="lbl">${esc(t.label)}</span>
      <span class="sub">${esc(t.sub)}</span>
    </button>`).join("");
}

function drawRail() {
  const rail = $("#rail");
  if (!RAILED.has(tab)) { rail.style.display = "none"; return; }
  rail.style.display = "";
  const all = DATA[tab] || [];
  const counts = {};
  for (const r of all) counts[r.c] = (counts[r.c] || 0) + 1;
  const list = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  rail.innerHTML = "<h2>Item class</h2>" +
    `<button data-c="" aria-pressed="${cls === null}">All<span class="cnt">${all.length}</span></button>` +
    list.map(([c, n]) =>
      `<button data-c="${esc(c)}" aria-pressed="${cls === c}">${esc(c)}<span class="cnt">${n}</span></button>`
    ).join("");
}

function drawRows() {
  const rs = rowsFor(tab);
  const view = $("#view");
  $("#note").innerHTML = NOTES[tab];

  if (tab === "headers") {
    view.innerHTML = rs.length ? `<div class="scroller"><table class="audit">
      <thead><tr><th>File</th><th>Declared</th><th></th><th>Actual classes of its members</th></tr></thead>
      <tbody>${rs.map(m => `<tr>
        <td class="f">${esc(m.file)}</td>
        <td>${esc(m.declared)}</td>
        <td><span class="kind ${m.kind}">${m.kind}</span></td>
        <td>${Object.entries(m.actual).map(([c, n]) =>
              `<span class="chip">${esc(c)} ${n}</span>`).join(" ")}</td>
      </tr>`).join("")}</tbody></table></div>` : empty();
    return;
  }

  if (!rs.length) { view.innerHTML = empty(); return; }
  const act = isActionable(tab);
  view.innerHTML = `<ol class="rows">` + rs.map((r, i) => {
    const d = decisions[key(tab, r)];
    const meta = [];
    if (r.c) meta.push(`<span class="chip">${esc(r.c)}</span>`);
    if (r.l != null) meta.push(`<span>lvl ${r.l}</span>`);
    if (r.i) meta.push(`<span class="id">${esc(r.i)}${r.k > 1 ? ` +${r.k - 1}` : ""}</span>`);
    if (r.f) meta.push(`<span class="id">${esc(r.f.join(", "))}</span>`);
    return `<li class="row${i === cursor ? " cursor" : ""}" data-i="${i}" ${d ? `data-d="${d}"` : ""}>
      <div class="body">
        <div class="nm">${esc(r.n)}${r.z && r.z !== r.n ? `<span class="zh">${esc(r.z)}</span>` : ""}</div>
        ${r.r ? `<div class="reason${r.r.startsWith("UNKNOWN") ? " unknown" : ""}">${esc(r.r)}</div>` : ""}
        <div class="meta">${meta.join("")}</div>
      </div>
      ${act ? `<div class="acts">
        <button class="act" data-v="map"    aria-pressed="${d === "map"}">Map</button>
        <button class="act" data-v="legacy" aria-pressed="${d === "legacy"}">Legacy</button>
        <button class="act" data-v="skip"   aria-pressed="${d === "skip"}">Skip</button>
      </div>` : ""}
    </li>`;
  }).join("") + `</ol>`;
}

function empty() {
  return `<div class="empty">Nothing matches. ${query ? "Try a shorter search." : "This queue is clear."}</div>`;
}

function drawProgress() {
  const p = tabProgress();
  const label = TABS.find(t => t.id === tab).label;
  $("#barfill").style.width = p && p.total ? (p.done / p.total * 100) + "%" : "0%";
  $("#prog").textContent = p
    ? `${label} — ${p.done} of ${p.total} decided`
    : `${label} — review only`;
}

function drawProvenance() {
  const s = DATA.suppressed, t = DATA.totals;
  // Say what was left out. A queue that quietly drops rows reads as complete.
  $("#prov").innerHTML =
    `baseline ${DATA.baseline ? esc(DATA.baseline) : "— none, showing every unmapped base"}`
    + ` · ${t.added_since_baseline} added this patch, ${t.added_already_handled} already handled`
    + ` · suppressed: ${s.non_drop} bases in non-drop classes, ${s.dead_league} in retired`
    + ` mechanics, and everything under the ${s.class_rules} classes a Class rule already covers`;
}

function render() { drawTabs(); drawRail(); drawRows(); drawProgress(); drawProvenance(); }

function setDecision(i, v) {
  const rs = rowsFor(tab);
  if (!rs[i] || !isActionable(tab)) return;
  const k = key(tab, rs[i]);
  const decided = decisions[k] !== v;
  if (decided) decisions[k] = v; else delete decisions[k];
  localStorage.setItem(KEY, JSON.stringify(decisions));
  // With "hide decided" on, the row vanishes and the next one slides into this
  // index - advancing here would skip it.
  const step = (decided && !hideDone) ? 1 : 0;
  cursor = Math.min(i + step, Math.max(rowsFor(tab).length - 1, 0));
  drawRows(); drawProgress(); drawTabs();
  const el = document.querySelector(".row.cursor");
  if (el) el.scrollIntoView({ block:"nearest" });
}

document.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  // A class picked in one queue may not exist in the next, so reset the rail.
  if (card) { tab = card.dataset.t; cls = null; cursor = 0; render(); return; }
  const railBtn = e.target.closest("#rail button");
  if (railBtn) { cls = railBtn.dataset.c || null; cursor = 0; render(); return; }
  const act = e.target.closest(".act");
  if (act) { setDecision(+act.closest(".row").dataset.i, act.dataset.v); return; }
  const row = e.target.closest(".row");
  if (row) { cursor = +row.dataset.i; drawRows(); }
});

$("#q").addEventListener("input", (e) => { query = e.target.value.trim(); cursor = 0; drawRows(); });
$("#hide").addEventListener("click", (e) => {
  hideDone = !hideDone; e.currentTarget.setAttribute("aria-pressed", hideDone);
  cursor = 0; drawRows();
});
$("#exp").addEventListener("click", () => {
  const out = { label:DATA.label, decided:decidedCount(), decisions:{} };
  for (const [k, v] of Object.entries(decisions)) {
    const [t, n] = k.split("\u241f");
    (out.decisions[t] = out.decisions[t] || {})[n] = v;
  }
  $("#out").value = JSON.stringify(out, null, 2);
  $("#dlg").showModal();
});
$("#close").addEventListener("click", () => $("#dlg").close());
$("#copy").addEventListener("click", async (e) => {
  const ta = $("#out");
  ta.select();
  try { await navigator.clipboard.writeText(ta.value); } catch (err) { document.execCommand("copy"); }
  e.currentTarget.textContent = "Copied";
  setTimeout(() => { e.currentTarget.textContent = "Copy"; }, 1400);
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  const rs = rowsFor(tab);
  const k = e.key.toLowerCase();
  if (k === "j" || k === "arrowdown") { cursor = Math.min(cursor + 1, rs.length - 1); }
  else if (k === "k" || k === "arrowup") { cursor = Math.max(cursor - 1, 0); }
  else if (k === "m") { setDecision(cursor, "map"); return; }
  else if (k === "l") { setDecision(cursor, "legacy"); return; }
  else if (k === "s") { setDecision(cursor, "skip"); return; }
  else if (k === "u") {
    const r = rs[cursor];
    if (r) { delete decisions[key(tab, r)]; localStorage.setItem(KEY, JSON.stringify(decisions));
             drawRows(); drawProgress(); }
    return;
  } else return;
  e.preventDefault();
  drawRows();
  const el = document.querySelector(".row.cursor");
  if (el) el.scrollIntoView({ block:"nearest" });
});

render();
</script>
"""

FONTS = """/* System stacks, deliberately: the strict CSP blocks font CDNs, and a linked
   webfont would fail silently to an unplanned fallback. An old-style serif for
   headings, a neutral sans for the interface, and a mono for the columns of
   ids, levels and counts that this page is mostly made of. */
:root {
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --sans: ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "Cascadia Mono", "SF Mono", Consolas, "Liberation Mono", monospace;
  --fs-xs:.75rem; --fs-s:.8125rem; --fs-b:.9375rem;
}"""


SKELETON = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
__BODY__
</html>
"""


def render(rep: dict, fragment: bool = False) -> str:
    """fragment=True omits the document skeleton, for hosts that supply their own.

    A file opened straight off disk needs the doctype or the browser drops into
    quirks mode, so that is the default.
    """
    data = json.dumps(slim(rep), ensure_ascii=False, separators=(",", ":"))
    # Guard the closing-tag sequence so the payload cannot break out of <script>.
    data = data.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    body = (TEMPLATE
            .replace("--FONTS--", FONTS)
            .replace("__DATA__", data)
            .replace("__LABEL__", rep["label"]))
    return body if fragment else SKELETON.replace("__BODY__", body)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--label", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fragment", action="store_true",
                    help="omit <!doctype>/<html>/<head> for a host that adds its own")
    args = ap.parse_args()

    src = os.path.join(REPO, "data", "source", args.label, "reconcile.json")
    if not os.path.exists(src):
        sys.exit(f"ERROR: no {src}\n  Run:  python parsing_tool/ggpk/reconcile.py --label {args.label}")
    with open(src, encoding="utf-8") as fh:
        rep = json.load(fh)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(render(rep, fragment=args.fragment))
    print(f"Wrote {args.out}  ({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
