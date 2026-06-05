import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { evaluateItem, parseClipboardItem } from '../utils/simulatorEngine';
import type { ItemProps, FilterContext } from '../utils/simulatorEngine';
import { getAssetUrl } from '../utils/assetUtils';
import SimulatorItem from './SimulatorItem';
import { useAppData } from '../services/AppDataContext';

interface DropSimulatorProps {
  language: Language;
  onJumpToRule?: (filePath: string, ruleIndex?: number) => void;
}

const DropSimulator: React.FC<DropSimulatorProps> = ({ language, onJumpToRule }) => {
  const t = useTranslation(language);
  const [droppedItems, setDroppedItems] = useState<(ItemProps & { id: number, x: number, y: number })[]>([]);
  const [context, setContext] = useState<FilterContext | null>(null);
  const [filterLoading, setFilterLoading] = useState(true);

  // AppDataContext – provides class hierarchy, flat class list and class properties
  const { flatClasses, classPropsMap, classHierarchy, getLeafClassesUnder, loading: dataLoading } = useAppData();
  const loading = filterLoading || dataLoading;

  // Environment
  const [globalAreaLevel, setGlobalAreaLevel] = useState(68);
  const [viewerBackground, setViewerBackground] = useState<string>('Item_bg_coast.jpg');

  // Modals
  const [showCreator, setShowCreator] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Data for Dropdowns
  const [allClassItems, setAllClassItems] = useState<Record<string, string[]>>({});

  // Hierarchical class picker – level-1 group selector
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // Creator / Editor State
  const [newItem, setNewItem] = useState<ItemProps>({
      name: 'Chaos Orb', class: 'Stackable Currency', itemLevel: 80, rarity: 'Normal',
      identified: true, dropLevel: 1, stackSize: 1
  });

  // Edit mode – when non-null, the creator modal is shown in edit mode
  const [editingItem, setEditingItem] = useState<(ItemProps & { id: number }) | null>(null);

  const backgrounds = [
    { id: "Item_bg_coast.jpg", name: language === 'ch' ? "海滩" : "Coast" },
    { id: "Item_bg_forest.jpg", name: language === 'ch' ? "丛林" : "Forest" },
    { id: "Item_bg_sand.jpg", name: language === 'ch' ? "沙漠" : "Sand" },
    { id: "color_black", name: language === 'ch' ? "黑" : "Black" },
    { id: "color_grey", name: language === 'ch' ? "灰" : "Grey" }
  ];

  useEffect(() => {
    loadContext();
    // loadContext is defined once and never changes — safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            tierDefinitions,
            globalAreaLevel
        });
    } catch (e) {
        console.error("Failed to load context", e);
    } finally {
        setFilterLoading(false);
    }
  };

  const fetchBaseTypes = async (cls: string) => {
      if (allClassItems[cls]) return;
      try {
          const res = await axios.get(`/api/class-items/${cls}`);
          const names = (res.data.items as { name: string }[]).map(i => i.name).sort();
          setAllClassItems(prev => ({ ...prev, [cls]: names }));
      } catch {
          // silently ignore — base types are optional autocomplete
      }
  };

  useEffect(() => {
      if (newItem.class) {
          fetchBaseTypes(newItem.class);
      }
  }, [newItem.class]);

  // When entering edit mode, pre-fill form fields with the item's current values
  useEffect(() => {
      if (editingItem) {
          // Strip the simulator-only fields (id, x, y) that are not part of ItemProps
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _omitId, ...itemProps } = editingItem as ItemProps & { id: number; x?: number; y?: number };
          setNewItem(itemProps);
          setShowCreator(true);
      }
  }, [editingItem]);

  const addItemToGround = (item: ItemProps) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 150;
      setDroppedItems(prev => [...prev, { ...item, id: Date.now() + Math.random(), x: Math.cos(angle)*dist, y: Math.sin(angle)*dist }]);
  };

  const handleAddItem = () => {
      if (editingItem) {
          // Update the existing item in place by matching id
          setDroppedItems(prev => prev.map(i =>
              i.id === editingItem.id ? { ...i, ...newItem } : i
          ));
          setEditingItem(null);
      } else {
          addItemToGround(newItem);
      }
      setShowCreator(false);
  };

  const handleCancelCreator = () => {
      setShowCreator(false);
      setEditingItem(null);
  };

  const handleImport = () => {
      const item = parseClipboardItem(importText);
      addItemToGround(item);
      setShowImport(false);
      setImportText('');
  };

  const getBackgroundStyle = () => {
      if (viewerBackground.startsWith('color_')) {
          const c = viewerBackground.split('_')[1];
          return { backgroundColor: c === 'grey' ? '#333' : '#000' };
      }
      return { backgroundImage: `url('${getAssetUrl(`assets/item_bg/${viewerBackground}`)}')`, backgroundSize: 'cover' };
  };

  const activeProps = useMemo(() => {
      return classPropsMap[newItem.class] || { properties: [], flags: [], constraints: {} };
  }, [newItem.class, classPropsMap]);

  // Intermediate (non-leaf) hierarchy nodes to populate the group selector
  const groupNodes = useMemo(() => {
      const groups: { id: string; label: string }[] = [];
      const walk = (node: import('../services/AppDataContext').ClassHierarchyNode) => {
          if (!node.poe_class && node.children && node.children.length > 0) {
              groups.push({ id: node.id, label: node.label_en });
              for (const child of node.children) walk(child);
          }
      };
      for (const root of classHierarchy) walk(root);
      return groups;
  }, [classHierarchy]);

  // Classes shown in the level-2 picker based on the selected group
  const visibleClasses = useMemo(() => {
      if (!selectedGroup) return flatClasses;
      return getLeafClassesUnder(selectedGroup);
  }, [selectedGroup, flatClasses, getLeafClassesUnder]);

  const renderField = (key: string, label: string, type: 'number' | 'text' | 'select', options?: string[]) => {
      const isVisible = activeProps.properties.includes(key) || activeProps.flags?.includes(key) || ['itemLevel', 'dropLevel', 'rarity'].includes(key);
      if (!isVisible && key !== 'name' && key !== 'class') return null;

      const itemRecord = newItem as Record<string, unknown>;

      return (
          <div className={`form-group ${['name', 'class'].includes(key) ? 'full-width' : ''}`}>
              <label>{label}</label>
              {type === 'select' ? (
                  <select value={itemRecord[key] as string} onChange={e => setNewItem({...newItem, [key]: e.target.value})}>
                      {options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
              ) : (
                  <input
                    type={type}
                    value={(itemRecord[key] as string | number) || ''}
                    onChange={e => setNewItem({...newItem, [key]: type === 'number' ? parseInt(e.target.value) : e.target.value})}
                    list={key === 'name' ? 'base-types' : undefined}
                  />
              )}
              {key === 'name' && (
                  <datalist id="base-types">
                      {(allClassItems[newItem.class] || []).map(b => <option key={b} value={b} />)}
                  </datalist>
              )}
          </div>
      );
  };

  return (
    <div className="drop-simulator">
      <div className="simulator-controls">
        <div className="left-controls">
            <button className="control-btn" onClick={() => setShowCreator(true)}>+ {t.addRule || "Add Item"}</button>
            <button className="control-btn" onClick={() => setShowImport(true)}>📋 Import</button>
            <button className="control-btn danger" onClick={() => setDroppedItems([])}>{t.clearGround}</button>
        </div>
        
        <div className="env-controls">
            <label>Area Level: <input type="number" value={globalAreaLevel} onChange={e => setGlobalAreaLevel(parseInt(e.target.value))} /></label>
            <div className="bg-picker">
                {backgrounds.map(bg => (
                    <button key={bg.id} className={viewerBackground === bg.id ? 'active' : ''} onClick={() => setViewerBackground(bg.id)} title={bg.name}>
                        {bg.name.substring(0,1)}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="game-ground" style={getBackgroundStyle()}>
        <div className="center-marker">+</div>
        {loading && <div className="loading-overlay">{t.loading}</div>}
        
        {droppedItems.map((item) => {
            if (!context) return null;
            const liveContext = { ...context, globalAreaLevel };
            const result = evaluateItem(item, liveContext);
            
            return (
                <SimulatorItem
                    key={item.id}
                    item={item}
                    result={result}
                    language={language}
                    onDelete={() => setDroppedItems(prev => prev.filter(i => i.id !== item.id))}
                    onJumpToRule={onJumpToRule}
                    onEdit={(item) => setEditingItem(item)}
                />
            );
        })}
      </div>

      {showCreator && (
          <div className="modal-overlay">
              <div className="modal-content large">
                  <h3>{editingItem ? 'Edit Item' : 'Create Item'}</h3>
                  <div className="form-grid">
                      {/* Level-1: group selector */}
                      <div className="form-group full-width class-picker-row">
                          <label>Class Group</label>
                          <select value={selectedGroup} onChange={e => {
                              setSelectedGroup(e.target.value);
                              // Reset class to first available in new group
                              const leaves = e.target.value ? getLeafClassesUnder(e.target.value) : flatClasses;
                              if (leaves.length > 0) setNewItem(prev => ({ ...prev, class: leaves[0] }));
                          }}>
                              <option value="">All Classes</option>
                              {groupNodes.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                          </select>
                      </div>
                      {/* Level-2: leaf class selector */}
                      <div className="form-group full-width">
                          <label>Item Class</label>
                          <select value={newItem.class} onChange={e => {
                              setNewItem(prev => ({ ...prev, class: e.target.value }));
                          }}>
                              {visibleClasses.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      {renderField('name', 'Base Type', 'text')}
                      
                      {renderField('itemLevel', 'Item Level', 'number')}
                      {renderField('dropLevel', 'Drop Level', 'number')}
                      {renderField('rarity', 'Rarity', 'select', ['Normal', 'Magic', 'Rare', 'Unique'])}
                      {renderField('quality', 'Quality', 'number')}
                      {renderField('stackSize', 'Stack Size', 'number')}
                      {renderField('gemLevel', 'Gem Level', 'number')}
                      {renderField('mapTier', 'Map Tier', 'number')}
                      {renderField('sockets', 'Sockets (e.g. R G B)', 'text')}
                      {renderField('linkedSockets', 'Linked Sockets', 'number')}
                  </div>
                  
                  <div className="flags-section">
                      <h4>Flags</h4>
                      <div className="flags-grid">
                          {['identified', 'corrupted', 'mirrored', 'fractured', 'synthesised', 'shaper', 'elder'].map(flag => {
                              if (!activeProps.flags?.includes(flag) && !['identified', 'corrupted', 'mirrored'].includes(flag)) return null;
                              return (
                                <label key={flag}>
                                    <input type="checkbox" checked={!!newItem[flag]} onChange={e => setNewItem({...newItem, [flag]: e.target.checked})} />
                                    {flag.charAt(0).toUpperCase() + flag.slice(1)}
                                </label>
                              );
                          })}
                      </div>
                  </div>

                  <div className="modal-footer">
                      <button onClick={handleCancelCreator}>{t.cancel}</button>
                      <button className="primary" onClick={handleAddItem}>{editingItem ? 'Update Item' : t.ok}</button>
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
        .simulator-controls { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: #222; border-bottom: 1px solid #333; }
        .left-controls, .env-controls { display: flex; gap: 10px; align-items: center; }
        
        .control-btn { padding: 8px 16px; background: #444; border: 1px solid #555; color: #eee; cursor: pointer; border-radius: 4px; font-weight: bold; }
        .control-btn:hover { background: #555; }
        .control-btn.danger { background: #d32f2f; border-color: #b71c1c; }
        
        .env-controls label { color: #aaa; font-size: 0.9rem; font-weight: bold; }
        .env-controls input { width: 50px; background: #333; border: 1px solid #555; color: white; padding: 4px; border-radius: 4px; text-align: center; }
        
        .bg-picker { display: flex; gap: 2px; background: #333; padding: 2px; border-radius: 4px; }
        .bg-picker button { width: 24px; height: 24px; background: #444; border: 1px solid #555; color: #aaa; cursor: pointer; font-size: 0.7rem; padding: 0; }
        .bg-picker button.active { background: #2196F3; color: white; border-color: #2196F3; }

        .game-ground { 
          flex-grow: 1; 
          background-color: #050505; 
          background-position: center;
          position: relative;
          overflow: hidden;
        }
        .center-marker { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: rgba(255,255,255,0.1); font-size: 3rem; pointer-events: none; }
        
        .item-plate { 
            cursor: pointer; user-select: none; transition: transform 0.1s; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.8); 
            z-index: 1; white-space: nowrap;
        }
        .item-plate:hover { transform: translate(-50%, -50%) scale(1.1); z-index: 100; border-color: white !important; }
        .item-plate.hidden { opacity: 0.3; filter: grayscale(1); border: 1px dashed #555 !important; background: transparent !important; }
        .ghost-box { font-size: 0.7rem; color: #777; padding: 2px 5px; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .modal-content { background: #222; color: #eee; padding: 25px; border-radius: 8px; width: 400px; border: 1px solid #444; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
        .modal-content.large { width: 600px; }
        .modal-content h3 { margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 15px; margin-bottom: 20px; }
        
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .form-group label { display: block; font-size: 0.75rem; color: #888; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input, .form-group select { width: 100%; padding: 8px; background: #111; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
        .form-group input:focus { border-color: #2196F3; outline: none; }
        .form-group.full-width { grid-column: span 2; }
        
        .flags-section h4 { border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; color: #aaa; font-size: 0.9rem; }
        .flags-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px; background: #1a1a1a; border-radius: 4px; }
        .flags-grid label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; color: #ccc; }
        
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