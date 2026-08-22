"""Build the ICON + BEAM review artifact — per tier: should it draw an icon, and a beam?

    python parsing_tool/tier_review/extract_tiers.py out/tr/ruthless.json out/tr/standard.json
    python parsing_tool/tier_review/build_icon_review.py

Sibling of build_artifact.py and deliberately NOT a fork of it: that page asks what a tier
should BE (keep / merge / split / drop), this one asks a single yes-no. Reusing its tokens
verbatim so the two read as one toolkit; reusing its localStorage key would strand a review,
so this one is `sharket-icon-review-v1`. That key is kept across the beam addition: the
record grew from {i,c} to {i,b,c}, which is additive, so an in-progress review survives.

★ Why the icon is read from the TRACE, not the theme row. An inline tier `theme` beats the
row and an `item_overrides` card can add a sound the row never mentions, so "what does this
tier draw?" is only answerable from emitted block text. extract_tiers.py fills `drawnIcons`
and `hasSound` from exactly that.

⚠️ Export writes to the SCREEN. The sandbox blocks Blob + <a download> SILENTLY — the first
version of the sibling page had a button that looked dead and a finished review with no way
out. The download is still attempted, but the textarea is the contract.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'tier_review_data.json')
OUT = os.path.join(HERE, 'icon_review.html')

HTML = r"""<title>Icon &amp; Beam Pass</title>
<style>
  /* Tokens lifted verbatim from build_artifact.py so the two review pages are one
     toolkit: warm dark ground + PoE gold, because the subject is gilded plates on
     near-black. Components read tokens ONLY, so all three theme states resolve. */
  :root {
    --ground:#131110; --panel:#1b1817; --panel-2:#221e1c; --line:#302a26;
    --ink:#eae3d6; --muted:#968c7d; --accent:#c9a227; --accent-soft:#3a2f13;
    --on-accent:#1a1508;
    --ok:#7a9e63; --warn:#cf9440; --dead:#a8615a;
    --radius:7px;
    --sans:ui-sans-serif,"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;
    --mono:ui-monospace,"Cascadia Mono",Consolas,"DejaVu Sans Mono",monospace;
    --plate:Georgia,"Iowan Old Style","Times New Roman",serif;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --ground:#f7f4ef; --panel:#fff; --panel-2:#f2ece3; --line:#e0d9cd;
      --ink:#26211b; --muted:#6b6357; --accent:#8a6d10; --accent-soft:#f6ecc9;
      --on-accent:#fffdf6; --ok:#4f7439; --warn:#9a6512; --dead:#8d3f38;
    }
  }
  :root[data-theme="light"] {
    --ground:#f7f4ef; --panel:#fff; --panel-2:#f2ece3; --line:#e0d9cd;
    --ink:#26211b; --muted:#6b6357; --accent:#8a6d10; --accent-soft:#f6ecc9;
    --on-accent:#fffdf6; --ok:#4f7439; --warn:#9a6512; --dead:#8d3f38;
  }
  :root[data-theme="dark"] {
    --ground:#131110; --panel:#1b1817; --panel-2:#221e1c; --line:#302a26;
    --ink:#eae3d6; --muted:#968c7d; --accent:#c9a227; --accent-soft:#3a2f13;
    --on-accent:#1a1508; --ok:#7a9e63; --warn:#cf9440; --dead:#a8615a;
  }

  * { box-sizing:border-box; }
  body { margin:0; background:var(--ground); color:var(--ink); font-family:var(--sans);
         font-size:14px; line-height:1.5; }
  h1,h2 { text-wrap:balance; margin:0; }
  button,input,textarea,select { font:inherit; color:inherit; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  @media (prefers-reduced-motion: reduce) { * { transition:none !important; } }

  .app { display:grid; grid-template-rows:auto 1fr; height:100vh; }
  .bar { display:flex; align-items:center; gap:14px; flex-wrap:wrap;
         padding:10px 18px; background:var(--panel); border-bottom:1px solid var(--line); }
  .bar h1 { font-size:15px; font-weight:650; }
  .bar .sub { color:var(--muted); font-size:12px; }
  .spacer { flex:1; }
  .btn { background:var(--panel-2); border:1px solid var(--line); color:var(--ink);
         padding:6px 13px; border-radius:var(--radius); cursor:pointer; }
  .btn:hover { border-color:var(--accent); }
  .btn.primary { background:var(--accent); border-color:var(--accent);
                 color:var(--on-accent); font-weight:600; }

  .progress { display:flex; align-items:center; gap:8px; font-family:var(--mono);
              font-size:12px; font-variant-numeric:tabular-nums; color:var(--muted); }
  .meter { width:120px; height:6px; border-radius:3px; background:var(--panel-2);
           border:1px solid var(--line); overflow:hidden; }
  .meter i { display:block; height:100%; background:var(--accent); width:0; }

  .filters { display:flex; gap:0; border:1px solid var(--line); border-radius:var(--radius);
             overflow:hidden; }
  .filters button { background:var(--panel-2); border:0; border-right:1px solid var(--line);
                    padding:5px 11px; cursor:pointer; font-size:12.5px; white-space:nowrap; }
  .filters button:last-child { border-right:0; }
  .filters button[aria-pressed="true"] { background:var(--accent); color:var(--on-accent);
                                         font-weight:600; }

  .main { display:grid; grid-template-columns:288px 1fr; min-height:0; }
  .rail { border-right:1px solid var(--line); background:var(--panel);
          display:flex; flex-direction:column; min-height:0; }
  .search { padding:10px; border-bottom:1px solid var(--line); }
  .search input { width:100%; padding:7px 10px; background:var(--ground);
                  border:1px solid var(--line); border-radius:var(--radius); }
  .tree { overflow-y:auto; min-height:0; padding:6px 6px 40px; }
  .catbtn { display:flex; align-items:center; gap:8px; width:100%; text-align:left;
            background:none; border:1px solid transparent; padding:6px 9px;
            border-radius:var(--radius); cursor:pointer; }
  .catbtn:hover { background:var(--panel-2); }
  .catbtn[aria-current="true"] { background:var(--accent-soft); border-color:var(--accent); }
  .catbtn .name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis;
                  white-space:nowrap; }
  .catbtn .n { font-family:var(--mono); font-size:11px; color:var(--muted);
               font-variant-numeric:tabular-nums; }
  .catbtn .n.done { color:var(--accent); }

  .list { overflow-y:auto; min-height:0; padding:18px 20px 120px; }
  .cat { margin:0 0 26px; }
  .cat h2 { font-size:16px; font-weight:650; }
  .cat .files { color:var(--muted); font-size:12px; font-family:var(--mono); margin:2px 0 12px; }

  .tier { display:grid; grid-template-columns:minmax(170px,270px) 86px 86px 1fr auto;
          gap:14px; align-items:center; padding:11px 12px; border:1px solid var(--line);
          border-radius:9px; background:var(--panel); margin-bottom:9px; }
  .tier.decided { border-color:var(--accent); }
  .tier.silent { opacity:.55; }

  /* The plate as the game draws it. Georgia because PoE's item labels are a serif. */
  .plate { font-family:var(--plate); padding:5px 9px; border-radius:3px; text-align:center;
           overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
           background:#000000be; color:#c8c8c8; border:1px solid transparent; }

  .iconcell { display:flex; align-items:center; gap:8px; justify-content:flex-start; }
  .iconcell .none { color:var(--muted); font-size:11.5px; font-style:italic; }
  .iconcell .lbl { font-family:var(--mono); font-size:10.5px; color:var(--muted);
                   line-height:1.25; }

  /* A beam is a column of light in game, so it reads as a vertical bar rather than a
     chip. `Temp` fades out after a few seconds — shown as a bar that fades to nothing. */
  .beamcell { display:flex; align-items:center; gap:7px; }
  .beam { width:9px; height:26px; border-radius:2px; flex:none; }
  .beamcell .none { color:var(--muted); font-size:11.5px; font-style:italic; }
  .beamcell .lbl { font-family:var(--mono); font-size:10.5px; color:var(--muted); line-height:1.25; }

  .meta { display:flex; flex-direction:column; gap:5px; min-width:0; }
  .meta .nm { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chips { display:flex; gap:5px; flex-wrap:wrap; }
  .chip { font-family:var(--mono); font-size:10.5px; padding:1px 7px; border-radius:99px;
          border:1px solid var(--line); color:var(--muted); background:var(--panel-2); }
  .chip.snd { color:var(--warn); border-color:color-mix(in srgb, var(--warn) 45%, var(--line)); }
  .chip.dead { color:var(--dead); border-color:color-mix(in srgb, var(--dead) 45%, var(--line)); }
  .chip.r { color:var(--accent); border-color:color-mix(in srgb, var(--accent) 45%, var(--line)); }

  .call { display:flex; flex-direction:column; gap:6px; align-items:flex-end; }
  .callrow { display:flex; align-items:center; gap:7px; }
  .callrow > span { font-family:var(--mono); font-size:10.5px; color:var(--muted);
                    text-transform:uppercase; letter-spacing:.07em; }
  .seg { display:flex; border:1px solid var(--line); border-radius:var(--radius);
         overflow:hidden; }
  .seg button { background:var(--panel-2); border:0; border-right:1px solid var(--line);
                padding:5px 12px; cursor:pointer; font-size:12.5px; white-space:nowrap; }
  .seg button:last-child { border-right:0; }
  .seg button[aria-pressed="true"] { background:var(--accent); color:var(--on-accent);
                                     font-weight:600; }
  .seg button.no[aria-pressed="true"] { background:var(--muted); color:var(--panel); }
  .cmt { width:270px; max-width:38vw; padding:5px 9px; background:var(--ground);
         border:1px solid var(--line); border-radius:var(--radius); font-size:12.5px; }
  .cmt::placeholder { color:var(--muted); }

  .empty { color:var(--muted); padding:40px 4px; }

  .export-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55);
                    z-index:50; align-items:center; justify-content:center; padding:24px; }
  .export-box { background:var(--panel); border:1px solid var(--line); border-radius:10px;
                width:min(900px,100%); max-height:88vh; display:flex; flex-direction:column;
                padding:16px; gap:10px; box-shadow:0 18px 50px rgba(0,0,0,0.45); }
  .export-head { display:flex; align-items:center; gap:10px; }
  .export-box textarea { flex:1; min-height:340px; resize:vertical; font-family:var(--mono);
                font-size:12px; line-height:1.45; padding:10px; border:1px solid var(--line);
                border-radius:8px; background:var(--panel-2); color:var(--ink);
                white-space:pre; overflow:auto; }
  .export-hint { margin:0; color:var(--muted); font-size:12.5px; }
  @media (max-width: 900px) {
    .main { grid-template-columns:1fr; }
    .rail { display:none; }
    .tier { grid-template-columns:1fr; }
    .call { align-items:flex-start; }
  }
</style>

<div class="app">
  <div class="bar">
    <h1>Icon &amp; Beam Pass</h1>
    <span class="sub" id="sub"></span>
    <div class="filters" id="filters"></div>
    <div class="spacer"></div>
    <div class="progress"><span id="pct">0 / 0</span><span class="meter"><i id="meter"></i></span></div>
    <button class="btn" id="theme">Theme</button>
    <button class="btn primary" id="export">Export</button>
  </div>

  <div class="main">
    <aside class="rail">
      <div class="search"><input id="q" placeholder="Filter categories…" autocomplete="off"></div>
      <div class="tree" id="tree"></div>
    </aside>
    <main class="list" id="list"></main>
  </div>
</div>

<div class="export-overlay" id="ov">
  <div class="export-box">
    <div class="export-head">
      <strong>Icon &amp; beam decisions</strong>
      <span class="spacer"></span>
      <button class="btn" id="copy">Copy</button>
      <button class="btn" id="close">Close</button>
    </div>
    <p class="export-hint">Select all and copy. The page is sandboxed, so a file download
      cannot be relied on — this text is the export.</p>
    <textarea id="out" spellcheck="false" readonly></textarea>
  </div>
</div>

<script>
const DATA = __DATA__;
const KEY = 'sharket-icon-review-v1';

/* ---- store: {catKey: {tierKey: {i:1|0, c:"comment"}}} ---------------------- */
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
const rec = (ck, tk) => (store[ck] && store[ck][tk]) || null;

/* A tier is worth reviewing when it actually draws something: it emits, and it is not a
   hide layer. Hide blocks never carry an icon, and an orphan theme row draws nothing at
   all — showing either would pad the list with rows that cannot be answered. */
const reviewable = t => !t.orphanRow && !t.hide && t.emits > 0;
const CATS = DATA.categories.map(c => ({...c, rows: c.tiers.filter(reviewable)}))
                            .filter(c => c.rows.length);
const TOTAL = CATS.reduce((n, c) => n + c.rows.length, 0);

/* ---- minimap icon glyph ---------------------------------------------------
   PoE writes an icon as "<size> <colour> <shape>", size 0 being the LARGEST — the
   editor's own picker had that inverted once and every icon authored through it came
   out upside down, so the scale here is deliberate. */
const ICON_HEX = { Red:'#e0403a', Green:'#3fbf5f', Blue:'#4a7fe0', Brown:'#9a6b3f',
  White:'#f2f2f2', Yellow:'#e8c93a', Cyan:'#49c6d4', Grey:'#9a9a9a', Orange:'#e8873a',
  Pink:'#e572b0', Purple:'#a267d6' };
const SHAPE = {
  Circle:  s => `<circle cx="12" cy="12" r="${s}"/>`,
  Diamond: s => `<path d="M12 ${12-s}L${12+s} 12 12 ${12+s} ${12-s} 12Z"/>`,
  Square:  s => `<rect x="${12-s}" y="${12-s}" width="${s*2}" height="${s*2}"/>`,
  Triangle:s => `<path d="M12 ${12-s}L${12+s} ${12+s*0.8} ${12-s} ${12+s*0.8}Z"/>`,
  Star:    s => { let p=''; for(let i=0;i<10;i++){const r=i%2?s*0.45:s;const a=Math.PI/5*i-Math.PI/2;
                  p+=(i?'L':'M')+(12+r*Math.cos(a)).toFixed(2)+' '+(12+r*Math.sin(a)).toFixed(2);}
                  return `<path d="${p}Z"/>`; },
  Hexagon: s => { let p=''; for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/2;
                  p+=(i?'L':'M')+(12+s*Math.cos(a)).toFixed(2)+' '+(12+s*Math.sin(a)).toFixed(2);}
                  return `<path d="${p}Z"/>`; },
  Pentagon:s => { let p=''; for(let i=0;i<5;i++){const a=Math.PI*2/5*i-Math.PI/2;
                  p+=(i?'L':'M')+(12+s*Math.cos(a)).toFixed(2)+' '+(12+s*Math.sin(a)).toFixed(2);}
                  return `<path d="${p}Z"/>`; },
  Cross:   s => `<path d="M${12-s*0.34} ${12-s}h${s*0.68}v${s*0.66}h${s*0.66}v${s*0.68}h-${s*0.66}v${s*0.66}h-${s*0.68}v-${s*0.66}h-${s*0.66}v-${s*0.68}h${s*0.66}Z"/>`,
  Moon:    s => `<path d="M12 ${12-s}a${s} ${s} 0 1 0 ${s*0.72} ${s*1.86}A${s*0.86} ${s*0.86} 0 1 1 12 ${12-s}Z"/>`,
  Raindrop:s => `<path d="M12 ${12-s}c${s*0.8} ${s*0.7} ${s} ${s*1.1} ${s} ${s*1.35}a${s} ${s} 0 0 1-${s*2} 0c0-${s*0.25} ${s*0.2}-${s*0.65} ${s}-${s*1.35}Z"/>`,
  Kite:    s => `<path d="M12 ${12-s}L${12+s*0.78} 12 12 ${12+s} ${12-s*0.78} 12Z"/>`,
  UpsideDownHouse: s => `<path d="M${12-s} ${12-s}h${s*2}v${s*0.9}L12 ${12+s}Z"/>`,
};
function glyph(v) {
  const p = String(v).trim().split(/\s+/);
  const size = Number(p[0]), col = ICON_HEX[p[1]] || '#f2f2f2', shp = p.slice(2).join('');
  const r = size === 0 ? 10 : size === 1 ? 7.5 : 5.5;   // 0 is the biggest
  const draw = SHAPE[shp] || SHAPE.Circle;
  return `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
    style="fill:${col};flex:none"><rect width="24" height="24" fill="none"/>${draw(r)}</svg>`;
}

/* A beam is "<Colour>" or "<Colour> Temp". Temp fades after a few seconds, so it is drawn
   as a bar fading out rather than a second colour — the difference is duration, not hue. */
const BEAM_HEX = { ...ICON_HEX };
function beamBar(v) {
  const p = String(v).trim().split(/\s+/);
  const col = BEAM_HEX[p[0]] || '#f2f2f2';
  const temp = p.includes('Temp');
  const bg = temp ? `linear-gradient(to bottom, ${col}, transparent)` : col;
  return `<span class="beam" style="background:${bg}" aria-hidden="true"></span>`;
}

/* ---- rendering ------------------------------------------------------------ */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

let filter = 'todo', active = null, query = '';

/* "Undecided" means BOTH calls are still open — a tier answered for icons but not beams
   is still work, and dropping it from the list once the icon is set loses half the pass. */
const isDone = r => !!r && r.i !== undefined && r.b !== undefined;
const FILTERS = [
  ['todo',   'Undecided',      t => !isDone(rec(t._ck, t.tier))],
  ['gap',    'Sound, no icon', t => t.hasSound && !t.drawnIcons.length],
  ['noicon', 'No icon',        t => !t.drawnIcons.length],
  ['icon',   'Has icon',       t => t.drawnIcons.length > 0],
  ['beam',   'Has beam',       t => t.drawnBeams.length > 0],
  ['nobeam', 'No beam',        t => !t.drawnBeams.length],
  ['all',    'All',            () => true],
];
const passes = t => (FILTERS.find(f => f[0] === filter) || FILTERS[FILTERS.length - 1])[2](t);

function plateStyle(s) {
  const hex = v => {
    if (!v || typeof v !== 'string' || v[0] !== '#') return null;
    const h = v.slice(1);
    if (h.length === 8) return '#' + h.slice(0, 6);
    return '#' + h;
  };
  const t = hex(s.TextColor), b = hex(s.BackgroundColor), br = hex(s.BorderColor);
  const fs = Math.max(11, Math.min(19, (s.FontSize || 32) * 0.36));
  /* An ABSENT colour is not a missing value here — it is the designer saying "let the
     game paint it", which is how rarity shows through. Render that as the game's own
     default label rather than inventing a colour. */
  return `font-size:${fs.toFixed(1)}px;` +
         `color:${t || '#c8c8c8'};` +
         `background:${b || '#000000be'};` +
         (br ? `border-color:${br};` : 'border-color:transparent;');
}

function tierRow(c, t) {
  const r = rec(c.key, t.tier) || {};
  const label = t.ch || t.en || t.tier;
  const chips = [`<span class="chip r">R${t.num}</span>`];
  if (t.hasSound) chips.push('<span class="chip snd">sound</span>');
  if (t.classCond) chips.push('<span class="chip">class rule</span>');
  else if (t.conds) chips.push(`<span class="chip">${t.conds} cond</span>`);
  if (t.items) chips.push(`<span class="chip">${t.items} items</span>`);
  chips.push(`<span class="chip">emits ${t.emits}</span>`);

  const icons = t.drawnIcons.length
    ? t.drawnIcons.map(v => `${glyph(v)}<span class="lbl">${esc(v)}</span>`).join('')
    : '<span class="none">no icon</span>';
  const beams = t.drawnBeams.length
    ? t.drawnBeams.map(v => `${beamBar(v)}<span class="lbl">${esc(v)}</span>`).join('')
    : '<span class="none">no beam</span>';

  return `<div class="tier ${isDone(r) ? 'decided' : ''}" data-c="${esc(c.key)}" data-t="${esc(t.tier)}">
    <div class="plate" style="${plateStyle(t.style || {})}">${esc(label)}</div>
    <div class="iconcell">${icons}</div>
    <div class="beamcell">${beams}</div>
    <div class="meta">
      <span class="nm">${esc(t.tier)}</span>
      <span class="chips">${chips.join('')}</span>
    </div>
    <div class="call">
      <div class="callrow"><span>icon</span>
        <div class="seg" data-k="i">
          <button data-v="1" aria-pressed="${r.i === 1}">Yes</button>
          <button class="no" data-v="0" aria-pressed="${r.i === 0}">No</button>
        </div>
      </div>
      <div class="callrow"><span>beam</span>
        <div class="seg" data-k="b">
          <button data-v="1" aria-pressed="${r.b === 1}">Yes</button>
          <button class="no" data-v="0" aria-pressed="${r.b === 0}">No</button>
        </div>
      </div>
      <input class="cmt" placeholder="Comment (optional)" value="${esc(r.c || '')}">
    </div>
  </div>`;
}

function render() {
  const list = document.getElementById('list');
  const shown = CATS.filter(c => !active || c.key === active);
  let html = '';
  for (const c of shown) {
    const rows = c.rows.filter(t => passes({ ...t, _ck: c.key }));
    if (!rows.length) continue;
    html += `<section class="cat"><h2>${esc(c.key)}</h2>
      <div class="files">${esc(c.files.join('  ·  ') || '—')}</div>
      ${rows.map(t => tierRow(c, t)).join('')}</section>`;
  }
  list.innerHTML = html || `<p class="empty">Nothing matches this filter.
    ${active ? 'Try clearing the category, or ' : ''}switch to <b>All</b>.</p>`;
  paint();
}

function paint() {
  let nDone = 0;
  for (const c of CATS) for (const t of c.rows) if (isDone(rec(c.key, t.tier))) nDone++;
  document.getElementById('pct').textContent = `${nDone} / ${TOTAL}`;
  document.getElementById('meter').style.width = TOTAL ? (nDone / TOTAL * 100) + '%' : '0';
  document.getElementById('sub').textContent =
    `${TOTAL} tiers that draw something, in ${CATS.length} categories · both calls needed`;
  // rail counts
  document.querySelectorAll('.catbtn').forEach(b => {
    const c = CATS.find(x => x.key === b.dataset.k);
    if (!c) return;
    const n = c.rows.filter(t => isDone(rec(c.key, t.tier))).length;
    const el = b.querySelector('.n');
    el.textContent = `${n}/${c.rows.length}`;
    el.classList.toggle('done', n === c.rows.length);
  });
}

function renderRail() {
  const q = query.toLowerCase();
  document.getElementById('tree').innerHTML = CATS
    .filter(c => !q || c.key.toLowerCase().includes(q))
    .map(c => `<button class="catbtn" data-k="${esc(c.key)}" aria-current="${active === c.key}">
        <span class="name">${esc(c.key)}</span><span class="n"></span></button>`).join('');
  paint();
}

/* ---- events --------------------------------------------------------------- */
document.getElementById('filters').innerHTML = FILTERS
  .map(([k, lbl]) => `<button data-f="${k}" aria-pressed="${filter === k}">${lbl}</button>`).join('');
document.getElementById('filters').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  filter = b.dataset.f;
  document.querySelectorAll('#filters button')
    .forEach(x => x.setAttribute('aria-pressed', x.dataset.f === filter));
  render();
};

document.getElementById('tree').onclick = e => {
  const b = e.target.closest('.catbtn'); if (!b) return;
  active = active === b.dataset.k ? null : b.dataset.k;
  renderRail(); render();
};
document.getElementById('q').oninput = e => { query = e.target.value; renderRail(); };

document.getElementById('list').addEventListener('click', e => {
  const btn = e.target.closest('.seg button'); if (!btn) return;
  const seg = btn.closest('.seg'), k = seg.dataset.k;        // 'i' = icon, 'b' = beam
  const row = btn.closest('.tier');
  const ck = row.dataset.c, tk = row.dataset.t, v = Number(btn.dataset.v);
  const cur = { ...(rec(ck, tk) || {}) };
  if (cur[k] === v) delete cur[k];                           // click again to clear
  else cur[k] = v;
  store[ck] = store[ck] || {};
  if (cur.i === undefined && cur.b === undefined && !cur.c) delete store[ck][tk];
  else store[ck][tk] = cur;
  if (!Object.keys(store[ck]).length) delete store[ck];
  save();
  const now = rec(ck, tk);
  row.classList.toggle('decided', isDone(now));
  seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed',
    String(!!now && now[k] === Number(x.dataset.v))));
  paint();
});

document.getElementById('list').addEventListener('input', e => {
  if (!e.target.classList.contains('cmt')) return;
  const row = e.target.closest('.tier');
  const ck = row.dataset.c, tk = row.dataset.t, v = e.target.value;
  const cur = rec(ck, tk) || {};
  store[ck] = store[ck] || {};
  if (!v && cur.i === undefined && cur.b === undefined) delete store[ck][tk];
  else store[ck][tk] = { ...cur, c: v };
  if (store[ck] && !Object.keys(store[ck]).length) delete store[ck];
  save(); paint();
});

document.getElementById('theme').onclick = () => {
  const el = document.documentElement;
  const cur = el.getAttribute('data-theme');
  el.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
};

document.getElementById('export').onclick = () => {
  const out = { format: 'sharket-icon-beam-review', version: 2, tiers: {} };
  for (const [ck, tiers] of Object.entries(store)) {
    const e = {};
    for (const [tk, r] of Object.entries(tiers)) {
      const o = {};
      if (r.i !== undefined) o.icon = r.i ? 'yes' : 'no';
      if (r.b !== undefined) o.beam = r.b ? 'yes' : 'no';
      if (r.c) o.note = r.c;
      if (Object.keys(o).length) e[tk] = o;
    }
    if (Object.keys(e).length) out.tiers[ck] = e;
  }
  const txt = JSON.stringify(out, null, 1);
  document.getElementById('out').value = txt;
  document.getElementById('ov').style.display = 'flex';
  try {                                    // bonus only; the textarea is the contract
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = 'icon-beam-review.json'; a.click();
  } catch (err) {}
};
document.getElementById('copy').onclick = async () => {
  const ta = document.getElementById('out');
  ta.select();
  try { await navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
};
document.getElementById('close').onclick = () => { document.getElementById('ov').style.display = 'none'; };

renderRail(); render();
</script>
"""

with open(DATA, encoding='utf-8') as f:
    data = json.load(f)

# Only what this page reads — the sibling page's fields would triple the payload.
slim = {'categories': [
    {'key': c['key'], 'files': c['files'],
     'tiers': [{k: t.get(k) for k in ('tier', 'num', 'en', 'ch', 'hide', 'items', 'rules',
                                      'conds', 'classCond', 'emits', 'style',
                                      'drawnIcons', 'drawnBeams', 'hasSound', 'orphanRow')}
               for t in c['tiers']]}
    for c in data['categories']]}

html = HTML.replace('__DATA__', json.dumps(slim, ensure_ascii=False, separators=(',', ':')))
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

n_cat = sum(1 for c in slim['categories']
            if any(not t['orphanRow'] and not t['hide'] and t['emits'] for t in c['tiers']))
n_tier = sum(1 for c in slim['categories'] for t in c['tiers']
             if not t['orphanRow'] and not t['hide'] and t['emits'])
n_icon = sum(1 for c in slim['categories'] for t in c['tiers']
             if not t['orphanRow'] and not t['hide'] and t['emits'] and t['drawnIcons'])
n_gap = sum(1 for c in slim['categories'] for t in c['tiers']
            if not t['orphanRow'] and not t['hide'] and t['emits']
            and t['hasSound'] and not t['drawnIcons'])
print('reviewable: %d tiers in %d categories' % (n_tier, n_cat))
print('  draw an icon today : %d' % n_icon)
n_beam = sum(1 for c in slim['categories'] for t in c['tiers']
             if not t['orphanRow'] and not t['hide'] and t['emits'] and t['drawnBeams'])
print('  sound but no icon  : %d' % n_gap)
print('  draw a beam today  : %d' % n_beam)
print('wrote %s (%.0f KB)' % (OUT, os.path.getsize(OUT) / 1024))
