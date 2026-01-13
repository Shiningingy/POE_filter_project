import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import TierStyleEditor from './TierStyleEditor';
import TierItemManager from './TierItemManager';
import BulkTierEditor from './BulkTierEditor';
import RuleManager from './RuleManager';
import { resolveStyle } from '../utils/styleResolver';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface CategoryViewProps {
  configPath: string;
  configContent: string;
  onConfigContentChange: (newContent: string) => void;
  loading: boolean;
  language: Language;
}

interface TierItem {
  name: string;
  name_ch?: string;
  source: string;
}

const CategoryView: React.FC<CategoryViewProps> = ({ 
  configPath, 
  configContent, 
  onConfigContentChange,
  loading,
  language
}) => {
  const t = useTranslation(language);
  const [themeData, setThemeData] = useState<any>(null);
  const [parsedConfig, setParsedConfig] = useState<any>(null);
  const [tierItems, setTierItems] = useState<Record<string, TierItem[]>>({});
  const [activeTab, setActiveTab] = useState<'tiers' | 'rules'>('tiers');

  // Bulk Edit State
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [activeBulkClass, setActiveBulkClass] = useState<string | null>(null);
  const [activeBulkOptions, setActiveBulkOptions] = useState<any[]>([]);

  const API_BASE_URL = 'http://localhost:8000';

  // --- 1. All Hooks must be at the top level ---

  // Flattened items for RuleManager suggestions
  const allItemsInTiers = useMemo(() => {
    const list: string[] = [];
    Object.values(tierItems).forEach(items => items.forEach(i => list.push(i.name)));
    return Array.from(new Set(list));
  }, [tierItems]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/themes/sharket`)
      .then(res => setThemeData(res.data.theme_data))
      .catch(err => console.error("Failed to load theme:", err));
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(configContent);
      setParsedConfig(parsed);
      
      const keys: string[] = [];
      Object.keys(parsed).forEach(cat => {
        if (!cat.startsWith('//')) {
          Object.keys(parsed[cat]).forEach(k => {
            if (!k.startsWith('//') && k !== '_meta') keys.push(k);
          });
        }
      });
      
      if (keys.length > 0) {
        fetchTierItems(keys);
      }
    } catch (e) {
      // Ignore
    }
  }, [configContent]);

  const fetchTierItems = async (keys: string[]) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tier-items`, { tier_keys: keys });
      setTierItems(res.data.items);
    } catch (err) {
      console.error("Failed to load tier items", err);
    }
  };

  const handleTierUpdate = (categoryKey: string, tierKey: string, newStyle: any) => {
    if (!parsedConfig) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const currentTheme = newConfig[categoryKey][tierKey].theme || {};
    newConfig[categoryKey][tierKey].theme = { ...currentTheme, ...newStyle };
    onConfigContentChange(JSON.stringify(newConfig, null, 2));
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

  const handleUpdateOverride = async (item: TierItem, overrides: any) => {
    try {
      await axios.post(`${API_BASE_URL}/api/update-item-override`, {
        item_name: item.name,
        overrides: overrides,
        source_file: item.source
      });
      alert("Override applied successfully!");
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

  const handleRulesChange = (categoryKey: string, newRules: any[]) => {
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    if (!newConfig[categoryKey]._meta) newConfig[categoryKey]._meta = {};
    newConfig[categoryKey]._meta.rules = newRules;
    onConfigContentChange(JSON.stringify(newConfig, null, 2));
  };

  // --- 2. Conditional returns MUST happen after hooks ---
  if (!themeData || !parsedConfig) return <div>{t.loading}</div>;

  return (
    <div className="category-view">
      <div className="view-tabs">
        <button className={activeTab === 'tiers' ? 'active' : ''} onClick={() => setActiveTab('tiers')}>Tiers</button>
        <button className={activeTab === 'rules' ? 'active' : ''} onClick={() => setActiveTab('rules')}>Rules</button>
      </div>

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

        if (activeTab === 'rules') {
            return (
                <div key={categoryKey} className="category-section">
                    <h3>{catName} - {t.rules}</h3>
                    <RuleManager 
                        rules={categoryData._meta?.rules || []}
                        onChange={(newRules) => handleRulesChange(categoryKey, newRules)}
                        language={language}
                        availableItems={allItemsInTiers}
                    />
                </div>
            );
        }

        return (
          <div key={categoryKey} className="category-section">
            <div className="category-header">
                <h3>{catName}</h3>
                <button className="bulk-edit-btn" onClick={() => {
                    setActiveBulkClass(themeCategory);
                    setActiveBulkOptions(tierOptions);
                    setShowBulkEditor(true);
                }}>⚡ {language === 'ch' ? '批量编辑' : 'Bulk Edit'}</button>
            </div>
            
            {tierKeys.map(tierKey => {
              const tierData = categoryData[tierKey];
              const resolved = resolveStyle(tierData, themeData);
              const items = tierItems[tierKey] || [];
              const tierNum = tierData.theme?.Tier !== undefined ? tierData.theme.Tier : "?";
              const displayTierName = language === 'ch' ? `T${tierNum} ${catName}` : `Tier ${tierNum} ${catName}`;

              return (
                <div key={tierKey} className="tier-block">
                  <TierStyleEditor
                    tierName={displayTierName}
                    style={resolved}
                    onChange={(newStyle) => handleTierUpdate(categoryKey, tierKey, newStyle)}
                    language={language}
                  />
                  <TierItemManager 
                    tierKey={tierKey}
                    items={items}
                    allTiers={tierOptions}
                    onMoveItem={handleMoveItem}
                    onUpdateOverride={handleUpdateOverride}
                    language={language}
                  />
                </div>
              );
            })}
            <button className="add-tier-btn" onClick={() => handleAddTier(categoryKey)}>+ {language === 'ch' ? '添加新阶级' : 'Add New Tier'}</button>
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
        .view-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #ddd; }
        .view-tabs button { padding: 8px 20px; border: none; background: none; cursor: pointer; border-bottom: 3px solid transparent; }
        .view-tabs button.active { border-bottom-color: #2196F3; font-weight: bold; }
        .category-view { padding-bottom: 50px; }
        .category-section { margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 20px; }
        .category-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 20px; }
        .category-header h3 { margin: 0; color: #333; }
        .bulk-edit-btn { background: #673ab7; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
        .tier-block { margin-bottom: 20px; border: 1px solid #eee; border-radius: 4px; padding: 10px; }
        .add-tier-btn { width: 100%; padding: 10px; background: #f9f9f9; border: 2px dashed #ddd; color: #888; cursor: pointer; border-radius: 4px; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default CategoryView;