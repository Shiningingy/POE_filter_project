// The locale ENGINE: which languages exist, how one falls back to another, and the
// single resolver every surface uses. Data lives next door in `localization.ts`.
//
// Why this is a separate module from the string table (ADR-0003 keeps `localization.ts`
// whole): that ADR forbids splitting on LINE COUNT and calls localization.ts "a
// translation data table". This file is not data — it is the behaviour behind a small
// interface, which is the seam ADR-0003 explicitly leaves open. See ADR-0008.
//
// ── Adding a language ──────────────────────────────────────────────────────────
// 1. Add a row to LOCALES below, naming its `fallback`.
// 2. Add that language's field to the rows in `localization.ts` (they are key-first,
//    so every string's variants sit together — a gap is visible on the line itself).
// 3. Run `node webapp/frontend/test_locale_coverage.mjs` for the list of what is missing.
// No component changes are needed: nothing outside this file branches on a language id.

/** One locale's identity and where it falls back when a string is missing. */
export interface LocaleMeta {
  /** Shown in the language switcher. */
  label: string;
  /** The locale to try next. `null` ends the chain. MUST NOT form a cycle. */
  fallback: string | null;
}

// `ch` is Simplified Chinese and is spelled 'ch', NOT 'zh' — a project-wide invariant
// (CLAUDE.md). 'zh' appears only inside some data FILENAMES.
//
// A future Traditional Chinese would be `tw: { fallback: 'ch' }`, not `'en'` — which is
// exactly why the chain is per-locale data rather than a hardcoded "everything -> en".
export const LOCALES = {
  en: { label: 'English', fallback: null },
  ch: { label: '简体中文', fallback: 'en' },
} as const satisfies Record<string, LocaleMeta>;

export type Language = keyof typeof LOCALES;

export const LANGUAGES = Object.keys(LOCALES) as Language[];

/** A translatable value: some locales may be absent, which is what `resolve` is for. */
export type Localized = Partial<Record<Language, string>>;

const isLanguage = (k: string): k is Language => Object.prototype.hasOwnProperty.call(LOCALES, k);

/**
 * True when `v` is a leaf translation bag (`{en, ch}`) rather than a group of them.
 * A bag is non-empty and every key is a known locale id, so the two shapes cannot be
 * confused — which is what lets `strings` nest groups without a marker field.
 */
export const isLocalized = (v: unknown): v is Localized => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v as object);
  return keys.length > 0 && keys.every(isLanguage);
};

const chainCache: Partial<Record<Language, Language[]>> = {};

/**
 * `lang`, then its fallback, then its fallback's fallback… Cycle-safe: a locale already
 * in the chain terminates it rather than looping forever.
 */
export const localeChain = (lang: Language): Language[] => {
  const hit = chainCache[lang];
  if (hit) return hit;
  const out: Language[] = [];
  let cur: string | null = lang;
  while (cur && isLanguage(cur) && !out.includes(cur)) {
    out.push(cur);
    cur = LOCALES[cur].fallback;
  }
  chainCache[lang] = out;
  return out;
};

/**
 * The ONE resolver. Returns `undefined` when no locale in the chain has a value —
 * deliberately, so callers can supply their own fallback with `??`.
 *
 * ⚠️ Do not "helpfully" return the key here. The previous implementation did, and
 * because a key string is always truthy it silently killed the `|| fallback` guard at
 * twelve call sites — e.g. the item-card style editor rendered `styleTextColor` instead
 * of 文本颜色, in BOTH languages, because its `|| k` could never fire. A resolver that
 * cannot express "missing" makes every downstream default unreachable.
 */
export const resolve = (bag: Localized | undefined | null, lang: Language): string | undefined => {
  if (!bag) return undefined;
  for (const l of localeChain(lang)) {
    const v = bag[l];
    if (typeof v === 'string' && v !== '') return v;
  }
  return undefined;
};

/** `resolve` with an explicit last resort. Reads better at a call site than `?? x`. */
export const label = (bag: Localized | undefined | null, lang: Language, fallback: string): string =>
  resolve(bag, lang) ?? fallback;

/** Every locale that is missing a value for `bag`. Used by the coverage test. */
export const missingLocales = (bag: Localized): Language[] =>
  LANGUAGES.filter((l) => typeof bag[l] !== 'string' || bag[l] === '');
