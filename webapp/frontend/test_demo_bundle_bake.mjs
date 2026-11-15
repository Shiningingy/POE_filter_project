// Demo-bundle bake: does create_demo_bundle.py FAIL when it cannot build what it ships?
//
// The deploy publishes whatever this bake writes, and the backend loaders it calls are
// built for a dev server: a missing or unreadable input prints a warning and leaves the
// catalogue empty (main.py load_base_types, load_translations, load_stack_sizes, ...).
// So a bake that lost an input used to exit 0 with an empty or partial item catalogue,
// and the deploy would have shipped it. This pins the opposite: every required input that
// is missing, empty or unreadable makes the bake exit non-zero and NAME the input.
//
// It also pins the stamp's scope. bake_stamp.json carries a fingerprint of the inputs, and
// test_resolver_equivalence.mjs uses it to refuse a stale bundle. The fingerprint used to
// cover only filter_generation/data, so a changed item table or sound file left a stale
// bundle looking fresh.
//
// Runs against a TEMP COPY of the bake, its backend and its inputs; the real tree is only
// read. The copy is checked first: a complete copy must bake green, or a non-zero exit
// below would prove nothing.
//
// Usage (from webapp/frontend):  node test_demo_bundle_bake.mjs
//   Needs Python with the backend deps (webapp/backend/requirements.txt); PYTHON= overrides.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PY = process.env.PYTHON || 'python';
const SOUND_SUBDIRS = ['Default', 'Sharket掉落音效'];

// What the bake reads outside filter_generation/data. If the bake starts reading another
// input, the control bake below fails and names it — so this list cannot drift silently.
const DATA_FILES = [
  'data/from_filter_blade/BaseTypes.csv',
  'data/from_filter_blade/3.28/bonusItemInfo.json',
  'data/from_ggpk/baseitemtypes.json',
  'data/from_ggpk/currencyitems.json',
  'data/from_ggpk/ch_simplified/baseitemtypes.json',
  'data/from_ggpk/ch_simplified/currency_descriptions.json',
  'data/from_ggpk/ch_simplified/words.json',
  'data/unique_base_db.json',
  'data/unique_name_zh_extra.json',
];

let failed = 0, passed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? `\n          ${detail.split('\n').join('\n          ')}` : ''}`); }
};

const tmp = mkdtempSync(join(tmpdir(), 'bake-'));
const at = (rel) => join(tmp, ...rel.split('/'));
const restore = (rel) => cpSync(join(ROOT, ...rel.split('/')), at(rel), { recursive: true });
const writeFakeSounds = (sub) => {
  mkdirSync(at(`sound_files/${sub}`), { recursive: true });
  // Content is irrelevant to the bake; it copies the files and counts them.
  writeFileSync(at(`sound_files/${sub}/a.mp3`), 'fake-a');
  writeFileSync(at(`sound_files/${sub}/b.mp3`), 'fake-b');
};
const bake = () => {
  const r = spawnSync(PY, [at('filter_generation/create_demo_bundle.py')], {
    cwd: tmp, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? String(r.error) : ''}` };
};
const stampPath = () => at('webapp/frontend/public/demo_data/bake_stamp.json');
const fingerprint = () => JSON.parse(readFileSync(stampPath(), 'utf8')).source_fingerprint;

// A required input that is gone, empty or unreadable: the bake must exit non-zero, and
// its output must say which input, so the person reading a red deploy knows what to fix.
const mustFail = (name, rel, breakIt) => {
  breakIt();
  const r = bake();
  check(`${name}: bake exits non-zero`, r.code !== 0 && r.code !== null, `exit ${r.code}`);
  check(`${name}: the failure names ${rel}`, r.out.includes(rel), r.out.split('\n').slice(-12).join('\n'));
  restore(rel);
};

try {
  for (const rel of ['filter_generation/create_demo_bundle.py', 'webapp/backend/main.py', ...DATA_FILES]) {
    mkdirSync(dirname(at(rel)), { recursive: true });
    restore(rel);
  }
  // _import_backup is the backend's own scratch (gitignored); the bake never reads it.
  cpSync(join(ROOT, 'filter_generation', 'data'), at('filter_generation/data'), {
    recursive: true, filter: (src) => !src.includes('_import_backup'),
  });
  SOUND_SUBDIRS.forEach(writeFakeSounds);

  console.log('\ncontrol: a complete copy bakes green');
  const ctrl = bake();
  check('complete copy: bake exits 0', ctrl.code === 0, ctrl.out.split('\n').slice(-15).join('\n'));
  check('complete copy: bake writes its stamp', existsSync(stampPath()));
  if (ctrl.code !== 0) throw new Error('control bake failed; the cases below would prove nothing');

  console.log('\na required input that is missing, empty or unreadable fails the bake');
  mustFail('missing item table', 'data/from_filter_blade/BaseTypes.csv',
           () => rmSync(at('data/from_filter_blade/BaseTypes.csv')));
  mustFail('empty zh names', 'data/from_ggpk/ch_simplified/baseitemtypes.json',
           () => writeFileSync(at('data/from_ggpk/ch_simplified/baseitemtypes.json'), ''));
  mustFail('unreadable stack sizes', 'data/from_ggpk/currencyitems.json',
           () => writeFileSync(at('data/from_ggpk/currencyitems.json'), '{not json'));
  mustFail('missing tier definitions', 'filter_generation/data/tier_definition',
           () => rmSync(at('filter_generation/data/tier_definition'), { recursive: true }));
  {
    const rel = 'sound_files/Default';
    rmSync(at(rel), { recursive: true });
    const r = bake();
    check('missing sound folder: bake exits non-zero', r.code !== 0 && r.code !== null, `exit ${r.code}`);
    check(`missing sound folder: the failure names ${rel}`, r.out.includes(rel), r.out.split('\n').slice(-12).join('\n'));
    writeFakeSounds('Default');
  }

  console.log('\nthe stamp fingerprint covers every input the bundle is built from');
  const changes = [
    ['an item-table edit', 'data/from_filter_blade/BaseTypes.csv',
     () => appendFileSync(at('data/from_filter_blade/BaseTypes.csv'), '\n')],
    ['a zh-name edit', 'data/from_ggpk/ch_simplified/baseitemtypes.json',
     () => appendFileSync(at('data/from_ggpk/ch_simplified/baseitemtypes.json'), '\n')],
    ['a sound-file edit', 'sound_files/Default',
     () => writeFileSync(at('sound_files/Default/a.mp3'), 'fake-a-changed')],
  ];
  for (const [name, rel, change] of changes) {
    const before = bake();
    if (before.code !== 0) { check(`${name}: rebake before the change`, false, before.out); continue; }
    const fp0 = fingerprint();
    change();
    const after = bake();
    check(`${name}: the bake still succeeds`, after.code === 0, after.out.split('\n').slice(-12).join('\n'));
    if (after.code === 0) check(`${name} changes the fingerprint`, fingerprint() !== fp0);
    if (rel.startsWith('sound_files/')) writeFakeSounds('Default'); else restore(rel);
  }
} catch (err) {
  failed++;
  console.log(`  FAIL  ${err.message}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${failed ? 'FAIL' : 'PASS'}: ${passed}/${passed + failed} demo-bundle bake checks.`);
process.exit(failed ? 1 : 0);
