// Standalone theme-preset and sound export/import files (smaller, shareable
// alternatives to the full filter snapshot). All building/parsing/matching is
// client-side; saves go through the existing read/write endpoints.

export const THEME_EXPORT_FORMAT = 'sharket-theme-export';
export const SOUND_EXPORT_FORMAT = 'sharket-sound-export';
export const EXPORT_VERSION = 1;

// Same override keys the Sound Bulk Editor treats as "sound" (SOUND_KEYS there).
export const SOUND_OVERRIDE_KEYS = ['PlayAlertSound', 'CustomAlertSound', 'AlertSound', 'DropSound'] as const;

export interface ThemeExport {
  format: string;
  version: number;
  created?: string;
  name: string;
  theme_data: Record<string, unknown>;
}

export interface SoundExportRule {
  file: string;                       // relative path incl. base_mapping/ prefix
  comment?: string;
  targets: string[];
  conditions?: Record<string, unknown>;
  overrides: Record<string, unknown>; // sound keys only
}

export interface SoundExport {
  format: string;
  version: number;
  created?: string;
  sound_map: { basetype_sounds?: Record<string, unknown>; class_sounds?: Record<string, unknown> };
  rules: SoundExportRule[];
}

export type SkipReason = 'file-missing' | 'no-matching-rule' | 'target-not-in-file';

export interface MatchResult {
  action: 'update' | 'create' | 'skip';
  reason?: SkipReason;
  ruleIndex?: number; // for 'update'
}

export const downloadJson = (obj: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

// --- theme preset ---

export const buildThemeExport = (name: string, themeData: Record<string, unknown>): ThemeExport => ({
  format: THEME_EXPORT_FORMAT,
  version: EXPORT_VERSION,
  created: nowIso(),
  name,
  theme_data: themeData,
});

/** Returns the parsed export, 'newer' when made by a newer app, or null when invalid. */
export const parseThemeExport = (text: string): ThemeExport | 'newer' | null => {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.format !== THEME_EXPORT_FORMAT || !parsed.theme_data) return null;
    if (parsed.version > EXPORT_VERSION) return 'newer';
    return parsed as ThemeExport;
  } catch {
    return null;
  }
};

// --- sounds ---

const pickSoundOverrides = (overrides: any): Record<string, unknown> | null => {
  if (!overrides) return null;
  const out: Record<string, unknown> = {};
  for (const k of SOUND_OVERRIDE_KEYS) {
    if (k in overrides) out[k] = overrides[k];
  }
  return Object.keys(out).length ? out : null;
};

/** Scan all base_mapping contents (simulator-bundle `mappings`, keys with or
 *  without the base_mapping/ prefix) for rules carrying a sound override. */
export const collectSoundRules = (allMappings: Record<string, any>): SoundExportRule[] => {
  const out: SoundExportRule[] = [];
  for (const [key, content] of Object.entries(allMappings)) {
    const file = key.startsWith('base_mapping/') ? key : `base_mapping/${key}`;
    const rules = Array.isArray(content?.rules) ? content.rules : [];
    for (const rule of rules) {
      const sound = pickSoundOverrides(rule?.overrides);
      if (!sound || !Array.isArray(rule.targets) || rule.targets.length === 0) continue;
      const entry: SoundExportRule = { file, targets: [...rule.targets], overrides: sound };
      if (rule.comment) entry.comment = rule.comment;
      if (rule.conditions && Object.keys(rule.conditions).length) entry.conditions = rule.conditions;
      out.push(entry);
    }
  }
  return out;
};

export const buildSoundExport = (
  soundMap: SoundExport['sound_map'],
  rules: SoundExportRule[],
): SoundExport => ({
  format: SOUND_EXPORT_FORMAT,
  version: EXPORT_VERSION,
  created: nowIso(),
  sound_map: soundMap || {},
  rules,
});

export const parseSoundExport = (text: string): SoundExport | 'newer' | null => {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.format !== SOUND_EXPORT_FORMAT) return null;
    if (parsed.version > EXPORT_VERSION) return 'newer';
    return {
      ...parsed,
      sound_map: parsed.sound_map || {},
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    } as SoundExport;
  } catch {
    return null;
  }
};

// --- matching ("apply only what aligns 100%") ---

const sameTargets = (a: unknown, b: unknown): boolean => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sb = [...b].sort();
  return [...a].sort().every((v, i) => v === sb[i]);
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual((a as any)[k], (b as any)[k]));
};

const emptyish = (conds: unknown) => !conds || Object.keys(conds as object).length === 0;

/** Decide how an exported sound rule lands in a local base_mapping file.
 *  1. same comment + same targets            -> update sound overrides in place
 *  2. pure __SOUND__ occurrence rule (no conditions) whose targets all exist in
 *     the file's mapping                      -> create (what the editor itself
 *     does; checked before the generic match so it never piggybacks on an
 *     unrelated condition-less tier rule)
 *  3. same targets + deep-equal conditions   -> update sound overrides in place
 *  4. otherwise                               -> skip with a reason
 */
export const matchSoundRule = (rule: SoundExportRule, fileContent: any): MatchResult => {
  const localRules: any[] = Array.isArray(fileContent?.rules) ? fileContent.rules : [];

  if (rule.comment) {
    const idx = localRules.findIndex(r => r?.comment === rule.comment && sameTargets(r?.targets, rule.targets));
    if (idx !== -1) return { action: 'update', ruleIndex: idx };
  }

  if ((rule.comment || '').startsWith('__SOUND__:') && emptyish(rule.conditions)) {
    const mapping = fileContent?.mapping || {};
    if (rule.targets.every(name => name in mapping)) return { action: 'create' };
    return { action: 'skip', reason: 'target-not-in-file' };
  }

  const condIdx = localRules.findIndex(r =>
    sameTargets(r?.targets, rule.targets)
    && deepEqual(r?.conditions || {}, rule.conditions || {}));
  if (condIdx !== -1) return { action: 'update', ruleIndex: condIdx };

  return { action: 'skip', reason: 'no-matching-rule' };
};

/** Apply a matched rule to the file content (mutates). Only sound override keys
 *  are touched — everything else on the local rule (Tier, styles) is preserved. */
export const applySoundRule = (rule: SoundExportRule, fileContent: any, match: MatchResult): void => {
  if (match.action === 'update' && match.ruleIndex !== undefined) {
    const local = fileContent.rules[match.ruleIndex];
    local.overrides = { ...(local.overrides || {}), ...rule.overrides };
  } else if (match.action === 'create') {
    if (!Array.isArray(fileContent.rules)) fileContent.rules = [];
    const created: any = { targets: [...rule.targets], overrides: { ...rule.overrides } };
    if (rule.comment) created.comment = rule.comment;
    fileContent.rules.push(created);
  }
};

/** Sound paths referenced anywhere in the export (map entries + rules), for the
 *  missing-mp3 warning. */
export const referencedSoundPaths = (exp: SoundExport): string[] => {
  const paths = new Set<string>();
  const add = (v: unknown) => {
    const p = Array.isArray(v) ? v[0] : v;
    if (typeof p === 'string' && p && !/^\d+$/.test(p)) paths.add(p);
  };
  for (const entry of Object.values(exp.sound_map.basetype_sounds || {})) add((entry as any)?.file);
  for (const entry of Object.values(exp.sound_map.class_sounds || {})) add((entry as any)?.file);
  for (const rule of exp.rules) for (const k of SOUND_OVERRIDE_KEYS) add((rule.overrides as any)?.[k]);
  return [...paths];
};
