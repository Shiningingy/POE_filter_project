import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation, getItemName } from '../utils/localization';
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
  onDeleteItem: (item: TierItem) => void;
  onUpdateOverride: (item: TierItem, overrides: any) => void;
  language: Language;
}

const TierItemManager: React.FC<TierItemManagerProps> = ({
  tierKey,
  items,
  allTiers,
  onMoveItem,
  onDeleteItem,
  onUpdateOverride,
  language
}) => {
  const t = useTranslation(language);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [addSearch, setAddSearch] = useState('');
  const [suggestions, setSuggestions] = useState<TierItem[]>([]);

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
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const getTierColor = (tk: string) => {
    const match = tk.match(/Tier (\d+)/);
    if (!match) return '#ddd';
    const num = parseInt(match[1]);
    const colors = ['#ff0000', '#e700e7', '#af00ff', '#3400ff', '#0090ff', '#00ffb5', '#00ff2d', '#aeff00', '#ffff00', '#ff9d00'];
    return colors[num] || '#ddd';
  };

  const handleSoundOverride = (item: TierItem) => {
    const path = prompt("Enter sound file path (e.g. Sharket掉落音效/example.mp3):");
    if (path === null) return;
    const volStr = prompt("Enter volume (0-600):", "300");
    if (volStr === null) return;
    const vol = parseInt(volStr) || 300;
    onUpdateOverride(item, { PlayAlertSound: [path, vol] });
  };

  return (
    <div className="tier-item-manager">
      <div className="mgr-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="mgr-title">📦 {t.itemsInTier} ({items.length})</span>
        <span className="mgr-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="mgr-content">
          <div className="add-area">
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
                    <strong>{getItemName(s, language)}</strong> 
                    <span className="source-hint">({s.current_tier || 'Unassigned'})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="filter-area">
            <input 
                type="text" 
                placeholder={t.filterPlaceholder} 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-box"
            />
          </div>
          
          <div className="item-grid">
            {filteredItems.map(item => (
              <div 
                key={item.name} 
                className="item-block" 
                onContextMenu={(e) => handleRightClick(e, item)}
                title={item.source}
              >
                <span className="item-text">
                    {getItemName(item, language)}
                </span>
                <button className="item-del-btn" onClick={(e) => { e.stopPropagation(); onDeleteItem(item); }}>×</button>
              </div>
            ))}
            {filteredItems.length === 0 && <div className="empty-msg">{t.noItems}</div>}
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={[
            ...allTiers.map(tOption => ({
                label: tOption.label,
                color: getTierColor(tOption.key),
                onClick: () => onMoveItem(contextMenu.item, tOption.key)
            })),
            { label: "divider", onClick: () => {}, divider: true },
            { label: "🎵 Custom Sound Override", onClick: () => handleSoundOverride(contextMenu.item) }
          ].map(opt => ({ ...opt, className: opt.label === "divider" ? "divider" : "" }))}
        />
      )}

      <style>{`
        .tier-item-manager { margin-top: 12px; border-top: 1px solid #eee; padding-top: 5px; }
        .mgr-header { padding: 10px 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #555; transition: color 0.2s; }
        .mgr-header:hover { color: #2196F3; }
        .mgr-title { font-size: 0.95rem; font-weight: 600; }
        .mgr-arrow { font-size: 0.8rem; opacity: 0.5; }

        .mgr-content { padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef; }
        .search-box { width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 0.9rem; background: #fff; }
        .add-input { border-color: #28a745; margin-bottom: 5px; }
        .add-area { position: relative; margin-bottom: 12px; }
        .suggestions-list { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: #fff; border: 1px solid #ced4da; border-top: none; border-radius: 0 0 4px 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 200px; overflow-y: auto; padding: 0; list-style: none; }
        .suggestions-list li { padding: 8px 12px; cursor: pointer; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f3f5; font-size: 0.85rem; }
        .suggestions-list li:hover { background: #e7f5ff; }
        .source-hint { color: #adb5bd; font-size: 0.75rem; }

        .filter-area { margin-bottom: 12px; }

        .item-grid { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
        .item-block { 
            display: flex; align-items: center; gap: 6px; padding: 4px 10px; 
            background: #fff; border: 1px solid #dee2e6; border-radius: 4px;
            font-size: 0.85rem; color: #495057; position: relative;
            transition: all 0.2s; cursor: context-menu;
        }
        .item-block:hover { border-color: #2196F3; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .item-text { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .item-del-btn { 
            background: none; border: none; padding: 0; color: #ced4da; 
            cursor: pointer; font-size: 1.1rem; line-height: 1; margin-left: 4px;
            transition: color 0.2s;
        }
        .item-del-btn:hover { color: #fa5252; }
        .empty-msg { width: 100%; text-align: center; color: #adb5bd; padding: 20px; font-size: 0.85rem; font-style: italic; }
      `}</style>
    </div>
  );
};

export default TierItemManager;