import React, { useEffect, useRef } from 'react';
import { translations, type Language } from '../utils/localization';

interface ContextMenuProps {
  x: number;
  y: number;
  options: { label: string; onClick: () => void; color?: string; divider?: boolean; className?: string; disabled?: boolean; title?: boolean }[];
  onClose: () => void;
  language?: Language;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose, language = 'en' }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust position if menu goes off screen
  const menuX = Math.min(x, window.innerWidth - 200);
  const menuY = Math.min(y, window.innerHeight - 300);

  const displayOptions = options.length > 0 ? options : [
      { 
          label: (translations[language] as any).noOptions || "No available options", 
          onClick: () => {}, 
          disabled: true, 
          className: "no-options",
          title: false,
          divider: false,
          color: undefined 
      }
  ];

  return (
    <div 
      className="context-menu" 
      ref={menuRef} 
      style={{ top: menuY, left: menuX }}
    >
      {displayOptions.map((option, index) => {
          const isTitle = option.title || (option.divider && option.label);
          const isDivider = option.divider && !option.label;
          
          return (
            <div 
              key={index} 
              className={`menu-item ${option.className || ''} ${option.disabled ? 'disabled' : ''} ${isTitle ? 'title' : ''} ${isDivider ? 'divider' : ''}`} 
              onClick={(e) => {
                if (isTitle || isDivider || option.disabled) return;
                e.stopPropagation();
                option.onClick();
                onClose();
              }}
            >
              {!isTitle && !isDivider && option.color && <span className="color-dot" style={{ background: option.color }}></span>}
              {(!isDivider) ? option.label : ""}
            </div>
          );
      })}
      <style>{`
        .context-menu {
          position: fixed;
          background: white;
          border: 1px solid #ccc;
          box-shadow: 2px 2px 10px rgba(0,0,0,0.2);
          z-index: 2000;
          border-radius: 4px;
          min-width: 200px;
          padding: 5px 0;
        }
        .menu-item {
          padding: 8px 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          color: #333;
        }
        .menu-item:hover {
          background: #f0f0f0;
        }
        .menu-item.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: none !important;
        }
        .menu-item.no-options {
            font-style: italic;
            color: #999;
            justify-content: center;
        }
        .menu-item.divider {
            border-top: 1px solid #eee;
            margin: 4px 0;
            padding: 0;
            height: 1px;
            pointer-events: none;
        }
        .menu-item.title {
            font-size: 0.75rem;
            font-weight: bold;
            color: #999;
            text-transform: uppercase;
            padding: 10px 15px 4px 15px;
            background: none !important;
            cursor: default;
            border-top: 1px solid #f5f5f5;
            margin-top: 2px;
        }
        .menu-item.title:first-child {
            border-top: none;
            padding-top: 8px;
        }
        .color-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 1px solid #ddd;
        }
      `}</style>
    </div>
  );
};

export default ContextMenu;
