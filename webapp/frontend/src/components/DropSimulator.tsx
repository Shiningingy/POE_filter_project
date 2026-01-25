import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { evaluateItem, parseClipboardItem } from '../utils/simulatorEngine';
import type { ItemProps, FilterContext } from '../utils/simulatorEngine';

interface DropSimulatorProps {
  language: Language;
}

const DropSimulator: React.FC<DropSimulatorProps> = ({ language }) => {
  const t = useTranslation(language);
  const [droppedItems, setDroppedItems] = useState<ItemProps[]>([]);
  const [context, setContext] = useState<FilterContext | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [showCreator, setShowCreator] = useState(false);
  const [showImport, setShowImport] = useState(false);
  
  // Import State
  const [importText, setImportText] = useState('');

  // Creator State
  const [newItem, setNewItem] = useState<ItemProps>({ name: 'Chaos Orb', class: 'Currency' });

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    try {
        // Load Settings to get Base Theme
        const settingsRes = await axios.get('/api/settings');
        const baseTheme = settingsRes.data.base_theme || 'sharket';
        
        // Load Base Theme
        const themeRes = await axios.get(`/api/themes/${baseTheme}`);
        const themeData = themeRes.data.theme_data;
        
        // Load Custom Overrides
        const overridesRes = await axios.get('/api/custom-overrides');
        
        // Load Mappings (We need to scan all files... expensive? 
        // Ideally backend provides a unified map or we use the bundle in demo mode)
        // For MVP, let's try to load the bundle if in demo, or a simplified map.
        // We can use /api/search-items to find tier? No, that's search.
        
        // Hack: In Demo Mode, load bundle.json
        // In Dev Mode, we might need a new endpoint /api/full-context
        let mappings = {};
        if (import.meta.env.VITE_DEMO_MODE === 'true') {
             const bundleRes = await axios.get('demo_data/bundle.json');
             mappings = bundleRes.data.mappings;
        } else {
             // In local dev, we don't have a bundle endpoint yet.
             // We can use /api/mapping-info/... but we don't know all files.
             // Let's assume we just want to test visuals for now.
             // OR create /api/full-context in backend.
        }

        setContext({
            theme: themeData,
            overrides: overridesRes.data,
            mappings: mappings,
            tierDefinitions: {} // Todo
        });
    } catch (e) {
        console.error("Failed to load context", e);
    } finally {
        setLoading(false);
    }
  };

  const handleAddItem = () => {
      setDroppedItems(prev => [...prev, { ...newItem, id: Date.now() + Math.random() }]); // Add ID for keys
      setShowCreator(false);
  };

  const handleImport = () => {
      const item = parseClipboardItem(importText);
      setDroppedItems(prev => [...prev, { ...item, id: Date.now() + Math.random() }]);
      setShowImport(false);
      setImportText('');
  };

  const handleClear = () => setDroppedItems([]);

  return (
    <div className="drop-simulator">
      <div className="simulator-controls">
        <button className="control-btn" onClick={() => setShowCreator(true)}>+ {t.addRule || "Add Item"}</button>
        <button className="control-btn" onClick={() => setShowImport(true)}>📋 Import Text</button>
        <button className="control-btn danger" onClick={handleClear}>{t.clearGround}</button>
      </div>

      <div className="game-ground">
        {loading && <div className="loading-overlay">{t.loading}</div>}
        
        {!loading && droppedItems.length === 0 && (
            <span className="placeholder-text">{t.groundEmpty}</span>
        )}
        
        {droppedItems.map((item, idx) => {
            const result = context ? evaluateItem(item, context) : { style: {}, visible: true };
            if (!result.visible) return null; // Or show ghost?
            
            return (
                <div key={idx} className="item-plate" style={result.style} title={`${item.name} (${result.matchedTier || 'Untiered'})`}>
                    {item.name}
                </div>
            );
        })}
      </div>

      {/* Creator Modal */}
      {showCreator && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h3>Create Item</h3>
                  <div className="form-group">
                      <label>Name</label>
                      <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                      <label>Class</label>
                      <input type="text" value={newItem.class} onChange={e => setNewItem({...newItem, class: e.target.value})} />
                  </div>
                  <div className="form-row">
                      <div className="form-group">
                          <label>Item Level</label>
                          <input type="number" value={newItem.itemLevel || ''} onChange={e => setNewItem({...newItem, itemLevel: parseInt(e.target.value)})} />
                      </div>
                      <div className="form-group">
                          <label>Rarity</label>
                          <select value={newItem.rarity || 'Normal'} onChange={e => setNewItem({...newItem, rarity: e.target.value as any})}>
                              <option>Normal</option>
                              <option>Magic</option>
                              <option>Rare</option>
                              <option>Unique</option>
                          </select>
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button onClick={() => setShowCreator(false)}>{t.cancel}</button>
                      <button className="primary" onClick={handleAddItem}>{t.ok}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Import Modal */}
      {showImport && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h3>Import from Clipboard</h3>
                  <textarea 
                    value={importText} 
                    onChange={e => setImportText(e.target.value)} 
                    placeholder="Paste item text here (Ctrl+C from game)..."
                    rows={10}
                  />
                  <div className="modal-footer">
                      <button onClick={() => setShowImport(false)}>{t.cancel}</button>
                      <button className="primary" onClick={handleImport}>{t.ok}</button>
                  </div>
              </div>
          </div>
      )}

      <style>{`
        .drop-simulator { display: flex; flex-direction: column; height: 100%; position: relative; }
        .simulator-controls { display: flex; gap: 10px; padding: 10px; background: #333; color: white; }
        .control-btn { padding: 8px 16px; background: #444; border: 1px solid #555; color: #eee; cursor: pointer; border-radius: 4px; font-weight: bold; }
        .control-btn:hover { background: #555; }
        .control-btn.danger { background: #d32f2f; border-color: #b71c1c; }
        
        .game-ground { 
          flex-grow: 1; 
          background-color: #1a1a1a; 
          background-image: radial-gradient(#2a2a2a 15%, transparent 16%), radial-gradient(#2a2a2a 15%, transparent 16%);
          background-size: 60px 60px;
          background-position: 0 0, 30px 30px;
          padding: 40px; 
          overflow: auto; 
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-content: flex-start;
          gap: 15px;
        }
        .placeholder-text { color: #555; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.2rem; }
        
        .item-plate { cursor: pointer; user-select: none; transition: transform 0.1s; box-shadow: 0 4px 6px rgba(0,0,0,0.5); }
        .item-plate:hover { transform: scale(1.05); z-index: 10; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: #222; color: #eee; padding: 20px; border-radius: 8px; width: 400px; border: 1px solid #444; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .modal-content h3 { margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 10px; }
        
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; font-size: 0.8rem; color: #aaa; margin-bottom: 5px; }
        .form-group input, .form-group select { width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: white; border-radius: 4px; box-sizing: border-box; }
        .form-row { display: flex; gap: 10px; }
        .form-row .form-group { flex: 1; }
        
        textarea { width: 100%; background: #333; border: 1px solid #555; color: #eee; border-radius: 4px; padding: 10px; box-sizing: border-box; font-family: monospace; resize: vertical; }
        
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        .modal-footer button { padding: 8px 20px; background: #444; border: none; color: white; border-radius: 4px; cursor: pointer; }
        .modal-footer button.primary { background: #2196F3; }
        .modal-footer button:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
};

export default DropSimulator;