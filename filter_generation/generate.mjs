#!/usr/bin/env node
// The filter generator CLI. Replaces filter_generation/generate.py (ADR-0007).
//
// There is now ONE generation engine — webapp/frontend/src/utils/filterGenerator.ts,
// the same module that runs in every visitor's browser. This file is a thin shell
// around it: parse flags, load filter_generation/data/** into the GeneratorData the
// deployed path builds, call generateFilter, write the output. It deliberately holds
// no generation logic of its own, because a CLI with its own logic is how the project
// ended up with two engines to keep in parity in the first place.
//
// Usage (from the project root):
//   node filter_generation/generate.mjs --mode ruthless --strictness soft
//
//   --mode                standard | ruthless          (default standard)
//   --game-version        poe1 | poe2                  (default poe1; poe2 errors)
//   --strictness          soft…uber                    (default soft)
//   --language            ch | en                      (default ch)
//   --leveling-selection  JSON, or @path to a JSON file
//   --trace               write a per-block JSON trace here (see BlockRecord)
//   --out                 output path (default filter_generation/complete_filter.filter)
//
// esbuild comes from webapp/frontend/node_modules, so `npm ci` there is the only
// setup step. Compiling the TS on each run costs ~200ms and keeps the CLI honest:
// it can never drift from the shipping engine, because it IS the shipping engine.

import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FRONTEND = join(ROOT, 'webapp', 'frontend');
const DATA = join(ROOT, 'filter_generation', 'data');

const STRICTNESS_LEVELS = ['soft', 'regular', 'semistrict', 'strict', 'verystrict', 'uber', 'uberplus'];

// ── flags ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt;
};
const die = (msg) => { console.error(`[ERROR] ${msg}`); process.exit(1); };

const mode = flag('mode', 'standard');
const gameVersion = flag('game-version', 'poe1');
const strictness = flag('strictness', 'soft');
const language = flag('language', 'ch');
const tracePath = flag('trace', null);
const outPath = resolve(ROOT, flag('out', join('filter_generation', 'complete_filter.filter')));

if (!['standard', 'ruthless'].includes(mode)) die(`--mode must be standard|ruthless (got ${mode})`);
if (!STRICTNESS_LEVELS.includes(strictness)) die(`--strictness must be one of ${STRICTNESS_LEVELS.join('|')}`);
if (!['ch', 'en'].includes(language)) die(`--language must be ch|en (got ${language})`);
if (gameVersion === 'poe2') die('POE2 filter generation is not yet supported.');
if (gameVersion !== 'poe1') die(`--game-version must be poe1|poe2 (got ${gameVersion})`);

// A selection can arrive inline or as @file — the file form dodges shell JSON quoting,
// which is how the backend and the tests pass it on Windows.
let levelingSelection = {};
const rawSel = flag('leveling-selection', '{}');
try {
  levelingSelection = JSON.parse(rawSel.startsWith('@') ? readFileSync(rawSel.slice(1), 'utf8') : rawSel);
} catch (e) {
  die(`--leveling-selection is not valid JSON: ${e.message}`);
}

// ── load the data tree ───────────────────────────────────────────────────────
// Mirrors create_demo_bundle.build_bundle(): every JSON under a root, keyed by its
// POSIX path relative to that root. Key order matters — tier_definition key order
// drives emission order — so walk sorted, exactly as the baker does.
const readJson = (p, dflt = null) => {
  if (!existsSync(p)) return dflt;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return dflt; }
};

const loadTree = (root) => {
  const found = [];
  const walk = (abs, rel) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel ? posix.join(rel, e.name) : e.name;
      if (e.isDirectory()) walk(join(abs, e.name), childRel);
      else if (e.isFile() && e.name.endsWith('.json')) found.push(childRel);
    }
  };
  if (existsSync(root)) walk(root, '');
  found.sort();
  const out = {};
  for (const rel of found) out[rel] = readJson(join(root, rel.split('/').join('/')), {});
  return out;
};

// ── compile the shipping engine for Node ─────────────────────────────────────
const require_ = createRequire(join(FRONTEND, 'package.json'));
let esbuild;
try {
  esbuild = require_('esbuild');
} catch {
  die('esbuild not found. Run `npm ci` in webapp/frontend first — the CLI compiles\n' +
      '        the TypeScript generator rather than keeping a second copy of it.');
}

const tmp = mkdtempSync(join(tmpdir(), 'poefilter-gen-'));
try {
  const genOut = join(tmp, 'filterGenerator.mjs');
  const shared = {
    bundle: true, format: 'esm', platform: 'node',
    define: { 'import.meta.env.BASE_URL': '"/"' },
  };
  await esbuild.build({ ...shared, entryPoints: [join(FRONTEND, 'src/utils/filterGenerator.ts')], outfile: genOut });

  const { generateFilter } = await import(pathToFileURL(genOut).href);

  // Theme, as the app resolves it (clientData.getActiveTheme): the preset named in
  // settings. There is no override layer — custom_overrides.json was a category x tier
  // patch on top of the preset, from before the tier block owned its look.
  //
  // generate.py read settings from data/config/settings.json — a path that does not
  // exist — so it always silently fell back to 'sharket' and base_theme was a dead
  // control. This reads filter_generation/data/settings.json, where the app actually
  // writes it. Same output today (that file carries no base_theme, and sharket is the
  // only preset), but the setting now works.
  const settings = readJson(join(DATA, 'settings.json'), {}) || {};
  const baseThemeName = settings.base_theme || 'sharket';
  let baseTheme = readJson(join(DATA, 'theme', baseThemeName, `${baseThemeName}_theme.json`));
  if (!baseTheme || Object.keys(baseTheme).length === 0) {
    if (baseThemeName !== 'sharket') console.warn(`[WARN] theme '${baseThemeName}' not found — falling back to sharket.`);
    baseTheme = readJson(join(DATA, 'theme', 'sharket', 'sharket_theme.json'), {});
  }
  const themeData = baseTheme || {};

  const footerFile = join(DATA, 'footer.filter');
  const blocks = tracePath ? [] : null;

  console.log(`Using Base Theme: ${baseThemeName}`);
  const text = generateFilter({
    themeData,
    soundMap: readJson(join(DATA, 'theme', 'sharket', 'Sharket_sound_map.json'), {}),
    allMappings: loadTree(join(DATA, 'base_mapping')),
    allTierDefinitions: loadTree(join(DATA, 'tier_definition')),
    language,
    footer: existsSync(footerFile) ? readFileSync(footerFile, 'utf8') : '',
    strictness,
    leveling_selection: levelingSelection,
    mode,
    ...(blocks ? { onBlock: (rec) => blocks.push(rec) } : {}),
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text, 'utf8');
  console.log(`[OK] Filter written to ${outPath} (${text.split('\n').length - 1} lines, mode=${mode}, strictness=${strictness}, language=${language})`);

  if (tracePath) {
    const traceAbs = resolve(ROOT, tracePath);
    mkdirSync(dirname(traceAbs), { recursive: true });
    writeFileSync(traceAbs, JSON.stringify({
      meta: { mode, strictness, language, leveling_selection: levelingSelection, blocks: blocks.length },
      blocks,
    }, null, 1), 'utf8');
    console.log(`[OK] Trace written to ${traceAbs} (${blocks.length} blocks)`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
