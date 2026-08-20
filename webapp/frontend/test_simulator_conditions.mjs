// The drop simulator must actually MATCH the conditions the tree authors.
//
// Usage (from webapp/frontend):  node test_simulator_conditions.mjs
//
// ★ WHY THIS EXISTS. `checkRuleMatch` resolved boolean conditions through a
// hand-maintained map, and a bool the map did not name fell through to the NUMERIC
// comparison at the bottom of the function, where `String(true) !== "True"` made the
// rule reject every item. Four conditions were in that state — ZanaMemory (live in the
// tree), UberBlightedMap, MirageMap and Vestigial — and the failure is invisible from
// the outside: the simulator just shows the item taking a different block, which looks
// like a filter decision rather than a bug.
//
// The fix was to resolve bools generically, so this file exists to keep the CONSEQUENCE
// pinned rather than the implementation. check_condition_schema.py guards the vocabulary;
// this guards the behaviour. Both are needed: the schema check cannot tell you that a
// matching rule actually matches.
//
// ⚠️ Every case below FAILS on the pre-fix engine except the regressions — verified by
// running this against the stashed original. A test that passes before and after the fix
// is not evidence, and this one was checked both ways.

import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'src', 'utils', 'simulatorEngine.ts');

const dir = mkdtempSync(join(tmpdir(), 'simcond-'));
const out = join(dir, 'sim.mjs');
await build({ entryPoints: [SRC], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
const { checkRuleMatch } = await import(pathToFileURL(out).href);

const cases = [
  // ── the four that silently never matched ───────────────────────────────────
  ['ZanaMemory True vs a Zana memory (LIVE in the tree)',
    { name: 'X', class: 'Map Fragments', zanaMemory: true }, { ZanaMemory: 'True' }, true],
  ['ZanaMemory True vs a plain fragment',
    { name: 'X', class: 'Map Fragments', zanaMemory: false }, { ZanaMemory: 'True' }, false],
  ['UberBlightedMap True vs a blight-ravaged map',
    { name: 'M', class: 'Maps', uberBlightedMap: true }, { UberBlightedMap: 'True' }, true],
  ['MirageMap True vs a mirage map',
    { name: 'M', class: 'Maps', mirageMap: true }, { MirageMap: 'True' }, true],
  // Vestigial is `simulatable: false` — the item model has no attribute for it, so the
  // sim must SKIP it (leniently match), not test it against undefined and reject.
  ['Vestigial True is skipped, so the rest of the rule still decides',
    { name: 'U', class: 'Rings' }, { Vestigial: 'True' }, true],

  // ── regressions: the paths the fix rerouted ────────────────────────────────
  ['FracturedItem True vs a fractured item (a genuine BOOL_FIELD rename)',
    { name: 'R', class: 'Rings', fractured: true }, { FracturedItem: 'True' }, true],
  ['FracturedItem True vs a normal item',
    { name: 'R', class: 'Rings', fractured: false }, { FracturedItem: 'True' }, false],
  ['Corrupted False vs an uncorrupted item (was a hand-written branch)',
    { name: 'R', class: 'Rings', corrupted: false }, { Corrupted: 'False' }, true],
  ['Corrupted True vs an uncorrupted item',
    { name: 'R', class: 'Rings', corrupted: false }, { Corrupted: 'True' }, false],
  ['Identified True vs an identified item',
    { name: 'R', class: 'Rings', identified: true }, { Identified: 'True' }, true],
  ['Mirrored True vs a mirrored item',
    { name: 'R', class: 'Rings', mirrored: true }, { Mirrored: 'True' }, true],
  // The bool path keys off the VALUE being True/False, so a numeric condition must not
  // be swallowed by it.
  ['ItemLevel >= 68 is still numeric',
    { name: 'R', class: 'Rings', itemLevel: 70 }, { ItemLevel: '>= 68' }, true],
  ['ItemLevel >= 68 rejects a low item',
    { name: 'R', class: 'Rings', itemLevel: 60 }, { ItemLevel: '>= 68' }, false],
];

let bad = 0;
for (const [label, item, conditions, want] of cases) {
  const got = checkRuleMatch(item, { conditions });
  if (got !== want) { bad++; console.log(`  FAIL  ${label} -> ${got} (want ${want})`); }
  else console.log(`  ok    ${label}`);
}
rmSync(dir, { recursive: true, force: true });

console.log();
if (bad) {
  console.error(`FAIL: ${bad}/${cases.length} simulator condition cases wrong.`);
  console.error('A bool condition that never matches makes the simulator show the item');
  console.error('taking a different block — which reads as a filter decision, not a bug.');
  process.exit(1);
}
console.log(`PASS: ${cases.length}/${cases.length} simulator condition cases.`);
