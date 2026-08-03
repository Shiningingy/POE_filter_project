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

export type TierLabelMap = Record<string, Record<number, { en?: string; ch?: string }>>;
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
          if (typeof num !== 'number' || labels[themeCategory][num]) return; // first file wins
          if (val.localization?.en || val.localization?.ch) {
            labels[themeCategory][num] = { en: val.localization.en, ch: val.localization.ch };
          }
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
