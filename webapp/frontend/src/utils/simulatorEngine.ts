import type { CSSProperties } from 'react';
// The simulator renders CSS rather than filter lines, but it must resolve the
// SAME theme row the exported block gets — see filterStyle.resolveTierTheme.
import { resolveTierTheme, resolveThemeKey } from './filterStyle';

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
    globalAreaLevel?: number; // Environment context
}

export interface SimulationResult {
    visible: boolean;
    style: CSSProperties & { sound?: any };
    matchedRule?: string;
    matchedTier?: string;
    matchedFile?: string;
    partial?: boolean; // matched a rule with conditions the sim can't fully evaluate
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
    partial?: boolean;
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
    let matchedFile: string | null = null;
    let matchedRuleName = null;
    let matchedPartial = false;

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
                    matchedPartial = ruleIsPartial(rule);
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
    const tierKey: string = matchedTier ?? 'Untiered';

    // 2 + 3. Resolve category + style from theme (shared with getMatchingRules).
    // No matched file -> empty key resolves to the Default theme bucket.
    const { style, visible } = resolveStyle(matchedFile ?? '', tierKey, context, item);

    return {
        visible,
        style,
        matchedTier: matchedTier || undefined,
        matchedRule: matchedRuleName || undefined,
        matchedFile: matchedFile || undefined,
        partial: matchedPartial || undefined
    };
};

/**
 * ★ Decorator tiers whose conditions match this item, in EMISSION order.
 *
 * A decorator sets one channel and `Continue`s, so several can stack under the block
 * that finally claims the item. Order is `_meta.gen_order` then path — the generator's
 * order — because when two decorators set the same channel the later one wins.
 *
 * The two skips mirror the generator exactly: a decorator with no conditions and one on
 * a hide tier emit nothing, so they must not tint the simulation either.
 */
export const matchingDecorators = (
    item: ItemProps,
    context: FilterContext,
): { path: string; key: string; tier: any }[] => {
    const found: { path: string; key: string; tier: any; order: number }[] = [];
    const defs = (context.tierDefinitions || {}) as Record<string, any>;
    for (const [path, content] of Object.entries(defs)) {
        const groupKey = Object.keys(content || {}).find(k => k !== '_meta' && !k.startsWith('//'));
        if (!groupKey) continue;
        const cat = content[groupKey];
        const order = cat?._meta?.gen_order ?? 0;
        for (const [key, tier] of Object.entries<any>(cat || {})) {
            if (key === '_meta' || !tier || typeof tier !== 'object' || !tier.decorator) continue;
            if (tier.is_hide_tier) continue;
            if (!tier.conditions || Object.keys(tier.conditions).length === 0) continue;
            if (!checkRuleMatch(item, { conditions: tier.conditions }, context.globalAreaLevel)) continue;
            found.push({ path, key, tier, order });
        }
    }
    found.sort((a, b) => a.order - b.order || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return found.map(({ path, key, tier }) => ({ path, key, tier }));
};

// Resolve the category + rendered style for a (file, tier) pair. Extracted from
// evaluateItem so the rule-inspector (getMatchingRules) renders identical styles.
// `item` is optional and only enables the decorator layer — callers that have no item
// (a bare block preview) get exactly the pre-composition behaviour.
const resolveStyle = (
    matchedFile: string | null,
    matchedTier: string,
    context: FilterContext,
    item?: ItemProps,
): { style: CSSProperties & { sound?: any }; visible: boolean; category: string } => {
    // 2. Resolve Category from the tier_definition's theme_category (matches the
    // Python/frontend generators). Falls back to the tier_definition's top-level key
    // (self), then to "Default".
    let category = "Default";
    if (matchedFile) {
        const tierDefPath = matchedFile.replace(/^base_mapping\//, 'tier_definition/');
        const tierDefContent = (context.tierDefinitions as Record<string, any>)?.[tierDefPath];
        if (tierDefContent) {
            const groupKey = Object.keys(tierDefContent).find(k => k !== '_meta' && !k.startsWith('//'));
            if (groupKey) {
                category = resolveThemeKey(tierDefContent[groupKey], groupKey);
            }
        } else {
            // Tier def not loaded — infer from the path. The base_mapping `_meta.theme_category`
            // that used to be consulted here is a stale duplicate: 8 of the 82 files that declare
            // it name a key the generator never resolves to (all four Heist files say "Heist",
            // not "Heist Contracts"/"Heist Blueprints"/...), so falling back to it showed a style
            // the filter does not emit — exactly what this module was fixed to stop doing.
            {
                const parts = matchedFile.split('/');
                const relevantParts = parts.filter(p => p !== 'base_mapping' && !p.endsWith('.json'));
                if (relevantParts.length > 0) category = relevantParts[relevantParts.length - 1];
                // (A "Fragments" -> "Map Fragments" rename used to live here. No
                // generator has ever done that, so it only made the simulator show a
                // style the filter does not emit.)
            }
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

    // The tier's own entry, needed because `theme.Tier` overrides what the tier's
    // KEY would parse to (real keys like "T1", "Other" and "Rare Safety Net" all
    // parse to 99).
    let tierEntry: any = undefined;
    if (matchedFile && context.tierDefinitions) {
        const tierDefPath = matchedFile.replace(/^base_mapping\//, 'tier_definition/');
        const tierDefContent = (context.tierDefinitions as Record<string, any>)[tierDefPath];
        const groupKey = tierDefContent && Object.keys(tierDefContent).find(k => k !== '_meta' && !k.startsWith('//'));
        if (groupKey) tierEntry = tierDefContent[groupKey]?.[matchedTier];
    }

    // Shared lookup — the simulator used to run its own four-step chain
    // (category/tier, category/normalized, Default/tier, Default/normalized, then
    // inline as a last resort). Two of those steps do not exist in either
    // generator: a missing TIER ROW falls back to `{}`, never to Default's row, so
    // the simulator was painting blocks the filter emits bare. And it consulted
    // inline style LAST while the generators ignore it entirely — the exact
    // inversion the rewrite is fixing, which made the simulator a third opinion.
    let themeStyle: any = null;
    if (matchedTier && matchedTier !== "Untiered") {
        const row = resolveTierTheme(context.theme, category, tierEntry, matchedTier);
        if (row && Object.keys(row).length > 0) themeStyle = row;
    }

    // ★ The decorator layer sits BENEATH the block's own style, because `Continue` means
    // later blocks override only the properties THEY set. So a decorator's channel
    // survives exactly where the block omits one — which is why the omitted channels are
    // separated out below instead of being spread as `undefined` and deleted wholesale.
    let decoratorCss: CSSProperties = {};
    if (item) {
        for (const d of matchingDecorators(item, context)) {
            const c: any = convertThemeStyle(d.tier.theme || {});
            for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
            decoratorCss = { ...decoratorCss, ...c };
        }
    }

    if (themeStyle) {
        const converted: any = convertThemeStyle(themeStyle);
        const emitted: any = {};
        const omitted: string[] = [];
        for (const [k, v] of Object.entries(converted)) {
            if (v === undefined) omitted.push(k); else emitted[k] = v;
        }
        style = { ...style, ...decoratorCss };
        // An omitted channel still clears the simulator's placeholder default (so the
        // rarity colour can show), but NOT a decorator that deliberately painted it.
        for (const k of omitted) if (!(k in decoratorCss)) delete (style as any)[k];
        style = { ...style, ...emitted };

        Object.keys(style).forEach(key => {
            if ((style as any)[key] === undefined) delete (style as any)[key];
        });
    } else {
        style = { ...style, ...decoratorCss };
    }

    // `is_hide_tier` is what the generators actually gate on; the tier NAME
    // containing "Hide" was a guess that missed every hide tier named otherwise
    // (the campaign declutter tiers, the equipment nets).
    if (tierEntry?.is_hide_tier || (matchedTier && matchedTier.includes('Hide'))) visible = false;

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
        parts.push(`${key} ${Array.isArray(value) ? value.join(' & ') : value}`);
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
                const { style, visible } = resolveStyle(path, tier, context, item);
                matches.push({
                    file: path,
                    ruleIndex: i,
                    tier,
                    ruleComment: rule.comment || 'Custom Rule',
                    conditionsSummary: summarizeConditions(rule),
                    isBaseMapping: false,
                    style,
                    visible,
                    partial: ruleIsPartial(rule),
                });
                if (matches.length >= limit) return matches;
            }
        }

        const mapping = content.mapping || {};
        const matchKey = Object.keys(mapping).find(k => k.toLowerCase() === itemNameLower);
        if (matchKey) {
            let tier = mapping[matchKey];
            if (Array.isArray(tier)) tier = tier[0];
            const { style, visible } = resolveStyle(path, tier, context, item);
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

// Conditions the simulator cannot model (mods / enchants / derived stats / actions).
// In the sim these are ignored (treated as satisfied) so the structural part of a
// rule still resolves; results carrying one are flagged `partial`.
export const NON_SIMULATABLE = new Set<string>([
    'CorruptedMods', 'HasExplicitMod', 'HasImplicitMod', 'AnyEnchantment', 'HasEnchantment',
    'HasSearingExarchImplicit', 'HasEaterOfWorldsImplicit', 'HasCruciblePassiveTree',
    'BaseDefencePercentile', 'BaseArmour', 'BaseEvasion', 'BaseEnergyShield', 'BaseWard',
    'EnchantmentPassiveNum', 'EnchantmentPassiveNode', 'Foulborn',
    'DisableDropSound', 'EnableDropSound',
]);

// Schema boolean condition keys → the item attribute they test.
const BOOL_FIELD: Record<string, string> = {
    FracturedItem: 'fractured', SynthesisedItem: 'synthesised',
    ShaperItem: 'shaper', ElderItem: 'elder',
    Scourged: 'scourged', Replica: 'replica', Imbued: 'imbued', TransfiguredGem: 'transfigured',
    BlightedMap: 'blightedMap', BlightRavagedMap: 'blightRavagedMap',
    ShapedMap: 'shapedMap', ElderMap: 'elderMap', ZanasMemory: 'zanasMemory',
};

// True if a rule contains any condition the simulator can't fully evaluate.
export const ruleIsPartial = (rule: any): boolean =>
    Object.keys(rule?.conditions || {}).some(k => NON_SIMULATABLE.has(k));

export const checkRuleMatch = (item: ItemProps, rule: any, globalAreaLevel?: number): boolean => {
    // 1. Check Targets
    const targets = rule.targets || [];
    if (targets.length > 0 && !targets.includes(item.name)) {
        return false;
    }

    // 2. Check Conditions
    const conditions = rule.conditions || {};
    for (const [key, value] of Object.entries(conditions)) {
        // List value = the same condition repeated on several lines (AND),
        // e.g. HasInfluence "Shaper" + HasInfluence "Elder" (uber-elder items).
        if (Array.isArray(value)) {
            if (key === 'HasInfluence') {
                const infMap: Record<string, keyof ItemProps> = {
                    shaper: 'shaper', elder: 'elder', crusader: 'crusader',
                    redeemer: 'redeemer', hunter: 'hunter', warlord: 'warlord',
                    exarch: 'exarch', eater: 'eater',
                };
                for (const v of value) {
                    for (const inf of String(v).replace(/"/g, '').trim().toLowerCase().split(/\s+/)) {
                        const k = infMap[inf];
                        if (!k || !item[k]) return false;
                    }
                }
            }
            // Other repeated keys: not modeled — lenient skip.
            continue;
        }

        let operator = '=';
        let targetVal: any = value;

        if (typeof value === 'string') {
            if (value.startsWith('>=')) { operator = '>='; targetVal = parseFloat(value.substring(2)); }
            else if (value.startsWith('<=')) { operator = '<='; targetVal = parseFloat(value.substring(2)); }
            else if (value.startsWith('>')) { operator = '>'; targetVal = parseFloat(value.substring(1)); }
            else if (value.startsWith('<')) { operator = '<'; targetVal = parseFloat(value.substring(1)); }
            else if (value.startsWith('=')) { operator = '='; targetVal = parseFloat(value.substring(1)); }
        }

        // Lenient: ignore conditions the simulator can't model (mods/enchants/etc.).
        if (NON_SIMULATABLE.has(key)) continue;

        let itemVal = item[key.charAt(0).toLowerCase() + key.slice(1)];
        if (key === 'ItemLevel') itemVal = item.itemLevel;
        if (key === 'DropLevel') itemVal = item.dropLevel;
        if (key === 'Rarity') itemVal = item.rarity;
        if (key === 'Class') itemVal = item.class;
        if (key === 'LinkedSockets') itemVal = item.linkedSockets;
        if (key === 'Sockets') itemVal = (item.sockets || '').replace(/[^RGBAWD]/gi, '').length; // colour-letter count
        if (key === 'Quality') itemVal = item.quality;
        if (key === 'StackSize') itemVal = item.stackSize;
        if (key === 'MapTier') itemVal = item.mapTier;
        if (key === 'GemLevel') itemVal = item.gemLevel;
        if (key === 'MemoryStrands') itemVal = item.memoryStrands;
        if (key === 'AreaLevel') itemVal = globalAreaLevel || 1; // Use global context

        // SocketGroup: the item's colours must contain all requested colours (multiset).
        if (key === 'SocketGroup') {
            const want = (value as string).replace(/[^RGBAWD]/gi, '').toUpperCase().split('');
            const have = (item.sockets || '').replace(/[^RGBAWD]/gi, '').toUpperCase().split('');
            const ok = want.every(c => { const i = have.indexOf(c); if (i < 0) return false; have.splice(i, 1); return true; });
            if (!ok) return false;
            continue;
        }

        // Generic boolean conditions (schema keys → item attribute)
        if (BOOL_FIELD[key]) {
            const expected = (value as string).trim() === 'True';
            if (!!item[BOOL_FIELD[key]] !== expected) return false;
            continue;
        }

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
            // Single line may list several influences (EITHER matches); strip quotes.
            const wanted = (value as string).replace(/"/g, '').trim().split(/\s+/).filter(Boolean);
            const hasAny = wanted.some(w => {
                const k = influenceMap[w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()];
                return k && !!item[k];
            });
            if (!hasAny) return false;
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