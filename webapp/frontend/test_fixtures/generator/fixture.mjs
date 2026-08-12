// A small synthetic data tree for test_generator_fixtures.mjs.
//
// This exists because the generator's regression net used to be dual-generator
// parity (ADR-0001) over the REAL data tree. Parity proved the two engines agreed;
// it never proved either was right, and it died with the Python engine (ADR-0007).
// Golden output over the real tree is not a replacement either — it churns on every
// tier tweak, which in a filter editor is the most common edit there is. So the net
// is a fixture: invented items, invented tiers, output committed alongside. Data
// edits leave it untouched; a generator change moves it, and the diff is readable.
//
// Every entry below is here to pin ONE documented behaviour. Deleting an entry
// deletes the only check for that behaviour, so if a golden diff looks wrong, the
// comment above the entry is what it is supposed to be doing.

// Theme rows, keyed the way the generator looks them up: theme_category -> "Tier N".
export const themeData = {
  TestTheme: {
    'Tier 1': { FontSize: 45, TextColor: '#ffffffff', BorderColor: '#ff0000ff', BackgroundColor: '#000000ff' },
    'Tier 2': { FontSize: 40, TextColor: '#cccccccc', BorderColor: '#00ff00ff', BackgroundColor: '#111111ff' },
    'Tier 3': { FontSize: 35, TextColor: '#999999ff' },
    'Tier 9': { FontSize: 18, TextColor: '#444444ff' },
  },
  // Deliberately absent: 'Missing' — a tier whose CATEGORY is unknown falls to
  // Default, while a tier missing INSIDE a known category falls to {} and emits
  // only SetFontSize. Those two are different, and both are load-bearing.
  Default: { 'Tier 1': { FontSize: 32, TextColor: '#ababab ff'.replace(' ', '') } },
};

export const soundMap = {
  1: { path: 'Default/1.mp3', volume: 300 },
  2: { path: 'Default/2.mp3', volume: 200 },
};

export const footer = '# fixture footer\nShow\n    SetFontSize 18\n';

// ── tier_definition ──────────────────────────────────────────────────────────
export const allTierDefinitions = {
  'Alpha/Core.json': {
    Core: {
      _meta: {
        theme_category: 'TestTheme',
        item_class: { en: 'Core Items', ch: '核心物品' },
        localization: { en: 'Core', ch: '核心' },
        tier_order: ['Tier 1 Core', 'Tier 2 Core', 'Tier 3 Core', 'Tier 4 Core', 'Tier Hide Core'],
      },
      // Full style + a beam and an icon. Sound resolves to the curated sharket file.
      'Tier 1 Core': {
        theme: { Tier: 1, FontSize: 45, TextColor: '#ffffffff', BorderColor: '#ff0000ff', BackgroundColor: '#000000ff', PlayEffect: 'Red', MinimapIcon: '0 Red Star' },
        sound: { default_sound_id: 1, sharket_sound_id: 'alpha.mp3' },
        localization: { en: 'T1: Top', ch: 'T1: 顶级' },
      },
      // TextColor is ABSENT, not disabled — the game must paint the rarity colour,
      // so no SetTextColor line may appear. 441 of 998 real theme rows rely on this.
      // Also carries a strictness gate: shown at soft, Hidden at 'semistrict' (2) and above.
      'Tier 2 Core': {
        theme: { Tier: 2, FontSize: 40, BorderColor: '#00ff00ff', BackgroundColor: '#111111ff' },
        sound: { default_sound_id: 2, sharket_sound_id: null },
        hide_at_strictness: 2,
        // One base gets its own look without its own tier: the block splits, and the
        // overridden group emits FIRST because first-match-wins.
        item_overrides: { 'Beta Base': { TextColor: '#123456ff', PlayAlertSound: ['card.mp3', 250] } },
        localization: { en: 'T2: Mid', ch: 'T2: 中等' },
      },
      // Every styleOff sentinel in one row, plus tier-level conditions. Nothing but
      // SetFontSize and the conditions may survive. Operators keep their space.
      'Tier 3 Core': {
        theme: { Tier: 3, FontSize: 35, TextColor: 'disabled:', BorderColor: 'inherit', BackgroundColor: 'default', PlayEffect: null, MinimapIcon: null, PlayAlertSound: 'disabled:' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        conditions: { ItemLevel: '>= 68', Rarity: '<= Rare' },
        localization: { en: 'T3: Low', ch: 'T3: 低级' },
      },
      // No TextColor inline AND no 'Tier 4' row in TestTheme. Two game truths at once:
      //   * a missing tier row inside a KNOWN category falls back to {}, not to
      //     Default — so only SetFontSize survives from the theme side;
      //   * an ABSENT colour means "let the game paint it", so no SetTextColor line
      //     may be emitted. Emitting a default here would paint over the rarity
      //     colour, which is why 441 of 998 real theme rows omit the key.
      'Tier 4 Core': {
        theme: { Tier: 4, FontSize: 34, BorderColor: '#00000000' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'T4: Bare', ch: 'T4: 裸色' },
      },
      // In ruthless this must emit `Minimal` with NO style lines at all (GGG forbids
      // Hide there, and Minimal still draws a label). In standard it is a plain Hide.
      'Tier Hide Core': {
        is_hide_tier: true,
        theme: { Tier: 9, FontSize: 30, TextColor: '#888888ff', BackgroundColor: '#000000ff' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Hide', ch: '隐藏' },
      },
    },
  },

  // A class_condition tier bypasses the rules loop entirely (55 real tiers do this)
  // and emits its conditions with no BaseType line. excluded_modes drops the whole
  // file in ruthless, which is how Standard-only content stays out of the product.
  'Beta/Classy.json': {
    Classy: {
      _meta: {
        theme_category: 'TestTheme',
        item_class: { en: 'Classy', ch: '类别' },
        localization: { en: 'Classy', ch: '类别' },
        tier_order: ['Tier 1 Classy'],
      },
      'Tier 1 Classy': {
        class_condition: true,
        conditions: { Class: '== "Bows"', Rarity: 'Magic Rare' },
        theme: { Tier: 1, FontSize: 45, TextColor: '#ffffffff' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Net', ch: '网' },
      },
    },
  },

  // ★ Decorator tiers COMPOSE instead of terminating: they emit only the channels they
  // state, then `Continue`, so a state layers over whatever styles the item next.
  // Pinned here because three things are easy to regress and all are silent:
  //   * no SetFontSize (styleLines always emits one; a decorator must not),
  //   * no fallback to the theme row for unstated channels,
  //   * the `Continue` line itself, last.
  // The negative cases are pinned too: no conditions, and a hide tier, both emit NOTHING.
  'Beta/Decorated.json': {
    Decorated: {
      _meta: {
        theme_category: 'TestTheme',
        item_class: { en: 'Decorated', ch: '装饰' },
        localization: { en: 'Decorated', ch: '装饰' },
        tier_order: ['Corrupted Overlay', 'Naked Overlay', 'Hidden Overlay'],
        gen_order: -20,   // decorators must precede what they decorate
      },
      'Corrupted Overlay': {
        decorator: true,
        conditions: { Corrupted: 'True' },
        // Border ONLY. TextColor/BackgroundColor are deliberately unstated, and the
        // theme row for Tier 1 must NOT fill them in.
        theme: { Tier: 1, BorderColor: '#ff0000ff' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Corrupted', ch: '腐化' },
      },
      'Naked Overlay': {
        decorator: true,
        conditions: {},            // no conditions -> would repaint everything -> skipped
        theme: { Tier: 2, BorderColor: '#00ff00ff' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Naked', ch: '空' },
      },
      'Hidden Overlay': {
        decorator: true,
        is_hide_tier: true,        // hide + continue is a contradiction -> skipped
        conditions: { Corrupted: 'False' },
        theme: { Tier: 9, BorderColor: '#0000ffff' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'HiddenDeco', ch: '隐藏装饰' },
      },
    },
  },

  // Underscore folder: a mapping value naming a tier this category does not define
  // is REMAPPED onto the first non-hide tier rather than dropped. Everywhere else
  // the same key silently emits nothing — the difference is the point.
  '_legacy/Old.json': {
    Old: {
      _meta: {
        theme_category: 'TestTheme',
        item_class: { en: 'Old', ch: '旧物' },
        localization: { en: 'Old', ch: '旧物' },
        tier_order: ['Tier 1 Old', 'Tier Hide Old'],
      },
      'Tier 1 Old': {
        theme: { Tier: 1, FontSize: 45, TextColor: '#ffffffff' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Legacy', ch: '历史' },
      },
      'Tier Hide Old': {
        is_hide_tier: true,
        theme: { Tier: 9, FontSize: 30 },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Hide', ch: '隐藏' },
      },
    },
  },

  // Campaign: selection-centric. A 'weapon'/'armour' group emits ONLY when picked;
  // an 'aggressive' group emits only under hide_unselected, and then as Hide.
  // Strictness never applies inside _campaign.
  '_campaign/Bands.json': {
    Bands: {
      _meta: {
        theme_category: 'TestTheme',
        item_class: { en: 'Bands', ch: '进阶' },
        localization: { en: 'Bands', ch: '进阶' },
        tier_order: ['Bows Band', 'Armour Band', 'Declutter'],
        gen_order: -10,
      },
      'Bows Band': {
        lv_group: { axis: 'weapon', key: 'Bows' },
        class_condition: true,
        conditions: { Class: '== "Bows"', Rarity: 'Rare', AreaLevel: '<= 67' },
        theme: { Tier: 1, FontSize: 45, TextColor: '#ffffffff' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Bows', ch: '弓' },
      },
      'Armour Band': {
        lv_group: { axis: 'armour', key: 'Armour' },
        class_condition: true,
        conditions: { Class: '== "Body Armours"', Rarity: 'Rare', AreaLevel: '<= 67' },
        theme: { Tier: 2, FontSize: 40, TextColor: '#cccccccc' },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Armour', ch: '护甲' },
      },
      Declutter: {
        lv_group: { axis: 'aggressive' },
        class_condition: true,
        conditions: { Rarity: 'Normal', AreaLevel: '<= 67' },
        theme: { Tier: 9, FontSize: 30 },
        sound: { default_sound_id: -1, sharket_sound_id: null },
        localization: { en: 'Declutter', ch: '清理' },
      },
    },
  },
};

// ── base_mapping ─────────────────────────────────────────────────────────────
export const allMappings = {
  'Alpha/Core.json': {
    _meta: {
      localization: { ch: { 'Alpha Base': '甲基', 'Beta Base': '乙基', 'Gamma Base': '丙基', 'Delta Base': '丁基', 'Zeta Base': '泽基', 'Epsilon Base': '戊基' } },
      item_class: { en: 'Core Items', ch: '核心物品' },
      theme_category: 'TestTheme',
      // 'partial' drops the == so the game does a substring match; exact and partial
      // items must land in SEPARATE blocks.
      match_modes: { 'Gamma Base': 'partial' },
    },
    mapping: {
      'Alpha Base': 'Tier 1 Core',
      'Beta Base': 'Tier 2 Core',
      'Gamma Base': 'Tier 2 Core',
      'Delta Base': 'Tier 3 Core',
      'Zeta Base': 'Tier 4 Core',
      'Epsilon Base': 'Tier Hide Core',
    },
    rules: [
      // Named targets + a condition + a sound override. The rule CLAIMS the base, so
      // 'Alpha Base' must not also appear in the tier's own base block.
      {
        targets: ['Alpha Base'],
        conditions: { StackSize: '>= 10' },
        overrides: { Tier: 'Tier 1 Core', PlayAlertSound: ['special.mp3', 300] },
        comment: 'stacked',
        localization: { ch: '堆叠', en: 'Stacked' },
      },
      // No targets, conditions only — a self-selecting rule. Emits a block with the
      // condition and no BaseType line, and steals nothing from the tier.
      { targets: [], conditions: { Corrupted: 'True' }, overrides: { Tier: 'Tier 2 Core', BorderColor: '#ff00ffff' }, comment: 'corrupted' },
      // Disabled: must emit nothing AND must not claim its target.
      { targets: ['Beta Base'], conditions: {}, overrides: { Tier: 'Tier 1 Core' }, comment: 'off', disabled: true },
      // raw passes lines through verbatim, indented.
      { targets: [], conditions: {}, raw: 'SetFontSize 44\nCustomAlertSound "x.mp3" 200', overrides: { Tier: 'Tier 3 Core' }, comment: 'raw' },
    ],
  },

  'Beta/Classy.json': {
    _meta: {
      localization: { ch: {} },
      item_class: { en: 'Classy', ch: '类别' },
      theme_category: 'TestTheme',
      excluded_modes: ['ruthless'],
    },
    mapping: {},
    rules: [],
  },

  // A decorator matches by condition alone, so its mapping is deliberately empty.
  'Beta/Decorated.json': {
    _meta: {
      localization: { ch: {} },
      item_class: { en: 'Decorated', ch: '装饰' },
      theme_category: 'TestTheme',
    },
    mapping: {},
    rules: [],
  },

  '_legacy/Old.json': {
    _meta: {
      localization: { ch: { 'Old Base': '旧底材', 'Ghost Base': '幽灵底材' } },
      item_class: { en: 'Old', ch: '旧物' },
      theme_category: 'TestTheme',
    },
    mapping: {
      'Old Base': 'Tier 1 Old',
      // Undefined here — remapped onto the first non-hide tier because _legacy is an
      // underscore folder. Outside one, this item would vanish silently.
      'Ghost Base': 'Tier 404 Nonexistent',
    },
    rules: [],
  },

  '_campaign/Bands.json': {
    _meta: { localization: { ch: {} }, item_class: { en: 'Bands', ch: '进阶' }, theme_category: 'TestTheme' },
    mapping: {},
    rules: [],
  },
};

/** The GeneratorData the runner feeds in, minus the per-case knobs. */
export const baseData = () => ({
  themeData: JSON.parse(JSON.stringify(themeData)),
  soundMap: JSON.parse(JSON.stringify(soundMap)),
  allMappings: JSON.parse(JSON.stringify(allMappings)),
  allTierDefinitions: JSON.parse(JSON.stringify(allTierDefinitions)),
  footer,
});

/** Cases, each pinning a distinct axis. Golden file name == case name. */
export const CASES = [
  // Baseline: match modes, rules, sentinels, card split, absent-colour, footer.
  { name: 'standard-soft-ch', mode: 'standard', strictness: 'soft', language: 'ch', leveling: {} },
  // Same tree in English — the localization path must not move anything else.
  { name: 'standard-soft-en', mode: 'standard', strictness: 'soft', language: 'en', leveling: {} },
  // Strictness gate fires: Tier 2 Core flips to Hide at 'semistrict' (index 2).
  { name: 'standard-semistrict-ch', mode: 'standard', strictness: 'semistrict', language: 'ch', leveling: {} },
  // One below the gate — proves the threshold is >=, not >.
  { name: 'standard-regular-ch', mode: 'standard', strictness: 'regular', language: 'ch', leveling: {} },
  // Ruthless: Minimal instead of Hide with no style lines, and Beta/Classy dropped.
  { name: 'ruthless-soft-ch', mode: 'ruthless', strictness: 'soft', language: 'ch', leveling: {} },
  // Campaign: nothing picked — weapon/armour groups omitted entirely.
  { name: 'campaign-none', mode: 'standard', strictness: 'soft', language: 'ch', leveling: {} },
  // Campaign: Bows picked — that band emits, Armour still does not.
  { name: 'campaign-picked', mode: 'standard', strictness: 'soft', language: 'ch', leveling: { weapons: ['Bows'], armour_defense: [], hide_unselected: false, preset: 'CUSTOM' } },
  // Campaign: hide_unselected — the aggressive declutter group appears, as Hide.
  { name: 'campaign-hide-unselected', mode: 'standard', strictness: 'soft', language: 'ch', leveling: { weapons: ['Bows'], armour_defense: [], hide_unselected: true, preset: 'CUSTOM' } },
];
