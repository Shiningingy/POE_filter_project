// UI string table + the label registries, KEY-FIRST: every locale's wording for one
// string sits on one line, so a gap is visible where the string is defined rather than
// 600 lines away in another language's block.
//
// The locale engine (which languages exist, fallback chains, the resolver) is in
// `./locales`, re-exported here so existing `from '../utils/localization'` imports keep
// working. To add a language, see the recipe at the top of that file.
//
// ⚠️ NEVER hand-write or transliterate a zh string. Official item, base and class names
// come from the GGPK dump joined on `Id` — 11 of 11 hand-written names were wrong when
// this was last tested. UI chrome may be proposed, but the author reviews it.
import { LANGUAGES, LOCALES, isLocalized, label, localeChain, missingLocales, resolve } from './locales';
import type { Language, LocaleMeta, Localized } from './locales';

export { LANGUAGES, LOCALES, isLocalized, label, localeChain, missingLocales, resolve };
export type { Language, LocaleMeta, Localized };

/** Item class -> the key its label is stored under (class names contain spaces). */
export const CLASS_KEY_MAP: Record<string, string> = {
  "Stackable Currency": "Stackable_Currency",
  "Body Armours": "Body_Armours",
  Boots: "Boots",
  Gloves: "Gloves",
  Helmets: "Helmets",
  Shields: "Shields",
  "One Hand Axes": "One_Hand_Axes",
  "One Hand Maces": "One_Hand_Maces",
  "One Hand Swords": "One_Hand_Swords",
  "Thrusting One Hand Swords": "Thrusting_One_Hand_Swords",
  Sceptres: "Sceptres",
  Staves: "Staves",
  Warstaves: "Warstaves",
  "Two Hand Axes": "Two_Hand_Axes",
  "Two Hand Maces": "Two_Hand_Maces",
  "Two Hand Swords": "Two_Hand_Swords",
  Wands: "Wands",
  "Skill Gems": "Skill_Gems",
  "Support Gems": "Support_Gems",
  Maps: "Maps",
  "Map Fragments": "Map_Fragments",
  "Divination Cards": "Divination_Cards",
  Amulets: "Amulets",
  Rings: "Rings",
  Belts: "Belts",
  Bows: "Bows",
  Claws: "Claws",
  Daggers: "Daggers",
  "Rune Daggers": "Rune_Daggers",
  Quivers: "Quivers",
  Jewels: "Jewels",
  "Abyss Jewels": "Abyss_Jewels",
  "Life Flasks": "Life_Flasks",
  "Mana Flasks": "Mana_Flasks",
  "Utility Flasks": "Utility_Flasks",
  Scarabs: "Scarabs",
  "Expedition Logbooks": "Expedition_Logbooks",
  Contract: "Contract",
  Blueprint: "Blueprint",
  Relic: "Relic",
  Currency: "Currency",
  Essences: "Essences",
  Fossils: "Fossils",
  "Delirium Orbs": "Delirium_Orbs",
  Harvest: "Harvest",
  "Quest Items": "Quest_Items",
  "Labyrinth Items": "Labyrinth_Items",
  Gold: "Gold",
  Uniques: "Uniques",
  Gems: "Gems",
};

/** Every UI string. `{ en, ch }` leaves; a nested object groups related leaves. */
export const strings = {
  appTitle: { en: "Sharket POE Filter", ch: "Sharket POE 过滤编辑器" },
  editor: { en: "Editor", ch: "编辑器" },
  simulator: { en: "Simulator", ch: "模拟器" },
  saveExport: { en: "Save & Export", ch: "保存与导出" },
  saveConfig: { en: "Save Config", ch: "保存配置" },
  autoSaved: { en: "Saved", ch: "已自动保存" },
  autoSaveFailed: { en: "Auto-save failed - use Save Config", ch: "自动保存失败，请点击保存配置" },
  generateFilter: { en: "Generate Filter", ch: "生成过滤器" },
  selectFile: { en: "Select a file from the sidebar to edit", ch: "从左侧选择文件以编辑" },
  itemsInTier: { en: "Items in this Tier", ch: "此阶级物品" },
  noItems: { en: "No items in this tier", ch: "此阶级无物品" },
  searchPlaceholder: { en: "Search to add item...", ch: "搜索以添加物品..." },
  filterPlaceholder: { en: "Filter current items...", ch: "筛选当前物品..." },
  fontSize: { en: "Font Size", ch: "字体大小" },
  textColor: { en: "Text Color", ch: "文本颜色" },
  borderColor: { en: "Border Color", ch: "边框颜色" },
  bgColor: { en: "BG Color", ch: "背景颜色" },
  itemPreview: { en: "Item Preview", ch: "物品预览" },
  dropSimulator: { en: "Drop Simulator", ch: "掉落模拟器" },
  visual: { en: "Visual", ch: "可视化" },
  rawText: { en: "Raw Text", ch: "原始文本" },
  clearGround: { en: "Clear Ground", ch: "清空地面" },
  refreshStyles: { en: "Refresh Styles", ch: "刷新样式" },
  typeToDrop: { en: "Type item name to drop...", ch: "输入物品名称以落..." },
  groundEmpty: { en: "Ground is empty. Add some items!", ch: "地面为空。添加一些掉落物吧~" },
  loading: { en: "Loading...", ch: "加载中..." },
  generating: { en: "Generating...", ch: "生成中..." },
  generatedSuccess: { en: "Filter generated successfully!", ch: "过滤器生成成功！" },
  saveSuccess: { en: "Saved successfully!", ch: "保存成功！" },
  moveFailed: { en: "Failed to move item", ch: "移动物品失败" },
  loadFailed: { en: "Failed to load", ch: "加载失败" },
  inspector: { en: "Inspector", ch: "检查员" },
  rawFilter: { en: "Raw Filter Code", ch: "原始过滤器代码" },
  styleClipboard: { en: "Style Clipboard", ch: "样式剪贴板" },
  copyStyle: { en: "Copy Style", ch: "复制样式" },
  pasteStyle: { en: "Paste Style", ch: "粘贴样式" },
  clearClipboard: { en: "Clear", ch: "清空" },
  visibility: { en: "Visibility", ch: "可见性" },
  show: { en: "Show", ch: "显示" },
  hide: { en: "Hide", ch: "隐藏" },
  gameVersion: { en: "Game Version", ch: "游戏版本" },
  gameMode: { en: "Game Mode", ch: "游戏模式" },
  normalMode: { en: "Normal", ch: "普通" },
  ruthlessMode: { en: "Ruthless", ch: "无情" },
  strictness: { en: "Strictness", ch: "严格度" },
  gateAlways: { en: "Always show", ch: "始终显示" },
  protectTier: { en: "Protect (never hide)", ch: "保护（永不隐藏）" },
  unprotectTier: { en: "Protected — click to allow hiding", ch: "已保护 — 点击以允许隐藏" },
  adminMode: { en: "Admin", ch: "管理员" },
  adminModeHint: { en: "Lift the protect-guard on T0 chase tiers so their items can be deleted and re-tiered. Off by default; the button turns red while it is on.", ch: "解除 T0 顶级层级的保护锁，使其中的物品可以删除和调整层级。默认关闭；开启时按钮显示为红色。" },
  strictnessGates: { en: "Strictness Gates", ch: "严格度门限" },
  strictnessGatesHint: { en: "Set the strictness level at which each tier hides. This drives the exported filter (Standard & Ruthless). Save/import a preset, then fine-tune individual tiers.", ch: "设置每个层级在哪个严格度下开始隐藏。影响导出的过滤器（普通与无情）。可保存/导入预设，再微调单个层级。" },
  setAllGate: { en: "Set all", ch: "全部设为" },
  savePreset: { en: "Save preset", ch: "保存预设" },
  importPreset: { en: "Import preset", ch: "导入预设" },
  presetImportFailed: { en: "Could not read that preset file.", ch: "无法读取该预设文件。" },
  strictnessLevels: {
    soft: { en: "Soft", ch: "宽松" },
    regular: { en: "Regular", ch: "常规" },
    semistrict: { en: "Semi-Strict", ch: "半严格" },
    strict: { en: "Strict", ch: "严格" },
    verystrict: { en: "Very Strict", ch: "非常严格" },
    uber: { en: "Uber", ch: "极严" },
    uberplus: { en: "Uber Plus", ch: "极严+" },
  },
  campaign: { en: "Campaign", ch: "过渡" },
  campaignTitle: { en: "Auto-Adjust: Campaign", ch: "自动调整：过渡（升级）" },
  campaignHint: { en: "Pick your build's weapon classes and defense types to ADD their highlight layers: on-level good bases get double emphasis (T1), the rest of the class single emphasis (T2). Everything unpicked still shows via the rare safety net (T3).", ch: "选择你构筑的武器类别与防御类型，以添加它们的突显层：当前等级的好底子为双重强调（T1），该类其余稀有为单层强调（T2）。未选择的内容仍由稀有保底（T3）显示。" },
  lvPresets: { en: "Build Presets", ch: "构筑预设" },
  lvWeapons: { en: "Highlight weapons", ch: "突显武器" },
  lvArmour: { en: "Highlight armour (defense type)", ch: "突显防具（防御类型）" },
  lvOptions: { en: "Options", ch: "选项" },
  lvCustom: { en: "CUSTOM", ch: "自定义" },
  lvBaseline: { en: "Baseline", ch: "基线" },
  tierConditions: { en: "Matches", ch: "匹配条件" },
  tierConditionsHint: { en: "This block matches items by these conditions (no item list needed). Full values on hover.", ch: "该区块通过以下条件匹配物品（无需物品列表）。悬停查看完整值。" },
  tierConditionsEdit: { en: "Edit this block's conditions", ch: "编辑该区块的匹配条件" },
  tierConditionsNone: { en: "no conditions — matches on its item list alone", ch: "无条件 — 仅按物品列表匹配" },
  tierConditionsNoSchema: { en: "Condition list unavailable (rule-templates did not load).", ch: "条件列表不可用（规则模板未加载）。" },
  lvBoostChip: { en: "Enable", ch: "启用" },
  lvBoostedChip: { en: "Enabled", ch: "已启用" },
  lvBoostHint: { en: "Include this group's campaign highlights (T1 on-level bands + T2 class rares) — same as picking it in the Campaign picker. Disabled groups fall to the rare safety net.", ch: "启用该组的过渡突显（当前等级好底子 T1 + 该类稀有 T2）—— 等同于在过渡选择器中选中。未启用的组仅由稀有保底显示。" },
  lvSelectAll: { en: "Select all", ch: "全选" },
  lvClearAll: { en: "Clear", ch: "清空" },
  lvHideUnselected: { en: "Hide Unselected Gear Aggressively", ch: "积极隐藏未选装备" },
  lvHideUnselectedHint: { en: "Strict campaign declutter: hide the weapon classes you didn't pick, and hide magic items after Act 3 (well-linked ones still show).", ch: "严格过渡清理：隐藏未选择的武器类别，并在第三章后隐藏魔法物品（有良好连接的仍会显示）。" },
  lvDefense: {
    Armour: { en: "Armour", ch: "护甲" },
    "AR/EV": { en: "AR/EV", ch: "护甲/闪避" },
    Evasion: { en: "Evasion", ch: "闪避" },
    "EV/ES": { en: "EV/ES", ch: "闪避/能量护盾" },
    "Energy Shield": { en: "Energy Shield", ch: "能量护盾" },
    "AR/ES": { en: "AR/ES", ch: "护甲/能量护盾" },
  },
  lvPresetNames: {
    claw_dagger: { en: "Claw & Dagger", ch: "爪与匕首" },
    bow_ranger: { en: "Bow Ranger", ch: "弓箭手" },
    sword_shield: { en: "Sword & Shield", ch: "剑与盾" },
    axe_mace: { en: "2H Axe/Mace", ch: "双手斧/锤" },
    fire_templar: { en: "Fire Templar", ch: "火焰圣堂" },
    spells_minions: { en: "Spells & Minions", ch: "法术与召唤" },
  },
  lvAll: { en: "All", ch: "全部" },
  overview: { en: "Overview", ch: "概览" },
  userManual: { en: "User Manual", ch: "用户手册" },
  overviewTitle: { en: "Get started", ch: "开始设置" },
  overviewSubtitle: { en: "Set up your filter, then customize the details or export.", ch: "先配置过滤器，再细致自定义或导出。" },
  overviewOpen: { en: "Open", ch: "打开" },
  cardAutoAdjust: { en: "Auto-Adjust for build", ch: "按构筑自动调整" },
  cardAutoAdjustDesc: { en: "Highlight the leveling gear your build actually uses.", ch: "高亮你的构筑实际会用到的升级装备。" },
  cardStrictnessDesc: { en: "How much loot the filter shows.", ch: "过滤器显示多少物品。" },
  cardGameModeDesc: { en: "Ruthless or Standard rule set.", ch: "无情或标准规则。" },
  cardCustomize: { en: "Customize filter", ch: "自定义过滤器" },
  cardCustomizeDesc: { en: "Fine-tune every tier and rule in detail.", ch: "细致调整每个层级与规则。" },
  cardThemes: { en: "Theme & Sound", ch: "外观与音效" },
  cardThemesDesc: { en: "Colours, fonts and drop sounds.", ch: "颜色、字体与掉落音效。" },
  cardExportDesc: { en: "Download the filter or copy it to PoE.", ch: "下载过滤器或复制到 PoE。" },
  cardImportDesc: { en: "Import and adapt another author's filter.", ch: "导入并改造其他作者的过滤器。" },
  campaignApplied: { en: "Campaign settings applied — regenerate or export to update the filter.", ch: "过渡设置已应用 — 重新生成或导出以更新过滤器。" },
  sentinelInherit: { en: "Rarity", ch: "稀有度" },
  sentinelInheritHint: { en: "No text colour is written — the item keeps its rarity colour in game. Click ✓ to set a custom colour instead.", ch: "不写入文字颜色 — 物品在游戏中保持其稀有度颜色。点击 ✓ 可改为自定义颜色。" },
  sentinelDefault: { en: "Default", ch: "默认" },
  sentinelDefaultHint: { en: "No background is written — the game's default label background is used. Click ✓ to set a custom colour instead.", ch: "不写入背景颜色 — 使用游戏默认标签背景。点击 ✓ 可改为自定义颜色。" },
  previewAsRarity: { en: "Preview the inherited text as this rarity", ch: "以该稀有度预览继承的文字颜色" },
  rarityNames: {
    normal: { en: "Normal", ch: "普通" },
    magic: { en: "Magic", ch: "魔法" },
    rare: { en: "Rare", ch: "稀有" },
    unique: { en: "Unique", ch: "传奇" },
  },
  rules: { en: "Rules", ch: "规则" },
  rule: { en: "Rule", ch: "规则" },
  addRule: { en: "Add Rule", ch: "添加规则" },
  deleteRule: { en: "Delete Rule", ch: "删除规则" },
  targets: { en: "Targets", ch: "目标" },
  conditions: { en: "Conditions", ch: "条件" },
  overrides: { en: "Overrides", ch: "覆盖设定" },
  comment: { en: "Comment", ch: "备注" },
  sound: { en: "Sound", ch: "声音" },
  icon: { en: "Icon", ch: "图标" },
  beam: { en: "Beam", ch: "光柱" },
  text: { en: "Text", ch: "文本" },
  border: { en: "Border", ch: "边框" },
  background: { en: "Background", ch: "背景" },
  transparency: { en: "Transparency", ch: "透明度" },
  coast: { en: "Coast", ch: "海滩" },
  forest: { en: "Forest", ch: "丛林" },
  sand: { en: "Sand", ch: "沙漠" },
  volume: { en: "Volume", ch: "音量" },
  soundType: { en: "Sound Type", ch: "声音类型" },
  default: { en: "Default", ch: "系统默认" },
  sharket: { en: "Sharket", ch: "Sharket音效" },
  custom: { en: "Custom", ch: "自定义路径" },
  filePath: { en: "File Path", ch: "文件路径" },
  test: { en: "Test", ch: "测试" },
  search: { en: "Search...", ch: "搜索..." },
  size: { en: "Size", ch: "大小" },
  shape: { en: "Shape", ch: "形状" },
  temporary: { en: "Temporary", ch: "临时" },
  small: { en: "Small", ch: "小" },
  medium: { en: "Medium", ch: "中" },
  large: { en: "Large", ch: "大" },
  small_sh: { en: "S", ch: "小" },
  medium_sh: { en: "M", ch: "中" },
  large_sh: { en: "L", ch: "大" },
  copy: { en: "Copy", ch: "复制" },
  paste: { en: "Paste", ch: "粘贴" },
  cancel: { en: "Cancel", ch: "取消" },
  ok: { en: "OK", ch: "确定" },
  none: { en: "None", ch: "无" },
  permanent: { en: "Permanent", ch: "永久" },
  viewerSettings: { en: "Viewer Settings", ch: "显示设置" },
  copyText: { en: "Copy Text", ch: "复制文本" },
  bulkEdit: { en: "Bulk Edit", ch: "批量编辑" },
  addNewTier: { en: "Add New Tier", ch: "添加新阶级" },
  testSound: { en: "Test Sound", ch: "测试音效" },
  color: { en: "Color", ch: "颜色" },
  name: { en: "Name", ch: "名称" },
  source: { en: "Source", ch: "来源" },
  targetTooltip: { en: "Targets are optional. Use targets to apply specific conditions.Check \"apply to all items in this tier\" will overrides to individual items within the tier.(exclude those already targeted in other rules).", ch: "目标是可选的，使用目标可以对阶级内的单个物品应用特定条件或样式覆盖。勾选应用至阶级的所有物品，则该规则应用于此阶级中的所有物品类型（不包括规则之内）。" },
  quickRules: { en: "Quick Add Rules", ch: "快速添加规则" },
  addCustomRule: { en: "Add Custom Rule (Raw)", ch: "添加自定义规则 (原始代码)" },
  stackSizeRule: { en: "Stack Size Rule", ch: "堆叠数量规则" },
  gemLevelRule: { en: "Gem Level Rule", ch: "宝石等级规则" },
  qualityRule: { en: "High Quality Rule", ch: "高品质规则" },
  influenceRule: { en: "Influenced Rule", ch: "势力物品规则" },
  fracturedRule: { en: "Fractured Rule", ch: "破碎物品规则" },
  socketRule: { en: "Sockets/Links Rule", ch: "插槽/连线规则" },
  itemLevelRule: { en: "High ItemLevel Rule", ch: "高物等规则" },
  Red: { en: "Red", ch: "红色" },
  Green: { en: "Green", ch: "绿色" },
  Blue: { en: "Blue", ch: "蓝色" },
  Brown: { en: "Brown", ch: "棕色" },
  White: { en: "White", ch: "白色" },
  Yellow: { en: "Yellow", ch: "黄色" },
  Cyan: { en: "Cyan", ch: "青色" },
  Grey: { en: "Grey", ch: "灰色" },
  Orange: { en: "Orange", ch: "橙色" },
  Pink: { en: "Pink", ch: "粉色" },
  Purple: { en: "Purple", ch: "紫色" },
  Temp: { en: "Temp", ch: "临时" },
  dragToReorder: { en: "Drag to reorder", ch: "拖动排序" },
  insertTierBefore: { en: "Insert Tier Before", ch: "在此之前插入新阶级" },
  insertTierAfter: { en: "Insert Tier After", ch: "在此之后插入新阶级" },
  above: { en: "ABOVE", ch: "上方" },
  below: { en: "BELOW", ch: "下方" },
  copyTier: { en: "Copy Tier", ch: "复制阶级" },
  deleteTier: { en: "Delete Tier", ch: "删除阶级" },
  insertBefore: { en: "Insert Before", ch: "在此之前插入" },
  insertAfter: { en: "Insert After", ch: "在此之后插入" },
  pasteTier: { en: "Paste Tier", ch: "粘贴阶级" },
  confirmDeleteTier: { en: "Are you sure you want to delete this tier?", ch: "确定要删除此阶级吗?" },
  DRAG: { en: "DRAG", ch: "拖动" },
  untiered: { en: "Untiered", ch: "未分类" },
  itemsStaged: { en: "items staged", ch: "项变动" },
  activeTierBrush: { en: "Active Tier (Brush):", ch: "当前阶级 (刷子):" },
  saveChanges: { en: "Save Changes", ch: "保存更改" },
  itemClass: { en: "Item Class", ch: "物品类型" },
  itemSubType: { en: "Item SubType", ch: "物品子类型" },
  requiresLevel: { en: "Requires Level", ch: "等级需求" },
  actions: { en: "Actions", ch: "操作" },
  deleteRuleConfirm: { en: "Are you sure you want to delete this rule?", ch: "确定要删除此规则吗？" },
  ruleComment: { en: "Rule Comment...", ch: "规则备注..." },
  addItemTarget: { en: "Add item target...", ch: "添加物品目标..." },
  themeOverrides: { en: "Theme Overrides", ch: "外观覆盖" },
  moveTo: { en: "Move to:", ch: "移动至:" },
  enableRule: { en: "Enable Rule", ch: "启用规则" },
  disableRule: { en: "Disable Rule", ch: "禁用规则" },
  goToRule: { en: "Go to Rule", ch: "跳转至规则" },
  removeFromRule: { en: "Remove from Rule", ch: "从规则中移除" },
  deleteRuleLabel: { en: "Delete Rule", ch: "删除规则" },
  rangeBetween: { en: "Between", ch: "范围" },
  t0MoveWarning: { en: "You are moving a Top Tier item ({name}) into a HIDE tier. Are you sure?", ch: "你正在将顶级物品({name})移入隐藏分类，确定吗？" },
  t0OrderWarning: { en: "You are moving a custom tier above Tier 0. This is usually not recommended. Continue?", ch: "你正在将自定义阶级移至 T0 之上，这通常不被推荐。确定吗？" },
  t0InsertWarning: { en: "You are inserting a new tier above Tier 0. Continue?", ch: "你正在 T0 之上插入新阶级。确定吗？" },
  copyLabel: { en: "(Copy)", ch: "(副本)" },
  str: { en: "Str", ch: "力量" },
  dex: { en: "Dex", ch: "敏捷" },
  int: { en: "Int", ch: "智慧" },
  dropLevel: { en: "Drop Level", ch: "掉落等级" },
  physicalDamage: { en: "Physical Damage", ch: "物理伤害" },
  criticalStrikeChance: { en: "Critical Strike Chance", ch: "暴击率" },
  attacksPerSecond: { en: "Attacks per Second", ch: "每秒攻击次数" },
  Stackable_Currency: { en: "Stackable Currency", ch: "可堆叠通货" },
  Body_Armours: { en: "Body Armours", ch: "胸甲" },
  Boots: { en: "Boots", ch: "鞋子" },
  Gloves: { en: "Gloves", ch: "手套" },
  Helmets: { en: "Helmets", ch: "头部" },
  Shields: { en: "Shields", ch: "盾" },
  One_Hand_Axes: { en: "One Hand Axes", ch: "单手斧" },
  One_Hand_Maces: { en: "One Hand Maces", ch: "单手锤" },
  One_Hand_Swords: { en: "One Hand Swords", ch: "单手剑" },
  Thrusting_One_Hand_Swords: { en: "Thrusting One Hand Swords", ch: "细剑" },
  Sceptres: { en: "Sceptres", ch: "短杖" },
  Staves: { en: "Staves", ch: "长杖" },
  Warstaves: { en: "Warstaves", ch: "战杖" },
  Two_Hand_Axes: { en: "Two Hand Axes", ch: "双手斧" },
  Two_Hand_Maces: { en: "Two Hand Maces", ch: "双手锤" },
  Two_Hand_Swords: { en: "Two Hand Swords", ch: "双手剑" },
  Wands: { en: "Wands", ch: "法杖" },
  Skill_Gems: { en: "Skill Gems", ch: "技能宝石" },
  Support_Gems: { en: "Support Gems", ch: "辅助宝石" },
  Maps: { en: "Maps", ch: "地图" },
  Map_Fragments: { en: "Map Fragments", ch: "碎片" },
  Divination_Cards: { en: "Divination Cards", ch: "命运卡" },
  Amulets: { en: "Amulets", ch: "项链" },
  Rings: { en: "Rings", ch: "戒指" },
  Belts: { en: "Belts", ch: "腰带" },
  Bows: { en: "Bows", ch: "弓" },
  Claws: { en: "Claws", ch: "爪" },
  Daggers: { en: "Daggers", ch: "匕首" },
  Rune_Daggers: { en: "Rune Daggers", ch: "符文匕首" },
  Quivers: { en: "Quivers", ch: "箭袋" },
  Jewels: { en: "Jewels", ch: "珠宝" },
  Abyss_Jewels: { en: "Abyss Jewels", ch: "深渊珠宝" },
  Life_Flasks: { en: "Life Flasks", ch: "生命药剂" },
  Mana_Flasks: { en: "Mana Flasks", ch: "魔力药剂" },
  Utility_Flasks: { en: "Utility Flasks", ch: "功能药剂" },
  Scarabs: { en: "Scarabs", ch: "圣甲虫" },
  Expedition_Logbooks: { en: "Expedition Logbooks", ch: "探险日志" },
  Contract: { en: "Contract", ch: "契约" },
  Blueprint: { en: "Blueprint", ch: "蓝图" },
  Relic: { en: "Relic", ch: "圣物" },
  Currency: { en: "Currency", ch: "通货" },
  Essences: { en: "Essences", ch: "精华" },
  Fossils: { en: "Fossils", ch: "化石" },
  Delirium_Orbs: { en: "Delirium Orbs", ch: "惊影玉" },
  Harvest: { en: "Harvest", ch: "庄稼/园艺" },
  Quest_Items: { en: "Quest Items", ch: "任务物品" },
  Labyrinth_Items: { en: "Labyrinth Items", ch: "迷宫物品" },
  Gold: { en: "Gold", ch: "金币" },
  Uniques: { en: "Uniques", ch: "传奇物品" },
  Gems: { en: "Gems", ch: "技能石" },
  All: { en: "All", ch: "全部" },
  Armour: { en: "Armour", ch: "护甲" },
  Evasion_Rating: { en: "Evasion Rating", ch: "闪避" },
  Energy_Shield: { en: "Energy Shield", ch: "能量护盾" },
  Armour_ES: { en: "Armour/ES", ch: "护甲/能量护盾" },
  Evasion_Armour: { en: "Evasion/Armour", ch: "闪避/护甲" },
  ES_Evasion: { en: "ES/Evasion", ch: "能量护盾/闪避" },
  Armour_Evasion_ES: { en: "Armour/Evasion/ES", ch: "护甲/能量护盾/闪避" },
  customRules: { en: "custom rules", ch: "自定义规则" },
  autoSounds: { en: "auto-sounds", ch: "自动音效" },
  active: { en: "active", ch: "生效中" },
  and: { en: "and", ch: "和" },
  moreRulesHidden: { en: "more rules hidden", ch: "更多规则已隐藏" },
  true: { en: "True", ch: "是 (True)" },
  false: { en: "False", ch: "否 (False)" },
  conditionAlreadyAdded: { en: "Condition already added", ch: "该条件已存在" },
  ruleAdded: { en: "Rule added", ch: "规则已添加" },
  conditionAdded: { en: "Condition added", ch: "条件已添加" },
  soundSelection: { en: "Sound Selection", ch: "音效选择" },
  customPath: { en: "Custom Path", ch: "自定义路径" },
  enterPath: { en: "Enter file path...", ch: "输入文件路径..." },
  fromAutoSound: { en: "From Auto-Sound", ch: "来自自动音效" },
  fromRule: { en: "From Rule Override", ch: "来自规则覆盖" },
  fromTierDefault: { en: "From Tier Default", ch: "来自阶级默认" },
  currentSource: { en: "Current Source", ch: "当前来源" },
  currentSound: { en: "Current Sound", ch: "当前音效" },
  quickMove: { en: "Quick Move", ch: "快速移动" },
  itemSettings: { en: "Item Settings", ch: "物品设置" },
  current: { en: "(Current)", ch: "(当前)" },
  switchToPartial: { en: "Switch to Partial Match", ch: "切换为模糊匹配" },
  switchToExact: { en: "Switch to Exact Match", ch: "切换为精确匹配" },
  noOptions: { en: "No available options", ch: "暂无可用操作" },
  removeFromTier: { en: "Remove from this Tier", ch: "从此阶级移除" },
  clearSound: { en: "Clear sound (fall back to tier)", ch: "清除音效（回退至层级音效）" },
  selectAll: { en: "All", ch: "全部" },
  selectAllFiltered: { en: "Select filtered", ch: "全选筛选结果" },
  selectAllFilteredTitle: { en: "Tick every tiered item the filter is showing. Press again to clear the selection.", ch: "勾选当前筛选出的所有已分类物品；再次点击可取消全选。" },
  removeSelected: { en: "Remove selected", ch: "移除所选" },
  bulkRemoveTitle: { en: "Remove the selected items from THIS category. Their tiers in other categories are kept.", ch: "将所选物品移出【本类别】，其它类别中的层级保持不变。" },
  bulkRemoveConfirm: { en: "Remove {n} item(s) from this category?\n\n{locked} protected item(s) will be skipped.\nStaged only - press Save Changes to write.", ch: "确定要将 {n} 个物品移出本类别吗？\n\n将跳过 {locked} 个受保护物品。\n此操作仅暂存，需点击保存更改才会写入。" },
  addTo: { en: "Add to", ch: "添加至" },
  noSoundApplied: { en: "No sound applied", ch: "未应用音效" },
  bonusDropsAs: { en: "Drops as", ch: "掉落为" },
  bonusCouldBe: { en: "Could be one of", ch: "可能是其中之一" },
  bonusAndMore: { en: "more", ch: "更多" },
  srcGlobal: { en: "Global drop", ch: "全局掉落" },
  srcBoss: { en: "Boss drop", ch: "首领限定" },
  srcLeague: { en: "League mechanic", ch: "机制限定" },
  srcNoDrop: { en: "No drop", ch: "不掉落" },
  srcLegacy: { en: "Legacy", ch: "绝版" },
  exportTitle: { en: "Save & Export", ch: "保存与导出" },
  exportCardTitle: { en: "Compile & Download", ch: "编译并下载" },
  exportCardDesc: { en: "Generate your customized {ext} file and download it immediately.", ch: "生成你的自定义 {ext} 文件并立即下载。" },
  exportGenerate: { en: "Generate & Download", ch: "生成并下载" },
  exportGenerating: { en: "Generating...", ch: "生成中..." },
  exportFormat: { en: "Export format", ch: "导出格式" },
  exportFilterOnly: { en: "Filter only", ch: "仅过滤器文件" },
  exportWithSidecar: { en: "Filter + snapshot file (recommended)", ch: "过滤器 + 快照文件（推荐）" },
  exportEmbedded: { en: "Filter with embedded snapshot", ch: "过滤器内嵌快照" },
  exportBoth: { en: "Filter + snapshot file + embedded", ch: "过滤器 + 快照文件 + 内嵌" },
  exportFormatHint: { en: "The snapshot stores your full configuration so the filter can be re-imported losslessly.", ch: "快照保存了你的完整配置，使过滤器可以无损地重新导入。" },
  exportSnapshotFailed: { en: "Snapshot export failed — the filter was downloaded WITHOUT a snapshot. If you just updated the app, restart the backend and try again.", ch: "快照导出失败 —— 已下载的过滤器不包含快照。如果你刚更新了应用，请重启后端后再试。" },
  admTitle: { en: "Admin", ch: "管理" },
  admLoginHint: { en: "For invited filter maintainers only. Accounts are created by the owner — there is no public signup.", ch: "仅限受邀的过滤器维护者。账号由所有者创建，不开放公开注册。" },
  admEmail: { en: "Email", ch: "邮箱" },
  admPassword: { en: "Password", ch: "密码" },
  admSignIn: { en: "Sign in", ch: "登录" },
  admSignOut: { en: "Sign out", ch: "退出登录" },
  admOwner: { en: "owner", ch: "所有者" },
  admSubmitTitle: { en: "Submit changes for review", ch: "提交更改以供审核" },
  admSubmitHint: { en: "Sends your current filter configuration (everything you edited in this browser) to the owner for review. Approved changes are merged into the official filter.", ch: "将你当前的过滤器配置（在此浏览器中的所有编辑）发送给所有者审核。通过审核的更改会合并进官方过滤器。" },
  admSubmissionTitle: { en: "Title (what did you change?)", ch: "标题（你改了什么？）" },
  admSubmissionNote: { en: "Notes for the reviewer (optional)", ch: "给审核者的备注（可选）" },
  admSubmit: { en: "Submit snapshot", ch: "提交快照" },
  admSubmitted: { en: "Submitted — thank you! The owner will review it.", ch: "已提交 —— 感谢！所有者会进行审核。" },
  admSubmitFailed: { en: "Submit failed", ch: "提交失败" },
  admMySubmissions: { en: "My submissions", ch: "我的提交" },
  admAllSubmissions: { en: "All submissions", ch: "全部提交" },
  admNoSubmissions: { en: "No submissions yet.", ch: "暂无提交。" },
  admPending: { en: "pending", ch: "待审核" },
  admApproved: { en: "approved", ch: "已通过" },
  admRejected: { en: "rejected", ch: "已拒绝" },
  admDownload: { en: "Snapshot", ch: "快照" },
  admDownloadFailed: { en: "Download failed", ch: "下载失败" },
  admApprove: { en: "Approve", ch: "通过" },
  admReject: { en: "Reject", ch: "拒绝" },
  exportRedownloadFilter: { en: "Download filter again", ch: "重新下载过滤器" },
  exportRedownloadSnapshot: { en: "Download snapshot", ch: "下载快照" },
  exportBrowserBlockHint: { en: "If your browser blocked a download, use these buttons:", ch: "如果浏览器拦截了下载，请使用以下按钮：" },
  importTitle: { en: "Import / Restore", ch: "导入 / 恢复" },
  importDesc: { en: "Load a snapshot file (.snapshot.json) or a filter exported with an embedded snapshot.", ch: "加载快照文件（.snapshot.json）或带内嵌快照导出的过滤器文件。" },
  importChooseFile: { en: "Choose file...", ch: "选择文件..." },
  importInvalidFile: { en: "Not a Sharket export — no snapshot data found in this file.", ch: "不是本工具导出的文件——未找到快照数据。" },
  importNewerVersion: { en: "This snapshot was made by a newer app version and cannot be imported.", ch: "此快照由更新版本的应用创建，无法导入。" },
  importDetected: { en: "Snapshot loaded", ch: "已加载快照" },
  importFilesCount: { en: "files", ch: "个文件" },
  importSelectAll: { en: "Select all", ch: "全选" },
  importSelectNone: { en: "Select none", ch: "全不选" },
  importThemeGroup: { en: "Theme & styles", ch: "主题与样式" },
  importSoundsGroup: { en: "Sound maps", ch: "音效映射" },
  importSettingsGroup: { en: "Settings", ch: "设置" },
  importApply: { en: "Import selected", ch: "导入所选" },
  importApplying: { en: "Importing...", ch: "导入中..." },
  importApplied: { en: "Import complete. Reloading...", ch: "导入完成，正在刷新..." },
  importBackupNote: { en: "Overwritten files are backed up to", ch: "被覆盖的文件已备份至" },
  importDemoNoBackup: { en: "Demo mode: changes are stored in your browser only, no backup is created.", ch: "演示模式：更改仅保存在浏览器中，不会创建备份。" },
  importNothingSelected: { en: "Select at least one group to import.", ch: "请至少选择一个分组进行导入。" },
  importWrittenSummary: { en: "written", ch: "已写入" },
  importDeletedSummary: { en: "removed", ch: "已移除" },
  tsExport: { en: "Export", ch: "导出" },
  tsImport: { en: "Import", ch: "导入" },
  tsExportSounds: { en: "Export Sounds", ch: "导出音效" },
  tsImportSounds: { en: "Import Sounds", ch: "导入音效" },
  tsImportTheme: { en: "Import Theme Preset", ch: "导入主题预设" },
  tsImportAsNew: { en: "Import as new preset", ch: "导入为新预设" },
  tsOverwriteExisting: { en: "Overwrite existing preset", ch: "覆盖现有预设" },
  tsPresetName: { en: "Preset name", ch: "预设名称" },
  tsImportedAsPreset: { en: "Imported as preset", ch: "已导入为预设" },
  tsInvalidThemeFile: { en: "Not a theme export file.", ch: "不是主题导出文件。" },
  tsInvalidSoundFile: { en: "Not a sound export file.", ch: "不是音效导出文件。" },
  tsNewerVersion: { en: "This file was made by a newer app version and cannot be imported.", ch: "此文件由更新版本的应用创建，无法导入。" },
  tsImportReport: { en: "Sound Import Report", ch: "音效导入报告" },
  tsApplied: { en: "updated", ch: "已更新" },
  tsCreated: { en: "created", ch: "已创建" },
  tsSkipped: { en: "skipped", ch: "已跳过" },
  tsSkipFileMissing: { en: "category file not found", ch: "未找到对应分类文件" },
  tsSkipNoMatch: { en: "no matching rule block", ch: "没有匹配的规则块" },
  tsSkipTargetMissing: { en: "item not in that file", ch: "该文件中不存在此物品" },
  tsMissingAudio: { en: "Referenced sound files not found locally (sounds will be silent until added):", ch: "本地未找到以下音效文件（添加前将无声）：" },
  tsMapEntriesMerged: { en: "sound map entries merged", ch: "条音效映射已合并" },
  tsOverwriteConfirm: { en: "This will replace the selected preset's data. Continue?", ch: "这将替换所选预设的数据，是否继续？" },
  applyTheme: { en: "Apply Theme", ch: "应用此预设" },
  currentTheme: { en: "Current Theme", ch: "当前预设" },
  simulatorSettings: { en: "Settings", ch: "设置" },
  scene: { en: "Scene", ch: "场景" },
  areaLevel: { en: "Area Level", ch: "区域等级" },
  randomGenerator: { en: "Random Generator", ch: "随机生成器" },
  dropCount: { en: "Drop Count", ch: "掉落数量" },
  generateDrop: { en: "Generate Drop", ch: "生成掉落" },
  generateValuable: { en: "Generate Valuable", ch: "生成贵重物品" },
  min: { en: "Min", ch: "最小" },
  max: { en: "Max", ch: "最大" },
  rarityWeights: { en: "Rarity Weights", ch: "稀有度权重" },
  normalize: { en: "Normalize", ch: "归一化" },
  categories: { en: "Categories", ch: "类别" },
  save: { en: "Save", ch: "保存" },
  loadingData: { en: "Loading data…", ch: "数据加载中…" },
  applyStylePreset: { en: "Apply style preset", ch: "应用样式预设" },
  presetSourceCategory: { en: "Style source category", ch: "样式来源类别" },
  applyStyleHint: { en: "Copies colors, font size, beam and minimap icon from the chosen theme tier. Sounds are managed separately.", ch: "从所选主题层级复制颜色、字号、光柱与小地图图标。音效请在音效编辑器中单独管理。" },
  showHideEditor: { en: "Global Show/Hide Helper", ch: "全局 显示/隐藏 编辑助手" },
  toolbar: { en: "Toolbar", ch: "工具栏" },
  showAll: { en: "Show all", ch: "全部显示" },
  hideAll: { en: "Hide all", ch: "全部隐藏" },
  applyChanges: { en: "Apply changes", ch: "应用更改" },
  visibilityChanges: { en: "pending change(s)", ch: "项待应用" },
  visibilityHint: { en: "Toggle which tiers actually appear in game. Red = hidden. Changes apply to the tier files when you press Apply.", ch: "切换各层级是否在游戏中显示。红色 = 隐藏。点击“应用更改”后写入层级文件。" },
  renameTier: { en: "Rename tier", ch: "重命名层级" },
  renameTierHint: { en: "Only the display name changes — the internal tier key and styling stay the same. Leave empty to restore the default name.", ch: "仅修改显示名称 —— 内部层级标识与样式保持不变。留空则恢复默认名称。" },
  openSettings: { en: "Open Settings", ch: "打开设置" },
  collapse: { en: "Collapse", ch: "折叠" },
  addItem: { en: "Add Item", ch: "添加物品" },
  createItem: { en: "Create Item", ch: "创建物品" },
  editItem: { en: "Edit Item", ch: "编辑物品" },
  classGroup: { en: "Class Group", ch: "类别组" },
  allClasses: { en: "All Classes", ch: "所有类别" },
  baseType: { en: "Base Type", ch: "基础类型" },
  flags: { en: "Flags", ch: "标志" },
  updateItem: { en: "Update Item", ch: "更新物品" },
  importFromClipboard: { en: "Import from Clipboard", ch: "从剪贴板导入" },
  itemLevel: { en: "Item Level", ch: "物品等级" },
  rarity: { en: "Rarity", ch: "稀有度" },
  quality: { en: "Quality", ch: "品质" },
  stackSize: { en: "Stack Size", ch: "堆叠数量" },
  gemLevel: { en: "Gem Level", ch: "宝石等级" },
  mapTier: { en: "Map Tier", ch: "地图阶级" },
  sockets: { en: "Sockets (e.g. R G B)", ch: "插槽 (例: R G B)" },
  linkedSockets: { en: "Linked Sockets", ch: "连接插槽" },
  identified: { en: "Identified", ch: "已鉴定" },
  corrupted: { en: "Corrupted", ch: "已污染" },
  mirrored: { en: "Mirrored", ch: "已镜像" },
  fractured: { en: "Fractured", ch: "破碎" },
  synthesised: { en: "Synthesised", ch: "忆境" },
  shaper: { en: "Shaper", ch: "塑界者" },
  elder: { en: "Elder", ch: "裂界者" },
  crusader: { en: "Crusader", ch: "圣战者" },
  hunter: { en: "Hunter", ch: "狩猎者" },
  redeemer: { en: "Redeemer", ch: "救赎者" },
  warlord: { en: "Warlord", ch: "总督军" },
  scourged: { en: "Scourged", ch: "腐化扭曲" },
  replica: { en: "Replica", ch: "仿品" },
  imbued: { en: "Imbued", ch: "灌注" },
  transfigured: { en: "Transfigured", ch: "改造" },
  blightedMap: { en: "Blighted Map", ch: "菌潮地图" },
  blightRavagedMap: { en: "Blight-ravaged Map", ch: "菌潮灭绝地图" },
  shapedMap: { en: "Shaped Map", ch: "塑界地图" },
  elderMap: { en: "Elder Map", ch: "裂界地图" },
  zanasMemory: { en: "Zana's Memory", ch: "扎娜的记忆" },
  memoryStrands: { en: "Memory Strands", ch: "记忆丝线" },
  socketGroup: { en: "Socket Group", ch: "插槽组合" },
  width: { en: "Width", ch: "宽度" },
  height: { en: "Height", ch: "高度" },
  import: { en: "Import", ch: "导入" },
  importPlaceholder: { en: "Copy item info from game (Ctrl+C) and paste here...", ch: "从游戏复制物品信息 (Ctrl+C) 然后粘贴到这里..." },
  // Theme editor
  themeEditorTitle: { en: "Theme Editor", ch: "外观预设编辑器" },
  baseThemeLabel: { en: "Base Theme:", ch: "基础主题:" },
  applyBase: { en: "Apply Base", ch: "应用基础" },
  unsavedOverrides: { en: "Unsaved Overrides", ch: "未保存的修改" },
  saveOverrides: { en: "Save Overrides", ch: "保存覆盖" },
  baseThemeApplied: { en: "Base Theme Applied!", ch: "基础主题已应用！" },
  overridesSaved: { en: "Saved!", ch: "已保存！" },
  globalTemplates: { en: "★ Global Templates", ch: "★ 全局模板" },
  bulkEditImport: { en: "Bulk Edit / Import", ch: "批量编辑 / 导入" },
  editingLabel: { en: "Editing", ch: "编辑" },
  importSeriesFromTheme: { en: "Import Series from Theme...", ch: "从其他主题导入系列..." },
  importStyleSeries: { en: "Import Style Series", ch: "导入样式系列" },
  sourceTheme: { en: "Source Theme", ch: "来源主题" },
  sourceCategory: { en: "Source Category", ch: "来源分类" },
  selectThemeOption: { en: "-- Select Theme --", ch: "-- 选择主题 --" },
  selectSourceTheme: { en: "Select a source theme", ch: "请选择来源主题" },
  confirmImport: { en: "Confirm Import", ch: "确认应用" },
  currentLabel: { en: "Current", ch: "当前" },
  newLabel: { en: "New", ch: "新" },
  // Theme hue generator
  hueGenOpen: { en: "Hue Generator", ch: "色调生成器" },
  hueGenTitle: { en: "Generate Styles from Hue", ch: "从色调生成样式" },
  hueGenHueA: { en: "Accent Hue A", ch: "主色调 A" },
  hueGenHueB: { en: "Accent Hue B", ch: "主色调 B" },
  hueGenUseSecondHue: { en: "Use a second hue", ch: "使用第二色调" },
  hueGenBalance: { en: "Balance (A ↔ B)", ch: "配比 (A ↔ B)" },
  hueGenGradient: { en: "Smooth gradient", ch: "平滑渐变" },
  hueGenGamma: { en: "Gradient curve (γ)", ch: "渐变曲线 (γ)" },
  hueGenCurveSoft: { en: "soft", ch: "柔和" },
  hueGenCurveSharp: { en: "sharp", ch: "锐利" },
  hueGenApply: { en: "Apply Selection", ch: "应用所选样式" },
  hueGenHint: { en: "Click a column header to use a whole series, or click individual cells to mix and match per tier.", ch: "点击列标题应用整个系列，或点击单元格按阶级自由混搭。" },
  hueGenSaveAsPreset: { en: "Save as Preset", ch: "另存为预设" },
  hueGenPresetName: { en: "Preset Name", ch: "预设名称" },
  hueGenSavePresetDesc: { en: "Saves the current base theme with all your edits baked in as a new preset. Untouched categories are copied from the base theme.", ch: "将当前基础主题连同你的所有修改保存为一个新预设。未修改的分类将从基础主题复制。" },
  hueGenSwitchConfirm: { en: "Preset saved! Switch your base theme to it and clear the override layer? (The result looks identical — your edits for ALL categories get baked into the preset and the override layer is emptied.)", ch: "预设已保存！要把基础主题切换为该预设并清空覆盖层吗？（显示效果完全一致——所有分类的修改都已合入新预设，覆盖层将被清空。）" },
  hueGenPresetSaved: { en: "Preset saved", ch: "预设已保存" },
  black: { en: "Black", ch: "黑" },
  white: { en: "White", ch: "白" },
  grey: { en: "Grey", ch: "灰" },
  // Style-property labels
  minimapIcon: { en: "Minimap Icon", ch: "小地图图标" },
  dropEffect: { en: "Drop Effect", ch: "掉落光效" },
  TextColor: { en: "Text Color", ch: "文本颜色" },
  BackgroundColor: { en: "Background Color", ch: "背景颜色" },
  BorderColor: { en: "Border Color", ch: "边框颜色" },
  importForeign: { en: "Import Filter", ch: "导入过滤器" },
  Campaign: { en: "Campaign", ch: "剧情模式" },  // en derived from the key — review wording
  Chancing: { en: "Chancing", ch: "机会底材" },  // en derived from the key — review wording
  Legacy: { en: "Legacy", ch: "旧版" },  // en derived from the key — review wording
  "Vendor Recipes": { en: "Vendor Recipes", ch: "商店配方" },  // en derived from the key — review wording
  Templates: { en: "Templates", ch: "模板" },  // en derived from the key — review wording
  Normal: { en: "Normal", ch: "普通" },  // en derived from the key — review wording
  Magic: { en: "Magic", ch: "魔法" },  // en derived from the key — review wording
  Rare: { en: "Rare", ch: "稀有" },  // en derived from the key — review wording
  Unique: { en: "Unique", ch: "传奇" },  // en derived from the key — review wording
  Axe_and_Sword_Damage: { en: "Axe and Sword Damage", ch: "斧/剑伤害" },  // en derived from the key — review wording
  Mace_and_Staff_Damage: { en: "Mace and Staff Damage", ch: "锤/杖伤害" },  // en derived from the key — review wording
  Dagger_and_Claw_Damage: { en: "Dagger and Claw Damage", ch: "匕首/爪伤害" },  // en derived from the key — review wording
  Bow_Damage: { en: "Bow Damage", ch: "弓伤害" },  // en derived from the key — review wording
  Wand_Damage: { en: "Wand Damage", ch: "法杖伤害" },  // en derived from the key — review wording
  Damage_with_Two_Handed_Weapons: { en: "Damage with Two Handed Weapons", ch: "双手武器伤害" },  // en derived from the key — review wording
  Attack_Damage_while_Dual_Wielding: { en: "Attack Damage while Dual Wielding", ch: "双持攻击伤害" },  // en derived from the key — review wording
  Attack_Damage_while_holding_a_Shield: { en: "Attack Damage while holding a Shield", ch: "持盾攻击伤害" },  // en derived from the key — review wording
  Attack_Damage: { en: "Attack Damage", ch: "攻击伤害" },  // en derived from the key — review wording
  Spell_Damage: { en: "Spell Damage", ch: "法术伤害" },  // en derived from the key — review wording
  Elemental_Damage: { en: "Elemental Damage", ch: "元素伤害" },  // en derived from the key — review wording
  Physical_Damage: { en: "Physical Damage", ch: "物理伤害" },  // en derived from the key — review wording
  Fire_Damage: { en: "Fire Damage", ch: "火焰伤害" },  // en derived from the key — review wording
  Lightning_Damage: { en: "Lightning Damage", ch: "闪电伤害" },  // en derived from the key — review wording
  Cold_Damage: { en: "Cold Damage", ch: "冰霜伤害" },  // en derived from the key — review wording
  Chaos_Damage: { en: "Chaos Damage", ch: "混沌伤害" },  // en derived from the key — review wording
  Minion_Damage: { en: "Minion Damage", ch: "召唤生物伤害" },  // en derived from the key — review wording
  Fire_Damage_over_Time: { en: "Fire Damage over Time", ch: "火焰持续伤害" },  // en derived from the key — review wording
  Chaos_Damage_over_Time: { en: "Chaos Damage over Time", ch: "混沌持续伤害" },  // en derived from the key — review wording
  Physical_Damage_over_Time: { en: "Physical Damage over Time", ch: "物理持续伤害" },  // en derived from the key — review wording
  Cold_Damage_over_Time: { en: "Cold Damage over Time", ch: "冰霜持续伤害" },  // en derived from the key — review wording
  Damage_over_Time: { en: "Damage over Time", ch: "持续伤害" },  // en derived from the key — review wording
  Effect_of_Non_Damaging_Ailments: { en: "Effect of Non Damaging Ailments", ch: "非伤害异常状态效果" },  // en derived from the key — review wording
  Damage_while_you_have_a_Herald: { en: "Damage while you have a Herald", ch: "捷技能影响时伤害" },  // en derived from the key — review wording
  Minion_Damage_while_you_have_a_Herald: { en: "Minion Damage while you have a Herald", ch: "捷技能影响时召唤生物伤害" },  // en derived from the key — review wording
  Exerted_Attack_Damage: { en: "Exerted Attack Damage", ch: "助威攻击伤害" },  // en derived from the key — review wording
  Critical_Chance: { en: "Critical Chance", ch: "暴击率" },  // en derived from the key — review wording
  Minion_life: { en: "Minion life", ch: "召唤生物生命" },  // en derived from the key — review wording
  Area_Damage: { en: "Area Damage", ch: "范围伤害" },  // en derived from the key — review wording
  Projectile_Damage: { en: "Projectile Damage", ch: "投射物伤害" },  // en derived from the key — review wording
  Trap_and_Mine_Damage: { en: "Trap and Mine Damage", ch: "陷阱/地雷伤害" },  // en derived from the key — review wording
  Totem_Damage: { en: "Totem Damage", ch: "图腾伤害" },  // en derived from the key — review wording
  Brand_Damage: { en: "Brand Damage", ch: "烙印伤害" },  // en derived from the key — review wording
  Channelling_Skill_Damage: { en: "Channelling Skill Damage", ch: "吟唱技能伤害" },  // en derived from the key — review wording
  Flask_Duration: { en: "Flask Duration", ch: "药剂持续时间" },  // en derived from the key — review wording
  Life_and_Mana_recovery_from_Flasks: { en: "Life and Mana recovery from Flasks", ch: "药剂生命/魔力回复" },  // en derived from the key — review wording
  Aura_effect: { en: "Aura effect", ch: "光环效果" },  // en derived from the key — review wording
  Curse_effect: { en: "Curse effect", ch: "诅咒效果" },  // en derived from the key — review wording
  Life: { en: "Life", ch: "生命" },  // en derived from the key — review wording
  Energy_Shield_Not: { en: "Energy Shield Not", ch: "能量护盾" },  // en derived from the key — review wording
  Mana: { en: "Mana", ch: "魔力" },  // en derived from the key — review wording
  Armour_Not: { en: "Armour Not", ch: "护甲" },  // en derived from the key — review wording
  Evasion_Not: { en: "Evasion Not", ch: "闪避" },  // en derived from the key — review wording
  Chance_to_Block_Attack_Damage: { en: "Chance to Block Attack Damage", ch: "攻击格挡几率" },  // en derived from the key — review wording
  Chance_to_Block_Spell_Damage: { en: "Chance to Block Spell Damage", ch: "法术格挡几率" },  // en derived from the key — review wording
  Fire_Resistance: { en: "Fire Resistance", ch: "火焰抗性" },  // en derived from the key — review wording
  Cold_Resistance: { en: "Cold Resistance", ch: "冰霜抗性" },  // en derived from the key — review wording
  Lightning_Resistance: { en: "Lightning Resistance", ch: "闪电抗性" },  // en derived from the key — review wording
  Chaos_Resistance: { en: "Chaos Resistance", ch: "混沌抗性" },  // en derived from the key — review wording
  Chance_to_Suppress_Spell_Damage: { en: "Chance to Suppress Spell Damage", ch: "法术压制几率" },  // en derived from the key — review wording
  Reservation_Efficiency: { en: "Reservation Efficiency", ch: "保留效能" },  // en derived from the key — review wording

  // ── Keys that existed only as inline strings in components ──────────────────
  // The ch wording below was already written by the author inside a
  // `language === 'ch' ? … : …` ternary; moving it here is relocation, not new
  // translation. Anything with NO ch line is awaiting the author — it renders the
  // English via the fallback chain, which is what the component did before anyway.
  recommendedForCategory: { en: "Recommended", ch: "推荐 (本类别)" },
  allOthers: { en: "All others", ch: "其他全部" },
  rarityAnyOf: { en: "is one of" },
  rarityCompare: { en: "compare" },
  // The item-card style editor and the card sound badge referenced these keys, but
  // none had ever been defined — so each rendered its own identifier ("cardStyleTitle",
  // "fromCard") on screen in both languages. The en wording below is lifted from the
  // dead `|| '…'` fallback that sat at each call site.
  cardStyleTitle: { en: "Card style" },
  cardInherit: { en: "from block" },
  cardInheritHint: { en: "Unset — inherits the block" },
  cardClearChannel: { en: "Back to the block" },
  fromCard: { en: "From Card Override" },
  rawTextPlaceholder: { en: "Generated filter content will appear here..." },
  saveFailed: { en: "Save failed" },
  selectCategory: { en: "Select a category from the sidebar to edit" },
  priority: { en: "Priority", ch: "优先级" },

  // ── Relocated from inline `language === 'ch' ? … : …` ternaries ────────────
  // Both sides were already written in the components; this only moves them so a
  // third locale is a new field here rather than a new branch at 35 call sites.
  brush: { en: "Brush:", ch: "笔刷：" },
  brushOffDragAndDrop: { en: "Brush off — drag and drop", ch: "关闭笔刷，恢复拖拽" },
  off: { en: "Off", ch: "关闭" },
  removeFromThisLadder: { en: "Remove from this ladder", ch: "移出本类阶级" },
  clickItemsToPaintMemberships: { en: "Click items to paint. Memberships in other files are kept.", ch: "点击物品即可刷入该阶级（其他文件的归属会保留）" },
  showAllClasses: { en: "Show All Classes", ch: "显示全物品类" },
  filterTiered: { en: "Filter Tiered...", ch: "筛选已分类项..." },
  previewHowStateDecoratorsCompose: { en: "Preview how state decorators compose over this tier", ch: "预览状态叠加效果" },
  rankBases: { en: "Rank bases", ch: "刷入底材" },
  showAll2: { en: "Show all", ch: "展开列表" },
  clickToSelectBaseType: { en: "Click to select base type", ch: "点击选择底材" },
  clipboardEmpty: { en: "Clipboard Empty", ch: "剪贴板为空" },
  showFull: { en: "Show Full", ch: "显示完整" },
  focusRule: { en: "Focus Rule", ch: "聚焦规则" },
  noDataComment: { en: "# No data", ch: "# 暂无数据" },
  rulePresets: { en: "Rule Presets", ch: "规则预设" },
  suggestions: { en: "Suggestions", ch: "常用建议" },
  library: { en: "Library", ch: "全量规则库" },
  noneDash: { en: "—", ch: "无" },
  less: { en: "less", ch: "收起" },
  applyToAllItemsIn: { en: "Apply to all items in this Tier", ch: "应用至此阶级的所有物品" },
  soundBulkEditor: { en: "Sound Bulk Editor", ch: "音效批量编辑器" },
  itemPool: { en: "Item Pool", ch: "物品池" },
  clickOrDragSoundCards: { en: "Click or drag sound cards from the right to start", ch: "从右侧点击或拖入音效卡片以开始" },
  enterPath2: { en: "Enter path...", ch: "输入路径..." },
  dropItemsHere: { en: "Drop items here", ch: "将物品拖放到此处" },
  defaultFallback: { en: "Default (fallback)", ch: "默认 (后备样式)" },
  searchCategories: { en: "Search categories…", ch: "搜索分类…" },
  searchCategories2: { en: "Search categories", ch: "搜索分类" },
  noCategoriesMatch: { en: "No categories match", ch: "没有匹配的分类" },
  dragToResizeDoubleClick: { en: "Drag to resize (double-click to reset)", ch: "拖动调整宽度（双击重置）" },
  conditionalItems: { en: "Conditional Items", ch: "条件物品 (规则)" },
  removeSoundSilencesThisTier: { en: "Remove sound: silences this tier outright — it will not fall back to its default", ch: "移除音效：该阶级将完全静音，不会回退到默认音效" },
  removeSound: { en: "Remove sound", ch: "移除音效" },
  other: { en: "Other", ch: "其他" },

  // ── Relocated from inline `language === 'ch' ? … : …` ternaries ────────────
  // Both sides were already written in the components; this only moves them so a
  // third locale is a new field here rather than a new branch at 14 call sites.
  resetAllChangesToDefault: { en: "Reset all changes to default? This cannot be undone.", ch: "将所有更改重置为默认？此操作无法撤销。" },
  resetAllChanges: { en: "Reset All Changes", ch: "重置所有更改" },
  partialModEnchantConditionsNot: { en: "partial — mod/enchant conditions not simulated", ch: "含未模拟条件 (词缀/附魔)" },
  themeSoundManagement: { en: "Theme & Sound Management", ch: "外观与音效管理" },
  manageGlobalThemePresetsSound: { en: "Manage global theme presets, sound mappings, and auto-sound logic here.", ch: "在此管理全局外观预设、音效映射以及自动音效逻辑。" },
  soundManagement: { en: "Sound Management", ch: "音效管理" },
  bulkEditItemSoundMappings: { en: "Bulk edit item sound mappings using a Kanban-style interface.", ch: "使用看板方式批量编辑物品的音效映射。" },
  openSoundBulkEditor: { en: "Open Sound Bulk Editor", ch: "打开音效批量编辑器" },
  themePresets: { en: "Theme Presets", ch: "外观预设" },
  viewAndSwitchGlobalTheme: { en: "View and switch global theme templates (e.g. Sharket, Tytykiller).", ch: "查看和切换全局外观模板 (如: Sharket, Tytykiller)。" },
  openThemeEditor: { en: "Open Theme Editor", ch: "打开外观预设编辑器" },
  stateDecorators: { en: "State Decorators", ch: "状态叠加" },
  corruptedFracturedAndFriendsAuthored: { en: "Corrupted, fractured and friends — authored once, layered over every look.", ch: "腐化、破碎等状态各写一次，叠加在所有外观之上。" },
  openDecoratorEditor: { en: "Open Decorator Editor", ch: "打开状态叠加编辑器" },
  thatStateAlreadyExists: { en: "That state already exists", ch: "该状态已存在" },
  saved: { en: "Saved", ch: "已保存" },
  saveFailed2: { en: "Save failed: ", ch: "保存失败: " },
  addState: { en: "+ Add state", ch: "+ 添加状态" },
  saving: { en: "Saving…", ch: "保存中…" },
  close: { en: "Close", ch: "关闭" },
  aStateSetsOneChannel: { en: "A state sets one channel and then Continues, so it layers over any look — as long as that look leaves the same channel unset.", ch: "一个状态只设置一个通道，然后 Continue，因此它会叠加在任何外观之上——只要那个外观没有设置同一个通道。" },
  noStateDecoratorsYetAdd: { en: "No state decorators yet. \"Add state\" to begin.", ch: "还没有状态叠加。点击“添加状态”开始。" },
  sampleItem: { en: "Sample Item", ch: "示例物品" },
  remove: { en: "Remove", ch: "删除" },
  decoratorsDefinedElsewhereReadOnly: { en: "Decorators defined elsewhere (read-only):", ch: "其他文件中的叠加（只读）：" },
  applySoundToWhichOccurrences: { en: "Apply sound to which occurrences", ch: "选择要应用音效的位置" },
  removeSoundFromWhichOccurrences: { en: "Remove sound from which occurrences", ch: "选择要移除音效的位置" },
  sound2: { en: "sound", ch: "音效" },
  thisBasetypeExistsInSeveral: { en: "This basetype exists in several category files. Tick the ones to change independently.", ch: "该底材存在于多个分类文件中，请勾选要单独处理的文件。" },
  deselectAll: { en: "Deselect all", ch: "全不选" },
  none2: { en: "none", ch: "无" },
  noOccurrencesToChange: { en: "No occurrences to change", ch: "没有可处理的位置" },
  confirm: { en: "Confirm", ch: "确认" },
  applicableRulesCategories: { en: "Applicable Rules / Categories", ch: "适用的规则 / 分类" },
  thisBasetypeAppearsInThe: { en: "This basetype appears in the files below. Pick one to view or edit its rules & styles:", ch: "该底材出现在以下分类文件中，选择一个查看或编辑其规则与样式：" },
  editRulesStyles: { en: "Edit rules & styles", ch: "编辑规则与样式" },
  noCategoriesToShow: { en: "No categories to show", ch: "没有可显示的分类" },
  multipleRulesApply: { en: "Multiple Rules Apply", ch: "多条规则生效" },
  thisDropIsAffectedBy: { en: "This drop is affected by rules in more than one file. Pick one to edit:", ch: "该掉落物受多个分类文件的规则影响，选择要编辑的一个：" },
  active2: { en: "ACTIVE", ch: "当前生效" },
  baseMapping: { en: "Base Mapping", ch: "底材映射" },
  customRule: { en: "Custom Rule", ch: "自定义规则" },
  failedToSave: { en: "Failed to save", ch: "保存失败" },
  rulesStyles: { en: "Rules & Styles", ch: "规则与样式" },
  loading2: { en: "Loading…", ch: "加载中…" },
  openInFullEditor: { en: "Open in full Editor", ch: "在完整编辑器中打开" },
  welcomeToSharketPoeFilter: { en: "Welcome to Sharket POE Filter!", ch: "欢迎使用 Sharket POE 过滤编辑器！" },
  aFreeBrowserBasedLoot: { en: "A free, browser-based loot-filter editor for Path of Exile — no account needed, everything you change is saved in your browser automatically.", ch: "一款免费的浏览器端《流放之路》掉落过滤器编辑工具 —— 无需注册，所有修改自动保存在你的浏览器中。" },
  openTheUserManual: { en: "Open the User Manual", ch: "查看用户手册" },
  jumpRightIn: { en: "Jump right in →", ch: "直接开始 →" },
  youCanReopenTheManual: { en: "You can reopen the manual anytime via the 📖 button in the top bar.", ch: "之后可随时通过右上角的 📖 按钮打开手册。" },
} as const;

/** Official GGPK item-class names. Replaces the old ch-only `CLASS_CH`. */
export const ITEM_CLASS_LABELS: Record<string, Localized> = {
  All: { en: "All", ch: "全部" },
  "Life Flasks": { en: "Life Flasks", ch: "生命药剂" },
  "Mana Flasks": { en: "Mana Flasks", ch: "魔力药剂" },
  "Hybrid Flasks": { en: "Hybrid Flasks", ch: "复合药剂" },
  Currency: { en: "Currency", ch: "通货" },
  Amulets: { en: "Amulets", ch: "项链" },
  Rings: { en: "Rings", ch: "戒指" },
  Claws: { en: "Claws", ch: "爪" },
  Daggers: { en: "Daggers", ch: "匕首" },
  Wands: { en: "Wands", ch: "法杖" },
  "One Hand Swords": { en: "One Hand Swords", ch: "单手剑" },
  "Thrusting One Hand Swords": { en: "Thrusting One Hand Swords", ch: "细剑" },
  "One Hand Axes": { en: "One Hand Axes", ch: "单手斧" },
  "One Hand Maces": { en: "One Hand Maces", ch: "单手锤" },
  Bows: { en: "Bows", ch: "弓" },
  Staves: { en: "Staves", ch: "长杖" },
  "Two Hand Swords": { en: "Two Hand Swords", ch: "双手剑" },
  "Two Hand Axes": { en: "Two Hand Axes", ch: "双手斧" },
  "Two Hand Maces": { en: "Two Hand Maces", ch: "双手锤" },
  "Skill Gems": { en: "Skill Gems", ch: "技能宝石" },
  "Support Gems": { en: "Support Gems", ch: "辅助宝石" },
  Quivers: { en: "Quivers", ch: "箭袋" },
  Belts: { en: "Belts", ch: "腰带" },
  Gloves: { en: "Gloves", ch: "手套" },
  Boots: { en: "Boots", ch: "鞋子" },
  "Body Armours": { en: "Body Armours", ch: "胸甲" },
  Helmets: { en: "Helmets", ch: "头部" },
  Shields: { en: "Shields", ch: "盾牌" },
  "Small Relics": { en: "Small Relics", ch: "小型圣物" },
  "Medium Relics": { en: "Medium Relics", ch: "中型圣物" },
  "Large Relics": { en: "Large Relics", ch: "大型圣物" },
  "Stackable Currency": { en: "Stackable Currency", ch: "可堆叠通货" },
  "Quest Items": { en: "Quest Items", ch: "任务物品" },
  Sceptres: { en: "Sceptres", ch: "短杖" },
  "Utility Flasks": { en: "Utility Flasks", ch: "功能药剂" },
  "Critical Utility Flasks": { en: "Critical Utility Flasks", ch: "暴击药剂" },
  Maps: { en: "Maps", ch: "异界地图" },
  "Fishing Rods": { en: "Fishing Rods", ch: "鱼竿" },
  "Map Fragments": { en: "Map Fragments", ch: "地图碎片" },
  "Hideout Doodads": { en: "Hideout Doodads", ch: "藏身处装饰" },
  Microtransactions: { en: "Microtransactions", ch: "商城物品" },
  Jewels: { en: "Jewels", ch: "珠宝" },
  "Divination Cards": { en: "Divination Cards", ch: "命运卡" },
  "Labyrinth Items": { en: "Labyrinth Items", ch: "迷宫物品" },
  "Labyrinth Trinkets": { en: "Labyrinth Trinkets", ch: "迷宫饰品" },
  "Labyrinth Map Items": { en: "Labyrinth Map Items", ch: "迷宫地图" },
  "Misc Map Items": { en: "Misc Map Items", ch: "裂隙之石" },
  Leaguestones: { en: "Leaguestones", ch: "赛季石" },
  "Pantheon Souls": { en: "Pantheon Souls", ch: "万神殿之魂" },
  Pieces: { en: "Pieces", ch: "片段" },
  "Abyss Jewels": { en: "Abyss Jewels", ch: "深渊珠宝" },
  "Incursion Items": { en: "Incursion Items", ch: "穿越物品" },
  "Delve Socketable Currency": { en: "Delve Socketable Currency", ch: "地心探索：可镶嵌的通货" },
  Incubators: { en: "Incubators", ch: "孕育石" },
  Shards: { en: "Shards", ch: "碎片" },
  "Shard Hearts": { en: "Shard Hearts", ch: "破碎之心" },
  "Rune Daggers": { en: "Rune Daggers", ch: "符文匕首" },
  Warstaves: { en: "Warstaves", ch: "战杖" },
  "Delve Stackable Socketable Currency": { en: "Delve Stackable Socketable Currency", ch: "地心探索可堆叠可插入通货" },
  "Atlas Upgrade Items": { en: "Atlas Upgrade Items", ch: "异界升级物品" },
  "Metamorph Samples": { en: "Metamorph Samples", ch: "灾变样本" },
  "Hidden Items": { en: "Hidden Items", ch: "隐藏物品" },
  Contracts: { en: "Contracts", ch: "契约" },
  "Heist Gear": { en: "Heist Gear", ch: "赏金猎人装备" },
  "Heist Tools": { en: "Heist Tools", ch: "赏金猎人工具" },
  "Heist Cloaks": { en: "Heist Cloaks", ch: "赏金猎人披风" },
  "Heist Brooches": { en: "Heist Brooches", ch: "赏金猎人胸针" },
  Blueprints: { en: "Blueprints", ch: "蓝图" },
  Trinkets: { en: "Trinkets", ch: "饰品" },
  "Heist Targets": { en: "Heist Targets", ch: "赏金目标" },
  "Expedition Logbooks": { en: "Expedition Logbooks", ch: "先祖秘藏日志" },
  "Archnemesis Mods": { en: "Archnemesis Mods", ch: "罪恶枷锁词缀" },
  "Instance Local Items": { en: "Instance Local Items", ch: "副本本地物品" },
  Sentinels: { en: "Sentinels", ch: "近卫" },
  Memories: { en: "Memories", ch: "回忆" },
  Relics: { en: "Relics", ch: "遗物" },
  "Sanctified Relics": { en: "Sanctified Relics", ch: "圣洁遗物" },
  Breachstones: { en: "Breachstones", ch: "裂隙石" },
  "Vault Keys": { en: "Vault Keys", ch: "宝库钥匙" },
  "Sanctum Research": { en: "Sanctum Research", ch: "禁域研究" },
  Tinctures: { en: "Tinctures", ch: "酊剂" },
  Corpses: { en: "Corpses", ch: "灵柩" },
  Charms: { en: "Charms", ch: "咒符" },
  "Embers of the Allflame": { en: "Embers of the Allflame", ch: "不灭余烬" },
  Gold: { en: "Gold", ch: "金币" },
  Idols: { en: "Idols", ch: "雕像" },
  Wombgifts: { en: "Wombgifts", ch: "孕育赠礼" },
  "Sentinel Drones": { en: "Sentinel Drones", ch: "哨兵无人机" },
  // 3.29 classes we had no label for. Both names come from the official Simplified
  // Chinese GGPK dump, joined to English on `Id` (ADR-0004) — not hand-written.
  Chart: { en: "Chart", ch: "海图" },
  "Enshrouded Items": { en: "Enshrouded Items", ch: "雾隐物品" },
};

/** FilterBlade bonus-info hover tags. Replaces the old ch-only `BONUS_TAG_CH`. */
export const BONUS_TAG_LABELS: Record<string, Localized> = {
  Generic: { en: "Generic", ch: "通用" },
  LeagueDrop: { en: "LeagueDrop", ch: "赛季机制掉落" },
  BossDrop: { en: "BossDrop", ch: "首领掉落" },
  NonDrop: { en: "NonDrop", ch: "特殊获取-非掉落" },
  Heist: { en: "Heist", ch: "夺宝奇兵" },
  Beyond: { en: "Beyond", ch: "超越" },
  Harvest: { en: "Harvest", ch: "古灵庄园" },
  Lab: { en: "Lab", ch: "迷宫" },
  Eldritch: { en: "Eldritch", ch: "古灵" },
  Catalyst: { en: "Catalyst", ch: "催化剂" },
  Expedition: { en: "Expedition", ch: "先祖秘藏" },
  Blight: { en: "Blight", ch: "菌潮" },
  Ancestors: { en: "Ancestors", ch: "先祖" },
  Meme: { en: "Meme", ch: "趣味(恶搞产品)" },
  RuthlessOnly: { en: "RuthlessOnly", ch: "仅无情模式" },
  GemOutcome: { en: "GemOutcome", ch: "宝石产出" },
  CurrencyOutcome: { en: "CurrencyOutcome", ch: "通货产出" },
  UniqueOutcome: { en: "UniqueOutcome", ch: "传奇产出" },
  SixLinkOutcome: { en: "SixLinkOutcome", ch: "六连产出" },
  MapOutcome: { en: "MapOutcome", ch: "地图产出" },
  InfluencedOutcome: { en: "InfluencedOutcome", ch: "势力产出" },
};

/** FilterBlade bonus-info hint sentences. Replaces the old ch-only `BONUS_HINT_CH`. */
export const BONUS_HINT_LABELS: Record<string, Localized> = {
  "(enjoy your bramblejack)!": { en: "(enjoy your bramblejack)!", ch: "（祝你开出“荆棘甲”！）" },
  "Can grant special maps, if ItemLevel is 81 or higher.": { en: "Can grant special maps, if ItemLevel is 81 or higher.", ch: "物品等级 81 或以上时可能给予特殊地图。" },
  "Can rarely award unique talismans!": { en: "Can rarely award unique talismans!", ch: "有小概率给予传奇魔符！" },
  "Chests that are broken out have a chance for the chests rewards to be applied to the monsters it breaks out, while also making those monsters more difficult and rewarding": { en: "Chests that are broken out have a chance for the chests rewards to be applied to the monsters it breaks out, while also making those monsters more difficult and rewarding", ch: "被破出的宝箱有几率将其奖励转移至破出的怪物身上，同时使这些怪物更强大、奖励更丰厚" },
  "Divine Font grants 6 additional uses": { en: "Divine Font grants 6 additional uses", ch: "神圣之泉可额外使用 6 次" },
  "Does not drop.": { en: "Does not drop.", ch: "不会直接掉落。" },
  "Drops at the end of upgraded Trial of Ascendancy": { en: "Drops at the end of upgraded Trial of Ascendancy", ch: "在升级的飞升试炼结尾掉落" },
  "Drops from Al-Hezmin, The Hunter": { en: "Drops from Al-Hezmin, The Hunter", ch: "由「猎人」艾尔赫兹明掉落" },
  "Drops from Baran, The Crusader": { en: "Drops from Baran, The Crusader", ch: "由「圣战者」巴兰掉落" },
  "Drops from Blueprints": { en: "Drops from Blueprints", ch: "由蓝图掉落" },
  "Drops from Catarina": { en: "Drops from Catarina", ch: "由卡塔莉娜掉落" },
  "Drops from Domain of Timeless Conflict": { en: "Drops from Domain of Timeless Conflict", ch: "掉落于永恒争战之域" },
  "Drops from Drox, The warlord": { en: "Drops from Drox, The warlord", ch: "由「督军」卓克斯掉落" },
  "Drops from Maven or in Maven's Crucible": { en: "Drops from Maven or in Maven's Crucible", ch: "由贤主掉落，或在贤主的试炼场中获得" },
  "Drops from Nightmare Map bosses": { en: "Drops from Nightmare Map bosses", ch: "由梦魇地图首领掉落" },
  "Drops from Safehouse Leaders": { en: "Drops from Safehouse Leaders", ch: "由安全屋首领掉落" },
  "Drops from Safehouse leaders in Safehouses": { en: "Drops from Safehouse leaders in Safehouses", ch: "由安全屋中的首领掉落" },
  "Drops from Sirus": { en: "Drops from Sirus", ch: "由希鲁斯掉落" },
  "Drops from Sirus, Shaper and Elder": { en: "Drops from Sirus, Shaper and Elder", ch: "由希鲁斯、塑界者和裂界者掉落" },
  "Drops from The Elder or Uber Elder": { en: "Drops from The Elder or Uber Elder", ch: "由裂界者或终极裂界者掉落" },
  "Drops from The Shaper or Uber Elder": { en: "Drops from The Shaper or Uber Elder", ch: "由塑界者或终极裂界者掉落" },
  "Drops from Veritania, The Redeemer": { en: "Drops from Veritania, The Redeemer", ch: "由「救赎者」维利塔尼亚掉落" },
  "Drops from the Incarnation of Dread": { en: "Drops from the Incarnation of Dread", ch: "由恐惧之化身掉落" },
  "Drops from the Incarnation of Fear": { en: "Drops from the Incarnation of Fear", ch: "由惊惧之化身掉落" },
  "Drops from the Incarnation of Neglect": { en: "Drops from the Incarnation of Neglect", ch: "由漠视之化身掉落" },
  "Four socket Resonator reforging a rare item using Fossils": { en: "Four socket Resonator reforging a rare item using Fossils", ch: "四插槽共鸣器，使用化石重铸稀有物品" },
  "Fragment for the Atziri, Queen of the Vaal fight": { en: "Fragment for the Atziri, Queen of the Vaal fight", ch: "用于挑战瓦尔女王阿兹里的碎片" },
  "Fragment for the Uber Atziri, Queen of the Vaal fight": { en: "Fragment for the Uber Atziri, Queen of the Vaal fight", ch: "用于挑战终极瓦尔女王阿兹里的碎片" },
  "Fragment for the Uber Cortex fight": { en: "Fragment for the Uber Cortex fight", ch: "用于挑战终极脑域的碎片" },
  "Fragment for the Uber Eater fight": { en: "Fragment for the Uber Eater fight", ch: "用于挑战终极灭界者的碎片" },
  "Fragment for the Uber Exarch fight": { en: "Fragment for the Uber Exarch fight", ch: "用于挑战终极焚界者的碎片" },
  "Fragment for the Uber Incarnation of Dread fight": { en: "Fragment for the Uber Incarnation of Dread fight", ch: "用于挑战终极恐惧之化身的碎片" },
  "Fragment for the Uber Incarnation of Fear fight": { en: "Fragment for the Uber Incarnation of Fear fight", ch: "用于挑战终极惊惧之化身的碎片" },
  "Fragment for the Uber Incarnation of Neglect fight": { en: "Fragment for the Uber Incarnation of Neglect fight", ch: "用于挑战终极漠视之化身的碎片" },
  "Fragment for the Uber Maven fight": { en: "Fragment for the Uber Maven fight", ch: "用于挑战终极贤主的碎片" },
  "Fragment for the Uber Shaper fight": { en: "Fragment for the Uber Shaper fight", ch: "用于挑战终极塑界者的碎片" },
  "Fragment for the Uber Sirus fight": { en: "Fragment for the Uber Sirus fight", ch: "用于挑战终极希鲁斯的碎片" },
  "Fragment for the Uber Uber Elder fight": { en: "Fragment for the Uber Uber Elder fight", ch: "用于挑战终极版终极裂界者的碎片" },
  "If used alongside a map adds a Vaal Side Area and Item Quantity bonus": { en: "If used alongside a map adds a Vaal Side Area and Item Quantity bonus", ch: "与地图一同使用时，添加一个瓦尔副区域并提供物品掉落数量加成" },
  "Itemlevel 81+ incubators can rarely grant other fragments!": { en: "Itemlevel 81+ incubators can rarely grant other fragments!", ch: "物品等级 81+ 的孵化器有小概率给予其他碎片！" },
  "Opens The Eternal Labyrinth of Fortune": { en: "Opens The Eternal Labyrinth of Fortune", ch: "开启「财富的永恒迷宫」" },
  "Opens The Eternal Labyrinth of Opportunity": { en: "Opens The Eternal Labyrinth of Opportunity", ch: "开启「机遇的永恒迷宫」" },
  "Opens the Domain of Timeless conflict when two or more Emblems used": { en: "Opens the Domain of Timeless conflict when two or more Emblems used", ch: "使用两个或更多徽章时开启永恒争战之域" },
  "Reward Chests are improved": { en: "Reward Chests are improved", ch: "奖励宝箱获得提升" },
  "Single socket Resonator reforging a rare item using Fossils": { en: "Single socket Resonator reforging a rare item using Fossils", ch: "单插槽共鸣器，使用化石重铸稀有物品" },
  "Summons the Beyond Bosses of other factions when a Beyond Boss is summoned": { en: "Summons the Beyond Bosses of other factions when a Beyond Boss is summoned", ch: "召唤超越首领时，会同时召唤其他派系的超越首领" },
  "This additional boss is guaranteed to drop a Shaper Guardian, Elder Guardian, Conqueror or Unique Synthesised Map.": { en: "This additional boss is guaranteed to drop a Shaper Guardian, Elder Guardian, Conqueror or Unique Synthesised Map.", ch: "该额外首领必定掉落塑界守卫、裂界守卫、征服者或传奇忆境地图。" },
  "Three socket Resonator reforging a rare item using Fossils": { en: "Three socket Resonator reforging a rare item using Fossils", ch: "三插槽共鸣器，使用化石重铸稀有物品" },
  "Two socket Resonator reforging a rare item using Fossils": { en: "Two socket Resonator reforging a rare item using Fossils", ch: "双插槽共鸣器，使用化石重铸稀有物品" },
  "Used to unlock additional Pantheon bonuses": { en: "Used to unlock additional Pantheon bonuses", ch: "用于解锁额外的万神殿之力" },
  "Usually a Sacrifice fragment.": { en: "Usually a Sacrifice fragment.", ch: "通常为献祭碎片。" },
  "Usually a level 21 gem, an exceptional gem, a gem with 23 quality or a leveled/quality vaal gem!": { en: "Usually a level 21 gem, an exceptional gem, a gem with 23 quality or a leveled/quality vaal gem!", ch: "通常为 21 级宝石、卓越宝石、23% 品质宝石，或有等级/品质的瓦尔宝石！" },
  "Usually blighted maps, oils or scarabs.": { en: "Usually blighted maps, oils or scarabs.", ch: "通常为菌潮地图、圣油或圣甲虫。" },
  "Usually expedition reroll currencies or scarabs": { en: "Usually expedition reroll currencies or scarabs", ch: "通常为远征重掷通货或圣甲虫" },
  "Usually simulacrum splinters or delirium orbs": { en: "Usually simulacrum splinters or delirium orbs", ch: "通常为拟像裂片或梦魇宝珠" },
};

/** Data-tree folder names. Replaces the old ch-only `DATA_FOLDER_CH`.
 *  The en side drops a leading `_` (`_campaign` -> `campaign`), which is what the
 *  call sites used to do inline. */
export const DATA_FOLDER_LABELS: Record<string, Localized> = {
  Currency: { en: "Currency", ch: "通货" },
  Equipment: { en: "Equipment", ch: "装备" },
  "Divination Cards": { en: "Divination Cards", ch: "命运卡" },
  Gems: { en: "Gems", ch: "宝石" },
  Maps: { en: "Maps", ch: "地图" },
  Misc: { en: "Misc", ch: "杂项" },
  Special: { en: "Special", ch: "特殊" },
  Weapons: { en: "Weapons", ch: "武器" },
  Armour: { en: "Armour", ch: "防具" },
  Jewellery: { en: "Jewellery", ch: "首饰" },
  Flasks: { en: "Flasks", ch: "药剂" },
  Quest: { en: "Quest", ch: "任务" },
  Uniques: { en: "Uniques", ch: "传奇" },
  Jewels: { en: "Jewels", ch: "珠宝" },
  Heist: { en: "Heist", ch: "赏金猎人" },
  _campaign: { en: "campaign", ch: "过渡" },
  _legacy: { en: "legacy", ch: "旧版" },
  _unclassified: { en: "unclassified", ch: "未分类" },
};

/** Rule condition names, for the condition picker. Was already key-first. */
export const RULE_FACTOR_LABELS: Record<string, Localized> = {
  ItemLevel: { en: "Item Level", ch: "物品等级" },
  DropLevel: { en: "Drop Level", ch: "掉落等级" },
  GemLevel: { en: "Gem Level", ch: "宝石等级" },
  Quality: { en: "Quality", ch: "品质" },
  MapTier: { en: "Map Tier", ch: "地图阶级" },
  StackSize: { en: "Stack Size", ch: "堆叠数量" },
  Sockets: { en: "Sockets", ch: "插槽" },
  LinkedSockets: { en: "Links", ch: "连线" },
  Corrupted: { en: "Corrupted", ch: "已污染" },
  Mirrored: { en: "Mirrored", ch: "已复制" },
  Identified: { en: "Identified", ch: "已鉴定" },
  FracturedItem: { en: "Fractured", ch: "破碎物品" },
  SynthesisedItem: { en: "Synthesised", ch: "合成物品" },
  HasInfluence: { en: "Influence", ch: "势力" },
  BlightedMap: { en: "Blighted", ch: "菌潮" },
  UberBlightedMap: { en: "Blight-ravaged", ch: "菌潮灭绝" },
  TransfiguredGem: { en: "Transfigured", ch: "改造技能石" },
  Class: { en: "Item Class", ch: "物品类别" },
  EnchantmentPassiveNode: { en: "Cluster Node", ch: "星团天赋" },
  Rarity: { en: "Rarity", ch: "稀有度" },
  AreaLevel: { en: "Area Level", ch: "地区等级" },
  BaseDefencePercentile: { en: "Base Percentile", ch: "基础防御百分比" },
  HasExplicitMod: { en: "Explicit Mod", ch: "含有词缀" },
  HasImplicitMod: { en: "Implicit Mod", ch: "含有基底词缀" },
  HasEnchantment: { en: "Enchantment", ch: "含有附魔" },
  HasSearingExarchImplicit: { en: "Exarch Implicit", ch: "含有焚界基底" },
  HasEaterOfWorldsImplicit: { en: "Eater Implicit", ch: "含有灭界基底" },
  CorruptedMods: { en: "Corrupted Mods", ch: "污染词缀" },
  EnchantmentPassiveNum: { en: "Passive Num", ch: "天赋数量" },
  Replica: { en: "Replica", ch: "仿品传奇" },
  Foulborn: { en: "Foulborn", ch: "秽生传奇" },
  SocketGroup: { en: "Socket Group", ch: "插槽组合" },
  ZanaMemory: { en: "Zana Memory", ch: "扎娜记忆" },
  ShapedMap: { en: "Shaped Map", ch: "塑界地图" },
  DisableDropSound: { en: "Disable Sound", ch: "禁用声音" },
  EnableDropSound: { en: "Enable Sound", ch: "启用声音" },
  AnyEnchantment: { en: "Any Enchantment", ch: "含有任意附魔" },
  BaseArmour: { en: "Base Armour", ch: "基础护甲" },
  BaseEnergyShield: { en: "Base Energy Shield", ch: "基础能量护盾" },
  BaseEvasion: { en: "Base Evasion", ch: "基础闪避" },
  BaseType: { en: "Base Type (text)", ch: "基础类型（文本）" },
  BaseWard: { en: "Base Ward", ch: "基础守护" },
  ElderItem: { en: "Elder Item", ch: "裂界者物品" },
  ElderMap: { en: "Elder Map", ch: "裂界地图" },
  HasCruciblePassiveTree: { en: "Has Crucible Tree", ch: "含有熔炉天赋树" },
  Height: { en: "Height", ch: "高度" },
  Imbued: { en: "Imbued", ch: "灌注" },
  MemoryStrands: { en: "Memory Strands", ch: "记忆丝线" },
  MirageMap: { en: "Mirage Map", ch: "幻影地图" },
  Scourged: { en: "Scourged", ch: "腐化扭曲" },
  ShaperItem: { en: "Shaper Item", ch: "塑界者物品" },
  Vestigial: { en: "Vestigial", ch: "残迹" },
  Width: { en: "Width", ch: "宽度" },
};

/**
 * Theme-category display names — the registry that did not exist before, which is why
 * 35 of 51 categories rendered as raw English in the style-preset dropdown and 25 in
 * the theme editor (two surfaces, two different ad-hoc lookup chains, two answers).
 *
 * Every ch value below is the AUTHOR'S OWN wording, lifted from `_meta.item_class.ch`
 * in the tier data or from the existing tables — none is invented. Note that
 * `_meta.item_class` names the item CLASS, not the category: 11 categories report
 * 可堆叠通货 and Scarabs reports 地图碎片, so a value shared by more than one category
 * was rejected rather than used as a name.
 */
export const THEME_CATEGORY_LABELS: Record<string, Localized> = {
  "Breach Grasping Mail": { en: "Breach Grasping Mail", ch: "扼杀链甲" },
  Campaign: { en: "Campaign", ch: "剧情模式" },
  Chancing: { en: "Chancing", ch: "机会底材" },
  Corpses: { en: "Corpses", ch: "灵柩" },
  "Crafting Bases": { en: "Crafting Bases", ch: "优先精品底材" },
  "Delirium Orbs": { en: "Delirium Orbs", ch: "惊影玉" },
  "Enshrouded Gear": { en: "Enshrouded Gear", ch: "笼罩物品" },
  Essences: { en: "Essences", ch: "精华" },
  "Expedition Ward-Bases": { en: "Expedition Ward-Bases", ch: "先祖秘藏结界底材" },
  Fossils: { en: "Fossils", ch: "化石" },
  Gold: { en: "Gold", ch: "金币" },
  Harvest: { en: "Harvest", ch: "庄稼/园艺" },
  "Heist Experimented": { en: "Heist Experimented", ch: "夺宝奇兵实验底材" },
  "Heist Targets": { en: "Heist Targets", ch: "赏金目标" },
  Influenced: { en: "Influenced", ch: "势力装备" },
  Jewels: { en: "Jewels", ch: "珠宝" },
  Legacy: { en: "Legacy", ch: "旧版" },
  "Life Flasks": { en: "Life Flasks", ch: "生命药剂" },
  "Magic Net": { en: "Magic Net", ch: "魔法装备网" },
  "Mana Flasks": { en: "Mana Flasks", ch: "魔力药剂" },
  "Map Fragments": { en: "Map Fragments", ch: "碎片" },
  Maps: { en: "Maps", ch: "地图" },
  Oils: { en: "Oils", ch: "圣油" },
  "Quest Items": { en: "Quest Items", ch: "任务物品" },
  "Rare Equipment": { en: "Rare Equipment", ch: "黄装" },
  Relics: { en: "Relics", ch: "遗物" },
  "Ritual BaseTypes": { en: "Ritual BaseTypes", ch: "仪式底材" },
  "Sacrificial Garbs": { en: "Sacrificial Garbs", ch: "祭礼束衣" },
  Scarabs: { en: "Scarabs", ch: "圣甲虫" },
  "Skill Gems": { en: "Skill Gems", ch: "技能宝石" },
  "Stygian Vise": { en: "Stygian Vise", ch: "深渊腰带" },
  "Support Gems": { en: "Support Gems", ch: "辅助宝石" },
  Talismans: { en: "Talismans", ch: "护身符" },
  Tinctures: { en: "Tinctures", ch: "酊剂" },
  Trinkets: { en: "Trinkets", ch: "饰品" },
  Uniques: { en: "Uniques", ch: "传奇物品" },
  "Utility Flasks": { en: "Utility Flasks", ch: "功能药剂" },
  "Vendor Recipes": { en: "Vendor Recipes", ch: "商店配方" },
  Wombgifts: { en: "Wombgifts", ch: "孕育赠礼" },

  // ── Not yet named in Chinese. Listed explicitly so the gap is data, not a silent
  // fallback: `resolve` returns the en value and the coverage test reports these.
  // Several have an official game term the author should confirm rather than us guess
  // (e.g. Heist Contracts / Blueprints vs the existing 契约 / 蓝图 class labels).
  "Curse of the Allflame": { en: "Curse of the Allflame" },
  "Enshrouding Crystals": { en: "Enshrouding Crystals" },
  General: { en: "General" },
  "Heist Blueprints": { en: "Heist Blueprints" },
  "Heist Contracts": { en: "Heist Contracts" },
  "Heist Currency": { en: "Heist Currency" },
  "Heist Equipment": { en: "Heist Equipment" },
  "Incursion Vials": { en: "Incursion Vials" },
  "Mirror of Kalandra Ring Bases": { en: "Mirror of Kalandra Ring Bases" },
  Omens: { en: "Omens" },
  Runegrafts: { en: "Runegrafts" },
  "Tainted Currency": { en: "Tainted Currency" },
};

type LeafOf<T> = T extends Localized ? string : { readonly [K in keyof T]: LeafOf<T[K]> };
/** What `useTranslation` hands back: the same key paths, resolved to strings. */
export type Translation = { readonly [K in keyof typeof strings]: LeafOf<(typeof strings)[K]> };

const proxyCache = new WeakMap<object, Partial<Record<Language, any>>>();

/**
 * Resolve a node for `lang`: a translation bag becomes a string, a group becomes a
 * nested proxy, and an unknown key yields the key itself.
 *
 * Returning the key for an unknown lookup is a deliberate LAST RESORT so a typo renders
 * something visible instead of `undefined`. It is also why this must never be the only
 * way to read a string: dynamic lookups want to know a value is missing so their own
 * fallback can fire, and for those there is `translate()` below.
 */
const nodeFor = (node: any, prop: string, lang: Language): any => {
  const v = node?.[prop];
  if (v === undefined) return prop;
  if (isLocalized(v)) return resolve(v, lang) ?? prop;
  if (v && typeof v === 'object') return proxyFor(v, lang);
  return v;
};

const proxyFor = (node: object, lang: Language): any => {
  let byLang = proxyCache.get(node);
  if (!byLang) { byLang = {}; proxyCache.set(node, byLang); }
  if (!byLang[lang]) {
    byLang[lang] = new Proxy(node, {
      get: (target, prop) => (typeof prop === 'string' ? nodeFor(target, prop, lang) : (target as any)[prop]),
    });
  }
  return byLang[lang];
};

/** The per-language view of `strings`. One proxy per language, cached. */
export const useTranslation = (lang: Language): Translation => proxyFor(strings, lang) as Translation;

/**
 * Look a UI string up by a key computed at runtime, returning `undefined` when it is
 * absent so the caller's own fallback can fire.
 *
 * Use this — never `t[someVariable] || fallback` — for dynamic keys. `t` yields the key
 * string on a miss, which is truthy, so `||` after it is unreachable code.
 */
export const translate = (key: string, lang: Language): string | undefined => {
  const v = (strings as Record<string, unknown>)[key];
  return isLocalized(v) ? resolve(v, lang) : undefined;
};

// ── Label helpers ────────────────────────────────────────────────────────────
// One helper per registry, so every surface asking the same question gets the same
// answer. This is the actual cure for the category-dropdown bug: the style-preset
// picker checked only the item-class map while the theme editor checked the class map
// AND the string table, so the same category read 圣甲虫 on one screen and "Scarabs" on
// the other. Call these instead of reaching into a registry inline.

/** Official item-class name, e.g. `Wands` -> 法杖. */
export const itemClassLabel = (cls: string, lang: Language): string =>
  label(ITEM_CLASS_LABELS[cls] ?? ITEM_CLASS_LABELS[CLASS_KEY_MAP[cls]], lang, cls);

/** Theme-category display name, e.g. `Rare Equipment` -> 黄装. */
export const themeCategoryLabel = (cat: string, lang: Language): string =>
  label(THEME_CATEGORY_LABELS[cat] ?? ITEM_CLASS_LABELS[cat] ?? ITEM_CLASS_LABELS[CLASS_KEY_MAP[cat]], lang, cat);

/** Data-tree folder name. The en side drops a leading `_`, as the call sites did. */
export const dataFolderLabel = (folder: string, lang: Language): string =>
  label(DATA_FOLDER_LABELS[folder], lang, folder.replace(/^_/, ''));

/** Rule-condition name for the condition picker, e.g. `ItemLevel` -> 物品等级. */
export const ruleFactorLabel = (key: string, lang: Language): string =>
  label(RULE_FACTOR_LABELS[key], lang, key);

/** FilterBlade bonus-info tag. */
export const bonusTagLabel = (tag: string, lang: Language): string =>
  label(BONUS_TAG_LABELS[tag], lang, tag);

/** FilterBlade bonus-info hint sentence; falls back to the English sentence itself. */
export const bonusHintLabel = (hint: string, lang: Language): string =>
  label(BONUS_HINT_LABELS[hint], lang, hint);

/**
 * An item's display name.
 *
 * Item records carry their translations as sibling fields named `name_<locale>`
 * (`name_ch`), with plain `name` holding English. Walking the locale chain here means a
 * new locale only needs its `name_<id>` field in the data — no code change, and no
 * `lang === 'ch'` test, which is what this used to be.
 */
export const getItemName = (item: { name: string; [field: string]: unknown }, lang: Language): string => {
  for (const l of localeChain(lang)) {
    const v = item[`name_${l}`];
    if (typeof v === 'string' && v) return v;
  }
  return item.name;
};
