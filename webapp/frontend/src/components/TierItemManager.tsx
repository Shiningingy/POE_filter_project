import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface TierItem {
  name: string;
  source: string;
  current_tier?: string;
}

interface TierItemManagerProps {
  tierKey: string;
  items: TierItem[];
  allTiers: string[]; // List of all available tier keys in this category
  onMoveItem: (item: TierItem, newTier: string) => void;
}

const TierItemManager: React.FC<TierItemManagerProps> = ({ 
  tierKey, 
  items, 
  allTiers, 
  onMoveItem 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Item State
  const [addSearch, setAddSearch] = useState('');
  const [suggestions, setSuggestions] = useState<TierItem[]>([]);

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <div className="tier-item-manager">
      <div className="header" onClick={() => setIsOpen(!isOpen)}>
        <span>📦 Items in this Tier ({items.length})</span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="content">
          {/* Add Item Section */}
          <div className="add-section">
            <input 
              type="text" 
              placeholder="Search to add item..." 
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              className="search-box add-input"
            />
            {suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map(s => (
                  <li key={s.name} onClick={() => handleAddItem(s)}>
                    <strong>{s.name}</strong> 
                    <span className="source-hint">({s.current_tier || 'Unassigned'})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <hr className="divider"/>

          {/* Existing Items Filter */}
          <input 
            type="text" 
            placeholder="Filter current items..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-box"
          />
          
          <ul className="item-list">
            {filteredItems.map(item => (
              <li key={item.name} className="item-row">
                <span className="item-name" title={item.source}>{item.name}</span>
                <select 
                  value={tierKey}
                  onChange={(e) => onMoveItem(item, e.target.value)}
                  className="tier-select"
                >
                  {allTiers.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </li>
            ))}
            {filteredItems.length === 0 && <li className="empty">No items in this tier</li>}
          </ul>
        </div>
      )}

      <style>{`
        .tier-item-manager {
          margin-top: 10px;
          border-top: 1px solid #eee;
        }
        .header {
          padding: 8px 0;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          color: #666;
          font-size: 0.9rem;
          user-select: none;
        }
        .header:hover { color: #333; }
        .content {
          padding: 10px;
          background: #f9f9f9;
          border-radius: 4px;
        }
        .search-box {
          width: 100%;
          padding: 5px;
          margin-bottom: 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
        }
        .add-input { border-color: #4CAF50; }
        .suggestions-list {
          list-style: none; padding: 0; margin: 0;
          background: white; border: 1px solid #ddd;
          max-height: 150px; overflow-y: auto;
          position: absolute; width: 90%; z-index: 10;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .suggestions-list li {
          padding: 5px 10px; cursor: pointer;
          display: flex; justify-content: space-between;
        }
        .suggestions-list li:hover { background: #eee; }
        .source-hint { font-size: 0.8rem; color: #888; }
        
        .add-section { position: relative; margin-bottom: 10px; }
        .divider { border: 0; border-top: 1px solid #ddd; margin: 10px 0; }

        .item-list {
          list-style: none;
          padding: 0;
          margin: 0;
          max-height: 200px;
          overflow-y: auto;
        }
        .item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          border-bottom: 1px solid #eee;
        }
        .item-name {
          font-size: 0.9rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }
        .tier-select {
          padding: 2px;
          font-size: 0.8rem;
          width: 120px;
        }
        .empty {
          color: #999;
          text-align: center;
          padding: 10px;
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  );
};

export default TierItemManager;