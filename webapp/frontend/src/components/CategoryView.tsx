import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TierStyleEditor from './TierStyleEditor';
import TierItemManager from './TierItemManager';
import { resolveStyle } from '../utils/styleResolver';
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
  const [themeData, setThemeData] = useState<any>(null);
  const [parsedConfig, setParsedConfig] = useState<any>(null);
  const [tierItems, setTierItems] = useState<Record<string, TierItem[]>>({});
  const [itemsLoading, setItemsLoading] = useState(false);

  const API_BASE_URL = 'http://localhost:8000';

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
    setItemsLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tier-items`, { tier_keys: keys });
      setTierItems(res.data.items);
    } catch (err) {
      console.error("Failed to load tier items", err);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleTierUpdate = (categoryKey: string, tierKey: string, newStyle: any) => {
    if (!parsedConfig) return;
    const newConfig = JSON.parse(JSON.stringify(parsedConfig));
    const currentTheme = newConfig[categoryKey][tierKey].theme || {};
    newConfig[categoryKey][tierKey].theme = { ...currentTheme, ...newStyle };
    const jsonString = JSON.stringify(newConfig, null, 2);
    setParsedConfig(newConfig);
    onConfigContentChange(jsonString);
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

  if (!themeData || !parsedConfig) return <div>Loading category data...</div>;

  return (
    <div className="category-view">
      <h2 className="editor-title">Category Editor: {configPath.split('/').pop()}</h2>
      
      {Object.keys(parsedConfig).map(categoryKey => {
        if (categoryKey.startsWith('//')) return null;
        const categoryData = parsedConfig[categoryKey];
        const catName = categoryData._meta?.localization?.[language] || categoryKey;
        
        const allTiers = Object.keys(categoryData).filter(k => !k.startsWith('//') && k !== '_meta');

        return (
          <div key={categoryKey} className="category-section">
            <h3>{catName}</h3>
            
            {allTiers.map(tierKey => {
              const tierData = categoryData[tierKey];
              const resolved = resolveStyle(tierData, themeData);
              const items = tierItems[tierKey] || [];

              // Construct dynamic localized tier name
              const tierNum = tierData.theme?.Tier !== undefined ? tierData.theme.Tier : "?";
              const displayTierName = language === 'ch' 
                ? `T${tierNum} ${catName}` 
                : `Tier ${tierNum} ${catName}`;

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
                    allTiers={allTiers}
                    onMoveItem={handleMoveItem}
                    language={language}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
      
      <style>{`
        .category-view { padding-bottom: 50px; }
        .editor-title { font-size: 1.1rem; color: #888; margin-bottom: 20px; }
        .category-section { margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 20px; }
        .category-section h3 { border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-top: 0; color: #333; }
        .tier-block { margin-bottom: 20px; border: 1px solid #eee; border-radius: 4px; padding: 10px; }
      `}</style>
    </div>
  );
};

export default CategoryView;