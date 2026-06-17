// Parity test: the Python generator (filter_generation/generate.py) vs the
// TypeScript generator (src/utils/filterGenerator.ts) that actually ships and
// runs in every visitor's browser. The project keeps generation logic in BOTH
// languages — Python is the local-dev / reference / oracle, TS is the deployed
// engine — and nothing else proves they agree. This test does: feed both the
// SAME baked data and assert they emit the same filter text.
//
// Scope: STANDARD mode only. The deployed site calls the TS generator with no
// game-mode (demoAdapter.ts), i.e. it is effectively `generate.py --mode
// standard`. Ruthless parity (Minimal / excluded_modes) is deliberately out of
// scope until the "webapp usable for Ruthless" milestone ports those to TS.
//
// Run this whenever generate.py or filterGenerator.ts changes.
// Usage (from webapp/frontend):  node test_generator_parity.mjs
//   Needs Python on PATH. Re-bakes demo_data (untracked) and restores the
//   tracked filter_generation/complete_filter.filter afterwards.

import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));            // webapp/frontend
const ROOT = join(HERE, '..', '..');                            // project root
const PY = process.env.PYTHON || 'python';
const OUTPUT_FILTER = join(ROOT, 'filter_generation', 'complete_filter.filter');

// How many meaningful diffs to print in full before summarising.
const SHOW = 40;

const sh = (cmd) => execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

// ── 1. Bake fresh data so both generators read identical inputs ──────────────
// create_demo_bundle.py writes webapp/frontend/public/demo_data/** (untracked)
// from the same filter_generation/data/** that generate.py reads directly.
console.log('Baking demo bundle (create_demo_bundle.py)…');
sh(`${PY} filter_generation/create_demo_bundle.py`);

// ── 2. Run the Python generator (standard mode) and capture its output ───────
// generate.py writes the tracked complete_filter.filter; back it up + restore.
console.log('Running Python generator (generate.py --mode standard)…');
const backup = existsSync(OUTPUT_FILTER) ? readFileSync(OUTPUT_FILTER) : null;
let pyText;
try {
  sh(`${PY} filter_generation/generate.py --mode standard --game-version poe1`);
  pyText = readFileSync(OUTPUT_FILTER, 'utf8').replace(/\r\n/g, '\n');
} finally {
  if (backup) writeFileSync(OUTPUT_FILTER, backup);  // leave the tree clean
}

// ── 3. Bundle the TS generator + client data layer for Node ──────────────────
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

// ── 4. Build the SAME GeneratorData the deployed path builds, then generate ──
console.log('Running TS generator (filterGenerator.ts)…');
const merged = await client.getMergedState();
const bundle = await client.loadBundle();
const genData = {
  themeData: await client.getMergedTheme(),
  soundMap: await client.getSoundMap(),
  allMappings: merged.mappings,
  allTierDefinitions: merged.tiers,
  language: 'ch',
  footer: bundle?.footer || '',
};
// silence the generator's internal auto-sound debug logging
const realLog = console.log;
console.log = () => {};
const tsText = generateFilter(genData).replace(/\r\n/g, '\n');
console.log = realLog;

rmSync(tmp, { recursive: true, force: true });

// ── 5. Alignment-aware diff (LCS) ────────────────────────────────────────────
// A naive positional compare massively over-counts: one block emitted by Python
// but skipped by TS shifts every later line, so all of them "differ". An LCS
// alignment instead reports the REAL inserted/deleted lines, which is what we
// need to triage genuine divergence.
const pa = pyText.replace(/\s+$/g, '').split('\n');   // PY (reference)
const ta = tsText.replace(/\s+$/g, '').split('\n');   // TS (shipping)

function lcsDiff(a, b) {
  const n = a.length, m = b.length;
  // L[(i)*(m+1)+j]; Uint16 is safe (line counts < 65535).
  const L = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = i * (m + 1), next = (i + 1) * (m + 1);
    for (let j = m - 1; j >= 0; j--) {
      L[row + j] = a[i] === b[j]
        ? L[next + j + 1] + 1
        : Math.max(L[next + j], L[row + j + 1]);
    }
  }
  const ops = [];           // {t:'eq'|'del'|'ins', s:string}
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

const ops = lcsDiff(pa, ta);
const eq = ops.filter(o => o.t === 'eq').length;
const del = ops.filter(o => o.t === 'del').length;   // in Python, missing from TS
const ins = ops.filter(o => o.t === 'ins').length;   // in TS, not in Python
const denom = Math.max(pa.length, ta.length);

console.log('');
console.log(`Python lines: ${pa.length}   TS lines: ${ta.length}`);
console.log(`Aligned (LCS) matching: ${eq}/${denom} (${((eq / denom) * 100).toFixed(2)}%)`);
console.log(`Only-in-Python (del): ${del}    Only-in-TS (ins): ${ins}    total real diff lines: ${del + ins}`);

// group consecutive non-eq ops into hunks for readable triage
const hunks = [];
let cur = null;
for (const o of ops) {
  if (o.t === 'eq') { if (cur) { hunks.push(cur); cur = null; } continue; }
  if (!cur) cur = { del: [], ins: [] };
  if (o.t === 'del') cur.del.push(o.s); else cur.ins.push(o.s);
}
if (cur) hunks.push(cur);

console.log(`\n${hunks.length} divergent hunks. First ${Math.min(SHOW, hunks.length)}:`);
for (const h of hunks.slice(0, SHOW)) {
  console.log('  ---');
  for (const s of h.del.slice(0, 6)) console.log(`  PY- ${JSON.stringify(s)}`);
  if (h.del.length > 6) console.log(`  PY-  …+${h.del.length - 6}`);
  for (const s of h.ins.slice(0, 6)) console.log(`  TS+ ${JSON.stringify(s)}`);
  if (h.ins.length > 6) console.log(`  TS+  …+${h.ins.length - 6}`);
}
if (hunks.length > SHOW) console.log(`  … +${hunks.length - SHOW} more hunks`);

// signature summary: first token of each changed line, split del vs ins
const sig = (s) => {
  const tok = (s || '').trim().split(/\s+/)[0] || '(blank)';
  if (tok.startsWith('#==[')) return '#==[…]header';
  if (tok.startsWith('#====')) return '#=== banner';
  return tok;
};
const counts = {};
for (const o of ops) {
  if (o.t === 'eq') continue;
  const k = `${o.t === 'del' ? 'PY-only' : 'TS-only'}  ${sig(o.s)}`;
  counts[k] = (counts[k] || 0) + 1;
}
console.log('\nDivergence signatures (side + first-token : count):');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 30)) {
  console.log(`  ${String(v).padStart(5)}  ${k}`);
}

const ok = del + ins === 0;
console.log(`\n${ok ? 'PASS' : 'FAIL'}: generators ${ok ? 'agree' : 'diverge'} (standard mode).`);
process.exit(ok ? 0 : 1);
