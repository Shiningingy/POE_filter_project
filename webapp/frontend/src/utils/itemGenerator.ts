import type { ItemProps } from './simulatorEngine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratorSettings {
    itemLevelMin: number;
    itemLevelMax: number;
    rarityWeights: {
        Normal: number;
        Magic: number;
        Rare: number;
        Unique: number;
    };
    enabledCategories: Set<string>;
    dropCount: number;
}

export interface ClassProps {
    properties: string[];
    flags: string[];
    constraints: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helper functions (not exported)
// ---------------------------------------------------------------------------

function weightedRandom(weights: Record<string, number>): string {
    let total = 0;
    for (const w of Object.values(weights)) total += w;

    let rand = Math.random() * total;
    for (const [key, w] of Object.entries(weights)) {
        rand -= w;
        if (rand <= 0) return key;
    }
    // Fallback: return last key
    const keys = Object.keys(weights);
    return keys[keys.length - 1];
}

function randomSocketString(maxSockets: number): string {
    if (maxSockets <= 0) return '';

    // Bias toward low socket counts via exponentiation
    const raw = Math.pow(Math.random(), 1.5);
    let count = Math.round(raw * maxSockets);
    if (count < 0) count = 0;
    if (count > maxSockets) count = maxSockets;

    if (count === 0) return '';

    const colorWeights = { R: 40, G: 30, B: 25, W: 5 };
    const colors: string[] = [];
    for (let i = 0; i < count; i++) {
        colors.push(weightedRandom(colorWeights));
    }
    return colors.join(' ');
}

function randomLinks(socketCount: number): number {
    if (socketCount <= 1) return 0;
    if (Math.random() < 0.60) return 0;
    const min = 2;
    const max = socketCount;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export function getCategoriesToPrewarm(
    enabledCategories: Set<string>,
    getLeafClassesUnder: (id: string) => string[]
): string[] {
    const result = new Set<string>();
    for (const cat of enabledCategories) {
        const leaves = getLeafClassesUnder(cat);
        for (const leaf of leaves) {
            result.add(leaf);
        }
    }
    return Array.from(result);
}

export function buildValuableItemSet(mappings: Record<string, any>): Set<string> {
    const result = new Set<string>();
    for (const content of Object.values(mappings)) {
        if (!content || !content.mapping) continue;
        for (const [name, tier] of Object.entries(content.mapping)) {
            const tierStr = Array.isArray(tier) ? (tier as string[])[0] : (tier as string);
            if (typeof tierStr !== 'string') continue;
            const match = tierStr.match(/^Tier\s*(\d+)/i);
            if (match) {
                const tierNum = parseInt(match[1], 10);
                if (tierNum <= 2) {
                    result.add(name);
                }
            }
        }
    }
    return result;
}

export function generateRandomItem(
    settings: GeneratorSettings,
    itemPools: Record<string, any[]>,
    classPropsMap: Record<string, ClassProps>,
    getLeafClassesUnder: (id: string) => string[]
): ItemProps | null {
    // Step 1: Get enabled categories that have at least one leaf class with data
    const enabledCatsWithData = Array.from(settings.enabledCategories).filter(cat => {
        const leaves = getLeafClassesUnder(cat);
        return leaves.some(leaf => itemPools[leaf] && itemPools[leaf].length > 0);
    });

    if (enabledCatsWithData.length === 0) return null;

    // Step 2: Pick one category at random
    const catIndex = Math.floor(Math.random() * enabledCatsWithData.length);
    const category = enabledCatsWithData[catIndex];

    // Step 3: Get leaf classes for category, filter to those present in itemPools
    const allLeaves = getLeafClassesUnder(category);
    const validLeaves = allLeaves.filter(leaf => itemPools[leaf] && itemPools[leaf].length > 0);

    if (validLeaves.length === 0) return null;

    // Step 4: Pick one leaf class at random
    const clsIndex = Math.floor(Math.random() * validLeaves.length);
    const cls = validLeaves[clsIndex];

    // Step 5: Pick itemLevel randomly in [itemLevelMin, itemLevelMax]
    const itemLevel =
        Math.floor(Math.random() * (settings.itemLevelMax - settings.itemLevelMin + 1)) +
        settings.itemLevelMin;

    // Step 6: Get pool, filter by drop_level
    let pool = itemPools[cls];
    const filtered = pool.filter(i => (i.drop_level ?? 0) <= itemLevel);
    if (filtered.length > 0) pool = filtered;

    // Step 7: Pick one item from pool
    const picked = pool[Math.floor(Math.random() * pool.length)];

    // Step 8: Determine rarity
    let rarity: 'Normal' | 'Magic' | 'Rare' | 'Unique';
    if (category === 'currency' || category === 'gems' || category === 'divination') {
        rarity = 'Normal';
    } else if (category === 'maps') {
        const mapWeights = {
            Normal: settings.rarityWeights.Normal,
            Magic: settings.rarityWeights.Magic,
            Rare: settings.rarityWeights.Rare,
        };
        rarity = weightedRandom(mapWeights) as 'Normal' | 'Magic' | 'Rare';
    } else {
        rarity = weightedRandom(settings.rarityWeights) as 'Normal' | 'Magic' | 'Rare' | 'Unique';
    }

    // Step 9: Quality
    const maxSockets = classPropsMap[cls]?.constraints?.max_sockets ?? 0;
    let quality = 0;
    if (category === 'gems') {
        quality = Math.floor(Math.random() * 21); // 0-20
    } else if (maxSockets > 0) {
        quality = Math.floor(Math.pow(Math.random(), 1.5) * 31); // 0-30
    }

    // Step 10: Gem level
    let gemLevel: number | undefined;
    if (category === 'gems') {
        gemLevel = Math.floor(Math.random() * 20) + 1; // 1-20
    }

    // Step 11: Sockets
    let socketStr = '';
    let linkedSockets = 0;
    if (maxSockets > 0) {
        socketStr = randomSocketString(maxSockets);
        const socketCount = socketStr ? socketStr.split(' ').length : 0;
        linkedSockets = socketCount > 0 ? randomLinks(socketCount) : 0;
    }

    // Step 12: Flag assignment
    let corrupted = false;
    let fractured = false;
    let synthesised = false;
    let shaper = false;
    let elder = false;
    let crusader = false;
    let redeemer = false;
    let hunter = false;
    let warlord = false;
    let exarch = false;
    let eater = false;

    const isEquipmentLike =
        maxSockets > 0 &&
        category !== 'currency' &&
        category !== 'gems' &&
        category !== 'divination' &&
        category !== 'maps' &&
        category !== 'flasks';

    if (category === 'gems') {
        // Gems: corrupted only
        corrupted = Math.random() < 0.20;
        if (corrupted) {
            if (Math.random() < 0.50) {
                gemLevel = 21;
            } else {
                quality = Math.floor(Math.random() * 3) + 21; // 21-23
            }
        }
    } else if (isEquipmentLike) {
        corrupted = Math.random() < 0.20;
        if (!corrupted) {
            const hasInfluence = Math.random() < 0.10;
            if (hasInfluence) {
                if (Math.random() < 0.85) {
                    // Standard influences
                    const standardInfluences: Array<keyof ItemProps> = [
                        'shaper', 'elder', 'crusader', 'redeemer', 'hunter', 'warlord',
                    ];
                    if (Math.random() < 0.50) {
                        // Pick one
                        const pick = standardInfluences[Math.floor(Math.random() * standardInfluences.length)];
                        if (pick === 'shaper') shaper = true;
                        else if (pick === 'elder') elder = true;
                        else if (pick === 'crusader') crusader = true;
                        else if (pick === 'redeemer') redeemer = true;
                        else if (pick === 'hunter') hunter = true;
                        else if (pick === 'warlord') warlord = true;
                    } else {
                        // Pick two different ones
                        const shuffled = [...standardInfluences].sort(() => Math.random() - 0.5);
                        const pickA = shuffled[0];
                        const pickB = shuffled[1];
                        for (const pick of [pickA, pickB]) {
                            if (pick === 'shaper') shaper = true;
                            else if (pick === 'elder') elder = true;
                            else if (pick === 'crusader') crusader = true;
                            else if (pick === 'redeemer') redeemer = true;
                            else if (pick === 'hunter') hunter = true;
                            else if (pick === 'warlord') warlord = true;
                        }
                    }
                } else {
                    // Eldritch
                    if (Math.random() < 0.50) {
                        // Pick one of exarch or eater
                        if (Math.random() < 0.50) exarch = true;
                        else eater = true;
                    } else {
                        exarch = true;
                        eater = true;
                    }
                }
            }

            const hasStandardInfluence = shaper || elder || crusader || redeemer || hunter || warlord;

            // Fractured: 10% probability, only if NO standard influence
            if (!hasStandardInfluence && Math.random() < 0.10) {
                fractured = true;
            }

            // Synthesised: 10% probability, only if NOT fractured AND NO standard influence
            if (!fractured && !hasStandardInfluence && Math.random() < 0.10) {
                synthesised = true;
            }
        }
    }

    // Step 13: corruptedImplicit
    let corruptedImplicit: string | undefined;
    if (corrupted && Math.random() < 0.50) {
        corruptedImplicit = 'Corrupted Implicit';
    }

    // Step 14: stackSize
    let stackSize = 1;
    if (category === 'currency') {
        stackSize = Math.floor(Math.random() * 20) + 1;
    } else if (category === 'divination') {
        stackSize = Math.floor(Math.random() * 5) + 1;
    }

    // Step 15: Build and return ItemProps
    const item: ItemProps = {
        name: picked.name,
        name_ch: picked.name_ch || undefined,
        class: picked.item_class ?? cls,
        itemLevel,
        rarity,
        quality: quality > 0 ? quality : undefined,
        identified: false,
        corrupted: corrupted || undefined,
        fractured: fractured || undefined,
        synthesised: synthesised || undefined,
        shaper: shaper || undefined,
        elder: elder || undefined,
        crusader: crusader || undefined,
        redeemer: redeemer || undefined,
        hunter: hunter || undefined,
        warlord: warlord || undefined,
        exarch: exarch || undefined,
        eater: eater || undefined,
        gemLevel: gemLevel !== undefined ? gemLevel : undefined,
        corruptedImplicit,
        stackSize,
        dropLevel: picked.drop_level,
    };

    if (socketStr) {
        item.sockets = socketStr;
        if (linkedSockets > 0) item.linkedSockets = linkedSockets;
    }

    return item;
}

export function generateValuableItem(
    settings: GeneratorSettings,
    itemPools: Record<string, any[]>,
    classPropsMap: Record<string, ClassProps>,
    getLeafClassesUnder: (id: string) => string[],
    valuableSet: Set<string>
): ItemProps | null {
    // Try up to 10 attempts across categories to find a valuable item
    for (let attempt = 0; attempt < 10; attempt++) {
        // Step 1: Get enabled categories that have at least one leaf class with data
        const enabledCatsWithData = Array.from(settings.enabledCategories).filter(cat => {
            const leaves = getLeafClassesUnder(cat);
            return leaves.some(leaf => itemPools[leaf] && itemPools[leaf].length > 0);
        });

        if (enabledCatsWithData.length === 0) return null;

        // Step 2: Pick one category at random
        const catIndex = Math.floor(Math.random() * enabledCatsWithData.length);
        const category = enabledCatsWithData[catIndex];

        // Step 3: Get leaf classes for category, filter to those present in itemPools
        const allLeaves = getLeafClassesUnder(category);
        const validLeaves = allLeaves.filter(leaf => itemPools[leaf] && itemPools[leaf].length > 0);

        if (validLeaves.length === 0) continue;

        // Step 4: Pick one leaf class at random
        const clsIndex = Math.floor(Math.random() * validLeaves.length);
        const cls = validLeaves[clsIndex];

        // Step 5: Pick itemLevel randomly in [itemLevelMin, itemLevelMax]
        const itemLevel =
            Math.floor(Math.random() * (settings.itemLevelMax - settings.itemLevelMin + 1)) +
            settings.itemLevelMin;

        // Step 6: Get pool, filter by drop_level, then filter for valuable items
        let pool = itemPools[cls];
        const filtered = pool.filter(i => (i.drop_level ?? 0) <= itemLevel);
        if (filtered.length > 0) pool = filtered;

        const valuablePool = pool.filter(i => valuableSet.has(i.name));
        if (valuablePool.length === 0) continue;

        // Pick from valuable pool
        const picked = valuablePool[Math.floor(Math.random() * valuablePool.length)];

        // Step 8: Determine rarity
        let rarity: 'Normal' | 'Magic' | 'Rare' | 'Unique';
        if (category === 'currency' || category === 'gems' || category === 'divination') {
            rarity = 'Normal';
        } else if (category === 'maps') {
            const mapWeights = {
                Normal: settings.rarityWeights.Normal,
                Magic: settings.rarityWeights.Magic,
                Rare: settings.rarityWeights.Rare,
            };
            rarity = weightedRandom(mapWeights) as 'Normal' | 'Magic' | 'Rare';
        } else {
            rarity = weightedRandom(settings.rarityWeights) as 'Normal' | 'Magic' | 'Rare' | 'Unique';
        }

        // Step 9: Quality
        const maxSockets = classPropsMap[cls]?.constraints?.max_sockets ?? 0;
        let quality = 0;
        if (category === 'gems') {
            quality = Math.floor(Math.random() * 21);
        } else if (maxSockets > 0) {
            quality = Math.floor(Math.pow(Math.random(), 1.5) * 31);
        }

        // Step 10: Gem level
        let gemLevel: number | undefined;
        if (category === 'gems') {
            gemLevel = Math.floor(Math.random() * 20) + 1;
        }

        // Step 11: Sockets
        let socketStr = '';
        let linkedSockets = 0;
        if (maxSockets > 0) {
            socketStr = randomSocketString(maxSockets);
            const socketCount = socketStr ? socketStr.split(' ').length : 0;
            linkedSockets = socketCount > 0 ? randomLinks(socketCount) : 0;
        }

        // Step 12: Flag assignment
        let corrupted = false;
        let fractured = false;
        let synthesised = false;
        let shaper = false;
        let elder = false;
        let crusader = false;
        let redeemer = false;
        let hunter = false;
        let warlord = false;
        let exarch = false;
        let eater = false;

        const isEquipmentLike =
            maxSockets > 0 &&
            category !== 'currency' &&
            category !== 'gems' &&
            category !== 'divination' &&
            category !== 'maps' &&
            category !== 'flasks';

        if (category === 'gems') {
            corrupted = Math.random() < 0.20;
            if (corrupted) {
                if (Math.random() < 0.50) {
                    gemLevel = 21;
                } else {
                    quality = Math.floor(Math.random() * 3) + 21;
                }
            }
        } else if (isEquipmentLike) {
            corrupted = Math.random() < 0.20;
            if (!corrupted) {
                const hasInfluence = Math.random() < 0.10;
                if (hasInfluence) {
                    if (Math.random() < 0.85) {
                        const standardInfluences: Array<keyof ItemProps> = [
                            'shaper', 'elder', 'crusader', 'redeemer', 'hunter', 'warlord',
                        ];
                        if (Math.random() < 0.50) {
                            const pick = standardInfluences[Math.floor(Math.random() * standardInfluences.length)];
                            if (pick === 'shaper') shaper = true;
                            else if (pick === 'elder') elder = true;
                            else if (pick === 'crusader') crusader = true;
                            else if (pick === 'redeemer') redeemer = true;
                            else if (pick === 'hunter') hunter = true;
                            else if (pick === 'warlord') warlord = true;
                        } else {
                            const shuffled = [...standardInfluences].sort(() => Math.random() - 0.5);
                            const pickA = shuffled[0];
                            const pickB = shuffled[1];
                            for (const pick of [pickA, pickB]) {
                                if (pick === 'shaper') shaper = true;
                                else if (pick === 'elder') elder = true;
                                else if (pick === 'crusader') crusader = true;
                                else if (pick === 'redeemer') redeemer = true;
                                else if (pick === 'hunter') hunter = true;
                                else if (pick === 'warlord') warlord = true;
                            }
                        }
                    } else {
                        if (Math.random() < 0.50) {
                            if (Math.random() < 0.50) exarch = true;
                            else eater = true;
                        } else {
                            exarch = true;
                            eater = true;
                        }
                    }
                }

                const hasStandardInfluence = shaper || elder || crusader || redeemer || hunter || warlord;

                if (!hasStandardInfluence && Math.random() < 0.10) {
                    fractured = true;
                }
                if (!fractured && !hasStandardInfluence && Math.random() < 0.10) {
                    synthesised = true;
                }
            }
        }

        // Step 13: corruptedImplicit
        let corruptedImplicit: string | undefined;
        if (corrupted && Math.random() < 0.50) {
            corruptedImplicit = 'Corrupted Implicit';
        }

        // Step 14: stackSize
        let stackSize = 1;
        if (category === 'currency') {
            stackSize = Math.floor(Math.random() * 20) + 1;
        } else if (category === 'divination') {
            stackSize = Math.floor(Math.random() * 5) + 1;
        }

        // Step 15: Build and return ItemProps
        const item: ItemProps = {
            name: picked.name,
            name_ch: picked.name_ch || undefined,
            class: picked.item_class ?? cls,
            itemLevel,
            rarity,
            quality: quality > 0 ? quality : undefined,
            identified: false,
            corrupted: corrupted || undefined,
            fractured: fractured || undefined,
            synthesised: synthesised || undefined,
            shaper: shaper || undefined,
            elder: elder || undefined,
            crusader: crusader || undefined,
            redeemer: redeemer || undefined,
            hunter: hunter || undefined,
            warlord: warlord || undefined,
            exarch: exarch || undefined,
            eater: eater || undefined,
            gemLevel: gemLevel !== undefined ? gemLevel : undefined,
            corruptedImplicit,
            stackSize,
            dropLevel: picked.drop_level,
        };

        if (socketStr) {
            item.sockets = socketStr;
            if (linkedSockets > 0) item.linkedSockets = linkedSockets;
        }

        return item;
    }

    return null;
}
