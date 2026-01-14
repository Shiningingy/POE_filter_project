import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import TierStyleEditor from './TierStyleEditor';
import TierItemManager from './TierItemManager';
import BulkTierEditor from './BulkTierEditor';
import RuleManager from './RuleManager';
import { resolveStyle } from '../utils/styleResolver';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

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
  fetchTierItems
}) => {
  const t = useTranslation(language);
  const [themeData, setThemeData] = useState<any>(null);
  const [soundMap, setSoundMap] = useState<any>(null);
  const [parsedConfig, setParsedConfig] = useState<any>(null);

  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [activeBulkClass, setActiveBulkClass] = useState<string | null>(null);
  const [activeBulkOptions, setActiveBulkOptions] = useState<any[]>([]);

  const API_BASE_URL = 'http://localhost:8000';

  const allItemsInTiers = useMemo(() => {
    const list: string[] = [];
    Object.values(tierItems).forEach(items => items.forEach(i => list.push(i.name)));
    return Array.from(new Set(list));
  }, [tierItems]);

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

  const handleTierUpdate = (categoryKey: string, tierKey: string, newStyle: any, newVisibility: boolean, themeCategory: string) => {
    if (!parsedConfig) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const currentTheme = newConfig[categoryKey][tierKey].theme || {};
    newConfig[categoryKey][tierKey].theme = { ...currentTheme, ...newStyle };
    newConfig[categoryKey][tierKey].hideable = newVisibility;
    onConfigContentChange(JSON.stringify(newConfig, null, 2));

    const displayTierName = language === 'ch' 
        ? `T${newStyle.Tier ?? "?"} ${newConfig[categoryKey]._meta?.localization?.ch ?? categoryKey}` 
        : `Tier ${newStyle.Tier ?? "?"} ${newConfig[categoryKey]._meta?.localization?.en ?? categoryKey}`;
    
    onInspectTier({ 
        key: tierKey, 
        name: displayTierName, 
        style: resolveStyle(newConfig[categoryKey][tierKey], themeData, soundMap), 
        visibility: newVisibility,
        category: themeCategory,
        rules: newConfig[categoryKey]._meta?.rules?.filter((r: any) => 
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

  const handleAddTier = (categoryKey: string) => {
    if (!parsedConfig) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const categoryData = newConfig[categoryKey];
    const existingTiers = Object.keys(categoryData).filter(k => k.startsWith('Tier'));
    let maxNum = -1;
    existingTiers.forEach(k => {
        const tNum = categoryData[k].theme?.Tier;
        if (typeof tNum === 'number' && tNum > maxNum) maxNum = tNum;
    });
    const nextNum = maxNum + 1;
    const newTierKey = `Tier ${nextNum} ${categoryKey}`;
    categoryData[newTierKey] = {
      hideable: false,
      theme: { Tier: nextNum },
      sound: { default_sound_id: -1, sharket_sound_id: null },
      localization: { en: newTierKey, ch: `T${nextNum} ${categoryData._meta?.localization?.ch || categoryKey}` }
    };
    if (categoryData._meta?.tier_order) categoryData._meta.tier_order.push(newTierKey);
    onConfigContentChange(JSON.stringify(newConfig, null, 2));
  };

  const handleRulesChange = (categoryKey: string, newRules: any[], tierKey?: string, tierName?: string, themeCategory?: string) => {
    if (!parsedConfig) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    if (!newConfig[categoryKey]._meta) newConfig[categoryKey]._meta = {};
    newConfig[categoryKey]._meta.rules = newRules;
    onConfigContentChange(JSON.stringify(newConfig, null, 2));

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

  if (!themeData || !parsedConfig) return <div>{t.loading}</div>;

  return (
    <div className="category-view">
      {Object.keys(parsedConfig).map(categoryKey => {
        if (categoryKey.startsWith('//')) return null;
        const categoryData = parsedConfig[categoryKey];
        const catName = categoryData._meta?.localization?.[language] || categoryKey;
        const themeCategory = categoryData._meta?.theme_category || categoryKey;
        const tierKeys = Object.keys(categoryData).filter(k => !k.startsWith('//') && k !== '_meta');
        
        const tierOptions = tierKeys.map(tk => {
            const td = categoryData[tk];
            const tNum = td.theme?.Tier !== undefined ? td.theme.Tier : "?";
            return { key: tk, label: language === 'ch' ? `T${tNum} ${catName}` : `Tier ${tNum} ${catName}` };
        });

        return (
          <div key={categoryKey} className="category-section">
            <div className="category-header">
                <h3>{catName}</h3>
                <button className="bulk-edit-btn" onClick={() => {
                    setActiveBulkClass(themeCategory);
                    setActiveBulkOptions(tierOptions);
                    setShowBulkEditor(true);
                }}>⚡ {t.bulkEdit}</button>
            </div>
            
            {tierKeys.map(tierKey => {
              const tierData = categoryData[tierKey];
              const resolved = resolveStyle(tierData, themeData, soundMap);
              const items = tierItems[tierKey] || [];
              const tierNum = tierData.theme?.Tier !== undefined ? tierData.theme.Tier : "?";
              const displayTierName = language === 'ch' ? `T${tierNum} ${catName}` : `Tier ${tierNum} ${catName}`;

              return (
                <div key={tierKey} className="tier-block">
                  <TierStyleEditor
                    tierName={displayTierName}
                    style={resolved}
                    visibility={!!tierData.hideable}
                    onChange={(newStyle, newVis) => handleTierUpdate(categoryKey, tierKey, newStyle, newVis, themeCategory)}
                    language={language}
                    onInspect={() => onInspectTier({ 
                        key: tierKey, 
                        name: displayTierName, 
                        style: resolved, 
                        visibility: !!tierData.hideable, 
                        category: themeCategory,
                        rules: categoryData._meta?.rules?.filter((r: any) => 
                            !r.targets?.length || r.targets.some((t: string) => items.some(i => i.name === t))
                        ) || [],
                        baseTypes: items.map(i => i.name)
                    })}
                    onCopy={() => onCopyStyle(resolved)}
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
                    allRules={categoryData._meta?.rules || []}
                    onGlobalRulesChange={(newRules) => handleRulesChange(categoryKey, newRules, tierKey, displayTierName, themeCategory)}
                    onRuleEdit={onRuleEdit}
                    language={language}
                    availableItems={items.map(i => i.name)}
                    categoryName={themeCategory}
                    translationCache={itemTranslationCache}
                  />
                </div>
              );
            })}
            <button className="add-tier-btn" onClick={() => handleAddTier(categoryKey)}>+ {t.addNewTier}</button>
          </div>
        );
      })}

      {showBulkEditor && activeBulkClass && (
        <BulkTierEditor 
            className={activeBulkClass}
            availableTiers={activeBulkOptions}
            language={language}
            onClose={() => setShowBulkEditor(false)}
            onSave={() => fetchTierItems(Object.keys(tierItems))}
        />
      )}
      
      <style>{`
        .category-view { padding-bottom: 50px; max-width: 1200px; margin: 0 auto; width: 100%; }
        .category-section { margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 20px; }
        .category-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 20px; }
        .category-header h3 { margin: 0; color: #333; }
        .bulk-edit-btn { background: #673ab7; color: white !important; border: none; padding: 6px 18px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; font-weight: bold; box-shadow: 0 2px 4px rgba(103, 58, 183, 0.2); transition: background 0.2s; }
        .bulk-edit-btn:hover { background: #5e35b1; }
        .tier-block { margin-bottom: 20px; border: 1px solid #eee; border-radius: 4px; padding: 15px; background: #fff; }
        .add-tier-btn { width: 100%; padding: 12px; background: #fcfcfc; border: 2px dashed #ddd; color: #666 !important; cursor: pointer; border-radius: 6px; font-weight: bold; font-size: 0.9rem; transition: all 0.2s; }
        .add-tier-btn:hover { background: #fff; border-color: #2196F3; color: #2196F3 !important; }
      `}</style>
    </div>
  );
};

export default CategoryView;
