import React from "react";
import ItemTooltip from "./ItemTooltip";
import type { Language } from "../utils/localization";
import { getSubTypeBackground } from "../utils/itemUtils";

interface Item {
  name: string;
  name_ch?: string;
  sub_type?: string;
  [key: string]: any;
}

interface ItemCardProps {
  item: Item;
  language: Language;
  color?: string;
  isStaged?: boolean;
  matchMode?: 'exact' | 'partial';
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

        <div className="item-info">
          {showChineseFirst ? (
            <>
              <div className="name-primary">{item.name_ch || item.name}</div>
              <div className="name-secondary">{item.name}</div>
            </>
          ) : (
            <div className="name-primary">{item.name}</div>
          )}
        </div>

        {matchMode === 'exact' && (
          <div className="match-mode-badge exact">E</div>
        )}

        {isStaged && showStagedIndicator && (
          <div className="staged-indicator">●</div>
        )}
        {item.rule_index !== undefined && item.rule_index !== null && (
          <div className="rule-source-badge" title={`From Rule #${item.rule_index + 1}`}>#{item.rule_index + 1}</div>
        )}
        {onDelete && (
          <button
            className="item-card-del-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
          >
            ×
          </button>
        )}
      </div>
    </ItemTooltip>
  );
};

export default ItemCard;
