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

interface TierIndex { labels: TierLabelMap; themeKeys: ThemeKeyByPath; }

let cached: TierIndex | null = null;
let inflight: Promise<TierIndex> | null = null;

const loadIndex = async (): Promise<TierIndex> => {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const labels: TierLabelMap = {};
    const themeKeys: ThemeKeyByPath = {};
    try {
      const res = await axios.get('/api/simulator-bundle');
      Object.entries<any>(res.data?.tiers || {}).forEach(([path, fileContent]) => {
        const catKey = topCategoryKey(fileContent);
        if (!catKey) return;
        const cat = fileContent[catKey];
        const themeCategory = resolveThemeKey(cat, catKey);
        themeKeys[path] = themeCategory;
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
      cached = { labels, themeKeys };
    } catch (e) {
      console.error('Failed to load tier definitions', e);
    }
    return cached || { labels, themeKeys };
  })();
  return inflight;
};

export const fetchTierLabelMap = async (): Promise<TierLabelMap> => (await loadIndex()).labels;

/**
 * Theme resolution key per tier-definition path — the same answer the generator
 * reaches, so an editor keyed off this cannot style a bucket the filter ignores.
 */
export const fetchThemeKeyByPath = async (): Promise<ThemeKeyByPath> => (await loadIndex()).themeKeys;

/** Call after tier definitions change (rename/save) so the next fetch is fresh. */
export const invalidateTierLabelMap = () => {
  cached = null;
  inflight = null;
};
