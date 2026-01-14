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
                <span className="handle-icon">⠿</span>
                <span className="handle-label">DRAG</span>
            </div>
            <div className="insert-controls">
                <button className="insert-btn before" onClick={onInsertBefore} title="Insert Tier Before">
                    <span className="plus">+</span> ABOVE
                </button>
                <div className="separator"></div>
                <button className="insert-btn after" onClick={onInsertAfter} title="Insert Tier After">
                    <span className="plus">+</span> BELOW
                </button>
            </div>
        </div>

        <div className="tier-content">
            {children}
        </div>

        <style>{`
            .tier-block-wrapper {
                position: relative;
                transition: transform 0.2s, box-shadow 0.2s;
                border-radius: 6px;
                margin-bottom: 25px;
            }
            .tier-block-wrapper.is-dragging {
                z-index: 1000;
                box-shadow: 0 12px 24px rgba(0,0,0,0.2);
            }
            .tier-controls-overlay {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-bottom: 4px;
                padding: 0 2px;
            }
            .drag-handle {
                cursor: grab;
                background: #f0f4f8;
                border: 1px solid #d1d9e0;
                border-bottom: none;
                color: #57606a;
                font-size: 0.7rem;
                padding: 4px 12px;
                border-radius: 6px 6px 0 0;
                display: flex;
                align-items: center;
                gap: 6px;
                font-weight: bold;
                transition: all 0.2s;
            }
            .drag-handle:hover {
                background: #e1eaf2;
                color: #2196F3;
                border-color: #2196F3;
            }
            .drag-handle:active {
                cursor: grabbing;
            }
            .handle-icon {
                font-size: 1rem;
                line-height: 1;
            }
            .handle-label {
                letter-spacing: 0.5px;
            }

            .insert-controls {
                display: flex;
                background: white;
                border: 1px solid #d1d9e0;
                border-bottom: none;
                border-radius: 6px 6px 0 0;
                overflow: hidden;
                opacity: 0.7;
                transition: all 0.2s;
                box-shadow: 0 -2px 5px rgba(0,0,0,0.02);
            }
            .tier-block-wrapper:hover .insert-controls {
                opacity: 1;
                border-color: #2196F3;
            }
            .insert-btn {
                background: none;
                border: none;
                padding: 5px 12px;
                cursor: pointer;
                font-size: 0.7rem;
                color: #57606a;
                font-weight: bold;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .insert-btn:hover {
                background: #f0f7ff;
                color: #2196F3;
            }
            .insert-btn .plus {
                font-size: 1.1rem;
                color: #2196F3;
            }
            .separator {
                width: 1px;
                background: #d1d9e0;
                margin: 6px 0;
            }
            .tier-content {
                border: 2px solid #d1d9e0;
                border-radius: 0 0 6px 6px;
                padding: 20px;
                background: #fff;
                transition: border-color 0.2s;
            }
            .tier-block-wrapper:hover .tier-content {
                border-color: #2196F3;
            }
        `}</style>
    </div>
  );
};

export default SortableTierBlock;
