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
  en: { Rule: "Rule", Base: "Base", "Auto-Sound": "Auto-Sound", Exact: "Exact", Partial: "Partial" },
  ch: { Rule: "规则", Base: "基础", "Auto-Sound": "自动音效", Exact: "精确", Partial: "模糊" },
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
const styleOff = (value: any): boolean =>
  typeof value === 'string' && (value.startsWith('disabled:') || value === 'inherit' || value === 'default');

const parseRgba = (value: any, defaultValue: string = "255 255 255 255"): string => {
  if (!value || value === -1) return defaultValue;
  if (typeof value === "string" && value.startsWith("disabled:")) return defaultValue;
  
  if (typeof value === "string" && value.startsWith("#")) {
    const hexv = value.replace("#", "");
    if (hexv.length === 6 || hexv.length === 8) {
      const r = parseInt(hexv.substring(0, 2), 16);
      const g = parseInt(hexv.substring(2, 4), 16);
      const b = parseInt(hexv.substring(4, 6), 16);
      const a = hexv.length === 8 ? parseInt(hexv.substring(6, 8), 16) : 255;
      return `${r} ${g} ${b} ${a}`;
    }
  }
  return defaultValue;
};

const resolveSound = (tierEntry: any, soundMap: any, overrideSound?: [string, number]): string | null => {
  if (overrideSound && Array.isArray(overrideSound)) {
    const [file, vol] = overrideSound;
    if (file.startsWith("Default/AlertSound")) {
      const numMatch = file.match(/\d+/);
      const num = numMatch ? numMatch[0] : "1";
      return `PlayAlertSound ${num} ${vol}`;
    } else {
      const winPath = file.replace(/\//g, "\\");
      return `CustomAlertSound "sound_files\\${winPath}" ${vol}`;
    }
  }

  const sb = tierEntry.sound || {};
  if (sb.sharket_sound_id && soundMap?.class_sounds?.[sb.sharket_sound_id]) {
    const s = soundMap.class_sounds[sb.sharket_sound_id];
    const winPath = s.file.replace(/\//g, "\\");
    return `CustomAlertSound "sound_files\\${winPath}" ${s.volume}`;
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

  // The deployed generator is mode-less ≈ generate.py --mode standard. MODE
  // gates excluded_modes and HIDE_CMD exactly as the Python side does; when the
  // Ruthless milestone lands, this becomes a parameter.
  const MODE = 'standard';
  const HIDE_CMD = 'Hide';

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
        val.forEach((v: string) => lines.push(`    ${key} ${v}`));
      } else if (typeof val === 'string' && val.startsWith("RANGE ")) {
        const parts = val.split(" ");
        if (parts.length >= 5) {
          lines.push(`    ${key} ${parts[1]} ${parts[2]}`);
          lines.push(`    ${key} ${parts[3]} ${parts[4]}`);
        }
      } else if (key === "Rarity") {
        const clean = typeof val === 'string' && val.trim().startsWith("==")
          ? val.trim().slice(2).trim() : val;
        lines.push(`    ${key} ${clean}`);
      } else {
        lines.push(`    ${key} ${val}`);
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

  // Process all mappings, sorted by path with _campaign FIRST: filters are
  // first-match-wins and every campaign tier is AreaLevel-guarded (<= 67), so
  // campaign owns the acts and goes inert at endgame. Other underscore folders
  // (_legacy, _unclassified) stay last. (Mirrors _sort_key in generate.py.)
  const pathSortKey = (p: string): string => {
    const folder = p.split('/')[0];
    if (folder === '_campaign') return '!campaign' + p.slice('_campaign'.length);
    if (folder.startsWith('_')) return '~' + p.slice(1);
    return p;
  };
  const sortedPaths = Object.keys(allMappings).sort((a, b) => {
    const ka = pathSortKey(a), kb = pathSortKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
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
      const tierDisplay = tierEntry.localization?.en || `Tier ${tnum}`;

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
        const ccDisplay = tierEntry.localization?.en || tLbl;
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
        outLines.push(ccLines.join('\n') + '\n');
        continue;
      }

      // Create a fresh deep copy of rules for this tier
      const allRules = JSON.parse(JSON.stringify(mapDoc.rules || []));

      // Auto-Inject Sound Rules
      const btSounds = soundMap?.basetype_sounds || {};
      items.forEach(item => {
        if (btSounds[item]) {
          const sData = btSounds[item];
          const handled = allRules.some((r: any) => r.targets?.includes(item));
          if (!handled) {
            allRules.push({
              targets: [item],
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

        if (ruleTierOverride) {
          if (ruleTierOverride === tLbl) {
            ruleMatches = applyToTier ? Array.from(pendingItems) : ruleTargets;
          } else {
            continue;
          }
        } else {
          if (ruleTargets.length > 0) {
            ruleMatches = ruleTargets.filter((item: string) => pendingItems.has(item));
          } else {
            continue;
          }
        }

        if (ruleMatches.length === 0) continue;

        const exactGroup = ruleMatches.filter((m: string) => (matchModes[m] || 'exact') === 'exact');
        const partialGroup = ruleMatches.filter((m: string) => matchModes[m] === 'partial');

        for (const [subgroup, modeLabel, isStrict] of [[exactGroup, "Exact", true], [partialGroup, "Partial", false]] as const) {
          if (subgroup.length === 0) continue;

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
            rulePart = `#${ruleCounter} ${rawComment || term('Rule')}`;
          }

          const finalMode = term(modeLabel);
          outLines.push(`\n#==[${blockIndex.toString().padStart(5, '0')}]- ${itemClassHeader} -${tierDisplay} ${locCat} - ${rulePart} - ${finalMode}==`);

          const cmd = isHide ? HIDE_CMD : "Show";
          const btOp = isStrict ? " == " : " ";
          const blockLines = [
            `${cmd}`,
            `    BaseType${btOp}"${subgroup.join('" "')}"`
          ];

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

          outLines.push(blockLines.join('\n') + '\n');
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

          outLines.push(blockLines.join('\n') + '\n');
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
