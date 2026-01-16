import React, { useState } from 'react';
import { useTranslation, CLASS_KEY_MAP } from '../utils/localization';

interface ItemDetails {
  drop_level?: number;
  width?: number;
  height?: number;
  implicit?: string[];
  armour?: number;
  armour_max?: number;
  evasion?: number;
  evasion_max?: number;
  energy_shield?: number;
  energy_shield_max?: number;
  damage_min?: number;
  damage_max?: number;
  aps?: number;
  crit?: number;
  dps?: number;
  req_str?: number;
  req_dex?: number;
  req_int?: number;
  item_class?: string;
  name?: string;
  name_ch?: string;
  [key: string]: any;
}

interface ItemTooltipProps {
  item: ItemDetails;
  children: React.ReactElement;
  language?: 'ch' | 'en';
}

const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, children, language = 'en' }) => {
  const t = useTranslation(language);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
      setVisible(true);
      setPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
      setVisible(false);
  };

  const formatRange = (min?: number, max?: number) => {
      if (!min && !max) return null;
      if (min === max) return `${min}`;
      return `${min}-${max}`;
  };

  const ar = formatRange(item.armour, item.armour_max);
  const ev = formatRange(item.evasion, item.evasion_max);
  const es = formatRange(item.energy_shield, item.energy_shield_max);
  const hasWeaponStats = (item.dps || 0) > 0;
  const hasReqs = (item.req_str || 0) > 0 || (item.req_dex || 0) > 0 || (item.req_int || 0) > 0;
  const hasImplicit = item.implicit && item.implicit.length > 0;
  
  const isEquipment = hasWeaponStats || ar || ev || es || hasReqs;
  const hasContent = item.item_class || isEquipment;
  
  if (!hasContent) return children;

  const nameColor = "#c8c8c8"; 
  const displayClass = language === 'ch' ? ((t as any)[CLASS_KEY_MAP[item.item_class || ""] || item.item_class] || item.item_class) : item.item_class;

  return (
    <>
      {React.cloneElement(children, {
          onMouseEnter: handleMouseEnter,
          onMouseMove: handleMouseMove,
          onMouseLeave: handleMouseLeave
      })}
      {visible && (
        <div className="poe-tooltip" style={{ top: pos.y + 15, left: pos.x + 15 }}>
            <div className="tooltip-header">
                {language === 'ch' ? (
                    <div className="name-box">
                        <div className="item-name" style={{ color: nameColor }}>{item.name_ch || item.name}</div>
                        <div className="item-name-en">{item.name}</div>
                    </div>
                ) : (
                    <div className="item-name" style={{ color: nameColor }}>{item.name}</div>
                )}
                {displayClass && <div className="item-class">{displayClass}</div>}
            </div>

            {(hasWeaponStats || ar || ev || es || (isEquipment && item.drop_level)) && (
                <>
                    <div className="separator" />
                    <div className="stats-block">
                        {isEquipment && item.drop_level ? (
                            <div className="stat-line"><span className="label">{t.dropLevel}:</span> <span className="value">{item.drop_level}</span></div>
                        ) : null}
                        {hasWeaponStats && (
                            <>
                                <div className="stat-line"><span className="label">{t.physicalDamage}:</span> <span className="value">{item.damage_min}-{item.damage_max}</span></div>
                                <div className="stat-line"><span className="label">{t.criticalStrikeChance}:</span> <span className="value">{item.crit}%</span></div>
                                <div className="stat-line"><span className="label">{t.attacksPerSecond}:</span> <span className="value">{item.aps}</span></div>
                            </>
                        )}
                        {ar && <div className="stat-line armour"><span className="label">{t.Armour}:</span> <span className="value">{ar}</span></div>}
                        {ev && <div className="stat-line evasion"><span className="label">{t.Evasion_Rating}:</span> <span className="value">{ev}</span></div>}
                        {es && <div className="stat-line es"><span className="label">{t.Energy_Shield}:</span> <span className="value">{es}</span></div>}
                    </div>
                </>
            )}

            {isEquipment && (item.drop_level || hasReqs) && (
                <>
                    <div className="separator" />
                    <div className="reqs-block">
                        {item.drop_level ? <span className="req-line">{t.requiresLevel} <span className="value">{item.drop_level}</span></span> : null}
                        {hasReqs && (
                            <span className="req-line">
                                {item.drop_level && ", "}
                                {item.req_str ? <span><span className="value">{item.req_str}</span> {t.str}</span> : null}
                                {item.req_str && (item.req_dex || item.req_int) ? ", " : ""}
                                {item.req_dex ? <span><span className="value">{item.req_dex}</span> {t.dex}</span> : null}
                                {item.req_dex && item.req_int ? ", " : ""}
                                {item.req_int ? <span><span className="value">{item.req_int}</span> {t.int}</span> : null}
                            </span>
                        )}
                    </div>
                </>
            )}

            {hasImplicit && (
                <>
                    <div className="separator" />
                    <div className="implicit-block">
                        {item.implicit?.map((imp, i) => <div key={i} className="mod">{imp}</div>)}
                    </div>
                </>
            )}
        </div>
      )}
      <style>{`
        .poe-tooltip {
            position: fixed; z-index: 9999; 
            background: rgba(0, 0, 0, 0.94); 
            color: #7f7f7f;
            border: 1px solid #7f7f7f;
            font-family: 'Fontin', 'Times New Roman', serif;
            font-size: 16px;
            min-width: 300px;
            max-width: 450px;
            pointer-events: none;
            padding: 8px;
            text-align: center;
            box-shadow: 0 10px 20px rgba(0,0,0,0.5);
        }
        
        .tooltip-header { padding: 5px; }
        .item-name { font-size: 22px; font-weight: normal; margin-bottom: 4px; }
        .item-name-en { font-size: 14px; color: #888; margin-bottom: 4px; }
        .item-class { font-size: 16px; color: #7f7f7f; }

        .separator {
            height: 1px;
            background: linear-gradient(90deg, rgba(127,127,127,0) 0%, rgba(127,127,127,1) 50%, rgba(127,127,127,0) 100%);
            margin: 8px 0;
        }

        .stats-block, .reqs-block { padding: 5px; text-align: center; }
        .stat-line { margin: 4px 0; font-size: 16px; }
        .label { color: #7f7f7f; }
        .value { color: #fff; }

        .stat-line.armour .value { color: #e88; }
        .stat-line.evasion .value { color: #8e8; }
        .stat-line.es .value { color: #88e; }

        .implicit-block { padding: 5px; color: #8888ff; font-size: 16px; }
        .mod { margin: 3px 0; }
      `}</style>
    </>
  );
};

export default ItemTooltip;