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

export const generateFilterText = (style: StyleProps, baseTypes: string[] = ["Item Name"], hideable: boolean = false, rules: any[] = [], includeBase: boolean = true, summarizeRules: boolean = false, language: Language = 'en'): string => {
  const allBlocks: string[] = [];
  const t = translations[language];
  let allItemsCovered = false;

  // 1. Process Rules first
  if (summarizeRules && rules.length > 0) {
      const implicitCount = rules.filter((r: any) => r.isImplicit).length;
      const explicitCount = rules.length - implicitCount;
      let summary = `# ... (`;
      const parts = [];
      if (explicitCount > 0) parts.push(`${explicitCount} ${(t as any).customRules}`);
      if (implicitCount > 0) parts.push(`${implicitCount} ${(t as any).autoSounds}`);
      
      summary += parts.join(` ${(t as any).and} `);
      summary += ` ${(t as any).active}) ...`;
      
      allBlocks.push(summary);
  } else {
      rules.forEach((rule) => {
        const rLines = [];
        const rKeyword = hideable ? "Hide" : "Show";
        rLines.push(rKeyword);
        
        // Class constraint
        rLines.push(`    Class "Item Class"`);

        // BaseType constraint for rule
        const hasTargets = rule.targets && rule.targets.length > 0;
        const targets = hasTargets ? rule.targets : baseTypes;
        if (!hasTargets) allItemsCovered = true; // Rule applies to everything in tier

        // Default to strict matching for now to match generate.py common case
        rLines.push(`    BaseType == "${targets.join('" "')}"`);

        // 2. Conditions
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

        // 3. Raw text (Custom Code)
        if (rule.raw) {
            rule.raw.split('\n').forEach((line: string) => {
                if (line.trim()) {
                    rLines.push(`    ${line.trim()}`);
                }
            });
        }

        // 4. Styles
        const ruleStyle = { ...style, ...(rule.overrides || {}) };
        _appendStyleLines(rLines, ruleStyle);

        allBlocks.push(rLines.join('\n'));
      });
  }

  // 2. Process the main Base block
  // If we are showing full block, and not all items were covered by rules, show base
  if (includeBase && !allItemsCovered) {
    const lines = [];
    const keyword = hideable ? "Hide" : "Show";
    lines.push(keyword);
    lines.push(`    Class "Item Class"`);
    lines.push(`    BaseType == "${baseTypes.join('" "')}"`);
    _appendStyleLines(lines, style);
    
    allBlocks.push(lines.join('\n'));
  }

  return allBlocks.join('\n\n');
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