// The editor's CATEGORY DOCUMENT, and the two files it is built from.
//
// On disk a category lives in two files: the tier file (tier_definition/...) holds the
// tiers, and the mapping file (base_mapping/...) holds the items AND the category's
// authored rules. The editor edits ONE document: the tier file with the mapping's rules
// merged in under the category key. Saving splits it back into the two files.
//
// Both directions live here, as pure functions, so that every path that loads or saves a
// category builds the document the same way.

// Tier and mapping files are untyped JSON everywhere in the editor; this module keeps that.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

/** The category key of a tier document: its first key that is not a `//` comment. */
export const categoryKeyOf = (doc: Json): string | undefined =>
  Object.keys(doc).find((k) => !k.startsWith('//'));

/** Build the editor document from the tier file and the mapping file. Inputs are not mutated. */
export function mergeCategoryDoc(tierData: Json, mapData: Json | null | undefined): Json {
  const merged = JSON.parse(JSON.stringify(tierData));
  const catKey = categoryKeyOf(merged);
  if (catKey && mapData?.rules) {
    merged[catKey].rules = mapData.rules;
  }
  return merged;
}

/**
 * Split the editor document back into the two files to write.
 *
 * `tier` is the tier file without the rules. `mapping` is the mapping file to write, or
 * null when there is nothing to write to it. Returns null when the document has no
 * category key. Inputs are not mutated.
 *
 * A document with NO `rules` array carries no claim about the rules, so the mapping is not
 * written at all (mapping: null). The mapping is saved whole, so treating "no key" as
 * `rules: []` deletes every rule in the category: that is what the Visibility Overview
 * reload did when it handed the editor a bare tier file. An explicit `rules: []` (the user
 * deleted every rule) is still written.
 */
export function splitCategoryDoc(
  doc: Json,
  mapData: Json | null | undefined,
): { tier: Json; mapping: Json | null } | null {
  const catKey = categoryKeyOf(doc);
  if (!catKey) return null;

  const rules = doc[catKey].rules;
  const hasRules = Array.isArray(rules);
  const tier = JSON.parse(JSON.stringify(doc));
  delete tier[catKey].rules;
  if (tier[catKey]._meta?.rules) delete tier[catKey]._meta.rules;

  if (!mapData || !hasRules) return { tier, mapping: null };
  const mapping = JSON.parse(JSON.stringify(mapData));
  mapping.rules = rules;
  return { tier, mapping };
}
