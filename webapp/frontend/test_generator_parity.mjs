// Parity test: the Python generator (filter_generation/generate.py) vs the
// TypeScript generator (src/utils/filterGenerator.ts) that actually ships and
// runs in every visitor's browser. The project keeps generation logic in BOTH
// languages — Python is the local-dev / reference / oracle, TS is the deployed
// engine — and nothing else proves they agree. This test does: feed both the
// SAME baked data and assert they emit the same filter text.
//
// Coverage:
//   1. STANDARD mode, Soft strictness baseline — byte-for-byte agreement on the
//      real data (this is today's shipped output).
//   2. Strictness gate (`hide_at_strictness`) — a SYNTHETIC gate is injected on
//      one tier and we assert both generators flip it identically: Hidden at/above
//      the threshold, untouched below it. ("Mechanism only" — no real tier carries
//      a gate yet, so this synthetic check is what guards the new axis.)
//   Ruthless parity (Minimal / excluded_modes content) stays out of scope until
//   the "webapp usable for Ruthless" milestone ports those to TS.
//
// Run this whenever generate.py or filterGenerator.ts changes.
// Usage (from webapp/frontend):  node test_generator_parity.mjs
//   Needs Python on PATH. Re-bakes demo_data (untracked) and restores the tracked
//   filter_generation/complete_filter.filter + the tier file it briefly patches.

import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));            // webapp/frontend
const ROOT = join(HERE, '..', '..');                            // project root
const PY = process.env.PYTHON || 'python';
const OUTPUT_FILTER = join(ROOT, 'filter_generation', 'complete_filter.filter');
// Tier briefly patched with a synthetic gate (restored to exact bytes after).
const GATE_FILE = join(ROOT, 'filter_generation', 'data', 'tier_definition', 'Currency', 'General.json');
const GATE_CAT = 'General', GATE_TIER = 'Tier 5 General', GATE_LEVEL = 3; // 3 = 'strict'

// How many meaningful diffs to print in full before summarising.
const SHOW = 40;

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const norm = (s) => s.replace(/\r\n/g, '\n');

// ── 1. Bake fresh data so both generators read identical inputs ──────────────
// create_demo_bundle.py writes webapp/frontend/public/demo_data/** (untracked)
// from the same filter_generation/data/** that generate.py reads directly.
console.log('Baking demo bundle (create_demo_bundle.py)…');
sh(`${PY} filter_generation/create_demo_bundle.py`);

// ── 2. Bundle the TS generator + client data layer for Node ──────────────────
// Reuse the axios + localStorage stub harness from test_parity.mjs so the
// theme/override merge is byte-identical to production.
const tmp = mkdtempSync(join(tmpdir(), 'genparity-'));
const axiosStub = join(tmp, 'axios.js');
writeFileSync(axiosStub, `
import { readFileSync } from 'fs';
import { join } from 'path';
const PUB = ${JSON.stringify(join(HERE, 'public'))};
export default {
  get: async (url) => {
    const rel = url.replace(/^\\//, '');
    return { data: JSON.parse(readFileSync(join(PUB, rel), 'utf-8')) };
  },
};
`);

const sharedOpts = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  alias: { axios: axiosStub },
  define: { 'import.meta.env.BASE_URL': '"/"' },
  banner: { js: `
const __store = new Map();
globalThis.localStorage = {
  getItem: (k) => __store.has(k) ? __store.get(k) : null,
  setItem: (k, v) => __store.set(k, String(v)),
  removeItem: (k) => __store.delete(k),
  get length() { return __store.size; },
  key: (i) => [...__store.keys()][i] ?? null,
};
const __origKeys = Object.keys;
Object.keys = (o) => (o === globalThis.localStorage ? [...__store.keys()] : __origKeys(o));
` },
};

const clientOut = join(tmp, 'clientData.mjs');
const genOut = join(tmp, 'filterGenerator.mjs');
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/services/clientData.ts')], outfile: clientOut });
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/utils/filterGenerator.ts')], outfile: genOut });

const client = await import(pathToFileURL(clientOut).href);
const { generateFilter } = await import(pathToFileURL(genOut).href);

// ── 3. Build the SAME GeneratorData the deployed path builds (once) ──────────
const merged = await client.getMergedState();
const bundle = await client.loadBundle();
const baseGenData = {
  themeData: await client.getMergedTheme(),
  soundMap: await client.getSoundMap(),
  allMappings: merged.mappings,
  allTierDefinitions: merged.tiers,
  language: 'ch',
  footer: bundle?.footer || '',
};

// Run the TS generator at a strictness over a given tier set; silence its
// internal auto-sound debug logging. `leveling` = optional Campaign selection.
const runTs = (tiers, strictness, leveling) => {
  const real = console.log; console.log = () => {};
  try { return norm(generateFilter({ ...baseGenData, allTierDefinitions: tiers, strictness, leveling_selection: leveling })); }
  finally { console.log = real; }
};
// Run the Python generator at a strictness; reads + returns the tracked output.
// A leveling selection is passed via a temp @file to dodge shell JSON-quoting.
const runPy = (strictness, leveling) => {
  let arg = '';
  if (leveling) {
    const selFile = join(tmp, 'lvsel.json');
    writeFileSync(selFile, JSON.stringify(leveling));
    arg = ` --leveling-selection "@${selFile}"`;
  }
  sh(`${PY} filter_generation/generate.py --mode standard --game-version poe1 --strictness ${strictness}${arg}`);
  return norm(readFileSync(OUTPUT_FILTER, 'utf8'));
};
// Inject a gate into a deep-cloned copy of the matching tier-def entry (TS side).
const injectGate = (tiers, relMatch, cat, tier, level) => {
  for (const [k, content] of Object.entries(tiers)) {
    if (k.includes(relMatch) && content?.[cat]?.[tier]) {
      const clone = JSON.parse(JSON.stringify(content));
      clone[cat][tier].hide_at_strictness = level;
      return { ...tiers, [k]: clone };
    }
  }
  throw new Error(`injectGate: target not found (${relMatch} ${cat}/${tier})`);
};
const hideCount = (text) => (text.match(/^Hide\b/gm) || []).length;

// ── 4. LCS alignment diff (alignment-aware, not positional) ──────────────────
function lcsDiff(a, b) {
  const n = a.length, m = b.length;
  const L = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = i * (m + 1), next = (i + 1) * (m + 1);
    for (let j = m - 1; j >= 0; j--) {
      L[row + j] = a[i] === b[j] ? L[next + j + 1] + 1 : Math.max(L[next + j], L[row + j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: 'eq', s: a[i] }); i++; j++; }
    else if (L[(i + 1) * (m + 1) + j] >= L[i * (m + 1) + j + 1]) { ops.push({ t: 'del', s: a[i] }); i++; }
    else { ops.push({ t: 'ins', s: b[j] }); j++; }
  }
  while (i < n) ops.push({ t: 'del', s: a[i++] });
  while (j < m) ops.push({ t: 'ins', s: b[j++] });
  return ops;
}

const results = [];
const check = (label, cond) => { results.push(cond); console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}`); return cond; };

// Compare two filter texts line-by-line (Python = reference, TS = shipping).
const compare = (label, pyText, tsText) => {
  const pa = pyText.replace(/\s+$/g, '').split('\n');
  const ta = tsText.replace(/\s+$/g, '').split('\n');
  const ops = lcsDiff(pa, ta);
  const del = ops.filter(o => o.t === 'del').length;
  const ins = ops.filter(o => o.t === 'ins').length;
  const ok = del + ins === 0;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}  (Py ${pa.length}L, TS ${ta.length}L, diff ${del + ins})`);
  if (!ok) {
    const hunks = [];
    let cur = null;
    for (const o of ops) {
      if (o.t === 'eq') { if (cur) { hunks.push(cur); cur = null; } continue; }
      if (!cur) cur = { del: [], ins: [] };
      if (o.t === 'del') cur.del.push(o.s); else cur.ins.push(o.s);
    }
    if (cur) hunks.push(cur);
    console.log(`    ${hunks.length} divergent hunks. First ${Math.min(SHOW, hunks.length)}:`);
    for (const h of hunks.slice(0, SHOW)) {
      console.log('    ---');
      for (const s of h.del.slice(0, 6)) console.log(`    PY- ${JSON.stringify(s)}`);
      if (h.del.length > 6) console.log(`    PY-  …+${h.del.length - 6}`);
      for (const s of h.ins.slice(0, 6)) console.log(`    TS+ ${JSON.stringify(s)}`);
      if (h.ins.length > 6) console.log(`    TS+  …+${h.ins.length - 6}`);
    }
  }
  results.push(ok);
  return ok;
};

// ── 5. Run the cases ─────────────────────────────────────────────────────────
const filterBackup = existsSync(OUTPUT_FILTER) ? readFileSync(OUTPUT_FILTER) : null;
try {
  // Case A — Soft baseline (today's shipped output): both must agree exactly.
  console.log('\n[A] Soft baseline parity (standard mode):');
  const pySoft = runPy('soft');
  const tsSoft = runTs(merged.tiers, 'soft');
  compare('soft: Python vs TS', pySoft, tsSoft);

  // Synthetic gate: Currency/General → "Tier 5 General" hides at 'strict' (idx 3).
  // Patch disk for Python; restore exact bytes afterwards.
  console.log(`\n[B/C] Synthetic gate ${GATE_CAT}/${GATE_TIER} hide_at_strictness=${GATE_LEVEL}:`);
  const gateBackup = readFileSync(GATE_FILE);
  let pyStrict, pySemi;
  try {
    const obj = JSON.parse(gateBackup.toString('utf8'));
    obj[GATE_CAT][GATE_TIER].hide_at_strictness = GATE_LEVEL;
    writeFileSync(GATE_FILE, JSON.stringify(obj, null, 2));
    pyStrict = runPy('strict');       // idx 3 >= 3 → fires
    pySemi = runPy('semistrict');     // idx 2 <  3 → inert
  } finally {
    writeFileSync(GATE_FILE, gateBackup); // leave the tree pristine
  }
  const gatedTiers = injectGate(merged.tiers, 'Currency/General', GATE_CAT, GATE_TIER, GATE_LEVEL);
  const tsStrict = runTs(gatedTiers, 'strict');
  const tsSemi = runTs(gatedTiers, 'semistrict');

  // Case B — at/above threshold: parity holds AND the gate actually fired (output
  // changed vs baseline, with strictly more Hide blocks). Guards a vacuous pass.
  compare('strict: Python vs TS', pyStrict, tsStrict);
  check('strict: gate changed Python output vs baseline', pyStrict !== pySoft);
  check('strict: gate flipped Show→Hide (more Hide lines)',
        hideCount(pyStrict) > hideCount(pySoft) && hideCount(tsStrict) > hideCount(tsSoft));

  // Case C — below threshold: parity holds AND the gate is inert (== baseline),
  // proving the threshold comparison is correct and identical on both sides.
  compare('semistrict: Python vs TS', pySemi, tsSemi);
  check('semistrict (idx2 < gate3): inert, == baseline on both sides',
        pySemi === pySoft && tsSemi === tsSoft);

  // Case D/E/F — Campaign module (selection-centric ladder). D: an explicit
  // empty selection must equal the absent-selection baseline (nothing picked =
  // just the always-on campaign categories + T3 net). E: picking groups ADDS
  // their T1 band layer + T2 class-wide rare layer identically on both sides.
  // F: hide_unselected flips unpicked weapon groups to Hide AND emits the
  // 'aggressive' declutter tiers identically.
  console.log('\n[D/E/F] Campaign module (selection-centric ladder):');
  const emptySel = { weapons: [], armour_defense: [], hide_unselected: false };
  const pyEmpty = runPy('soft', emptySel);
  const tsEmpty = runTs(merged.tiers, 'soft', emptySel);
  compare('empty selection: Python vs TS', pyEmpty, tsEmpty);
  check('empty selection == absent selection (baseline default)',
        pyEmpty === pySoft && tsEmpty === tsSoft);

  const pickSel = { weapons: ['Bows'], armour_defense: ['Evasion'], hide_unselected: false };
  const pyPick = runPy('soft', pickSel);
  const tsPick = runTs(merged.tiers, 'soft', pickSel);
  compare('pick (Bows + Evasion): Python vs TS', pyPick, tsPick);
  // Block displays are localized (output lang = ch); the Bows layer's zh name
  // starts with 弓 and appears only when Bows is picked. Match the class prefix
  // to stay robust against zh-name tuning.
  check('pick ADDED layers (more lines; Bows layer only when picked)',
        pyPick.split('\n').length > pySoft.split('\n').length &&
        /弓高亮/.test(pyPick) && !/弓高亮/.test(pySoft));

  const aggroSel = { weapons: ['Bows'], armour_defense: [], hide_unselected: true };
  const pyAggro = runPy('soft', aggroSel);
  const tsAggro = runTs(merged.tiers, 'soft', aggroSel);
  compare('hide_unselected declutter: Python vs TS', pyAggro, tsAggro);
  check('declutter fired (more Hide blocks than baseline)',
        hideCount(pyAggro) > hideCount(pySoft) && hideCount(tsAggro) > hideCount(tsSoft));
} finally {
  if (filterBackup) writeFileSync(OUTPUT_FILTER, filterBackup);
  rmSync(tmp, { recursive: true, force: true });
}

const ok = results.every(Boolean);
console.log(`\n${ok ? 'PASS' : 'FAIL'}: ${results.filter(Boolean).length}/${results.length} checks (standard mode + strictness gate + leveling gate).`);
process.exit(ok ? 0 : 1);
