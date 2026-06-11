import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  MouseSensor,
  TouchSensor,
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
import { useTranslation, CLASS_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import ItemCard from './ItemCard';
import OccurrencePicker, { type OccurrenceRow } from './OccurrencePicker';
import OccurrenceRuleList, { type OccurrenceRuleRow } from './OccurrenceRuleList';
import SimulatorRulePanel from './SimulatorRulePanel';
import type { FilterContext } from '../utils/simulatorEngine';
import { loadSoundEditorSession, saveSoundEditorSession, clearSoundEditorSession } from '../utils/soundEditorSession';
import {
  buildSoundExport, parseSoundExport, collectSoundRules,
  matchSoundRule, applySoundRule, referencedSoundPaths, downloadJson,
} from '../utils/themeSoundExport';
import type { SoundExportRule, SkipReason } from '../utils/themeSoundExport';

// ===========================
// TYPES
// ===========================

// One place a basetype appears: a specific base_mapping file (with the tiers it
// occupies there and any sound currently set by a per-file rule in that file).
interface Occurrence {
  file: string;            // relative path under base_mapping (e.g. "Equipment/Weapons/One Hand Swords.json")
  tiers: string[];
  sound: string | null;    // current per-file rule sound, if any
}

interface Item {
  name: string;
  name_ch: string;
  current_tier: string[] | null;
  item_class?: string;
  sub_type?: string;
  occurrences?: Occurrence[];
  [key: string]: any;
}

interface SoundDef {
  path: string;
  label: string;
  type: 'sharket' | 'default' | 'custom';
}

interface PickerState {
  item: Item;
  mode: 'assign' | 'remove';
  targetSound: string;     // sound path being assigned ('' for remove)
  targetLabel?: string;
  rows: OccurrenceRow[];
  preChecked: string[];
}

interface SoundBulkEditorProps {
  language: Language;
  onClose: () => void;
  onSave: () => void;
  categoryRules?: any[];
  themeData?: any;
  fullConfig?: any;
  onJumpToRule?: (filePath: string, ruleIndex?: number) => void;
}

// occurrence staging key = basetype name + its file
const occId = (name: string, file: string) => `${name}::${file}`;

const fileLabel = (file: string) => {
  const clean = file.replace(/\.json$/, '');
  const parts = clean.split('/').filter(Boolean);
  const leaf = parts.pop() || clean;
  const ctx = parts.join(' / ');
  return ctx ? `${ctx} / ${leaf}` : leaf;
};

const SOUND_KEYS = ['CustomAlertSound', 'AlertSound', 'DropSound', 'PlayAlertSound'] as const;
const ruleSoundValue = (overrides: any): string | null => {
  if (!overrides) return null;
  const k = SOUND_KEYS.find(key => key in overrides);
  if (!k) return null;
  const v = overrides[k];
  return Array.isArray(v) ? (v[0] ?? null) : v;
};

// ===========================
// SUB-COMPONENTS
// ===========================

const CatalogSoundCard = ({ sound, onAdd, usageCount }: { sound: SoundDef, onAdd: () => void, usageCount: number }) => {
    const safeId = `cat-${sound.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: safeId,
        data: { type: 'catalog-sound', sound }
    });

    const style: React.CSSProperties = {
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="sound-card-item"
            {...attributes}
            {...listeners}
        >
            <div className="content-area" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', padding: '10px' }}>
                <span className="icon" style={{ flexShrink: 0 }}>🎵</span>
                <span className="label" title={sound.path} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#333', fontSize: '0.85rem' }}>{sound.label}</span>
                {usageCount > 0 && <span className="usage-badge" title={`${usageCount} items use this sound`}>{usageCount}</span>}
            </div>

            <button
                className="add-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                title="Add Column"
            >
                +
            </button>
        </div>
    );
};

const PoolItem = ({ item, language, currentSound, badge, rules, onRulesClick }: { item: Item, language: Language, currentSound?: string, badge?: string, rules?: { label: string }[], onRulesClick?: () => void }) => {
    const dndId = `pool|${item.name}`;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: dndId,
        data: { type: 'item', item, containerId: 'pool' }
    });

    const style: React.CSSProperties = {
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none',
        position: 'relative'
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? 'dragging-source' : ''}>
            <ItemCard item={item} language={language} currentSound={currentSound} showDetails={true} rules={rules} onRulesClick={() => onRulesClick?.()} className={isDragging ? 'dragging' : ''} />
            {badge && <div className="occ-frac" title="occurrences with this sound">{badge}</div>}
        </div>
    );
};

const WorkspaceItem = ({ item, language, containerId, onDelete, currentSound, badge, rules, onRulesClick }: { item: Item, language: Language, containerId: string, onDelete: () => void, currentSound?: string, badge?: string, rules?: { label: string }[], onRulesClick?: () => void }) => {
  const dndId = `${containerId}|${item.name}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: dndId,
      data: { type: 'item', item, containerId }
  });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative' as const };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard
        item={item}
        language={language}
        currentSound={currentSound}
        showDetails={true}
        rules={rules}
        onRulesClick={() => onRulesClick?.()}
        onDelete={(e) => { e.stopPropagation(); onDelete(); }}
        className={isDragging ? 'dragging' : ''}
      />
      {badge && <div className="occ-frac" title="occurrences on this sound">{badge}</div>}
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
    getBadge,
    getRules,
    onRulesClick
}: {
    id: string,
    sound: SoundDef,
    items: Item[],
    onClose: () => void,
    onSave: () => void,
    onCancel: () => void,
    onRemoveItem: (itemName: string) => void,
    language: Language,
    stagedCount: number,
    getBadge: (it: Item) => string | undefined,
    getRules: (it: Item) => { label: string }[],
    onRulesClick: (it: Item) => void
}) => {
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: id,
        data: { type: 'column', sound }
    });

    const { setNodeRef: setSortableRef, attributes, listeners, transform, transition, isDragging } = useSortable({
        id: id + '-sort',
        data: { type: 'column', sound }
    });
    const t = useTranslation(language);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        borderColor: isOver ? '#2196F3' : '#ddd',
        borderWidth: isOver ? '2px' : '1px',
        borderStyle: isOver ? 'dashed' : 'solid'
    };

    const setRefs = (el: HTMLElement | null) => {
        setDroppableRef(el);
        setSortableRef(el);
    };

    return (
        <div ref={setRefs} style={style} className="sound-workspace-column">
            <div className="column-header" {...attributes} {...listeners}>
                <div className="title-row">
                    <span className="sound-type-badge">{sound.type}</span>
                    <span className="sound-name" title={sound.path}>{sound.label}</span>
                    <button className="close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
                </div>
                <div className="column-stats">{items.length} cards</div>
            </div>

            <SortableContext id={id} items={items.map(i => `${id}|${i.name}`)} strategy={verticalListSortingStrategy}>
                <div className="column-content">
                    {items.map(item => (
                        <WorkspaceItem
                            key={item.name}
                            item={item}
                            language={language}
                            containerId={id}
                            onDelete={() => onRemoveItem(item.name)}
                            currentSound={sound.path}
                            badge={getBadge(item)}
                            rules={getRules(item)}
                            onRulesClick={() => onRulesClick(item)}
                        />
                    ))}
                    {items.length === 0 && <div className="column-placeholder">{language === 'ch' ? '将物品拖放到此处' : 'Drop items here'}</div>}
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

const SoundBulkEditor: React.FC<SoundBulkEditorProps> = ({ language, onClose, onSave, onJumpToRule }) => {
  const t = useTranslation(language);

  const [items, setItems] = useState<Item[]>([]);
  const [soundMap, setSoundMap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [defaults, setDefaults] = useState<SoundDef[]>([]);
  const [sharket, setSharket] = useState<SoundDef[]>([]);
  const [catalogTab, setCatalogTab] = useState<'sharket' | 'default' | 'custom'>('sharket');
  const [customPathInput, setCustomPathInput] = useState('');
  // Hydrate the workspace from the session store so a "jump to editor" round-trip
  // restores columns + staged changes.
  const [activeColumns, setActiveColumns] = useState<SoundDef[]>(() => (loadSoundEditorSession()?.activeColumns as SoundDef[]) || []);
  // occurrence staging: occId(name,file) -> sound path ('' = clear)
  const [stagedChanges, setStagedChanges] = useState<Record<string, string>>(() => loadSoundEditorSession()?.stagedChanges || {});
  const [selectedClass, setSelectedClass] = useState('All');
  const [itemClasses, setItemClasses] = useState<string[]>([]);
  const [searchTermPool, setSearchTermPool] = useState('');
  const [searchTermCatalog, setSearchTermCatalog] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<any>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  // Rule-block drill-in (reuses the simulator's panel + a lazily-built FilterContext)
  const [ruleContext, setRuleContext] = useState<FilterContext | null>(null);
  // Standalone sound export/import
  const soundFileInputRef = React.useRef<HTMLInputElement>(null);
  const [soundIO, setSoundIO] = useState(false); // busy flag
  const [importReport, setImportReport] = useState<{
      mapMerged: number;
      updated: SoundExportRule[];
      created: SoundExportRule[];
      skipped: { rule: SoundExportRule; reason: SkipReason }[];
      missingAudio: string[];
  } | null>(null);
  const [rulesFor, setRulesFor] = useState<Item | null>(null);     // occurrence list modal
  const [rulePanelFile, setRulePanelFile] = useState<string | null>(null); // base_mapping/<rel>

  // Persist workspace to the module session store on change (so a "jump to editor"
  // unmount/remount restores it).
  useEffect(() => {
      saveSoundEditorSession({ activeColumns, stagedChanges });
  }, [activeColumns, stagedChanges]);

  // Explicit close clears the session (a jump unmounts WITHOUT calling this, so it
  // survives the round-trip; a deliberate close starts fresh next time).
  const handleClose = () => { clearSoundEditorSession(); onClose(); };

  const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
      useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  // Resolve the effective sound for a single occurrence:
  // staged change -> per-file rule sound -> global basetype_sounds.
  const resolveOccSound = useCallback((name: string, occ: Occurrence): string | undefined => {
      const st = stagedChanges[occId(name, occ.file)];
      if (st !== undefined) return st === '' ? undefined : st;
      if (occ.sound) return occ.sound;
      return soundMap?.basetype_sounds?.[name]?.file || undefined;
  }, [stagedChanges, soundMap]);

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

  const usageCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      items.forEach(it => (it.occurrences || []).forEach(o => {
          const s = resolveOccSound(it.name, o);
          if (s) counts[s] = (counts[s] || 0) + 1;
      }));
      return counts;
  }, [items, resolveOccSound]);

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

  // ---- occurrence helpers ----
  const stageOcc = (name: string, files: string[], sound: string) => {
      if (!files.length) return;
      setStagedChanges(prev => {
          const n = { ...prev };
          files.forEach(f => { n[occId(name, f)] = sound; });
          return n;
      });
  };

  const buildRows = (it: Item, files: string[]): OccurrenceRow[] =>
      files.map(f => {
          const o = (it.occurrences || []).find(x => x.file === f)!;
          return { file: f, label: fileLabel(f), tiers: o?.tiers || [], currentSound: resolveOccSound(it.name, o) || null };
      });

  const openAssign = (it: Item, path: string, label?: string) => {
      const occs = it.occurrences || [];
      if (occs.length <= 1) { if (occs.length === 1) stageOcc(it.name, [occs[0].file], path); return; }
      setPicker({
          item: it, mode: 'assign', targetSound: path, targetLabel: label,
          rows: buildRows(it, occs.map(o => o.file)),
          preChecked: occs.filter(o => resolveOccSound(it.name, o) === path).map(o => o.file)
      });
  };

  const openRemove = (it: Item, sourcePath: string | null) => {
      const occs = it.occurrences || [];
      const candidates = occs.filter(o => sourcePath ? resolveOccSound(it.name, o) === sourcePath : !!resolveOccSound(it.name, o));
      if (candidates.length <= 1) { if (candidates.length === 1) stageOcc(it.name, [candidates[0].file], ''); return; }
      setPicker({
          item: it, mode: 'remove', targetSound: '',
          rows: buildRows(it, candidates.map(o => o.file)),
          preChecked: candidates.map(o => o.file)
      });
  };

  const handlePickerConfirm = (selectedFiles: string[]) => {
      if (!picker) return;
      const { item, mode, targetSound } = picker;
      setStagedChanges(prev => {
          const n = { ...prev };
          if (mode === 'assign') {
              (item.occurrences || []).forEach(o => {
                  const id = occId(item.name, o.file);
                  if (selectedFiles.includes(o.file)) n[id] = targetSound;
                  else if (resolveOccSound(item.name, o) === targetSound) n[id] = ''; // unchecked but was on it -> clear
              });
          } else {
              selectedFiles.forEach(f => { n[occId(item.name, f)] = ''; });
          }
          return n;
      });
      setPicker(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id as string);
      setActiveDragData(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveDragData(null);

    const activeData = active.data.current;

    // Catalog sound -> create/insert a column. Handled BEFORE the `over` guard so a
    // sound dropped anywhere in the editor (incl. dead space over the empty
    // workspace, where `over` can be null) still opens a column.
    if (activeData?.type === 'catalog-sound') {
        const ov = (over?.id as string) || '';
        const overIndex = ov ? activeColumns.findIndex(c => c.path === ov.replace('-sort', '')) : -1;
        addColumn(activeData.sound, overIndex === -1 ? undefined : overIndex);
        return;
    }

    const id = active.id as string;
    const overId = (over?.id as string) || '';
    const overData = over?.data.current as any;

    if (activeData?.type === 'column') {
        if (!over) return;
        const oldIdx = activeColumns.findIndex(c => c.path === id.replace('-sort', ''));
        const newIdx = activeColumns.findIndex(c => c.path === overId.replace('-sort', ''));
        if (oldIdx !== -1 && newIdx !== -1) setActiveColumns(arrayMove(activeColumns, oldIdx, newIdx));
        return;
    }

    if (activeData?.type === 'item') {
        const it = activeData.item as Item;
        const source = activeData.containerId as string; // 'pool' or a column path

        // Resolve a *target column* only (not the pool). Dropping anywhere that is
        // not a column counts as "off a column" -> removal from the source column.
        let targetCol: string | null = null;
        const overIsPool = overId === 'pool' || overData?.type === 'pool' || overData?.containerId === 'pool';
        if (!overIsPool) {
            const col = activeColumns.find(c => c.path === overId);
            if (col) targetCol = col.path;
            else if (overData?.type === 'column') targetCol = overData.sound.path;
            else if (overData?.type === 'item' && overData.containerId !== 'pool') targetCol = overData.containerId;
        }

        if (targetCol && targetCol !== source) {
            // dropped on a *different* column -> assign / reassign there
            openAssign(it, targetCol, activeColumns.find(c => c.path === targetCol)?.label);
        } else if (source !== 'pool') {
            // a column-sourced card released anywhere that isn't another column
            // (pool / workspace / empty / back on its own column) -> remove it.
            // openRemove opens the multi-select picker when >1 occurrence is on it.
            openRemove(it, source);
        }
    }
  };

  // Collect committed changes that belong to one column's sound (assignments to it
  // + removals whose prior sound was it).
  const collectColumnChanges = useCallback((path: string) => {
      const changes: { name: string; file: string; sound: string }[] = [];
      Object.entries(stagedChanges).forEach(([oid, val]) => {
          const sep = oid.lastIndexOf('::');
          const name = oid.slice(0, sep);
          const file = oid.slice(sep + 2);
          if (val === path) {
              changes.push({ name, file, sound: path });
          } else if (val === '') {
              const it = items.find(i => i.name === name);
              const o = it?.occurrences?.find(x => x.file === file);
              const prior = o?.sound || soundMap?.basetype_sounds?.[name]?.file;
              if (prior === path) changes.push({ name, file, sound: '' });
          }
      });
      return changes;
  }, [stagedChanges, items, soundMap]);

  const saveColumn = async (sound: SoundDef) => {
      const changes = collectColumnChanges(sound.path);
      if (!changes.length) return;
      const byFile = new Map<string, { name: string; sound: string }[]>();
      changes.forEach(c => {
          const arr = byFile.get(c.file) || [];
          arr.push({ name: c.name, sound: c.sound });
          byFile.set(c.file, arr);
      });
      try {
          for (const [file, list] of byFile) {
              const res = await axios.get(`/api/config/base_mapping/${file}`);
              const data = res.data.content || {};
              if (!Array.isArray(data.rules)) data.rules = [];
              list.forEach(({ name, sound: s }) => {
                  const idx = data.rules.findIndex((r: any) => r && r.comment === `__SOUND__:${name}`);
                  if (s === '') {
                      if (idx !== -1) data.rules.splice(idx, 1);
                  } else {
                      const rule = { targets: [name], overrides: { PlayAlertSound: [s, 300] }, comment: `__SOUND__:${name}` };
                      if (idx !== -1) data.rules[idx] = rule; else data.rules.push(rule);
                  }
              });
              await axios.post(`/api/config/base_mapping/${file}`, data);
          }
          // optimistic occurrence update + clear committed staged entries
          setItems(prev => prev.map(it => {
              const rel = changes.filter(c => c.name === it.name);
              if (!rel.length) return it;
              const occs = (it.occurrences || []).map(o => {
                  const c = rel.find(x => x.file === o.file);
                  return c ? { ...o, sound: c.sound === '' ? null : c.sound } : o;
              });
              return { ...it, occurrences: occs };
          }));
          setStagedChanges(prev => {
              const n = { ...prev };
              changes.forEach(c => delete n[occId(c.name, c.file)]);
              return n;
          });
          onSave();
      } catch (e) { alert("Failed to save"); }
  };

  const cancelColumn = (path: string) => {
      const changes = collectColumnChanges(path);
      setStagedChanges(prev => {
          const n = { ...prev };
          changes.forEach(c => delete n[occId(c.name, c.file)]);
          return n;
      });
  };

  const removeFromColumn = (name: string, path: string) => {
      const it = items.find(i => i.name === name);
      if (!it) return;
      // openRemove handles single vs multi: >1 occurrence on this sound opens the
      // multi-select picker so the user can partially delete.
      openRemove(it, path);
  };

  // ---- pool / column lists ----
  const poolItemsList = useMemo(() => {
      const searchLower = searchTermPool.toLowerCase();
      return items.filter(it => {
          const occs = it.occurrences || [];
          if (!occs.length) return false;
          // show while at least one occurrence is unassigned to an active column
          const hasFree = occs.some(o => {
              const s = resolveOccSound(it.name, o);
              return !s || !activeColumns.some(c => c.path === s);
          });
          if (!hasFree) return false;
          if (selectedClass !== 'All' && it.item_class !== selectedClass) return false;
          if (searchTermPool && !it.name.toLowerCase().includes(searchLower) && !(it.name_ch && it.name_ch.toLowerCase().includes(searchLower))) return false;
          return true;
      }).slice(0, 100);
  }, [items, resolveOccSound, selectedClass, searchTermPool, activeColumns]);

  const getColumnItems = useCallback((path: string) =>
      items.filter(it => (it.occurrences || []).some(o => resolveOccSound(it.name, o) === path)),
  [items, resolveOccSound]);

  // badge "k/n" = how many of a basetype's n occurrences resolve to `path`
  // (shown whenever the basetype spans more than one occurrence, incl. n/n).
  const columnBadge = (it: Item, path: string): string | undefined => {
      const occs = it.occurrences || [];
      if (occs.length <= 1) return undefined;
      const k = occs.filter(o => resolveOccSound(it.name, o) === path).length;
      return `${k}/${occs.length}`;
  };

  // for a pool card: the shared sound (if all occurrences agree) + a multi marker
  const poolCardSound = (it: Item): { sound?: string; badge?: string } => {
      const occs = it.occurrences || [];
      const sset = new Set(occs.map(o => resolveOccSound(it.name, o) || ''));
      const sound = sset.size === 1 ? ([...sset][0] || undefined) : undefined;
      const badge = occs.length > 1 ? `×${occs.length}` : undefined;
      return { sound, badge };
  };

  // ---- rule-block drill-in ----
  // A card's "rule" chips = the occurrences (tier blocks) relevant to its context:
  //  - pool card: occurrences not yet on an active sound column (still assignable)
  //  - column card: only the occurrence(s) actually on that column's sound (selected)
  // Label = the tier block (the rule), falling back to the file label if untiered.
  const occLabel = (o: Occurrence) => (o.tiers && o.tiers.length) ? o.tiers.join(', ') : fileLabel(o.file);
  const chipsOf = (occs: Occurrence[]) => occs.map(o => ({ label: occLabel(o) }));
  const freeOccs = (it: Item) => (it.occurrences || []).filter(o => {
      const s = resolveOccSound(it.name, o);
      return !s || !activeColumns.some(c => c.path === s);
  });
  const occsOnColumn = (it: Item, path: string) => (it.occurrences || []).filter(o => resolveOccSound(it.name, o) === path);

  // Lazily build a FilterContext (mappings + tier defs + theme + overrides), same
  // shape/source the simulator uses, so we can reuse SimulatorRulePanel.
  const ensureContext = useCallback(async (): Promise<FilterContext | null> => {
      if (ruleContext) return ruleContext;
      try {
          const settingsRes = await axios.get('/api/settings');
          const baseTheme = settingsRes.data.base_theme || 'sharket';
          const [themeRes, overridesRes] = await Promise.all([
              axios.get(`/api/themes/${baseTheme}`),
              axios.get('/api/custom-overrides'),
          ]);
          // Served live in both modes (the demo adapter computes it from the
          // bundle + the user's in-browser edits).
          const b = await axios.get('/api/simulator-bundle');
          const mappings = b.data.mappings, tierDefinitions = b.data.tiers;
          const ctx: FilterContext = { theme: themeRes.data.theme_data, overrides: overridesRes.data, mappings, tierDefinitions };
          setRuleContext(ctx);
          return ctx;
      } catch (e) { console.error('Failed to load rule context', e); return null; }
  }, [ruleContext]);

  const openRulesList = (it: Item) => { setRulesFor(it); ensureContext(); };

  // ---- standalone sound export/import ----
  const handleExportSounds = async () => {
      setSoundIO(true);
      try {
          const ctx = await ensureContext();
          const rules = ctx ? collectSoundRules(ctx.mappings) : [];
          downloadJson(buildSoundExport(soundMap || {}, rules), 'Sharket_Sounds.sounds.json');
      } finally { setSoundIO(false); }
  };

  const handleImportSoundsFile = async (file: File) => {
      const parsed = parseSoundExport(await file.text());
      if (parsed === null) { alert(t.tsInvalidSoundFile); return; }
      if (parsed === 'newer') { alert(t.tsNewerVersion); return; }
      setSoundIO(true);
      try {
          // 1. Global sound map: merge key-by-key, incoming wins.
          const incomingBase = parsed.sound_map.basetype_sounds || {};
          const incomingClass = parsed.sound_map.class_sounds || {};
          const mapMerged = Object.keys(incomingBase).length + Object.keys(incomingClass).length;
          if (mapMerged > 0) {
              const merged = {
                  ...(soundMap || {}),
                  basetype_sounds: { ...(soundMap?.basetype_sounds || {}), ...incomingBase },
                  class_sounds: { ...(soundMap?.class_sounds || {}), ...incomingClass },
              };
              await axios.post('/api/sound-map', merged);
              setSoundMap(merged);
          }

          // 2. Rules: per file, apply exact matches only; skip + report the rest.
          const updated: SoundExportRule[] = [];
          const created: SoundExportRule[] = [];
          const skipped: { rule: SoundExportRule; reason: SkipReason }[] = [];
          const byFile = new Map<string, SoundExportRule[]>();
          parsed.rules.forEach(r => {
              const arr = byFile.get(r.file) || [];
              arr.push(r);
              byFile.set(r.file, arr);
          });
          for (const [filePath, rules] of byFile) {
              let content: any = null;
              try {
                  const res = await axios.get(`/api/config/${filePath}`);
                  content = res.data.content;
              } catch { /* missing file */ }
              if (!content) {
                  rules.forEach(rule => skipped.push({ rule, reason: 'file-missing' }));
                  continue;
              }
              let touched = false;
              for (const rule of rules) {
                  const match = matchSoundRule(rule, content);
                  if (match.action === 'skip') {
                      skipped.push({ rule, reason: match.reason! });
                      continue;
                  }
                  applySoundRule(rule, content, match);
                  touched = true;
                  (match.action === 'update' ? updated : created).push(rule);
              }
              if (touched) await axios.post(`/api/config/${filePath}`, content);
          }

          // 3. Missing-audio warning (list endpoints cover Default/ + sharket dirs).
          const available = new Set([...defaults, ...sharket].map(s => s.path));
          const missingAudio = referencedSoundPaths(parsed).filter(p => !available.has(p));

          setImportReport({ mapMerged, updated, created, skipped, missingAudio });

          // 4. Refresh occurrence data (per-file rule sounds changed on disk).
          if (updated.length || created.length) {
              setRuleContext(null);
              try {
                  const itemsRes = await axios.get('/api/class-items/All');
                  setItems(itemsRes.data.items);
              } catch { /* keep stale view */ }
              onSave();
          }
      } finally { setSoundIO(false); }
  };

  // After the rule panel saves a file, patch the cached context and refresh the
  // affected basetypes' occurrence sound from the saved rules.
  const handlePanelSaved = (mappingsKey: string, mappingContent: any, tierKey: string, tierContent: any) => {
      setRuleContext(prev => prev ? {
          ...prev,
          mappings: { ...prev.mappings, [mappingsKey]: mappingContent },
          tierDefinitions: { ...prev.tierDefinitions, [tierKey]: tierContent },
      } : prev);
      const rel = mappingsKey.replace(/^base_mapping\//, '');
      const rules = mappingContent?.rules || [];
      setItems(prev => prev.map(it => {
          if (!(it.occurrences || []).some(o => o.file === rel)) return it;
          const r = rules.find((x: any) => Array.isArray(x.targets) && x.targets.includes(it.name) && ruleSoundValue(x.overrides));
          const snd = r ? ruleSoundValue(r.overrides) : null;
          return { ...it, occurrences: (it.occurrences || []).map(o => o.file === rel ? { ...o, sound: snd } : o) };
      }));
  };

  const collisionDetectionStrategy = (args: any) => {
      const collisions = pointerWithin(args);
      if (collisions.length > 0) {
          // Prefer a specific target (column/item) over the broad 'workspace' droppable,
          // which only wins over empty gaps (e.g. dropping a catalog sound to create the
          // first column).
          const specific = collisions.filter((c: any) => c.id !== 'workspace');
          return specific.length > 0 ? specific : collisions;
      }
      return closestCorners(args);
  };

  const { setNodeRef: setPoolRef } = useDroppable({ id: 'pool', data: { type: 'pool' } });
  const { setNodeRef: setWorkspaceRef } = useDroppable({ id: 'workspace', data: { type: 'workspace' } });

  return (
    <div className="sound-bulk-editor modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-left">
            <h2>🎵 {language === 'ch' ? "音效批量编辑器" : "Sound Bulk Editor"}</h2>
            <div className="class-nav">
                <span className="label">{(t as any).itemClass}:</span>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="class-select">
                    {itemClasses.map(c => <option key={c} value={c}>{language === 'ch' ? (CLASS_CH[c] || c) : c}</option>)}
                </select>
            </div>
            <div className="file-io-btns">
                <button className="file-io-btn" onClick={handleExportSounds} disabled={soundIO || loading}>⬆ {t.tsExportSounds}</button>
                <button className="file-io-btn" onClick={() => soundFileInputRef.current?.click()} disabled={soundIO || loading}>⬇ {t.tsImportSounds}</button>
                <input
                    ref={soundFileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImportSoundsFile(f);
                        e.target.value = '';
                    }}
                />
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <DndContext sensors={sensors} collisionDetection={collisionDetectionStrategy} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="main-layout">
            <div ref={setPoolRef} className="item-pool-sidebar">
                <div className="sidebar-header">
                    <h3>{language === 'ch' ? "物品池" : "Item Pool"}</h3>
                    <input type="text" placeholder={t.search} className="pool-search" value={searchTermPool} onChange={e => setSearchTermPool(e.target.value)} />
                </div>
                <div className="pool-content">
                    {poolItemsList.map(it => {
                        const { sound, badge } = poolCardSound(it);
                        return (
                            <PoolItem
                                key={it.name}
                                item={it}
                                language={language}
                                currentSound={sound}
                                badge={badge}
                                rules={chipsOf(freeOccs(it))}
                                onRulesClick={() => openRulesList(it)}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="columns-workspace" ref={setWorkspaceRef}>
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
                                items={getColumnItems(sound.path)}
                                language={language}
                                onClose={() => setActiveColumns(prev => prev.filter(c => c.path !== sound.path))}
                                onSave={() => saveColumn(sound)}
                                onRemoveItem={(name) => removeFromColumn(name, sound.path)}
                                onCancel={() => cancelColumn(sound.path)}
                                stagedCount={collectColumnChanges(sound.path).length}
                                getBadge={(it) => columnBadge(it, sound.path)}
                                getRules={(it) => chipsOf(occsOnColumn(it, sound.path))}
                                onRulesClick={openRulesList}
                            />
                        ))
                    )}
                </SortableContext>
            </div>

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
                            <CatalogSoundCard
                                key={s.path}
                                sound={s}
                                onAdd={() => addColumn(s)}
                                usageCount={usageCounts[s.path] || 0}
                            />
                        ))
                    )}
                </div>
            </div>

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {activeId ? (
                    activeId.startsWith('cat-') ? (
                        <div className="sound-card-item dragging-overlay">
                            <div className="content-area" style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                                <span>🎵</span>
                                <span>{activeDragData?.sound?.label}</span>
                            </div>
                        </div>
                    ) : activeDragData?.type === 'item' ? (
                        <ItemCard item={activeDragData.item} language={language} className="dragging" style={{ width: '250px' }} />
                    ) : (
                        <div className="column-drag-preview">Moving Column...</div>
                    )
                ) : null}
            </DragOverlay>
          </div>
        </DndContext>
      </div>

      {picker && (
          <OccurrencePicker
              itemName={picker.item.name}
              itemNameCh={picker.item.name_ch}
              rows={picker.rows}
              preChecked={picker.preChecked}
              language={language}
              mode={picker.mode}
              targetSoundLabel={picker.targetLabel}
              onConfirm={handlePickerConfirm}
              onClose={() => setPicker(null)}
          />
      )}

      {/* Occurrence / rule list for a basetype (opened from the card's rule chips) */}
      {rulesFor && (
          <OccurrenceRuleList
              itemName={rulesFor.name}
              itemNameCh={rulesFor.name_ch}
              itemClass={rulesFor.item_class}
              language={language}
              rows={(rulesFor.occurrences || []).map((o): OccurrenceRuleRow => ({
                  file: o.file,
                  label: fileLabel(o.file),
                  tiers: o.tiers || [],
                  currentSound: resolveOccSound(rulesFor.name, o) || null,
              }))}
              onEditRules={(file) => setRulePanelFile(`base_mapping/${file}`)}
              onJumpToEditor={onJumpToRule ? (file) => { onJumpToRule(`base_mapping/${file}`); } : undefined}
              onClose={() => setRulesFor(null)}
          />
      )}

      {/* Sound-import result report */}
      {importReport && (
          <div className="modal-overlay report-overlay" onClick={() => setImportReport(null)}>
              <div className="import-report" onClick={e => e.stopPropagation()}>
                  <div className="report-header">
                      <h3>{t.tsImportReport}</h3>
                      <button className="close-btn" onClick={() => setImportReport(null)}>×</button>
                  </div>
                  <div className="report-body">
                      <div className="report-summary">
                          {importReport.mapMerged > 0 && <span className="pill pill-map">{importReport.mapMerged} {t.tsMapEntriesMerged}</span>}
                          <span className="pill pill-ok">{importReport.updated.length} {t.tsApplied}</span>
                          <span className="pill pill-new">{importReport.created.length} {t.tsCreated}</span>
                          <span className="pill pill-skip">{importReport.skipped.length} {t.tsSkipped}</span>
                      </div>
                      {importReport.skipped.length > 0 && (
                          <div className="report-section">
                              <h4>{t.tsSkipped}</h4>
                              {importReport.skipped.map((s, i) => (
                                  <div key={i} className="report-row">
                                      <span className="row-main">{s.rule.comment || s.rule.targets.join(', ')}</span>
                                      <span className="row-file">{s.rule.file.replace(/^base_mapping\//, '')}</span>
                                      <span className="row-reason">
                                          {s.reason === 'file-missing' ? t.tsSkipFileMissing
                                            : s.reason === 'target-not-in-file' ? t.tsSkipTargetMissing
                                            : t.tsSkipNoMatch}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      )}
                      {importReport.missingAudio.length > 0 && (
                          <div className="report-section warn">
                              <h4>⚠ {t.tsMissingAudio}</h4>
                              {importReport.missingAudio.map(p => <div key={p} className="report-row"><span className="row-main">{p}</span></div>)}
                          </div>
                      )}
                  </div>
                  <div className="report-footer">
                      <button className="col-save-btn report-close" onClick={() => setImportReport(null)}>OK</button>
                  </div>
              </div>
          </div>
      )}

      {/* Ported rule-block (same panel the simulator uses) for the chosen file */}
      {rulePanelFile && ruleContext && rulesFor && (
          <SimulatorRulePanel
              item={{ name: rulesFor.name, name_ch: rulesFor.name_ch, class: rulesFor.item_class || '' } as any}
              context={ruleContext}
              language={language}
              viewerBackground="Item_bg_coast.jpg"
              file={rulePanelFile}
              onClose={() => setRulePanelFile(null)}
              onJumpToRule={onJumpToRule}
              onSaved={handlePanelSaved}
          />
      )}

      <style>{`
        .sound-bulk-editor { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .sound-bulk-editor .modal-content { background: #fff; width: 98%; height: 95%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .header-left { display: flex; align-items: center; gap: 30px; }
        .header-left h2 { margin: 0; font-size: 1.2rem; }
        .class-nav { display: flex; align-items: center; gap: 10px; }
        .class-nav .label { font-size: 0.85rem; font-weight: bold; color: #666; }
        .class-select { padding: 6px 30px 6px 12px; border-radius: 6px; border: 1px solid #ccc; background: #fff; font-weight: 600; color: #2196F3; cursor: pointer; font-size: 0.85rem; max-width: 220px; transition: border-color 0.15s, box-shadow 0.15s; }
        .class-select:hover { border-color: #2196F3; }
        .class-select:focus { outline: none; border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,0.2); }
        .main-layout { flex: 1; display: flex; overflow: hidden; background: #f0f2f5; }
        .item-pool-sidebar { width: 280px; display: flex; flex-direction: column; background: #fff; border-right: 1px solid #ddd; }
        .sound-catalog-sidebar { border-right: none; border-left: 1px solid #ddd; width: 300px; display: flex; flex-direction: column; background: #fff; }
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
        .sound-card-item { background: #f8f9fa; border: 1px solid #ddd; padding: 0; border-radius: 6px; display: flex; align-items: stretch; gap: 0; cursor: grab; transition: all 0.2s; position: relative; min-height: 45px; }
        .sound-card-item:hover { border-color: #2196F3; background: #f0f7ff; }
        .add-btn { width: 35px; border: none; background: #eee; cursor: pointer; font-size: 1.2rem; color: #666; border-left: 1px solid #ddd; border-radius: 0 6px 6px 0; display: flex; align-items: center; justify-content: center; }
        .add-btn:hover { background: #2196F3; color: white; }
        .usage-badge { font-size: 0.65rem; background: #2196F3; color: white; padding: 2px 6px; border-radius: 10px; font-weight: bold; margin-left: 8px; }
        .occ-frac { position: absolute; top: 4px; right: 24px; font-size: 0.6rem; font-weight: bold; background: #ff9800; color: #fff; padding: 1px 6px; border-radius: 10px; pointer-events: none; }
        .dragging-source { opacity: 0.3; }
        .dragging-overlay { box-shadow: 0 10px 25px rgba(0,0,0,0.3); transform: rotate(2deg); background: #e3f2fd; padding: 0; border-radius: 8px; display: flex; align-items: stretch; gap: 0; z-index: 2000; width: 250px; }
        .dragging-overlay .content-area { padding: 10px; display: flex; align-items: center; gap: 10px; flex: 1; }
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
        .file-io-btns { display: flex; gap: 6px; }
        .file-io-btn { padding: 6px 14px; font-size: 0.8rem; font-weight: bold; background: #f5f5f5; color: #444; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; }
        .file-io-btn:hover { border-color: #2196F3; color: #2196F3; background: #f0f7ff; }
        .file-io-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .report-overlay { z-index: 1100; }
        .import-report { background: #fff; width: 560px; max-height: 80vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
        .report-header { padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .report-header h3 { margin: 0; font-size: 1.05rem; }
        .report-body { padding: 15px 20px; overflow-y: auto; flex: 1; }
        .report-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .pill { font-size: 0.78rem; font-weight: bold; padding: 4px 10px; border-radius: 12px; }
        .pill-map { background: #e3f2fd; color: #1565C0; }
        .pill-ok { background: #e8f5e9; color: #2e7d32; }
        .pill-new { background: #fff8e1; color: #b07c00; }
        .pill-skip { background: #fdecea; color: #b71c1c; }
        .report-section { margin-top: 10px; }
        .report-section h4 { margin: 0 0 6px; font-size: 0.85rem; color: #555; }
        .report-section.warn h4 { color: #b07c00; }
        .report-row { display: flex; gap: 8px; align-items: baseline; padding: 4px 6px; border-radius: 4px; font-size: 0.8rem; }
        .report-row:nth-child(even) { background: #fafafa; }
        .report-row .row-main { font-weight: 600; color: #333; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .report-row .row-file { color: #888; font-size: 0.72rem; }
        .report-row .row-reason { color: #b71c1c; font-size: 0.72rem; white-space: nowrap; }
        .report-footer { padding: 12px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; }
        .report-close { padding: 8px 28px; border-radius: 6px; border: none; cursor: pointer; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default SoundBulkEditor;
