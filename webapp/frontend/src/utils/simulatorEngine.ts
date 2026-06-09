import type { CSSProperties } from 'react';

export interface ItemProps {
    name: string; // BaseType
    class: string;
    dropLevel?: number;
    rarity?: 'Normal' | 'Magic' | 'Rare' | 'Unique';
    itemLevel?: number;
    quality?: number;
    sockets?: string; // "R G B" or number
    linkedSockets?: number;
    width?: number;
    height?: number;
    identified?: boolean;
    corrupted?: boolean;
    mirrored?: boolean;
    fractured?: boolean;
    synthesised?: boolean;
    elder?: boolean;
    shaper?: boolean;
    crusader?: boolean;
    redeemer?: boolean;
    hunter?: boolean;
    warlord?: boolean;
    hasImplicit?: boolean;
    stackSize?: number;
    exarch?: boolean;              // Searing Exarch eldritch influence
    eater?: boolean;               // Eater of Worlds eldritch influence
    gemLevel?: number;             // Gem level (1-21)
    corruptedImplicit?: string;    // Corrupted implicit text (placeholder until real data source)
    name_ch?: string;              // Chinese localized base type name
    memoryStrands?: boolean;       // Memory strand item (left icon slot)
    [key: string]: any;
}

export interface FilterContext {
    mappings: Record<string, any>; // FilePath -> Content
    tierDefinitions: Record<string, any>; // FilePath -> Content
    theme: any; // Active Theme Data
    overrides: any; // Custom Overrides
    globalAreaLevel?: number; // Environment context
}

export interface SimulationResult {
    visible: boolean;
    style: CSSProperties & { sound?: any };
    matchedRule?: string;
    matchedTier?: string;
    matchedFile?: string;
}

export interface RuleMatch {
    file: string;            // base_mapping path
    ruleIndex: number | null; // index into the file's rules[]; null = matched via base mapping
    tier: string;
    ruleComment?: string;
    conditionsSummary?: string;
    isBaseMapping: boolean;
    style: CSSProperties & { sound?: any };
    visible: boolean;
}

export const parseClipboardItem = (text: string): ItemProps => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const item: ItemProps = { name: "Unknown", class: "Unknown" };
    
    if (lines.length > 0 && !lines[0].includes(':') && lines[0] !== '--------') {
        item.name = lines[0];
    }

    lines.forEach(line => {
        if (line === '--------') return;
        
        if (line.includes(': ')) {
            const parts = line.split(': ');
            const key = parts[0].trim();
            const val = parts.slice(1).join(': ').trim();
            
            switch(key) {
                case 'Class': item.class = val; break;
                case 'DropLevel': item.dropLevel = parseInt(val); break;
                case 'ItemLevel': item.itemLevel = parseInt(val); break;
                case 'Rarity': item.rarity = val as any; break;
                case 'Width': item.width = parseInt(val); break;
                case 'Height': item.height = parseInt(val); break;
                case 'Sockets': item.sockets = val; break;
                case 'LinkedSockets': item.linkedSockets = parseInt(val); break;
                case 'Quality': item.quality = parseInt(val); break;
                case 'Stack Size': item.stackSize = parseInt(val); break;
                case 'HasImplicitMod': item.hasImplicit = val === 'True'; break;
            }
        } else {
            if (line === 'Corrupted') item.corrupted = true;
            if (line === 'Mirrored') item.mirrored = true;
            if (line === 'Fractured') item.fractured = true;
            if (line === 'Synthesised') item.synthesised = true;
            if (line === 'Unidentified') item.identified = false; // Default true?
            if (line === 'Identified') item.identified = true;
            if (line === 'Shaper Item') item.shaper = true;
            if (line === 'Elder Item') item.elder = true;
        }
    });
    
    return item;
};

// --- Evaluation Logic ---

export const evaluateItem = (item: ItemProps, context: FilterContext): SimulationResult => {
    let matchedTier: string | null = null;
    let matchedFile = null;
    let matchedRuleName = null;

    // 1. Search specific mapping & Apply Rules
    const itemNameLower = item.name.toLowerCase();

    for (const [path, content] of Object.entries(context.mappings)) {
        const rules = content.rules || [];
        for (const rule of rules) {
            if (checkRuleMatch(item, rule, context.globalAreaLevel)) {
                if (rule.overrides && rule.overrides.Tier) {
                    matchedTier = rule.overrides.Tier;
                    matchedFile = path;
                    matchedRuleName = rule.comment || "Custom Rule";
                    break; 
                }
            }
        }
        if (matchedTier) break; 

        const mapping = content.mapping || {};
        const matchKey = Object.keys(mapping).find(k => k.toLowerCase() === itemNameLower);
        if (matchKey) {
            matchedTier = mapping[matchKey];
            matchedFile = path;
            break; 
        }
    }
    
    if (matchedTier) {
        if (Array.isArray(matchedTier)) {
            matchedTier = matchedTier[0];
        }
    } else {
        matchedTier = "Untiered";
    }

    // 2 + 3. Resolve category + style from theme (shared with getMatchingRules)
    const { style, visible } = resolveStyle(matchedFile, matchedTier, context);

    return {
        visible,
        style,
        matchedTier: matchedTier || undefined,
        matchedRule: matchedRuleName || undefined,
        matchedFile: matchedFile || undefined
    };
};

// Resolve the category + rendered style for a (file, tier) pair. Extracted from
// evaluateItem so the rule-inspector (getMatchingRules) renders identical styles.
const resolveStyle = (
    matchedFile: string | null,
    matchedTier: string,
    context: FilterContext
): { style: CSSProperties & { sound?: any }; visible: boolean; category: string } => {
    // 2. Resolve Category
    let category = "Templates";
    if (matchedFile) {
        const mappingContent = context.mappings[matchedFile];
        const metaCat = mappingContent?._meta?.theme_category;

        if (metaCat) {
            category = metaCat;
        } else {
            const parts = matchedFile.split('/');
            const relevantParts = parts.filter(p => p !== 'base_mapping' && !p.endsWith('.json'));
            if (relevantParts.length > 0) {
                category = relevantParts[relevantParts.length - 1];
            }
            if (category === "Fragments") category = "Map Fragments";
        }
    }

    // 3. Resolve Style from Theme
    let style: CSSProperties = {
        color: '#888',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderColor: '#333',
        borderStyle: 'solid',
        borderWidth: '1px',
        fontSize: '14px',
        padding: '2px 6px',
        fontFamily: 'Fontin, sans-serif'
    };

    let visible = true;

    let themeStyle = null;
    if (matchedTier && matchedTier !== "Untiered") {
        const tierMatch = matchedTier.match(/Tier \d+/);
        const normalizedTier = tierMatch ? tierMatch[0] : matchedTier;

        const checkStyle = (cat: string, tier: string) => {
            if (context.overrides && context.overrides[cat] && context.overrides[cat][tier]) return context.overrides[cat][tier];
            if (context.theme && context.theme[cat] && context.theme[cat][tier]) return context.theme[cat][tier];
            return null;
        };

        // Priority lookup
        themeStyle = checkStyle(category, matchedTier);
        if (!themeStyle) themeStyle = checkStyle(category, normalizedTier);
        if (!themeStyle) themeStyle = checkStyle("Templates", matchedTier);
        if (!themeStyle) themeStyle = checkStyle("Templates", normalizedTier);

        // Final fallback: use inline style overrides from the corresponding tier_definition file
        if (!themeStyle && matchedFile && context.tierDefinitions) {
            const tierDefPath = matchedFile.replace(/^base_mapping\//, 'tier_definition/');
            const tierDefContent = (context.tierDefinitions as Record<string, any>)[tierDefPath];
            if (tierDefContent) {
                const groupKey = Object.keys(tierDefContent).find(k => k !== '_meta');
                if (groupKey) {
                    const tierEntry = tierDefContent[groupKey]?.[matchedTier];
                    if (tierEntry?.theme) {
                        const { Tier: _t, ...inlineStyle } = tierEntry.theme as Record<string, any>;
                        if (Object.keys(inlineStyle).length > 0) themeStyle = inlineStyle;
                    }
                }
            }
        }
    }

    if (themeStyle) {
        const converted = convertThemeStyle(themeStyle);
        style = { ...style, ...converted };

        Object.keys(style).forEach(key => {
            if ((style as any)[key] === undefined) delete (style as any)[key];
        });
    }

    if (matchedTier && matchedTier.includes('Hide')) visible = false;

    return { style, visible, category };
};

// Short human-readable summary of a rule's targets + conditions, for the inspector.
const summarizeConditions = (rule: any): string => {
    const parts: string[] = [];
    const targets = rule.targets || [];
    if (targets.length > 0) {
        const names = targets.map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean);
        if (names.length > 0) parts.push(names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`);
    }
    const conditions = rule.conditions || {};
    for (const [key, value] of Object.entries(conditions)) {
        parts.push(`${key} ${value}`);
    }
    return parts.join('  ·  ');
};

// Collect the top-N matches for an item in the same priority order evaluateItem
// uses, WITHOUT breaking at the first — so callers can show the winner plus the
// "next winners" that would apply if earlier ones were removed. The first entry
// equals evaluateItem's winning match.
export const getMatchingRules = (item: ItemProps, context: FilterContext, limit = 3): RuleMatch[] => {
    const matches: RuleMatch[] = [];
    const itemNameLower = item.name.toLowerCase();

    for (const [path, content] of Object.entries(context.mappings)) {
        const rules = content.rules || [];
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (checkRuleMatch(item, rule, context.globalAreaLevel) && rule.overrides && rule.overrides.Tier) {
                let tier = rule.overrides.Tier;
                if (Array.isArray(tier)) tier = tier[0];
                const { style, visible } = resolveStyle(path, tier, context);
                matches.push({
                    file: path,
                    ruleIndex: i,
                    tier,
                    ruleComment: rule.comment || 'Custom Rule',
                    conditionsSummary: summarizeConditions(rule),
                    isBaseMapping: false,
                    style,
                    visible,
                });
                if (matches.length >= limit) return matches;
            }
        }

        const mapping = content.mapping || {};
        const matchKey = Object.keys(mapping).find(k => k.toLowerCase() === itemNameLower);
        if (matchKey) {
            let tier = mapping[matchKey];
            if (Array.isArray(tier)) tier = tier[0];
            const { style, visible } = resolveStyle(path, tier, context);
            matches.push({
                file: path,
                ruleIndex: null,
                tier,
                isBaseMapping: true,
                style,
                visible,
            });
            if (matches.length >= limit) return matches;
        }
    }

    return matches;
};

export const checkRuleMatch = (item: ItemProps, rule: any, globalAreaLevel?: number): boolean => {
    // 1. Check Targets
    const targets = rule.targets || [];
    if (targets.length > 0 && !targets.includes(item.name)) {
        return false;
    }

    // 2. Check Conditions
    const conditions = rule.conditions || {};
    for (const [key, value] of Object.entries(conditions)) {
        let operator = '=';
        let targetVal: any = value;
        
        if (typeof value === 'string') {
            if (value.startsWith('>=')) { operator = '>='; targetVal = parseFloat(value.substring(2)); }
            else if (value.startsWith('<=')) { operator = '<='; targetVal = parseFloat(value.substring(2)); }
            else if (value.startsWith('>')) { operator = '>'; targetVal = parseFloat(value.substring(1)); }
            else if (value.startsWith('<')) { operator = '<'; targetVal = parseFloat(value.substring(1)); }
            else if (value.startsWith('=')) { operator = '='; targetVal = parseFloat(value.substring(1)); }
        }

        let itemVal = item[key.charAt(0).toLowerCase() + key.slice(1)];
        if (key === 'ItemLevel') itemVal = item.itemLevel;
        if (key === 'DropLevel') itemVal = item.dropLevel;
        if (key === 'Rarity') itemVal = item.rarity;
        if (key === 'Class') itemVal = item.class;
        if (key === 'LinkedSockets') itemVal = item.linkedSockets;
        if (key === 'Sockets') itemVal = item.sockets?.length || 0;
        if (key === 'Quality') itemVal = item.quality;
        if (key === 'StackSize') itemVal = item.stackSize;
        if (key === 'AreaLevel') itemVal = globalAreaLevel || 1; // Use global context

        // Boolean conditions
        if (key === 'Corrupted') {
            const expected = (value as string).trim() === 'True';
            if (!!item.corrupted !== expected) return false;
            continue;
        }
        if (key === 'Identified') {
            const expected = (value as string).trim() === 'True';
            if (!!item.identified !== expected) return false;
            continue;
        }
        if (key === 'Mirrored') {
            const expected = (value as string).trim() === 'True';
            if (!!item.mirrored !== expected) return false;
            continue;
        }
        if (key === 'Fractured') {
            const expected = (value as string).trim() === 'True';
            if (!!item.fractured !== expected) return false;
            continue;
        }
        if (key === 'Synthesised') {
            const expected = (value as string).trim() === 'True';
            if (!!item.synthesised !== expected) return false;
            continue;
        }
        if (key === 'HasImplicit') {
            const expected = (value as string).trim() === 'True';
            if (!!item.hasImplicit !== expected) return false;
            continue;
        }

        // HasInfluence condition
        if (key === 'HasInfluence') {
            const influenceMap: Record<string, keyof ItemProps> = {
                'Shaper':   'shaper',
                'Elder':    'elder',
                'Crusader': 'crusader',
                'Redeemer': 'redeemer',
                'Hunter':   'hunter',
                'Warlord':  'warlord',
                'Exarch':   'exarch',
                'Eater':    'eater',
            };
            const influenceKey = influenceMap[(value as string).trim()];
            if (!influenceKey || !item[influenceKey]) return false;
            continue;
        }

        // BaseType condition: split on whitespace, strip quotes, check item name
        if (key === 'BaseType') {
            const tokens = (value as string)
                .split(/\s+/)
                .map(t => t.replace(/^"|"$/g, '').toLowerCase())
                .filter(t => t.length > 0);
            if (!tokens.includes(item.name.toLowerCase())) return false;
            continue;
        }

        if (typeof targetVal === 'string' && typeof itemVal !== 'string') itemVal = String(itemVal);
        if (typeof targetVal === 'number' && typeof itemVal !== 'number') itemVal = Number(itemVal);

        switch (operator) {
            case '>=': if (!(itemVal >= targetVal)) return false; break;
            case '<=': if (!(itemVal <= targetVal)) return false; break;
            case '>': if (!(itemVal > targetVal)) return false; break;
            case '<': if (!(itemVal < targetVal)) return false; break;
            case '=': if (itemVal !== targetVal) return false; break;
        }
    }

    return true;
};

const convertThemeStyle = (ts: any): any => {
    // Resolve sound: PlayAlertSound may be [file_path, volume] or a numeric ID or a string.
    // Extract a usable value that SimulatorItem can pass to getSoundUrl().
    let sound: any = undefined;
    if (ts.PlayAlertSound !== undefined && ts.PlayAlertSound !== null) {
        if (Array.isArray(ts.PlayAlertSound)) {
            // [file_path, volume] — extract the file path for URL construction
            const [file] = ts.PlayAlertSound;
            sound = file;
        } else {
            // numeric ID or string — pass through as-is
            sound = ts.PlayAlertSound;
        }
    }

    return {
        color: ts.TextColor ? colorToRgb(ts.TextColor) : undefined,
        backgroundColor: ts.BackgroundColor ? colorToRgb(ts.BackgroundColor) : undefined,
        borderColor: ts.BorderColor ? colorToRgb(ts.BorderColor) : undefined,
        fontSize: ts.FontSize ? `${ts.FontSize / 1.8}px` : undefined,
        borderStyle: ts.BorderColor ? 'solid' : 'none',
        borderWidth: ts.BorderColor ? '1px' : '0px',
        sound
    };
};

const colorToRgb = (hex: string) => {
    if (!hex) return 'transparent';
    if (hex.length === 9) { 
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        const a = parseInt(hex.slice(7,9), 16) / 255;
        return `rgba(${r},${g},${b},${a.toFixed(2)})`;
    }
    return hex;
};