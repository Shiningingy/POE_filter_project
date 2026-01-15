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

interface Item {
  name: string;
  name_ch: string;
  current_tier: string[] | null;
  source_file: string | null;
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

const CLASS_TRANSLATIONS: Record<string, string> = {
    "Body Armours": "胸甲",
    "Boots": "鞋子",
    "Gloves": "手套",
    "Helmets": "头部",
    "Shields": "盾",
    "Quivers": "箭袋",
    "Amulets": "项链",
    "Belts": "腰带",
    "Rings": "戒指",
    "Bows": "弓",
    "Claws": "爪",
    "Daggers": "匕首",
    "Rune Daggers": "符文匕首",
    "One Hand Axes": "单手斧",
    "One Hand Maces": "单手锤",
    "One Hand Swords": "单手剑",
    "Sceptres": "短杖",
    "Staves": "长杖",
    "Warstaves": "战杖",
    "Two Hand Axes": "双手斧",
    "Two Hand Maces": "双手锤",
    "Two Hand Swords": "双手剑",
    "Wands": "法杖",
    "Active Skill Gems": "技能宝石",
    "Support Skill Gems": "辅助宝石",
    "Maps": "地图",
    "Map Fragments": "碎片",
    "Stackable Currency": "通货",
    "Divination Card": "命运卡"
};

const SortableItem = ({ id, item, color, isStaged, language }: { id: string, item: Item, color: string, isStaged: boolean, language: Language }) => {
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
    backgroundColor: color
  };

  const showChineseFirst = language === 'ch';

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`item-card ${isStaged ? 'staged' : ''}`}
      onContextMenu={(e) => e.stopPropagation()} 
    >
      <div className="item-info">
        <div className="name-primary">{showChineseFirst ? item.name_ch : item.name}</div>
        <div className="name-secondary">{showChineseFirst ? item.name : item.name_ch}</div>
      </div>
      {isStaged && <div className="staged-indicator">●</div>}
    </div>
  );
};

const TierColumn = ({ id, title, color, items, children }: { id: string, title: string, color: string, items: Item[], children: React.ReactNode }) => {
    const { setNodeRef } = useDroppable({ id });
    
    return (
        <div ref={setNodeRef} className={`kanban-column ${id === 'untiered' ? 'untiered' : ''}`}>
            <div className="column-header" style={{ borderTop: `4px solid ${color}` }}>
                <h3>{title} ({items.length})</h3>
            </div>
            <SortableContext id={id} items={items.map(i => `${i.name}::${id}`)} strategy={verticalListSortingStrategy}>
                <div className="column-content drop-zone">
                    {children}
                </div>
            </SortableContext>
        </div>
    );
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
  const [searchTerm, setSearchTerm] = useState('');
  
  // stagedChanges: itemName -> newTierKeyList
  const [stagedChanges, setStagedChanges] = useState<Record<string, string[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const API_BASE_URL = 'http://localhost:8000';

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load unique classes
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/item-classes`)
      .then(res => setItemClasses(res.data.classes))
      .catch(err => console.error(err));
  }, []);

  // Load items when class changes
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/class-items/${encodeURIComponent(selectedClass)}`);
        setItems(res.data.items);
        setStagedChanges({}); // Clear staged changes when switching classes
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [selectedClass]);

  const columns = useMemo(() => {
    const cols: Record<string, Item[]> = {
      'untiered': []
    };
    availableTiers.forEach(tier => { cols[tier.key] = []; });

    items.forEach(item => {
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase()) && !item.name_ch.includes(searchTerm)) {
          return;
      }
      
      let effectiveTiers: string[] = [];
      if (stagedChanges[item.name] !== undefined) {
          effectiveTiers = stagedChanges[item.name];
      } else {
          effectiveTiers = item.current_tier || [];
      }
      
      if (effectiveTiers.length === 0) {
          cols['untiered'].push(item);
      } else {
          effectiveTiers.forEach(t => {
              const targetCol = t || 'untiered';
              if (cols[targetCol]) cols[targetCol].push(item);
              else cols['untiered'].push(item);
          });
      }
    });
    return cols;
  }, [items, stagedChanges, searchTerm, availableTiers]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeIdStr = event.active.id as string;
    const itemName = activeIdStr.split('::')[0];
    setActiveId(itemName);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log("DragEnd Raw:", { activeId: active.id, overId: over?.id });
    setActiveId(null);

    if (!over) return;

    const activeIdStr = active.id as string;
    const itemName = activeIdStr.split('::')[0];
    const overIdStr = over.id as string;
    
    console.log("Drag Logic:", { activeIdStr, itemName, overIdStr });

    // Determine target tier
    let targetTier: string | null = null;
    
    // Check if dropped on a column (droppable container)
    if (overIdStr === 'untiered' || availableTiers.some(t => t.key === overIdStr)) {
        targetTier = overIdStr === 'untiered' ? "" : overIdStr;
    } else {
        // Dropped on an item (ItemName::TierKey)
        // Extract tier from the ID suffix
        const parts = overIdStr.split('::');
        if (parts.length > 1) {
            const tierKey = parts[1];
            targetTier = tierKey === 'untiered' ? "" : tierKey;
        } else {
            // Fallback: look up item
            const overItemName = parts[0];
            const overItem = items.find(i => i.name === overItemName);
            if (overItem) {
                const tier = stagedChanges[overItem.name] !== undefined ? stagedChanges[overItem.name] : overItem.current_tier;
                // If tier is array, pick first? Or assume overwrite?
                // This fallback path shouldn't be hit often with correct IDs.
                // Just use first if array.
                const tVal = Array.isArray(tier) ? tier[0] : tier;
                targetTier = tVal || "";
            }
        }
    }

    if (targetTier !== null) {
        const currentTiers = items.find(i => i.name === itemName)?.current_tier || [];
        
        // Determine effective list before this drag
        let effectiveTiers = stagedChanges[itemName] ? [...stagedChanges[itemName]] : [...currentTiers];
        
        // Identify source tier from drag ID
        const sourceTier = activeIdStr.split('::')[1];
        const actualSource = sourceTier === 'untiered' ? "" : sourceTier;
        
        // Remove source tier instance
        // Note: If dragging from untiered, effectiveTiers is empty, so nothing to remove.
        const idx = effectiveTiers.indexOf(actualSource);
        if (idx > -1) {
            effectiveTiers.splice(idx, 1);
        }
        
        // Add target tier
        if (targetTier !== "") {
            if (!effectiveTiers.includes(targetTier)) {
                effectiveTiers.push(targetTier);
            }
        }
        
        // Compare with original to decide if staged
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
          new_tier: "", // Ignored by backend when new_tiers is present
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
            <h2>{t.bulkEdit}: {language === 'ch' ? (CLASS_TRANSLATIONS[selectedClass] || selectedClass) : selectedClass}</h2>
            <div className="class-select-wrapper">
                <span className="label">{t.itemClass}:</span>
                <select 
                    className="class-select"
                    value={selectedClass} 
                    onChange={e => setSelectedClass(e.target.value)}
                >
                    {itemClasses.map(c => (
                        <option key={c} value={c}>
                            {language === 'ch' ? (CLASS_TRANSLATIONS[c] || c) : c}
                        </option>
                    ))}
                </select>
            </div>
          </div>
          <div className="header-meta">
             <span className="staged-badge">{stagedCount} {t.itemsStaged}</span>
             <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="bulk-toolbar">
          <input 
            type="text" 
            placeholder={t.filterPlaceholder} 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
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
                items={columns['untiered']}
            >
                {columns['untiered'].map(item => (
                    <SortableItem 
                        key={`${item.name}-untiered`} 
                        id={`${item.name}::untiered`}
                        item={item} 
                        color="white"
                        isStaged={stagedChanges[item.name] !== undefined}
                        language={language}
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
                    items={columns[tier.key]}
                >
                        {columns[tier.key].map(item => (
                        <SortableItem 
                            key={`${item.name}-${tier.key}`} 
                            id={`${item.name}::${tier.key}`}
                            item={item} 
                            color={getTierColor(tier.key)}
                            isStaged={stagedChanges[item.name] !== undefined && !(item.current_tier || []).includes(tier.key)}
                            language={language}
                        />
                    ))}
                </TierColumn>
            ))}

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {activeItem ? (
                    <div className="item-card dragging" style={{ backgroundColor: getTierColor(activeSourceTier === 'untiered' ? null : activeSourceTier) }}>
                        <div className="item-info">
                            <div className="name-primary">{language === 'ch' ? activeItem.name_ch : activeItem.name}</div>
                            <div className="name-secondary">{language === 'ch' ? activeItem.name : activeItem.name_ch}</div>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

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
        
        .column-content { flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 100px; }
        
        .item-card { 
            background: white; border: 1px solid #ddd; padding: 10px; border-radius: 6px; cursor: grab;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.1s, box-shadow 0.1s;
            position: relative;
        }
        .item-card:hover { box-shadow: 0 2px 5px rgba(0,0,0,0.15); }
        .item-card.staged { border: 2px solid #2196F3; }
        .item-card.dragging { cursor: grabbing; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transform: rotate(2deg); width: 260px; z-index: 1000; }
        
        .name-primary { font-size: 0.85rem; font-weight: bold; color: #1a1a1a; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .name-secondary { font-size: 0.75rem; color: #666; }
        .staged-indicator { position: absolute; top: 5px; right: 8px; color: #2196F3; font-size: 0.8rem; }

        .untiered .column-header { border-top: 4px solid #999; }
      `}</style>
    </div>
  );
};
export default BulkTierEditor;
