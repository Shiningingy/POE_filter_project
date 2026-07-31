// Resolver equivalence: the editor PREVIEW must emit the same style lines the
// exported filter does, for every tier block.
//
// This is the invariant workstream A exists to create. The project had four style
// resolvers — generate.py and filterGenerator.ts (the parity-guarded pair),
// styleResolver.ts (the editor preview + Inspector raw text) and
// simulatorEngine.ts (the drop simulator). The last two were unguarded and both
// diverged, so the editor showed styling the export threw away and authoring felt
// like it worked when it did not. Parity between the two GENERATORS never caught
// that, because the preview was never one of the two.
//
// The oracle is a FRESH trace from the Python generator — what it actually
// emitted, block by block (generate.py --trace). Two things matter about that
// choice:
//
//   * it is real emitted filter text, not a second call into the code under
//     test. Now that the preview and the generator share filterStyle.ts,
//     comparing them directly would be tautological; Python is an independent
//     implementation, so this genuinely cross-checks.
//   * it is captured per run, not read from filter_generation/traces/. Those
//     committed traces are the pre-rewrite MIGRATION EVIDENCE and must stay
//     frozen; an oracle that has to be refreshed whenever output legitimately
//     changes would either rot or destroy that evidence.
//
// Usage (from webapp/frontend):  node test_resolver_equivalence.mjs
//   Needs Python on PATH (override with PYTHON=...).

import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PY = process.env.PYTHON || 'python';
const SHOW = 10;

const tmp = mkdtempSync(join(tmpdir(), 'resolvereq-'));

// Capture the oracle first: what Python emits, right now, from the data on disk.
// generate.py also rewrites filter_generation/complete_filter.filter, so restore
// its exact bytes afterwards (same courtesy the parity test extends).
const TRACE = join(tmp, 'trace.json');
const OUTPUT_FILTER = join(ROOT, 'filter_generation', 'complete_filter.filter');
const filterBackup = existsSync(OUTPUT_FILTER) ? readFileSync(OUTPUT_FILTER) : null;
try {
  execSync(`${PY} filter_generation/generate.py --mode standard --strictness soft --trace "${TRACE}"`,
           { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
} catch (err) {
  console.error('\nTRACE CAPTURE FAILED — generate.py did not exit cleanly.');
  if (err.stdout?.length) console.error(err.stdout.toString());
  if (err.stderr?.length) console.error(err.stderr.toString());
  process.exit(1);
} finally {
  if (filterBackup) writeFileSync(OUTPUT_FILTER, filterBackup);
}
if (!existsSync(TRACE)) {
  console.error('\nTRACE CAPTURE FAILED — generate.py exited 0 but wrote no trace.');
  process.exit(1);
}

const axiosStub = join(tmp, 'axios.js');
writeFileSync(axiosStub, `
import { readFileSync } from 'fs';
import { join } from 'path';
const PUB = ${JSON.stringify(join(HERE, 'public'))};
export default { get: async (url) => ({ data: JSON.parse(readFileSync(join(PUB, url.replace(/^\\//, '')), 'utf-8')) }) };
`);

const sharedOpts = {
  bundle: true, format: 'esm', platform: 'node',
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
const styleOut = join(tmp, 'styleResolver.mjs');
const coreOut = join(tmp, 'filterStyle.mjs');
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/services/clientData.ts')], outfile: clientOut });
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/utils/styleResolver.ts')], outfile: styleOut });
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/utils/filterStyle.ts')], outfile: coreOut });

const client = await import(pathToFileURL(clientOut).href);
const { resolveStyle } = await import(pathToFileURL(styleOut).href);
const { styleLines, soundLineFromPair } = await import(pathToFileURL(coreOut).href);

const merged = await client.getMergedState();
const themeData = await client.getMergedTheme();
const soundMap = await client.getSoundMap();

const trace = JSON.parse(readFileSync(TRACE, 'utf8'));

// The style half of an emitted block: everything the game treats as appearance.
const STYLE_RE = /^\s{4}(SetFontSize|SetTextColor|SetBorderColor|SetBackgroundColor|PlayEffect|MinimapIcon|PlayAlertSound|CustomAlertSound)\b/;
const styleOf = (text) => text.split('\n').filter((l) => STYLE_RE.test(l));

let checked = 0, mismatches = [];

for (const block of trace.blocks) {
  // Only the tier's OWN base block: a rule block's style is the rule's
  // deviation, which the preview renders through a different entry point
  // (_generateBlock) and is covered by the Inspector, not by resolveStyle.
  if (block.source !== 'tier_base' || block.is_hide) continue;

  const tierDoc = merged.tiers[block.file];
  if (!tierDoc) continue;
  const categoryKey = Object.keys(tierDoc).find((k) => !k.startsWith('//'));
  const tierData = tierDoc?.[categoryKey]?.[block.tier_key];
  if (!tierData) continue;

  const themeCategory = tierDoc[categoryKey]?._meta?.theme_category || categoryKey;

  const style = resolveStyle(tierData, themeData, themeCategory, soundMap, block.tier_key);
  const previewLines = styleLines(style, {}, soundLineFromPair(style.PlayAlertSound));

  const exportLines = styleOf(block.text);
  checked++;
  if (previewLines.join('\n') !== exportLines.join('\n')) {
    mismatches.push({ block, previewLines, exportLines });
  }
}

console.log(`Compared ${checked} tier base blocks (editor preview vs recorded filter output).`);
if (mismatches.length) {
  console.log(`\nFAIL: ${mismatches.length} blocks diverge. First ${Math.min(SHOW, mismatches.length)}:`);
  for (const m of mismatches.slice(0, SHOW)) {
    console.log(`\n  [${m.block.order}] ${m.block.file} :: ${m.block.tier_key}`);
    for (const l of m.exportLines) console.log(`    EXPORT- ${JSON.stringify(l)}`);
    for (const l of m.previewLines) console.log(`    PREVIEW+ ${JSON.stringify(l)}`);
  }
}
rmSync(tmp, { recursive: true, force: true });

const ok = mismatches.length === 0 && checked > 0;
console.log(`\n${ok ? 'PASS' : 'FAIL'}: ${checked - mismatches.length}/${checked} tier blocks agree.`);
process.exit(ok ? 0 : 1);
