// ============================================================================
// foreignSimulator.ts
// ----------------------------------------------------------------------------
// Matches a generated item against a FOREIGN filter's flat Show/Hide block list
// (parsed by filterParser). This is the adapter that lets the Drop Simulator's
// item generation drive a preview of an imported filter: walk blocks top-to-
// bottom, first match wins (just like the game), and return that block — whose
// INLINE style is then used to render the item.
//
// The per-condition logic mirrors simulatorEngine.checkRuleMatch, but reads
// directly from FilterStatement[] and handles the patterns common in foreign
// filters that our native matcher doesn't need: multi-value Class, enumerated
// Rarity (`Rarity Normal Magic Rare`), and BaseType == exact vs partial.
//
// Conditions we can't model (mods/enchantments/etc.) are treated leniently
// (they don't fail a block), matching the native simulator's behaviour.
// ============================================================================

import type { FilterBlock, FilterStatement } from './filterParser';
import type { ItemProps } from './simulatorEngine';

const RARITY_RANK: Record<string, number> = { Normal: 0, Magic: 1, Rare: 2, Unique: 3 };

// Numeric condition keyword -> item field accessor.
const NUMERIC: Record<string, (item: ItemProps, areaLevel: number) => number> = {
  ItemLevel: (i) => i.itemLevel ?? 0,
  DropLevel: (i) => i.dropLevel ?? 0,
  Quality: (i) => i.quality ?? 0,
  StackSize: (i) => i.stackSize ?? 0,
  MapTier: (i) => i.mapTier ?? 0,
  GemLevel: (i) => i.gemLevel ?? 0,
  LinkedSockets: (i) => i.linkedSockets ?? 0,
  Sockets: (i) => (i.sockets || '').replace(/[^RGBAWD]/gi, '').length,
  Width: (i) => i.width ?? 0,
  Height: (i) => i.height ?? 0,
  WaystoneTier: (i) => i.mapTier ?? 0,
  // Memory Strands: generated drops carry none, so `MemoryStrands >= N` rules
  // correctly reject them (rather than being treated as unmodelable).
  MemoryStrands: (i) => (typeof i.memoryStrands === 'number' ? i.memoryStrands : 0),
  AreaLevel: (_i, a) => a,
};

// Boolean condition keyword -> item flag. Flags absent on generated items are
// falsy, so a block requiring e.g. `BlightedMap True` correctly rejects them
// (rather than being treated as unknown).
const BOOL_FIELD: Record<string, keyof ItemProps> = {
  Corrupted: 'corrupted', Mirrored: 'mirrored', Identified: 'identified',
  FracturedItem: 'fractured', SynthesisedItem: 'synthesised',
  ShaperItem: 'shaper', ElderItem: 'elder',
  ShapedMap: 'shapedMap', ElderMap: 'elderMap', BlightedMap: 'blightedMap',
  BlightRavagedMap: 'blightRavagedMap', UberBlightedMap: 'uberBlightedMap',
  ZanaMemory: 'zanasMemory', Scourged: 'scourged', Replica: 'replica',
  AlternateQuality: 'alternateQuality',
};

const INFLUENCE: Record<string, keyof ItemProps> = {
  Shaper: 'shaper', Elder: 'elder', Crusader: 'crusader',
  Redeemer: 'redeemer', Hunter: 'hunter', Warlord: 'warlord',
};

const compare = (a: number, op: string | null, b: number): boolean => {
  switch (op) {
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '<': return a < b;
    default: return a === b; // '=', '==', or none
  }
};

/**
 * Tri-state: true (holds), false (definitely doesn't), or null (we can't model
 * this condition — e.g. an explicit-mod / enchantment / archnemesis check).
 * A null disqualifies the block so the item falls through to a rule we CAN
 * verify, instead of falsely inheriting an unmodelable block's style.
 */
const matchCondition = (item: ItemProps, s: FilterStatement, areaLevel: number): boolean | null => {
  const kw = s.keyword;
  const op = s.operator;
  const vals = s.values.map((v) => v.value);

  if (kw === 'BaseType' || kw === 'Class') {
    const subject = kw === 'BaseType' ? item.name : item.class;
    const exact = op === '==' || op === '!=';
    const hit = vals.some((v) => (exact ? subject === v : subject.includes(v)));
    return op === '!=' ? !hit : hit;
  }

  if (kw === 'Rarity') {
    const ir = RARITY_RANK[item.rarity || 'Normal'] ?? 0;
    // `Rarity <= Rare` (operator + single rank) vs `Rarity Normal Magic Rare` (set).
    if (op && vals.length === 1 && RARITY_RANK[vals[0]] !== undefined) {
      return compare(ir, op, RARITY_RANK[vals[0]]);
    }
    return vals.some((v) => RARITY_RANK[v] === ir);
  }

  if (NUMERIC[kw]) {
    const iv = NUMERIC[kw](item, areaLevel);
    const tv = parseFloat(vals[0]);
    return Number.isNaN(tv) ? true : compare(iv, op, tv);
  }

  if (kw === 'SocketGroup') {
    const want = (vals[0] || '').replace(/[^RGBAWD]/gi, '').toUpperCase().split('');
    const have = (item.sockets || '').replace(/[^RGBAWD]/gi, '').toUpperCase().split('');
    return want.every((c) => { const i = have.indexOf(c); if (i < 0) return false; have.splice(i, 1); return true; });
  }

  if (BOOL_FIELD[kw]) {
    const expected = (vals[0] || 'True').trim() === 'True';
    return !!item[BOOL_FIELD[kw]] === expected;
  }

  if (kw === 'HasInfluence') {
    // AND across listed influences; "None" means no influence.
    if (vals.length === 1 && vals[0] === 'None') {
      return !Object.values(INFLUENCE).some((f) => item[f]);
    }
    return vals.every((v) => { const f = INFLUENCE[v]; return f ? !!item[f] : true; });
  }

  // Unmodelable (HasExplicitMod, HasEnchantment, ArchnemesisMod, MemoryStrands,
  // EnchantmentPassiveNode, GemQualityType, …) or any keyword we don't handle:
  // unknown — disqualify the block rather than falsely match it.
  return null;
};

export interface ForeignMatch {
  index: number;       // index into the passed blocks array
  block: FilterBlock;
  hidden: boolean;     // action === 'Hide'
}

/** Walk blocks in order; return the first whose conditions all hold. */
export const evaluateForeignItem = (
  item: ItemProps,
  blocks: FilterBlock[],
  areaLevel: number,
): ForeignMatch | null => {
  for (let i = 0; i < blocks.length; i++) {
    // Everything that isn't an action/flow/comment is a condition — including
    // ones the parser tagged 'unknown' (e.g. MemoryStrands), which must still
    // gate the block (matchCondition returns null → disqualifies it).
    const conds = blocks[i].statements.filter((s) => s.kind === 'condition' || s.kind === 'unknown');
    // A block matches only if every condition is a confirmed `true`. A `false`
    // or an `unknown` (null) rejects it and we try the next block.
    let ok = true;
    for (const s of conds) {
      if (matchCondition(item, s, areaLevel) !== true) { ok = false; break; }
    }
    if (ok) return { index: i, block: blocks[i], hidden: blocks[i].action === 'Hide' };
  }
  return null;
};
