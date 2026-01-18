import { translations, type Language } from './localization';

// ===========================
// TYPES
// ===========================

interface GeneratorData {
  themeData: any;
  soundMap: any;
  allMappings: Record<string, any>; // path -> content
  allTierDefinitions: Record<string, any>; // path -> content
  language: Language;
}

// ===========================
// CONFIG
// ===========================

const DEFAULT_FONT_SIZE = 32;

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
  "Uniques": "传奇"
};

// ===========================
// UTILITIES
// ===========================

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
  const t = translations[language] as any;
  const isCh = language === 'ch';

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

  // Process all mappings (Sorted by path)
  const sortedPaths = Object.keys(allMappings).sort();

  for (const relPath of sortedPaths) {
    const mapDoc = allMappings[relPath];
    const tierDoc = allTierDefinitions[relPath];
    if (!tierDoc) continue;

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
      locCat = locData.__class_name__ || meta.localization?.ch || locEn;
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
    const themeRef = (themeData || {})[themeCatKey] || (themeData || {})["Currency"] || {};

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
    const itemsByTier: Record<string, string[]> = {};
    Object.entries(mapping).forEach(([item, tVal]) => {
      const tiers = Array.isArray(tVal) ? tVal : [tVal];
      tiers.forEach(t => {
        if (!itemsByTier[t]) itemsByTier[t] = [];
        itemsByTier[t].push(item);
      });
    });

    let tierOrder = meta.tier_order || [];
    const usedTiers = Object.keys(itemsByTier);
    usedTiers.forEach(t => {
      if (!tierOrder.includes(t)) tierOrder.push(t);
    });

    for (const tLbl of tierOrder) {
      if (!categoryData[tLbl]) continue;

      const items = itemsByTier[tLbl] || [];
      const tierEntry = categoryData[tLbl];
      const isHideTier = !!tierEntry.is_hide_tier;
      const tnum = tierNumFromLabel(tLbl);

      const ttheme = themeRef[`Tier ${tnum}`] || {};
      const baseTextCol = parseRgba(ttheme.TextColor);
      const baseBorderCol = parseRgba(ttheme.BorderColor);
      const baseBgCol = parseRgba(ttheme.BackgroundColor, "0 0 0 255");
      const basePlayEff = ttheme.PlayEffect;
      const baseMiniIcon = ttheme.MinimapIcon;

      // Create a fresh deep copy of rules for this tier
      const allRules = JSON.parse(JSON.stringify(mapDoc.rules || []));

      // Auto-Inject Sound Rules
      const btSounds = soundMap?.basetype_sounds || {};
      items.forEach(item => {
        if (btSounds[item]) {
          const sData = btSounds[item];
          const handled = allRules.some((r: any) => r.targets?.includes(item));
          if (!handled) {
            console.log(`TS GENERATOR: Injecting auto-sound for ${item}`);
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
            rulePart = `${t.autoSounds || 'Auto-Sound'}：${itemLocal}`;
          } else {
            ruleCounter++;
            rulePart = `#${ruleCounter} ${rawComment || (t.rule || 'Rule')}`;
          }

          const finalMode = t[modeLabel] || modeLabel;
          outLines.push(`\n#==[${blockIndex.toString().padStart(5, '0')}]- ${itemClassHeader} -Tier ${tnum} ${locCat} - ${rulePart} - ${finalMode}==`);

          const cmd = isHideTier ? "Hide" : "Show";
          const btOp = isStrict ? " == " : " ";
          const blockLines = [
            `${cmd}`,
            `    BaseType${btOp}"${subgroup.join('" "')}"`
          ];

          if (rule.conditions) {
            Object.entries(rule.conditions).forEach(([key, val]: [string, any]) => {
              if (typeof val === 'string' && val.startsWith("RANGE ")) {
                const parts = val.split(" ");
                if (parts.length >= 5) {
                  blockLines.push(`    ${key} ${parts[1]} ${parts[2]}`);
                  blockLines.push(`    ${key} ${parts[3]} ${parts[4]}`);
                }
              } else if (key === "Rarity") {
                const cleanVal = val.replace(/==|=/g, "").trim();
                blockLines.push(`    ${key} ${cleanVal}`);
              } else {
                blockLines.push(`    ${key} ${val}`);
              }
            });
          }

          if (rule.raw) {
            rule.raw.split('\n').forEach((l: string) => { if (l.trim()) blockLines.push(`    ${l.trim()}`); });
          }

          blockLines.push(`    SetFontSize ${rOver.FontSize || ttheme.FontSize || DEFAULT_FONT_SIZE}`);
          blockLines.push(`    SetTextColor ${parseRgba(rOver.TextColor, baseTextCol)}`);
          blockLines.push(`    SetBorderColor ${parseRgba(rOver.BorderColor, baseBorderCol)}`);
          blockLines.push(`    SetBackgroundColor ${parseRgba(rOver.BackgroundColor, baseBgCol)}`);

          const soundLine = resolveSound(tierEntry, soundMap, rOver.PlayAlertSound);
          if (soundLine) blockLines.push(`    ${soundLine}`);
          if (rOver.PlayEffect || basePlayEff) blockLines.push(`    PlayEffect ${rOver.PlayEffect || basePlayEff}`);
          if (rOver.MinimapIcon || baseMiniIcon) blockLines.push(`    MinimapIcon ${rOver.MinimapIcon || baseMiniIcon}`);

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
          const finalMode = t[modeLabel] || modeLabel;
          const baseLabel = t.Base || "Base";
          outLines.push(`\n#==[${blockIndex.toString().padStart(5, '0')}]- ${itemClassHeader} -Tier ${tnum} ${locCat} - ${baseLabel} - ${finalMode}==`);

          const cmd = isHideTier ? "Hide" : "Show";
          const btOp = isStrict ? " == " : " ";
          const blockLines = [
            `${cmd}`,
            `    BaseType${btOp}"${subgroup.join('" "')}"`, 
            `    SetFontSize ${ttheme.FontSize || DEFAULT_FONT_SIZE}`,
            `    SetTextColor ${baseTextCol}`,
            `    SetBorderColor ${baseBorderCol}`,
            `    SetBackgroundColor ${baseBgCol}`
          ];

          const soundLine = resolveSound(tierEntry, soundMap);
          if (soundLine) blockLines.push(`    ${soundLine}`);
          if (basePlayEff) blockLines.push(`    PlayEffect ${basePlayEff}`);
          if (baseMiniIcon) blockLines.push(`    MinimapIcon ${baseMiniIcon}`);

          outLines.push(blockLines.join('\n') + '\n');
        }
      }
    }
  }

  overview.push("#========================================\n");
  return overview.join('\n') + '\n' + outLines.join('\n') + '\n';
};
