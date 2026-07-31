import { type Language } from './localization';

// Strictness ladder (loosest -> strictest). A tier with `hide_at_strictness: N`
// flips to Hide once the selected level's index >= N. Orthogonal to MODE. Kept
// byte-identical to STRICTNESS_LEVELS in filter_generation/generate.py
// (parity-guarded by test_generator_parity.mjs). Single source of truth for the
// UI too — import from here so the ordered list (its index = the threshold) can't drift.
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
}

// ===========================
// CONFIG
// ===========================

const DEFAULT_FONT_SIZE = 32;

// Generator-output vocabulary (terms that appear in filter comments). Co-located
// with the generator and mirrored EXACTLY in filter_generation/generate.py
// (TERMS) — the parity test (test_generator_parity.mjs) guards them. Deliberately
// NOT in localization.ts, which is the UI translation table; these are
// filter-artifact domain strings, a different concern.
const TERMS: Record<string, Record<string, string>> = {
  en: { Rule: "Rule", Base: "Base", "Auto-Sound": "Auto-Sound", Exact: "Exact", Partial: "Partial", Self: "Self-matched" },
  ch: { Rule: "规则", Base: "基础", "Auto-Sound": "自动音效", Exact: "精确", Partial: "模糊", Self: "自选" },
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

// ===========================
// UTILITIES
// ===========================

// True when a theme/override style value means OMIT the line entirely: the
// editor's 'disabled:' toggle, or the designer sentinels 'inherit' (TextColor
// keeps the rarity colour) / 'default' (BackgroundColor keeps the game's default
// label bg). Mirrors style_off() in generate.py — the editor preview
// (styleResolver) omits these too, so preview == export.
// ALSO true for an ABSENT value. An absent key is the designer's primary way of
// saying "let the game paint this": 441 of the 998 theme rows omit `TextColor` on
// purpose — every gear class, Campaign, and every rarity-inherited family gives up
// its text channel so the RARITY colour shows through. We were falling through to
// parseRgba(undefined) = white and painting over it, so a rare staff rendered with
// a white name and read as a plain normal item. Same for the 98 rows omitting
// `BackgroundColor`, which want the game's own 0 0 0 190 label.
const styleOff = (value: any): boolean =>
  value === undefined || value === null ||
  (typeof value === 'string' && (value.startsWith('disabled:') || value === 'inherit' || value === 'default'));

const parseRgba = (value: any, defaultValue: string = "255 255 255 255"): string => {
  if (!value || value === -1) return defaultValue;
  if (typeof value === "string" && value.startsWith("disabled:")) return defaultValue;
  
  if (typeof value === "string" && value.startsWith("#")) {
    const hexv = value.replace("#", "");
    // Require valid hex chars too (parity with generate.py): a bad-char string
    // of the right length would otherwise yield "NaN NaN NaN 255" here while
    // Python's int(..,16) raises — both must fall through to the default.
    if ((hexv.length === 6 || hexv.length === 8) && /^[0-9a-fA-F]+$/.test(hexv)) {
      const r = parseInt(hexv.substring(0, 2), 16);
      const g = parseInt(hexv.substring(2, 4), 16);
      const b = parseInt(hexv.substring(4, 6), 16);
      const a = hexv.length === 8 ? parseInt(hexv.substring(6, 8), 16) : 255;
      return `${r} ${g} ${b} ${a}`;
    }
  }
  return defaultValue;
};

/** [file, volume] -> a filter sound line, or null. */
const soundLineFromPair = (pair: any): string | null => {
  if (!pair || !Array.isArray(pair) || pair.length !== 2) return null;
  const [file, vol] = pair;
  if (typeof file !== "string") return null;
  if (file.startsWith("Default/AlertSound")) {
    const numMatch = file.match(/\d+/);
    const num = numMatch ? numMatch[0] : "1";
    return `PlayAlertSound ${num} ${vol}`;
  }
  const winPath = file.replace(/\//g, "\\");
  // NO "sound_files\" prefix: the game resolves a CustomAlertSound path relative to
  // the FILTER's own folder, not to this repo. Players drop the shipped
  // `Sharket掉落音效\` folder next to the .filter, which is what Sharket's own
  // released filter emits. Prefixing our repo's container directory made every alert
  // silently fail to load in game. (Mirrors generate.py.)
  return `CustomAlertSound "${winPath}" ${vol}`;
};

/**
 * PoE needs a SPACE between a comparison operator and its value: the game rejects
 * `StackSize >=10` outright ("cannot be recognised") while `StackSize >= 10` parses.
 * Both spellings are authorable in the editor and the tree contains both — `>= 300`
 * and `>= 50` alongside `>=10`, `>=100`, `>=1000`, `>=3000` — so one bad line broke
 * the whole filter in game. Normalising on emit fixes every existing case and any
 * future one, instead of chasing the data. Mirrors norm_op() in generate.py.
 */
const normOp = (val: any): any => {
  if (typeof val !== "string") return val;
  const m = val.trim().match(/^(==|!=|<=|>=|<|>|=)\s*(\S.*)$/);
  return m ? `${m[1]} ${m[2]}` : val;
};

const STYLE_PREFIXES = ["    Set", "    PlayEffect", "    MinimapIcon",
                       "    CustomAlertSound", "    PlayAlertSound"];

/**
 * Join a block, dropping style lines when it is a hide block.
 *
 * A `Hide` block renders nothing, so its styling was always dead weight. Under
 * RUTHLESS it is worse than dead: GGG does not permit `Hide` there, so HIDE_CMD
 * is `Minimal` — which still DRAWS a label. Emitting a font size and a plate on
 * it makes the very thing we are trying to quieten more visible, not less.
 * NeverSink's Ruthless filter emits conditions only on its Minimal blocks
 * ("Hide-Section replaced with minimal"). Mirrors block_text() in generate.py.
 */
const blockText = (blockLines: string[], isHide: boolean): string => {
  const kept = isHide
    ? blockLines.filter((l) => !STYLE_PREFIXES.some((p) => l.startsWith(p)))
    : blockLines;
  return kept.join('\n') + '\n';
};

/** Priority: rule override -> tier theme.PlayAlertSound -> sharket -> default */
const resolveSound = (tierEntry: any, soundMap: any, overrideSound?: [string, number]): string | null => {
  let line = soundLineFromPair(overrideSound);
  if (line) return line;

  // The tier style editor writes the sound it picks to theme.PlayAlertSound.
  // Nothing read it, so choosing a sound for a tier appeared to save and then did
  // nothing. A rule's own override still wins, which is why this sits below.
  line = soundLineFromPair((tierEntry.theme || {}).PlayAlertSound);
  if (line) return line;

  const sb = tierEntry.sound || {};
  // sharket_sound_id was authored WITH the ".mp3" extension in 192 of 197 tiers,
  // but class_sounds is keyed by the bare stem ("顶级底材", not "顶级底材.mp3").
  // The old exact-match lookup missed nearly every tier and fell through to
  // default_sound_id, so a tier asking for a custom Sharket sound played a stock
  // PoE alert instead, or was silent where default_sound_id was -1.
  const sid = sb.sharket_sound_id;
  const classSounds = soundMap?.class_sounds || {};
  if (sid) {
    let s = classSounds[sid];
    if (s === undefined && typeof sid === "string" && sid.toLowerCase().endsWith(".mp3")) {
      s = classSounds[sid.slice(0, -4)];
    }
    if (s !== undefined) {
      const winPath = s.file.replace(/\//g, "\\");
      return `CustomAlertSound "${winPath}" ${s.volume}`;
    }
  }

  if (sb.default_sound_id !== undefined && sb.default_sound_id !== -1) {
    return `PlayAlertSound ${sb.default_sound_id} 300`;
  }

  return null;
};

const tierNumFromLabel = (label: string): number => {
  if (label.includes("Tier 0")) return 0;
  if (label.includes("Hide")) return 9;
  const m = label.match(/Tier\s+(\d+)/);
  return m ? parseInt(m[1]) : 99;
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

  // Emit condition lines for a block. Mirrors generate.py: list → repeated AND
  // lines, "RANGE a b c d" → two lines, Rarity → strip a leading "==", else
  // "key value".
  const emitConditions = (lines: string[], conditions: any): void => {
    if (!conditions) return;
    Object.entries(conditions).forEach(([key, val]: [string, any]) => {
      if (Array.isArray(val)) {
        val.forEach((v: string) => lines.push(`    ${key} ${normOp(v)}`));
      } else if (typeof val === 'string' && val.startsWith("RANGE ")) {
        const parts = val.split(" ");
        if (parts.length >= 5) {
          lines.push(`    ${key} ${parts[1]} ${parts[2]}`);
          lines.push(`    ${key} ${parts[3]} ${parts[4]}`);
        }
      } else if (key === "Rarity") {
        const clean = typeof val === 'string' && val.trim().startsWith("==")
          ? val.trim().slice(2).trim() : val;
        lines.push(`    ${key} ${normOp(clean)}`);
      } else {
        lines.push(`    ${key} ${normOp(val)}`);
      }
    });
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

    const themeCatKey = meta.theme_category || categoryKey;
    const themeRef = (themeData || {})[themeCatKey] || (themeData || {})["Default"] || {};

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

      let ttheme = themeRef[`Tier ${tnum}`] || {};
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
        ttheme = themeRef[`Tier ${themeTnum}`] || ttheme;
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
        continue;
      }

      // Create a fresh deep copy of rules for this tier
      const allRules = JSON.parse(JSON.stringify(mapDoc.rules || []));

      // Auto-Inject Sound Rules.
      // basetype_sounds is GLOBAL: a base type with an entry gets a per-item sound in
      // every category that carries it. `suppress_basetype_sounds` on a category's
      // mapping _meta opts that category out, so the base keeps its per-item sound
      // elsewhere while this category speaks with one voice - the tier's own sound.
      const btSounds = (mapDoc._meta || {}).suppress_basetype_sounds
        ? {}
        : (soundMap?.basetype_sounds || {});
      items.forEach(item => {
        if (btSounds[item]) {
          const sData = btSounds[item];
          const handled = allRules.some((r: any) => r.targets?.includes(item));
          if (!handled) {
            allRules.push({
              targets: [item],
              // Inherit the TIER's conditions. Tier conditions are emitted only on
              // the base block, and an injected rule authors none of its own, so
              // without this the sound block dropped every gate its tier declared -
              // Rarity <= Rare, Corrupted False, the ItemLevel band. A unique
              // Stygian Vise was rendering as an ilvl-86 crafting base because its
              // auto-sound block said only BaseType == "Stygian Vise".
              conditions: JSON.parse(JSON.stringify(tierEntry.conditions || {})),
              overrides: { PlayAlertSound: [sData.file, sData.volume] },
              comment: `__AUTO_SOUND__:${item}`
            });
          }
        }
      });

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

        for (const [subgroup, modeLabel, isStrict] of groups) {
          if (isStrict !== null && subgroup.length === 0) continue;

          blockIndex++;
          const rOver = rule.overrides || {};
          const rawComment = rule.comment || '';
          let rulePart = "";

          if (rawComment.startsWith("__AUTO_SOUND__:")) {
            const itemKey = rawComment.split(":")[1].trim();
            const itemLocal = itemTrans[itemKey] || itemKey;
            rulePart = `${term('Auto-Sound')}：${itemLocal}`;
          } else {
            ruleCounter++;
            // Localizable rule name: rule.localization[lang] -> comment -> "Rule"
            const ruleName = (rule.localization || {})[language] || rawComment || term('Rule');
            rulePart = `#${ruleCounter} ${ruleName}`;
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
        }

        ruleMatches.forEach(m => pendingItems.delete(m));
      }

      // Base Block
      if (pendingItems.size > 0) {
        const matchModes = meta.match_modes || {};
        const exactPending = Array.from(pendingItems).filter((item: string) => (matchModes[item] || 'exact') === 'exact').sort();
        const partialPending = Array.from(pendingItems).filter((item: string) => matchModes[item] === 'partial').sort();

        for (const [subgroup, modeLabel, isStrict] of [[exactPending, "Exact", true], [partialPending, "Partial", false]] as const) {
          if (subgroup.length === 0) continue;

          blockIndex++;
          const finalMode = term(modeLabel);
          const baseLabel = term('Base');
          outLines.push(`\n#==[${blockIndex.toString().padStart(5, '0')}]- ${itemClassHeader} -${tierDisplay} ${locCat} - ${baseLabel} - ${finalMode}==`);

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
          blockLines.push(`    SetFontSize ${ttheme.FontSize || DEFAULT_FONT_SIZE}`);
          if (!styleOff(ttheme.TextColor)) blockLines.push(`    SetTextColor ${baseTextCol}`);
          if (!styleOff(ttheme.BorderColor)) blockLines.push(`    SetBorderColor ${baseBorderCol}`);
          if (!styleOff(ttheme.BackgroundColor)) blockLines.push(`    SetBackgroundColor ${baseBgCol}`);

          const soundLine = resolveSound(tierEntry, soundMap);
          if (soundLine) blockLines.push(`    ${soundLine}`);
          if (basePlayEff && !styleOff(basePlayEff)) blockLines.push(`    PlayEffect ${basePlayEff}`);
          if (baseMiniIcon && !styleOff(baseMiniIcon)) blockLines.push(`    MinimapIcon ${baseMiniIcon}`);

          outLines.push(blockText(blockLines, isHide));
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
