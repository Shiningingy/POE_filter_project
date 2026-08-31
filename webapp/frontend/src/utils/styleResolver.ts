import { useTranslation, type Language } from './localization';
import {
  resolveTierTheme, resolveSoundPair, soundLineFromPair, styleLines, conditionLines, blockText,
  styleOff,
} from './filterStyle';

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

/**
 * The style the editor shows for a tier block — resolved by the SAME code the
 * exported filter uses (`filterStyle`), so the preview cannot disagree with it.
 *
 * It used to disagree in several ways at once, all of which made authoring feel
 * like it worked when it did not:
 *   * it spread the tier's inline `theme` on top, while both generators read only
 *     `Tier` and `PlayAlertSound` out of that block — 216 authored inline keys
 *     across 24 tier files were previewed and then discarded on export;
 *   * it looked the theme row up through a chain no generator has
 *     ("Stackable Currency" -> "Currency" -> "currency" -> "Templates") and
 *     defaulted the category to "Stackable Currency", so blocks the filter emits
 *     bare showed a plausible borrowed style;
 *   * it kept a private copy of the sound priority chain.
 *
 * `tierKey` is needed because the theme row is keyed by tier NUMBER, which comes
 * from the key when the tier does not state `theme.Tier` explicitly.
 */
/** Channels a decorator is allowed to paint. FontSize is excluded on purpose: a state
 *  says "this item is corrupted", never "this item is bigger". */
const DECORATABLE = ["TextColor", "BorderColor", "BackgroundColor", "PlayEffect", "MinimapIcon"] as const;

export const resolveStyle = (
  tierData: any,
  themeData: any,
  themeCategory: string = "Default",
  soundMap?: any,
  tierKey: string = "",
  decorators: any[] = [],
): StyleProps => {
  const row = resolveTierTheme(themeData, themeCategory, tierData, tierKey);

  // ★ Decorators sit BENEATH the block, because `Continue` lets later blocks override
  // only the properties they set — so a state shows exactly where the block leaves that
  // channel unset (reference_poe_filter_format.md §3). With no decorators this is
  // literally the old behaviour: `base` is empty and every row entry is copied through,
  // sentinels included.
  const base: any = {};
  for (const d of decorators) {
    for (const k of DECORATABLE) {
      const v = d?.theme?.[k];
      if (v !== undefined && !styleOff(v)) base[k] = v;
    }
  }
  const resolved: StyleProps = { ...base } as StyleProps;
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    // The block explicitly gives this channel up, and a decorator claimed it: the
    // decorator wins. That asymmetry IS the feature.
    if (styleOff(v) && k in base) continue;
    (resolved as any)[k] = v;
  }

  const pair = resolveSoundPair(tierData, soundMap);
  if (pair) {
    const [file, vol] = pair;
    // "Sharket_Sound_X.mp3" is a dead placeholder (no file, no map entry) left in 12
    // tiers; render it as the stock alert it stands in for.
    const num = file.startsWith('Sharket_Sound_') ? file.match(/\d+/)?.[0] : undefined;
    resolved.PlayAlertSound = num ? [`Default/AlertSound${num}.mp3`, vol] : [file, vol];
  } else {
    delete resolved.PlayAlertSound;
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
  const t = useTranslation(language);
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

          // A self-selecting rule supplies its own matching lines, so the generator
          // emits NO BaseType line for it. Falling back to the tier's whole base
          // list here put a second BaseType line above the raw one in the preview.
          //
          // ANY condition counts, not just BaseType/Class — a rule saying
          // `Rarity Unique` + `LinkedSockets >= 6` is a complete selector on its own.
          // This preview kept the OLD narrow definition after the generators were
          // widened, so it disagreed with the export for ~40 rules.
          const selfSelecting = !!rule.raw || Object.keys(rule.conditions || {}).length > 0;

          // Remove from pending base
          const targets = rule.targets && rule.targets.length > 0
              ? rule.targets
              : (selfSelecting ? [] : cleanBaseTypes);
          if (rule.targets && rule.targets.length > 0) rule.targets.forEach((t: string) => pendingBaseItems.delete(t));
          else if (!selfSelecting) pendingBaseItems.clear();

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
    allBlocks.push(blockText(lines, hideable).replace(/\n$/, ''));
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

    // No targets = self-selecting rule: its own raw/BaseType lines do the matching.
    if (targets.length > 0) {
        const uniqueTargets = Array.from(new Set(targets)).sort();
        rLines.push(`    BaseType == "${uniqueTargets.join('" "')}"`);
    }

    // Shared emitter: the private copy skipped normOp, so a condition authored as
    // `StackSize >=10` previewed exactly that way — the spelling the game rejects
    // outright — while the export silently normalised it.
    rLines.push(...conditionLines(rule.conditions));

    if (rule.raw) {
        rule.raw.split('\n').forEach((line: string) => {
            if (line.trim()) rLines.push(`    ${line.trim()}`);
        });
    }

    const overrides = rule.overrides || {};
    const sound = 'PlayAlertSound' in overrides ? overrides.PlayAlertSound : baseStyle?.PlayAlertSound;
    rLines.push(...styleLines(baseStyle, overrides, soundLineFromPair(sound)));

    // A hide block draws nothing (and under Ruthless, `Minimal` still draws a
    // LABEL), so styling it is worse than useless — the generators strip it.
    return blockText(rLines, hideable).replace(/\n$/, '');
};

/**
 * Style lines for an ALREADY-RESOLVED style object, via the shared emitter.
 *
 * The private copy this replaces got three things wrong that the game cares
 * about: it emitted `CustomAlertSound "sound_files\..."` (the game resolves that
 * path against the FILTER's folder, so every alert failed silently), it rendered
 * a `"disabled:"` sound as the literal path `sound_files\d`, and it skipped
 * SetFontSize whenever the value was absent while the generators always emit it.
 */
const _appendStyleLines = (lines: string[], style: StyleProps) => {
  lines.push(...styleLines(style, {}, soundLineFromPair(style.PlayAlertSound)));
};