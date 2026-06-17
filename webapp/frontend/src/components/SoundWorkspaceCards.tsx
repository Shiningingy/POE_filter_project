import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import ItemCard from './ItemCard';

// Shared shapes (mirror the definitions in SoundBulkEditor — the bone owns the
// data, these cards are purely presentational drag/drop tiles).
interface Occurrence {
  file: string;
  tiers: string[];
  sound: string | null;
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

export const CatalogSoundCard = ({ sound, onAdd, usageCount }: { sound: SoundDef, onAdd: () => void, usageCount: number }) => {
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

export const PoolItem = ({ item, language, currentSound, badge, rules, onRulesClick }: { item: Item, language: Language, currentSound?: string, badge?: string, rules?: { label: string }[], onRulesClick?: () => void }) => {
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

export const WorkspaceColumn = ({
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
