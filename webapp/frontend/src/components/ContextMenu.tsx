import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  options: { label: string; onClick: () => void; color?: string; divider?: boolean; className?: string }[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
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

  return (
    <div 
      className="context-menu" 
      ref={menuRef} 
      style={{ top: menuY, left: menuX }}
    >
      {options.map((option, index) => (
        <div 
          key={index} 
          className={`menu-item ${option.className || ''}`} 
          onClick={(e) => {
            if (option.divider) return;
            e.stopPropagation();
            option.onClick();
            onClose();
          }}
        >
          {!option.divider && option.color && <span className="color-dot" style={{ background: option.color }}></span>}
          {option.divider ? "" : option.label}
        </div>
      ))}
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
        .menu-item.divider {
            border-top: 1px solid #eee;
            margin-top: 5px;
            padding-top: 10px;
            font-weight: bold;
            color: #888;
            pointer-events: none;
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
