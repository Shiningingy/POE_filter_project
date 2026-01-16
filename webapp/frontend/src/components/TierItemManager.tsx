import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation, getItemName } from '../utils/localization';
import type { Language } from '../utils/localization';
import ContextMenu from './ContextMenu';
import ItemTooltip from './ItemTooltip';
import ItemCard from './ItemCard';

interface TierItem {
  name: string;
  name_ch?: string;
  source: string;
  current_tier?: string;
  current_tiers?: string[];
  category_ch?: string;
  sub_type?: string;
}

interface TierOption {
  key: string;
  label: string;
  show_in_editor?: boolean;
}

interface TierItemManagerProps {
  tierKey: string;
  items: TierItem[];
  allTiers: TierOption[]; 
  onMoveItem: (item: TierItem, newTier: string, isAppend?: boolean, oldTier?: string) => void;
  onDeleteItem: (item: TierItem, fromTier: string) => void;
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
        setSuggestions(res.data.results.map((r: any) => ({ ...r, source: r.source_file })));
      } catch (e) {
        console.error(e);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [addSearch]);

  const handleAddItem = (item: TierItem) => {
    // Check if item is T0 by origin
    const isT0ByOrigin = item.current_tiers?.some(tk => {
        const opt = allTiers.find(o => o.key === tk);
        return opt && opt.show_in_editor === false;
    });

    const targetTierOpt = allTiers.find(o => o.key === tierKey);
    if (isT0ByOrigin && targetTierOpt?.is_hide_tier) {
        const confirmMsg = t.t0MoveWarning.replace("{name}", item.name_ch || item.name);
        if (!window.confirm(confirmMsg)) return;
    }

    onMoveItem(item, tierKey, true); // isAppend = true
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

  const renderTierLabels = (tier: string | string[] | undefined | null, catCh?: string) => {
      if (!tier) return [t.untiered];
      const tiers = Array.isArray(tier) ? tier : [tier];
      return tiers.map(tk => {
          const match = tk.match(/Tier (\d+)(?: (.*))?/);
          if (match) {
              const num = match[1];
              const suffix = match[2];
              if (language === 'ch' && catCh) return `T${num} ${catCh}`;
              if (suffix) return `T${num} ${suffix}`;
              return `T${num}`;
          }
          return tk;
      });
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
                  <li key={s.name} onClick={() => handleAddItem(s)} className="suggestion-item">
                    <ItemCard 
                      item={s}
                      language={language}
                      showStagedIndicator={false}
                    />
                    <div className="source-tags">
                        {renderTierLabels(s.current_tier, s.category_ch).map((lbl, idx) => (
                            <span key={idx} className="source-hint">{lbl}</span>
                        ))}
                    </div>
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
            {filteredItems.map(item => {
              const currentTierOpt = allTiers.find(opt => opt.key === tierKey);
              const isLocationLocked = currentTierOpt && currentTierOpt.show_in_editor === false;
              
              const isT0ByOrigin = item.current_tiers?.some(tk => {
                  const opt = allTiers.find(o => o.key === tk);
                  return opt && opt.show_in_editor === false;
              });

              const isLocked = isLocationLocked && isT0ByOrigin;

              return (
                <ItemCard 
                  key={item.name}
                  item={item}
                  language={language}
                  onContextMenu={(e) => handleRightClick(e, item)}
                  onDelete={isLocked ? undefined : () => onDeleteItem(item, tierKey)}
                  className={isLocked ? 'locked' : ''}
                />
              );
            })}
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
            ...allTiers.map(tOption => {
                const isT0ByOrigin = contextMenu.item.current_tiers?.some(tk => {
                    const opt = allTiers.find(o => o.key === tk);
                    return opt && opt.show_in_editor === false;
                });
                const isLocationLocked = (() => {
                    const opt = allTiers.find(o => o.key === tierKey);
                    return opt && opt.show_in_editor === false;
                })();

                const isLocked = isLocationLocked && isT0ByOrigin;

                return {
                    label: tOption.label,
                    color: getTierColor(tOption.key),
                    onClick: () => {
                        if (isT0ByOrigin && tOption.is_hide_tier) {
                            const confirmMsg = t.t0MoveWarning.replace("{name}", contextMenu.item.name_ch || contextMenu.item.name);
                            if (!window.confirm(confirmMsg)) return;
                        }
                        onMoveItem(contextMenu.item, tOption.key, false, tierKey);
                    },
                    disabled: isLocked
                };
            }),
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
        .suggestions-list { 
            position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; 
            background: #fff; border: 1px solid #ced4da; border-radius: 6px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 250px; 
            overflow-y: auto; padding: 5px; list-style: none; 
        }
        .suggestion-item { padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-radius: 4px; }
        .suggestion-item:hover { background: #e7f5ff; }
        .suggestion-item > div:first-child { flex: 1; }
        
        .source-tags { display: flex; gap: 4px; margin-left: 10px; }
        .source-hint { color: #6c757d; font-size: 0.75rem; font-weight: bold; background: #f8f9fa; padding: 2px 6px; border-radius: 4px; border: 1px solid #e9ecef; white-space: nowrap; }

        .filter-area { margin-bottom: 12px; }

        .item-grid { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
        .empty-msg { width: 100%; text-align: center; color: #adb5bd; padding: 20px; font-size: 0.85rem; font-style: italic; }
      `}</style>
    </div>
  );
};

export default TierItemManager;