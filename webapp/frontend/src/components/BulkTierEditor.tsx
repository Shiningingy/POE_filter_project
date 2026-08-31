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
import { useTranslation, itemClassLabel, translate } from '../utils/localization';
import type { Language } from '../utils/localization';
import ContextMenu from './ContextMenu';
import ItemCard from './ItemCard';
import LoadingOverlay from './LoadingOverlay';

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
  show_in_editor?: boolean;
  is_hide_tier?: boolean;
}

interface BulkTierEditorProps {
  className: string; 
  availableTiers: TierOption[];
  language: Language;
  onClose: () => void;
  onSave: () => void;
  defaultMappingPath?: string;
  /** Lifts the T0 protect-guard for the session — see EditorView's adminMode. */
  adminMode?: boolean;
  /** Arm the rank brush on open, so "rank this tier" is one click from the tier card. */
  initialBrush?: string | null;
}

const ARMOUR_CLASSES = ["Body Armours", "Gloves", "Boots", "Helmets", "Shields"];

const SortableItem = ({ id, item, color, isStaged, language, onContextMenu, disabled, selectable, selected, onToggleSelect, onPaint }: { id: string, item: Item, color: string, isStaged: boolean, language: Language, onContextMenu: (e: React.MouseEvent) => void, disabled?: boolean, selectable?: boolean, selected?: boolean, onToggleSelect?: () => void, onPaint?: () => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? 'default' : undefined
  };

  // With a brush picked, a click PAINTS instead of dragging. Ranking 24 weapon bases is
  // 24 clicks that way versus 24 drags across a scrolling column, which is the whole reason
  // this mode exists. dnd-kit's listeners are suppressed so the click is not eaten by a drag.
  if (onPaint) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, cursor: 'copy' }}
        {...attributes}
        className="sortable-wrap painting"
        onClick={(e) => { e.stopPropagation(); onPaint(); }}
      >
        <ItemCard
          item={item}
          language={language}
          color={color}
          isStaged={isStaged}
          onContextMenu={onContextMenu}
          className={`${disabled ? 'locked' : ''}`}
        />
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(disabled ? {} : listeners)} className="sortable-wrap">
      {selectable && (
        // stopPropagation on pointerdown matters: dnd-kit's sensor lives on the
        // wrapper, so without it every click on the box starts a drag instead of
        // ticking the checkbox.
        <input
          type="checkbox"
          className="bulk-select-box"
          checked={!!selected}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect?.()}
        />
      )}
      <ItemCard
        item={item}
        language={language}
        color={color}
        isStaged={isStaged}
        onContextMenu={onContextMenu}
        className={`${isDragging ? 'dragging' : ''} ${disabled ? 'locked' : ''} ${selected ? 'bulk-selected' : ''}`}
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
  defaultMappingPath,
  adminMode = false,
  initialBrush = null
}) => {
  const t = useTranslation(language);
  const [items, setItems] = useState<Item[]>([]);
  const [itemClasses, setItemClasses] = useState<string[]>([]);
  const [classToFile, setClassToFile] = useState<Record<string, string>>({});
  const [selectedClass, setSelectedClass] = useState(initialClassName);
  const [loading, setLoading] = useState(true);
  const [searchTermTiered, setSearchTermTiered] = useState('');
  const [searchTermPool, setSearchTermPool] = useState('');
  const [debouncedSearchTermTiered, setDebouncedSearchTermTiered] = useState('');
  const [debouncedSearchTermPool, setDebouncedSearchTermPool] = useState('');
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>({ untiered: 100 });
  
  // stagedChanges: itemName -> newTierKeyList
  const [stagedChanges, setStagedChanges] = useState<Record<string, string[]>>({});
  // Multi-select for bulk actions. Keyed by item NAME, so an item shown in two
  // tier columns is one selection, not two.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Null = normal drag-and-drop. A tier key (or 'untiered') = click-to-paint.
  // Opened from a tier card, the brush arrives already armed for that tier.
  const [brushTier, setBrushTier] = useState<string | null>(initialBrush);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: Item, tierKey: string } | null>(null);
  const [selectedSubType, setSelectedSubType] = useState('All');
  const [showAllClasses, setShowAllClasses] = useState(false);

  const API_BASE_URL = '';

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load unique classes
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/item-classes`)
      .then(res => {
          setItemClasses(res.data.classes);
          setClassToFile(res.data.class_to_file || {});
      })
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

  // The item classes this category actually holds, in a stable order.
  // Before the 23 per-class equipment ladders collapsed into `Rare Equipment`, the FILE
  // was the class filter — one category, one class, and a tier column could only ever
  // show that class. One category now holds 905 bases across 23 classes, so without
  // scoping, `Tier 3` mixes body armours, bows and rings into a single 300-item column.
  // ⚠️ Derived from the items TIERED INTO this category, not from `items` — that is
  // `/api/class-items/All`, every base in the game, so counting its classes would report
  // all 66 for every category and scope nothing.
  const categoryClasses = useMemo(() => {
    const ladder = new Set(availableTiers.map(o => o.key));
    const seen = new Set<string>();
    items.forEach(i => {
      if (!i.item_class) return;
      if ((i.current_tier || []).some(t => ladder.has(t))) seen.add(i.item_class);
    });
    return Array.from(seen).sort();
  }, [items, availableTiers]);

  // Only multi-class categories need scoping. Currency and the like keep today's behaviour,
  // where `item_class` is meaningless and every tier column shows everything.
  const scopeToClass = categoryClasses.length > 1;

  // Counts are of the category's own bases, so the dropdown reads "Bows (28)" not "Bows (168)".
  const classCounts = useMemo(() => {
    const ladder = new Set(availableTiers.map(o => o.key));
    const c: Record<string, number> = {};
    items.forEach(i => {
      if (!i.item_class) return;
      if ((i.current_tier || []).some(t => ladder.has(t))) {
        c[i.item_class] = (c[i.item_class] || 0) + 1;
      }
    });
    return c;
  }, [items, availableTiers]);

  // `initialClassName` is the CATEGORY name, which for a multi-class category ("Rare
  // Equipment") is not an item class at all — leaving it selected matches nothing and the
  // board renders empty. Land on a real class instead.
  useEffect(() => {
    if (scopeToClass && !categoryClasses.includes(selectedClass)) {
      setSelectedClass(categoryClasses[0]);
    }
  }, [scopeToClass, categoryClasses, selectedClass]);

  const columns = useMemo(() => {
    const cols: Record<string, Item[]> = {
      'untiered': []
    };
    availableTiers.forEach(tier => {
        cols[tier.key] = [];
    });

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
          // Search stays global, exactly as it already does for the untiered pool: if you
          // typed a name you want to find it whatever class it is in.
          const inScope = !scopeToClass || !!debouncedSearchTermTiered
                          || item.item_class === selectedClass;
          if (matchesSearch && inScope) {
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
  }, [items, stagedChanges, debouncedSearchTermTiered, debouncedSearchTermPool, availableTiers, selectedSubType, showAllClasses, selectedClass, scopeToClass]);

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
        const item = items.find(i => i.name === itemName);
        const currentTiers = item?.current_tier || [];
        let effectiveTiers = stagedChanges[itemName] ? [...stagedChanges[itemName]] : [...currentTiers];
        
        const sourceTier = activeIdStr.split('::')[1];
        const actualSource = sourceTier === 'untiered' ? "" : sourceTier;

        // Check if item is a T0 item (belongs to a show_in_editor: false tier)
        const isT0Item = (item?.current_tier || []).some(tk => {
            const opt = availableTiers.find(o => o.key === tk);
            return opt && opt.show_in_editor === false;
        });

        const targetOpt = availableTiers.find(o => o.key === targetTier);
        const isTargetHide = targetOpt?.is_hide_tier === true;

        if (isT0Item && isTargetHide) {
            const confirmMsg = t.t0MoveWarning.replace("{name}", item?.name_ch || item?.name || "");
            if (!window.confirm(confirmMsg)) return;
        }
        
        // PROTECT T0: Do not remove from list if it's a locked tier (admin mode lifts it)
        const sourceOpt = availableTiers.find(o => o.key === actualSource);
        const isSourceLocked = !adminMode && sourceOpt && sourceOpt.show_in_editor === false;

        if (!isSourceLocked) {
            const idx = effectiveTiers.indexOf(actualSource);
            if (idx > -1) {
                effectiveTiers.splice(idx, 1);
            }
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
    const entries = Object.entries(stagedChanges);
    if (entries.length === 0) return;

    setLoading(true);
    try {
      // Resolve each item's target mapping file. Prefer the item's OWN file, then
      // the open category's mapping path. The previous chain tried classToFile[class]
      // and a bare `${selectedClass}.json` first — both produce invalid paths for
      // shared classes (every currency is "Stackable Currency") and brand-new items
      // (empty class), which the backend rejects with a 500. Never POST an unresolved
      // path, and report per-item so a failure names the culprit.
      // ONE request for the whole edit. This used to fire a POST per item in
      // parallel; each was a full read-modify-write of the same mapping file,
      // so editing several items in one category raced against itself and
      // could corrupt the file or silently drop edits. The backend now groups
      // by file and writes each once, under a lock.
      // This editor owns exactly ONE category: the tiers it offers, in that
      // category's mapping file. An item's other tiers live in other files and
      // must not be touched — 792 of 3198 curated names are deliberately mapped
      // in several files at once (a base armour is in Body Armours AND Uniques
      // AND the campaign tree), so "move it here" must never mean "remove it
      // from there".
      //
      // Previously the whole tier list — including tiers belonging to other
      // categories — was posted to the ITEM's file, so dragging a _legacy item
      // into this category tried to write e.g. 'Tier 0 Delirium Orbs' into
      // Legacy.json, which does not define it.
      const openTierKeys = new Set(availableTiers.map(t => t.key));
      const changes: { item_name: string; new_tiers: string[] | null; new_tier: string; source_file: string }[] = [];
      const unresolved: string[] = [];
      // The two sides of the "is this item's home the open category?" test arrive in
      // DIFFERENT shapes: category_structure.json gives mapping_path as
      // 'base_mapping/Gems/Skill.json', while /api/class-items reports source_file
      // relative to base_mapping/, i.e. 'Gems/Skill.json'. Comparing them raw made
      // the removal branch below unreachable, so dragging an item OUT of a category
      // staged fine, reported success, and silently wrote nothing — the item was
      // back at its old tier on the next load. Normalise before comparing.
      const relOf = (p?: string) => (p || "").replace(/^base_mapping\//, "");
      for (const [itemName, newTiers] of entries) {
        const item = items.find(i => i.name === itemName);
        const targetFile = defaultMappingPath || item?.source_file || classToFile[item?.item_class || ""] || "";
        if (!targetFile) { unresolved.push(itemName); continue; }

        const mine = newTiers.filter(t => openTierKeys.has(t));
        if (mine.length) {
          changes.push({ item_name: itemName, new_tiers: mine, new_tier: "", source_file: targetFile });
        } else if (item?.source_file && relOf(item.source_file) === relOf(targetFile)) {
          // It lived here and now has no tier here: drop it from this file only.
          changes.push({ item_name: itemName, new_tiers: null, new_tier: "", source_file: targetFile });
        }
        // else: not ours and not assigned here — leave every file alone.
      }

      let failed: string[] = [];
      if (changes.length) {
        try {
          await axios.post(`${API_BASE_URL}/api/update-item-tiers-bulk`, { changes });
        } catch (err: any) {
          const detail = err?.response?.data?.detail;
          if (detail?.failures) {
            failed = detail.failures.flatMap((f: any) => f.items.map((n: string) => `${n} — ${f.error} (→ ${f.source_file})`));
          } else {
            failed = [String(detail || err?.message || "request failed")];
          }
        }
      }

      const problems = [
        ...unresolved.map(n => `${n} — could not determine a target mapping file`),
        ...failed,
      ];

      onSave(); // reflect whatever succeeded
      if (problems.length) {
        console.error("BulkTierEditor: failed items", problems);
        // A tier the backend does not know about is almost always one that was
        // just added in the editor and never saved. Say so, rather than making
        // the user decode the raw rejection.
        const hint = problems.some((p) => p.includes("does not define"))
          ? "\n\nThat tier does not exist in the target category. If you just added it, save the category (💾) first, then apply again."
          : "";
        alert(`Failed to update ${problems.length} item(s):\n` +
              problems.map((p) => `• ${p}`).join("\n") + hint);
      } else {
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update items (unexpected error).");
    } finally {
      setLoading(false);
    }
  };

  // Everything the TIERED filter is currently showing, de-duplicated: an item in
  // two tiers appears in two columns. Backs "select all filtered".
  const filteredTieredItems = useMemo(() => {
    const seen = new Map<string, Item>();
    availableTiers.forEach((tier) => {
      (columns[tier.key] || []).forEach((it) => seen.set(it.name, it));
    });
    return [...seen.values()];
  }, [columns, availableTiers]);

  const toggleSelected = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // Bulk counterpart of the per-item "remove from tier": drop every SELECTED item
  // from THIS category, which is the only removal this editor may make - an item's
  // tiers in other mapping files are none of its business (792 curated names are
  // multi-homed on purpose).
  const handleRemoveSelected = () => {
    const locked = new Set(
      availableTiers.filter((o) => o.show_in_editor === false).map((o) => o.key),
    );
    const picked = items.filter((it) => selected.has(it.name));
    const removable = picked.filter(
      (it) => adminMode || !(it.current_tier || []).some((tk) => locked.has(tk)),
    );
    if (!removable.length) return;
    const msg = (t as any).bulkRemoveConfirm
      .replace("{n}", String(removable.length))
      .replace("{locked}", String(picked.length - removable.length));
    if (!window.confirm(msg)) return;
    setStagedChanges((prev) => {
      const next = { ...prev };
      removable.forEach((it) => {
        // Keep tiers this category does NOT offer - they belong to other files.
        next[it.name] = (prev[it.name] ?? it.current_tier ?? []).filter(
          (tk) => !availableTiers.some((o) => o.key === tk),
        );
      });
      return next;
    });
    setSelected(new Set());
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
          // PROTECT T0
          const targetOpt = availableTiers.find(o => o.key === target);
          const isTargetLocked = targetOpt && targetOpt.show_in_editor === false;
          
          if (!isTargetLocked) {
              const idx = effectiveTiers.indexOf(target);
              if (idx > -1) effectiveTiers.splice(idx, 1);
          }
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

  /* Paint one item into the brushed tier.
   *
   * ⚠️ Replaces membership WITHIN THIS LADDER ONLY. 551 of 607 equipment bases sit in more
   * than one file - Magmatic Tower Shield is in both Shields.json and Heist Experimented.json,
   * Vaal Greaves in Boots, Uniques AND the campaign progression - so blindly overwriting
   * current_tier would silently drop a base out of its league or campaign ladder. Tiers that
   * belong to other files are carried through untouched.
   */
  const applyBrush = (item: Item) => {
    if (!brushTier) return;
    const ladder = new Set(availableTiers.map(o => o.key));
    const current = stagedChanges[item.name] ?? item.current_tier ?? [];
    const kept = current.filter(t => !ladder.has(t));
    const next = brushTier === 'untiered' ? kept : [...kept, brushTier];

    const sortedNext = [...next].sort();
    const sortedOrig = [...(item.current_tier || [])].sort();
    setStagedChanges(prev => {
      const out = { ...prev };
      if (JSON.stringify(sortedNext) === JSON.stringify(sortedOrig)) delete out[item.name];
      else out[item.name] = next;
      return out;
    });
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

  const classLabel = (c: string) =>
    itemClassLabel(c, language);

  const stagedCount = Object.keys(stagedChanges).length;
  const activeItem = activeId ? items.find(i => i.name === activeId.split('::')[0]) : null;
  const activeSourceTier = activeId ? activeId.split('::')[1] : null;

  return (
    <div className="modal-overlay" onContextMenu={(e) => e.stopPropagation()}>
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-left">
            <h2>{t.bulkEdit}: {classLabel(selectedClass)}</h2>
            <div className="class-select-wrapper">
                <span className="label">{t.itemClass}:</span>
                <select
                    className="class-select"
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                >
                    {/* A multi-class category offers only the classes it holds — picking one
                        it does not contain would render an empty board. */}
                    {(scopeToClass ? categoryClasses : itemClasses).map(c => (
                        <option key={c} value={c}>
                            {classLabel(c)}{scopeToClass ? ` (${classCounts[c] || 0})` : ''}
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
                            <option key={st} value={st}>{translate(SUBTYPE_KEY_MAP[st] || st, language) ?? st}</option>
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

        {/* Rank brush: pick a tier, then click bases. Drag-and-drop is fine for moving one
            item; ranking a whole class is dozens of moves, and that is what this is for. */}
        <div className="bulk-toolbar brush-bar">
          <span className="label">{t.brush}</span>
          <button
            className={`brush-swatch ${brushTier === null ? 'active' : ''}`}
            onClick={() => setBrushTier(null)}
            title={t.brushOffDragAndDrop}
          >
            {t.off}
          </button>
          {availableTiers
            .filter(o => o.show_in_editor !== false && !o.is_hide_tier)
            .map(o => (
              <button
                key={o.key}
                className={`brush-swatch ${brushTier === o.key ? 'active' : ''}`}
                style={{ background: getTierColor(o.key) }}
                onClick={() => setBrushTier(brushTier === o.key ? null : o.key)}
                title={o.key}
              >
                {o.label || o.key}
              </button>
            ))}
          <button
            className={`brush-swatch ${brushTier === 'untiered' ? 'active' : ''}`}
            onClick={() => setBrushTier(brushTier === 'untiered' ? null : 'untiered')}
            title={t.removeFromThisLadder}
          >
            {t.untiered}
          </button>
          {brushTier && (
            <span className="brush-hint">
              {t.clickItemsToPaintMemberships}
            </span>
          )}
        </div>

        <div className="bulk-toolbar">
          <div className="filter-options">
              <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showAllClasses}
                    onChange={e => setShowAllClasses(e.target.checked)}
                  />
                  {t.showAllClasses}
              </label>
          </div>
          <input 
            type="text" 
            placeholder={t.filterTiered} 
            value={searchTermTiered} 
            onChange={e => setSearchTermTiered(e.target.value)}
            className="search-box"
          />
          <button
            className="bulk-select-btn"
            disabled={filteredTieredItems.length === 0 || loading}
            title={(t as any).selectAllFilteredTitle}
            onClick={() =>
              setSelected((prev) =>
                prev.size >= filteredTieredItems.length && filteredTieredItems.length > 0
                  ? new Set()
                  : new Set(filteredTieredItems.map((i) => i.name)),
              )
            }
          >
            ☑ {(t as any).selectAllFiltered} ({filteredTieredItems.length})
          </button>
          <button
            className="bulk-remove-btn"
            disabled={selected.size === 0 || loading}
            title={(t as any).bulkRemoveTitle}
            onClick={handleRemoveSelected}
          >
            🗑 {(t as any).removeSelected} ({selected.size})
          </button>
          <button
            className="apply-btn"
            disabled={stagedCount === 0 || loading}
            onClick={handleApply}
          >
            {t.saveChanges} ({stagedCount})
          </button>
        </div>

        {loading && <LoadingOverlay language={language} />}
        <div className="kanban-board" style={loading ? { display: 'none' } : undefined}>
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
                {columns['untiered'].slice(0, columnLimits['untiered'] || 100).map(item => {
                    // Item is locked ONLY if it is in a show_in_editor: false tier AND that is its CURRENT location
                    // Untiered is never locked.
                    const isItemLocked = false; 

                    return (
                        <SortableItem 
                            key={`${item.name}-untiered`} 
                            id={`${item.name}::untiered`}
                            item={item} 
                            color="white"
                            isStaged={stagedChanges[item.name] !== undefined}
                            language={language}
                            onContextMenu={(e) => handleItemRightClick(e, item, 'untiered')}
                            disabled={isItemLocked}
                            onPaint={brushTier && !isItemLocked ? () => applyBrush(item) : undefined}
                        />
                    );
                })}
            </TierColumn>

                        {/* Tier Columns */}
                        {availableTiers.map(tier => {
                            return (
                                <TierColumn
                                    key={tier.key}
                                    id={tier.key}
                                    title={tier.label}
                                    color={getTierColor(tier.key)}
                                    items={columns[tier.key].slice(0, columnLimits[tier.key] || 100)}
                                    totalCount={columns[tier.key].length}
                                    onScrollBottom={() => handleLoadMore(tier.key)}
                                >
                                        {columns[tier.key].slice(0, columnLimits[tier.key] || 100).map(item => {
                                            // Item is locked ONLY if it is in a show_in_editor: false tier AND that is its CURRENT location
                                            const tierOpt = availableTiers.find(opt => opt.key === tier.key);
                                            const isLocationLocked = tierOpt && tierOpt.show_in_editor === false;
                                            
                                            // Additionally check if it's a T0 item by origin
                                            const isT0ByOrigin = item.current_tier?.some(tk => {
                                                const opt = availableTiers.find(o => o.key === tk);
                                                return opt && opt.show_in_editor === false;
                                            });

                                            const isItemLocked = !adminMode && isLocationLocked && isT0ByOrigin;

                                            return (
                                                <SortableItem 
                                                    key={`${item.name}-${tier.key}`} 
                                                    id={`${item.name}::${tier.key}`}
                                                    item={item} 
                                                    color={getTierColor(tier.key)}
                                                    isStaged={stagedChanges[item.name] !== undefined && !(item.current_tier || []).includes(tier.key)}
                                                    language={language}
                                                    onContextMenu={(e) => handleItemRightClick(e, item, tier.key)}
                                                    disabled={isItemLocked}
                                                    selectable={!isItemLocked && !brushTier}
                                                    selected={selected.has(item.name)}
                                                    onToggleSelect={() => toggleSelected(item.name)}
                                                    onPaint={brushTier && !isItemLocked ? () => applyBrush(item) : undefined}
                                                />
                                            );
                                        })}
                                </TierColumn>
                            );
                        })}
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
            language={language}
            options={[
                ...(contextMenu.tierKey !== 'untiered' ? [
                    { 
                        label: (t as any).removeFromTier, 
                        onClick: () => handleModifyTierList(contextMenu.item, 'remove', contextMenu.tierKey),
                        disabled: (() => {
                            const opt = availableTiers.find(o => o.key === contextMenu.tierKey);
                            const isT0ByOrigin = contextMenu.item.current_tier?.some(tk => {
                                const o = availableTiers.find(x => x.key === tk);
                                return o && o.show_in_editor === false;
                            });
                            return !adminMode && opt && opt.show_in_editor === false && isT0ByOrigin;
                        })()
                    },
                    { divider: true, label: '', onClick: () => {} }
                ] : []),
                ...availableTiers
                    .filter(tOpt => tOpt.key !== contextMenu.tierKey && !(stagedChanges[contextMenu.item.name] || contextMenu.item.current_tier || []).includes(tOpt.key))
                    .map(tOpt => ({
                        label: `${(t as any).addTo} ${tOpt.label}`,
                        color: getTierColor(tOpt.key),
                        onClick: () => {
                            const isT0ByOrigin = contextMenu.item.current_tier?.some(tk => {
                                const o = availableTiers.find(x => x.key === tk);
                                return o && o.show_in_editor === false;
                            });
                            if (isT0ByOrigin && tOpt.is_hide_tier) {
                                const confirmMsg = (t as any).t0MoveWarning.replace("{name}", contextMenu.item.name_ch || contextMenu.item.name);
                                if (!window.confirm(confirmMsg)) return;
                            }
                            handleModifyTierList(contextMenu.item, 'add', tOpt.key);
                        }
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
        .class-select { padding: 6px 12px; border-radius: 6px; border: 1px solid #ddd; font-weight: bold; font-size: 0.95rem; cursor: pointer; color: #333; background: white; max-width: 250px; }
        
        .header-meta { display: flex; align-items: center; gap: 20px; }
        .staged-badge { background: #2196F3; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; }
        .close-btn { background: none; border: none; font-size: 2.5rem; cursor: pointer; color: #ccc; line-height: 1; }
        .close-btn:hover { color: #666; }
        
        .bulk-toolbar { padding: 10px 25px; background: white; display: flex; gap: 25px; align-items: center; border-bottom: 1px solid #ddd; }
        /* Rank brush */
        .brush-bar { gap: 8px; flex-wrap: wrap; background: #f7f8fa; }
        .brush-swatch { border: 1px solid #c3c8d0; border-radius: 4px; padding: 4px 10px;
                        font-size: 12px; cursor: pointer; background: #fff; color: #222;
                        white-space: nowrap; }
        .brush-swatch:hover { border-color: #7a8496; }
        .brush-swatch.active { outline: 2px solid #2f6feb; outline-offset: 1px;
                               border-color: #2f6feb; font-weight: 600; }
        .brush-hint { font-size: 12px; color: #5b6472; margin-left: 4px; }
        /* Painting mode: the whole card is one big click target, so make that obvious and
           kill the drag affordance -- a half-started drag that turns into a click is the
           thing that makes bulk work feel unreliable. */
        .sortable-wrap.painting { user-select: none; }
        .sortable-wrap.painting:hover { outline: 2px solid #2f6feb; outline-offset: -1px;
                                        border-radius: 6px; }
        .search-box { flex-grow: 0; width: 300px; padding: 10px 15px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
        .apply-btn { padding: 10px 25px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1rem; transition: background 0.2s; }
        .apply-btn:hover { background: #43a047; }
        .bulk-remove-btn { padding: 10px 18px; background: transparent; color: #d98a8a; border: 1px solid #7a3f3f; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.95rem; transition: background 0.2s, color 0.2s; white-space: nowrap; }
        .bulk-remove-btn:hover:not(:disabled) { background: #7a3f3f; color: #fff; }
        .bulk-remove-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .bulk-select-btn { padding: 10px 16px; background: transparent; color: #9ab4d9; border: 1px solid #3f5a7a; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.95rem; transition: background 0.2s, color 0.2s; white-space: nowrap; }
        .bulk-select-btn:hover:not(:disabled) { background: #3f5a7a; color: #fff; }
        .bulk-select-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sortable-wrap { position: relative; }
        .bulk-select-box { position: absolute; top: 6px; left: 6px; z-index: 5; width: 15px; height: 15px; cursor: pointer; accent-color: #d98a8a; }
        .bulk-selected { outline: 2px solid #d98a8a; outline-offset: -2px; }
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