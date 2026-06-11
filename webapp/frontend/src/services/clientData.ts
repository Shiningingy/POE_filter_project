// Client-side data layer for the deployed (backend-free) build.
//
// Each function here is a direct port of the corresponding FastAPI endpoint in
// webapp/backend/main.py, computed over the MERGED state: the static data
// bundle baked at build time (create_demo_bundle.py) overlaid with the user's
// in-browser edits (localStorage VFS, `demo_vfs_*` keys). demoAdapter.ts routes
// the axios calls into these functions.
//
// Keep the algorithms in sync with main.py - local dev runs the Python
// versions, the deployed site runs these.

import axios from 'axios';

export const VFS_PREFIX = 'demo_vfs_';

const SOUND_KEYS = ['CustomAlertSound', 'AlertSound', 'DropSound', 'PlayAlertSound'];

interface ItemsDb {
  classes: string[];
  items: Record<string, any>; // name -> {name_ch, sub_type, item_class, drop_level, ...}
  categoryMap: Record<string, string>; // "base_mapping/..." -> ch label
  extraTranslations?: Record<string, string>; // zh names for items outside BaseTypes.csv
}

export interface MergedState {
  mappings: Record<string, any>; // key relative to base_mapping/
  tiers: Record<string, any>;    // key relative to tier_definition/
}

const baseUrl = () => {
  const b = import.meta.env.BASE_URL;
  return b.endsWith('/') ? b : b + '/';
};

const fetchStatic = async (name: string): Promise<any> => {
  const res = await axios.get(`${baseUrl()}demo_data/${name}`, { baseURL: '' });
  return res.data;
};

// --- lazy static caches ---

let _bundle: any = null;
let _itemsDb: ItemsDb | null = null;
let _bonusInfo: any = null;

export const loadBundle = async (): Promise<any> => {
  if (!_bundle) {
    try { _bundle = await fetchStatic('bundle.json'); }
    catch (e) { console.error('Failed to load data bundle', e); return null; }
  }
  return _bundle;
};

export const loadItemsDb = async (): Promise<ItemsDb> => {
  if (!_itemsDb) {
    try { _itemsDb = await fetchStatic('items_db.json'); }
    catch (e) { console.error('Failed to load items db', e); _itemsDb = { classes: [], items: {}, categoryMap: {} }; }
  }
  return _itemsDb!;
};

export const loadBonusInfo = async (): Promise<any> => {
  if (!_bonusInfo) {
    try { _bonusInfo = await fetchStatic('bonus_info.json'); }
    catch { _bonusInfo = { items: {}, uniques: {} }; }
  }
  return _bonusInfo;
};

// --- VFS + merged state ---

export const readVfs = (rel: string): any | null => {
  const raw = localStorage.getItem(VFS_PREFIX + rel);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

export const writeVfs = (rel: string, content: any) => {
  localStorage.setItem(VFS_PREFIX + rel, JSON.stringify(content));
  invalidateMerged();
};

let _merged: MergedState | null = null;
export const invalidateMerged = () => { _merged = null; };

/** Bundle files overlaid with localStorage VFS edits. Values may share
 *  references with the bundle - treat as read-only; clone before mutating. */
export const getMergedState = async (): Promise<MergedState> => {
  if (_merged) return _merged;
  const bundle = await loadBundle();
  const mappings: Record<string, any> = { ...(bundle?.mappings || {}) };
  const tiers: Record<string, any> = { ...(bundle?.tiers || {}) };
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(VFS_PREFIX)) continue;
    const rel = key.slice(VFS_PREFIX.length);
    try {
      const content = JSON.parse(localStorage.getItem(key)!);
      if (rel.startsWith('base_mapping/')) mappings[rel.slice('base_mapping/'.length)] = content;
      else if (rel.startsWith('tier_definition/')) tiers[rel.slice('tier_definition/'.length)] = content;
    } catch { /* skip unparsable */ }
  }
  _merged = { mappings, tiers };
  return _merged;
};

// codepoint order, matching Python's sorted() on the backend
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// _meta.localization.ch is occasionally a plain string in the data -
// the backend's `in`/`get` degrade gracefully there; mirror that.
const chLocalization = (data: any): Record<string, string> => {
  const ch = data?._meta?.localization?.ch;
  return ch && typeof ch === 'object' && !Array.isArray(ch) ? ch : {};
};

const sortedEntries = (obj: Record<string, any>) =>
  Object.entries(obj).sort(([a], [b]) => cmp(a, b));

// item details WITHOUT name_ch/sub_type (mirrors backend ITEM_DETAILS, whose
// spreads must not clobber the explicitly-set translation fields)
const detailsOf = (db: ItemsDb, name: string): Record<string, any> => {
  const { name_ch: _nc, sub_type: _st, ...rest } = db.items[name] || {};
  return rest;
};

const itemClassOf = (db: ItemsDb, name: string): string | undefined =>
  db.items[name]?.item_class;

// mirrors backend ITEM_TRANSLATIONS.get(name, name)
const nameChOf = (db: ItemsDb, name: string): string =>
  db.items[name]?.name_ch ?? db.extraTranslations?.[name] ?? name;

// --- ported endpoints ---

/** GET /api/class-items/{item_class} (main.py get_items_by_class) */
export const classItems = async (itemClass: string) => {
  const db = await loadItemsDb();
  const { mappings } = await getMergedState();
  const itemData: Record<string, any> = {};

  const newItem = (name: string) => ({
    name,
    name_ch: nameChOf(db, name),
    sub_type: db.items[name]?.sub_type ?? 'Other',
    ...detailsOf(db, name),
    current_tier: [] as string[],
    source_file: null as string | null,
    occurrences: [] as any[],
  });

  const requested = itemClass === 'All'
    ? Object.keys(db.items)
    : Object.keys(db.items).filter(n => itemClassOf(db, n) === itemClass);
  for (const name of requested) itemData[name] = newItem(name);

  for (const [relFile, data] of sortedEntries(mappings)) {
    const mapping = data?.mapping || {};
    const rules: any[] = Array.isArray(data?.rules) ? data.rules : [];
    const trans = chLocalization(data);

    const allPossible = new Set<string>(Object.keys(mapping));
    rules.forEach(r => (Array.isArray(r?.targets) ? r.targets : []).forEach((t: string) => allPossible.add(t)));

    for (const itemName of allPossible) {
      if (!(itemName in itemData)) {
        // Only inject tiered items from other classes when viewing "All"
        // (e.g. Corpses tiered in Currency/Corpses.json must not leak).
        if (itemClass !== 'All' && itemClassOf(db, itemName) !== itemClass) continue;
        itemData[itemName] = newItem(itemName);
      }
      const currentList: string[] = itemData[itemName].current_tier;
      const fileTiers: string[] = [];

      if (itemName in mapping) {
        const tval = mapping[itemName];
        const tiers = Array.isArray(tval) ? tval : [tval];
        for (const t of tiers) {
          if (!currentList.includes(t)) currentList.push(t);
          if (!fileTiers.includes(t)) fileTiers.push(t);
        }
      }

      let fileSound: any = null;
      for (const r of rules) {
        const rTargets = Array.isArray(r?.targets) ? r.targets : [];
        if (rTargets.length && rTargets.includes(itemName)) {
          const over = r?.overrides || {};
          const tierOverride = over.Tier;
          if (tierOverride && !currentList.includes(tierOverride)) currentList.push(tierOverride);
          if (tierOverride && !fileTiers.includes(tierOverride)) fileTiers.push(tierOverride);
          if (fileSound === null) {
            const soundKey = SOUND_KEYS.find(k => k in over);
            if (soundKey) {
              const sval = over[soundKey];
              fileSound = Array.isArray(sval) && sval.length ? sval[0] : sval;
            }
          }
        }
      }

      itemData[itemName].source_file = relFile;
      itemData[itemName].occurrences.push({ file: relFile, tiers: fileTiers, sound: fileSound });
      if (itemName in trans) itemData[itemName].name_ch = trans[itemName];
    }
  }

  return { items: Object.values(itemData) };
};

/** POST /api/tier-items (main.py get_items_by_tier) */
export const tierItems = async (tierKeys: string[], classFilter?: string | null) => {
  const db = await loadItemsDb();
  const { mappings } = await getMergedState();
  const tierKeySet = new Set(tierKeys);
  const result: Record<string, any[]> = {};
  tierKeySet.forEach(k => { result[k] = []; });

  for (const [relFile, data] of sortedEntries(mappings)) {
    const mapping = data?.mapping || {};
    const rules: any[] = Array.isArray(data?.rules) ? data.rules : [];
    const meta = data?._meta || {};
    const trans = chLocalization(data);
    const matchModes = meta?.match_modes || {};

    const allInvolved = new Set<string>(Object.keys(mapping));
    rules.forEach(r => (Array.isArray(r?.targets) ? r.targets : []).forEach((t: string) => allInvolved.add(t)));

    for (const itemName of allInvolved) {
      if (classFilter && itemClassOf(db, itemName) !== classFilter) continue;

      const finalTierEntries: Array<[string, number | null]> = [];
      if (itemName in mapping) {
        const tval = mapping[itemName];
        const baseTiers = Array.isArray(tval) ? tval : [tval];
        baseTiers.forEach(t => finalTierEntries.push([t, null]));
      }
      rules.forEach((r, idx) => {
        const rt = r?.targets;
        if (Array.isArray(rt) && rt.length > 0 && rt.includes(itemName)) {
          const tOver = r?.overrides?.Tier;
          if (tOver) finalTierEntries.push([tOver, idx]);
        }
      });

      for (const [tierKey, ruleIdx] of finalTierEntries) {
        if (!tierKeySet.has(tierKey)) continue;
        const currentTiersList = [...new Set(finalTierEntries.map(([t]) => t))];
        let itemMode = 'exact';
        if (ruleIdx !== null) {
          itemMode = rules[ruleIdx]?.targetMatchModes?.[itemName] ?? 'exact';
        } else {
          itemMode = matchModes[itemName] ?? 'exact';
        }
        result[tierKey].push({
          name: itemName,
          name_ch: trans[itemName] ?? itemName,
          sub_type: db.items[itemName]?.sub_type ?? 'Other',
          current_tiers: currentTiersList,
          source: relFile,
          rule_index: ruleIdx,
          match_mode: itemMode,
          ...detailsOf(db, itemName),
        });
      }
    }
  }

  return { items: result };
};

/** GET /api/search-items?q= (main.py search_items) */
export const searchItems = async (q: string) => {
  if (!q) return { results: [] };
  const db = await loadItemsDb();
  const { mappings } = await getMergedState();
  const qLower = q.toLowerCase();
  const resultsMap: Record<string, any> = {};

  // 1. Tiered items from mappings
  for (const [relFile, data] of sortedEntries(mappings)) {
    const mapping = data?.mapping || {};
    const trans = chLocalization(data);
    const catCh = db.categoryMap[`base_mapping/${relFile}`] || '';
    for (const [itemName, tierVal] of Object.entries(mapping)) {
      const nameCh: string = trans[itemName] || '';
      if (itemName.toLowerCase().includes(qLower) || (nameCh && nameCh.toLowerCase().includes(qLower))) {
        const tiers = Array.isArray(tierVal) ? tierVal : [tierVal];
        resultsMap[itemName] = {
          name: itemName,
          name_ch: nameCh || itemName,
          current_tier: tiers.length ? tiers[0] : null,
          current_tiers: tiers,
          category_ch: catCh,
          sub_type: db.items[itemName]?.sub_type ?? 'Other',
          source_file: relFile,
          ...detailsOf(db, itemName),
        };
      }
    }
  }

  // 2. Untiered items from the base-type DB
  for (const itemName of Object.keys(db.items)) {
    if (itemName in resultsMap) continue;
    const nameCh = db.items[itemName]?.name_ch ?? itemName;
    if (itemName.toLowerCase().includes(qLower) || nameCh.toLowerCase().includes(qLower)) {
      resultsMap[itemName] = {
        name: itemName,
        name_ch: nameCh,
        current_tier: null,
        current_tiers: [],
        sub_type: db.items[itemName]?.sub_type ?? 'Other',
        source_file: null,
        ...detailsOf(db, itemName),
      };
    }
  }

  let results = Object.values(resultsMap);
  results.sort((a, b) => cmp(a.name, b.name));
  if (results.length > 50) results = results.slice(0, 50);
  return { results };
};

/** GET /api/mapping-info/{file} (main.py get_mapping_info) */
export const mappingInfo = async (fileName: string) => {
  const { mappings, tiers } = await getMergedState();
  const mappingContent = mappings[fileName];
  if (!mappingContent) throw new Error(`Mapping not found: ${fileName}`);
  const themeCategory = mappingContent?._meta?.theme_category;

  const availableTiers: any[] = [];
  const tierDefs = tiers[fileName];
  if (tierDefs) {
    const categoryKey = Object.keys(tierDefs).find(k => !k.startsWith('//'));
    if (categoryKey) {
      const categoryData = tierDefs[categoryKey];
      const catLoc = categoryData?._meta?.localization || {};
      const catEn = catLoc.en ?? categoryKey;
      const catCh = catLoc.ch ?? catEn;
      for (const [k, v] of Object.entries<any>(categoryData)) {
        if (k.startsWith('Tier')) {
          const tNum = v?.theme?.Tier ?? '?';
          availableTiers.push({
            key: k,
            label_en: v?.localization?.en ?? `Tier ${tNum} ${catEn}`,
            label_ch: v?.localization?.ch ?? `T${tNum} ${catCh}`,
            show_in_editor: v?.show_in_editor ?? true,
            is_hide_tier: v?.is_hide_tier ?? false,
          });
        }
      }
    }
  }
  availableTiers.sort((a, b) => {
    const num = (key: string) => { const m = key.match(/Tier (\d+)/); return m ? parseInt(m[1], 10) : 999; };
    return num(a.key) - num(b.key);
  });

  return {
    content: mappingContent,
    theme_category: themeCategory,
    available_tiers: availableTiers,
    item_translations: mappingContent?._meta?.localization?.ch || {},
  };
};

/** GET /api/all-rules (main.py get_all_rules) */
export const allRules = async () => {
  const { mappings } = await getMergedState();
  const rules: any[] = [];
  for (const [relFile, data] of sortedEntries(mappings)) {
    let fileRules: any[] = Array.isArray(data?.rules) ? data.rules : [];
    if (!fileRules.length) {
      // old format fallback: rules nested under the category key
      const catKey = Object.keys(data || {}).find(k => !k.startsWith('//') && k !== 'mapping' && k !== '_meta');
      if (catKey && data[catKey] && typeof data[catKey] === 'object') {
        fileRules = data[catKey].rules || data[catKey]?._meta?.rules || [];
      }
    }
    const fileName = relFile.split('/').pop() || relFile;
    fileRules.forEach(r => rules.push({ ...r, _source_file: fileName }));
  }
  return { rules };
};

/** GET /api/simulator-bundle (main.py get_simulator_bundle) - keys carry the
 *  base_mapping/ and tier_definition/ prefixes, unlike the raw bundle. */
export const simulatorBundle = async () => {
  const { mappings, tiers } = await getMergedState();
  const prefixedMappings: Record<string, any> = {};
  const prefixedTiers: Record<string, any> = {};
  Object.entries(mappings).forEach(([rel, content]) => { prefixedMappings[`base_mapping/${rel}`] = content; });
  Object.entries(tiers).forEach(([rel, content]) => { prefixedTiers[`tier_definition/${rel}`] = content; });
  return { mappings: prefixedMappings, tiers: prefixedTiers };
};

// --- write endpoints (mutate VFS copies) ---

const stripMappingPrefix = (sourceFile: string) =>
  sourceFile.startsWith('base_mapping/') ? sourceFile.slice('base_mapping/'.length) : sourceFile;

const getMappingFileForEdit = async (sourceFile: string): Promise<{ rel: string; data: any }> => {
  const rel = stripMappingPrefix(sourceFile);
  const { mappings } = await getMergedState();
  const current = mappings[rel];
  if (!current) throw new Error(`Mapping file not found: ${rel}`);
  return { rel, data: JSON.parse(JSON.stringify(current)) };
};

export interface UpdateItemTierRequest {
  item_name: string;
  new_tier?: string | null;
  source_file: string;
  is_append?: boolean;
  old_tier?: string | null;
  new_tiers?: string[] | null;
  match_mode?: string | null;
}

/** POST /api/update-item-tier (main.py update_item_tier) */
export const updateItemTier = async (req: UpdateItemTierRequest) => {
  if (!req.source_file) throw new Error('Source file is required');
  const db = await loadItemsDb();
  const { rel, data } = await getMappingFileForEdit(req.source_file);
  const mapping = data.mapping || {};

  // 1. Localization
  if (!data._meta) data._meta = {};
  if (!data._meta.localization) data._meta.localization = { en: {}, ch: {} };
  if (!data._meta.localization.ch) data._meta.localization.ch = {};
  if (!(req.item_name in data._meta.localization.ch)) {
    const trans = nameChOf(db, req.item_name);
    if (trans && trans !== req.item_name) data._meta.localization.ch[req.item_name] = trans;
  }

  // 2. Match mode
  if (!data._meta.match_modes) data._meta.match_modes = {};
  if (req.match_mode) data._meta.match_modes[req.item_name] = req.match_mode;

  // 3. Mapping update
  if (req.new_tiers !== undefined && req.new_tiers !== null) {
    mapping[req.item_name] = req.new_tiers;
  } else if (!req.new_tier) {
    // delete logic
    if (req.item_name in mapping) {
      const current = mapping[req.item_name];
      if (req.old_tier && Array.isArray(current)) {
        const idx = current.indexOf(req.old_tier);
        if (idx !== -1) current.splice(idx, 1);
        if (!current.length) delete mapping[req.item_name];
        else mapping[req.item_name] = current;
      } else if (req.old_tier && current === req.old_tier) {
        delete mapping[req.item_name];
      } else if (!req.old_tier) {
        delete mapping[req.item_name];
      }
    }
  } else {
    const current = mapping[req.item_name];
    if (req.is_append) {
      if (current) {
        if (Array.isArray(current)) {
          if (!current.includes(req.new_tier)) { current.push(req.new_tier); mapping[req.item_name] = current; }
        } else if (current !== req.new_tier) {
          mapping[req.item_name] = [current, req.new_tier];
        }
      } else {
        mapping[req.item_name] = req.new_tier;
      }
    } else if (req.old_tier && current) {
      // move specific instance
      if (Array.isArray(current)) {
        const idx = current.indexOf(req.old_tier);
        if (idx !== -1) current.splice(idx, 1);
        if (!current.includes(req.new_tier)) current.push(req.new_tier);
        mapping[req.item_name] = current;
      } else if (current === req.old_tier) {
        mapping[req.item_name] = req.new_tier;
      }
    } else {
      mapping[req.item_name] = req.new_tier;
    }
  }

  data.mapping = mapping;
  writeVfs(`base_mapping/${rel}`, data);
  return { message: 'Success' };
};

export interface UpdateItemOverrideRequest {
  item_name: string;
  overrides: Record<string, any>;
  source_file: string;
}

/** POST /api/update-item-override (main.py update_item_override) */
export const updateItemOverride = async (req: UpdateItemOverrideRequest) => {
  const { rel, data } = await getMappingFileForEdit(req.source_file);
  const rules: any[] = Array.isArray(data.rules) ? data.rules : [];
  let found = false;
  for (const rule of rules) {
    const targets = rule?.targets;
    const noConditions = !rule?.conditions || Object.keys(rule.conditions).length === 0;
    if (Array.isArray(targets) && targets.length === 1 && targets[0] === req.item_name && noConditions) {
      rule.overrides = { ...(rule.overrides || {}), ...req.overrides };
      found = true;
      break;
    }
  }
  if (!found) {
    rules.push({ targets: [req.item_name], conditions: {}, overrides: req.overrides, comment: `Override for ${req.item_name}` });
  }
  data.rules = rules;
  writeVfs(`base_mapping/${rel}`, data);
  return { message: 'Success' };
};

// --- settings / overrides / themes / bonus info ---

/** GET /api/settings (main.py get_settings) - VFS shadow over bundle seed */
export const getSettings = async () => {
  const vfs = readVfs('settings.json');
  const bundle = await loadBundle();
  const data = vfs ?? bundle?.settings ?? {};
  if (!data || Object.keys(data).length === 0) return { base_theme: 'sharket' };
  if (data.active_theme && !data.base_theme) data.base_theme = data.active_theme;
  return data;
};

/** POST /api/settings (merges over existing, like the backend) */
export const saveSettings = async (content: Record<string, any>) => {
  const existing = await getSettings();
  writeVfs('settings.json', { ...existing, ...content });
  return { message: 'Success' };
};

export const getCustomOverrides = async () => {
  const saved = localStorage.getItem('demo_custom_overrides');
  if (saved) { try { return JSON.parse(saved); } catch { /* fall through */ } }
  const bundle = await loadBundle();
  return bundle?.customOverrides ?? {};
};

/** GET /api/themes - static list + presets saved/imported in this browser */
export const themesList = async () => {
  let staticThemes: string[] = [];
  try { staticThemes = (await fetchStatic('themes.json'))?.themes || []; } catch { /* none */ }
  const local = Object.keys(localStorage)
    .filter(k => k.startsWith('demo_theme_'))
    .map(k => k.slice('demo_theme_'.length));
  return { themes: [...new Set([...staticThemes, ...local])] };
};

/** GET /api/sound-map - VFS shadow over bundle */
export const getSoundMap = async () => {
  const vfs = readVfs('theme/sharket/Sharket_sound_map.json');
  if (vfs) return vfs;
  const bundle = await loadBundle();
  return bundle?.soundMap ?? {};
};

/** GET /api/themes/{name} - locally saved preset shadows the static one */
export const themeData = async (themeName: string) => {
  const saved = localStorage.getItem(`demo_theme_${themeName}`);
  if (saved) {
    let content: any = {};
    try { content = JSON.parse(saved); } catch { /* empty */ }
    const data = content?.theme_data || content;
    const soundMapData = themeName === 'sharket' ? await getSoundMap() : {};
    return { theme_name: themeName, theme_data: data, sound_map_data: soundMapData };
  }
  return fetchStatic(`theme_${themeName}.json`);
};

/** Theme as the generator sees it (generate.py load_merged_theme): the preset
 *  selected in settings, with custom_overrides merged per category/tier. */
export const getMergedTheme = async () => {
  const settings = await getSettings();
  const baseName = settings.base_theme || 'sharket';
  let base: any = null;
  try { base = (await themeData(baseName))?.theme_data; } catch { /* missing preset */ }
  if (!base || Object.keys(base).length === 0) {
    try { base = (await themeData('sharket'))?.theme_data; } catch { base = {}; }
  }
  const merged = JSON.parse(JSON.stringify(base || {}));
  const overrides = await getCustomOverrides();
  for (const [cat, tiers] of Object.entries<any>(overrides || {})) {
    if (!merged[cat]) merged[cat] = {};
    for (const [tier, style] of Object.entries<any>(tiers || {})) {
      merged[cat][tier] = { ...(merged[cat][tier] || {}), ...style };
    }
  }
  return merged;
};

/** GET /api/item-info/{base_type} (main.py get_item_info) */
export const itemInfo = async (baseType: string) => {
  const bonus = await loadBonusInfo();
  const info = bonus.items?.[baseType] || {};
  const unique = bonus.uniques?.[baseType] || {};
  return {
    description: info.description || '',
    tags: info.tags || [],
    baseText: unique.text ?? null,
    uniques: unique.uniques || [],
  };
};

/** GET /api/config/{path} 鈥?VFS shadow, then bundle lookup */
export const getConfig = async (configPath: string) => {
  const vfs = readVfs(configPath);
  if (vfs !== null) return { content: vfs };
  const bundle = await loadBundle();
  if (configPath.startsWith('base_mapping/')) {
    const content = bundle?.mappings?.[configPath.slice('base_mapping/'.length)];
    if (content !== undefined) return { content };
  } else if (configPath.startsWith('tier_definition/')) {
    const content = bundle?.tiers?.[configPath.slice('tier_definition/'.length)];
    if (content !== undefined) return { content };
  } else if (configPath === 'theme/sharket/sharket_theme.json') {
    return { content: bundle?.theme ?? {} };
  } else if (configPath === 'theme/sharket/Sharket_sound_map.json') {
    return { content: bundle?.soundMap ?? {} };
  } else if (configPath === 'theme/custom_overrides.json') {
    return { content: await getCustomOverrides() };
  } else if (configPath === 'settings.json') {
    return { content: await getSettings() };
  }
  throw new Error(`Config not found: ${configPath}`);
};
