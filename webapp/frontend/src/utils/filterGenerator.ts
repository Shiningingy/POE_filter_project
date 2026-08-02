// THE generation engine — the only one (ADR-0007). The browser runs this module and
// so does the CLI (filter_generation/generate.mjs), which is a shell around it and
// must stay one. Guarded by test_generator_fixtures.mjs (synthetic tree + committed
// goldens) and test_resolver_equivalence.mjs (preview == export).
//
// ⚠️ "Mirrors generate.py" below is HISTORY. That file is deleted; the notes stay
// because they record why a behaviour exists, not because there is a second copy to
// keep in step. See the header of filterStyle.ts.
import { type Language } from './localization';

// Strictness ladder (loosest -> strictest). A tier with `hide_at_strictness: N`
// flips to Hide once the selected level's index >= N. Orthogonal to MODE. Single
// source of truth for the UI too — import from here so the ordered list (its index
// = the threshold) can't drift. The threshold is pinned from both sides by the
// standard-regular-ch / standard-semistrict-ch fixtures.
export const STRICTNESS_LEVELS = ['soft', 'regular', 'semistrict', 'strict', 'verystrict', 'uber', 'uberplus'] as const;
export type StrictnessLevel = typeof STRICTNESS_LEVELS[number];

// Campaign module: the Campaign picker's selection — selection-centric ladder.
// Picked groups emit their T1 band layer + T2 class-wide rare layer; unpicked
// groups emit nothing and fall to the T3 safety net. Nothing picked (the
// default) = baseline output. hide_unselected is the aggressive declutter:
// unpicked weapon groups + the 'aggressive' tiers (late-campaign magic) emit
// as Hide. Mirrors LEVELING_SELECTION handling in filter_generation/generate.py.
export interface LevelingSelection {
  weapons?: string[];
  armour_defense?: string[];
  hide_unselected?: boolean;
  preset?: string;
}

// EDITOR helper: will this campaign tier emit as a SHOW block under the current
// selection? Selection-centric ladder: weapon/armour group tiers emit ONLY when
// picked (unpicked = omitted, or Hide under the declutter — either way not a
// Show). 'aggressive' tiers are never Show blocks. Drives preview dimming and
// the per-tier enable chip — the generators use their own lv gate
// (lvPicked / lv_picked in generate.py).
export const isLevelingSelected = (lvGroup: any, selection?: LevelingSelection): boolean => {
  if (!lvGroup) return true;
  const sel = selection || {};
  switch (lvGroup.axis) {
    case 'weapon': return (sel.weapons || []).includes(lvGroup.key);
    case 'armour': return (sel.armour_defense || []).includes(lvGroup.key);
    case 'aggressive': return false;
    default: return true; // 'always' or unknown axis
  }
};

// ===========================
// TYPES
// ===========================

/** One emitted block, reported through GeneratorData.onBlock. */
export interface BlockRecord {
  order: number;
  file: string;      // tier_definition-relative path, POSIX
  tier_key: string;
  tier_num: number;
  source: 'class_condition' | 'rule' | 'tier_base' | 'card';
  match: string | null;   // 'Exact' | 'Partial' (untranslated)
  rule: string | null;    // the rule's display part, when a rule emitted this
  bases: string[];
  is_hide: boolean;
  text: string;           // the block exactly as written to the filter
}

interface GeneratorData {
  themeData: any;
  soundMap: any;
  allMappings: Record<string, any>; // path -> content
  allTierDefinitions: Record<string, any>; // path -> content
  language: Language;
  footer?: string; // verbatim tail (unknown-items catch-all block)
  strictness?: string; // strictness ladder level (default 'soft' = loosest)
  leveling_selection?: LevelingSelection; // Campaign picker selection (default: all selected)
  mode?: string; // 'ruthless' | 'standard' (default). Ruthless hides via 'Minimal' (Hide is invalid there) + excluded_modes.
  // Opt-in observer: called once per emitted block, with the block text and the
  // (file, tier) it came from. Inert when absent, so it costs the browser nothing.
  //
  // This is what generate.py's `--trace` was for, and it is why deleting the
  // Python generator did not take the capability with it: the resolver-equivalence
  // test needs "which block did this tier actually emit", which cannot be read back
  // out of the finished filter text (the headers are localized and lossy).
  onBlock?: (rec: BlockRecord) => void;
}

// ===========================
// CONFIG
// ===========================

// Style/emission primitives live in ONE place now (filterStyle.ts) so the editor
// preview, the Inspector and the drop simulator cannot drift from what actually
// gets exported — they did, in four different directions. Anything touching how a
// block LOOKS belongs there; this file owns which blocks exist and in what order.
import {
  DEFAULT_FONT_SIZE, styleOff, parseRgba, conditionLines, resolveTierTheme, splitByOverride,
  blockText, resolveSound, tierNumFromLabel, resolveThemeKey,
} from './filterStyle';

// Generator-output vocabulary (terms that appear in filter comments). Deliberately
// NOT in localization.ts, which is the UI translation table; these are
// filter-artifact domain strings, a different concern. Both languages are pinned by
// the standard-soft-ch / standard-soft-en fixture pair.
const TERMS: Record<string, Record<string, string>> = {
  en: { Rule: "Rule", Base: "Base", "Auto-Sound": "Auto-Sound", Exact: "Exact", Partial: "Partial", Self: "Self-matched", Card: "Card" },
  ch: { Rule: "规则", Base: "基础", "Auto-Sound": "自动音效", Exact: "精确", Partial: "模糊", Self: "自选", Card: "物品卡" },
};

const FOLDER_LOCALIZATION: Record<string, string> = {
  "Currency": "通货",
  "Equipment": "装备",
  "Divination Cards": "命运卡",
  "Gems": "宝石",
  "Maps": "地图",
  "Misc": "杂项",
  "Special": "特殊",
  "Weapons": "武器",
  "Armour": "防具",
  "Jewellery": "首饰",
  "Flasks": "药剂",
  "Quest": "任务",
  "Uniques": "传奇",
  "_campaign": "过渡",
  "Heist": "赏金猎人"
};

const headerLine = (index: number, text: string): string => {
  const idxStr = index.toString().padStart(5, '0');
  return `\n#==[${idxStr}]-${text}==`;
};

// ===========================
// CORE GENERATOR
// ===========================

export const generateFilter = (data: GeneratorData): string => {
  const { themeData, soundMap, allMappings, allTierDefinitions, language } = data;
  const term = (key: string): string => (TERMS[language] || TERMS.en)[key] || key;
  const isCh = language === 'ch';

  // MODE gates excluded_modes and HIDE_CMD exactly as the Python side does.
  // Ruthless forbids the `Hide` keyword in-game, so hidden tiers emit `Minimal`
  // (GGG's Ruthless-only Hide-equivalent). Mirrors generate.py.
  const MODE = data.mode === 'ruthless' ? 'ruthless' : 'standard';
  const HIDE_CMD = MODE === 'ruthless' ? 'Minimal' : 'Hide';

  // Strictness gate threshold index; an absent/unknown level clamps to 'soft'.
  const STRICTNESS_IDX = Math.max(0, (STRICTNESS_LEVELS as readonly string[]).indexOf(data.strictness ?? 'soft'));

  // Campaign selection (selection-centric: picked groups emit their layers).
  // Mirrors lv_picked() in generate.py.
  const LV_SEL: LevelingSelection = data.leveling_selection || {};
  const lvPicked = (tierEntry: any): boolean => {
    const lv = tierEntry.lv_group || {};
    if (lv.axis === 'weapon') return (LV_SEL.weapons || []).includes(lv.key);
    if (lv.axis === 'armour') return (LV_SEL.armour_defense || []).includes(lv.key);
    return false;
  };

  // Condition emission is shared (filterStyle.conditionLines) so the preview and
  // the simulator cannot spell a condition differently from the export — the
  // operator-spacing bug that broke the filter in game was exactly that class.
  const emitConditions = (lines: string[], conditions: any): void => {
    lines.push(...conditionLines(conditions));
  };

  const overview: string[] = [
    "#========================================",
    "#  FILTER OVERVIEW",
    "#========================================",
    `#  [00000] ${isCh ? "自定义规则" : "Custom Rules"}`
  ];

  const outLines: string[] = [];
  outLines.push(headerLine(0, isCh ? "自定义规则" : "Custom Rules"));
  outLines.push(`# ${isCh ? "在此添加自定义规则将会覆盖所有过滤器设定." : "Add custom rules here to override all filter settings."}\n`);

  let currentMajorCat = "";
  let majorCounter = 0;
  let subCounter = 0;

  // Category GENERATION order = explicit `_meta.gen_order` (ascending), then the
  // relative path. DECOUPLED from nav display order (category_structure) on purpose:
  // campaign carries gen_order -100 so it emits FIRST (first-match wins during the
  // acts) even though the nav shows it low. Absent field = 0. Tier order and rule
  // order are authored in the editor and followed verbatim — never reordered here.
  // (Mirrors _order_key in generate.py — parity-guarded.)
  const genOrder = (p: string): number => (allMappings[p]?._meta?.gen_order ?? 0);
  const sortedPaths = Object.keys(allMappings).sort((a, b) => {
    const ga = genOrder(a), gb = genOrder(b);
    if (ga !== gb) return ga - gb;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  for (const relPath of sortedPaths) {
    const mapDoc = allMappings[relPath];
    const tierDoc = allTierDefinitions[relPath];
    if (!tierDoc) continue;

    // Skip files excluded for the current mode (mirrors generate.py).
    if (((mapDoc._meta || {}).excluded_modes || []).includes(MODE)) continue;

    const pathParts = relPath.split('/');
    const folder = pathParts[0];

    // --- Major Category Header ---
    if (folder !== currentMajorCat) {
      currentMajorCat = folder;
      majorCounter += 10000;
      subCounter = majorCounter;

      const folderLoc = FOLDER_LOCALIZATION[folder] || folder;
      const headerText = isCh ? `${folderLoc} ${folder}` : folder;

      outLines.push(`\n#===================================================================================================================`);
      outLines.push(`# [[${majorCounter.toString().padStart(5, '0')}]] ${headerText}`);
      outLines.push(`#===================================================================================================================`);
      overview.push(`#  [${majorCounter.toString().padStart(5, '0')}] ${headerText}`);
    }

    // --- Sub Category ---
    subCounter += 1000;
    let blockIndex = subCounter;

    const categoryKey = Object.keys(tierDoc).find(k => !k.startsWith("//"));
    if (!categoryKey) continue;

    const categoryData = tierDoc[categoryKey];
    const meta = categoryData._meta || {};
    const locEn = meta.localization?.en || categoryKey;

    const mapMeta = mapDoc._meta || {};
    const locData = mapMeta.localization?.[language] || {};

    let locCat = locEn;
    let itemTrans: Record<string, string> = {};

    if (typeof locData === 'object') {
      // Class label now lives canonically in _meta.item_class (was localization.ch.__class_name__).
      locCat = mapMeta.item_class?.[language] || mapMeta.item_class?.ch || meta.localization?.ch || locEn;
      itemTrans = locData;
    } else {
      locCat = locData || locEn;
    }

    const itemClassRaw = meta.item_class || categoryKey;
    let itemClass = "";
    let itemClassHeader = "";

    if (typeof itemClassRaw === 'object') {
      itemClass = itemClassRaw.en || categoryKey;
      itemClassHeader = itemClassRaw[language] || itemClass;
    } else {
      itemClass = itemClassRaw;
      itemClassHeader = itemClass;
    }

    const themeCatKey = resolveThemeKey({ _meta: meta }, categoryKey);
    // (The theme-row lookup itself now lives in filterStyle.resolveTierTheme, so the
    // editor preview and the simulator resolve the identical row.)

    // --- Breadcrumbs ---
    const breadcrumbs: string[] = [];
    pathParts.forEach((p, i) => {
      if (i === pathParts.length - 1) {
        breadcrumbs.push(`${locCat} ${locEn}`);
      } else {
        const locF = FOLDER_LOCALIZATION[p] || p;
        breadcrumbs.push(`${locF} ${p}`);
      }
    });
    const fullHeaderText = breadcrumbs.join(" - ");

    overview.push(`#    [${subCounter.toString().padStart(5, '0')}] ${fullHeaderText}`);
    outLines.push(headerLine(subCounter, fullHeaderText));

    // --- Mapping Items ---
    const mapping = mapDoc.mapping || {};
    let itemsByTier: Record<string, string[]> = {};
    Object.entries(mapping).forEach(([item, tVal]) => {
      const tiers = Array.isArray(tVal) ? tVal : [tVal];
      tiers.forEach(t => {
        if (!itemsByTier[t]) itemsByTier[t] = [];
        itemsByTier[t].push(item);
      });
    });

    // Underscore-prefixed folders (_campaign, _legacy…) may map items to
    // cross-category tier keys absent from this tier_def. Remap those to the
    // first non-hide tier defined here (mirrors generate.py).
    if (folder.startsWith("_")) {
      const validTierKeys = new Set(Object.keys(categoryData).filter(k => k.startsWith("Tier")));
      const defaultShowTier = (meta.tier_order || []).find(
        (tk: string) => validTierKeys.has(tk) && !categoryData[tk]?.is_hide_tier
      );
      if (defaultShowTier) {
        const remapped: Record<string, string[]> = {};
        for (const [tKey, list] of Object.entries(itemsByTier)) {
          const dest = validTierKeys.has(tKey) ? tKey : defaultShowTier;
          (remapped[dest] = remapped[dest] || []).push(...list);
        }
        itemsByTier = remapped;
      }
    }

    let tierOrder: string[] = meta.tier_order || [];
    if (tierOrder.length === 0) {
      tierOrder = Object.keys(itemsByTier).sort((a, b) => tierNumFromLabel(a) - tierNumFromLabel(b));
    }
    const usedTiers = Object.keys(itemsByTier);
    usedTiers.forEach(t => {
      if (!tierOrder.includes(t)) tierOrder.push(t);
    });

    for (const tLbl of tierOrder) {
      if (!categoryData[tLbl]) continue;

      const items = itemsByTier[tLbl] || [];
      const tierEntry = categoryData[tLbl];

      // Skip tiers excluded for the current mode (mirrors generate.py).
      if ((tierEntry.excluded_modes || []).includes(MODE)) continue;

      // Campaign module gate (selection-centric ladder, mirrors generate.py):
      // group tiers (axis weapon/armour — the T1 band layer + T2 class-wide
      // rare layer) emit ONLY when their key is picked; unpicked groups are
      // omitted and fall to the T3 safety net. 'aggressive' declutter tiers
      // emit (as Hide) only under hide_unselected, which also flips unpicked
      // WEAPON groups to Hide instead of omitting them. Strictness NEVER
      // applies inside _campaign (see CONTEXT.md).
      const lvAxis = (tierEntry.lv_group || {}).axis;
      let lvHide = false;
      if (lvAxis === 'aggressive') {
        if (LV_SEL.hide_unselected) lvHide = true;
        else continue;
      } else if (lvAxis === 'weapon' || lvAxis === 'armour') {
        if (!lvPicked(tierEntry)) {
          if (lvAxis === 'weapon' && LV_SEL.hide_unselected) lvHide = true;
          else continue;
        }
      }

      const isHideTier = !!tierEntry.is_hide_tier;
      // Strictness gate: flip a normally-shown tier to Hide at/above its threshold.
      // (Mirrors generate.py.) MODE still drives HIDE_CMD (Hide vs Minimal).
      let isHide = isHideTier;
      const hideAt = tierEntry.hide_at_strictness;
      if (typeof hideAt === 'number' && STRICTNESS_IDX >= hideAt) isHide = true;
      if (lvHide) isHide = true;
      let tnum = tierNumFromLabel(tLbl);
      // Honor an explicit theme.Tier for tiers with non-standard label names.
      const themeTierOverride = tierEntry.theme?.Tier;
      if (themeTierOverride !== undefined && themeTierOverride !== null) tnum = themeTierOverride;

      let ttheme = resolveTierTheme(themeData, themeCatKey, tierEntry, tLbl);
      let baseTextCol = parseRgba(ttheme.TextColor);
      let baseBorderCol = parseRgba(ttheme.BorderColor);
      let baseBgCol = parseRgba(ttheme.BackgroundColor, "0 0 0 255");
      let basePlayEff = ttheme.PlayEffect;
      let baseMiniIcon = ttheme.MinimapIcon;

      // Tier label shown in comment headers (e.g. "T1: High End"); the filter
      // command + theme lookup still key off tnum above.
      const tierDisplay = tierEntry.localization?.[language] || tierEntry.localization?.en || `Tier ${tnum}`;

      // --- Class-Condition tiers (e.g. _campaign/Armour.json) ---
      // Emit one Class-gated block (no BaseType enumeration) and skip normal
      // BaseType processing. Mirrors generate.py.
      if (tierEntry.class_condition) {
        const tierConditions = tierEntry.conditions || {};
        if (Object.keys(tierConditions).length === 0) continue;
        const themeTnum = tierEntry.theme?.Tier ?? tnum;
        const ccRow = resolveTierTheme(themeData, themeCatKey, tierEntry, `Tier ${themeTnum}`);
        ttheme = Object.keys(ccRow).length > 0 ? ccRow : ttheme;
        baseTextCol = parseRgba(ttheme.TextColor);
        baseBorderCol = parseRgba(ttheme.BorderColor);
        baseBgCol = parseRgba(ttheme.BackgroundColor, "0 0 0 255");
        basePlayEff = ttheme.PlayEffect;
        baseMiniIcon = ttheme.MinimapIcon;
        blockIndex++;
        const ccDisplay = tierEntry.localization?.[language] || tierEntry.localization?.en || tLbl;
        outLines.push(`\n#==[${blockIndex.toString().padStart(5, '0')}]- ${itemClassHeader} -${ccDisplay} ${locCat} - Class Condition==`);
        const ccLines = [`${isHide ? HIDE_CMD : "Show"}`];
        emitConditions(ccLines, tierConditions);
        // Disabled/sentinel styles are OMITTED (see styleOff) so the editor
        // preview and the exported filter agree. (Mirrors generate.py.)
        ccLines.push(`    SetFontSize ${ttheme.FontSize || DEFAULT_FONT_SIZE}`);
        if (!styleOff(ttheme.TextColor)) ccLines.push(`    SetTextColor ${baseTextCol}`);
        if (!styleOff(ttheme.BorderColor)) ccLines.push(`    SetBorderColor ${baseBorderCol}`);
        if (!styleOff(ttheme.BackgroundColor)) ccLines.push(`    SetBackgroundColor ${baseBgCol}`);
        const ccSound = resolveSound(tierEntry, soundMap);
        if (ccSound) ccLines.push(`    ${ccSound}`);
        if (basePlayEff && !styleOff(basePlayEff)) ccLines.push(`    PlayEffect ${basePlayEff}`);
        if (baseMiniIcon && !styleOff(baseMiniIcon)) ccLines.push(`    MinimapIcon ${baseMiniIcon}`);
        outLines.push(blockText(ccLines, isHide));
        data.onBlock?.({
          order: blockIndex, file: relPath, tier_key: tLbl, tier_num: tnum,
          source: 'class_condition', match: null, rule: null, bases: [],
          is_hide: isHide, text: outLines[outLines.length - 1],
        });
        continue;
      }

      // Create a fresh deep copy of rules for this tier
      const allRules = JSON.parse(JSON.stringify(mapDoc.rules || []));

      // AUTO-SOUND IS GONE. A per-item sound is an explicit override on the item
      // CARD — `item_overrides` on this tier, keyed by base — and blocks split by it
      // at emission (splitByOverride). Mirrors generate.py.
      //
      // What was here injected a synthetic one-target rule per base with a
      // `basetype_sounds` entry, unless any rule in the file merely NAMED the base.
      // Not a rule that set a sound — one that mentioned it. So a rule written for
      // something else silenced the item across its whole file, and nine curated
      // sounds reached the game nowhere; Chaos Orb's was silenced by a
      // `StackSize >= 10` tier-up that cannot even fire in Ruthless.
      const itemOverrides = tierEntry.item_overrides || {};

      const pendingItems = new Set(items);
      let ruleCounter = 0;

      for (const rule of allRules) {
        if (rule.disabled) continue;

        const ruleTargets = rule.targets || [];
        const ruleTierOverride = rule.overrides?.Tier;
        const applyToTier = !!rule.applyToTier;
        const matchModes = rule.targetMatchModes || {};

        let ruleMatches: string[] = [];

        // A rule can bring its OWN item selector instead of a target list: a `raw`
        // block, or its conditions. That is the only way to express "every Deafening
        // Essence" without naming all 17 - a partial BaseType match collapses them to
        // one line. Such a rule emits a block with NO generated BaseType line.
        //
        // ANY condition counts, not just BaseType/Class: `Rarity Unique` +
        // `LinkedSockets >= 6` is a complete selector on its own. Requiring
        // BaseType/Class meant 13 such rules across the tree were silently skipped.
        //
        // A rule with targets still uses them - this is only consulted after the
        // applyToTier and ruleTargets branches below.
        const selfSelecting = !!rule.raw || Object.keys(rule.conditions || {}).length > 0;

        if (ruleTierOverride) {
          if (ruleTierOverride === tLbl) {
            // .sort(), not bare Array.from(): a JS Set iterates in insertion
            // order while Python's iterates in (randomised) hash order, so the
            // two generators disagreed and generate.py was not even stable
            // between runs. Both now sort (ADR-0001 parity).
            if (applyToTier) ruleMatches = Array.from(pendingItems).sort();
            else if (ruleTargets.length > 0) ruleMatches = ruleTargets;
            else if (selfSelecting) ruleMatches = [];  // the rule's own lines match
            else continue;
          } else {
            continue;
          }
        } else {
          if (ruleTargets.length > 0) {
            ruleMatches = ruleTargets.filter((item: string) => pendingItems.has(item));
            // generate.py bails here when a targeted rule matches nothing in THIS
            // tier. The guard was missing, which only stayed invisible while
            // selfSelecting was false for such rules - the later
            // `ruleMatches.length === 0 && !selfSelecting` caught them by accident.
            // Once any condition counts as a selector, its absence made the TS emit
            // a condition-only block in every tier the rule did not belong to.
            if (ruleMatches.length === 0) continue;
          } else {
            continue;
          }
        }

        if (ruleMatches.length === 0 && !selfSelecting) continue;

        const exactGroup = ruleMatches.filter((m: string) => (matchModes[m] || 'exact') === 'exact');
        const partialGroup = ruleMatches.filter((m: string) => matchModes[m] === 'partial');

        // isStrict null = self-matched: one block, no generated BaseType line.
        const groups: readonly (readonly [string[], string, boolean | null])[] =
          ruleMatches.length > 0
            ? [[exactGroup, "Exact", true], [partialGroup, "Partial", false]]
            : [[[], "Self", null]];

        // Expand each group by item-card override: a card with its own sound
        // becomes its own block, overridden groups first. A self-matched group
        // names no bases, so there is no card to split on. Mirrors generate.py.
        const expanded: Array<[string[], string, boolean | null, any]> = [];
        for (const [sg, ml, strict] of groups) {
          if (strict === null) expanded.push([sg as string[], ml, strict, null]);
          else for (const [b, o] of splitByOverride(sg as string[], itemOverrides)) expanded.push([b, ml, strict, o]);
        }

        for (const [subgroup, modeLabel, isStrict, cardOver] of expanded) {
          if (isStrict !== null && subgroup.length === 0) continue;

          blockIndex++;
          // Card override wins over the rule's, which wins over the tier's.
          const rOver = { ...(rule.overrides || {}), ...(cardOver || {}) };
          const rawComment = rule.comment || '';
          ruleCounter++;
          // Localizable rule name: rule.localization[lang] -> comment -> "Rule"
          const ruleName = (rule.localization || {})[language] || rawComment || term('Rule');
          let rulePart = `#${ruleCounter} ${ruleName}`;
          if (cardOver) {
            rulePart += ` - ${term('Card')}：` + subgroup.slice(0, 3).map((b) => itemTrans[b] || b).join('/');
          }

          const finalMode = term(modeLabel);
          outLines.push(`\n#==[${blockIndex.toString().padStart(5, '0')}]- ${itemClassHeader} -${tierDisplay} ${locCat} - ${rulePart} - ${finalMode}==`);

          const cmd = isHide ? HIDE_CMD : "Show";
          const blockLines = [`${cmd}`];
          if (isStrict !== null) {
            const btOp = isStrict ? " == " : " ";
            blockLines.push(`    BaseType${btOp}"${subgroup.join('" "')}"`);
          }

          emitConditions(blockLines, rule.conditions);

          if (rule.raw) {
            rule.raw.split('\n').forEach((l: string) => { if (l.trim()) blockLines.push(`    ${l.trim()}`); });
          }

          // Effective raw value = the override when present, else the theme value;
          // disabled/sentinel values omit the line (see styleOff; mirrors generate.py).
          blockLines.push(`    SetFontSize ${rOver.FontSize || ttheme.FontSize || DEFAULT_FONT_SIZE}`);
          const rTextRaw = 'TextColor' in rOver ? rOver.TextColor : ttheme.TextColor;
          if (!styleOff(rTextRaw)) blockLines.push(`    SetTextColor ${parseRgba(rOver.TextColor, baseTextCol)}`);
          const rBorderRaw = 'BorderColor' in rOver ? rOver.BorderColor : ttheme.BorderColor;
          if (!styleOff(rBorderRaw)) blockLines.push(`    SetBorderColor ${parseRgba(rOver.BorderColor, baseBorderCol)}`);
          const rBgRaw = 'BackgroundColor' in rOver ? rOver.BackgroundColor : ttheme.BackgroundColor;
          if (!styleOff(rBgRaw)) blockLines.push(`    SetBackgroundColor ${parseRgba(rOver.BackgroundColor, baseBgCol)}`);

          const soundLine = resolveSound(tierEntry, soundMap, rOver.PlayAlertSound);
          if (soundLine) blockLines.push(`    ${soundLine}`);
          const rEff = 'PlayEffect' in rOver ? rOver.PlayEffect : basePlayEff;
          if (rEff && !styleOff(rEff)) blockLines.push(`    PlayEffect ${rEff}`);
          const rIcon = 'MinimapIcon' in rOver ? rOver.MinimapIcon : baseMiniIcon;
          if (rIcon && !styleOff(rIcon)) blockLines.push(`    MinimapIcon ${rIcon}`);

          outLines.push(blockText(blockLines, isHide));
          data.onBlock?.({
            order: blockIndex, file: relPath, tier_key: tLbl, tier_num: tnum,
            source: cardOver ? 'card' : 'rule', match: modeLabel as string | null,
            rule: rulePart, bases: [...(subgroup as string[])], is_hide: isHide,
            text: outLines[outLines.length - 1],
          });
        }

        ruleMatches.forEach(m => pendingItems.delete(m));
      }

      // Base Block
      if (pendingItems.size > 0) {
        // From the MAPPING's _meta, not the tier definition's — the editor writes it
        // there (clientData.updateItem / main.py update_item), and no tier_definition
        // file has ever carried the key. Reading `meta` here meant the Partial toggle
        // did nothing: the card showed a Partial badge and the filter still emitted
        // `BaseType ==`. Both generators had it wrong identically, which is why
        // dual-generator parity never saw it. Same trap the line below this block was
        // already fixed for ("translations come from map_doc, NOT tier definition").
        const matchModes = mapMeta.match_modes || {};
        const exactPending = Array.from(pendingItems).filter((item: string) => (matchModes[item] || 'exact') === 'exact').sort();
        const partialPending = Array.from(pendingItems).filter((item: string) => matchModes[item] === 'partial').sort();

        const baseGroups: Array<[string[], string, boolean, any]> = [];
        for (const [sg, ml, strict] of [[exactPending, "Exact", true], [partialPending, "Partial", false]] as const) {
          for (const [b, o] of splitByOverride(sg as string[], itemOverrides)) baseGroups.push([b, ml, strict, o]);
        }

        for (const [subgroup, modeLabel, isStrict, cardOver] of baseGroups) {
          if (subgroup.length === 0) continue;

          blockIndex++;
          const finalMode = term(modeLabel);
          const baseLabel = term('Base');
          const cardPart = cardOver
            ? ` - ${term('Card')}：` + subgroup.slice(0, 3).map((b) => itemTrans[b] || b).join('/')
            : '';
          outLines.push(`\n#==[${blockIndex.toString().padStart(5, '0')}]- ${itemClassHeader} -${tierDisplay} ${locCat} - ${baseLabel}${cardPart} - ${finalMode}==`);

          const cmd = isHide ? HIDE_CMD : "Show";
          const btOp = isStrict ? " == " : " ";
          const blockLines = [
            `${cmd}`,
            `    BaseType${btOp}"${subgroup.join('" "')}"`
          ];

          // Tier-level conditions (e.g. ItemLevel, Rarity, AreaLevel) — mirrors
          // generate.py's base block. (Previously omitted on the TS side.)
          emitConditions(blockLines, tierEntry.conditions);

          // Disabled/sentinel styles are OMITTED (see styleOff; mirrors generate.py).
          // A card override sits on top, exactly as a rule's would.
          const cOver = cardOver || {};
          blockLines.push(`    SetFontSize ${cOver.FontSize || ttheme.FontSize || DEFAULT_FONT_SIZE}`);
          const cTextRaw = 'TextColor' in cOver ? cOver.TextColor : ttheme.TextColor;
          if (!styleOff(cTextRaw)) blockLines.push(`    SetTextColor ${parseRgba(cOver.TextColor, baseTextCol)}`);
          const cBorderRaw = 'BorderColor' in cOver ? cOver.BorderColor : ttheme.BorderColor;
          if (!styleOff(cBorderRaw)) blockLines.push(`    SetBorderColor ${parseRgba(cOver.BorderColor, baseBorderCol)}`);
          const cBgRaw = 'BackgroundColor' in cOver ? cOver.BackgroundColor : ttheme.BackgroundColor;
          if (!styleOff(cBgRaw)) blockLines.push(`    SetBackgroundColor ${parseRgba(cOver.BackgroundColor, baseBgCol)}`);

          const soundLine = resolveSound(tierEntry, soundMap, cOver.PlayAlertSound);
          if (soundLine) blockLines.push(`    ${soundLine}`);
          const cEff = cOver.PlayEffect ?? basePlayEff;
          if (cEff && !styleOff(cEff)) blockLines.push(`    PlayEffect ${cEff}`);
          const cIcon = cOver.MinimapIcon ?? baseMiniIcon;
          if (cIcon && !styleOff(cIcon)) blockLines.push(`    MinimapIcon ${cIcon}`);

          outLines.push(blockText(blockLines, isHide));
          data.onBlock?.({
            order: blockIndex, file: relPath, tier_key: tLbl, tier_num: tnum,
            source: cardOver ? 'card' : 'tier_base', match: modeLabel as string | null,
            rule: null, bases: [...(subgroup as string[])], is_hide: isHide,
            text: outLines[outLines.length - 1],
          });
        }
      }
    }
  }

  // Footer: appended verbatim — the unknown-items catch-all block
  // (data/footer.filter, hand-maintained). Mirrors generate.py.
  const footerText = (data.footer || '').trim();
  if (footerText) outLines.push('\n' + footerText + '\n');

  overview.push("#========================================\n");
  return overview.join('\n') + '\n' + outLines.join('\n') + '\n';
};
