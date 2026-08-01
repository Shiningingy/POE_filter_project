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
// The oracle is the real emitted filter text, block by block, captured live from
// the shipping generator through its `onBlock` hook. It used to come from
// `generate.py --trace`; ADR-0007 retired that generator, and the hook is what
// replaced the capability.
//
// ⚠️ Be honest about what this proves now. Python was an INDEPENDENT
// implementation, so the comparison genuinely cross-checked two engines. Today
// both sides call filterStyle.ts, so this can no longer catch a bug INSIDE the
// style core — test_generator_fixtures.mjs is what pins that, against committed
// expected output.
//
// What it still proves is the thing that actually broke: preview and export must
// feed the core the SAME arguments. Every divergence workstream A found was of
// that kind — styleResolver resolved a different theme category, parsed the tier
// number differently, and carried a "Fragments" → "Map Fragments" special case
// the generator did not have. None of those live in the shared core, and all of
// them are still caught here.
//
// The committed traces under filter_generation/traces/ are deliberately NOT used:
// they are frozen pre-rewrite migration evidence, and an oracle that must be
// refreshed whenever output legitimately changes would either rot or destroy them.
//
// Usage (from webapp/frontend):  node test_resolver_equivalence.mjs   (no Python)

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOW = 10;

const tmp = mkdtempSync(join(tmpdir(), 'resolvereq-'));

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
const genOut = join(tmp, 'filterGenerator.mjs');
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/services/clientData.ts')], outfile: clientOut });
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/utils/styleResolver.ts')], outfile: styleOut });
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/utils/filterStyle.ts')], outfile: coreOut });
await build({ ...sharedOpts, entryPoints: [join(HERE, 'src/utils/filterGenerator.ts')], outfile: genOut });

const client = await import(pathToFileURL(clientOut).href);
const { resolveStyle } = await import(pathToFileURL(styleOut).href);
const { styleLines, soundLineFromPair } = await import(pathToFileURL(coreOut).href);
const { generateFilter } = await import(pathToFileURL(genOut).href);

const merged = await client.getMergedState();
const themeData = await client.getMergedTheme();
const soundMap = await client.getSoundMap();

// Capture the oracle: every block the generator actually emitted, via onBlock.
// Same configuration generate.py --trace used (standard / soft / ch), so the
// comparison set is unchanged from when Python supplied it.
const bundle = await client.loadBundle();
const blocks = [];
{
  const realLog = console.log; console.log = () => {};   // the generator is chatty
  try {
    generateFilter({
      themeData, soundMap,
      allMappings: merged.mappings,
      allTierDefinitions: merged.tiers,
      language: 'ch',
      footer: bundle?.footer || '',
      strictness: 'soft',
      mode: 'standard',
      onBlock: (rec) => blocks.push(rec),
    });
  } finally { console.log = realLog; }
}
if (blocks.length === 0) {
  console.error('\nORACLE CAPTURE FAILED — generateFilter emitted no blocks. Either the data ' +
                'tree is empty or the onBlock hook was dropped from filterGenerator.ts.');
  process.exit(1);
}
const trace = { blocks };

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
