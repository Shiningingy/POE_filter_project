// Generator goldens: run the shipping generator over a small SYNTHETIC data tree
// and compare against committed expected output.
//
// This is the regression net that replaced dual-generator parity (ADR-0001 →
// ADR-0007). Parity proved the Python and TypeScript engines agreed with each
// other; it could not prove either was correct, and it had nothing left to compare
// once there was one engine.
//
// Why a fixture and not the real tree: the real filter is the thing being edited.
// A golden over it would churn on every tier tweak, and a golden everyone
// regenerates without reading is not a test. The fixture has invented items and
// invented tiers, so a data edit never touches it — if these files move, the
// GENERATOR changed, and the diff says exactly how.
//
// Usage (from webapp/frontend):
//   node test_generator_fixtures.mjs            check
//   node test_generator_fixtures.mjs --update   rewrite the goldens (then READ the diff)
//
// Needs no Python and no baked demo bundle — the fixture is the input.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'test_fixtures', 'generator');
const EXPECTED = join(FIXTURES, 'expected');
const UPDATE = process.argv.includes('--update');
const SHOW = 30;

const tmp = mkdtempSync(join(tmpdir(), 'genfix-'));
let failed = 0, passed = 0;
try {
  const genOut = join(tmp, 'filterGenerator.mjs');
  await build({
    bundle: true, format: 'esm', platform: 'node',
    define: { 'import.meta.env.BASE_URL': '"/"' },
    entryPoints: [join(HERE, 'src/utils/filterGenerator.ts')], outfile: genOut,
  });
  const { generateFilter } = await import(pathToFileURL(genOut).href);
  const { baseData, CASES } = await import(pathToFileURL(join(FIXTURES, 'fixture.mjs')).href);

  mkdirSync(EXPECTED, { recursive: true });

  for (const c of CASES) {
    const realLog = console.log; console.log = () => {};
    let text;
    try {
      text = generateFilter({
        ...baseData(),
        language: c.language,
        strictness: c.strictness,
        mode: c.mode,
        leveling_selection: c.leveling,
      });
    } finally { console.log = realLog; }
    text = text.replace(/\r\n/g, '\n');

    const goldenPath = join(EXPECTED, `${c.name}.filter`);
    if (UPDATE || !existsSync(goldenPath)) {
      writeFileSync(goldenPath, text, 'utf8');
      console.log(`  ${existsSync(goldenPath) && !UPDATE ? 'new  ' : 'wrote'} ${c.name}  (${text.split('\n').length} lines)`);
      passed++;
      continue;
    }

    const want = readFileSync(goldenPath, 'utf8').replace(/\r\n/g, '\n');
    if (want === text) { console.log(`  ok    ${c.name}  (${text.split('\n').length} lines)`); passed++; continue; }

    failed++;
    const a = want.split('\n'), b = text.split('\n');
    console.log(`  FAIL  ${c.name}  (expected ${a.length}L, got ${b.length}L)`);
    let shown = 0;
    for (let i = 0; i < Math.max(a.length, b.length) && shown < SHOW; i++) {
      if (a[i] !== b[i]) {
        console.log(`          line ${i + 1}`);
        console.log(`            expected ${JSON.stringify(a[i])}`);
        console.log(`            got      ${JSON.stringify(b[i])}`);
        shown++;
      }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (UPDATE) {
  console.log('\nGoldens rewritten. Read the git diff before committing — that diff IS the ' +
              'behaviour change, and it is the only review this test gets.');
  process.exit(0);
}
console.log(`\n${failed ? 'FAIL' : 'PASS'}: ${passed}/${passed + failed} generator fixtures match.`);
process.exit(failed ? 1 : 0);
