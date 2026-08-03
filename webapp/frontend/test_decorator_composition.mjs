// Decorator composition: does the SIMULATOR compose the way the GAME does?
//
// Verified in game 2026-08-03 (reference_poe_filter_format.md §3): a block with
// `Continue` applies its actions and matching keeps going; later matching blocks then
// override only the properties THEY set. So a decorator's channel survives exactly where
// the block that claims the item leaves that channel unset.
//
// That asymmetry is the whole feature and it is easy to break in a way nothing else
// notices — the generator would still emit correct filter text while the simulator showed
// the player something different, which is the class of bug this branch exists to kill.
//
// Usage (from webapp/frontend):  node test_decorator_composition.mjs

import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'deco-'));
let failed = 0, passed = 0;

const check = (name, got, want) => {
  const ok = got === want;
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}\n          got  ${got}\n          want ${want}`); }
};

try {
  const out = join(tmp, 'sim.mjs');
  await build({
    bundle: true, format: 'esm', platform: 'node',
    define: { 'import.meta.env.BASE_URL': '"/"' },
    entryPoints: [join(HERE, 'src/utils/simulatorEngine.ts')], outfile: out,
    external: ['react'], logLevel: 'silent',
  });
  const { evaluateItem, matchingDecorators } = await import(pathToFileURL(out).href);

  // One decorator (border only, on corrupted) + two blocks that claim the same base:
  // "Loud" states a border of its own, "Quiet" deliberately leaves border unset.
  const tierDefinitions = {
    'tier_definition/_deco/States.json': {
      States: {
        _meta: { theme_category: 'T', gen_order: -100, tier_order: ['Corrupted'] },
        Corrupted: {
          decorator: true,
          conditions: { Corrupted: 'True' },
          theme: { Tier: 1, BorderColor: '#ff0000ff' },
        },
      },
    },
    'tier_definition/Loud.json': {
      Loud: {
        _meta: { theme_category: 'T', tier_order: ['Tier 1 Loud'] },
        'Tier 1 Loud': { theme: { Tier: 1 } },
      },
    },
    'tier_definition/Quiet.json': {
      Quiet: {
        _meta: { theme_category: 'T', tier_order: ['Tier 2 Quiet'] },
        'Tier 2 Quiet': { theme: { Tier: 2 } },
      },
    },
  };
  // Tier 1 SETS a border; Tier 2 omits it entirely.
  const theme = {
    T: {
      'Tier 1': { FontSize: 40, TextColor: '#ffffffff', BorderColor: '#00ff00ff' },
      'Tier 2': { FontSize: 40, TextColor: '#ffffffff' },
    },
  };
  const ctx = (mappings) => ({ mappings, tierDefinitions, theme });
  const loud = ctx({ 'base_mapping/Loud.json': { mapping: { 'Widget': 'Tier 1 Loud' }, rules: [] } });
  const quiet = ctx({ 'base_mapping/Quiet.json': { mapping: { 'Widget': 'Tier 2 Quiet' }, rules: [] } });

  const item = (corrupted) => ({ name: 'Widget', class: 'Widgets', corrupted });

  console.log('decorator composition');
  // The block claims the channel -> the block wins. (Game case A: green, not red.)
  check('block that SETS border overrides the decorator',
        evaluateItem(item(true), loud).style.borderColor, 'rgba(0,255,0,1.00)');
  // The block leaves it unset -> the decorator survives. (Game case B/C.)
  check('block that OMITS border keeps the decorator',
        evaluateItem(item(true), quiet).style.borderColor, 'rgba(255,0,0,1.00)');
  // No state, no decoration - the decorator must not leak onto every item.
  check('uncorrupted item is untouched by the decorator',
        evaluateItem(item(false), quiet).style.borderColor, undefined);
  // The decorator states ONLY a border, so it must not invent the other channels.
  check('decorator does not touch text colour',
        evaluateItem(item(true), quiet).style.color, 'rgba(255,255,255,1.00)');

  console.log('\ndecorator selection');
  check('matches a corrupted item', matchingDecorators(item(true), quiet).length, 1);
  check('ignores an uncorrupted item', matchingDecorators(item(false), quiet).length, 0);

  // The generator skips these two, so the simulator must as well or it shows a look the
  // filter never emits.
  const skipped = {
    'tier_definition/_deco/Bad.json': {
      Bad: {
        _meta: { theme_category: 'T', tier_order: [] },
        NoConditions: { decorator: true, conditions: {}, theme: { BorderColor: '#0000ffff' } },
        HideDeco: { decorator: true, is_hide_tier: true, conditions: { Corrupted: 'True' },
                    theme: { BorderColor: '#0000ffff' } },
      },
    },
  };
  const bad = { ...quiet, tierDefinitions: skipped };
  check('a decorator with no conditions is ignored, as the generator ignores it',
        matchingDecorators(item(true), bad).length, 0);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${failed ? 'FAIL' : 'PASS'}: ${passed}/${passed + failed} decorator composition checks.`);
process.exit(failed ? 1 : 0);
