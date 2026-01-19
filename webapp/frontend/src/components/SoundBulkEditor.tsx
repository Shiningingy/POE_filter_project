import React, { useState, useEffect, useMemo } from 'react';
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
  pointerWithin,
  closestCenter
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
    instanceId: string; // Unique ID for DND: name::tier
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
}

// ===========================
// SUB-COMPONENTS
// ===========================

const SoundCard = ({ sound, onClick, style = {}, isDragging = false }: { sound: SoundDef, onClick?: () => void, style?: React.CSSProperties, isDragging?: boolean }) => (
    <div className={`sound-card-item ${isDragging ? 'dragging' : ''}`} onClick={onClick} style={style}>
        <span className="icon">🎵</span>
        <span className="label" title={sound.path}>{sound.label}</span>
    </div>
);

const SortableSoundCard = ({ sound, onClick }: { sound: SoundDef, onClick: () => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
        id: `catalog::${sound.path}`,
        data: { type: 'catalog-sound', sound }
    });
    const style = { transform: CSS.Translate.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <SoundCard sound={sound} onClick={onClick} isDragging={isDragging} />
        </div>
    );
};

const SortableItem = ({ id, item, language, isStaged, containerId }: { id: string, item: FlattenedItem, language: Language, isStaged: boolean, containerId: string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
      id,
      data: { type: 'item', item, containerId } 
  });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  // Calculate tier badge
  const t = item.instance_tier;
  const match = t.match(/Tier (\d+)/);
  const tierBadge = match ? `T${match[1]}` : (t === 'untiered' ? '' : t);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard 
        item={item} 
        language={language} 
        isStaged={isStaged}
        className={isDragging ? 'dragging' : ''}
      />
      {tierBadge && <div className="tier-context-badge">{tierBadge}</div>}
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
    language,
    stagedCount
}: { 
    id: string,
    sound: SoundDef, 
    items: FlattenedItem[], 
    onClose: () => void, 
    onSave: () => void, 
    onCancel: () => void,
    language: Language,
    stagedCount: number
}) => {
    const { setNodeRef } = useDroppable({ id, data: { type: 'column', sound } });
    const { attributes, listeners, transform, transition, isDragging } = useSortable({ 
        id, 
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
                <div className="column-stats">{items.length} instances</div>
            </div>
            
            <SortableContext id={id} items={items.map(i => i.instanceId)} strategy={verticalListSortingStrategy}>
                <div className="column-content">
                    {items.map(item => (
                        <SortableItem 
                            key={item.instanceId} 
                            id={item.instanceId} 
                            item={item} 
                            language={language}
                            isStaged={stagedCount > 0}
                            containerId={id}
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

const SoundBulkEditor: React.FC<SoundBulkEditorProps> = ({ language, onClose, onSave }) => {
  const t = useTranslation(language);
  const [items, setItems] = useState<Item[]>([]);
  const [soundMap, setSoundMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Catalog State
  const [defaults, setDefaults] = useState<SoundDef[]>([]);
  const [sharket, setSharket] = useState<SoundDef[]>([]);
  const [catalogTab, setCatalogTab] = useState<'sharket' | 'default' | 'custom'>('sharket');
  const [customPathInput, setCustomPathInput] = useState('');

  // Workspace State
  const [activeColumns, setActiveColumns] = useState<SoundDef[]>([]);
  const [stagedChanges, setStagedChanges] = useState<Record<string, string>>({}); // itemName -> soundPath
  const [selectedClass, setSelectedClass] = useState('All');
  const [itemClasses, setItemClasses] = useState<string[]>([]);
  const [searchTermPool, setSearchTermPool] = useState('');
  const [searchTermCatalog, setSearchTermCatalog] = useState('');
  
  // Drag State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [itemsRes, mapRes, listRes, classesRes] = await Promise.all([
            axios.get('/api/class-items/All'),
            axios.get('/api/sound-map'),
            axios.get('/api/sounds/list'),
            axios.get('/api/item-classes')
        ]);
        setItems(itemsRes.data.items);
        setSoundMap(mapRes.data);
        setDefaults(listRes.data.defaults.map((p: string) => ({ path: p, label: p.split('/').pop() || p, type: 'default' })));
        setSharket(listRes.data.sharket.map((p: string) => ({ path: p, label: p.split('/').pop() || p, type: 'sharket' })));
        setItemClasses(['All', ...classesRes.data.classes]);
        setLoading(false);
      } catch (err) { console.error(err); setLoading(false); }
    };
    fetchData();
  }, []);

  const flattenedItems: FlattenedItem[] = useMemo(() => {
      return items.flatMap(item => {
          const tiers = item.current_tier && item.current_tier.length > 0 ? item.current_tier : ['untiered'];
          return tiers.map(tier => ({
              ...item,
              instance_tier: tier,
              instanceId: `${item.name}::${tier}`
          }));
      });
  }, [items]);

  const addColumn = (sound: SoundDef, index?: number) => {
      if (!activeColumns.find(c => c.path === sound.path)) {
          setActiveColumns(prev => {
              const next = [...prev];
              if (index !== undefined && index !== -1) {
                  next.splice(index, 0, sound);
              } else {
                  next.push(sound);
              }
              return next;
          });
      }
  };

  const handleDragStart = (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id as string);
      setActiveDragData(active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);
    if (!over) return;

    const id = active.id as string;
    const overId = over.id as string;

    // 1. CATALOG SOUND -> WORKSPACE
    if (id.startsWith('catalog::')) {
        const sound = active.data.current?.sound;
        if (sound) {
            const overIndex = activeColumns.findIndex(c => c.path === overId);
            addColumn(sound, overIndex === -1 ? undefined : overIndex);
        }
        return;
    }

    // 2. COLUMN -> COLUMN (REORDER)
    if (activeColumns.some(c => c.path === id)) {
        if (id !== overId) {
            const oldIndex = activeColumns.findIndex(c => c.path === id);
            const newIndex = activeColumns.findIndex(c => c.path === overId);
            if (oldIndex !== -1 && newIndex !== -1) {
                setActiveColumns(arrayMove(activeColumns, oldIndex, newIndex));
            }
        }
        return;
    }

    // 3. ITEM -> COLUMN/POOL
    const dragData = active.data.current;
    if (dragData?.type === 'item') {
        const itemName = dragData.item.name;
        
        let targetContainerId: string | null = null;
        if (overId === 'pool') {
            targetContainerId = 'pool';
        } else {
            const overData = over.data.current;
            if (overData?.type === 'column') {
                targetContainerId = overId;
            } else if (overData?.type === 'item') {
                targetContainerId = overData.containerId;
            } else if (activeColumns.some(c => c.path === overId)) {
                targetContainerId = overId;
            }
        }

        if (targetContainerId === 'pool') {
            setStagedChanges(prev => {
                const next = { ...prev };
                delete next[itemName];
                return next;
            });
        } else if (targetContainerId) {
            setStagedChanges(prev => ({ ...prev, [itemName]: targetContainerId! }));
        }
    }
  };

  const handleSaveColumn = async (soundPath: string) => {
      const relevantChanges = Object.entries(stagedChanges).filter(([_, path]) => path === soundPath);
      if (relevantChanges.length === 0) return;

      const newMap = JSON.parse(JSON.stringify(soundMap));
      relevantChanges.forEach(([name, path]) => {
          newMap.basetype_sounds[name] = { type: 'custom', file: path, volume: 300 };
      });

      try {
          await axios.post('/api/sound-map', newMap);
          setSoundMap(newMap);
          const nextStaged = { ...stagedChanges };
          relevantChanges.forEach(([name]) => delete nextStaged[name]);
          setStagedChanges(nextStaged);
          onSave();
      } catch (e) { alert("Failed to save"); }
  };

  const poolItemsList = useMemo(() => {
      return flattenedItems.filter(i => {
          const currentAssignment = stagedChanges[i.name] !== undefined 
            ? stagedChanges[i.name] 
            : soundMap?.basetype_sounds[i.name]?.file;
          
          if (currentAssignment && activeColumns.some(c => c.path === currentAssignment)) return false;
          if (selectedClass !== 'All' && i.item_class !== selectedClass) return false;
          const searchLower = searchTermPool.toLowerCase();
          if (searchTermPool && !i.name.toLowerCase().includes(searchLower) && !(i.name_ch && i.name_ch.toLowerCase().includes(searchLower))) return false;

          return true;
      }).slice(0, 100);
  }, [flattenedItems, soundMap, stagedChanges, selectedClass, searchTermPool, activeColumns]);

  const getColumnItemsList = (path: string) => {
      return flattenedItems.filter(i => {
          const currentSound = stagedChanges[i.name] !== undefined 
            ? stagedChanges[i.name] 
            : soundMap?.basetype_sounds[i.name]?.file;
          return currentSound === path;
      });
  };

  const collisionDetectionStrategy = (args: any) => {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) return pointerCollisions;
      return closestCenter(args);
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
          <DndContext 
            sensors={sensors} 
            collisionDetection={collisionDetectionStrategy} 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd}
          >
            
            {/* 1. Item Pool (Left) */}
            <div ref={setPoolRef} className="item-pool-sidebar">
                <div className="sidebar-header">
                    <h3>{language === 'ch' ? "物品池" : "Item Pool"}</h3>
                    <input 
                        type="text" 
                        placeholder={t.search} 
                        className="pool-search" 
                        value={searchTermPool}
                        onChange={e => setSearchTermPool(e.target.value)}
                    />
                </div>
                <div className="pool-content">
                    <SortableContext id="pool" items={poolItemsList.map(i => i.instanceId)} strategy={verticalListSortingStrategy}>
                        {poolItemsList.map(i => (
                            <SortableItem key={i.instanceId} id={i.instanceId} item={i} language={language} isStaged={false} containerId="pool" />
                        ))}
                    </SortableContext>
                </div>
            </div>

            {/* 2. Workspace (Center) */}
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
                                onSave={() => handleSaveColumn(sound.path)}
                                onCancel={() => {
                                    const itemsInCol = getColumnItemsList(sound.path).map(i => i.name);
                                    const next = { ...stagedChanges };
                                    itemsInCol.forEach(name => { if(next[name] === sound.path) delete next[name]; });
                                    setStagedChanges(next);
                                }}
                                stagedCount={Object.values(stagedChanges).filter(v => v === sound.path).length}
                            />
                        ))
                    )}
                </SortableContext>
            </div>

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {activeId ? (
                    activeId.startsWith('catalog::') ? (
                        <SoundCard sound={activeDragData.sound} isDragging={true} style={{ width: '250px' }} />
                    ) : activeDragData?.type === 'item' ? (
                        <ItemCard item={activeDragData.item} language={language} className="dragging" style={{ width: '250px' }} />
                    ) : (
                        <div className="column-drag-preview">Moving Column...</div>
                    )
                ) : null}
            </DragOverlay>
          </DndContext>

          {/* 3. Catalog (Right) */}
          <div className="sound-catalog-sidebar" style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
              <div className="catalog-tabs">
                  <button className={catalogTab === 'sharket' ? 'active' : ''} onClick={() => setCatalogTab('sharket')}>{t.sharket}</button>
                  <button className={catalogTab === 'default' ? 'active' : ''} onClick={() => setCatalogTab('default')}>{t.default}</button>
                  <button className={catalogTab === 'custom' ? 'active' : ''} onClick={() => setCatalogTab('custom')}>{t.custom}</button>
              </div>
              
              {catalogTab !== 'custom' && (
                  <div className="catalog-search-box">
                      <input 
                        type="text" 
                        placeholder={t.search} 
                        value={searchTermCatalog} 
                        onChange={e => setSearchTermCatalog(e.target.value)}
                      />
                  </div>
              )}

              <div className="catalog-content">
                  {catalogTab === 'custom' ? (
                      <div className="custom-add">
                          <input type="text" placeholder={language === 'ch' ? "输入路径..." : "Enter path..."} value={customPathInput} onChange={e => setCustomPathInput(e.target.value)} />
                          <button onClick={() => { if(customPathInput) { addColumn({ path: customPathInput, label: customPathInput.split('/').pop() || customPathInput, type: 'custom' }); setCustomPathInput(''); } }}>Confirm</button>
                      </div>
                  ) : (
                      <SortableContext items={(catalogTab === 'sharket' ? sharket : defaults).filter(s => s.label.toLowerCase().includes(searchTermCatalog.toLowerCase())).map(s => `catalog::${s.path}`)} strategy={verticalListSortingStrategy}>
                          {(catalogTab === 'sharket' ? sharket : defaults)
                            .filter(s => s.label.toLowerCase().includes(searchTermCatalog.toLowerCase()))
                            .map(s => (
                              <SortableSoundCard key={s.path} sound={s} onClick={() => addColumn(s)} />
                          ))}
                      </SortableContext>
                  )}
              </div>
          </div>
        </div>
      </div>

      <style>{`
        .sound-bulk-editor { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal-content { background: #fff; width: 98%; height: 95%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
        .modal-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .header-left { display: flex; align-items: center; gap: 30px; }
        .header-left h2 { margin: 0; font-size: 1.2rem; }
        .class-nav { display: flex; align-items: center; gap: 10px; }
        .class-nav .label { font-size: 0.85rem; font-weight: bold; color: #666; }
        .class-select { padding: 6px 12px; border-radius: 6px; border: 1px solid #ddd; font-weight: bold; color: #2196F3; cursor: pointer; }

        .main-layout { flex: 1; display: flex; overflow: hidden; background: #f0f2f5; }
        
        .item-pool-sidebar, .sound-catalog-sidebar { width: 280px; display: flex; flex-direction: column; background: #fff; border-right: 1px solid #ddd; }
        .sound-catalog-sidebar { border-right: none; border-left: 1px solid #ddd; width: 300px; }
        
        .sidebar-header { padding: 15px; border-bottom: 1px solid #eee; }
        .sidebar-header h3 { margin: 0 0 10px 0; font-size: 0.85rem; color: #666; text-transform: uppercase; }
        .pool-search { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .pool-content, .catalog-content { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        
        .catalog-tabs { display: flex; border-bottom: 1px solid #eee; }
        .catalog-tabs button { flex: 1; padding: 12px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: #999; font-weight: bold; font-size: 0.75rem; }
        .catalog-tabs button.active { color: #2196F3; border-bottom-color: #2196F3; }
        
        .catalog-search-box { padding: 10px; border-bottom: 1px solid #eee; }
        .catalog-search-box input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }

        .sound-card-item { background: #f8f9fa; border: 1px solid #ddd; padding: 10px; border-radius: 6px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; }
        .sound-card-item:hover { border-color: #2196F3; background: #f0f7ff; }
        .sound-card-item .label { font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .sound-card-item.dragging { opacity: 0.5; border-style: dashed; }

        .custom-add { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .custom-add input { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; }
        .custom-add button { padding: 10px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }

        .columns-workspace { flex: 1; display: flex; gap: 15px; padding: 20px; overflow-x: auto; align-items: flex-start; }
        .empty-workspace { flex: 1; display: flex; align-items: center; justify-content: center; color: #aaa; font-style: italic; border: 2px dashed #ddd; border-radius: 12px; margin: 20px; text-align: center; }
        
        .sound-workspace-column { flex: 0 0 280px; display: flex; flex-direction: column; background: #ebedf0; border-radius: 8px; border: 1px solid #ddd; max-height: 100%; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .column-header { padding: 12px; background: #fff; border-bottom: 1px solid #ddd; cursor: grab; }
        .column-header:active { cursor: grabbing; }
        .title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .sound-type-badge { font-size: 0.55rem; background: #2196F3; color: white; padding: 1px 4px; border-radius: 3px; text-transform: uppercase; font-weight: bold; }
        .sound-name { font-weight: bold; font-size: 0.8rem; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .column-stats { font-size: 0.7rem; color: #888; }
        
        .column-content { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 100px; }
        .column-placeholder { border: 2px dashed #ccc; border-radius: 6px; padding: 20px; text-align: center; color: #999; font-style: italic; font-size: 0.8rem; }
        
        .column-footer { padding: 10px; background: #fff; border-top: 1px solid #ddd; display: flex; gap: 8px; }
        .column-footer button { flex: 1; padding: 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold; transition: all 0.2s; }
        .col-save-btn { background: #4CAF50; color: white; border: none; }
        .col-save-btn:hover:not(:disabled) { background: #43a047; }
        .col-save-btn:disabled { background: #eee; color: #ccc; cursor: not-allowed; }
        .col-cancel-btn { background: #f5f5f5; color: #666; border: 1px solid #ddd; }
        .col-cancel-btn:hover:not(:disabled) { background: #eee; }
        
        .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #ff5252; padding: 0 5px; line-height: 1; }
        .dragging { cursor: grabbing !important; }
        
        .column-drag-preview { background: #2196F3; color: white; padding: 20px; border-radius: 8px; font-weight: bold; }
        
        .tier-context-badge { 
            font-size: 0.65rem; 
            background: #eee; 
            color: #666; 
            padding: 2px 6px; 
            border-radius: 4px; 
            margin-top: 4px; 
            text-align: right; 
            font-weight: bold; 
            border: 1px solid #ddd; 
        }
      `}</style>
    </div>
  );
};

export default SoundBulkEditor;