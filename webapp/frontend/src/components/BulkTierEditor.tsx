import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  DndContext, 
  closestCenter, 
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects
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
  current_tier: string | null;
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

const SortableItem = ({ item, color, isStaged }: { item: Item, color: string, isStaged: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.name });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: color
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`item-card ${isStaged ? 'staged' : ''}`}
      onContextMenu={(e) => e.stopPropagation()} // Stop context menu here too
    >
      <div className="item-info">
        <div className="name-en">{item.name}</div>
        <div className="name-ch">{item.name_ch}</div>
      </div>
      {isStaged && <div className="staged-indicator">●</div>}
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
  
  // stagedChanges: itemName -> newTierKey
  const [stagedChanges, setStagedChanges] = useState<Record<string, string>>({});
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
      const tier = stagedChanges[item.name] !== undefined ? stagedChanges[item.name] : item.current_tier;
      const targetCol = tier || 'untiered';
      
      // Ensure target column exists (handle custom tiers or missing tiers)
      if (!cols[targetCol] && targetCol !== 'untiered') {
          // If the tier exists in availableTiers (by key matching), we should have it.
          // If not, put in untiered to avoid loss?
          // Actually, if we add a custom tier, availableTiers updates.
          // But if stagedChanges has a tier that doesn't exist? (Shouldn't happen)
          // If item.current_tier is not in availableTiers? (e.g. Hidden tier not passed?)
          cols['untiered'].push(item);
      } else {
          cols[targetCol].push(item);
      }
    });
    return cols;
  }, [items, stagedChanges, searchTerm, availableTiers]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const itemName = active.id as string;
    const overId = over.id as string;

    // Determine target tier
    let targetTier: string | null = null;
    
    // Check if dropped on a column (droppable container)
    if (overId === 'untiered' || availableTiers.some(t => t.key === overId)) {
        targetTier = overId === 'untiered' ? "" : overId;
    } else {
        // Dragged over an item, find its tier
        const overItem = items.find(i => i.name === overId);
        if (overItem) {
            // Check staged tier first, then current
            const tier = stagedChanges[overItem.name] !== undefined ? stagedChanges[overItem.name] : overItem.current_tier;
            targetTier = tier || "";
        }
    }

    if (targetTier !== null) {
        const originalTier = items.find(i => i.name === itemName)?.current_tier || "";
        if (targetTier === originalTier) {
            setStagedChanges(prev => {
                const next = { ...prev };
                delete next[itemName];
                return next;
            });
        } else {
            setStagedChanges(prev => ({ ...prev, [itemName]: targetTier as string }));
        }
    }
  };

  const handleApply = async () => {
    const changeCount = Object.keys(stagedChanges).length;
    if (changeCount === 0) return;
    
    setLoading(true);
    try {
      const promises = Object.entries(stagedChanges).map(([itemName, newTier]) => {
        const item = items.find(i => i.name === itemName);
        return axios.post(`${API_BASE_URL}/api/update-item-tier`, {
          item_name: itemName,
          new_tier: newTier, // empty string means remove from mapping (untiered)
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

  const getTierColor = (tierKey: string | null) => {
    if (!tierKey) return 'white';
    const match = tierKey.match(/Tier (\d+)/);
    if (!match) {
        // Handle Custom Tiers or named tiers
        if (tierKey.includes('Custom')) return '#fff3e0'; // Orange tint
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
  const activeItem = activeId ? items.find(i => i.name === activeId) : null;

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
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Untiered Column */}
            <div className="kanban-column untiered">
                <div className="column-header">
                    <h3>{t.untiered} ({columns['untiered'].length})</h3>
                </div>
                <SortableContext id="untiered" items={columns['untiered'].map(i => i.name)} strategy={verticalListSortingStrategy}>
                    <div className="column-content drop-zone" id="untiered">
                        {columns['untiered'].map(item => (
                            <SortableItem 
                                key={item.name} 
                                item={item} 
                                color="white"
                                isStaged={stagedChanges[item.name] !== undefined}
                            />
                        ))}
                    </div>
                </SortableContext>
            </div>

            {/* Tier Columns */}
            {availableTiers.map(tier => (
                <div key={tier.key} className="kanban-column">
                    <div className="column-header" style={{ borderTop: `4px solid ${getTierColor(tier.key)}` }}>
                        <h3>{tier.label} ({columns[tier.key].length})</h3>
                    </div>
                    <SortableContext id={tier.key} items={columns[tier.key].map(i => i.name)} strategy={verticalListSortingStrategy}>
                        <div className="column-content drop-zone" id={tier.key}>
                            {columns[tier.key].map(item => (
                                <SortableItem 
                                    key={item.name} 
                                    item={item} 
                                    color={getTierColor(tier.key)}
                                    isStaged={stagedChanges[item.name] !== undefined}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </div>
            ))}

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {activeItem ? (
                    <div className="item-card dragging" style={{ backgroundColor: getTierColor(stagedChanges[activeItem.name] || activeItem.current_tier) }}>
                        <div className="item-info">
                            <div className="name-en">{activeItem.name}</div>
                            <div className="name-ch">{activeItem.name_ch}</div>
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
        .search-box { flex-grow: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
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
        
        .name-en { font-size: 0.8rem; font-weight: bold; color: #333; margin-bottom: 2px; }
        .name-ch { font-size: 0.75rem; color: #666; }
        .staged-indicator { position: absolute; top: 5px; right: 8px; color: #2196F3; font-size: 0.8rem; }

        .untiered .column-header { border-top: 4px solid #999; }
      `}</style>
    </div>
  );
};

export default BulkTierEditor;
