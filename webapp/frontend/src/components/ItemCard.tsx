import React from "react";
import ItemTooltip from "./ItemTooltip";
import { translations, CLASS_KEY_MAP } from "../utils/localization";
import type { Language } from "../utils/localization";
import { getSubTypeBackground } from "../utils/itemUtils";

interface Item {
  name: string;
  name_ch?: string;
  sub_type?: string;
  item_class?: string;
  [key: string]: any;
}

interface ItemCardProps {
  item: Item;
  language: Language;
  color?: string;
  isStaged?: boolean;
  matchMode?: 'exact' | 'partial';
  hasSound?: boolean;
  onPlaySound?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  showStagedIndicator?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  language,
  color,
  isStaged,
  matchMode,
  hasSound,
  onPlaySound,
  onContextMenu,
  onDelete,
  onClick,
  onDoubleClick,
  className = "",
  style = {},
  showStagedIndicator = true,
}) => {
  const dotBg = getSubTypeBackground(item.sub_type);
  const showChineseFirst = language === "ch";

  // Render logic
  return (
    <ItemTooltip item={item} language={language}>
      <div
        style={{ ...style, backgroundColor: color || style.backgroundColor }}
        className={`item-card-base ${isStaged ? "staged" : ""} ${className}`}
        onContextMenu={onContextMenu}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {dotBg && (
          <div className="defense-indicator" style={{ background: dotBg }} />
        )}

        {/* <div className="item-icon-mini">
            <img 
                src={iconUrl} 
                alt="" 
                onError={(e) => (e.currentTarget.style.display = 'none')}
            />
        </div> */}

        <div className="item-info">
          {showChineseFirst ? (
            <div className="name-container">
              <span className="name-primary">{item.name_ch || item.name}</span>
              {hasSound && (
                <span 
                    className="sound-icon" 
                    onClick={(e) => { e.stopPropagation(); onPlaySound?.(); }}
                    title="Play Sound"
                >
                    🔊
                </span>
              )}
            </div>
          ) : (
             <div className="name-container">
              <span className="name-primary">{item.name}</span>
              {hasSound && (
                <span 
                    className="sound-icon" 
                    onClick={(e) => { e.stopPropagation(); onPlaySound?.(); }}
                    title="Play Sound"
                >
                    🔊
                </span>
              )}
            </div>
          )}
          {showChineseFirst && <div className="name-secondary">{item.name}</div>}
          {(item.item_class || item.instance_tier || item.current_tier) && (
              <div className="item-class-label">
                  {item.item_class && (language === 'ch' ? ((translations[language] as any)[CLASS_KEY_MAP[item.item_class] || item.item_class] || item.item_class) : item.item_class)}
                  {item.instance_tier && <span className="tier-pill"> | {item.instance_tier.match(/Tier (\d+)/)?.[1] ? `T${item.instance_tier.match(/Tier (\d+)/)?.[1]}` : item.instance_tier}</span>}
                  {!item.instance_tier && item.current_tier && item.current_tier.length > 0 && (
                      <span className="tier-pill"> | {item.current_tier.map((t: string) => t.match(/Tier (\d+)/)?.[1] ? `T${t.match(/Tier (\d+)/)?.[1]}` : t).join(', ')}</span>
                  )}
              </div>
          )}
        </div>

        {/* Corner Indicators */}
        {item.rule_index !== undefined && item.rule_index !== null && (
          <div className="rule-source-badge-tl" title={`From Rule #${item.rule_index + 1}`}>#{item.rule_index + 1}</div>
        )}
        
        {onDelete && (
          <button
            className="item-card-del-btn-tr"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
          >
            ×
          </button>
        )}

        {matchMode === 'exact' && (
          <div className="match-mode-badge-br">E</div>
        )}

        {isStaged && showStagedIndicator && (
          <div className="staged-indicator-bl">●</div>
        )}
      </div>
    </ItemTooltip>
  );
};

export default ItemCard;
