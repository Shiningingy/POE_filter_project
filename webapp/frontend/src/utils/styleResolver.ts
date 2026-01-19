import { translations, type Language } from './localization';

interface StyleProps {
  FontSize?: number;
  TextColor?: string;
  BorderColor?: string;
  BackgroundColor?: string;
  PlayEffect?: string;
  MinimapIcon?: string;
  PlayAlertSound?: [string, number];
  [key: string]: any;
}

export const resolveStyle = (tierData: any, themeData: any, themeCategory: string = "Stackable Currency", soundMap?: any): StyleProps => {
  const localTheme = tierData.theme || {};
  const localSound = tierData.sound || {};
  let resolved: StyleProps = {};

  // 1. Check if it references a global tier
  if (localTheme.Tier !== undefined) {
    const tierKey = `Tier ${localTheme.Tier}`;
    // Try category, then fallback to common keys
    const globalStyle = themeData?.[themeCategory]?.[tierKey] || 
                        themeData?.["Stackable Currency"]?.[tierKey] || 
                        themeData?.["Currency"]?.[tierKey] || 
                        themeData?.["currency"]?.[tierKey] || {}; 
    resolved = { ...globalStyle };
  }

  // 2. Merge local overrides
  const { Tier, ...overrides } = localTheme;
  resolved = { ...resolved, ...overrides };

  // 3. Resolve Sound
  if (localSound.sharket_sound_id && soundMap && soundMap.class_sounds && soundMap.class_sounds[localSound.sharket_sound_id]) {
      const s = soundMap.class_sounds[localSound.sharket_sound_id];
      resolved.PlayAlertSound = [s.file, s.volume];
  } else if (localSound.default_sound_id !== undefined && localSound.default_sound_id !== -1) {
      resolved.PlayAlertSound = [`Default/AlertSound${localSound.default_sound_id}.mp3`, 300];
  } else if (resolved.PlayAlertSound) {
      // If it's a "Sharket_Sound_X.mp3" placeholder, try to map it to Default/AlertSoundX.mp3
      const [file, vol] = resolved.PlayAlertSound;
      if (typeof file === 'string' && file.startsWith('Sharket_Sound_')) {
          const num = file.match(/\d+/)?.[0];
          if (num) {
              resolved.PlayAlertSound = [`Default/AlertSound${num}.mp3`, vol];
          }
      }
  }

  return resolved;
};

export const generateIconUrl = (itemName: string, itemClass?: string): string => {
    // Basic logic to generate PoE CDN urls. 
    // They usually follow a pattern but have a dynamic hash part.
    // For many base items, we can use a "predictable" part if we know the class.
    
    const cleanName = itemName.replace(/[^a-zA-Z]/g, '');
    let category = "Currency";
    
    if (itemClass) {
        if (itemClass.includes("Gem")) category = "Gems";
        else if (itemClass.includes("Map")) category = "Maps";
        else if (itemClass.includes("Divination")) category = "Divination";
    }

    // This is a placeholder for a more complex mapping. 
    // For now, return a reliable placeholder or try a lucky guess for currency.
    if (category === "Currency") {
        return `https://web.poecdn.com/image/art/2DItems/Currency/${cleanName}.png?scale=1`;
    }
    
    return `https://web.poecdn.com/image/art/2DItems/${category}/${cleanName}.png?scale=1`;
};

export const generateFilterText = (style: StyleProps, baseTypes: string[] = ["Item Name"], hideable: boolean = false, rules: any[] = [], includeBase: boolean = true, summarizeRules: boolean = false, language: Language = 'en'): string => {
  const allBlocks: string[] = [];
  const t = translations[language];
  // Filter empty strings from baseTypes to prevent empty BaseType lines
  const cleanBaseTypes = baseTypes.filter(b => b && b.trim() !== "");
  const pendingBaseItems = new Set(cleanBaseTypes);

  // 1. Process Rules (Explicit & Implicit)
  if (summarizeRules && rules.length > 0) {
      const implicitCount = rules.filter((r: any) => r.isImplicit).length;
      const explicitCount = rules.length - implicitCount;
      let summary = `# ... (`;
      const parts = [];
      if (explicitCount > 0) parts.push(`${explicitCount} ${(t as any).customRules || 'custom rules'}`);
      if (implicitCount > 0) parts.push(`${implicitCount} ${(t as any).autoSounds || 'auto-sounds'}`);
      
      summary += parts.join(` ${(t as any).and || 'and'} `);
      summary += ` ${(t as any).active || 'active'}) ...`;
      
      allBlocks.push(summary);
      
      // Remove targets from pendingBaseItems logic:
      // If summarizing, we usually hide the rules.
      // User wants auto-sound items to appear in the Base Block (generic preview).
      // So we ONLY remove targets of EXPLICIT rules (custom rules).
      // Implicit (auto-sound) targets remain in pendingBaseItems and get rendered in the Base Block.
      rules.forEach(r => {
          if (!r.isImplicit && r.targets) {
              r.targets.forEach((t: string) => pendingBaseItems.delete(t));
          }
      });
  } else {
      // Grouping rules by their overrides to reduce clutter
      // (This handles cases where multiple auto-sounds or rules share identical settings)
      const groups: Record<string, { items: string[], rule: any }> = {};

      rules.forEach((rule) => {
          if (rule.disabled) return;
          
          // Remove from pending base
          const targets = rule.targets && rule.targets.length > 0 ? rule.targets : cleanBaseTypes;
          if (rule.targets) rule.targets.forEach((t: string) => pendingBaseItems.delete(t));
          else pendingBaseItems.clear();

          // Create a key for grouping
          const overrideKey = JSON.stringify({ 
              o: rule.overrides || {}, 
              c: rule.conditions || {},
              isI: !!rule.isImplicit 
          });

          if (!groups[overrideKey] && !rule.raw) {
              groups[overrideKey] = { items: [...targets], rule };
          } else if (groups[overrideKey] && !rule.raw) {
              groups[overrideKey].items.push(...targets);
          } else {
              // Rules with raw code or unique settings get their own block immediately
              allBlocks.push(_generateBlock(rule, targets, style, hideable));
          }
      });

      // Render grouped blocks
      Object.values(groups).forEach(g => {
          allBlocks.push(_generateBlock(g.rule, g.items, style, hideable));
      });
  }

  // 2. Main Base Block
  if (includeBase && pendingBaseItems.size > 0) {
    const lines = [];
    lines.push(hideable ? "Hide" : "Show");
    lines.push(`    BaseType == "${Array.from(pendingBaseItems).sort().join('" "')}"`);
    _appendStyleLines(lines, style);
    allBlocks.push(lines.join('\n'));
  }

  return allBlocks.join('\n\n');
};

const _generateBlock = (rule: any, targets: string[], baseStyle: any, hideable: boolean) => {
    const rLines = [];
    
    if (rule.comment) {
        const cleanComment = rule.comment.startsWith("__AUTO_SOUND__:") 
            ? `Auto-Sound: ${rule.comment.split(":")[1]}`
            : rule.comment;
        rLines.push(`    # ${cleanComment}`);
    }

    rLines.push(hideable ? "Hide" : "Show");
    
    // Use unique targets only
    const uniqueTargets = Array.from(new Set(targets)).sort();
    rLines.push(`    BaseType == "${uniqueTargets.join('" "')}"`);

    if (rule.conditions) {
        Object.entries(rule.conditions as Record<string, string>).forEach(([key, val]) => {
            if (val.startsWith("RANGE ")) {
                const parts = val.split(" ");
                if (parts.length >= 5) {
                    rLines.push(`    ${key} ${parts[1]} ${parts[2]}`);
                    rLines.push(`    ${key} ${parts[3]} ${parts[4]}`);
                }
            } else if (key === "Rarity") {
                const cleanVal = val.replace(/==|=/g, "").trim();
                rLines.push(`    ${key} ${cleanVal}`);
            } else {
                rLines.push(`    ${key} ${val}`);
            }
        });
    }

    if (rule.raw) {
        rule.raw.split('\n').forEach((line: string) => {
            if (line.trim()) rLines.push(`    ${line.trim()}`);
        });
    }

    const ruleStyle = { ...baseStyle, ...(rule.overrides || {}) };
    _appendStyleLines(rLines, ruleStyle);

    return rLines.join('\n');
};

const _appendStyleLines = (lines: string[], style: StyleProps) => {
  if (style.FontSize) lines.push(`    SetFontSize ${style.FontSize}`);
  
  const toRgba = (hex?: string) => {
    if (!hex) return "255 255 255 255";
    const cleanHex = hex.startsWith('disabled:') ? hex.split(':')[1] : hex;
    if (!cleanHex.startsWith('#')) return "255 255 255 255";
    
    const r = parseInt(cleanHex.substring(1, 3), 16);
    const g = parseInt(cleanHex.substring(3, 5), 16);
    const b = parseInt(cleanHex.substring(5, 7), 16);
    let a = 255;
    if (cleanHex.length >= 9) {
        a = parseInt(cleanHex.substring(7, 9), 16);
    }
    return `${r} ${g} ${b} ${a}`;
  };

  const isActive = (val: any) => val && (typeof val !== 'string' || !val.startsWith('disabled:'));

  if (isActive(style.TextColor)) lines.push(`    SetTextColor ${toRgba(style.TextColor)}`);
  if (isActive(style.BorderColor)) lines.push(`    SetBorderColor ${toRgba(style.BorderColor)}`);
  if (isActive(style.BackgroundColor)) lines.push(`    SetBackgroundColor ${toRgba(style.BackgroundColor)}`);
  
  if (isActive(style.PlayEffect)) lines.push(`    PlayEffect ${style.PlayEffect}`);
  if (isActive(style.MinimapIcon)) {
      lines.push(`    MinimapIcon ${style.MinimapIcon}`);
  }
  
  if (style.PlayAlertSound) {
    const [file, vol] = style.PlayAlertSound;
    if (file.startsWith('Default/AlertSound')) {
        const num = file.match(/\d+/)?.[0] || "1";
        lines.push(`    PlayAlertSound ${num} ${vol}`);
    } else {
        const winPath = file.replace(/\//g, '\\');
        lines.push(`    CustomAlertSound "sound_files\\${winPath}" ${vol}`);
    }
  }
};