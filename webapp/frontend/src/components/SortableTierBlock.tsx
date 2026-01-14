import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTierBlockProps {
  id: string;
  children: React.ReactNode;
  onContextMenu: (e: React.MouseEvent) => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
}

const SortableTierBlock: React.FC<SortableTierBlockProps> = ({
  id,
  children,
  onContextMenu,
  onInsertBefore,
  onInsertAfter
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    marginBottom: '20px'
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`tier-block-wrapper ${isDragging ? 'is-dragging' : ''}`}
      onContextMenu={onContextMenu}
    >
        {/* Drag Handle & Insert Controls */}
        <div className="tier-controls-overlay">
            <div className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
                ⋮⋮
            </div>
            <div className="insert-controls">
                <button className="insert-btn before" onClick={onInsertBefore} title="Insert Tier Before">
                    +↑
                </button>
                <div className="separator"></div>
                <button className="insert-btn after" onClick={onInsertAfter} title="Insert Tier After">
                    +↓
                </button>
            </div>
        </div>

        <div className="tier-content">
            {children}
        </div>

        <style>{`
            .tier-block-wrapper {
                position: relative;
                transition: box-shadow 0.2s;
                border-radius: 4px;
            }
            .tier-block-wrapper.is-dragging {
                z-index: 100;
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
            }
            .tier-controls-overlay {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
                padding: 0 5px;
            }
            .drag-handle {
                cursor: grab;
                color: #ccc;
                font-size: 1.2rem;
                padding: 2px 8px;
                border-radius: 4px;
            }
            .drag-handle:hover {
                background: #f0f0f0;
                color: #666;
            }
            .insert-controls {
                display: flex;
                background: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
                opacity: 0.2;
                transition: opacity 0.2s;
            }
            .tier-block-wrapper:hover .insert-controls {
                opacity: 1;
            }
            .insert-btn {
                background: none;
                border: none;
                padding: 4px 10px;
                cursor: pointer;
                font-size: 0.8rem;
                color: #666;
                transition: background 0.2s;
            }
            .insert-btn:hover {
                background: #e0e0e0;
                color: #2196F3;
            }
            .separator {
                width: 1px;
                background: #ddd;
            }
            .tier-content {
                border: 1px solid #eee;
                border-radius: 4px;
                padding: 15px;
                background: #fff;
            }
        `}</style>
    </div>
  );
};

export default SortableTierBlock;
