// Locale coverage + anti-regression lint for the string tables.
//
//   node webapp/frontend/test_locale_coverage.mjs            report + fail on a NEW gap
//   node webapp/frontend/test_locale_coverage.mjs --update   accept the current gaps
//
// ★ WHY THIS EXISTS. The old resolver returned the KEY when a string was missing, so a
// gap rendered as plausible-looking text and nothing ever failed: `styleTextColor`
// appeared as a label in both languages for as long as that editor existed, and 35 of 51
// theme categories showed raw English in a dropdown. Missing translations are data, and
// data this app cannot see is data that rots. This makes the gap a number.
//
// It also lints the two shapes that CAUSED those bugs, so they cannot come back:
//   1. `t[expr] || fallback`  — the lookup never returns falsy, so the fallback is dead.
//   2. `language === 'ch' ? '…' : '…'` with two literals — a string that lives in a
//      component instead of the table, and a branch that a third locale cannot extend.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'src');
const LOC = path.join(SRC, 'utils', 'localization.ts');
const LOCALES_TS = path.join(SRC, 'utils', 'locales.ts');
const BASELINE = path.join(HERE, 'locale_coverage_baseline.json');
const UPDATE = process.argv.includes('--update');

const text = fs.readFileSync(LOC, 'utf8');

// Languages come from the registry, so adding one automatically widens this test.
const LANGS = [...fs.readFileSync(LOCALES_TS, 'utf8')
  .slice(fs.readFileSync(LOCALES_TS, 'utf8').indexOf('export const LOCALES'))
  .matchAll(/^\s{2}(\w+):\s*\{\s*label:/gm)].map((m) => m[1]);
if (!LANGS.length) { console.error('FAIL: could not read LOCALES from locales.ts'); process.exit(1); }

function evalConst(name) {
  const at = text.indexOf('export const ' + name);
  if (at < 0) return null;
  const s = text.indexOf('{', text.indexOf('=', at));
  let i = s, d = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < text.length) { if (text[i] === '\\') { i += 2; continue } if (text[i] === q) { i++; break } i++ }
      continue;
    }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; continue }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) break }
    i++;
  }
  return eval('(' + text.slice(s, i + 1).replace(/\s+as\s+(?:const\b|any\b|string\b|Record\s*<[^<>]*>)/g, '') + ')');
}

const TABLES = ['strings', 'ITEM_CLASS_LABELS', 'BONUS_TAG_LABELS', 'BONUS_HINT_LABELS',
                'DATA_FOLDER_LABELS', 'RULE_FACTOR_LABELS', 'THEME_CATEGORY_LABELS'];

const isBag = (v) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length > 0 && Object.keys(v).every((k) => LANGS.includes(k));

const gaps = {};       // table -> lang -> [key]
let totalKeys = 0;
for (const name of TABLES) {
  const tbl = evalConst(name);
  if (!tbl) { console.error(`FAIL: table ${name} not found in localization.ts`); process.exit(1); }
  gaps[name] = Object.fromEntries(LANGS.map((l) => [l, []]));
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (isBag(v)) {
        totalKeys++;
        for (const l of LANGS) if (typeof v[l] !== 'string' || v[l] === '') gaps[name][l].push(key);
      } else if (v && typeof v === 'object') walk(v, key);
    }
  };
  walk(tbl, '');
}

console.log(`locales: ${LANGS.join(', ')}`);
console.log(`translatable entries across ${TABLES.length} tables: ${totalKeys}\n`);
let totalGaps = 0;
for (const name of TABLES) {
  const parts = LANGS.map((l) => `${l}:${gaps[name][l].length}`).join('  ');
  const n = LANGS.reduce((a, l) => a + gaps[name][l].length, 0);
  totalGaps += n;
  console.log(`  ${name.padEnd(24)} missing  ${parts}`);
}
console.log(`\ntotal missing translations: ${totalGaps}`);

// ── the two shapes that must not come back ────────────────────────────────────
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && p !== LOC && p !== LOCALES_TS) files.push(p);
  }
})(SRC);

const deadFallback = [];
const inlinePairs = [];
const RX_DEAD = /\bt\s*(?:as any\s*)?\[[^\]]+\]\s*\|\|/g;
const RX_DEAD2 = /\(t as any\)\s*\[[^\]]+\]\s*\|\|/g;
const RX_PAIR = /language\s*===\s*(['"])(?:ch|en)\1\s*\?\s*(['"])(?:\\.|(?!\2).)*\2\s*:\s*(['"])(?:\\.|(?!\3).)*\3/g;
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const rel = path.relative(SRC, f).replace(/\\/g, '/');
  t.split('\n').forEach((line, i) => {
    if (RX_DEAD.test(line) || RX_DEAD2.test(line)) deadFallback.push(`${rel}:${i + 1}`);
    RX_DEAD.lastIndex = 0; RX_DEAD2.lastIndex = 0;
    for (const m of line.matchAll(RX_PAIR)) {
      if (/[一-鿿]/.test(m[0])) inlinePairs.push(`${rel}:${i + 1}`);
    }
  });
}
console.log(`dead \`t[expr] || fallback\` sites: ${deadFallback.length}`);
deadFallback.forEach((s) => console.log('    ' + s));
console.log(`inline zh/en literal ternaries:   ${inlinePairs.length}`);
inlinePairs.forEach((s) => console.log('    ' + s));

// ── baseline ──────────────────────────────────────────────────────────────────
const current = {
  gaps: Object.fromEntries(TABLES.map((n) => [n, Object.fromEntries(LANGS.map((l) => [l, gaps[n][l].sort()]))])),
  deadFallback: deadFallback.sort(),
  inlinePairs: inlinePairs.sort(),
};

if (UPDATE) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log('\nbaseline updated.');
  process.exit(0);
}
if (!fs.existsSync(BASELINE)) {
  console.error('\nFAIL: no baseline. Run with --update once, and commit it.');
  process.exit(1);
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const problems = [];
for (const n of TABLES) for (const l of LANGS) {
  const was = new Set(base.gaps?.[n]?.[l] || []);
  const now = current.gaps[n][l].filter((k) => !was.has(k));
  if (now.length) problems.push(`${n} [${l}] gained ${now.length} missing: ${now.slice(0, 8).join(', ')}`);
}
for (const [k, label] of [['deadFallback', 'dead `||` fallback'], ['inlinePairs', 'inline zh/en ternary']]) {
  const was = new Set(base[k] || []);
  const now = current[k].filter((s) => !was.has(s));
  if (now.length) problems.push(`${now.length} new ${label} site(s): ${now.join(', ')}`);
}

if (problems.length) {
  console.error('\nFAIL — new localization gaps:');
  problems.forEach((p) => console.error('  ' + p));
  console.error('\nAdd the missing string, or run with --update if the gap is deliberate.');
  process.exit(1);
}
console.log('\nPASS — no new localization gaps.');
