// Shared tier-definition lookups, built from /api/simulator-bundle (which is merged
// with in-browser edits in the deployed build). Module-cached: ONE fetch per session,
// shared by the theme editor and the style preset picker.
//
// Two maps come out of the same walk:
//   * labels    — theme-category -> tier number -> {en, ch}
//   * themeKeys — tier-definition path -> the theme resolution key that file uses
//
// themeKeys is what lets a nav leaf be styled by the key the GENERATOR reads. The
// theme board used to key off `category_structure.json`'s `target_category` instead,
// which is hand-authored and had drifted on 13 of 92 leaves. See
// filterStyle.resolveThemeKey for what that drift cost.
import axios from 'axios';
import { resolveThemeKey, topCategoryKey } from './filterStyle';

/**
 * Every tier that resolves to one theme row.
 *
 * ⚠️ `theme.Tier` is a STYLE row, not an identity: it is deliberately many-to-one, so
 * several tier keys can share one look. This map used to keep only the first tier it saw
 * per number ("first file wins") and hand that single name back as THE label for the row —
 * so 42 rows across 20 categories were labelled after an arbitrary one of their members.
 * `Curse of the Allflame` row 2 read "T0: 金币" while also covering Mercenary Warrants,
 * Sulphur and Voyage Charts; Campaign row 5 is shared by 29 tiers.
 *
 * Keeping the whole list lets a label say what the style actually paints.
 */
export interface TierRowLabel {
  tiers: { key: string; en?: string; ch?: string }[];
}

export type TierLabelMap = Record<string, Record<number, TierRowLabel>>;

/**
 * Display text for a theme row, plus a `title` listing every tier it covers.
 * Names beyond the second are collapsed to a count — some rows have 29 members.
 */
export const formatTierRow = (
  row: TierRowLabel | undefined,
  lang: 'en' | 'ch',
  fallback: string,
): { text: string; title?: string } => {
  const names = (row?.tiers || [])
    .map((entry) => entry[lang] || entry.en || entry.ch || entry.key)
    .filter(Boolean) as string[];
  if (!names.length) return { text: fallback };
  const title = names.length > 1 ? names.join('\n') : undefined;
  if (names.length === 1) return { text: names[0], title };
  if (names.length === 2) return { text: `${names[0]} / ${names[1]}`, title };
  return { text: `${names[0]} +${names.length - 1}`, title };
};
/** tier-definition path (e.g. "tier_definition/Currency/General.json") -> theme key. */
export type ThemeKeyByPath = Record<string, string>;

/** A decorator tier, as the previews need it: what triggers it and what it paints. */
export interface DecoratorEntry {
  key: string;
  conditions: Record<string, any>;
  theme: Record<string, any>;
  en: string;
  ch: string;
}

interface TierIndex { labels: TierLabelMap; themeKeys: ThemeKeyByPath; decorators: DecoratorEntry[]; }

let cached: TierIndex | null = null;
let inflight: Promise<TierIndex> | null = null;

const loadIndex = async (): Promise<TierIndex> => {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const labels: TierLabelMap = {};
    const themeKeys: ThemeKeyByPath = {};
    const decorators: DecoratorEntry[] = [];
    try {
      const res = await axios.get('/api/simulator-bundle');
      Object.entries<any>(res.data?.tiers || {}).forEach(([path, fileContent]) => {
        const catKey = topCategoryKey(fileContent);
        if (!catKey) return;
        const cat = fileContent[catKey];
        const themeCategory = resolveThemeKey(cat, catKey);
        themeKeys[path] = themeCategory;
        // Decorators are collected here rather than fetched separately: they are a
        // cross-cutting layer, so several surfaces want them and none owns them.
        // The two skips mirror the generator - both of these emit nothing.
        Object.entries<any>(cat).forEach(([tierKey, tier]) => {
          if (tierKey === '_meta' || !tier || typeof tier !== 'object' || !tier.decorator) return;
          if (tier.is_hide_tier) return;
          if (!tier.conditions || Object.keys(tier.conditions).length === 0) return;
          decorators.push({
            key: tierKey, conditions: tier.conditions, theme: tier.theme || {},
            en: tier.localization?.en || tierKey, ch: tier.localization?.ch || tierKey,
          });
        });
        if (!labels[themeCategory]) labels[themeCategory] = {};
        Object.entries<any>(cat).forEach(([key, val]) => {
          if (key === '_meta' || !val || typeof val !== 'object') return;
          const num = val.theme?.Tier;
          if (typeof num !== 'number') return;
          if (!val.localization?.en && !val.localization?.ch) return;
          // APPEND rather than "first wins" — a theme row is shared by design, and the
          // tiers that share it are exactly what its style paints.
          (labels[themeCategory][num] ||= { tiers: [] }).tiers.push({
            key, en: val.localization.en, ch: val.localization.ch,
          });
        });
      });
      cached = { labels, themeKeys, decorators };
    } catch (e) {
      console.error('Failed to load tier definitions', e);
    }
    return cached || { labels, themeKeys, decorators };
  })();
  return inflight;
};

export const fetchTierLabelMap = async (): Promise<TierLabelMap> => (await loadIndex()).labels;

/**
 * Theme resolution key per tier-definition path — the same answer the generator
 * reaches, so an editor keyed off this cannot style a bucket the filter ignores.
 */
export const fetchThemeKeyByPath = async (): Promise<ThemeKeyByPath> => (await loadIndex()).themeKeys;

/**
 * Every live decorator, for the preview's state toggles. A block preview shows a TIER,
 * not an item, so which decorators apply depends on state the block cannot know - hence
 * toggles rather than a guess.
 */
export const fetchDecorators = async (): Promise<DecoratorEntry[]> => (await loadIndex()).decorators;

/** Call after tier definitions change (rename/save) so the next fetch is fresh. */
export const invalidateTierLabelMap = () => {
  cached = null;
  inflight = null;
};
