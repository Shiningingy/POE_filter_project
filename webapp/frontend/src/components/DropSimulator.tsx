import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { evaluateItem, parseClipboardItem, getMatchingRules } from '../utils/simulatorEngine';
import type { ItemProps, FilterContext, RuleMatch } from '../utils/simulatorEngine';
import { getAssetUrl } from '../utils/assetUtils';
import SimulatorItem from './SimulatorItem';
import SimulatorRulePanel from './SimulatorRulePanel';
import SimulatorMatchPicker from './SimulatorMatchPicker';
import { useAppData } from '../services/AppDataContext';
import SimulatorSettingsPanel from './SimulatorSettingsPanel';
import {
  generateRandomItem,
  generateValuableItem,
  buildValuableItemSet,
  getCategoriesToPrewarm,
} from '../utils/itemGenerator';
import type { GeneratorSettings } from '../utils/itemGenerator';

interface DropSimulatorProps {
  language: Language;
  onJumpToRule?: (filePath: string, ruleIndex?: number) => void;
}

const MAX_GROUND_ITEMS = 20;

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

  // Mini editor modal state
  // Double-click → inspect/edit the rules & styles affecting a drop. When the
  // effective matches span multiple files we can't open them all, so a picker
  // (pickerState) lets the user choose; otherwise we open the editor directly.
  const [pickerState, setPickerState] = useState<{ item: ItemProps; matches: RuleMatch[] } | null>(null);
  const [editTarget, setEditTarget] = useState<{ item: ItemProps; file: string; tier?: string; ruleIndex: number | null } | null>(null);

  const handleShowRules = (clicked: ItemProps) => {
    if (!context) return;
    const matches = getMatchingRules(clicked, { ...context, globalAreaLevel }, 3);
    if (matches.length === 0) return; // untiered drop — nothing to edit
    const distinctFiles = Array.from(new Set(matches.map(m => m.file)));
    if (distinctFiles.length <= 1) {
      const m = matches[0];
      setEditTarget({ item: clicked, file: m.file, tier: m.tier, ruleIndex: m.ruleIndex });
    } else {
      setPickerState({ item: clicked, matches });
    }
  };

  // Data for Dropdowns
  const [allClassItems, setAllClassItems] = useState<Record<string, string[]>>({});

  // Hierarchical class picker – level-1 group selector
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  // Creator / Editor State
  const [newItem, setNewItem] = useState<ItemProps>({
      name: '', class: 'Stackable Currency', itemLevel: 80, rarity: 'Normal',
      identified: true, dropLevel: 1, stackSize: 1
  });

  // Edit mode – when non-null, the creator modal is shown in edit mode
  const [editingItem, setEditingItem] = useState<(ItemProps & { id: number }) | null>(null);

  // Bilingual base type autocomplete state
  const [baseTypeQuery, setBaseTypeQuery] = useState('');
  const [showBaseTypeDrop, setShowBaseTypeDrop] = useState(false);

  // Generator settings and related state
  const [generatorSettings, setGeneratorSettings] = useState<GeneratorSettings>({
    itemLevelMin: 60,
    itemLevelMax: 85,
    rarityWeights: { Normal: 50, Magic: 30, Rare: 15, Unique: 5 },
    enabledCategories: new Set(['equipment', 'currency', 'gems', 'maps', 'flasks', 'jewels', 'divination']),
    dropCount: 10,
  });
  const [itemPools, setItemPools] = useState<Record<string, any[]>>({});
  const [prewarmPending, setPrewarmPending] = useState<number>(0);
  const usedZones = useRef<Set<number>>(new Set());

  // Ref to the game ground div for dimension-aware placement
  const groundRef = useRef<HTMLDivElement | null>(null);

  // Debounce timer for fetchBaseTypes
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const BACKGROUNDS_ARRAY = [
    { id: "Item_bg_coast.jpg", label: language === 'ch' ? "海滩" : "Coast" },
    { id: "Item_bg_forest.jpg", label: language === 'ch' ? "丛林" : "Forest" },
    { id: "Item_bg_sand.jpg", label: language === 'ch' ? "沙漠" : "Sand" },
    { id: "color_black", label: language === 'ch' ? "黑" : "Black" },
    { id: "color_grey", label: language === 'ch' ? "灰" : "Grey" }
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

  // ---------------------------------------------------------------------------
  // fetchBaseTypes — debounced 300ms
  // ---------------------------------------------------------------------------
  const fetchBaseTypes = async (cls: string) => {
      if (allClassItems[cls]) return;
      try {
          const res = await axios.get(`/api/class-items/${cls}`);
          const names = (res.data.items as { name: string }[]).map(i => i.name).sort();
          setAllClassItems(prev => ({ ...prev, [cls]: names }));
          // Also store full items in itemPools if not already present
          setItemPools(prev => {
              if (prev[cls]) return prev;
              return { ...prev, [cls]: res.data.items };
          });
      } catch {
          // silently ignore — base types are optional autocomplete
      }
  };

  useEffect(() => {
      if (!newItem.class) return;
      // Clear previous debounce timer
      if (fetchDebounceRef.current !== null) {
          clearTimeout(fetchDebounceRef.current);
      }
      fetchDebounceRef.current = setTimeout(() => {
          fetchDebounceRef.current = null;
          fetchBaseTypes(newItem.class);
      }, 300);
      return () => {
          if (fetchDebounceRef.current !== null) {
              clearTimeout(fetchDebounceRef.current);
          }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newItem.class]);

  // ---------------------------------------------------------------------------
  // Pre-warm itemPools when enabledCategories changes OR when AppDataContext finishes loading
  // ---------------------------------------------------------------------------
  useEffect(() => {
      // Wait for the class hierarchy to be ready — getLeafClassesUnder returns [] while loading
      if (dataLoading) return;

      const classesToFetch = getCategoriesToPrewarm(
          generatorSettings.enabledCategories,
          getLeafClassesUnder
      ).filter(cls => !itemPools[cls]);

      if (classesToFetch.length === 0) return;

      setPrewarmPending(prev => prev + classesToFetch.length);

      for (const cls of classesToFetch) {
          axios.get(`/api/class-items/${cls}`)
              .then(res => {
                  const items: any[] = res.data.items ?? [];
                  const names = items.map((i: any) => i.name).sort();
                  setItemPools(prev => ({ ...prev, [cls]: items }));
                  setAllClassItems(prev => ({ ...prev, [cls]: names }));
              })
              .catch(() => { /* silently ignore */ })
              .finally(() => {
                  setPrewarmPending(prev => Math.max(0, prev - 1));
              });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatorSettings.enabledCategories, dataLoading]);

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

  // ---------------------------------------------------------------------------
  // Zone-based scatter placement
  // ---------------------------------------------------------------------------
  const getScatterPosition = useCallback((): { x: number; y: number } => {
      const COLS = 5;
      const ROWS = 4;
      const TOTAL = COLS * ROWS;
      const available = Array.from({ length: TOTAL }, (_, i) => i).filter(z => !usedZones.current.has(z));

      if (available.length === 0) {
          // Fallback: random position offset from center in pixels
          const gw = groundRef.current ? groundRef.current.offsetWidth : 800;
          const gh = groundRef.current ? groundRef.current.offsetHeight : 600;
          return {
              x: (Math.random() - 0.5) * gw * 0.8,
              y: (Math.random() - 0.5) * gh * 0.8,
          };
      }

      const zone = available[Math.floor(Math.random() * available.length)];
      usedZones.current.add(zone);

      const col = zone % COLS;
      const row = Math.floor(zone / COLS);

      // Ground dimensions (default fallback if ref not yet attached)
      const gw = groundRef.current ? groundRef.current.offsetWidth : 800;
      const gh = groundRef.current ? groundRef.current.offsetHeight : 600;

      const zoneW = gw / COLS;
      const zoneH = gh / ROWS;

      // Zone center relative to ground top-left
      const zoneCX = col * zoneW + zoneW / 2;
      const zoneCY = row * zoneH + zoneH / 2;

      // Add jitter: +/- 15% of zone size
      const jitterX = (Math.random() - 0.5) * zoneW * 0.3;
      const jitterY = (Math.random() - 0.5) * zoneH * 0.3;

      // Convert to pixel offset from center of ground
      const x = zoneCX + jitterX - gw / 2;
      const y = zoneCY + jitterY - gh / 2;

      return { x, y };
  }, []);

  // ---------------------------------------------------------------------------
  // addItemToGround
  // ---------------------------------------------------------------------------
  const addItemToGround = (item: ItemProps) => {
      if (droppedItems.length >= MAX_GROUND_ITEMS) return;
      const { x, y } = getScatterPosition();
      setDroppedItems(prev => {
          if (prev.length >= MAX_GROUND_ITEMS) return prev;
          return [...prev, { ...item, id: Date.now() + Math.random(), x, y }];
      });
  };

  // ---------------------------------------------------------------------------
  // handleGenerateDrop
  // ---------------------------------------------------------------------------
  const handleGenerateDrop = useCallback((mode: 'random' | 'valuable') => {
      if (!context) return;

      // Clear all drops and reset zones
      usedZones.current.clear();

      const count = generatorSettings.dropCount;
      const generated: (ItemProps & { id: number; x: number; y: number })[] = [];
      let idCounter = Date.now();

      if (mode === 'random') {
          for (let i = 0; i < count; i++) {
              const item = generateRandomItem(generatorSettings, itemPools, classPropsMap, getLeafClassesUnder);
              if (item) {
                  const { x, y } = getScatterPosition();
                  generated.push({ ...item, id: idCounter++, x, y });
              }
          }
      } else {
          // valuable mode
          const valuableSet = buildValuableItemSet(context.mappings);
          const maxAttempts = count * 5;
          let attempts = 0;
          while (generated.length < count && attempts < maxAttempts) {
              attempts++;
              const item = generateValuableItem(
                  generatorSettings,
                  itemPools,
                  classPropsMap,
                  getLeafClassesUnder,
                  valuableSet
              );
              if (item) {
                  const { x, y } = getScatterPosition();
                  generated.push({ ...item, id: idCounter++, x, y });
              }
          }
          if (generated.length === 0) {
              console.warn('[DropSimulator] No valuable items found for current level/category selection.');
          }
      }

      setDroppedItems(generated);
  }, [context, generatorSettings, itemPools, classPropsMap, getLeafClassesUnder, getScatterPosition]);

  const handleAddItem = () => {
      // Replica/Foulborn only exist on unique items — strip them for other rarities.
      const sanitized = newItem.rarity === 'Unique'
          ? newItem
          : { ...newItem, replica: false, foulborn: false };
      if (editingItem) {
          // Update the existing item in place by matching id
          setDroppedItems(prev => prev.map(i =>
              i.id === editingItem.id ? { ...i, ...sanitized } : i
          ));
          setEditingItem(null);
      } else {
          addItemToGround(sanitized);
      }
      setShowCreator(false);
  };

  const handleCancelCreator = () => {
      setShowCreator(false);
      setEditingItem(null);
      setBaseTypeQuery('');
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
              groups.push({ id: node.id, label: language === 'ch' ? (node.label_ch || node.label_en) : node.label_en });
              for (const child of node.children) walk(child);
          }
      };
      for (const root of classHierarchy) walk(root);
      return groups;
  }, [classHierarchy, language]);

  // Classes shown in the level-2 picker based on the selected group
  const visibleClasses = useMemo(() => {
      if (!selectedGroup) return flatClasses;
      return getLeafClassesUnder(selectedGroup);
  }, [selectedGroup, flatClasses, getLeafClassesUnder]);

  // Localized label lookup for leaf classes
  const classLabelMap = useMemo(() => {
      const map: Record<string, string> = {};
      const walk = (node: import('../services/AppDataContext').ClassHierarchyNode) => {
          if (node.poe_class) {
              map[node.poe_class] = language === 'ch'
                  ? (node.label_ch || node.label_en || node.poe_class)
                  : (node.label_en || node.poe_class);
          }
          if (node.children) node.children.forEach(walk);
      };
      classHierarchy.forEach(walk);
      return map;
  }, [classHierarchy, language]);

  // Top-level nodes for SimulatorSettingsPanel (nodes with children only)
  const topLevelNodes = useMemo(() => {
      return classHierarchy
          .filter(n => n.children && n.children.length > 0)
          .map(n => ({ id: n.id, label: language === 'ch' ? (n.label_ch || n.label_en) : n.label_en }));
  }, [classHierarchy, language]);

  // Whether rarity field should be shown for current class
  const showRarityField = activeProps.properties.includes('rarity');

  // Bilingual base type suggestions — browse first 30 on focus, filter when typing
  const baseTypeSuggestions = useMemo(() => {
      const pool = (itemPools[newItem.class] || []) as any[];
      if (!baseTypeQuery) return pool.slice(0, 30);
      const q = baseTypeQuery.toLowerCase();
      return pool.filter((item: any) =>
          item.name.toLowerCase().includes(q) ||
          (item.name_ch && item.name_ch.includes(baseTypeQuery))
      ).slice(0, 20);
  }, [baseTypeQuery, newItem.class, itemPools]);

  const renderField = (key: string, label: string, type: 'number' | 'text' | 'select', options?: string[]) => {
      // Special handling: hide rarity when class doesn't support it
      if (key === 'rarity' && !showRarityField) return null;

      const isVisible = activeProps.properties.includes(key) || activeProps.flags?.includes(key) || ['itemLevel', 'dropLevel', 'rarity'].includes(key);
      if (!isVisible && key !== 'name' && key !== 'class') return null;

      const itemRecord = newItem as Record<string, unknown>;

      const selectBaseType = (item: any) => {
          setNewItem(prev => ({
              ...prev,
              name: item.name,
              name_ch: item.name_ch || undefined,
              dropLevel: item.drop_level ?? prev.dropLevel,
              width: item.width ?? prev.width,
              height: item.height ?? prev.height,
          }));
          setBaseTypeQuery('');
          setShowBaseTypeDrop(false);
      };

      return (
          <div className={`form-group ${['name', 'class'].includes(key) ? 'full-width' : ''}`}>
              <label>{label}</label>
              {type === 'select' ? (
                  <select value={itemRecord[key] as string} onChange={e => setNewItem({...newItem, [key]: e.target.value})}>
                      {options?.map(o => <option key={o} value={o}>{(t as any)[o] || o}</option>)}
                  </select>
              ) : key === 'name' ? (
                  <div style={{ position: 'relative' }}>
                      <input
                          type="text"
                          value={baseTypeQuery !== '' ? baseTypeQuery : newItem.name}
                          placeholder={language === 'ch' ? "点击选择底材" : "Click to select base type"}
                          autoComplete="off"
                          onChange={e => { setBaseTypeQuery(e.target.value); setShowBaseTypeDrop(true); }}
                          onFocus={() => setShowBaseTypeDrop(true)}
                          onBlur={() => setTimeout(() => setShowBaseTypeDrop(false), 150)}
                      />
                      {showBaseTypeDrop && baseTypeSuggestions.length > 0 && (
                          <div className="base-type-dropdown">
                              {baseTypeSuggestions.map((item: any) => (
                                  <div
                                      key={item.name}
                                      className="base-type-option"
                                      onMouseDown={() => selectBaseType(item)}
                                  >
                                      {item.name_ch ? `${item.name_ch}  ${item.name}` : item.name}
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ) : (
                  <input
                    type={type}
                    value={(itemRecord[key] as string | number) || ''}
                    onChange={e => setNewItem({...newItem, [key]: type === 'number' ? parseInt(e.target.value) : e.target.value})}
                  />
              )}
          </div>
      );
  };

  const isAtCap = droppedItems.length >= MAX_GROUND_ITEMS;
  const submitDisabled = !newItem.name?.trim() || !newItem.class || (isAtCap && !editingItem);

  return (
    <div className="drop-simulator">
      <div className="simulator-layout">
        {/* Left panel: Settings */}
        <SimulatorSettingsPanel
          globalAreaLevel={globalAreaLevel}
          onAreaLevelChange={setGlobalAreaLevel}
          viewerBackground={viewerBackground}
          onBackgroundChange={setViewerBackground}
          backgrounds={BACKGROUNDS_ARRAY}
          settings={generatorSettings}
          onSettingsChange={setGeneratorSettings}
          onGenerateDrop={handleGenerateDrop}
          isPrewarming={prewarmPending > 0}
          topLevelNodes={topLevelNodes}
          language={language}
        />

        {/* Right: controls bar + ground */}
        <div className="simulator-main">
          <div className="simulator-controls">
            <div className="left-controls">
                <button className="control-btn" onClick={() => {
                    setEditingItem(null);
                    setNewItem({ name: '', class: 'Stackable Currency', itemLevel: 80, rarity: 'Normal', identified: true, dropLevel: 1, stackSize: 1 });
                    setBaseTypeQuery('');
                    setShowCreator(true);
                }}>+ {t.addItem}</button>
                <button className="control-btn" onClick={() => setShowImport(true)}>📋 {t.import}</button>
                <button
                  className="control-btn danger"
                  onClick={() => { setDroppedItems([]); usedZones.current.clear(); }}
                >
                  {t.clearGround} ({droppedItems.length})
                </button>
            </div>
            {isAtCap && (
              <span className="cap-notice">
                {language === 'ch' ? `地面已满 (${MAX_GROUND_ITEMS}/${MAX_GROUND_ITEMS}) — ${t.clearGround}后添加更多` : `Ground full (${MAX_GROUND_ITEMS}/${MAX_GROUND_ITEMS}) — ${t.clearGround} to add more`}
              </span>
            )}
          </div>

          <div className="game-ground" ref={groundRef} style={getBackgroundStyle()}>
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
                        onShowRules={handleShowRules}
                    />
                );
            })}
          </div>
        </div>
      </div>

      {/* Creator / Editor modal */}
      {showCreator && (
          <div className="modal-overlay">
              <div className="modal-content large">
                  <h3>{editingItem ? t.editItem : t.createItem}</h3>
                  <div className="form-grid">
                      {/* Level-1: group selector */}
                      <div className="form-group full-width class-picker-row">
                          <label>{t.classGroup}</label>
                          <select value={selectedGroup} onChange={e => {
                              setSelectedGroup(e.target.value);
                              const leaves = e.target.value ? getLeafClassesUnder(e.target.value) : flatClasses;
                              const newClass = leaves.length > 0 ? leaves[0] : newItem.class;
                              const newProps = classPropsMap[newClass] || { properties: [], flags: [], constraints: {} };
                              const resetSockets = (newProps.constraints?.max_sockets ?? 0) === 0;
                              const resetRarity = !newProps.properties.includes('rarity');
                              setBaseTypeQuery('');
                              setNewItem(prev => ({
                                  ...prev,
                                  class: newClass,
                                  name: '',
                                  ...(resetSockets ? { sockets: undefined, linkedSockets: undefined } : {}),
                                  ...(resetRarity ? { rarity: 'Normal' } : {}),
                              }));
                          }}>
                              <option value="">{t.allClasses}</option>
                              {groupNodes.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                          </select>
                      </div>
                      {/* Level-2: leaf class selector */}
                      <div className="form-group full-width">
                          <label>{t.itemClass}</label>
                          <select value={newItem.class} onChange={e => {
                              const newClass = e.target.value;
                              const newProps = classPropsMap[newClass] || { properties: [], flags: [], constraints: {} };
                              const resetSockets = (newProps.constraints?.max_sockets ?? 0) === 0;
                              const resetRarity = !newProps.properties.includes('rarity');
                              setBaseTypeQuery('');
                              setNewItem(prev => ({
                                  ...prev,
                                  class: newClass,
                                  name: '',
                                  ...(resetSockets ? { sockets: undefined, linkedSockets: undefined } : {}),
                                  ...(resetRarity ? { rarity: 'Normal' } : {}),
                              }));
                          }}>
                              {visibleClasses.map(c => <option key={c} value={c}>{classLabelMap[c] || c}</option>)}
                          </select>
                      </div>
                      {renderField('name', t.baseType, 'text')}

                      {renderField('itemLevel', t.itemLevel, 'number')}
                      {renderField('dropLevel', t.dropLevel, 'number')}
                      {showRarityField && renderField('rarity', t.rarity, 'select', ['Normal', 'Magic', 'Rare', 'Unique'])}
                      {renderField('quality', t.quality, 'number')}
                      {renderField('stackSize', t.stackSize, 'number')}
                      {renderField('gemLevel', t.gemLevel, 'number')}
                      {renderField('mapTier', t.mapTier, 'number')}
                      {renderField('memoryStrands', (t as any).memoryStrands || 'Memory Strands', 'number')}
                      {renderField('sockets', t.sockets, 'text')}
                      {renderField('linkedSockets', t.linkedSockets, 'number')}
                      {renderField('socketGroup', (t as any).socketGroup || 'Socket Group', 'text')}
                      {renderField('width', (t as any).width || 'Width', 'number')}
                      {renderField('height', (t as any).height || 'Height', 'number')}
                  </div>

                  <div className="flags-section">
                      <h4>{t.flags}</h4>
                      <div className="flags-grid">
                          {Array.from(new Set(['identified', 'corrupted', 'mirrored', ...(activeProps.flags || [])]))
                            .filter(flag => !['replica', 'foulborn'].includes(flag) || newItem.rarity === 'Unique')
                            .map(flag => (
                                <label key={flag}>
                                    <input type="checkbox" checked={!!newItem[flag as keyof ItemProps]} onChange={e => setNewItem({...newItem, [flag]: e.target.checked})} />
                                    {(t as any)[flag] || flag.charAt(0).toUpperCase() + flag.slice(1)}
                                </label>
                          ))}
                      </div>
                  </div>

                  <div className="modal-footer">
                      <button onClick={handleCancelCreator}>{t.cancel}</button>
                      <button
                        className="primary"
                        onClick={handleAddItem}
                        disabled={submitDisabled}
                      >
                        {editingItem ? t.updateItem : t.ok}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Import modal */}
      {showImport && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h3>{t.importFromClipboard}</h3>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder={t.importPlaceholder}
                    rows={10}
                  />
                  <div className="modal-footer">
                      <button onClick={() => setShowImport(false)}>{t.cancel}</button>
                      <button className="primary" onClick={handleImport}>{t.ok}</button>
                  </div>
              </div>
          </div>
      )}

      {/* In-between picker when a drop is affected by rules across multiple files */}
      {pickerState && context && (
          <SimulatorMatchPicker
              item={pickerState.item}
              matches={pickerState.matches}
              context={{ ...context, globalAreaLevel }}
              language={language}
              onClose={() => setPickerState(null)}
              onJumpToRule={onJumpToRule}
              onPick={(m) => {
                  setEditTarget({ item: pickerState.item, file: m.file, tier: m.tier, ruleIndex: m.ruleIndex });
                  setPickerState(null);
              }}
          />
      )}

      {/* Tier-block editor (styles + rules) for the chosen match */}
      {editTarget && context && (
          <SimulatorRulePanel
              item={editTarget.item}
              context={{ ...context, globalAreaLevel }}
              language={language}
              viewerBackground={viewerBackground}
              file={editTarget.file}
              matchedTier={editTarget.tier}
              matchedRuleIndex={editTarget.ruleIndex}
              onClose={() => setEditTarget(null)}
              onJumpToRule={onJumpToRule}
              onSaved={(mappingsKey, mappingContent, tierKey, tierContent) =>
                  setContext(prev => prev ? {
                      ...prev,
                      mappings: { ...prev.mappings, [mappingsKey]: mappingContent },
                      tierDefinitions: { ...prev.tierDefinitions, [tierKey]: tierContent },
                  } : prev)
              }
          />
      )}

      <style>{`
        .drop-simulator { display: flex; flex-direction: column; height: 100%; position: relative; }
        .simulator-layout { display: flex; flex-direction: row; flex: 1; overflow: hidden; min-height: 0; }
        .simulator-main { display: flex; flex-direction: column; flex: 1; overflow: hidden; min-width: 0; }

        .simulator-controls { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: #222; border-bottom: 1px solid #333; flex-shrink: 0; }
        .left-controls { display: flex; gap: 10px; align-items: center; }

        .control-btn { padding: 8px 16px; background: #444; border: 1px solid #555; color: #eee; cursor: pointer; border-radius: 4px; font-weight: bold; }
        .control-btn:hover { background: #555; }
        .control-btn.danger { background: #d32f2f; border-color: #b71c1c; }

        .cap-notice { font-size: 0.8rem; color: #f44336; font-style: italic; margin-left: auto; padding-left: 16px; }

        .game-ground {
          flex-grow: 1;
          background-color: #050505;
          background-position: center;
          position: relative;
          overflow: hidden;
        }
        .center-marker { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: rgba(255,255,255,0.1); font-size: 3rem; pointer-events: none; }

        .drop-simulator .item-plate {
            cursor: pointer; user-select: none; transition: transform 0.1s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.8);
            z-index: 1; white-space: nowrap;
        }
        .drop-simulator .item-plate:hover { transform: translate(-50%, -50%) scale(1.1); z-index: 100; border-color: white !important; }
        .drop-simulator .item-plate.hidden { opacity: 0.3; filter: grayscale(1); border: 1px dashed #555 !important; background: transparent !important; }
        .ghost-box { font-size: 0.7rem; color: #777; padding: 2px 5px; }

        .drop-simulator .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .drop-simulator .modal-content { background: #222; color: #eee; padding: 25px; border-radius: 8px; width: 400px; border: 1px solid #444; box-shadow: 0 10px 25px rgba(0,0,0,0.8); }
        .drop-simulator .modal-content.large { width: 600px; }
        .drop-simulator .modal-content h3 { margin-top: 0; border-bottom: 1px solid #444; padding-bottom: 15px; margin-bottom: 20px; }
        .mini-editor-subtitle { font-size: 0.8rem; color: #777; margin-top: -12px; margin-bottom: 16px; word-break: break-all; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .form-group label { display: block; font-size: 0.75rem; color: #888; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .form-group input, .form-group select { width: 100%; padding: 8px; background: #111; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
        .form-group input:focus { border-color: #2196F3; outline: none; }
        .form-group.full-width { grid-column: span 2; }

        .base-type-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #1a1a1a; border: 1px solid #555; border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 3000; box-shadow: 0 4px 12px rgba(0,0,0,0.6); }
        .base-type-option { padding: 7px 10px; font-size: 0.85rem; color: #ddd; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .base-type-option:hover { background: #2a3a4a; color: #fff; }

        .flags-section h4 { border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 10px; color: #aaa; font-size: 0.9rem; }
        .flags-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px; background: #1a1a1a; border-radius: 4px; }
        .flags-grid label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; color: #ccc; }

        textarea { width: 100%; background: #111; border: 1px solid #444; color: #eee; border-radius: 4px; padding: 10px; box-sizing: border-box; font-family: monospace; resize: vertical; }

        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; border-top: 1px solid #333; padding-top: 15px; }
        .modal-footer button { padding: 10px 25px; background: #333; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .modal-footer button.primary { background: #2196F3; border-color: #1976D2; }
        .modal-footer button.primary:disabled { background: #555; border-color: #444; opacity: 0.55; cursor: not-allowed; }
        .modal-footer button:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>
    </div>
  );
};

export default DropSimulator;
