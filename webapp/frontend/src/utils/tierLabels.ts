// Shared tier display-name map: theme-category -> tier number -> {en, ch},
// built from the tier definitions (via /api/simulator-bundle, which is merged
// with in-browser edits in the deployed build). Module-cached: one fetch per
// session, shared by the theme editor and the style preset picker.
import axios from 'axios';

export type TierLabelMap = Record<string, Record<number, { en?: string; ch?: string }>>;

let cached: TierLabelMap | null = null;
let inflight: Promise<TierLabelMap> | null = null;

export const fetchTierLabelMap = async (): Promise<TierLabelMap> => {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const map: TierLabelMap = {};
    try {
      const res = await axios.get('/api/simulator-bundle');
      Object.values(res.data?.tiers || {}).forEach((fileContent: any) => {
        const catKey = Object.keys(fileContent || {}).find(k => !k.startsWith('//'));
        if (!catKey) return;
        const cat = fileContent[catKey];
        const themeCategory = cat?._meta?.theme_category || catKey;
        if (!map[themeCategory]) map[themeCategory] = {};
        Object.entries<any>(cat).forEach(([key, val]) => {
          if (key === '_meta' || !val || typeof val !== 'object') return;
          const num = val.theme?.Tier;
          if (typeof num !== 'number' || map[themeCategory][num]) return; // first file wins
          if (val.localization?.en || val.localization?.ch) {
            map[themeCategory][num] = { en: val.localization.en, ch: val.localization.ch };
          }
        });
      });
      cached = map;
    } catch (e) {
      console.error('Failed to load tier labels', e);
    }
    return map;
  })();
  return inflight;
};

/** Call after tier definitions change (rename/save) so the next fetch is fresh. */
export const invalidateTierLabelMap = () => {
  cached = null;
  inflight = null;
};
