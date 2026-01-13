import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import ContextMenu from './ContextMenu';

interface TierItem {
  name: string;
  name_ch?: string;
  source: string;
  current_tier?: string;
}

interface TierOption {
  key: string;
  label: string;
}

interface TierItemManagerProps {
  tierKey: string;
  items: TierItem[];
  allTiers: TierOption[]; 
  onMoveItem: (item: TierItem, newTier: string) => void;
  language: Language;
}

const TierItemManager: React.FC<TierItemManagerProps> = ({ 
  tierKey, 
  items, 
  allTiers, 
  onMoveItem,
  language
}) => {
  const t = useTranslation(language);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [addSearch, setAddSearch] = useState('');
  const [suggestions, setSuggestions] = useState<TierItem[]>([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: TierItem } | null>(null);

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.name_ch && i.name_ch.includes(searchTerm))
  );

  useEffect(() => {
    if (addSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        const res = await axios.get(`http://localhost:8000/api/search-items?q=${encodeURIComponent(addSearch)}`);
        setSuggestions(res.data.results);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [addSearch]);

  const handleAddItem = (item: TierItem) => {
    onMoveItem(item, tierKey);
    setAddSearch('');
    setSuggestions([]);
  };

  const handleRightClick = (e: React.MouseEvent, item: TierItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // Helper to get color for menu dots (simplified)
  const getTierColor = (tk: string) => {
    const match = tk.match(/Tier (\d+)/);
    if (!match) return '#ddd';
    const num = parseInt(match[1]);
    const colors = ['#ff0000', '#e700e7', '#af00ff', '#3400ff', '#0090ff', '#00ffb5', '#00ff2d', '#aeff00', '#ffff00', '#ff9d00'];
    return colors[num] || '#ddd';
  };

  return (
    <div className="tier-item-manager">
      <div className="header" onClick={() => setIsOpen(!isOpen)}>
        <span>📦 {t.itemsInTier} ({items.length})</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="content">
          <div className="add-section">
            <input 
              type="text" 
              placeholder={t.searchPlaceholder} 
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              className="search-box add-input"
            />
            {suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map(s => (
                  <li key={s.name} onClick={() => handleAddItem(s)}>
                    <strong>{language === 'ch' ? s.name_ch : s.name}</strong> 
                    <span className="source-hint">({s.current_tier || 'Unassigned'})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <hr className="divider"/>

          <input 
            type="text" 
            placeholder={t.filterPlaceholder} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-box"
          />
          
          <ul className="item-list">
            {filteredItems.map(item => (
              <li 
                key={item.name} 
                className="item-row" 
                onContextMenu={(e) => handleRightClick(e, item)}
                title="Right-click to change tier"
              >
                <span className="item-name" title={item.source}>
                    {language === 'ch' ? item.name_ch : item.name}
                </span>
                <span className="tier-badge" onClick={(e) => handleRightClick(e as any, item)}>
                    {tierKey.split(' ')[1] || 'T?'}
                </span>
              </li>
            ))}
            {filteredItems.length === 0 && <li className="empty">{t.noItems}</li>}
          </ul>
        </div>
      )}

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={allTiers.map(t => ({
            label: t.label,
            color: getTierColor(t.key),
            onClick: () => onMoveItem(contextMenu.item, t.key)
          }))}
        />
      )}

      <style>{`
        .tier-item-manager { margin-top: 10px; border-top: 1px solid #eee; }
        .header { padding: 8px 0; cursor: pointer; display: flex; justify-content: space-between; color: #666; font-size: 0.9rem; user-select: none; }
        .header:hover { color: #333; }
        .content { padding: 10px; background: #f9f9f9; border-radius: 4px; }
        .search-box { width: 100%; padding: 5px; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 3px; }
        .add-input { border-color: #4CAF50; }
        .suggestions-list { list-style: none; padding: 0; margin: 0; background: white; border: 1px solid #ddd; max-height: 150px; overflow-y: auto; position: absolute; width: 90%; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .suggestions-list li { padding: 5px 10px; cursor: pointer; display: flex; justify-content: space-between; }
        .suggestions-list li:hover { background: #eee; }
        .source-hint { font-size: 0.8rem; color: #888; }
        .add-section { position: relative; margin-bottom: 10px; }
        .divider { border: 0; border-top: 1px solid #ddd; margin: 10px 0; }
        .item-list { list-style: none; padding: 0; margin: 0; max-height: 200px; overflow-y: auto; }
        .item-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; border-bottom: 1px solid #eee; border-radius: 4px; transition: background 0.2s; cursor: context-menu; }
        .item-row:hover { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .item-name { font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
        .tier-badge { background: #eee; color: #666; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: bold; cursor: pointer; }
        .tier-badge:hover { background: #ddd; }
        .empty { color: #999; text-align: center; padding: 10px; font-size: 0.8rem; }
      `}</style>
    </div>
  );
};

export default TierItemManager;
