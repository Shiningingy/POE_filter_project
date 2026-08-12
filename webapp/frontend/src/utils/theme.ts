// Shared theme helpers.
//
// The stored override layer is retired: nothing merges a patch file over the active
// preset any more. This survives as the theme board's ONE remaining use — folding its
// session-local edit buffer into the base theme to write a new preset.

type ThemeMap = Record<string, Record<string, any>>;

/**
 * Deep-merge custom overrides onto a base theme, per category → tier.
 * The base is deep-cloned (never mutated), then each override style is
 * shallow-merged onto the matching base tier, creating the category/tier if absent.
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
