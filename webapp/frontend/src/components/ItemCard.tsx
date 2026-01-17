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
  onContextMenu?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  showStagedIndicator?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  language,
  color,
  isStaged,
  onContextMenu,
  onDelete,
  onClick,
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

        {isStaged && showStagedIndicator && (
          <div className="staged-indicator">●</div>
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
