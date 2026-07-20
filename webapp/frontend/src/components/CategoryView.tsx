import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import TierStyleEditor from "./TierStyleEditor";
import TierItemManager from "./TierItemManager";
import BulkTierEditor from "./BulkTierEditor";
import RuleManager from "./RuleManager";
import SortableTierBlock from "./SortableTierBlock";
import TierOutlineRail from "./TierOutlineRail";
import TierContextMenu from "./TierContextMenu";
import CategoryRenameModal from "./CategoryRenameModal";
import LoadingOverlay from "./LoadingOverlay";
import { invalidateTierLabelMap } from "../utils/tierLabels";
import { resolveStyle } from "../utils/styleResolver";
import { useTranslation, translations } from "../utils/localization";
import type { Language } from "../utils/localization";
import tierTemplate from "../config/tierTemplate.json";
import { STRICTNESS_LEVELS, type StrictnessLevel, type LevelingSelection, isLevelingSelected } from "../utils/filterGenerator";

interface TierItem {
  name: string;
  name_ch?: string;
  sub_type?: string;
  match_mode?: "exact" | "partial";
  source: string;
  rule_index?: number | null;
}

interface CategoryViewProps {
  configContent: string;
  onConfigContentChange: (newContent: string) => void;
  language: Language;
  onInspectTier: (tier: any) => void;
  onRuleEdit: (tierKey: string, idx: number | null) => void;
  onPingCondition?: (
    tierKey: string,
    ruleIndex: number,
    conditionKey: string,
  ) => void;
  viewerBackground: string;
  tierItems: Record<string, TierItem[]>;
  fetchTierItems: (keys: string[]) => void;
  defaultMappingPath?: string;
  onUpdateTierItems?: (tierKey: string, items: TierItem[]) => void;
  pingedCondition?: {
    tierKey: string;
    ruleIndex: number;
    conditionKey: string;
    timestamp: number;
  } | null;
  soundMap?: any;
  themeData?: any;
  categoryClass?: string | null;
  strictness?: StrictnessLevel;
  levelingSelection?: LevelingSelection;
  onLevelingSelectionChange?: (sel: LevelingSelection) => void;
}

const CategoryView: React.FC<CategoryViewProps> = ({
  configContent,
  onConfigContentChange,
  language,
  onInspectTier,
  onRuleEdit,
  onPingCondition,
  viewerBackground,
  tierItems,
  fetchTierItems,
  defaultMappingPath,
  onUpdateTierItems,
  pingedCondition,
  soundMap,
  themeData,
  categoryClass,
  strictness,
  levelingSelection,
  onLevelingSelectionChange,
}) => {
  const t = useTranslation(language);
  const strictnessIdx = Math.max(0, (STRICTNESS_LEVELS as readonly string[]).indexOf(strictness ?? 'soft'));
  // Effective hidden state for the preview: a permanent hide bucket, a strictness gate
  // the current level reaches, or a campaign tier the declutter turns to Hide
  // (additive model: un-boosted band tiers still SHOW — they are not dimmed).
  const tierHidden = (td: any): boolean =>
    !!td?.is_hide_tier ||
    (typeof td?.hide_at_strictness === 'number' && strictnessIdx >= td.hide_at_strictness) ||
    !isLevelingSelected(td?.lv_group, levelingSelection);
  // const [themeData, setThemeData] = useState<any>(null); // Lifted to EditorView
  // const [soundMap, setSoundMap] = useState<any>(null); // Lifted
  const [parsedConfig, setParsedConfig] = useState<any>(null);

  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [activeBulkClass, setActiveBulkClass] = useState<string | null>(null);
  const [activeBulkOptions, setActiveBulkOptions] = useState<any[]>([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    tierKey?: string;
    index?: number;
  }>({ visible: false, x: 0, y: 0 });

  const [tierClipboard, setTierClipboard] = useState<any>(null);
  const [renameModal, setRenameModal] = useState<{
    tierKey: string;
    name: string;
  } | null>(null);
  const [activeRuleIndex, setActiveRuleIndex] = useState<{
    tierKey: string;
    index: number;
  } | null>(null);

  const API_BASE_URL = "";

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    try {
      if (configContent) {
        setParsedConfig(JSON.parse(configContent));
      }
    } catch (e) {
      console.error("JSON parse error in CategoryView", e);
    }
  }, [configContent]);

  // Derived state: active category and its tier order
  const { activeCategoryKey, activeCategoryData, sortedTierKeys } =
    useMemo(() => {
      if (!parsedConfig)
        return {
          activeCategoryKey: null,
          activeCategoryData: null,
          sortedTierKeys: [],
        };

      const catKey = Object.keys(parsedConfig).find((k) => !k.startsWith("//"));
      if (!catKey)
        return {
          activeCategoryKey: null,
          activeCategoryData: null,
          sortedTierKeys: [],
        };

      const catData = parsedConfig[catKey];
      let keys = Object.keys(catData).filter(
        (k) => !k.startsWith("//") && k !== "_meta" && k !== "rules",
      );

      if (catData._meta?.tier_order) {
        const order = catData._meta.tier_order;
        keys.sort((a, b) => {
          const idxA = order.indexOf(a);
          const idxB = order.indexOf(b);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }

      return {
        activeCategoryKey: catKey,
        activeCategoryData: catData,
        sortedTierKeys: keys,
      };
    }, [parsedConfig]);

  const updateConfig = (newConfig: any) => {
    onConfigContentChange(JSON.stringify(newConfig, null, 2));
  };

  const getTierOrderScore = (key: string) => {
    if (key.startsWith("CustomTier")) return null;
    if (key.includes("Tier 0")) return 0;
    if (key.includes("Hide")) return 9;
    const match = key.match(/^Tier (\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!activeCategoryKey || !activeCategoryData) return;
    if (active.id !== over?.id) {
      const oldIndex = sortedTierKeys.indexOf(active.id as string);
      const newIndex = sortedTierKeys.indexOf(over?.id as string);

      let newOrder = arrayMove(sortedTierKeys, oldIndex, newIndex);

      const t0IdxOriginal = sortedTierKeys.findIndex(
        (key) => getTierOrderScore(key) === 0,
      );
      const activeIsCustom = getTierOrderScore(active.id as string) === null;

      if (
        activeIsCustom &&
        oldIndex > t0IdxOriginal &&
        newIndex <= t0IdxOriginal
      ) {
        if (!window.confirm(t.t0OrderWarning)) return;
      }

      const predefinedIndices: number[] = [];
      const predefinedKeys: string[] = [];

      newOrder.forEach((key, idx) => {
        if (getTierOrderScore(key) !== null) {
          predefinedIndices.push(idx);
          predefinedKeys.push(key);
        }
      });

      const correctlySortedPredefined = [...predefinedKeys].sort((a, b) => {
        return (getTierOrderScore(a) ?? 0) - (getTierOrderScore(b) ?? 0);
      });

      predefinedIndices.forEach((pos, i) => {
        newOrder[pos] = correctlySortedPredefined[i];
      });

      const newConfig = JSON.parse(JSON.stringify(parsedConfig));
      if (!newConfig[activeCategoryKey]._meta)
        newConfig[activeCategoryKey]._meta = {};
      newConfig[activeCategoryKey]._meta.tier_order = newOrder;

      updateConfig(newConfig);
    }
  };

  const getAugmentedRules = (baseRules: any[], items: TierItem[]) => {
    const newRules = [...baseRules];
    if (!soundMap?.basetype_sounds) return newRules;

    items.forEach((item) => {
      const handled = baseRules.some((r) => r.targets?.includes(item.name));
      if (!handled && soundMap.basetype_sounds[item.name]) {
        const sData = soundMap.basetype_sounds[item.name];
        newRules.push({
          targets: [item.name],
          overrides: { PlayAlertSound: [sData.file, sData.volume] },
          comment: `__AUTO_SOUND__:${item.name}`,
          isImplicit: true,
        });
      }
    });
    return newRules;
  };

  const handleTierUpdate = (
    tierKey: string,
    newStyle: any,
    gate: number | null,
    themeCategory: string,
  ) => {
    if (!activeCategoryKey) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const currentTheme = newConfig[activeCategoryKey][tierKey].theme || {};
    newConfig[activeCategoryKey][tierKey].theme = {
      ...currentTheme,
      ...newStyle,
    };
    if (gate === null) delete newConfig[activeCategoryKey][tierKey].hide_at_strictness;
    else newConfig[activeCategoryKey][tierKey].hide_at_strictness = gate;
    updateConfig(newConfig);

    const displayTierName =
      newConfig[activeCategoryKey][tierKey].localization?.[language] ||
      (language === "ch"
        ? `T${newStyle.Tier ?? "?"} ${newConfig[activeCategoryKey]._meta?.localization?.ch ?? activeCategoryKey}`
        : `Tier ${newStyle.Tier ?? "?"} ${newConfig[activeCategoryKey]._meta?.localization?.en ?? activeCategoryKey}`);

    const items = derivedTierItems[tierKey] || [];
    const baseRules =
      newConfig[activeCategoryKey].rules ||
      newConfig[activeCategoryKey]._meta?.rules ||
      [];

    onInspectTier({
      key: tierKey,
      name: displayTierName,
      style: resolveStyle(
        newConfig[activeCategoryKey][tierKey],
        themeData,
        themeCategory,
        soundMap,
      ),
      visibility: tierHidden(newConfig[activeCategoryKey][tierKey]),
      category: themeCategory,
      rules: getAugmentedRules(baseRules, items),
      baseTypes: items.map((i) => i.name),
    });
  };

  // Toggle the hideable guard. Protecting a tier also clears any strictness gate,
  // so a protected tier can never be hidden (guard is enforced here, in authoring).
  const handleToggleProtect = (tierKey: string, themeCategory: string) => {
    if (!activeCategoryKey) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const td = newConfig[activeCategoryKey][tierKey];
    if (td.hideable === false) {
      td.hideable = true;             // unprotect → tier becomes gateable
    } else {
      td.hideable = false;            // protect → never hide
      delete td.hide_at_strictness;   // drop any gate so it can't hide
    }
    updateConfig(newConfig);

    const items = derivedTierItems[tierKey] || [];
    const baseRules =
      newConfig[activeCategoryKey].rules ||
      newConfig[activeCategoryKey]._meta?.rules ||
      [];
    onInspectTier({
      key: tierKey,
      name: td.localization?.[language] || tierKey,
      style: resolveStyle(td, themeData, themeCategory, soundMap),
      visibility: tierHidden(td),
      category: themeCategory,
      rules: getAugmentedRules(baseRules, items),
      baseTypes: items.map((i) => i.name),
    });
  };

  const openRenameModal = (tierKey: string) => {
    const td = activeCategoryData?.[tierKey];
    if (!td) return;
    setRenameModal({
      tierKey,
      name: td.localization?.[language] || "",
    });
  };

  // Saves the per-tier display name into the tier file's localization. One
  // name for both languages — renamers type their native language, so the
  // custom name needs no translation. Internal keys + theme.Tier untouched.
  const saveRename = () => {
    if (!renameModal || !activeCategoryKey) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const tier = newConfig[activeCategoryKey][renameModal.tierKey];
    if (!tier) return;
    const name = renameModal.name.trim();
    if (name) tier.localization = { en: name, ch: name };
    else delete tier.localization; // empty = restore default generated name
    updateConfig(newConfig);
    invalidateTierLabelMap(); // style picker / theme editor labels refresh next fetch
    setRenameModal(null);
  };

  const handleMoveItem = async (
    item: TierItem,
    newTier: string,
    isAppend: boolean = false,
    oldTier?: string,
  ) => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-item-tier`, {
        item_name: item.name,
        new_tier: newTier,
        source_file: item.source || defaultMappingPath,
        is_append: isAppend,
        old_tier: oldTier,
      });
      fetchTierItems(sortedTierKeys);
    } catch (err) {
      console.error("Failed to move item", err);
    }
  };

  const handleDeleteItem = async (item: TierItem, fromTier: string) => {
    handleMoveItem(item, "", false, fromTier);
  };

  const handleUpdateOverride = async (item: TierItem, overrides: any) => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-item-override`, {
        item_name: item.name,
        overrides: overrides,
        source_file: item.source,
      });
      fetchTierItems(sortedTierKeys);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveRuleTarget = (item: TierItem, ruleIndex: number) => {
    if (!activeCategoryKey) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const rules =
      newConfig[activeCategoryKey].rules ||
      newConfig[activeCategoryKey]._meta?.rules;

    if (rules && rules[ruleIndex]) {
      const rule = rules[ruleIndex];
      if (rule.targets) {
        rule.targets = rule.targets.filter((t: string) => t !== item.name);
        updateConfig(newConfig);

        const tierKey = sortedTierKeys.find((key) =>
          derivedTierItems[key]?.some(
            (i) => i.name === item.name && i.rule_index === ruleIndex,
          ),
        );
        if (tierKey && onUpdateTierItems) {
          const newItems = derivedTierItems[tierKey].filter(
            (i) => !(i.name === item.name && i.rule_index === ruleIndex),
          );
          onUpdateTierItems(tierKey, newItems);
        }
      }
    }
  };

  const getNextCustomTierName = (categoryData: any, categoryKey: string) => {
    const existingTiers = Object.keys(categoryData).filter((k) =>
      k.startsWith("CustomTier"),
    );
    let maxNum = 0;
    const regex = /CustomTier (\d+)/;
    existingTiers.forEach((k) => {
      const match = k.match(regex);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return {
      key: `CustomTier ${nextNum} ${categoryKey}`,
      num: nextNum,
    };
  };

  const handleInsertTier = (
    index: number,
    position: "before" | "after",
    templateData: any = null,
  ) => {
    if (!activeCategoryKey || !activeCategoryData) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const categoryData = newConfig[activeCategoryKey];

    let newTierKey: string;
    let tierData: any;

    if (templateData) {
      const { key } = getNextCustomTierName(categoryData, activeCategoryKey);
      newTierKey = key;
      tierData = JSON.parse(JSON.stringify(templateData));

      const originalName = templateData.localization?.[language] || "Tier";
      tierData.localization = {
        en: `${originalName} ${translations.en.copyLabel}`,
        ch: `${templateData.localization?.ch || originalName} ${translations.ch.copyLabel}`,
      };
      tierData.show_in_editor = true;
    } else {
      const { key, num } = getNextCustomTierName(
        categoryData,
        activeCategoryKey,
      );
      newTierKey = key;
      tierData = JSON.parse(JSON.stringify(tierTemplate));

      const nameEn = `${tierData.name_template?.en || "Custom Tier #"}${num}`;
      const nameCh = `${tierData.name_template?.ch || "自定义阶级 #"}${num}`;
      if (tierData.name_template) delete tierData.name_template;

      tierData.localization = { en: nameEn, ch: nameCh };
    }

    categoryData[newTierKey] = tierData;

    let newOrder = [...sortedTierKeys];
    if (!categoryData._meta) categoryData._meta = {};
    if (categoryData._meta.tier_order) {
      newOrder = [...categoryData._meta.tier_order];
    }

    const insertIdx = position === "before" ? index : index + 1;

    const targetKey = sortedTierKeys[index];
    if (getTierOrderScore(targetKey) === 0 && position === "before") {
      if (!window.confirm(t.t0InsertWarning)) return;
    }

    newOrder.splice(insertIdx, 0, newTierKey);

    categoryData._meta.tier_order = newOrder;
    updateConfig(newConfig);

    fetchTierItems(newOrder);
  };

  const handleDeleteTier = async (tierKey: string) => {
    if (!activeCategoryKey) return;
    if (!confirm(t.confirmDeleteTier)) return;

    const itemsToUnassign = derivedTierItems[tierKey] || [];
    if (itemsToUnassign.length > 0) {
      try {
        await Promise.all(
          itemsToUnassign.map((item) =>
            axios.post(`${API_BASE_URL}/api/update-item-tier`, {
              item_name: item.name,
              new_tier: "",
              source_file: item.source,
            }),
          ),
        );
      } catch (e) {
        console.error("Failed to unassign items", e);
        return;
      }
    }

    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    delete newConfig[activeCategoryKey][tierKey];

    if (newConfig[activeCategoryKey]._meta?.tier_order) {
      newConfig[activeCategoryKey]._meta.tier_order = newConfig[
        activeCategoryKey
      ]._meta.tier_order.filter((k: string) => k !== tierKey);
    }
    updateConfig(newConfig);

    const remainingKeys = sortedTierKeys.filter((k) => k !== tierKey);
    fetchTierItems(remainingKeys);
  };

  const handleRulesChange = (
    categoryKey: string,
    newRules: any[],
    tierKey?: string,
    tierName?: string,
    themeCategory?: string,
  ) => {
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    newConfig[categoryKey].rules = newRules;
    if (newConfig[categoryKey]._meta?.rules)
      delete newConfig[categoryKey]._meta.rules;

    updateConfig(newConfig);
    fetchTierItems(sortedTierKeys);

    if (tierKey && tierName && themeCategory) {
      const tierData = newConfig[categoryKey][tierKey];
      const items = derivedTierItems[tierKey] || [];
      onInspectTier({
        key: tierKey,
        name: tierName,
        style: resolveStyle(tierData, themeData, themeCategory, soundMap),
        visibility: tierHidden(tierData),
        category: themeCategory,
        rules: newRules.filter(
          (r: any) =>
            !r.targets?.length ||
            r.targets.some((t: string) => items.some((i) => i.name === t)),
        ),
        baseTypes: items.map((i) => i.name),
      });
    }
  };

  const allItemDetails = useMemo(() => {
    const cache: Record<string, any> = {};
    Object.values(tierItems).forEach((items) => {
      items.forEach((i) => {
        if (!cache[i.name] || (!cache[i.name].sub_type && i.sub_type)) {
          cache[i.name] = { ...i, rule_index: undefined }; // Store without rule_index
        }
      });
    });
    return cache;
  }, [tierItems]);

  // Translations for base types added this session (from search suggestions),
  // so freshly-added items localize immediately instead of falling back to English.
  const [addedTranslations, setAddedTranslations] = useState<Record<string, string>>({});

  const itemTranslationCache = useMemo(() => {
    const cache: Record<string, string> = {};
    Object.values(tierItems).forEach((items) => {
      items.forEach((i) => {
        if (i.name_ch) cache[i.name] = i.name_ch;
      });
    });
    return { ...cache, ...addedTranslations };
  }, [tierItems, addedTranslations]);

  const derivedTierItems = useMemo(() => {
    // If we have tier keys but no items yet, we are likely loading.
    // Return original tierItems to avoid flashing an empty grid.
    const hasAnyItems = Object.keys(tierItems).some(
      (k) => tierItems[k]?.length > 0,
    );
    if (!parsedConfig || !activeCategoryKey || !hasAnyItems) return tierItems;

    const rules =
      activeCategoryData?.rules || activeCategoryData?._meta?.rules || [];
    const result: Record<string, TierItem[]> = {};

    // 1. Initialize with all backend tierItems, resetting rule_index
    // This preserves all items (mapping ones and rule ones) as a starting pool
    sortedTierKeys.forEach((tk) => {
      result[tk] = (tierItems[tk] || []).map((i) => ({
        ...i,
        rule_index: undefined,
      }));
    });

    // 2. First Pass: Process explicit targets for all rules
    // Explicit targets always take priority over "Apply to all"
    rules.forEach((rule: any, ruleIdx: number) => {
      if (rule.disabled) return;
      const ruleTier = rule.overrides?.Tier;
      if (!ruleTier || !result[ruleTier]) return;

      if (rule.targets) {
        rule.targets.forEach((tName: string) => {
          const existing = allItemDetails[tName];
          const matchMode = rule.targetMatchModes?.[tName] || "exact";

          // Try to find an available item card in this tier that hasn't been assigned to a rule yet
          const stdIdx = result[ruleTier].findIndex(
            (i) => i.name === tName && i.rule_index === undefined,
          );

          if (stdIdx !== -1) {
            result[ruleTier][stdIdx] = {
              ...result[ruleTier][stdIdx],
              rule_index: ruleIdx,
              match_mode: matchMode,
            };
          } else {
            // If no card is available in the pool (e.g. item is only in rule targets, not in mapping),
            // create a new card for this rule target.
            result[ruleTier].push({
              name: tName,
              name_ch:
                existing?.name_ch || itemTranslationCache[tName] || tName,
              sub_type: existing?.sub_type || "Other",
              source: existing?.source || defaultMappingPath || "",
              ...(existing || {}),
              rule_index: ruleIdx,
              match_mode: matchMode,
            });
          }
        });
      }
    });

    // 3. Second Pass: Apply "Apply to all" rules to remaining standard items
    rules.forEach((rule: any, ruleIdx: number) => {
      if (rule.disabled || !rule.applyToTier) return;
      const ruleTier = rule.overrides?.Tier;
      if (!ruleTier || !result[ruleTier]) return;

      // Apply to any item that still doesn't have a rule_index
      result[ruleTier] = result[ruleTier].map((i) => {
        if (i.rule_index === undefined) {
          return { ...i, rule_index: ruleIdx };
        }
        return i;
      });
    });

    return result;
  }, [
    tierItems,
    activeCategoryData?.rules,
    sortedTierKeys,
    allItemDetails,
    itemTranslationCache,
    activeCategoryKey,
    defaultMappingPath,
  ]);

  const handleContextMenu = (
    e: React.MouseEvent,
    tierKey?: string,
    index?: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      tierKey,
      index,
    });
  };

  if (!themeData || !parsedConfig || !activeCategoryKey)
    return <LoadingOverlay language={language} />;

  const catName =
    activeCategoryData._meta?.localization?.[language] || activeCategoryKey;
  const themeCategory =
    activeCategoryData._meta?.theme_category || activeCategoryKey;

  const tierOptions = sortedTierKeys.map((tk) => {
    const td = activeCategoryData[tk];
    const tNum = td.theme?.Tier !== undefined ? td.theme.Tier : "?";
    const locName = td.localization?.[language];

    const baseOption = {
      key: tk,
      show_in_editor: td.show_in_editor !== false,
      is_hide_tier: !!td.is_hide_tier,
    };

    if (locName) {
      return { ...baseOption, label: locName };
    }
    return {
      ...baseOption,
      label:
        language === "ch" ? `T${tNum} ${catName}` : `Tier ${tNum} ${catName}`,
    };
  });

  return (
    <div className="category-view" onContextMenu={(e) => handleContextMenu(e)}>
      <div className="category-section">
        <div className="category-header">
          <h3>{catName}</h3>
          <button
            className="bulk-edit-btn"
            onClick={() => {
              setActiveBulkClass(themeCategory);
              setActiveBulkOptions(tierOptions);
              setShowBulkEditor(true);
            }}
          >
            ⚡ {t.bulkEdit}
          </button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedTierKeys}
            strategy={verticalListSortingStrategy}
          >
            {sortedTierKeys.map((tierKey, index) => {
              const tierData = activeCategoryData[tierKey];
              // Campaign group tiers (selection-centric ladder): the ⚡ chip
              // toggles the group in the same leveling_selection the picker
              // edits — enabled = the tier emits, disabled = falls to the net.
              const togglable =
                tierData.lv_group?.axis === 'weapon' || tierData.lv_group?.axis === 'armour';
              const lvEnabled = !togglable || isLevelingSelected(tierData.lv_group, levelingSelection);
              const resolved = resolveStyle(
                tierData,
                themeData,
                themeCategory,
                soundMap,
              );
              const toggleBoost = () => {
                if (!onLevelingSelectionChange) return;
                const lv = tierData.lv_group;
                const sel: LevelingSelection = {
                  weapons: [...(levelingSelection?.weapons || [])],
                  armour_defense: [...(levelingSelection?.armour_defense || [])],
                  hide_unselected: !!levelingSelection?.hide_unselected,
                  preset: 'CUSTOM',
                };
                const list = lv.axis === 'weapon' ? sel.weapons! : sel.armour_defense!;
                const at = list.indexOf(lv.key);
                if (at >= 0) list.splice(at, 1); else list.push(lv.key);
                onLevelingSelectionChange(sel);
              };
              const items = derivedTierItems[tierKey] || [];
              const tierNum =
                tierData.theme?.Tier !== undefined ? tierData.theme.Tier : "?";

              // Display name: per-tier localization always wins (renameable);
              // fallback is the generated "T{n} {category}" label.
              const locName = tierData.localization?.[language];
              const displayTierName =
                locName ||
                (language === "ch"
                  ? `T${tierNum} ${catName}`
                  : `Tier ${tierNum} ${catName}`);

              return (
                <SortableTierBlock
                  key={tierKey}
                  id={tierKey}
                  onContextMenu={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, tierKey, index);
                  }}
                  onInsertBefore={() => handleInsertTier(index, "before")}
                  onInsertAfter={() => handleInsertTier(index, "after")}
                  onClick={(e) => {
                    if (
                      (e.target as HTMLElement).closest(
                        "button, input, .item-card",
                      )
                    )
                      return;

                    onInspectTier({
                      key: tierKey,
                      name: displayTierName,
                      style: resolved,
                      visibility: tierHidden(tierData),
                      category: themeCategory,
                      rules: getAugmentedRules(
                        activeCategoryData.rules ||
                          activeCategoryData._meta?.rules ||
                          [],
                        items,
                      ),
                      baseTypes: items.map((i) => i.name),
                    });
                  }}
                  language={language}
                  tooltips={{
                    drag: t.dragToReorder,
                    insertBefore: t.insertTierBefore,
                    insertAfter: t.insertTierAfter,
                    above: t.above,
                    below: t.below,
                  }}
                >
                  <TierStyleEditor
                    tierName={displayTierName}
                    style={resolved}
                    visibility={tierHidden(tierData)}
                    gate={tierData.hide_at_strictness ?? null}
                    canHide={tierData.show_in_editor !== false}
                    isProtected={tierData.hideable === false}
                    themeData={themeData}
                    themeCategory={themeCategory}
                    onRename={() => openRenameModal(tierKey)}
                    onChange={(newStyle, gate) =>
                      handleTierUpdate(tierKey, newStyle, gate, themeCategory)
                    }
                    onToggleProtect={() => handleToggleProtect(tierKey, themeCategory)}
                    language={language}
                    onInspect={() =>
                      onInspectTier({
                        key: tierKey,
                        name: displayTierName,
                        style: resolved,
                        visibility: tierHidden(tierData),
                        category: themeCategory,
                        rules: getAugmentedRules(
                          activeCategoryData.rules ||
                            activeCategoryData._meta?.rules ||
                            [],
                          items,
                        ),
                        baseTypes: items.map((i) => i.name),
                      })
                    }
                    viewerBackground={viewerBackground}
                  />
                  {tierData.conditions && Object.keys(tierData.conditions).length > 0 && (
                    <div className="tier-cond-strip" title={t.tierConditionsHint}>
                      <span className="tc-label">{t.tierConditions}</span>
                      {Object.entries(tierData.conditions as Record<string, any>).map(([k, v]) => {
                        const val = typeof v === 'string' && v.startsWith('RANGE ')
                          ? v.slice(6).replace(/\s+/g, ' ')
                          : Array.isArray(v) ? v.join(' & ') : String(v);
                        // Long BaseType lists: show a count, full list on hover
                        const isLong = val.length > 60;
                        const shown = isLong ? `${(val.match(/"/g)?.length || 0) / 2} bases` : val;
                        return (
                          <span key={k} className="tc-chip" title={`${k} ${val}`}>
                            {k} {shown}
                          </span>
                        );
                      })}
                      <style>{`
                        .tier-cond-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin: 6px 0 2px; }
                        .tc-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #8a8a92; }
                        .tc-chip {
                          font-size: 0.72rem; font-family: Consolas, monospace;
                          background: #f0f4f8; border: 1px solid #d1d9e0; border-radius: 4px;
                          padding: 2px 8px; color: #445; white-space: nowrap;
                          max-width: 340px; overflow: hidden; text-overflow: ellipsis;
                        }
                      `}</style>
                    </div>
                  )}
                  {togglable && (
                    <div className="lv-boost-bar">
                      <button
                        className={`lv-boost-chip ${lvEnabled ? 'on' : ''}`}
                        title={t.lvBoostHint}
                        onClick={toggleBoost}
                      >
                        ⚡ {lvEnabled ? t.lvBoostedChip : t.lvBoostChip}
                      </button>
                      <style>{`
                        .lv-boost-bar { margin: 6px 0 2px; }
                        .lv-boost-chip {
                          font-size: 0.74rem; padding: 3px 12px; border-radius: 12px;
                          border: 1px solid #3a3c46; background: #24252d; color: #8a8a92;
                          cursor: pointer; transition: all 0.1s;
                        }
                        .lv-boost-chip:hover { border-color: #e0b93a; color: #e0b93a; }
                        .lv-boost-chip.on {
                          background: #4a3d10; border-color: #e0b93a; color: #ffd75e; font-weight: 600;
                        }
                      `}</style>
                    </div>
                  )}
                                                  <TierItemManager 
                                                      tierKey={tierKey}
                                                      items={items}
                                                      allTiers={tierOptions}
                                                      onMoveItem={handleMoveItem}
                                                      onDeleteItem={handleDeleteItem}
                                                      onUpdateOverride={handleUpdateOverride}
                                                      onRemoveRuleTarget={handleRemoveRuleTarget}
                                                      language={language}
                                                      onRuleEdit={(tKey, idx) => {
                                                          onRuleEdit(tKey, idx); 
                                                          setActiveRuleIndex({ tierKey: tKey, index: idx });
                                                      }}
                                                      categoryRules={activeCategoryData.rules || activeCategoryData._meta?.rules || []}
                                                      onRefresh={() => fetchTierItems(sortedTierKeys)}
                                                      soundMap={soundMap}
                                                      tierStyle={resolved}
                                                  />
                  <RuleManager
                    tierKey={tierKey}
                    themeData={themeData}
                    themeCategory={themeCategory}
                    allRules={
                      activeCategoryData.rules ||
                      activeCategoryData._meta?.rules ||
                      []
                    }
                    onGlobalRulesChange={(newRules) =>
                      handleRulesChange(
                        activeCategoryKey,
                        newRules,
                        tierKey,
                        displayTierName,
                        themeCategory,
                      )
                    }
                    onRuleEdit={onRuleEdit}
                    onPingCondition={onPingCondition}
                    onRegisterTranslation={(name, nameCh) =>
                      nameCh && setAddedTranslations((p) => (p[name] === nameCh ? p : { ...p, [name]: nameCh }))
                    }
                    categoryClass={categoryClass}
                    language={language}
                    availableItems={items}
                    translationCache={itemTranslationCache}
                    availableTiers={tierOptions}
                    activeRuleIndex={
                      activeRuleIndex?.tierKey === tierKey
                        ? activeRuleIndex.index
                        : null
                    }
                    pingedCondition={pingedCondition}
                  />
                </SortableTierBlock>
              );
            })}
          </SortableContext>
        </DndContext>

        <button
          className="add-tier-btn"
          onClick={() => handleInsertTier(sortedTierKeys.length, "after")}
        >
          + {t.addNewTier}
        </button>
      </div>
      {/* Secondary outline navbar — big categories (e.g. Campaign Gear
          Progression) get a sticky jump-to rail instead of more nav entries. */}
      {tierOptions.length >= 8 && (
        <TierOutlineRail
          title={catName}
          entries={tierOptions.map((o) => ({
            key: o.key,
            label: o.label,
            isHide: o.is_hide_tier,
          }))}
        />
      )}
      {showBulkEditor && activeBulkClass && (
        <BulkTierEditor
          className={activeBulkClass}
          availableTiers={activeBulkOptions}
          language={language}
          onClose={() => setShowBulkEditor(false)}
          onSave={() => fetchTierItems(sortedTierKeys)}
          defaultMappingPath={defaultMappingPath}
        />
      )}

      {contextMenu.visible && (
        <TierContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tierKey={contextMenu.tierKey}
          hasClipboard={!!tierClipboard}
          language={language}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          onRename={(tk) => openRenameModal(tk)}
          onCopy={(tk) => setTierClipboard(activeCategoryData[tk])}
          onDelete={(tk) => handleDeleteTier(tk)}
          onInsertBefore={() =>
            contextMenu.index !== undefined
              ? handleInsertTier(contextMenu.index, "before")
              : handleInsertTier(0, "before")
          }
          onInsertAfter={() =>
            contextMenu.index !== undefined
              ? handleInsertTier(contextMenu.index, "after")
              : handleInsertTier(sortedTierKeys.length, "after")
          }
          onPaste={() =>
            contextMenu.index !== undefined
              ? handleInsertTier(contextMenu.index + 1, "before", tierClipboard)
              : handleInsertTier(sortedTierKeys.length, "after", tierClipboard)
          }
        />
      )}

      {renameModal && (
        <CategoryRenameModal
          tierKey={renameModal.tierKey}
          name={renameModal.name}
          placeholder={(() => {
            const td = activeCategoryData?.[renameModal.tierKey];
            const tNum = td?.theme?.Tier ?? "?";
            return language === "ch"
              ? `T${tNum} ${catName}`
              : `Tier ${tNum} ${catName}`;
          })()}
          language={language}
          onNameChange={(name) => setRenameModal({ ...renameModal, name })}
          onSave={saveRename}
          onCancel={() => setRenameModal(null)}
        />
      )}

      <style>{`
        .category-view { padding-bottom: 50px; max-width: 1200px; margin: 0 auto; width: 100%; min-height: 400px; }
        .rename-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 1500; display: flex; align-items: center; justify-content: center; }
        .rename-modal { background: white; border-radius: 8px; padding: 18px 22px; width: 380px; max-width: 90vw; display: flex; flex-direction: column; gap: 10px; }
        .rename-modal h4 { margin: 0; font-size: 1rem; }
        .rename-key { font-family: monospace; font-size: 0.75rem; color: #888; background: #f5f5f5; padding: 3px 8px; border-radius: 4px; }
        .rename-modal label { display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #555; }
        .rename-modal input { padding: 7px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.88rem; }
        .rename-hint { font-size: 0.74rem; color: #999; }
        .rename-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
        .rename-actions button { padding: 6px 16px; border-radius: 4px; border: 1px solid #ccc; background: #fafafa; cursor: pointer; }
        .rename-actions .rename-cancel { background: #b05050; border-color: #b05050; color: white; }
        .rename-actions .rename-cancel:hover { background: #9c4444; }
        .rename-actions .rename-save { background: #4CAF50; border-color: #4CAF50; color: white; font-weight: bold; }
        .category-section { margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 20px; }
        .category-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            border-bottom: 2px solid #f0f0f0; 
            padding-bottom: 10px; 
            margin-bottom: 20px;
            position: sticky;
            top: -20px; /* Account for parent padding */
            background: white;
            z-index: 100;
            margin-top: -20px; /* Offset parent padding */
            padding-top: 20px;
        }
        .category-header h3 { margin: 0; color: #333; }
        .bulk-edit-btn { background: #673ab7; color: white !important; border: none; padding: 6px 18px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: bold; box-shadow: 0 2px 4px rgba(103, 58, 183, 0.2); transition: background 0.2s; }
        .bulk-edit-btn:hover { background: #5e35b1; }
        .add-tier-btn { width: 100%; padding: 12px; background: #fcfcfc; border: 2px dashed #ddd; color: #666 !important; cursor: pointer; border-radius: 6px; font-weight: bold; font-size: 0.9rem; transition: all 0.2s; }
        .add-tier-btn:hover { background: #fff; border-color: #2196F3; color: #2196F3 !important; }
        
        .disabled { opacity: 0.5; pointer-events: none; }
      `}</style>
    </div>
  );
};

export default CategoryView;
