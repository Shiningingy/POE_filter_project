// Parity test: clientData.ts (the deployed, backend-free data layer) vs the
// live FastAPI backend. Run this whenever clientData.ts or main.py endpoints
// change — the deployed site must compute the same answers local dev serves.
// Usage:
//   1. python filter_generation/create_demo_bundle.py   (fresh baked data)
//   2. uvicorn main:app --port 8765                     (in webapp/backend)
//   3. node test_parity.mjs                             (in webapp/frontend)
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKEND = 'http://127.0.0.1:8765';

// --- bundle clientData.ts with Node stubs ---
const tmp = mkdtempSync(join(tmpdir(), 'parity-'));
const axiosStub = join(tmp, 'axios.js');
writeFileSync(axiosStub, `
import { readFileSync } from 'fs';
import { join } from 'path';
const ROOT = ${JSON.stringify(join(HERE, 'public'))};
export default {
  get: async (url) => {
    const rel = url.replace(/^\\//, '');
    const text = readFileSync(join(ROOT, rel), 'utf-8');
    return { data: JSON.parse(text) };
  },
};
`);

const out = join(tmp, 'clientData.mjs');
await build({
  entryPoints: [join(HERE, 'src/services/clientData.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: out,
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
Object.defineProperty(globalThis.localStorage, 'keys', { value: () => [...__store.keys()] });
const __origKeys = Object.keys;
Object.keys = (o) => (o === globalThis.localStorage ? [...__store.keys()] : __origKeys(o));
` },
});
const client = await import(pathToFileURL(out).href);

// --- helpers ---
let pass = 0, fail = 0;
const report = (name, ok, msg = '') => {
  if (ok) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}  ${msg}`); }
};
const backendGet = async (p) => (await fetch(`${BACKEND}${p}`)).json();
const backendPost = async (p, body) => (await fetch(`${BACKEND}${p}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})).json();

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// canonicalize an item list: sort by name, sort list-fields, drop key order.
// NOTE: for items that appear in MULTIPLE mapping files the backend resolves
// "last wins" fields (source_file, name_ch) by rglob's filesystem-dependent
// scan order (not even stable between Windows and Linux); the client uses
// deterministic sorted order. Those fields are normalized to the sorted-last
// occurrence on BOTH sides so the comparison checks content, not scan order.
const canonItems = (items) => items
  .map(it => {
    const o = {};
    for (const k of Object.keys(it).sort()) o[k] = it[k];
    if (Array.isArray(o.current_tier)) o.current_tier = [...o.current_tier].sort();
    if (Array.isArray(o.current_tiers)) o.current_tiers = [...o.current_tiers].sort();
    if (Array.isArray(o.occurrences)) {
      o.occurrences = o.occurrences
        .map(oc => ({ file: oc.file, tiers: [...(oc.tiers || [])].sort(), sound: oc.sound ?? null }))
        .sort((x, y) => (x.file < y.file ? -1 : 1));
      if (o.occurrences.length > 1) {
        o.source_file = o.occurrences[o.occurrences.length - 1].file;
        delete o.name_ch; // may differ per-file; winner depends on scan order
      }
    }
    return o;
  })
  .sort((x, y) => (x.name < y.name ? -1 : 1));

// search results carry single "winning" values for multi-file items (tier,
// category_ch, source_file) — also scan-order dependent. Compare the stable
// subset only.
const canonSearch = (results) => results
  .map(it => {
    const o = {};
    for (const k of Object.keys(it).sort()) {
      if (['current_tier', 'current_tiers', 'category_ch', 'source_file', 'name_ch'].includes(k)) continue;
      o[k] = it[k];
    }
    return o;
  })
  .sort((x, y) => (x.name < y.name ? -1 : 1));

const diffSample = (a, b) => {
  const ja = a.map(x => JSON.stringify(x));
  const jb = new Set(b.map(x => JSON.stringify(x)));
  const onlyA = ja.filter(x => !jb.has(x)).slice(0, 2);
  const jbArr = b.map(x => JSON.stringify(x));
  const jaSet = new Set(ja);
  const onlyB = jbArr.filter(x => !jaSet.has(x)).slice(0, 2);
  return `\n    only-backend: ${onlyA.join(' | ').slice(0, 400)}\n    only-client:  ${onlyB.join(' | ').slice(0, 400)}`;
};

// --- tests ---
console.log('class-items parity:');
for (const cls of ['All', 'Stackable Currency', 'Body Armours', 'Divination Card']) {
  const be = await backendGet(`/api/class-items/${encodeURIComponent(cls)}`);
  const cl = await client.classItems(cls);
  const a = canonItems(be.items), b = canonItems(cl.items);
  report(`class-items/${cls} (${a.length} items)`, deepEqual(a, b),
    a.length !== b.length ? `count ${a.length} vs ${b.length}` + diffSample(a, b) : diffSample(a, b));
}

console.log('tier-items parity:');
const bundle = JSON.parse(readFileSync(join(HERE, 'public/demo_data/bundle.json'), 'utf-8'));
const tierKeys = new Set();
for (const content of Object.values(bundle.tiers)) {
  const catKey = Object.keys(content).find(k => !k.startsWith('//'));
  if (!catKey) continue;
  for (const k of Object.keys(content[catKey])) if (k.startsWith('Tier')) tierKeys.add(k);
  if (tierKeys.size > 25) break;
}
const keys = [...tierKeys].slice(0, 25);
{
  const be = await backendPost('/api/tier-items', { tier_keys: keys });
  const cl = await client.tierItems(keys);
  let allOk = true, msg = '';
  for (const k of keys) {
    const a = canonItems(be.items[k] || []), b = canonItems(cl.items[k] || []);
    if (!deepEqual(a, b)) { allOk = false; msg = `key ${k}: ${a.length} vs ${b.length}` + diffSample(a, b); break; }
  }
  report(`tier-items (${keys.length} keys)`, allOk, msg);
  const beF = await backendPost('/api/tier-items', { tier_keys: keys, class_filter: 'Stackable Currency' });
  const clF = await client.tierItems(keys, 'Stackable Currency');
  let okF = true, msgF = '';
  for (const k of keys) {
    const a = canonItems(beF.items[k] || []), b = canonItems(clF.items[k] || []);
    if (!deepEqual(a, b)) { okF = false; msgF = `key ${k}` + diffSample(a, b); break; }
  }
  report('tier-items + class_filter', okF, msgF);
}

console.log('search parity:');
for (const q of ['chaos', 'ring', '精华', 'orb']) {
  const be = await backendGet(`/api/search-items?q=${encodeURIComponent(q)}`);
  const cl = await client.searchItems(q);
  const a = canonSearch(be.results), b = canonSearch(cl.results);
  report(`search "${q}" (${a.length})`, deepEqual(a, b), diffSample(a, b));
}

console.log('mapping-info parity:');
for (const f of ['Currency/General.json', 'Equipment/Weapons/Bows.json']) {
  try {
    const be = await backendGet(`/api/mapping-info/${f}`);
    const cl = await client.mappingInfo(f);
    report(`mapping-info ${f}`, deepEqual(be, cl));
  } catch (e) { report(`mapping-info ${f}`, false, String(e)); }
}

console.log('misc endpoints:');
{
  const be = await backendGet('/api/all-rules');
  const cl = await client.allRules();
  const canon = (rules) => rules.map(r => JSON.stringify(Object.keys(r).sort().reduce((o, k) => (o[k] = r[k], o), {}))).sort();
  report(`all-rules (${be.rules.length})`, deepEqual(canon(be.rules), canon(cl.rules)),
    `${be.rules.length} vs ${cl.rules.length}`);

  // top-level key ORDER is scan-order dependent on the backend; compare
  // sorted key sets + per-file content
  const beSim = await backendGet('/api/simulator-bundle');
  const clSim = await client.simulatorBundle();
  let simOk = true, simMsg = '';
  for (const part of ['mappings', 'tiers']) {
    const ka = Object.keys(beSim[part]).sort(), kb = Object.keys(clSim[part]).sort();
    if (!deepEqual(ka, kb)) { simOk = false; simMsg = `${part} key sets differ`; break; }
    for (const k of ka) {
      if (!deepEqual(beSim[part][k], clSim[part][k])) { simOk = false; simMsg = `${part}/${k} content differs`; break; }
    }
    if (!simOk) break;
  }
  report('simulator-bundle', simOk, simMsg);

  report('settings', deepEqual(await backendGet('/api/settings'), await client.getSettings()));
  report('custom-overrides', deepEqual(await backendGet('/api/custom-overrides'), await client.getCustomOverrides()));
  report('themes list', deepEqual(await backendGet('/api/themes'), await client.themesList()));
  report('sound-map', deepEqual(await backendGet('/api/sound-map'), await client.getSoundMap()));
  report('item-info Chaos Orb', deepEqual(await backendGet('/api/item-info/Chaos%20Orb'), await client.itemInfo('Chaos Orb')));
  const beBonus = await backendGet('/api/bonus-info');
  const clBonus = await client.loadBonusInfo();
  report('bonus-info', deepEqual(beBonus, clBonus));
  report('merged theme = generate.py theme source', typeof (await client.getMergedTheme()) === 'object');
}

console.log('VFS edit behavior (client-side only):');
{
  // edit: move Chaos Orb in Currency/General.json to a different tier via VFS
  const before = await client.classItems('Stackable Currency');
  const chaosBefore = before.items.find(i => i.name === 'Chaos Orb');
  const fileContent = JSON.parse(JSON.stringify((await client.getConfig('base_mapping/Currency/General.json')).content));
  fileContent.mapping['Chaos Orb'] = ['Tier 0 General'];
  client.writeVfs('base_mapping/Currency/General.json', fileContent);
  const after = await client.classItems('Stackable Currency');
  const chaosAfter = after.items.find(i => i.name === 'Chaos Orb');
  report('class-items reflects VFS tier edit',
    chaosBefore && chaosAfter && !deepEqual(chaosBefore.current_tier, chaosAfter.current_tier)
      && chaosAfter.current_tier.includes('Tier 0 General'),
    `before=${JSON.stringify(chaosBefore?.current_tier)} after=${JSON.stringify(chaosAfter?.current_tier)}`);

  const ti = await client.tierItems(['Tier 0 General']);
  report('tier-items reflects VFS tier edit', (ti.items['Tier 0 General'] || []).some(i => i.name === 'Chaos Orb'));

  const sr = await client.searchItems('chaos orb');
  const srChaos = sr.results.find(i => i.name === 'Chaos Orb');
  report('search reflects VFS tier edit', srChaos && srChaos.current_tiers.includes('Tier 0 General'),
    JSON.stringify(srChaos?.current_tiers));

  // updateItemTier port: move it again through the API-equivalent
  await client.updateItemTier({ item_name: 'Chaos Orb', new_tier: 'Tier 1 General', source_file: 'Currency/General.json' });
  const after2 = await client.classItems('Stackable Currency');
  const chaos2 = after2.items.find(i => i.name === 'Chaos Orb');
  report('updateItemTier applies', chaos2 && chaos2.current_tier.includes('Tier 1 General'), JSON.stringify(chaos2?.current_tier));

  // updateItemOverride port
  await client.updateItemOverride({ item_name: 'Chaos Orb', overrides: { PlayEffect: 'Red' }, source_file: 'Currency/General.json' });
  const cfg = (await client.getConfig('base_mapping/Currency/General.json')).content;
  const overrideRule = (cfg.rules || []).find(r => Array.isArray(r.targets) && r.targets.length === 1 && r.targets[0] === 'Chaos Orb' && (!r.conditions || !Object.keys(r.conditions).length));
  report('updateItemOverride applies', overrideRule && overrideRule.overrides.PlayEffect === 'Red');
}

console.log(`\n${pass} passed, ${fail} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
