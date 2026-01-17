import React, { useState } from "react";
import { useTranslation, CLASS_KEY_MAP } from "../utils/localization";

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
  language?: "ch" | "en";
}

const ItemTooltip: React.FC<ItemTooltipProps> = ({
  item,
  children,
  language = "en",
}) => {
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
  const hasReqs =
    (item.req_str || 0) > 0 ||
    (item.req_dex || 0) > 0 ||
    (item.req_int || 0) > 0;
  const isAccessory = ["Rings", "Amulets", "Belts"].includes(
    item.item_class || ""
  );
  const hasImplicit = item.implicit && item.implicit.length > 0;

  const isEquipment = hasWeaponStats || ar || ev || es || hasReqs;
  const hasContent = item.item_class || isEquipment || hasImplicit;

  if (!hasContent) return children;

  const nameColor = "#c8c8c8";
  const displayClass = (() => {
    if (!item.item_class) return "";
    const key = (CLASS_KEY_MAP as Record<string, string>)[item.item_class] || item.item_class;
    return language === "ch" ? (t as any)[key] || item.item_class : item.item_class;
  })();

  return (
    <>
      {React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
        onMouseEnter: handleMouseEnter,
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
      })}
      {visible && (
        <div
          className="poe-tooltip"
          style={{ top: pos.y + 15, left: pos.x + 15 }}
        >
          <div className="tooltip-header">
            {language === "ch" ? (
              <div className="name-box">
                <div className="item-name" style={{ color: nameColor }}>
                  {item.name_ch || item.name}
                </div>
                <div className="item-name-en">{item.name}</div>
              </div>
            ) : (
              <div className="item-name" style={{ color: nameColor }}>
                {item.name}
              </div>
            )}
            {!isEquipment && !isAccessory && <div className="separator" />}
            {displayClass && <div className="item-class">{displayClass}</div>}
          </div>

          {/* Properties Section (Weapon / Defence / Drop Level) */}
          {(hasWeaponStats ||
            ar ||
            ev ||
            es ||
            (isEquipment && item.drop_level)) && (
            <>
              <div className="separator" />
              <div className="stats-block">
                {isEquipment && item.drop_level ? (
                  <div className="stat-line">
                    <span className="label">{t.dropLevel}:</span>{" "}
                    <span className="value">{item.drop_level}</span>
                  </div>
                ) : null}
                {hasWeaponStats && (
                  <>
                    <div className="stat-line">
                      <span className="label">{t.physicalDamage}:</span>{" "}
                      <span className="value">
                        {item.damage_min}-{item.damage_max}
                      </span>
                    </div>
                    <div className="stat-line">
                      <span className="label">{t.criticalStrikeChance}:</span>{" "}
                      <span className="value">{item.crit}%</span>
                    </div>
                    <div className="stat-line">
                      <span className="label">{t.attacksPerSecond}:</span>{" "}
                      <span className="value">{item.aps}</span>
                    </div>
                  </>
                )}
                {ar && (
                  <div className="stat-line armour">
                    <span className="label">{t.Armour}:</span>{" "}
                    <span className="value">{ar}</span>
                  </div>
                )}
                {ev && (
                  <div className="stat-line evasion">
                    <span className="label">{t.Evasion_Rating}:</span>{" "}
                    <span className="value">{ev}</span>
                  </div>
                )}
                {es && (
                  <div className="stat-line es">
                    <span className="label">{t.Energy_Shield}:</span>{" "}
                    <span className="value">{es}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Requirements Section */}
          {isEquipment && hasReqs && (
            <>
              <div className="separator" />
              <div className="reqs-block">
                {/* Level is already in first section if equipment? No, usually level is in Requirements in PoE */}
                {/* But I put it in Stats above. I'll move it back to Reqs to be classic. */}
                {item.drop_level ? (
                  <div className="req-line">
                    {t.requiresLevel}{" "}
                    <span className="value">{item.drop_level}</span>
                  </div>
                ) : null}
                <div className="req-line">
                  {item.req_str ? (
                    <span>
                      <span className="value">{item.req_str}</span> {t.str}
                    </span>
                  ) : null}
                  {item.req_str && (item.req_dex || item.req_int) ? ", " : ""}
                  {item.req_dex ? (
                    <span>
                      <span className="value">{item.req_dex}</span> {t.dex}
                    </span>
                  ) : null}
                  {item.req_dex && item.req_int ? ", " : ""}
                  {item.req_int ? (
                    <span>
                      <span className="value">{item.req_int}</span> {t.int}
                    </span>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {/* Implicit Section */}
          {hasImplicit && (
            <>
              <div className="separator" />
              <div className="implicit-block">
                {item.implicit?.map((imp, i) => (
                  <div key={i} className="mod">
                    {imp}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ItemTooltip;
