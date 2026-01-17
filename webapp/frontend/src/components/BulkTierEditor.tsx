import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  DndContext, 
  pointerWithin, 
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  useDroppable
} from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { getSubTypeBackground } from '../utils/itemUtils';
import ContextMenu from './ContextMenu';
import ItemCard from './ItemCard';

interface Item {
  name: string;
  name_ch: string;
  current_tier: string[] | null;
  source_file: string | null;
  sub_type?: string;
  item_class?: string;
  drop_level?: number;
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
  defaultMappingPath?: string;
}

const ARMOUR_CLASSES = ["Body Armours", "Gloves", "Boots", "Helmets", "Shields"];

const SortableItem = ({ id, item, color, isStaged, language, onContextMenu }: { id: string, item: Item, color: string, isStaged: boolean, language: Language, onContextMenu: (e: React.MouseEvent) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard 
        item={item}
        language={language}
        color={color}
        isStaged={isStaged}
        onContextMenu={onContextMenu}
        className={isDragging ? 'dragging' : ''}
      />
    </div>
  );
};

const TierColumn = ({ id, title, color, items, children, searchInput, onScrollBottom, totalCount }: { id: string, title: string, color: string, items: Item[], children: React.ReactNode, searchInput?: React.ReactNode, onScrollBottom?: () => void, totalCount?: number }) => {
    const { setNodeRef } = useDroppable({ id });
    
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!onScrollBottom) return;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) { // 100px threshold
            onScrollBottom();
        }
    };

    return (
        <div ref={setNodeRef} className={`kanban-column ${id === 'untiered' ? 'untiered' : ''}`}>
            <div className="column-header" style={{ borderTop: `4px solid ${color}` }}>
                <h3>{title} ({totalCount ?? items.length})</h3>
                {searchInput}
            </div>
            <SortableContext id={id} items={items.map(i => `${i.name}::${id}`)} strategy={verticalListSortingStrategy}>
                <div className="column-content drop-zone" onScroll={handleScroll}>
                    {children}
                </div>
            </SortableContext>
        </div>
    );
};

const SUBTYPE_KEY_MAP: Record<string, string> = {
    "Armour": "Armour",
    "Evasion Rating": "Evasion_Rating",
    "Energy Shield": "Energy_Shield",
    "Armour / ES": "Armour_ES",
    "Evasion / Armour": "Evasion_Armour",
    "ES / Evasion": "ES_Evasion",
    "Armour / Evasion / ES": "Armour_Evasion_ES",
    "All": "All"
};

const BulkTierEditor: React.FC<BulkTierEditorProps> = ({ 
  className: initialClassName, 
  availableTiers, 
  language, 
  onClose,
  onSave,
  defaultMappingPath
}) => {
  const t = useTranslation(language);
  const [items, setItems] = useState<Item[]>([]);
  const [itemClasses, setItemClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState(initialClassName);
  const [loading, setLoading] = useState(true);
  const [searchTermTiered, setSearchTermTiered] = useState('');
  const [searchTermPool, setSearchTermPool] = useState('');
  const [debouncedSearchTermTiered, setDebouncedSearchTermTiered] = useState('');
  const [debouncedSearchTermPool, setDebouncedSearchTermPool] = useState('');
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>({ untiered: 100 });
  
  // stagedChanges: itemName -> newTierKeyList
  const [stagedChanges, setStagedChanges] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: Item, tierKey: string } | null>(null);
  const [selectedSubType, setSelectedSubType] = useState('All');
  const [showAllClasses, setShowAllClasses] = useState(false);

  const API_BASE_URL = 'http://localhost:8000';

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load unique classes
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/item-classes`)
      .then(res => setItemClasses(res.data.classes))
      .catch(err => console.error(err));
  }, []);

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTermPool(searchTermPool), 300);
    return () => clearTimeout(timer);
  }, [searchTermPool]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTermTiered(searchTermTiered), 300);
    return () => clearTimeout(timer);
  }, [searchTermTiered]);

  useEffect(() => {
      setColumnLimits({ untiered: 100 });
  }, [debouncedSearchTermPool, debouncedSearchTermTiered, selectedClass, showAllClasses, selectedSubType]);

  const availableSubTypes = useMemo(() => {
      const types = new Set<string>();
      items.forEach(i => { if(i.sub_type && i.sub_type !== 'Other') types.add(i.sub_type); });
      const sorted = Array.from(types).sort();
      if (sorted.length > 0) return ['All', ...sorted];
      return [];
  }, [items]);

  const handleLoadMore = (id: string) => {
      setColumnLimits(prev => ({ ...prev, [id]: (prev[id] || 100) + 100 }));
  };

  // Load items once on mount or when needed for the full pool
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        // Fetch all items to support global search across all classes
        const res = await axios.get(`${API_BASE_URL}/api/class-items/All`);
        setItems(res.data.items);
        setStagedChanges({}); 
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const columns = useMemo(() => {
    const cols: Record<string, Item[]> = {
      'untiered': []
    };
    availableTiers.forEach(tier => { cols[tier.key] = []; });

    items.forEach(item => {
      let effectiveTiers: string[] = [];
      if (stagedChanges[item.name] !== undefined) {
          effectiveTiers = stagedChanges[item.name];
      } else {
          effectiveTiers = item.current_tier || [];
      }

      const isItemTiered = effectiveTiers.length > 0;

      // 1. Tiered Columns Filtering
      if (isItemTiered) {
          const searchLower = debouncedSearchTermTiered.toLowerCase();
          const matchesSearch = !debouncedSearchTermTiered || 
                               item.name.toLowerCase().includes(searchLower) || 
                               (item.name_ch && item.name_ch.toLowerCase().includes(searchLower));
          if (matchesSearch) {
              effectiveTiers.forEach(t => {
                  const targetCol = t || 'untiered';
                  if (cols[targetCol]) cols[targetCol].push(item);
              });
          }
      }

      // 2. Untiered Pool Filtering
      const poolSearchLower = debouncedSearchTermPool.toLowerCase();
      const hasSearch = poolSearchLower.length > 0;
      
      const matchesPoolSearch = !hasSearch || 
                               item.name.toLowerCase().includes(poolSearchLower) || 
                               (item.name_ch && item.name_ch.toLowerCase().includes(poolSearchLower));
      
      // Class Filter: 
      // If searching: ignore class filter (global search)
      // If not searching: must match selectedClass
      const matchesClass = hasSearch || item.item_class === selectedClass;
      
      // Tier Visibility Filter:
      // If searching: ignore
      // If not searching: 
      //    showAllClasses (checkbox) ON -> show all in class
      //    showAllClasses OFF -> show only untiered in class
      const isVisibleInPool = hasSearch || (matchesClass && (showAllClasses || !isItemTiered));

      if (matchesPoolSearch && matchesClass && isVisibleInPool) {
          const matchesSubType = selectedSubType === 'All' || item.sub_type === selectedSubType;
          if (matchesSubType) {
              cols['untiered'].push(item);
          }
      }
    });

    // Final Sorting for each column
    const SUBTYPE_ORDER = ["Armour", "Evasion / Armour", "Evasion Rating", "ES / Evasion", "Energy Shield", "Armour / ES", "Armour / Evasion / ES", "Other"];
    const sortItems = (a: Item, b: Item) => {
        // 1. SubType Priority
        const idxA = SUBTYPE_ORDER.indexOf(a.sub_type || "Other");
        const idxB = SUBTYPE_ORDER.indexOf(b.sub_type || "Other");
        if (idxA !== idxB) return idxA - idxB;
        // 2. Drop Level (Desc)
        return (b.drop_level || 0) - (a.drop_level || 0);
    };

    Object.keys(cols).forEach(key => {
        cols[key].sort(sortItems);
    });

    return cols;
  }, [items, stagedChanges, debouncedSearchTermTiered, debouncedSearchTermPool, availableTiers, selectedSubType, showAllClasses, selectedClass]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeIdStr = event.active.id as string;
    const itemName = activeIdStr.split('::')[0];
    setActiveId(itemName);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const itemName = activeIdStr.split('::')[0];
    const overIdStr = over.id as string;

    // Determine target tier
    let targetTier: string | null = null;
    
    // Check if dropped on a column (droppable container)
    if (overIdStr === 'untiered' || availableTiers.some(t => t.key === overIdStr)) {
        targetTier = overIdStr === 'untiered' ? "" : overIdStr;
    } else {
        // Dropped on an item (ItemName::TierKey)
        const parts = overIdStr.split('::');
        if (parts.length > 1) {
            const tierKey = parts[1];
            targetTier = tierKey === 'untiered' ? "" : tierKey;
        } else {
            // Fallback
            const overItemName = parts[0];
            const overItem = items.find(i => i.name === overItemName);
            if (overItem) {
                const tier = stagedChanges[overItem.name] !== undefined ? stagedChanges[overItem.name] : overItem.current_tier;
                const tVal = Array.isArray(tier) ? tier[0] : tier;
                targetTier = tVal || "";
            }
        }
    }

    if (targetTier !== null) {
        const currentTiers = items.find(i => i.name === itemName)?.current_tier || [];
        let effectiveTiers = stagedChanges[itemName] ? [...stagedChanges[itemName]] : [...currentTiers];
        
        const sourceTier = activeIdStr.split('::')[1];
        const actualSource = sourceTier === 'untiered' ? "" : sourceTier;
        
        const idx = effectiveTiers.indexOf(actualSource);
        if (idx > -1) {
            effectiveTiers.splice(idx, 1);
        }
        
        if (targetTier !== "") {
            if (!effectiveTiers.includes(targetTier)) {
                effectiveTiers.push(targetTier);
            }
        }
        
        const sortedEffective = [...effectiveTiers].sort();
        const sortedOriginal = [...currentTiers].sort();
        
        if (JSON.stringify(sortedEffective) === JSON.stringify(sortedOriginal)) {
            setStagedChanges(prev => {
                const next = { ...prev };
                delete next[itemName];
                return next;
            });
        } else {
            setStagedChanges(prev => ({ ...prev, [itemName]: effectiveTiers }));
        }
    }
  };

  const handleApply = async () => {
    const changeCount = Object.keys(stagedChanges).length;
    if (changeCount === 0) return;
    
    setLoading(true);
    try {
      const promises = Object.entries(stagedChanges).map(([itemName, newTiers]) => {
        const item = items.find(i => i.name === itemName);
        return axios.post(`${API_BASE_URL}/api/update-item-tier`, {
          item_name: itemName,
          new_tiers: newTiers,
          new_tier: "", 
          source_file: item?.source_file || defaultMappingPath || `${selectedClass}.json`
        });
      });

      await Promise.all(promises);
      onSave(); 
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update some items.");
    } finally {
      setLoading(false);
    }
  };

  const handleItemRightClick = (e: React.MouseEvent, item: Item, tierKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, item, tierKey });
  };

  const handleModifyTierList = (item: Item, action: 'remove' | 'add', tierKey: string) => {
      const currentTiers = item.current_tier || [];
      let effectiveTiers = stagedChanges[item.name] ? [...stagedChanges[item.name]] : [...currentTiers];
      
      const target = tierKey === 'untiered' ? "" : tierKey;

      if (action === 'remove') {
          const idx = effectiveTiers.indexOf(target);
          if (idx > -1) effectiveTiers.splice(idx, 1);
      } else {
          if (target !== "" && !effectiveTiers.includes(target)) {
              effectiveTiers.push(target);
          }
      }

      const sortedEffective = [...effectiveTiers].sort();
      const sortedOriginal = [...currentTiers].sort();
      
      if (JSON.stringify(sortedEffective) === JSON.stringify(sortedOriginal)) {
          setStagedChanges(prev => {
              const next = { ...prev };
              delete next[item.name];
              return next;
          });
      } else {
          setStagedChanges(prev => ({ ...prev, [item.name]: effectiveTiers }));
      }
  };

  const getTierColor = (tierKey: string | null | any) => {
    if (!tierKey || typeof tierKey !== 'string') return 'white';
    const match = tierKey.match(/Tier (\d+)/);
    if (!match) {
        if (tierKey.includes('Custom')) return '#fff3e0';
        return '#f0f0f0';
    }
    const num = parseInt(match[1]);
    const colors = [
      '#ffebee', '#f3e5f5', '#e8eaf6', '#e3f2fd', '#e0f2f1', 
      '#f1f8e9', '#fffde7', '#fff3e0', '#efebe9', '#fafafa'
    ];
    return colors[num % colors.length] || '#f0f0f0';
  };

  const stagedCount = Object.keys(stagedChanges).length;
  const activeItem = activeId ? items.find(i => i.name === activeId.split('::')[0]) : null;
  const activeSourceTier = activeId ? activeId.split('::')[1] : null;

  return (
    <div className="modal-overlay" onContextMenu={(e) => e.stopPropagation()}>
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-left">
            <h2>{t.bulkEdit}: {language === 'ch' ? ((t as any)[CLASS_KEY_MAP[selectedClass] || selectedClass] || selectedClass) : selectedClass}</h2>
            <div className="class-select-wrapper">
                <span className="label">{t.itemClass}:</span>
                <select 
                    className="class-select"
                    value={selectedClass} 
                    onChange={e => setSelectedClass(e.target.value)}
                >
                    {itemClasses.map(c => (
                        <option key={c} value={c}>
                            {language === 'ch' ? ((t as any)[CLASS_KEY_MAP[c] || c] || c) : c}
                        </option>
                    ))}
                </select>
                {ARMOUR_CLASSES.includes(selectedClass) && availableSubTypes.length > 0 && (
                    <select 
                        className="class-select"
                        value={selectedSubType} 
                        onChange={e => setSelectedSubType(e.target.value)}
                        style={{ marginLeft: '10px', minWidth: '100px' }}
                    >
                        {availableSubTypes.map(st => (
                            <option key={st} value={st}>{(t as any)[SUBTYPE_KEY_MAP[st] || st] || st}</option>
                        ))}
                    </select>
                )}
            </div>
          </div>
          <div className="header-meta">
             <span className="staged-badge">{stagedCount} {t.itemsStaged}</span>
             <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="bulk-toolbar">
          <div className="filter-options">
              <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={showAllClasses} 
                    onChange={e => setShowAllClasses(e.target.checked)} 
                  />
                  {language === 'ch' ? "显示全物品类" : "Show All Classes"}
              </label>
          </div>
          <input 
            type="text" 
            placeholder={language === 'ch' ? "筛选已分类项..." : "Filter Tiered..."} 
            value={searchTermTiered} 
            onChange={e => setSearchTermTiered(e.target.value)}
            className="search-box"
          />
          <button 
            className="apply-btn" 
            disabled={stagedCount === 0 || loading}
            onClick={handleApply}
          >
            {t.saveChanges} ({stagedCount})
          </button>
        </div>

        <div className="kanban-board">
          <DndContext 
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Untiered Column */}
            <TierColumn 
                id="untiered" 
                title={t.untiered} 
                color="#999" 
                items={columns['untiered'].slice(0, columnLimits['untiered'] || 100)}
                totalCount={columns['untiered'].length}
                onScrollBottom={() => handleLoadMore('untiered')}
                searchInput={
                    <input 
                        type="text"
                        placeholder={t.filterPlaceholder}
                        value={searchTermPool}
                        onChange={e => setSearchTermPool(e.target.value)}
                        className="column-search"
                    />
                }
            >
                {columns['untiered'].slice(0, columnLimits['untiered'] || 100).map(item => (
                    <SortableItem 
                        key={`${item.name}-untiered`} 
                        id={`${item.name}::untiered`}
                        item={item} 
                        color="white"
                        isStaged={stagedChanges[item.name] !== undefined}
                        language={language}
                        onContextMenu={(e) => handleItemRightClick(e, item, 'untiered')}
                    />
                ))}
            </TierColumn>

                        {/* Tier Columns */}
                        {availableTiers.map(tier => (
                            <TierColumn
                                key={tier.key}
                                id={tier.key}
                                title={tier.label}
                                color={getTierColor(tier.key)}
                                items={columns[tier.key].slice(0, columnLimits[tier.key] || 100)}
                                totalCount={columns[tier.key].length}
                                onScrollBottom={() => handleLoadMore(tier.key)}
                            >
                                    {columns[tier.key].slice(0, columnLimits[tier.key] || 100).map(item => (
                                    <SortableItem 
                                        key={`${item.name}-${tier.key}`} 
                                        id={`${item.name}::${tier.key}`}
                                        item={item} 
                                        color={getTierColor(tier.key)}
                                        isStaged={stagedChanges[item.name] !== undefined && !(item.current_tier || []).includes(tier.key)}
                                        language={language}
                                        onContextMenu={(e) => handleItemRightClick(e, item, tier.key)}
                                    />
                                ))}
                            </TierColumn>
                        ))}
            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {activeItem ? (
                    <ItemCard 
                        item={activeItem}
                        language={language}
                        color={getTierColor(activeSourceTier === 'untiered' ? null : activeSourceTier)}
                        className="dragging"
                        style={{ width: '260px' }}
                    />
                ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu 
            x={contextMenu.x} 
            y={contextMenu.y} 
            onClose={() => setContextMenu(null)}
            options={[
                ...(contextMenu.tierKey !== 'untiered' ? [
                    { label: language === 'ch' ? "从此阶级移除" : "Remove from this Tier", onClick: () => handleModifyTierList(contextMenu.item, 'remove', contextMenu.tierKey) },
                    { divider: true, label: '', onClick: () => {} }
                ] : []),
                ...availableTiers
                    .filter(t => t.key !== contextMenu.tierKey && !(stagedChanges[contextMenu.item.name] || contextMenu.item.current_tier || []).includes(t.key))
                    .map(t => ({
                        label: language === 'ch' ? `添加至 ${t.label}` : `Add to ${t.label}`,
                        color: getTierColor(t.key),
                        onClick: () => handleModifyTierList(contextMenu.item, 'add', t.key)
                    }))
            ]}
        />
      )}

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: #fdfdfd; width: 98%; height: 95%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        
        .modal-header { padding: 15px 25px; background: white; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .header-left h2 { margin: 0; font-size: 1.2rem; color: #333; }
        .class-select-wrapper { display: flex; align-items: center; gap: 10px; }
        .class-select-wrapper .label { font-size: 0.9rem; font-weight: bold; color: #555; }
        .class-select { padding: 6px 12px; border-radius: 6px; border: 1px solid #ddd; font-weight: bold; font-size: 0.95rem; cursor: pointer; color: #2196F3; max-width: 250px; }
        
        .header-meta { display: flex; align-items: center; gap: 20px; }
        .staged-badge { background: #2196F3; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; }
        .close-btn { background: none; border: none; font-size: 2.5rem; cursor: pointer; color: #ccc; line-height: 1; }
        .close-btn:hover { color: #666; }
        
        .bulk-toolbar { padding: 10px 25px; background: white; display: flex; gap: 25px; align-items: center; border-bottom: 1px solid #ddd; }
        .search-box { flex-grow: 0; width: 300px; padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
        .apply-btn { padding: 10px 25px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: background 0.2s; }
        .apply-btn:hover { background: #43a047; }
        .apply-btn:disabled { background: #e0e0e0; color: #999; cursor: not-allowed; }

        .kanban-board { flex-grow: 1; display: flex; gap: 15px; padding: 20px; overflow-x: auto; background: #f0f2f5; }
        .kanban-column { flex: 0 0 280px; display: flex; flex-direction: column; background: #ebedf0; border-radius: 8px; overflow: hidden; max-height: 100%; border: 1px solid #ddd; }
        .column-header { padding: 12px 15px; background: #f4f5f7; border-bottom: 1px solid #ddd; }
        .column-header h3 { margin: 0; font-size: 0.9rem; color: #5e6c84; text-transform: uppercase; letter-spacing: 0.5px; }
        .column-search { width: 100%; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; margin-top: 8px; box-sizing: border-box; }
        
        .column-content { flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 100px; }
        
        .dragging { cursor: grabbing !important; box-shadow: 0 5px 15px rgba(0,0,0,0.3) !important; transform: rotate(2deg); z-index: 1000; }
        
        .untiered .column-header { border-top: 4px solid #999; }
      `}</style>
    </div>
  );
};

export default BulkTierEditor;