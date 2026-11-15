// Category document: can a load-then-save lose a category's rules?
//
// A category is two files on disk: the tier file holds the tiers, the mapping file holds
// the items AND the authored rules. The editor edits one document, the tier file with the
// mapping's rules merged in (utils/categoryDoc.ts), and saving splits it back. The
// mapping is written WHOLE (POST /api/config is a whole-document write), so whatever
// `rules` the split hands it replaces what is on disk.
//
// The bug this pins: the Visibility Overview's reload handed the editor the bare tier
// file, with no `rules` key, and the next auto-save turned "no key" into `rules: []`,
// wiping every rule in the category. Only git could bring them back.
//
// Venue: node, pure functions, plus a round trip over every real tier/mapping pair in
// filter_generation/data. It does not drive the React component; the reload wiring in
// EditorView needs a manual check in the browser.
//
// Usage (from webapp/frontend):  node test_category_doc.mjs

import { build } from 'esbuild';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '../../filter_generation/data');
const tmp = mkdtempSync(join(tmpdir(), 'catdoc-'));
let failed = 0, passed = 0;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`); }
};
// What the mapping file holds after a save: the split's mapping, or the old file when
// the split writes nothing to it.
const mappingAfterSave = (out, before) => (out && out.mapping) ?? before;

const walk = (dir, acc = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (f.endsWith('.json')) acc.push(p);
  }
  return acc;
};

try {
  const out = join(tmp, 'categoryDoc.mjs');
  await build({
    bundle: true, format: 'esm', platform: 'node',
    entryPoints: [join(HERE, 'src/utils/categoryDoc.ts')], outfile: out, logLevel: 'silent',
  });
  const { mergeCategoryDoc, splitCategoryDoc } = await import(pathToFileURL(out).href);

  const tier = {
    '//': 'comment',
    Rings: {
      _meta: { theme_category: 'Rings', tier_order: ['Tier 1 Rings', 'Tier 2 Rings'] },
      'Tier 1 Rings': { theme: { Tier: 1 } },
      'Tier 2 Rings': { theme: { Tier: 2 }, hide_at_strictness: 3 },
    },
  };
  const rules = [
    { targets: ['Vermillion Ring'], overrides: { Tier: 'Tier 1 Rings' } },
    { targets: [], conditions: { ItemLevel: '>= 86' }, overrides: { Tier: 'Tier 1 Rings' } },
  ];
  const mapping = { _meta: { item_class: 'Rings' }, mapping: { 'Iron Ring': 'Tier 2 Rings' }, rules };
  const noRulesMapping = { _meta: { item_class: 'Rings' }, mapping: { 'Iron Ring': 'Tier 2 Rings' } };

  console.log('round trip');
  {
    const tierBefore = JSON.stringify(tier), mapBefore = JSON.stringify(mapping);
    const s = splitCategoryDoc(mergeCategoryDoc(tier, mapping), mapping);
    check('split(merge(tier, mapping)) gives the tier file back', same(s?.tier, tier),
      `got ${JSON.stringify(s?.tier)}`);
    check('split(merge(tier, mapping)) gives the mapping file back', same(mappingAfterSave(s, mapping), mapping),
      `got ${JSON.stringify(mappingAfterSave(s, mapping))}`);
    check('neither helper mutates its inputs',
      JSON.stringify(tier) === tierBefore && JSON.stringify(mapping) === mapBefore);
  }
  {
    const s = splitCategoryDoc(mergeCategoryDoc(tier, noRulesMapping), noRulesMapping);
    const after = mappingAfterSave(s, noRulesMapping);
    check('a mapping with no rules key is written back without inventing `rules: []`',
      same(after, noRulesMapping), `got ${JSON.stringify(after)}`);
  }

  console.log('a document with no rules key (the Visibility Overview reload at 403ebee)');
  {
    // At 403ebee EditorView's onApplied set the editor document to the bare tier file.
    const reloaded = JSON.parse(JSON.stringify(tier));
    const s = splitCategoryDoc(reloaded, mapping);
    const after = mappingAfterSave(s, mapping);
    check(`the mapping keeps its ${rules.length} rules`, same(after.rules, rules),
      `mapping.rules after save = ${JSON.stringify(after.rules)}`);
  }

  console.log('deleting every rule still saves');
  {
    const doc = mergeCategoryDoc(tier, mapping);
    doc.Rings.rules = [];
    const after = mappingAfterSave(splitCategoryDoc(doc, mapping), mapping);
    check('an explicit `rules: []` in the document is written to the mapping', same(after.rules, []),
      `mapping.rules after save = ${JSON.stringify(after.rules)}`);
  }

  console.log('every real tier/mapping pair in filter_generation/data');
  {
    const tierRoot = join(DATA, 'tier_definition'), mapRoot = join(DATA, 'base_mapping');
    let pairs = 0, withRules = 0;
    const broken = [];
    for (const tp of walk(tierRoot)) {
      const rel = relative(tierRoot, tp);
      const mp = join(mapRoot, rel);
      if (!existsSync(mp)) continue;
      const t = JSON.parse(readFileSync(tp, 'utf8'));
      const m = JSON.parse(readFileSync(mp, 'utf8'));
      const s = splitCategoryDoc(mergeCategoryDoc(t, m), m);
      if (!s) continue; // no category key: the editor saves nothing either
      pairs++;
      if (Array.isArray(m.rules) && m.rules.length) withRules++;
      if (!same(s.tier, t) || !same(mappingAfterSave(s, m), m)) broken.push(rel);
    }
    // A round trip over zero files proves nothing, so the sample must be non-empty AND
    // must contain categories that actually carry rules.
    check(`found pairs to round-trip (${pairs}, ${withRules} of them carry rules)`, pairs > 0 && withRules > 0);
    check('every pair round-trips to identical JSON (same keys, same order)', broken.length === 0,
      `${broken.length} do not: ${broken.slice(0, 5).join(', ')}${broken.length > 5 ? ', ...' : ''}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failed ? `\nFAIL: ${failed} of ${passed + failed} category document checks.`
                   : `\nPASS: ${passed}/${passed} category document checks.`);
process.exit(failed ? 1 : 0);
