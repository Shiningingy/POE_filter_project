// Round-trip fidelity test for src/utils/filterParser.ts
//
// For each real-world filter:
//   1. parse -> serialize -> reparse, assert the two parsed structures are
//      deep-equal (the parse captured everything needed to rebuild it).
//   2. line-diff serialize(parse(text)) against the original text and report
//      how many lines differ (how close to byte-identical we land on live blocks).
//
// Run from webapp/frontend:  node test_filter_roundtrip.mjs
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILTER_DIR = '../../data/from_filter_blade/3.28';
const FILTERS = [
  'FilterBlade_0_Soft.filter',
  'FilterBlade_1_Regular.filter',
  'FilterBlade_2_Semi-Strict.filter',
  'FilterBlade_3_Strict.filter',
  'FilterBlade_4_Very Strict.filter',
  'FilterBlade_5_Uber Strict.filter',
  'FilterBlade_6_Uber Plus Strict.filter',
  'Sharket3.28_ruthless.ruthlessfilter',
];

// --- bundle the TS parser to a temp ESM file we can import ----------------
const tmp = mkdtempSync(join(tmpdir(), 'fparse-'));
const bundle = join(tmp, 'filterParser.mjs');
execSync(
  `npx esbuild src/utils/filterParser.ts --bundle --format=esm --platform=node --outfile="${bundle}"`,
  { stdio: 'inherit' }
);
const { parseFilter, serializeFilter, extractOutline, liveBlocks } =
  await import(pathToFileURL(bundle).href);

// Project away the verbatim `raw` field so the structural compare tests the
// PARSED fields (action/keyword/operator/values/comment), not stored text.
function project(pf) {
  return JSON.stringify(pf, (k, v) => (k === 'raw' ? undefined : v));
}

// Collapse runs of whitespace so we can tell genuine data loss apart from
// pure reformatting (e.g. an accidental double space after `==`).
const collapseWs = (s) => (s ?? '').replace(/[ \t]+/g, ' ').trim();

function lineDiff(a, b) {
  const la = a.split('\n'), lb = b.split('\n');
  const n = Math.max(la.length, lb.length);
  const diffs = [];
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      diffs.push({
        line: i + 1, orig: la[i], out: lb[i],
        cosmetic: collapseWs(la[i]) === collapseWs(lb[i]),
      });
    }
  }
  return diffs;
}

let anyFail = false;
console.log('');
for (const name of FILTERS) {
  const text = readFileSync(join(FILTER_DIR, name), 'utf8');
  const pf1 = parseFilter(text);
  const out1 = serializeFilter(pf1);
  const pf2 = parseFilter(out1);

  const structEqual = project(pf1) === project(pf2);
  const blocks = liveBlocks(pf1).length;
  const comments = pf1.elements.length - blocks;
  const outline = extractOutline(pf1);

  // Normalise EOL for the textual diff (we re-emit \n; some files are CRLF).
  const diffs = lineDiff(text.replace(/\r\n/g, '\n'), out1.replace(/\r\n/g, '\n'));
  const meaningful = diffs.filter((d) => !d.cosmetic);
  const cosmetic = diffs.length - meaningful.length;

  // Fidelity = no semantic loss. Cosmetic whitespace re-canonicalisation is OK.
  const ok = structEqual && meaningful.length === 0;
  if (!ok) anyFail = true;

  if (!structEqual) {
    // Locate the first diverging element to debug a real parse bug.
    const a = pf1.elements, b = pf2.elements;
    const n = Math.max(a.length, b.length);
    for (let k = 0; k < n; k++) {
      const pa = JSON.stringify(a[k], (kk, v) => (kk === 'raw' ? undefined : v));
      const pb = JSON.stringify(b[k], (kk, v) => (kk === 'raw' ? undefined : v));
      if (pa !== pb) {
        console.log(`        >> first structural divergence at element #${k}`);
        console.log(`           A: ${(pa || 'undefined').slice(0, 220)}`);
        console.log(`           B: ${(pb || 'undefined').slice(0, 220)}`);
        break;
      }
    }
  }

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`        blocks=${blocks}  commentRuns=${comments}  outlineEntries=${outline.length}`);
  console.log(`        reparse-structural-equal=${structEqual}  meaningful-diffs=${meaningful.length}  cosmetic-ws-diffs=${cosmetic}`);
  if (meaningful.length) {
    for (const d of meaningful.slice(0, 8)) {
      console.log(`        L${d.line}:`);
      console.log(`          - ${JSON.stringify(d.orig)}`);
      console.log(`          + ${JSON.stringify(d.out)}`);
    }
    if (meaningful.length > 8) console.log(`        ... +${meaningful.length - 8} more`);
  }
  console.log('');
}

rmSync(tmp, { recursive: true, force: true });
console.log(anyFail ? 'RESULT: some filters did not round-trip cleanly (see diffs above).'
                    : 'RESULT: all filters round-tripped cleanly.');
process.exit(anyFail ? 1 : 0);
