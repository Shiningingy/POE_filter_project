

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
    hasImplicit?: boolean;
    stackSize?: number;
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
    style: React.CSSProperties;
    matchedRule?: string;
    matchedTier?: string;
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
    let category = "Templates";

    // 1. Search specific mapping & Apply Rules
    for (const [path, content] of Object.entries(context.mappings)) {
        // A. Check Rules first (Overrides base mapping)
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

        // B. Check Base Mapping
        const mapping = content.mapping || {};
        if (mapping[item.name]) {
            matchedTier = mapping[item.name];
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

    // 2. Resolve Category
    if (matchedFile) {
        const parts = matchedFile.split('/');
        if (parts.length >= 2) {
            const potentialCat = parts[parts.length - 2];
            if (context.theme && context.theme[potentialCat]) {
                category = potentialCat;
            }
            if (potentialCat === "Fragments") category = "Map Fragments"; 
        }
    }

    // 3. Resolve Style from Theme
    let style: React.CSSProperties = {
        color: '#888',
        backgroundColor: 'rgba(0,0,0,0.5)',
        border: '1px solid #333',
        fontSize: '16px' 
    };
    
    let visible = true; 

    let themeStyle = null;
    if (matchedTier) {
        if (context.overrides && context.overrides[category] && context.overrides[category][matchedTier]) {
            themeStyle = context.overrides[category][matchedTier];
        } else if (context.theme && context.theme[category] && context.theme[category][matchedTier]) {
            themeStyle = context.theme[category][matchedTier];
        } else if (context.theme && context.theme["Templates"] && context.theme["Templates"][matchedTier]) {
             themeStyle = context.theme["Templates"][matchedTier];
        }
    }

    if (themeStyle) {
        style = convertThemeStyle(themeStyle);
    }

    if (matchedTier && matchedTier.includes('Hide')) visible = false;

    return { visible, style, matchedTier: matchedTier || undefined, matchedRule: matchedRuleName || undefined };
};

const checkRuleMatch = (item: ItemProps, rule: any, globalAreaLevel?: number): boolean => {
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
        
        if (typeof targetVal === 'string' && typeof itemVal !== 'string') itemVal = String(itemVal);
        if (typeof targetVal === 'number' && typeof itemVal !== 'number') itemVal = Number(itemVal);

        switch (operator) {
            case '>=': if (!(itemVal >= targetVal)) return false; break;
            case '<=': if (!(itemVal <= targetVal)) return false; break;
            case '>': if (!(itemVal > targetVal)) return false; break;
            case '<': if (!(itemVal < targetVal)) return false; break;
            case '=': if (itemVal != targetVal) return false; break; 
        }
    }

    return true;
};

const convertThemeStyle = (ts: any): React.CSSProperties => {
    return {
        color: ts.TextColor ? colorToRgb(ts.TextColor) : undefined,
        backgroundColor: ts.BackgroundColor ? colorToRgb(ts.BackgroundColor) : undefined,
        borderColor: ts.BorderColor ? colorToRgb(ts.BorderColor) : undefined,
        fontSize: ts.FontSize ? `${ts.FontSize / 2.5}px` : undefined, 
        borderStyle: ts.BorderColor ? 'solid' : 'none',
        borderWidth: ts.BorderColor ? '1px' : '0px',
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