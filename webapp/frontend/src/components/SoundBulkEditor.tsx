import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  DndContext, 
  type DragEndEvent, 
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  useDroppable,
  useDraggable,
  pointerWithin,
  closestCorners,
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation, CLASS_KEY_MAP } from '../utils/localization';
import type { Language } from '../utils/localization';
import ItemCard from './ItemCard';

// ===========================
// TYPES
// ===========================

interface Item {
  name: string;
  name_ch: string;
  current_tier: string[] | null;
  item_class?: string;
  sub_type?: string;
  [key: string]: any;
}

interface FlattenedItem extends Item {
    instance_tier: string;
    instanceId: string; // Stable Unique ID: name::tier::rule-X
    rule_index?: number;
}

interface SoundDef {
  path: string;
  label: string;
  type: 'sharket' | 'default' | 'custom';
}

interface SoundBulkEditorProps {
  language: Language;
  onClose: () => void;
  onSave: () => void;
  categoryRules?: any[]; 
  themeData?: any;
  fullConfig?: any;
}

// ===========================
// SUB-COMPONENTS
// ===========================

const CatalogSoundCard = ({ sound, onClick }: { sound: SoundDef, onClick: () => void }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ 
        id: `catalog::${sound.path}`,
        data: { type: 'catalog-sound', sound }
    });
    
    const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 1001 } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`sound-card-item ${isDragging ? 'dragging' : ''}`} onClick={onClick}>
            <span className="icon">🎵</span>
            <span className="label" title={sound.path}>{sound.label}</span>
        </div>
    );
};

const PoolItem = ({ item, language, isStaged, currentSound }: { item: FlattenedItem, language: Language, isStaged: boolean, currentSound?: string }) => {
    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `pool-drop::${item.instanceId}`,
        data: { type: 'pool-item', item, containerId: 'pool' }
    });

    const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({ 
        id: item.instanceId,
        data: { type: 'item', item, containerId: 'pool' } 
    });
    
    const style = transform ? { transform: CSS.Translate.toString(transform), zIndex: 1001 } : undefined;

    const setRefs = (el: HTMLElement | null) => {
        setDroppableRef(el);
        setDraggableRef(el);
    };

    return (
        <div ref={setRefs} style={style} {...attributes} {...listeners} className={`${isDragging ? 'dragging-source' : ''} ${isStaged ? 'staged-removal' : ''}`}>
            <ItemCard item={item} language={language} isStaged={isStaged} currentSound={currentSound} showDetails={true} className={isDragging ? 'dragging' : ''} />
        </div>
    );
};

const WorkspaceItem = ({ item, language, containerId, isStaged, onDelete, currentSound }: { item: FlattenedItem, language: Language, containerId: string, isStaged: boolean, onDelete: () => void, currentSound?: string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
      id: item.instanceId,
      data: { type: 'item', item, containerId } 
  });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard 
        item={item} 
        language={language} 
        isStaged={isStaged} 
        currentSound={currentSound}
        showDetails={true}
        onDelete={(e) => { e.stopPropagation(); onDelete(); }}
        className={isDragging ? 'dragging' : ''} 
      />
    </div>
  );
};

const WorkspaceColumn = ({ 
    id,
    sound, 
    items, 
    onClose, 
    onSave, 
    onCancel, 
    onRemoveItem,
    language,
    stagedCount,
    resolveCurrentSound
}: { 
    id: string,
    sound: SoundDef, 
    items: FlattenedItem[], 
    onClose: () => void, 
    onSave: () => void, 
    onCancel: () => void,
    onRemoveItem: (itemName: string, tier: string, ruleIdx?: number) => void,
    language: Language,
    stagedCount: number,
    resolveCurrentSound: (name: string, tier: string, ruleIdx?: number) => string | undefined
}) => {
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ 
        id: id + '-sort', 
        data: { type: 'column', sound } 
    });
    const t = useTranslation(language);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div ref={setNodeRef} style={style} className="sound-workspace-column">
            <div className="column-header" {...attributes} {...listeners}>
                <div className="title-row">
                    <span className="sound-type-badge">{sound.type}</span>
                    <span className="sound-name" title={sound.path}>{sound.label}</span>
                    <button className="close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
                </div>
                <div className="column-stats">{items.length} cards</div>
            </div>
            
            <SortableContext id={id} items={items.map(i => i.instanceId)} strategy={verticalListSortingStrategy}>
                <div className="column-content">
                    {items.map(item => (
                        <WorkspaceItem 
                            key={item.instanceId} 
                            item={item} 
                            language={language}
                            isStaged={stagedCount > 0}
                            containerId={id}
                            onDelete={() => onRemoveItem(item.name, item.instance_tier, item.rule_index)}
                            currentSound={resolveCurrentSound(item.name, item.instance_tier, item.rule_index)}
                        />
                    ))}
                    {items.length === 0 && <div className="column-placeholder">Drop items here</div>}
                </div>
            </SortableContext>

            <div className="column-footer">
                <button className="col-cancel-btn" disabled={stagedCount === 0} onClick={onCancel}>{t.cancel}</button>
                <button className="col-save-btn" disabled={stagedCount === 0} onClick={onSave}>{t.ok}</button>
            </div>
        </div>
    );
};

// ===========================
// MAIN COMPONENT
// ===========================

const SoundBulkEditor: React.FC<SoundBulkEditorProps> = ({ language, onClose, onSave, themeData, fullConfig }) => {
  const t = useTranslation(language);
  
  // State Hooks
  const [items, setItems] = useState<Item[]>([]);
  const [soundMap, setSoundMap] = useState<any>(null);
  const [globalRules, setGlobalRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [defaults, setDefaults] = useState<SoundDef[]>([]);
  const [sharket, setSharket] = useState<SoundDef[]>([]);
  const [catalogTab, setCatalogTab] = useState<'sharket' | 'default' | 'custom'>('sharket');
  const [customPathInput, setCustomPathInput] = useState('');
  const [activeColumns, setActiveColumns] = useState<SoundDef[]>([]);
  const [stagedChanges, setStagedChanges] = useState<Record<string, string>>({}); 
  const [selectedClass, setSelectedClass] = useState('All');
  const [itemClasses, setItemClasses] = useState<string[]>([]);
  const [searchTermPool, setSearchTermPool] = useState('');
  const [searchTermCatalog, setSearchTermCatalog] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Sound Resolution Helper
  const resolveCurrentSound = useCallback((itemName: string, instanceTier: string, ruleIndex?: number) => {
      // 1. Staged Changes (Local)
      if (stagedChanges[itemName] !== undefined) return stagedChanges[itemName];

      // 2. Global Rule Overrides
      if (globalRules && ruleIndex !== undefined) {
          const rule = globalRules[ruleIndex];
          if (rule?.overrides) {
              const soundKey = ["CustomAlertSound", "AlertSound", "DropSound", "PlayAlertSound"].find(k => rule.overrides[k]);
              if (soundKey) {
                  const val = rule.overrides[soundKey];
                  return Array.isArray(val) ? val[0] : val;
              }
          }
      }

      // 3. Global Sound Map (Auto-Sounds)
      const autoSound = soundMap?.basetype_sounds[itemName]?.file;
      if (autoSound) return autoSound;

      // 4. Tier Theme Fallback
      if (fullConfig && themeData && instanceTier !== 'untiered') {
          try {
              const catKey = Object.keys(fullConfig).find(k => !k.startsWith('//'));
              if (catKey && fullConfig[catKey][instanceTier]) {
                  const tierData = fullConfig[catKey][instanceTier];
                  const themeCategory = fullConfig[catKey]._meta?.theme_category || catKey;
                  if (tierData.theme?.PlayAlertSound) {
                      const val = tierData.theme.PlayAlertSound;
                      return Array.isArray(val) ? val[0] : val;
                  }
                  const tierMatch = instanceTier.match(/Tier (\d+)/);
                  if (tierMatch && themeData[themeCategory]) {
                      const tierNameInTheme = `Tier ${tierMatch[1]}`;
                      const style = themeData[themeCategory][tierNameInTheme];
                      if (style?.default_sound_id !== undefined && style.default_sound_id !== -1) {
                          return `Default/AlertSound${style.default_sound_id}.mp3`;
                      }
                  }
              }
          } catch (e) { console.error("Theme resolution failed", e); }
      }
      return undefined;
  }, [stagedChanges, globalRules, soundMap, themeData, fullConfig]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [itemsRes, mapRes, listRes, classesRes, rulesRes] = await Promise.all([
            axios.get('/api/class-items/All'),
            axios.get('/api/sound-map'),
            axios.get('/api/sounds/list'),
            axios.get('/api/item-classes'),
            axios.get('/api/all-rules')
        ]);
        console.log("[DND] Raw rules response:", rulesRes.data);
        setItems(itemsRes.data.items);
        setSoundMap(mapRes.data);
        setGlobalRules(rulesRes.data.rules || []);
        setDefaults(listRes.data.defaults.map((p: string) => ({ path: p, label: p.split('/').pop() || p, type: 'default' })));
        setSharket(listRes.data.sharket.map((p: string) => ({ path: p, label: p.split('/').pop() || p, type: 'sharket' })));
        setItemClasses(['All', ...classesRes.data.classes]);
        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, []);

  const flattenedItems: FlattenedItem[] = useMemo(() => {
      if (!items.length) return [];
      const flattened: FlattenedItem[] = [];
      
      console.log("[DND] Re-flattening items. globalRules count:", globalRules.length);

      items.forEach(item => {
          const isChaos = item.name === 'Chaos Orb';
          
          // Identify all rules targeting this item across ALL categories
          const itemRules = globalRules ? globalRules.map((r, idx) => ({r, idx})).filter(({r}) => {
              return r.targets?.some((target: any) => {
                  const targetName = (typeof target === 'string') ? target : target.name;
                  return targetName === item.name;
              });
          }) : [];
          
          if (isChaos) {
              console.log("[DND] Flattening Chaos Orb. Matches in globalRules:", itemRules.length, itemRules.map(x => x.idx));
          }

          // 1. Create a card for every rule instance
          itemRules.forEach(({r, idx}) => {
              const tier = r.overrides?.Tier || (item.current_tier && item.current_tier.length > 0 ? item.current_tier[0] : 'untiered');
              const inst = {
                  ...item,
                  instance_tier: tier,
                  instanceId: `${item.name}::${tier}::rule-${idx}`,
                  rule_index: idx
              };
              if (isChaos) console.log("[DND] Created Chaos Rule Instance:", inst.instanceId, "Index:", inst.rule_index);
              flattened.push(inst);
          });

          // 2. Create cards for Tier Default instances
          (item.current_tier || []).forEach(tier => {
              const isHandledByRuleInThisTier = itemRules.some(({r}) => r.overrides?.Tier === tier);
              if (!isHandledByRuleInThisTier) {
                  const inst = {
                      ...item,
                      instance_tier: tier,
                      instanceId: `${item.name}::${tier}::default`,
                      rule_index: undefined
                  };
                  if (isChaos) console.log("[DND] Created Chaos Default Instance:", inst.instanceId);
                  flattened.push(inst);
              }
          });
      });
      return flattened;
  }, [items, globalRules]);

  const addColumn = (sound: SoundDef, index?: number) => {
      if (!activeColumns.find(c => c.path === sound.path)) {
          setActiveColumns(prev => {
              const next = [...prev];
              if (index !== undefined && index !== -1) next.splice(index, 0, sound);
              else next.push(sound);
              return next;
          });
      }
  };

  const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      setActiveDragData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);
    if (!over) return;

    const id = active.id as string;
    const overId = over.id as string;
    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === 'catalog-sound') {
        const overIndex = activeColumns.findIndex(c => c.path === overId);
        addColumn(activeData.sound, overIndex === -1 ? undefined : overIndex);
        return;
    }

    if (activeData?.type === 'column') {
        const oldIdx = activeColumns.findIndex(c => c.path === id.replace('-sort', ''));
        const newIdx = activeColumns.findIndex(c => c.path === overId.replace('-sort', ''));
        if (oldIdx !== -1 && newIdx !== -1) setActiveColumns(arrayMove(activeColumns, oldIdx, newIdx));
        return;
    }

    if (activeData?.type === 'item') {
        const itemName = activeData.item.name;
        let targetId: string | null = null;

        if (overId === 'pool' || overData?.type === 'pool' || overData?.containerId === 'pool') {
            targetId = 'pool';
        } else if (activeColumns.some(c => c.path === overId)) {
            targetId = overId;
        } else if (overData?.type === 'column') {
            targetId = overId;
        } else if (overData?.type === 'item' || overData?.type === 'pool-item') {
            targetId = overData.containerId;
        }

        if (targetId === 'pool') {
            const originalSound = resolveCurrentSound(itemName, activeData.item.instance_tier, activeData.item.rule_index);
            if (originalSound) setStagedChanges(prev => ({ ...prev, [itemName]: '' }));
            else setStagedChanges(prev => { const n = {...prev}; delete n[itemName]; return n; });
        } else if (targetId && targetId !== 'pool') {
            setStagedChanges(prev => ({ ...prev, [itemName]: targetId! }));
        }
    }
  };

  const poolItemsList = useMemo(() => {
      return flattenedItems.filter(i => {
          const currentAssignment = resolveCurrentSound(i.name, i.instance_tier, i.rule_index);
          if (currentAssignment && activeColumns.some(c => c.path === currentAssignment)) return false;
          if (selectedClass !== 'All' && i.item_class !== selectedClass) return false;
          const searchLower = searchTermPool.toLowerCase();
          if (searchTermPool && !i.name.toLowerCase().includes(searchLower) && !(i.name_ch && i.name_ch.toLowerCase().includes(searchLower))) return false;
          return true;
      }).slice(0, 100);
  }, [flattenedItems, resolveCurrentSound, selectedClass, searchTermPool, activeColumns]);

  const getColumnItemsList = (path: string) => {
      return flattenedItems.filter(i => resolveCurrentSound(i.name, i.instance_tier, i.rule_index) === path);
  };

  const collisionDetectionStrategy = (args: any) => {
      const collisions = pointerWithin(args);
      if (collisions.length > 0) return collisions;
      return closestCorners(args);
  };

  const { setNodeRef: setPoolRef } = useDroppable({ id: 'pool', data: { type: 'pool' } });

  return (
    <div className="sound-bulk-editor modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-left">
            <h2>🎵 {language === 'ch' ? "音效批量编辑器" : "Sound Bulk Editor"}</h2>
            <div className="class-nav">
                <span className="label">{(t as any).itemClass}:</span>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="class-select">
                    {itemClasses.map(c => <option key={c} value={c}>{language === 'ch' ? ((t as any)[CLASS_KEY_MAP[c] || c] || c) : c}</option>)}
                </select>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="main-layout">
          <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            
            <div ref={setPoolRef} className="item-pool-sidebar">
                <div className="sidebar-header">
                    <h3>{language === 'ch' ? "物品池" : "Item Pool"}</h3>
                    <input type="text" placeholder={t.search} className="pool-search" value={searchTermPool} onChange={e => setSearchTermPool(e.target.value)} />
                </div>
                <div className="pool-content">
                    {poolItemsList.map(i => (
                        <PoolItem 
                            key={i.instanceId} 
                            item={i} 
                            language={language} 
                            isStaged={stagedChanges[i.name] === ''} 
                            currentSound={resolveCurrentSound(i.name, i.instance_tier, i.rule_index)} 
                        />
                    ))}
                </div>
            </div>

            <div className="columns-workspace">
                <SortableContext items={activeColumns.map(c => c.path)} strategy={horizontalListSortingStrategy}>
                    {activeColumns.length === 0 ? (
                        <div className="empty-workspace">
                            {language === 'ch' ? "从右侧点击或拖入音效卡片以开始" : "Click or drag sound cards from the right to start"}
                        </div>
                    ) : (
                        activeColumns.map(sound => (
                            <WorkspaceColumn 
                                key={sound.path}
                                id={sound.path}
                                sound={sound}
                                items={getColumnItemsList(sound.path)}
                                language={language}
                                onClose={() => setActiveColumns(prev => prev.filter(c => c.path !== sound.path))}
                                onSave={async () => {
                                    const assignedToThis = Object.entries(stagedChanges).filter(([_, path]) => path === sound.path);
                                    const removedFromThis = Object.entries(stagedChanges).filter(([name, path]) => {
                                        return path === '' && resolveCurrentSound(name, '', undefined) === sound.path; 
                                    });
                                    const changesToCommit = [...assignedToThis, ...removedFromThis];
                                    const newMap = JSON.parse(JSON.stringify(soundMap));
                                    changesToCommit.forEach(([name, path]) => {
                                        if (path === '') delete newMap.basetype_sounds[name];
                                        else newMap.basetype_sounds[name] = { type: 'custom', file: path, volume: 300 };
                                    });
                                    try {
                                        await axios.post('/api/sound-map', newMap);
                                        setSoundMap(newMap);
                                        const nextStaged = { ...stagedChanges };
                                        changesToCommit.forEach(([name]) => delete nextStaged[name]);
                                        setStagedChanges(nextStaged);
                                        onSave();
                                    } catch (e) { alert("Failed to save"); }
                                }}
                                onRemoveItem={(name, tier, ruleIdx) => {
                                    const current = resolveCurrentSound(name, tier, ruleIdx);
                                    if (current) setStagedChanges(prev => ({ ...prev, [name]: '' }));
                                    else setStagedChanges(prev => { const n = {...prev}; delete n[name]; return n; });
                                }}
                                onCancel={() => {
                                    const itemsInCol = getColumnItemsList(sound.path).map(i => i.name);
                                    const next = { ...stagedChanges };
                                    itemsInCol.forEach(name => { if(next[name] === sound.path) delete next[name]; });
                                    setStagedChanges(next);
                                }}
                                stagedCount={Object.values(stagedChanges).filter(v => v === sound.path).length}
                                resolveCurrentSound={resolveCurrentSound}
                            />
                        ))
                    )}
                </SortableContext>
            </div>

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {activeId ? (
                    activeId.startsWith('catalog::') ? (
                        <div className="sound-card-item dragging-overlay">
                            <span>🎵</span>
                            <span>{activeDragData?.sound?.label}</span>
                        </div>
                    ) : activeDragData?.type === 'item' ? (
                        <ItemCard item={activeDragData.item} language={language} className="dragging" style={{ width: '250px' }} />
                    ) : (
                        <div className="column-drag-preview">Moving Column...</div>
                    )
                ) : null}
            </DragOverlay>
          </DndContext>

          <div className="sound-catalog-sidebar" style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
              <div className="catalog-tabs">
                  <button className={catalogTab === 'sharket' ? 'active' : ''} onClick={() => setCatalogTab('sharket')}>{t.sharket}</button>
                  <button className={catalogTab === 'default' ? 'active' : ''} onClick={() => setCatalogTab('default')}>{t.default}</button>
                  <button className={catalogTab === 'custom' ? 'active' : ''} onClick={() => setCatalogTab('custom')}>{t.custom}</button>
              </div>
              {catalogTab !== 'custom' && (
                  <div className="catalog-search-box">
                      <input type="text" placeholder={t.search} value={searchTermCatalog} onChange={e => setSearchTermCatalog(e.target.value)} />
                  </div>
              )}
              <div className="catalog-content">
                  {catalogTab === 'custom' ? (
                      <div className="custom-add">
                          <input type="text" placeholder={language === 'ch' ? "输入路径..." : "Enter path..."} value={customPathInput} onChange={e => setCustomPathInput(e.target.value)} />
                          <button onClick={() => { if(customPathInput) { addColumn({ path: customPathInput, label: customPathInput.split('/').pop() || customPathInput, type: 'custom' }); setCustomPathInput(''); } }}>Confirm</button>
                      </div>
                  ) : (
                      (catalogTab === 'sharket' ? sharket : defaults)
                        .filter(s => s.label.toLowerCase().includes(searchTermCatalog.toLowerCase()))
                        .map(s => (
                          <CatalogSoundCard key={s.path} sound={s} onClick={() => addColumn(s)} />
                      ))
                  )}
              </div>
          </div>
        </div>
      </div>

      <style>{`
        .sound-bulk-editor { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal-content { background: #fff; width: 98%; height: 95%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .header-left { display: flex; align-items: center; gap: 30px; }
        .header-left h2 { margin: 0; font-size: 1.2rem; }
        .class-nav { display: flex; align-items: center; gap: 10px; }
        .class-nav .label { font-size: 0.85rem; font-weight: bold; color: #666; }
        .class-select { padding: 6px 12px; border-radius: 6px; border: 1px solid #ddd; font-weight: bold; color: #2196F3; cursor: pointer; }
        .main-layout { flex: 1; display: flex; overflow: hidden; background: #f0f2f5; }
        .item-pool-sidebar { width: 280px; display: flex; flex-direction: column; background: #fff; border-right: 1px solid #ddd; }
        .sound-catalog-sidebar { border-right: none; border-left: 1px solid #ddd; width: 300px; }
        .sidebar-header { padding: 15px; border-bottom: 1px solid #eee; }
        .sidebar-header h3 { margin: 0 0 10px 0; font-size: 0.85rem; color: #666; text-transform: uppercase; }
        .pool-search { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .pool-content { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 400px; background: #fafafa; }
        .catalog-content { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .catalog-tabs { display: flex; border-bottom: 1px solid #eee; }
        .catalog-tabs button { flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: #999; font-weight: bold; font-size: 0.75rem; }
        .catalog-tabs button.active { color: #2196F3; border-bottom-color: #2196F3; }
        .catalog-search-box { padding: 10px; border-bottom: 1px solid #eee; }
        .catalog-search-box input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .sound-card-item { background: #f8f9fa; border: 1px solid #ddd; padding: 10px; border-radius: 6px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; }
        .sound-card-item:hover { border-color: #2196F3; background: #f0f7ff; }
        .sound-card-item .label { font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .sound-card-item.dragging { opacity: 0.5; border-style: dashed; }
        .dragging-source { opacity: 0.3; }
        .staged-removal { background: #fff5f5 !important; border: 1px dashed #ff5252 !important; }
        .dragging-overlay { box-shadow: 0 10px 25px rgba(0,0,0,0.3); transform: rotate(2deg); background: #e3f2fd; padding: 10px; border-radius: 8px; display: flex; align-items: center; gap: 10px; z-index: 2000; }
        .custom-add { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .custom-add input { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; }
        .custom-add button { padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .columns-workspace { flex: 1; display: flex; gap: 15px; padding: 20px; overflow-x: auto; align-items: flex-start; }
        .empty-workspace { flex: 1; display: flex; align-items: center; justify-content: center; color: #aaa; font-style: italic; border: 2px dashed #ddd; border-radius: 12px; margin: 20px; text-align: center; }
        .sound-workspace-column { flex: 0 0 280px; display: flex; flex-direction: column; background: #ebedf0; border-radius: 8px; border: 1px solid #ddd; max-height: 100%; min-height: 200px; }
        .column-header { padding: 12px; background: #fff; border-bottom: 1px solid #ddd; cursor: grab; }
        .title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .sound-type-badge { font-size: 0.55rem; background: #2196F3; color: white; padding: 1px 4px; border-radius: 3px; text-transform: uppercase; font-weight: bold; }
        .sound-name { font-weight: bold; font-size: 0.8rem; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .column-stats { font-size: 0.7rem; color: #888; }
        .column-content { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 150px; background: #f4f5f7; border-radius: 0 0 8px 8px; }
        .column-placeholder { border: 2px dashed #ccc; border-radius: 6px; padding: 20px; text-align: center; color: #999; font-style: italic; font-size: 0.8rem; background: #fff; margin-top: 10px; }
        .column-footer { padding: 10px; background: #fff; border-top: 1px solid #ddd; display: flex; gap: 8px; border-radius: 0 0 8px 8px; }
        .column-footer button { flex: 1; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold; }
        .col-save-btn { background: #4CAF50; color: white; border: none; }
        .col-save-btn:disabled { background: #eee; color: #ccc; cursor: not-allowed; }
        .col-cancel-btn { background: #f5f5f5; color: #666; border: 1px solid #ddd; }
        .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #ff5252; padding: 0 5px; }
        .dragging { cursor: grabbing !important; }
        .tier-context-badge { font-size: 0.65rem; background: #eee; color: #666; padding: 2px 6px; border-radius: 4px; margin-top: 4px; text-align: right; font-weight: bold; border: 1px solid #ddd; }
        .tier-pill { color: #2196F3; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default SoundBulkEditor;