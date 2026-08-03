"""Build the tier-review artifact: inline the extracted ladder into a self-contained page."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'tier_review_data.json')
OUT = os.path.join(HERE, 'tier_review.html')

with open(DATA, encoding='utf-8') as f:
    payload = f.read()
# "</script>" inside data would close the tag early; escaping "<" makes that impossible.
payload = payload.replace('<', '\\u003c')

HTML = r"""<title>Tier Ladder Review</title>
<style>
  /* ---- tokens: warm dark ground + PoE gold, because the subject is a game UI of
         gilded plates on near-black. Components read tokens ONLY, so the two theme
         overrides below can win in both directions. ---- */
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
    :root {
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
  h1,h2,h3 { text-wrap:balance; margin:0; }
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
  .btn.sm { padding:4px 10px; font-size:12.5px; }

  /* Export panel: the review has to be readable on screen, because a sandboxed page
     cannot rely on a file download working. */
  .export-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.55);
                    z-index:50; align-items:center; justify-content:center; padding:24px; }
  .export-box { background:var(--panel); border:1px solid var(--line); border-radius:10px;
                width:min(900px,100%); max-height:88vh; display:flex; flex-direction:column;
                padding:16px; gap:10px; box-shadow:0 18px 50px rgba(0,0,0,0.45); }
  .export-head { display:flex; align-items:center; gap:10px; }
  .export-spacer { flex:1; }
  .export-count { color:var(--muted); font-size:12.5px; }
  .export-hint { margin:0; color:var(--muted); font-size:12.5px; line-height:1.5; }
  .export-box textarea { flex:1; min-height:320px; resize:vertical; font-family:ui-monospace,
                Consolas,monospace; font-size:12px; line-height:1.45; padding:10px;
                border:1px solid var(--line); border-radius:8px; background:var(--panel-2);
                color:var(--ink); white-space:pre; overflow:auto; }

  .lang { display:flex; border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; }
  .lang button { background:var(--panel-2); border:0; padding:5px 11px; cursor:pointer; font-size:12.5px; }
  .lang button[aria-pressed="true"] { background:var(--accent); color:var(--on-accent); font-weight:600; }

  .progress { display:flex; align-items:center; gap:8px; font-family:var(--mono);
              font-size:12px; font-variant-numeric:tabular-nums; color:var(--muted); }
  .meter { width:110px; height:6px; border-radius:3px; background:var(--panel-2);
           border:1px solid var(--line); overflow:hidden; }
  .meter i { display:block; height:100%; background:var(--accent); width:0; }

  .main { display:grid; grid-template-columns:300px 1fr; min-height:0; }
  .rail { border-right:1px solid var(--line); background:var(--panel);
          display:flex; flex-direction:column; min-height:0; }
  .search { padding:10px; border-bottom:1px solid var(--line); display:flex; gap:8px; }
  .search input { flex:1; min-width:0; padding:7px 10px; background:var(--ground);
                  border:1px solid var(--line); border-radius:var(--radius); }
  .tree { overflow-y:auto; min-height:0; padding:6px 6px 40px; }

  /* nav mirrors the editor: chapter rule, collapsible group, nested subgroup, leaf */
  .sep { font-size:10.5px; letter-spacing:.11em; text-transform:uppercase; color:var(--muted);
         padding:16px 10px 5px; border-bottom:1px solid var(--line); margin-bottom:5px; }
  .grp { display:flex; align-items:center; gap:7px; width:100%; text-align:left; background:none;
         border:0; padding:7px 9px; border-radius:var(--radius); cursor:pointer; font-weight:600; }
  .grp:hover { background:var(--panel-2); }
  .grp .tw { color:var(--muted); font-size:10px; width:9px; flex:none; }
  .grp .n { font-family:var(--mono); font-size:11px; font-weight:400; color:var(--muted); }
  .kids { margin-left:10px; border-left:1px solid var(--line); padding-left:5px; }
  .sub { font-size:12px; color:var(--muted); padding:6px 9px 3px; font-weight:600; }
  .leaf { display:flex; align-items:center; gap:7px; width:100%; text-align:left; background:none;
          border:1px solid transparent; padding:6px 9px; border-radius:var(--radius); cursor:pointer; }
  .leaf:hover { background:var(--panel-2); }
  .leaf[aria-current="true"] { background:var(--accent-soft); border-color:var(--accent); }
  .leaf .name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .leaf .n, .leaf .done { font-family:var(--mono); font-size:11px; color:var(--muted);
                          font-variant-numeric:tabular-nums; }
  .leaf .done { color:var(--accent); }
  .dot { width:7px; height:7px; border-radius:50%; flex:none; background:var(--ok); }
  .dot.orphan { background:var(--dead); }
  .dot.warn { background:var(--warn); }

  .sheet { overflow-y:auto; min-height:0; padding:20px 22px 80px; }
  .cathead { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
  .cathead h2 { font-size:20px; letter-spacing:-.01em; }
  .chip { font-family:var(--mono); font-size:11px; padding:2px 8px; border-radius:20px;
          border:1px solid var(--line); background:var(--panel-2); color:var(--muted); }
  .chip.orphan { color:var(--dead); border-color:var(--dead); }
  .chip.warnc { color:var(--warn); border-color:var(--warn); }
  .files { color:var(--muted); font-family:var(--mono); font-size:11.5px;
           margin:7px 0 14px; overflow-x:auto; white-space:nowrap; padding-bottom:2px; }
  .catnote { width:100%; margin-bottom:8px; padding:9px 11px; background:var(--panel);
             border:1px solid var(--line); border-radius:var(--radius); resize:vertical;
             min-height:54px; }

  .tier { display:grid; grid-template-columns:330px 1fr; gap:18px;
          padding:14px 0; border-top:1px solid var(--line); align-items:start; }
  .tier.hide .plateWrap { opacity:.5; }
  .tier.proposed { background:linear-gradient(90deg,var(--accent-soft),transparent 60%);
                   border-top:1px dashed var(--accent); }
  .lead { display:flex; flex-direction:column; gap:7px; min-width:0; }
  .tkey { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-family:var(--mono);
          font-size:12px; color:var(--muted); font-variant-numeric:tabular-nums; }
  /* tokens stay whole - "Tier 0" breaking across two lines reads as two fields */
  .tkey > * { white-space:nowrap; }
  .tkey b { color:var(--ink); font-weight:600; }
  /* Emission facts, so "no mapped items" is never mistaken for "dead": a tier can match
     by condition or by rule. SILENT is the only one that means it cannot appear. */
  .tkey .live { color:var(--ok); border:1px solid var(--ok); border-radius:3px; padding:0 5px; }
  .tkey .silent { color:var(--dead); border:1px solid var(--dead); border-radius:3px;
                  padding:0 5px; font-weight:600; }
  .plateWrap { background:
      linear-gradient(135deg,#1a1a1a 25%,#141414 25%,#141414 50%,#1a1a1a 50%,#1a1a1a 75%,#141414 75%);
      background-size:14px 14px; padding:10px; border-radius:var(--radius);
      border:1px solid var(--line); display:flex; justify-content:center; }
  .plate { font-family:var(--plate); padding:3px 10px; border-radius:2px; text-align:center;
           max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .plate.nocolor { color:#c8c8c8; font-style:italic; }
  .fx { display:flex; gap:6px; flex-wrap:wrap; font-family:var(--mono); font-size:10.5px;
        color:var(--muted); }
  .fx span { border:1px solid var(--line); border-radius:3px; padding:1px 6px; }
  .fx .none { opacity:.45; }

  .edit { display:flex; flex-direction:column; gap:8px; min-width:0; }
  .edit textarea { width:100%; min-height:66px; padding:9px 11px; background:var(--panel);
                   border:1px solid var(--line); border-radius:var(--radius); resize:vertical; }
  .edit textarea:focus { border-color:var(--accent); }
  .actions { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
  .act { font-size:11.5px; padding:3px 10px; border-radius:20px; cursor:pointer;
         background:var(--panel-2); border:1px solid var(--line); color:var(--muted); }
  .act:hover { border-color:var(--accent); color:var(--ink); }
  .act[aria-pressed="true"] { background:var(--accent); border-color:var(--accent);
         color:var(--on-accent); font-weight:600; }
  .link { background:none; border:0; color:var(--muted); cursor:pointer; font-size:12px;
          text-decoration:underline; padding:2px 4px; }
  .link:hover { color:var(--dead); }

  .addrow { margin-top:18px; padding-top:16px; border-top:1px solid var(--line);
            display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
  .hint { color:var(--muted); font-size:12.5px; }
  .form { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
  .form input { padding:7px 10px; background:var(--ground); border:1px solid var(--line);
                border-radius:var(--radius); min-width:180px; }
  .empty { color:var(--muted); padding:40px 0; }

  @media (max-width: 880px) {
    .main { grid-template-columns:1fr; }
    .rail { max-height:36vh; }
    .tier { grid-template-columns:1fr; }
  }
</style>

<div class="app">
  <div class="bar">
    <h1>Tier Ladder Review</h1>
    <span class="sub" id="counts"></span>
    <span class="spacer"></span>
    <div class="lang" role="group" aria-label="Language">
      <button id="langCh" aria-pressed="true">中文</button>
      <button id="langEn" aria-pressed="false">EN</button>
    </div>
    <div class="progress" title="tiers carrying a note or an action"><div class="meter"><i id="meterfill"></i></div><span id="pct"></span></div>
    <button class="btn" id="importBtn">Import</button>
    <input type="file" id="importFile" accept="application/json" hidden>
    <button class="btn primary" id="exportBtn">Export JSON</button>
  </div>
  <div class="main">
    <div class="rail">
      <div class="search"><input id="q" type="search" placeholder="Filter"></div>
      <div class="tree" id="tree"></div>
    </div>
    <div class="sheet" id="sheet"></div>
  </div>
</div>

<div class="export-overlay" id="exportOverlay">
  <div class="export-box">
    <div class="export-head">
      <strong>Your review</strong>
      <span class="export-count" id="exportCount"></span>
      <span class="export-spacer"></span>
      <button class="btn primary" id="exportCopy">Copy</button>
      <button class="btn" id="exportClose">Close</button>
    </div>
    <p class="export-hint">
      Copy this and paste it into the chat. (A file download is attempted too, but this
      page runs sandboxed and downloads are often blocked — the text below always works.)
    </p>
    <textarea id="exportText" spellcheck="false" readonly></textarea>
  </div>
</div>

<script id="tierdata" type="application/json">__DATA__</script>
<script>
(function () {
  const DATA = JSON.parse(document.getElementById('tierdata').textContent);
  const KEY = 'sharket-tier-review-v2';
  const ACTIONS = ['keep', 'rename', 'merge', 'split', 'drop', 'restyle'];
  const byKey = Object.fromEntries(DATA.categories.map(c => [c.key, c]));

  let store = { notes: {}, newCats: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.notes) store = { notes: raw.notes || {}, newCats: raw.newCats || [] };
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  const bucket = k => (store.notes[k] = store.notes[k] || {});

  let lang = localStorage.getItem('sharket-tier-review-lang') || 'ch';
  let current = null;        // theme key being edited
  let currentLeaf = null;    // nav leaf path, for the highlight
  let query = '';
  const open = {};           // collapsed/expanded groups

  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nameOf = o => (lang === 'ch' ? (o.ch || o.en) : (o.en || o.ch)) || '';

  const reviewed = (ck, tk) => {
    const n = (store.notes[ck] || {})[tk];
    return !!(n && ((n.d && n.d.trim()) || n.a));
  };
  const catDone = c => c.tiers.filter(t => reviewed(c.key, t.tier)).length;
  const addedOf = k => (store.notes[k] || {})._new || [];

  // ---------- nav ----------
  const leafHit = lf => !query ||
    (lf.en + ' ' + lf.ch + ' ' + lf.key + ' ' + lf.path).toLowerCase().includes(query);
  // Two DIFFERENT questions, and conflating them made one matching leaf drag in all its
  // siblings: searching "Breach" listed a dozen unrelated bases.
  const groupNamed = g => (nameOf(g) + ' ' + g.en).toLowerCase().includes(query);
  const groupHit = g => groupNamed(g) ||
    g.leaves.some(leafHit) || g.subgroups.some(groupHit);
  // a leaf shows when IT matches, or when its group is what you searched for
  const leafShown = (lf, g) => !query || leafHit(lf) || groupNamed(g);

  function leafHTML(lf) {
    const c = byKey[lf.key];
    const done = c ? catDone(c) + addedOf(lf.key).filter(x => x.d && x.d.trim()).length : 0;
    const tot = c ? c.tiers.length : 0;
    const state = !c ? 'warn' : (c.live ? '' : 'orphan');
    const title = !c ? 'no ladder found for this leaf' :
      (c.live ? 'theme key: ' + lf.key : 'theme rows only');
    return `<button class="leaf" data-key="${esc(lf.key)}" data-leaf="${esc(lf.path)}"
        aria-current="${currentLeaf === lf.path}" title="${esc(title)}">
      <span class="dot ${state}"></span>
      <span class="name">${esc(nameOf(lf) || lf.path)}</span>
      ${done ? `<span class="done">${done}/${tot}</span>` : `<span class="n">${tot || ''}</span>`}
    </button>`;
  }

  function groupHTML(g, depth, id) {
    const kids = g.subgroups.filter(s => !query || groupHit(s));
    const leaves = g.leaves.filter(lf => leafShown(lf, g));
    // the editor flattens a single-leaf group into one row; mirror that
    if (!g.subgroups.length && g.leaves.length === 1) return leafHTML(g.leaves[0]);
    const isOpen = query ? true : (open[id] !== undefined ? open[id] : false);
    const count = leaves.length + kids.reduce((n, s) => n + s.leaves.length, 0);
    return `<button class="grp" data-grp="${esc(id)}">
        <span class="tw">${isOpen ? '▾' : '▸'}</span>
        <span style="flex:1">${esc(nameOf(g))}</span><span class="n">${count}</span>
      </button>
      ${isOpen ? `<div class="kids">
        ${leaves.map(leafHTML).join('')}
        ${kids.map(s => `<div class="sub">${esc(nameOf(s))}</div>${
          s.leaves.filter(lf => leafShown(lf, s)).map(leafHTML).join('')}`).join('')}
      </div>` : ''}`;
  }

  function renderTree() {
    let html = '';
    DATA.nav.forEach((entry, i) => {
      if (entry.separator !== undefined) {
        html += `<div class="sep">${esc(lang === 'ch' ? (entry.separator_ch || entry.separator) : entry.separator)}</div>`;
      } else if (!query || groupHit(entry)) {
        html += groupHTML(entry, 0, 'g' + i);
      }
    });

    const un = DATA.unnavigated.filter(k => !query || k.toLowerCase().includes(query));
    if (un.length) {
      html += `<div class="sep">Not in the navigation</div>` + un.map(k => {
        const c = byKey[k], done = c ? catDone(c) : 0;
        return `<button class="leaf" data-key="${esc(k)}" data-leaf="!${esc(k)}"
            aria-current="${currentLeaf === '!' + k}"
            title="${c && c.live ? 'LIVE, but no nav entry - unreachable in the editor' : 'theme rows only'}">
          <span class="dot ${c && c.live ? 'warn' : 'orphan'}"></span>
          <span class="name">${esc(k)}</span>
          ${done ? `<span class="done">${done}/${c.tiers.length}</span>` : `<span class="n">${c ? c.tiers.length : ''}</span>`}
        </button>`;
      }).join('');
    }

    if (store.newCats.length) {
      html += `<div class="sep">Proposed categories</div>` + store.newCats.map((nc, i) =>
        `<button class="leaf" data-newcat="${i}" aria-current="${currentLeaf === 'new:' + i}">
          <span class="dot warn"></span><span class="name">${esc(nc.n || '(unnamed)')}</span>
        </button>`).join('');
    }
    html += `<div style="padding:14px 9px"><button class="btn sm" id="addCat">+ Propose a category</button></div>`;

    el('tree').innerHTML = html;
    [...document.querySelectorAll('.grp')].forEach(b => b.onclick = () => {
      const id = b.dataset.grp; open[id] = !(open[id] !== undefined ? open[id] : false); renderTree();
    });
    [...document.querySelectorAll('.leaf')].forEach(b => b.onclick = () => {
      if (b.dataset.newcat !== undefined) { current = null; currentLeaf = 'new:' + b.dataset.newcat; }
      else { current = b.dataset.key; currentLeaf = b.dataset.leaf; }
      render(); el('sheet').scrollTop = 0;
    });
    el('addCat').onclick = () => {
      store.newCats.push({ n: '', where: '', d: '' }); save();
      currentLeaf = 'new:' + (store.newCats.length - 1); current = null; render();
    };
  }

  // ---------- sheet ----------
  const plateStyle = (s) => {
    const px = Math.round(11 + ((s.FontSize || 32) - 18) * 0.30);
    let css = `font-size:${px}px;`;
    css += s.BackgroundColor ? `background:${s.BackgroundColor};` : 'background:rgba(0,0,0,.55);';
    css += s.TextColor ? `color:${s.TextColor};` : '';
    css += (s.BorderColor && s.BorderColor !== '#00000000')
      ? `border:1px solid ${s.BorderColor};` : 'border:1px solid transparent;';
    return css;
  };

  function newCatSheet(i) {
    const nc = store.newCats[i];
    if (!nc) { el('sheet').innerHTML = '<div class="empty">Gone.</div>'; return; }
    el('sheet').innerHTML = `
      <div class="cathead"><h2>Proposed category</h2><span class="chip warnc">not in the filter yet</span></div>
      <div class="form">
        <input id="ncName" placeholder="Category name" value="${esc(nc.n)}">
        <input id="ncWhere" placeholder="Where should it sit? (chapter / group)" value="${esc(nc.where)}">
      </div>
      <textarea class="catnote" id="ncNote" style="margin-top:12px"
        placeholder="What is it for, which items belong in it, how many tiers, and why it is not just part of an existing category.">${esc(nc.d)}</textarea>
      <div class="addrow"><button class="link" id="ncDel">Remove this proposal</button></div>`;
    el('ncName').oninput = e => { nc.n = e.target.value; save(); renderTree(); };
    el('ncWhere').oninput = e => { nc.where = e.target.value; save(); };
    el('ncNote').oninput = e => { nc.d = e.target.value; save(); };
    el('ncDel').onclick = () => {
      store.newCats.splice(i, 1); save(); currentLeaf = null; current = null; render();
    };
  }

  function renderSheet() {
    if (currentLeaf && currentLeaf.startsWith('new:')) return newCatSheet(+currentLeaf.slice(4));
    const c = byKey[current];
    if (!c) {
      el('sheet').innerHTML = `<div class="empty">Pick a category on the left.<br><br>
        Each row is one tier, drawn as the label the game actually shows.
        Write what the tier is <em>for</em>; use the chips to say what should happen to it.</div>`;
      return;
    }
    const b = bucket(c.key);
    const tiers = (query && !c.key.toLowerCase().includes(query))
      ? c.tiers.filter(t => (t.tier + ' ' + t.en + ' ' + t.ch).toLowerCase().includes(query))
      : c.tiers;
    const leafNames = [];
    (function walk(list) {
      list.forEach(g => {
        if (g.separator !== undefined) return;
        g.leaves.forEach(lf => { if (lf.key === c.key) leafNames.push(nameOf(lf)); });
        walk(g.subgroups);
      });
    })(DATA.nav);

    el('sheet').innerHTML = `
      <div class="cathead">
        <h2>${esc(leafNames[0] || c.key)}</h2>
        <span class="chip">theme key: ${esc(c.key)}</span>
        ${c.live ? '' : '<span class="chip orphan">no tier definition - theme rows only</span>'}
        ${leafNames.length > 1 ? `<span class="chip warnc">${leafNames.length} nav entries share this ladder: ${esc(leafNames.join(' · '))}</span>` : ''}
        <span class="chip">${catDone(c)}/${c.tiers.length} reviewed</span>
      </div>
      <div class="files">${c.files.length ? c.files.map(esc).join('   ·   ') : 'no files use this theme key'}</div>
      <textarea class="catnote" id="catnote"
        placeholder="Notes on the whole ladder - e.g. &quot;make this 5 tiers instead of 4&quot;, &quot;T3 and T4 do the same job&quot;.">${esc(b._note || '')}</textarea>
      ${tiers.map(t => tierRow(c, t)).join('') || '<div class="empty">No tier matches the filter.</div>'}
      ${addedOf(c.key).map((n, i) => proposedRow(c, n, i)).join('')}
      <div class="addrow">
        <button class="btn sm" id="addTier">+ Propose a tier here</button>
        <span class="hint">for "this category needs one more tier" - describe it, no need to build it</span>
      </div>`;

    el('catnote').oninput = e => { b._note = e.target.value; save(); };
    el('addTier').onclick = () => {
      b._new = b._new || []; b._new.push({ n: '', d: '' }); save(); render();
    };
    [...document.querySelectorAll('[data-tier]')].forEach(node => {
      if (node.tagName === 'TEXTAREA') node.oninput = e => {
        const n = (b[node.dataset.tier] = b[node.dataset.tier] || {});
        n.d = e.target.value; save(); refreshProgress(); renderTree();
      };
    });
    [...document.querySelectorAll('.act')].forEach(btn => btn.onclick = () => {
      const n = (b[btn.dataset.tier] = b[btn.dataset.tier] || {});
      n.a = (n.a === btn.dataset.act) ? '' : btn.dataset.act;   // click again to clear
      save(); render();
    });
    [...document.querySelectorAll('[data-newtier]')].forEach(node => {
      const i = +node.dataset.newtier;
      if (node.classList.contains('np-name')) node.oninput = e => { b._new[i].n = e.target.value; save(); };
      else if (node.classList.contains('np-note')) node.oninput = e => { b._new[i].d = e.target.value; save(); refreshProgress(); };
      else if (node.classList.contains('np-del')) node.onclick = () => { b._new.splice(i, 1); save(); render(); };
    });
  }

  function tierRow(c, t) {
    const n = (store.notes[c.key] || {})[t.tier] || {};
    const s = t.style || {};
    const label = (lang === 'ch' ? (t.ch || t.en) : (t.en || t.ch)) || t.tier;
    const alt = lang === 'ch' ? t.en : t.ch;
    const fx = [
      s.PlayEffect ? `<span>beam ${esc(s.PlayEffect)}</span>` : '<span class="none">no beam</span>',
      s.MinimapIcon ? `<span>${esc(s.MinimapIcon)}</span>` : '<span class="none">no icon</span>',
      s.FontSize ? `<span>${s.FontSize}px</span>` : '',
      s.TextColor ? '' : '<span class="none">text: game decides</span>',
      s.PlayAlertSound ? '<span>sound</span>' : '',
    ].filter(Boolean).join('');

    return `<div class="tier ${t.hide ? 'hide' : ''}">
      <div class="lead">
        <div class="tkey"><b>${esc(t.tier)}</b>
          ${t.orphanRow ? '' : `<span title="the theme row this tier wears">wears ${esc(t.row)}</span>`}
          ${t.items ? `<span>${t.items} items</span>` : '<span style="opacity:.5">no mapped items</span>'}
          ${t.conds ? `<span class="live" title="matches by condition, not by a base list - it is live even with no mapped items">${t.conds} condition${t.conds > 1 ? 's' : ''}</span>` : ''}
          ${t.classCond ? '<span class="live" title="matches a whole item class">class rule</span>' : ''}
          ${t.rules ? `<span class="live" title="rules in base_mapping target this tier">${t.rules} rule${t.rules > 1 ? 's' : ''}</span>` : ''}
          ${(DATA.traced && !t.orphanRow && !t.hide) ? (t.emits
              ? `<span class="live" title="blocks this tier actually emits in the generated filter">emits ${t.emits}</span>`
              : '<span class="silent" title="this tier emits NO block in either mode - it cannot appear in game">SILENT</span>') : ''}
          ${t.hide ? '<span>HIDE</span>' : ''}
          ${(t.orphanRow && c.live) ? '<span style="color:var(--dead)" title="no tier resolves to this row, so this styling never appears in game">unused theme row</span>' : ''}
          ${(!t.orphanRow && !t.inTheme) ? '<span style="color:var(--warn)" title="the theme has no row at this number, so the block emits bare">no theme row</span>' : ''}
        </div>
        <div class="plateWrap">
          <div class="plate ${s.TextColor ? '' : 'nocolor'}" style="${plateStyle(s)}">${esc(label)}</div>
        </div>
        <div class="fx">${fx}</div>
        ${alt ? `<div class="tkey" style="opacity:.7">${esc(alt)}</div>` : ''}
      </div>
      <div class="edit">
        <textarea data-tier="${esc(t.tier)}" placeholder="What is this tier FOR? What should it look like, and why?">${esc(n.d || '')}</textarea>
        <div class="actions">${ACTIONS.map(a =>
          `<button class="act" data-tier="${esc(t.tier)}" data-act="${a}" aria-pressed="${n.a === a}">${a}</button>`).join('')}</div>
      </div>
    </div>`;
  }

  function proposedRow(c, n, i) {
    return `<div class="tier proposed">
      <div class="lead">
        <div class="tkey"><b style="color:var(--accent)">proposed tier</b></div>
        <input class="form np-name" data-newtier="${i}" style="width:100%"
               placeholder="Working name, e.g. &quot;T2 Chase&quot;" value="${esc(n.n || '')}">
      </div>
      <div class="edit">
        <textarea class="np-note" data-newtier="${i}"
          placeholder="What goes in it, where it sits in the ladder, and how it should differ from its neighbours.">${esc(n.d || '')}</textarea>
        <div class="actions"><button class="link np-del" data-newtier="${i}">Remove</button></div>
      </div>
    </div>`;
  }

  function refreshProgress() {
    let done = 0, tot = 0;
    DATA.categories.forEach(c => { tot += c.tiers.length; done += catDone(c); });
    el('pct').textContent = `${done} / ${tot}`;
    el('meterfill').style.width = tot ? (done / tot * 100).toFixed(1) + '%' : '0';
  }

  function render() { renderTree(); renderSheet(); refreshProgress(); }

  el('q').oninput = e => { query = e.target.value.trim().toLowerCase(); render(); };
  const setLang = (l) => {
    lang = l; localStorage.setItem('sharket-tier-review-lang', l);
    el('langCh').setAttribute('aria-pressed', String(l === 'ch'));
    el('langEn').setAttribute('aria-pressed', String(l === 'en'));
    render();
  };
  el('langCh').onclick = () => setLang('ch');
  el('langEn').onclick = () => setLang('en');

  // Export shows the JSON on screen to copy. The old version only did a Blob +
  // <a download>, which this page's sandbox blocks SILENTLY - the button appeared dead
  // and there was no way to get the review out. A visible textarea cannot be blocked;
  // the download is attempted too, but only as a bonus.
  el('exportBtn').onclick = () => {
    const out = { format: 'sharket-tier-review', version: 2,
                  exported: new Date().toISOString(),
                  notes: store.notes, newCategories: store.newCats };
    const text = JSON.stringify(out, null, 2);
    const noteCount = Object.values(store.notes).reduce((n, cat) =>
      n + Object.keys(cat).filter(k => k !== '_new').length, 0);

    el('exportText').value = text;
    el('exportCount').textContent =
      `${noteCount} annotated entr${noteCount === 1 ? 'y' : 'ies'} · ${(text.length / 1024).toFixed(1)} KB`;
    el('exportOverlay').style.display = 'flex';
    const ta = el('exportText');
    ta.focus(); ta.select();

    try {   // best effort - blocked in some sandboxes, which is exactly why the box exists
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tier-review.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {}
  };
  el('exportClose').onclick = () => { el('exportOverlay').style.display = 'none'; };
  el('exportOverlay').onclick = e => {
    if (e.target === el('exportOverlay')) el('exportOverlay').style.display = 'none';
  };
  el('exportCopy').onclick = async () => {
    const ta = el('exportText');
    ta.focus(); ta.select();
    let ok = false;
    try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (e) {
      try { ok = document.execCommand('copy'); } catch (e2) {}
    }
    el('exportCopy').textContent = ok ? '✓ Copied' : 'Press Ctrl+C';
    setTimeout(() => { el('exportCopy').textContent = 'Copy'; }, 2500);
  };
  el('importBtn').onclick = () => el('importFile').click();
  el('importFile').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const doc = JSON.parse(r.result);
        store = { notes: doc.notes || doc, newCats: doc.newCategories || [] };
        save(); render();
      } catch (err) { alert('That file is not a tier-review export: ' + err.message); }
    };
    r.readAsText(f);
  };

  el('counts').textContent =
    `${DATA.totals.tiers} tiers · ${DATA.totals.live} live categories · ${DATA.totals.categories - DATA.totals.live} theme-only`
    + (DATA.totals.silent ? ` · ${DATA.totals.silent} silent` : '');
  setLang(lang);
})();
</script>
"""

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(HTML.replace('__DATA__', payload))
print('wrote', OUT, os.path.getsize(OUT), 'bytes')
