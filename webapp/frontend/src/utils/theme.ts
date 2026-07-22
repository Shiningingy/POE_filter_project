// Shared theme helpers. Extracted from three byte-identical inline copies
// (clientData.getMergedTheme, EditorView.loadTheme, ThemePresetEditor.handleSaveAsPreset)
// so the base+overrides merge lives in one place.

type ThemeMap = Record<string, Record<string, any>>;

/**
 * Deep-merge custom overrides onto a base theme, per category → tier.
 * Mirrors the generator's merge (generate.py load_merged_theme): the base is
 * deep-cloned (never mutated), then each override style is shallow-merged onto
 * the matching base tier, creating the category/tier if absent.
 */
export function mergeThemeOverrides(
  base: ThemeMap | null | undefined,
  overrides: ThemeMap | null | undefined,
): ThemeMap {
  const merged: ThemeMap = JSON.parse(JSON.stringify(base || {}));
  for (const [cat, tiers] of Object.entries(overrides || {})) {
    if (!merged[cat]) merged[cat] = {};
    for (const [tier, style] of Object.entries(tiers || {})) {
      merged[cat][tier] = { ...(merged[cat][tier] || {}), ...(style as object) };
    }
  }
  return merged;
}
