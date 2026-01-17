import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';

import TierStyleEditor from './TierStyleEditor';
import TierItemManager from './TierItemManager';
import BulkTierEditor from './BulkTierEditor';
import RuleManager from './RuleManager';
import SortableTierBlock from './SortableTierBlock';
import ContextMenu from './ContextMenu';
import { resolveStyle } from '../utils/styleResolver';
import { useTranslation, translations } from '../utils/localization';
import type { Language } from '../utils/localization';
import tierTemplate from '../config/tierTemplate.json';

interface TierItem {
  name: string;
  name_ch?: string;
  sub_type?: string;
  match_mode?: 'exact' | 'partial';
  source: string;
  rule_index?: number | null;
}

interface CategoryViewProps {
  configPath: string;
  configContent: string;
  onConfigContentChange: (newContent: string) => void;
  loading: boolean;
  language: Language;
  onInspectTier: (tier: any) => void;
  onCopyStyle: (style: any) => void;
  onRuleEdit: (tierKey: string, idx: number | null) => void;
  viewerBackground: string;
  tierItems: Record<string, TierItem[]>;
  fetchTierItems: (keys: string[]) => void;
  defaultMappingPath?: string;
  onUpdateTierItems?: (tierKey: string, items: TierItem[]) => void;
}

const CategoryView: React.FC<CategoryViewProps> = ({
  configPath,
  configContent,
  onConfigContentChange,
  loading,
  language,
  onInspectTier,
  onCopyStyle,
  onRuleEdit,
  viewerBackground,
  tierItems,
  fetchTierItems,
  defaultMappingPath,
  onUpdateTierItems
}) => {
  const t = useTranslation(language);
  const [themeData, setThemeData] = useState<any>(null);
  const [soundMap, setSoundMap] = useState<any>(null);
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
  const [activeRuleIndex, setActiveRuleIndex] = useState<{ tierKey: string, index: number } | null>(null);

  const API_BASE_URL = 'http://localhost:8000';

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/themes/sharket`)
      .then(res => {
          setThemeData(res.data.theme_data);
          setSoundMap(res.data.sound_map_data);
      })
      .catch(err => console.error("Failed to load theme", err));
  }, []);

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
  const { activeCategoryKey, activeCategoryData, sortedTierKeys } = useMemo(() => {
    if (!parsedConfig) return { activeCategoryKey: null, activeCategoryData: null, sortedTierKeys: [] };
    
    const catKey = Object.keys(parsedConfig).find(k => !k.startsWith('//'));
    if (!catKey) return { activeCategoryKey: null, activeCategoryData: null, sortedTierKeys: [] };

    const catData = parsedConfig[catKey];
    let keys = Object.keys(catData).filter(k => !k.startsWith('//') && k !== '_meta' && k !== 'rules');

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

    return { activeCategoryKey: catKey, activeCategoryData: catData, sortedTierKeys: keys };
  }, [parsedConfig]);

  const updateConfig = (newConfig: any) => {
      onConfigContentChange(JSON.stringify(newConfig, null, 2));
  };

  const getTierOrderScore = (key: string) => {
      if (key.startsWith('CustomTier')) return null;
      if (key.includes('Tier 0')) return 0;
      if (key.includes('Hide')) return 9;
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
        
        const t0IdxOriginal = sortedTierKeys.findIndex(key => getTierOrderScore(key) === 0);
        const activeIsCustom = getTierOrderScore(active.id as string) === null;
        
        if (activeIsCustom && oldIndex > t0IdxOriginal && newIndex <= t0IdxOriginal) {
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
        if (!newConfig[activeCategoryKey]._meta) newConfig[activeCategoryKey]._meta = {};
        newConfig[activeCategoryKey]._meta.tier_order = newOrder;
        
        updateConfig(newConfig);
    }
  };

  const handleTierUpdate = (tierKey: string, newStyle: any, newVisibility: boolean, themeCategory: string) => {
    if (!activeCategoryKey) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const currentTheme = newConfig[activeCategoryKey][tierKey].theme || {};
    newConfig[activeCategoryKey][tierKey].theme = { ...currentTheme, ...newStyle };
    newConfig[activeCategoryKey][tierKey].hideable = newVisibility;
    updateConfig(newConfig);

    const displayTierName = language === 'ch' 
        ? `T${newStyle.Tier ?? "?"} ${newConfig[activeCategoryKey]._meta?.localization?.ch ?? activeCategoryKey}` 
        : `Tier ${newStyle.Tier ?? "?"} ${newConfig[activeCategoryKey]._meta?.localization?.en ?? activeCategoryKey}`;
    
    onInspectTier({ 
        key: tierKey, 
        name: displayTierName, 
        style: resolveStyle(newConfig[activeCategoryKey][tierKey], themeData, themeCategory, soundMap), 
        visibility: newVisibility,
        category: themeCategory,
        rules: newConfig[activeCategoryKey].rules || newConfig[activeCategoryKey]._meta?.rules || [],
        baseTypes: derivedTierItems[tierKey]?.map(i => i.name) || ["Item Name"]
    });
  };

  const handleMoveItem = async (item: TierItem, newTier: string, isAppend: boolean = false, oldTier?: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-item-tier`, {
        item_name: item.name,
        new_tier: newTier,
        source_file: item.source || defaultMappingPath,
        is_append: isAppend,
        old_tier: oldTier
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
        source_file: item.source
      });
      fetchTierItems(sortedTierKeys);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveRuleTarget = (item: TierItem, ruleIndex: number) => {
      if (!activeCategoryKey) return;
      const newConfig = JSON.parse(JSON.stringify(parsedConfig));
      const rules = newConfig[activeCategoryKey].rules || newConfig[activeCategoryKey]._meta?.rules;
      
      if (rules && rules[ruleIndex]) {
          const rule = rules[ruleIndex];
          if (rule.targets) {
              rule.targets = rule.targets.filter((t: string) => t !== item.name);
              updateConfig(newConfig);
              
              const tierKey = sortedTierKeys.find(key => derivedTierItems[key]?.some(i => i.name === item.name && i.rule_index === ruleIndex));
              if (tierKey && onUpdateTierItems) {
                  const newItems = derivedTierItems[tierKey].filter(i => !(i.name === item.name && i.rule_index === ruleIndex));
                  onUpdateTierItems(tierKey, newItems);
              }
          }
      }
  };

  const getNextTierName = (categoryData: any, categoryKey: string) => {
      const existingTiers = Object.keys(categoryData).filter(k => k.startsWith('Tier'));
      let maxNum = -1;
      existingTiers.forEach(k => {
          const tNum = categoryData[k].theme?.Tier;
          if (typeof tNum === 'number' && tNum > maxNum) maxNum = tNum;
      });
      const nextNum = maxNum + 1;
      return { 
          key: `Tier ${nextNum} ${categoryKey}`,
          num: nextNum
      };
  };

  const getNextCustomTierName = (categoryData: any, categoryKey: string) => {
      const existingTiers = Object.keys(categoryData).filter(k => k.startsWith('CustomTier'));
      let maxNum = 0;
      const regex = /CustomTier (\d+)/;
      existingTiers.forEach(k => {
          const match = k.match(regex);
          if (match) {
              const num = parseInt(match[1]);
              if (num > maxNum) maxNum = num;
          }
      });
      const nextNum = maxNum + 1;
      return { 
          key: `CustomTier ${nextNum} ${categoryKey}`,
          num: nextNum
      };
  };

  const handleInsertTier = (index: number, position: 'before' | 'after', templateData: any = null, useFixedTemplate: boolean = true) => {
    if (!activeCategoryKey || !activeCategoryData) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const categoryData = newConfig[activeCategoryKey];
    
    let newTierKey: string;
    let tierData: any;

    if (templateData) {
        const { key, num } = getNextCustomTierName(categoryData, activeCategoryKey);
        newTierKey = key;
        tierData = JSON.parse(JSON.stringify(templateData));
        
        const originalName = templateData.localization?.[language] || "Tier";
        tierData.localization = { 
            en: `${originalName} ${translations.en.copyLabel}`, 
            ch: `${templateData.localization?.ch || originalName} ${translations.ch.copyLabel}` 
        };
        tierData.show_in_editor = true; 
    } else {
        const { key, num } = getNextCustomTierName(categoryData, activeCategoryKey);
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
    
    const insertIdx = position === 'before' ? index : index + 1;
    
    const targetKey = sortedTierKeys[index];
    if (getTierOrderScore(targetKey) === 0 && position === 'before') {
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
            await Promise.all(itemsToUnassign.map(item => 
                axios.post(`${API_BASE_URL}/api/update-item-tier`, {
                    item_name: item.name,
                    new_tier: "",
                    source_file: item.source
                })
            ));
        } catch (e) {
            console.error("Failed to unassign items", e);
            return;
        }
    }

    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    delete newConfig[activeCategoryKey][tierKey];
    
    if (newConfig[activeCategoryKey]._meta?.tier_order) {
        newConfig[activeCategoryKey]._meta.tier_order = newConfig[activeCategoryKey]._meta.tier_order.filter((k: string) => k !== tierKey);
    }
    updateConfig(newConfig);
    
    const remainingKeys = sortedTierKeys.filter(k => k !== tierKey);
    fetchTierItems(remainingKeys);
  };

  const handleRulesChange = (categoryKey: string, newRules: any[], tierKey?: string, tierName?: string, themeCategory?: string) => {
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    newConfig[categoryKey].rules = newRules;
    if (newConfig[categoryKey]._meta?.rules) delete newConfig[categoryKey]._meta.rules;
    
    updateConfig(newConfig);
    fetchTierItems(sortedTierKeys);
    
    if (tierKey && tierName && themeCategory) {
         const tierData = newConfig[categoryKey][tierKey];
         const items = derivedTierItems[tierKey] || [];
         onInspectTier({ 
             key: tierKey, 
             name: tierName, 
             style: resolveStyle(tierData, themeData, themeCategory, soundMap), 
             visibility: !!tierData.hideable, 
             category: themeCategory,
             rules: newRules.filter((r: any) => 
                 !r.targets?.length || r.targets.some((t: string) => items.some(i => i.name === t))
             ),
             baseTypes: items.map(i => i.name)
         });
    }
  };

  const allItemDetails = useMemo(() => {
    const cache: Record<string, any> = {};
    Object.values(tierItems).forEach(items => {
        items.forEach(i => {
            if (!cache[i.name] || (!cache[i.name].sub_type && i.sub_type)) {
                cache[i.name] = { ...i, rule_index: undefined }; // Store without rule_index
            }
        });
    });
    return cache;
  }, [tierItems]);

  const itemTranslationCache = useMemo(() => {
    const cache: Record<string, string> = {};
    Object.values(tierItems).forEach(items => {
        items.forEach(i => {
            if (i.name_ch) cache[i.name] = i.name_ch;
        });
    });
    return cache;
  }, [tierItems]);

  const derivedTierItems = useMemo(() => {
    // If we have tier keys but no items yet, we are likely loading.
    // Return original tierItems to avoid flashing an empty grid.
    const hasAnyItems = Object.keys(tierItems).some(k => tierItems[k]?.length > 0);
    if (!parsedConfig || !activeCategoryKey || !hasAnyItems) return tierItems;
    
    const rules = activeCategoryData?.rules || activeCategoryData?._meta?.rules || [];
    const result: Record<string, TierItem[]> = {};
    
    // 1. Initialize with backend tierItems but only the standard ones (no rule_index)
    sortedTierKeys.forEach(tk => {
        result[tk] = (tierItems[tk] || []).filter(i => i.rule_index === undefined || i.rule_index === null);
    });
    
    // 2. Add items from current frontend rules
    rules.forEach((rule: any, ruleIdx: number) => {
        if (rule.disabled) return;
        const ruleTier = rule.overrides?.Tier;
        if (!ruleTier || !result[ruleTier]) return;

        if (rule.applyToTier) {
            // If "Apply to all", move all current standard items in this tier to be "rule items"
            const standardItems = result[ruleTier].filter(i => i.rule_index === undefined || i.rule_index === null);
            const otherItems = result[ruleTier].filter(i => i.rule_index !== undefined && i.rule_index !== null);
            
            const updatedStandard = standardItems.map(i => ({
                ...i,
                rule_index: ruleIdx
            }));
            
            result[ruleTier] = [...otherItems, ...updatedStandard];
        } else if (rule.targets) {
            rule.targets.forEach((tName: string) => {
                // Find existing details if possible
                const existing = allItemDetails[tName];
                const matchMode = rule.targetMatchModes?.[tName] || 'exact';
                
                // If the item already exists in standardItems, we MOVE it to ruleItems
                const stdIdx = result[ruleTier].findIndex(i => i.name === tName && (i.rule_index === undefined || i.rule_index === null));
                if (stdIdx !== -1) {
                    const item = result[ruleTier][stdIdx];
                    result[ruleTier][stdIdx] = { ...item, rule_index: ruleIdx, match_mode: matchMode };
                } else {
                    // Avoid duplicates if same item is in same tier via same rule
                    const alreadyAdded = result[ruleTier].some(i => i.name === tName && i.rule_index === ruleIdx);
                    if (!alreadyAdded) {
                        result[ruleTier].push({
                            name: tName,
                            name_ch: existing?.name_ch || itemTranslationCache[tName] || tName,
                            sub_type: existing?.sub_type || "Other",
                            source: existing?.source || defaultMappingPath || "",
                            rule_index: ruleIdx,
                            match_mode: matchMode,
                            ...(existing || {})
                        });
                    }
                }
            });
        }
    });
    
    return result;
  }, [tierItems, activeCategoryData?.rules, sortedTierKeys, allItemDetails, itemTranslationCache, activeCategoryKey, defaultMappingPath]);

  const handleContextMenu = (e: React.MouseEvent, tierKey?: string, index?: number) => {
    e.preventDefault();
    setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        tierKey,
        index
    });
  };

  if (!themeData || !parsedConfig || !activeCategoryKey) return <div>{t.loading}</div>;

  const catName = activeCategoryData._meta?.localization?.[language] || activeCategoryKey;
  const themeCategory = activeCategoryData._meta?.theme_category || activeCategoryKey;

  const tierOptions = sortedTierKeys.map(tk => {
    const td = activeCategoryData[tk];
    const tNum = td.theme?.Tier !== undefined ? td.theme.Tier : "?";
    const locName = td.localization?.[language];
    
    const baseOption = { 
        key: tk, 
        show_in_editor: td.show_in_editor !== false,
        is_hide_tier: !!td.is_hide_tier
    };

    if (locName && (tk.startsWith('CustomTier') || typeof tNum !== 'number')) {
        return { ...baseOption, label: locName };
    }
    return { ...baseOption, label: language === 'ch' ? `T${tNum} ${catName}` : `Tier ${tNum} ${catName}` };
  });

  return (
    <div className="category-view" onContextMenu={(e) => handleContextMenu(e)}>
      <div className="category-section">
        <div className="category-header">
            <h3>{catName}</h3>
            <button className="bulk-edit-btn" onClick={() => {
                setActiveBulkClass(themeCategory);
                setActiveBulkOptions(tierOptions);
                setShowBulkEditor(true);
            }}>⚡ {t.bulkEdit}</button>
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
                    const resolved = resolveStyle(tierData, themeData, themeCategory, soundMap);
                    const items = derivedTierItems[tierKey] || [];
                    const tierNum = tierData.theme?.Tier !== undefined ? tierData.theme.Tier : "?";
                    
                    let displayTierName = language === 'ch' ? `T${tierNum} ${catName}` : `Tier ${tierNum} ${catName}`;
                    const locName = tierData.localization?.[language];
                    if (locName && (tierKey.startsWith('CustomTier') || typeof tierNum !== 'number')) {
                        displayTierName = locName;
                    }

                    return (
                        <SortableTierBlock
                            key={tierKey}
                            id={tierKey}
                            onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, tierKey, index); }}
                            onInsertBefore={() => handleInsertTier(index, 'before')}
                            onInsertAfter={() => handleInsertTier(index, 'after')}
                            language={language}
                            tooltips={{
                                drag: t.dragToReorder,
                                insertBefore: t.insertTierBefore,
                                insertAfter: t.insertTierAfter,
                                above: t.above,
                                below: t.below
                            }}
                        >
                            <TierStyleEditor
                                tierName={displayTierName}
                                style={resolved}
                                visibility={!!tierData.hideable}
                                canHide={tierData.show_in_editor !== false}
                                onChange={(newStyle, newVis) => handleTierUpdate(tierKey, newStyle, newVis, themeCategory)}
                                language={language}
                                onInspect={() => onInspectTier({ 
                                    key: tierKey, 
                                    name: displayTierName, 
                                    style: resolved, 
                                    visibility: !!tierData.hideable, 
                                    category: themeCategory,
                                    rules: activeCategoryData.rules || activeCategoryData._meta?.rules || [],
                                    baseTypes: items.map(i => i.name)
                                })}
                                onCopy={() => onCopyStyle(resolved)}
                                onPaste={() => {}} 
                                canPaste={false}
                                viewerBackground={viewerBackground}
                            />
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
                            />
                            <RuleManager 
                                tierKey={tierKey}
                                allRules={activeCategoryData.rules || activeCategoryData._meta?.rules || []}
                                onGlobalRulesChange={(newRules) => handleRulesChange(activeCategoryKey, newRules, tierKey, displayTierName, themeCategory)}
                                onRuleEdit={onRuleEdit}
                                language={language}
                                availableItems={items}
                                categoryName={themeCategory}
                                translationCache={itemTranslationCache}
                                availableTiers={tierOptions}
                                activeRuleIndex={activeRuleIndex?.tierKey === tierKey ? activeRuleIndex.index : null}
                            />
                        </SortableTierBlock>
                    );
                })}
            </SortableContext>
        </DndContext>

        <button className="add-tier-btn" onClick={() => handleInsertTier(sortedTierKeys.length, 'after', null, false)}>+ {t.addNewTier}</button>
      </div>

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
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          options={[
            ...(contextMenu.tierKey ? [
                { label: t.copyTier, onClick: () => {
                    const data = activeCategoryData[contextMenu.tierKey!];
                    setTierClipboard(data);
                }},
                { label: t.deleteTier, onClick: () => handleDeleteTier(contextMenu.tierKey!) },
                { divider: true, label: '', onClick: () => {} }
            ] : []),
            { label: t.insertBefore, onClick: () => contextMenu.index !== undefined ? handleInsertTier(contextMenu.index, 'before') : handleInsertTier(0, 'before') },
            { label: t.insertAfter, onClick: () => contextMenu.index !== undefined ? handleInsertTier(contextMenu.index, 'after') : handleInsertTier(sortedTierKeys.length, 'after') },
            { 
                label: t.pasteTier, 
                onClick: () => contextMenu.index !== undefined ? handleInsertTier(contextMenu.index + 1, 'before', tierClipboard) : handleInsertTier(sortedTierKeys.length, 'after', tierClipboard),
                className: !tierClipboard ? 'disabled' : '' 
            }
          ]}
        />
      )}
      
      <style>{`
        .category-view { padding-bottom: 50px; max-width: 1200px; margin: 0 auto; width: 100%; min-height: 400px; }
        .category-section { margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 20px; }
        .category-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 20px; }
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