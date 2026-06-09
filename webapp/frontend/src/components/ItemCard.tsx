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
  currentSound?: string;
  showDetails?: boolean;
  rules?: { label: string }[];
  onRulesClick?: (e: React.MouseEvent) => void;
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
  currentSound,
  showDetails = false,
  rules,
  onRulesClick,
}) => {
  const dotBg = getSubTypeBackground(item.sub_type);
  const showChineseFirst = language === "ch";

  // Up to 3 rule chips + a "+N more" overflow chip (clicking opens the full list).
  const visibleRules = rules ? rules.slice(0, 3) : [];
  const overflowRules = rules ? rules.length - visibleRules.length : 0;

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
          
          {showDetails && (
              <>
                {(item.item_class || (!rules && (item.instance_tier || item.current_tier))) && (
                    <div className="item-class-label">
                        {item.item_class && (language === 'ch' ? ((translations[language] as any)[CLASS_KEY_MAP[item.item_class] || item.item_class] || item.item_class) : item.item_class)}
                        {!rules && item.instance_tier && <span className="tier-pill"> | {item.instance_tier.match(/Tier (\d+)/)?.[1] ? `T${item.instance_tier.match(/Tier (\d+)/)?.[1]}` : item.instance_tier}</span>}
                        {!rules && !item.instance_tier && item.current_tier && item.current_tier.length > 0 && (
                            <span className="tier-pill"> | {item.current_tier.map((t: string) => t.match(/Tier (\d+)/)?.[1] ? `T${t.match(/Tier (\d+)/)?.[1]}` : t).join(', ')}</span>
                        )}
                    </div>
                )}
                
                <div className="item-sound-info">
                    <span className="sound-label">🎵 </span>
                    <span className={`sound-path ${!currentSound ? 'none' : ''}`}>
                        {currentSound ? currentSound.split('/').pop() : (translations[language] as any).noSoundApplied}
                    </span>
                </div>

                {rules && rules.length > 0 && (
                    <div
                        className="item-rule-chips"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onRulesClick?.(e); }}
                        style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px', marginTop: '6px', cursor: onRulesClick ? 'pointer' : 'default' }}
                        title={rules.map(r => r.label).join('\n')}
                    >
                        {visibleRules.map((r, i) => (
                            <span key={i} style={{ fontSize: '0.6rem', background: '#eef2f7', color: '#42566b', border: '1px solid #d6dee7', borderRadius: '4px', padding: '1px 6px', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.label}
                            </span>
                        ))}
                        {overflowRules > 0 && (
                            <span style={{ fontSize: '0.6rem', background: '#2196F3', color: '#fff', borderRadius: '4px', padding: '1px 6px', fontWeight: 'bold' }}>
                                +{overflowRules} {language === 'ch' ? '更多' : 'more'}
                            </span>
                        )}
                    </div>
                )}
              </>
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
