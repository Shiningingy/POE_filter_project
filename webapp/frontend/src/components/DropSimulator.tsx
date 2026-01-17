import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface StyleProps {
  fontSize?: number;
  textColor?: number[];
  borderColor?: number[];
  backgroundColor?: number[];
}

interface DropSimulatorProps {
  language: Language;
}

const DropSimulator: React.FC<DropSimulatorProps> = ({ language }) => {
  const t = useTranslation(language);
  const [styles, setStyles] = useState<Record<string, StyleProps>>({});
  const [droppedItems, setDroppedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE_URL = '';

  useEffect(() => {
    fetchStyles();
  }, []);

  const fetchStyles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/generated-filter-styles`);
      setStyles(response.data.content);
      setError('');
    } catch (err) {
      console.error("Error fetching styles:", err);
      setError("Failed to load filter styles. Have you generated the filter yet?");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (item: string) => {
    if (styles[item]) {
      setDroppedItems(prev => [...prev, item]);
      setSearchTerm('');
    }
  };

  const handleClear = () => {
    setDroppedItems([]);
  };

  const getCssStyle = (baseType: string): React.CSSProperties => {
    const styleData = styles[baseType];
    if (!styleData) return {};

    const toRgb = (arr?: number[]) => arr ? `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})` : 'transparent';

    return {
      fontSize: styleData.fontSize ? `${styleData.fontSize / 2.5}px` : '16px', 
      color: toRgb(styleData.textColor),
      borderColor: toRgb(styleData.borderColor),
      backgroundColor: toRgb(styleData.backgroundColor),
      borderWidth: styleData.borderColor ? '1px' : '0',
      borderStyle: 'solid',
      padding: '2px 4px',
      margin: '2px',
      display: 'inline-block',
      fontFamily: 'Verdana, sans-serif',
      boxShadow: '0 0 2px rgba(0,0,0,0.5)'
    };
  };

  const filteredOptions = Object.keys(styles).filter(item => 
    item.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  return (
    <div className="drop-simulator">
      <div className="simulator-controls">
        <div className="search-wrapper">
          <input 
            type="text" 
            placeholder={t.typeToDrop} 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="sim-search"
          />
          {searchTerm && (
            <div className="suggestions">
              {filteredOptions.map(item => (
                <div key={item} className="suggestion-item" onClick={() => handleAddItem(item)}>
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleClear}>{t.clearGround}</button>
        <button onClick={fetchStyles}>{t.refreshStyles}</button>
      </div>

      {loading && <div>{t.loading}</div>}
      {error && <div className="error">{error}</div>}

      <div className="game-ground">
        {droppedItems.length === 0 && <span className="placeholder-text">{t.groundEmpty}</span>}
        {droppedItems.map((item, index) => (
          <div key={index} className="item-plate" style={getCssStyle(item)}>
            {item}
          </div>
        ))}
      </div>

      <style>{`
        .drop-simulator { display: flex; flex-direction: column; gap: 10px; height: 100%; }
        .simulator-controls { display: flex; gap: 10px; padding: 10px; background: #333; color: white; }
        .search-wrapper { position: relative; flex-grow: 1; }
        .sim-search { width: 100%; padding: 5px; }
        .suggestions { position: absolute; top: 100%; left: 0; right: 0; background: white; color: black; border: 1px solid #ccc; z-index: 10; }
        .suggestion-item { padding: 5px; cursor: pointer; }
        .suggestion-item:hover { background: #eee; }
        .game-ground { 
          flex-grow: 1; 
          background-color: #1a1a1a; 
          background-image: radial-gradient(#2a2a2a 15%, transparent 16%), radial-gradient(#2a2a2a 15%, transparent 16%);
          background-size: 60px 60px;
          background-position: 0 0, 30px 30px;
          padding: 20px; 
          overflow: auto; 
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: 10px;
        }
        .placeholder-text { color: #555; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .item-plate { cursor: pointer; user-select: none; }
        .item-plate:hover { filter: brightness(1.2); }
      `}</style>
    </div>
  );
};

export default DropSimulator;