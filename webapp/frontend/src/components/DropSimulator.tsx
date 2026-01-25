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
  const [droppedItems, setDroppedItems] = useState<(ItemProps & { id: number, x: number, y: number })[]>([]);
  const [context, setContext] = useState<FilterContext | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [showCreator, setShowCreator] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Creator State
  const [newItem, setNewItem] = useState<ItemProps>({
      name: 'Chaos Orb', class: 'Currency', itemLevel: 80, rarity: 'Normal',
      identified: true
  });

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    try {
        const settingsRes = await axios.get('/api/settings');
        const baseTheme = settingsRes.data.base_theme || 'sharket';
        const themeRes = await axios.get(`/api/themes/${baseTheme}`);
        const overridesRes = await axios.get('/api/custom-overrides');
        
        let mappings = {};
        let tierDefinitions = {};

        if (import.meta.env.VITE_DEMO_MODE === 'true') {
             const bundleRes = await axios.get('demo_data/bundle.json');
             mappings = bundleRes.data.mappings;
             tierDefinitions = bundleRes.data.tiers;
        } else {
             const bundleRes = await axios.get('/api/simulator-bundle');
             mappings = bundleRes.data.mappings;
             tierDefinitions = bundleRes.data.tiers;
        }

        setContext({
            theme: themeRes.data.theme_data,
            overrides: overridesRes.data,
            mappings,
            tierDefinitions
        });
    } catch (e) {
        console.error("Failed to load context", e);
    } finally {
        setLoading(false);
    }
  };

  const addItemToGround = (item: ItemProps) => {
      // Random position around center
      // Range: +/- 150px
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 150;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      
      setDroppedItems(prev => [...prev, { ...item, id: Date.now() + Math.random(), x, y }]);
  };

  const handleAddItem = () => {
      addItemToGround(newItem);
      setShowCreator(false);
  };

  const handleImport = () => {
      const item = parseClipboardItem(importText);
      addItemToGround(item);
      setShowImport(false);
      setImportText('');
  };

  return (
    <div className="drop-simulator">
      <div className="simulator-controls">
        <button className="control-btn" onClick={() => setShowCreator(true)}>+ {t.addRule || "Add Item"}</button>
        <button className="control-btn" onClick={() => setShowImport(true)}>📋 Import Text</button>
        <button className="control-btn danger" onClick={() => setDroppedItems([])}>{t.clearGround}</button>
      </div>

      <div className="game-ground">
        <div className="center-marker">+</div>
        {loading && <div className="loading-overlay">{t.loading}</div>}
        
        {droppedItems.map((item) => {
            const result = context ? evaluateItem(item, context) : { style: {}, visible: true };
            if (!result.visible) return null; // Or show hidden style
            
            return (
                <div 
                    key={item.id} 
                    className="item-plate" 
                    style={{
                        ...result.style,
                        position: 'absolute',
                        left: `calc(50% + ${item.x}px)`,
                        top: `calc(50% + ${item.y}px)`,
                        transform: 'translate(-50%, -50%)', // Center anchor
                    }}
                    title={`${item.name}\nTier: ${result.matchedTier || 'Untiered'}\nRule: ${result.matchedRule || 'None'}`}
                >
                    <div className="plate-body">
                        {item.name}
                        {item.stackSize && item.stackSize > 1 && <span className="stack-size"> x{item.stackSize}</span>}
                    </div>
                </div>
            );
        })}
      </div>

      {showCreator && (
          <div className="modal-overlay">
              <div className="modal-content large">
                  <h3>Create Item</h3>
                  <div className="form-grid">
                      <div className="form-group">
                          <label>Name (BaseType)</label>
                          <input type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} />
                      </div>
                      <div className="form-group">
                          <label>Class</label>
                          <input type="text" value={newItem.class} onChange={e => setNewItem({...newItem, class: e.target.value})} />
                      </div>
                      <div className="form-group">
                          <label>Item Level</label>
                          <input type="number" value={newItem.itemLevel || 0} onChange={e => setNewItem({...newItem, itemLevel: parseInt(e.target.value)})} />
                      </div>
                      <div className="form-group">
                          <label>Drop Level</label>
                          <input type="number" value={newItem.dropLevel || 0} onChange={e => setNewItem({...newItem, dropLevel: parseInt(e.target.value)})} />
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
                      <div className="form-group">
                          <label>Quality</label>
                          <input type="number" value={newItem.quality || 0} onChange={e => setNewItem({...newItem, quality: parseInt(e.target.value)})} />
                      </div>
                      <div className="form-group">
                          <label>Sockets (e.g. R G B)</label>
                          <input type="text" value={newItem.sockets || ''} onChange={e => setNewItem({...newItem, sockets: e.target.value})} />
                      </div>
                      <div className="form-group">
                          <label>Linked Sockets</label>
                          <input type="number" value={newItem.linkedSockets || 0} onChange={e => setNewItem({...newItem, linkedSockets: parseInt(e.target.value)})} />
                      </div>
                  </div>
                  <div className="flags-grid">
                      <label><input type="checkbox" checked={!!newItem.identified} onChange={e => setNewItem({...newItem, identified: e.target.checked})} /> Identified</label>
                      <label><input type="checkbox" checked={!!newItem.corrupted} onChange={e => setNewItem({...newItem, corrupted: e.target.checked})} /> Corrupted</label>
                      <label><input type="checkbox" checked={!!newItem.mirrored} onChange={e => setNewItem({...newItem, mirrored: e.target.checked})} /> Mirrored</label>
                      <label><input type="checkbox" checked={!!newItem.fractured} onChange={e => setNewItem({...newItem, fractured: e.target.checked})} /> Fractured</label>
                      <label><input type="checkbox" checked={!!newItem.synthesised} onChange={e => setNewItem({...newItem, synthesised: e.target.checked})} /> Synthesised</label>
                      <label><input type="checkbox" checked={!!newItem.shaper} onChange={e => setNewItem({...newItem, shaper: e.target.checked})} /> Shaper</label>
                      <label><input type="checkbox" checked={!!newItem.elder} onChange={e => setNewItem({...newItem, elder: e.target.checked})} /> Elder</label>
                  </div>
                  <div className="modal-footer">
                      <button onClick={() => setShowCreator(false)}>{t.cancel}</button>
                      <button className="primary" onClick={handleAddItem}>{t.ok}</button>
                  </div>
              </div>
          </div>
      )}

      {showImport && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h3>Import from Clipboard</h3>
                  <textarea 
                    value={importText} 
                    onChange={e => setImportText(e.target.value)} 
                    placeholder="Copy item info from game (Ctrl+C) and paste here..."
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
        .simulator-controls { display: flex; gap: 10px; padding: 10px; background: #222; border-bottom: 1px solid #333; }
        .control-btn { padding: 8px 16px; background: #444; border: 1px solid #555; color: #eee; cursor: pointer; border-radius: 4px; font-weight: bold; }
        .control-btn:hover { background: #555; }
        .control-btn.danger { background: #d32f2f; border-color: #b71c1c; }
        
        .game-ground { 
          flex-grow: 1; 
          background-color: #050505; 
          background-image: radial-gradient(#111 15%, transparent 16%), radial-gradient(#111 15%, transparent 16%);
          background-size: 60px 60px;
          background-position: 0 0, 30px 30px;
          position: relative;
          overflow: hidden;
        }
        .center-marker { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: #333; font-size: 2rem; pointer-events: none; }
        .placeholder-text { color: #444; position: absolute; top: 60%; left: 50%; transform: translate(-50%, -50%); font-size: 1rem; pointer-events: none; }
        
        .item-plate { 
            cursor: pointer; user-select: none; transition: transform 0.1s; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.8); 
            z-index: 1; white-space: nowrap;
        }
        .item-plate:hover { transform: translate(-50%, -50%) scale(1.1); z-index: 100; border-color: white !important; }
        .item-plate .stack-size { font-size: 0.8em; color: #aaa; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .modal-content { background: #222; color: #eee; padding: 25px; border-radius: 8px; width: 400px; border: 1px solid #444; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
        .modal-content.large { width: 600px; }
        .modal-content h3 { margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 15px; margin-bottom: 20px; }
        
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .form-group label { display: block; font-size: 0.75rem; color: #888; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input, .form-group select { width: 100%; padding: 8px; background: #111; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
        .form-group input:focus { border-color: #2196F3; outline: none; }
        
        .flags-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; background: #1a1a1a; padding: 15px; border-radius: 4px; }
        .flags-grid label { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; }
        
        textarea { width: 100%; background: #111; border: 1px solid #444; color: #eee; border-radius: 4px; padding: 10px; box-sizing: border-box; font-family: monospace; resize: vertical; }
        
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; border-top: 1px solid #333; padding-top: 15px; }
        .modal-footer button { padding: 10px 25px; background: #333; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .modal-footer button.primary { background: #2196F3; border-color: #1976D2; }
        .modal-footer button:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  );
};

export default DropSimulator;
