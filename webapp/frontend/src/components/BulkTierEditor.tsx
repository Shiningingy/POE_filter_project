import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface Item {
  name: string;
  name_ch: string;
  current_tier: string | null;
  source_file: string;
}

interface TierOption {
  key: string;
  label: string;
}

interface BulkTierEditorProps {
  className: string; 
  availableTiers: TierOption[];
  language: Language;
  onClose: () => void;
  onSave: () => void;
}

const BulkTierEditor: React.FC<BulkTierEditorProps> = ({ 
  className, 
  availableTiers, 
  language, 
  onClose,
  onSave
}) => {
  const t = useTranslation(language);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTierKey, setSelectedTierKey] = useState(availableTiers[0]?.key || '');
  
  const [stagedChanges, setStagedChanges] = useState<Record<string, string>>({});

  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/class-items/${encodeURIComponent(className)}`);
        setItems(res.data.items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [className]);

  const filteredItems = useMemo(() => {
    return items.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.name_ch.includes(searchTerm)
    );
  }, [items, searchTerm]);

  const handleItemClick = (name: string) => {
    setStagedChanges(prev => {
      const next = { ...prev };
      if (next[name] === selectedTierKey) {
        delete next[name];
      } else {
        next[name] = selectedTierKey;
      }
      return next;
    });
  };

  const handleApply = async () => {
    const changeCount = Object.keys(stagedChanges).length;
    if (changeCount === 0) return;
    
    setLoading(true);
    try {
      const promises = Object.entries(stagedChanges).map(([itemName, newTier]) => {
        const item = items.find(i => i.name === itemName);
        return axios.post(`${API_BASE_URL}/api/update-item-tier`, {
          item_name: itemName,
          new_tier: newTier,
          source_file: item?.source_file || `${className}.json`
        });
      });

      await Promise.all(promises);
      alert(`${changeCount} items updated!`);
      onSave(); 
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update some items.");
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tierKey: string | null) => {
    if (!tierKey) return 'white';
    const match = tierKey.match(/Tier (\d+)/);
    if (!match) return '#f0f0f0';
    const num = parseInt(match[1]);
    const colors = [
      '#ffebee', '#f3e5f5', '#e8eaf6', '#e3f2fd', '#e0f2f1', 
      '#f1f8e9', '#fffde7', '#fff3e0', '#efebe9', '#fafafa'
    ];
    return colors[num] || '#f0f0f0';
  };

  const stagedCount = Object.keys(stagedChanges).length;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Bulk Edit: {className}</h2>
          <div className="header-meta">
             <span className="staged-badge">{stagedCount} items staged</span>
             <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="bulk-toolbar">
          <div className="brush-tool">
            <span className="label">Active Tier (Brush): </span>
            <select 
                value={selectedTierKey} 
                onChange={e => setSelectedTierKey(e.target.value)}
                style={{ 
                    backgroundColor: getTierColor(selectedTierKey),
                    fontWeight: 'bold'
                }}
            >
              {availableTiers.map(tier => (
                <option 
                    key={tier.key} 
                    value={tier.key}
                    style={{ backgroundColor: getTierColor(tier.key) }}
                >
                    {tier.label}
                </option>
              ))}
            </select>
          </div>
          <input 
            type="text" 
            placeholder={t.filterPlaceholder} 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="search-box"
          />
          <button 
            className="apply-btn" 
            disabled={stagedCount === 0 || loading}
            onClick={handleApply}
          >
            Save All Changes ({stagedCount})
          </button>
        </div>

        <div className="items-grid">
          {loading && !items.length ? (
            <div className="loading">{t.loading}</div>
          ) : (
            filteredItems.map((item, idx) => {
              const isStaged = !!stagedChanges[item.name];
              const stagedTier = stagedChanges[item.name];
              const displayTier = stagedTier || item.current_tier;

              return (
                <div 
                  key={`${item.name}-${idx}`} 
                  className={`item-card ${isStaged ? 'staged' : ''}`}
                  style={{ backgroundColor: getTierColor(displayTier) }}
                  onClick={() => handleItemClick(item.name)}
                >
                  <div className="item-info">
                    <div className="name-en">{item.name}</div>
                    <div className="name-ch">{item.name_ch}</div>
                    {displayTier && (
                        <div className={`tier-tag ${isStaged ? 'staged-tag' : ''}`}>
                            {isStaged ? 'NEW: ' : ''}{displayTier.split(' ')[1]}
                        </div>
                    )}
                  </div>
                  {isStaged && <div className="staged-indicator">●</div>}
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: #fdfdfd; width: 95%; height: 95%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .modal-header { padding: 15px 25px; background: white; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .header-meta { display: flex; align-items: center; gap: 20px; }
        .staged-badge { background: #2196F3; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; }
        .close-btn { background: none; border: none; font-size: 2.5rem; cursor: pointer; color: #ccc; line-height: 1; }
        .close-btn:hover { color: #666; }
        
        .bulk-toolbar { padding: 15px 25px; background: white; display: flex; gap: 25px; align-items: center; border-bottom: 1px solid #ddd; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .brush-tool { display: flex; align-items: center; gap: 10px; }
        .brush-tool .label { font-size: 0.9rem; font-weight: bold; color: #555; }
        .brush-tool select { padding: 8px 12px; border-radius: 6px; border: 1px solid #ccc; font-weight: bold; cursor: pointer; outline: none; transition: border 0.2s; }
        
        .search-box { flex-grow: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
        .apply-btn { padding: 10px 25px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: background 0.2s; }
        .apply-btn:hover { background: #43a047; }
        .apply-btn:disabled { background: #e0e0e0; color: #999; cursor: not-allowed; }

        .items-grid { flex-grow: 1; overflow-y: auto; padding: 25px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; align-content: flex-start; background: #f0f2f5; }
        .item-card { 
            border: 1px solid #ddd; padding: 12px; border-radius: 8px; cursor: pointer; 
            display: flex; flex-direction: column; justify-content: center;
            transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1); position: relative; 
            background: white; border-bottom: 3px solid rgba(0,0,0,0.1);
        }
        .item-card:hover { transform: scale(1.03); box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1; }
        .item-card.staged { border: 2px solid #2196F3; transform: scale(1.05); box-shadow: 0 5px 15px rgba(33, 150, 243, 0.3); border-bottom-width: 2px; }
        
        .name-en { font-size: 0.85rem; color: #1a1a1a; font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .name-ch { font-size: 0.8rem; color: #666; }
        
        .tier-tag { position: absolute; top: 5px; right: 8px; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.05); color: #777; font-weight: bold; }
        .staged-tag { background: #2196F3; color: white; }
        .staged-indicator { position: absolute; bottom: 5px; right: 8px; color: #2196F3; font-size: 1.2rem; }
        
        .loading { font-size: 1.5rem; color: #999; text-align: center; width: 100%; margin-top: 50px; }
      `}</style>
    </div>
  );
};

export default BulkTierEditor;
