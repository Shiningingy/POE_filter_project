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
  className: string; // The item class name (e.g. "Skill Gems")
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
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

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

  const toggleItem = (name: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(name)) newChecked.delete(name);
    else newChecked.add(name);
    setCheckedItems(newChecked);
  };

  const handleApply = async () => {
    if (checkedItems.size === 0) return;
    setLoading(true);
    try {
      // Bulk update items
      const promises = Array.from(checkedItems).map(itemName => {
        const item = items.find(i => i.name === itemName);
        return axios.post(`${API_BASE_URL}/api/update-item-tier`, {
          item_name: itemName,
          new_tier: selectedTierKey,
          source_file: item?.source_file || `${className}.json`
        });
      });

      await Promise.all(promises);
      alert(`${checkedItems.size} items updated!`);
      onSave(); // Refresh parent
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update some items.");
    } finally {
      setLoading(false);
    }
  };

  // Map tier numbers to background colors for visualization
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

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Bulk Edit: {className}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="bulk-toolbar">
          <div className="target-select">
            <span>Target Tier: </span>
            <select value={selectedTierKey} onChange={e => setSelectedTierKey(e.target.value)}>
              {availableTiers.map(tier => (
                <option key={tier.key} value={tier.key}>{tier.label}</option>
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
            disabled={checkedItems.size === 0 || loading}
            onClick={handleApply}
          >
            Apply to {checkedItems.size} items
          </button>
        </div>

        <div className="items-grid">
          {loading ? (
            <div className="loading">{t.loading}</div>
          ) : (
            filteredItems.map(item => (
              <label 
                key={item.name} 
                className={`item-checkbox-card ${checkedItems.has(item.name) ? 'checked' : ''}`}
                style={{ backgroundColor: getTierColor(item.current_tier) }}
              >
                <input 
                  type="checkbox" 
                  checked={checkedItems.has(item.name)} 
                  onChange={() => toggleItem(item.name)}
                />
                <div className="item-info">
                  <div className="name-en">{item.name}</div>
                  <div className="name-ch">{item.name_ch}</div>
                  {item.current_tier && <div className="current-tier-tag">{item.current_tier.split(' ')[1]}</div>}
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; width: 90%; height: 90%; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .close-btn { background: none; border: none; font-size: 2rem; cursor: pointer; color: #999; }
        
        .bulk-toolbar { padding: 15px 20px; background: #f5f5f5; display: flex; gap: 20px; align-items: center; border-bottom: 1px solid #ddd; }
        .target-select select { padding: 8px; border-radius: 4px; border: 1px solid #ccc; font-weight: bold; }
        .search-box { flex-grow: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; }
        .apply-btn { padding: 8px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .apply-btn:disabled { background: #ccc; cursor: not-allowed; }

        .items-grid { flex-grow: 1; overflow-y: auto; padding: 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; align-content: flex-start; }
        .item-checkbox-card { border: 1px solid #ddd; padding: 10px; border-radius: 4px; cursor: pointer; display: flex; gap: 10px; transition: all 0.2s; position: relative; }
        .item-checkbox-card:hover { transform: translateY(-2px); box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .item-checkbox-card.checked { border: 2px solid #2196F3; }
        .item-info { display: flex; flex-direction: column; overflow: hidden; }
        .name-en { font-size: 0.8rem; color: #333; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .name-ch { font-size: 0.75rem; color: #666; }
        .current-tier-tag { position: absolute; top: 2px; right: 5px; font-size: 0.6rem; color: #999; }
      `}</style>
    </div>
  );
};

export default BulkTierEditor;
