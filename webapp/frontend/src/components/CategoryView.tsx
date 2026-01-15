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
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import tierTemplate from '../config/tierTemplate.json';

interface TierItem {
  name: string;
  name_ch?: string;
  source: string;
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
  defaultMappingPath
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
    
    // Assuming single category per file for now (standard in this project)
    const catKey = Object.keys(parsedConfig).find(k => !k.startsWith('//'));
    if (!catKey) return { activeCategoryKey: null, activeCategoryData: null, sortedTierKeys: [] };

    const catData = parsedConfig[catKey];
    let keys = Object.keys(catData).filter(k => !k.startsWith('//') && k !== '_meta');

    if (catData._meta?.tier_order) {
        const order = catData._meta.tier_order;
        keys.sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1; // Unordered go to end
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }

    return { activeCategoryKey: catKey, activeCategoryData: catData, sortedTierKeys: keys };
  }, [parsedConfig]);

  const updateConfig = (newConfig: any) => {
      onConfigContentChange(JSON.stringify(newConfig, null, 2));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!activeCategoryKey || !activeCategoryData) return;
    if (active.id !== over?.id) {
        const oldIndex = sortedTierKeys.indexOf(active.id as string);
        const newIndex = sortedTierKeys.indexOf(over?.id as string);
        
        const newOrder = arrayMove(sortedTierKeys, oldIndex, newIndex);
        
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
        style: resolveStyle(newConfig[activeCategoryKey][tierKey], themeData, soundMap), 
        visibility: newVisibility,
        category: themeCategory,
        rules: newConfig[activeCategoryKey]._meta?.rules?.filter((r: any) => 
            !r.targets?.length || r.targets.some((t: string) => tierItems[tierKey]?.some(i => i.name === t))
        ) || [],
        baseTypes: tierItems[tierKey]?.map(i => i.name) || ["Item Name"]
    });
  };

  const handleMoveItem = async (item: TierItem, newTier: string) => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-item-tier`, {
        item_name: item.name,
        new_tier: newTier,
        source_file: item.source
      });
      fetchTierItems(Object.keys(tierItems));
    } catch (err) {
      console.error("Failed to move item", err);
    }
  };

  const handleDeleteItem = async (item: TierItem) => {
    handleMoveItem(item, ""); 
  };

  const handleUpdateOverride = async (item: TierItem, overrides: any) => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-item-override`, {
        item_name: item.name,
        overrides: overrides,
        source_file: item.source
      });
      fetchTierItems(Object.keys(tierItems));
    } catch (err) {
      console.error(err);
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
        // PASTE
        const { key, num } = getNextTierName(categoryData, activeCategoryKey);
        newTierKey = key;
        tierData = JSON.parse(JSON.stringify(templateData));
        tierData.theme.Tier = num; 
        tierData.localization = { 
            en: newTierKey, 
            ch: `T${num} ${categoryData._meta?.localization?.ch || activeCategoryKey}` 
        };
    } else if (useFixedTemplate) {
        // INSERT CUSTOM
        const { key, num } = getNextCustomTierName(categoryData, activeCategoryKey);
        newTierKey = key;
        tierData = JSON.parse(JSON.stringify(tierTemplate));
        
        const nameEn = `${tierData.name_template?.en || "Custom Tier #"}${num}`;
        const nameCh = `${tierData.name_template?.ch || "自定义阶级 #"}${num}`;
        if (tierData.name_template) delete tierData.name_template;

        tierData.localization = { en: nameEn, ch: nameCh };
        // Ensure theme.Tier is set if needed, or leave as is from template
        if (tierData.theme?.Tier === "custom") {
             // Maybe set to unique number if we want? Or just leave it.
             // If we leave it, multiple custom tiers have same "Tier" prop.
             // It shouldn't break anything except visual "T?" if looking at raw prop.
        }
    } else {
        // ADD STANDARD
        const { key, num } = getNextTierName(categoryData, activeCategoryKey);
        newTierKey = key;
        tierData = {
            hideable: false,
            theme: { Tier: num },
            sound: { default_sound_id: -1, sharket_sound_id: null },
            localization: { en: newTierKey, ch: `T${num} ${categoryData._meta?.localization?.ch || activeCategoryKey}` }
        };
    }
    
    categoryData[newTierKey] = tierData;

    // Update Order
    let newOrder = [...sortedTierKeys];
    if (!categoryData._meta) categoryData._meta = {};
    if (categoryData._meta.tier_order) {
        newOrder = [...categoryData._meta.tier_order];
    }
    
    const insertIdx = position === 'before' ? index : index + 1;
    newOrder.splice(insertIdx, 0, newTierKey);
    
    categoryData._meta.tier_order = newOrder;
    updateConfig(newConfig);
  };

  const handleDeleteTier = (tierKey: string) => {
    if (!activeCategoryKey) return;
    if (!confirm(t.confirmDeleteTier)) return;

    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    delete newConfig[activeCategoryKey][tierKey];
    
    if (newConfig[activeCategoryKey]._meta?.tier_order) {
        newConfig[activeCategoryKey]._meta.tier_order = newConfig[activeCategoryKey]._meta.tier_order.filter((k: string) => k !== tierKey);
    }
    updateConfig(newConfig);
  };

  const handleRulesChange = (categoryKey: string, newRules: any[], tierKey?: string, tierName?: string, themeCategory?: string) => {
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    if (!newConfig[categoryKey]._meta) newConfig[categoryKey]._meta = {};
    newConfig[categoryKey]._meta.rules = newRules;
    updateConfig(newConfig);
    
    if (tierKey && tierName && themeCategory) {
         const tierData = newConfig[categoryKey][tierKey];
         const items = tierItems[tierKey] || [];
         onInspectTier({ 
             key: tierKey, 
             name: tierName, 
             style: resolveStyle(tierData, themeData, soundMap), 
             visibility: !!tierData.hideable, 
             category: themeCategory,
             rules: newRules.filter((r: any) => 
                 !r.targets?.length || r.targets.some((t: string) => items.some(i => i.name === t))
             ),
             baseTypes: items.map(i => i.name)
         });
    }
  };

  const itemTranslationCache = useMemo(() => {
    const cache: Record<string, string> = {};
    Object.values(tierItems).forEach(items => {
        items.forEach(i => {
            if (i.name_ch) cache[i.name] = i.name_ch;
        });
    });
    return cache;
  }, [tierItems]);

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
    // If localization exists, use it? Or stick to T{N}?
    // The previous code forced `T{tNum}`.
    // I should probably use localization if it's a Custom Tier (where tNum might be "custom" or meaningless).
    const locName = td.localization?.[language];
    if (locName && (tk.startsWith('CustomTier') || typeof tNum !== 'number')) {
        return { key: tk, label: locName };
    }
    return { key: tk, label: language === 'ch' ? `T${tNum} ${catName}` : `Tier ${tNum} ${catName}` };
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
                    const resolved = resolveStyle(tierData, themeData, soundMap);
                    const items = tierItems[tierKey] || [];
                    const tierNum = tierData.theme?.Tier !== undefined ? tierData.theme.Tier : "?";
                    
                    // Improved display name logic
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
                                onChange={(newStyle, newVis) => handleTierUpdate(tierKey, newStyle, newVis, themeCategory)}
                                language={language}
                                onInspect={() => onInspectTier({ 
                                    key: tierKey, 
                                    name: displayTierName, 
                                    style: resolved, 
                                    visibility: !!tierData.hideable, 
                                    category: themeCategory,
                                    rules: activeCategoryData._meta?.rules?.filter((r: any) => 
                                        !r.targets?.length || r.targets.some((t: string) => items.some(i => i.name === t))
                                    ) || [],
                                    baseTypes: items.map(i => i.name)
                                })}
                                onCopy={() => onCopyStyle(resolved)}
                                onPaste={() => {}} // Disabled/Hidden
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
                                language={language}
                            />
                            <RuleManager 
                                tierKey={tierKey}
                                allRules={activeCategoryData._meta?.rules || []}
                                onGlobalRulesChange={(newRules) => handleRulesChange(activeCategoryKey, newRules, tierKey, displayTierName, themeCategory)}
                                onRuleEdit={onRuleEdit}
                                language={language}
                                availableItems={items.map(i => i.name)}
                                categoryName={themeCategory}
                                translationCache={itemTranslationCache}
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
            onSave={() => fetchTierItems(Object.keys(tierItems))}
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