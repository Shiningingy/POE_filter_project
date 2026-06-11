import React, { useEffect, useRef, useState } from "react";
import { useTranslation, CLASS_KEY_MAP, BONUS_TAG_CH } from "../utils/localization";
import { useBonusInfo, deriveDropSource } from "../utils/bonusInfo";
import type { UniqueCandidate } from "../utils/bonusInfo";

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
  const bonusInfo = useBonusInfo();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
    },
    []
  );

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

  // --- FilterBlade-style bonus / "could be" hover data ---
  const baseType = (item.base_type as string) || item.name || "";
  const flatBonus = bonusInfo.items[item.name || ""] || bonusInfo.items[baseType];
  const uniqueBase = bonusInfo.uniques[baseType];
  const candidates = (uniqueBase?.uniques || []).filter((u) => !u.hideInHoverBox);
  const MAX_CANDIDATES = 6;
  let flatLines = flatBonus?.description
    ? flatBonus.description.split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean)
    : [];
  // CH mode: swap the official-description part of the FilterBlade text for
  // the official zh translation, keeping FilterBlade's extra sentences (drop
  // hints, value notes). FilterBlade often paraphrases the official text
  // rather than quoting it, so a sentence is treated as "the description" —
  // and dropped — when most of its words appear in the official EN text, or
  // when it's the incubator "Awards ..." template (a heavy paraphrase that
  // word overlap can't catch). Audited against all 1181 covered items.
  if (language === "ch" && flatBonus?.description_ch) {
    const words = (s: string) =>
      (s.toLowerCase().match(/[a-z0-9]+/g) || []).map((w) => w.replace(/s$/, ""));
    const official = new Set(words(flatBonus.description_en || ""));
    const extras = flatLines
      .map((line) =>
        line
          .split(/(?<=[.!?])\s+/)
          .filter((sent) => {
            const w = words(sent);
            if (!w.length) return false;
            if (/^awards?\b/i.test(sent.trim())) return false;
            if (!official.size) return true;
            const hits = w.filter((x) => official.has(x)).length;
            return hits / w.length < 0.65;
          })
          .join(" ")
      )
      .filter(Boolean);
    const zhLines = flatBonus.description_ch.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    flatLines = [...extras, ...zhLines];
  }
  const flatTags = flatBonus?.tags || [];
  const hasBonus = flatLines.length > 0 || flatTags.length > 0 || candidates.length > 0;

  // Unique-base hover: the point is WHICH uniques the base can be and WHERE
  // they drop — basic item stats just add noise, so they're skipped.
  const uniqueFocus = candidates.length > 0;

  // Only tooltips with an expandable unique list need to stay open while the
  // mouse travels into them; ordinary ones are pointer-events:none anyway.
  const interactive = candidates.length > MAX_CANDIDATES;

  // Anchored at the enter point (not mouse-following). The short show delay
  // means sweeping the cursor across a column never flashes tooltips, and
  // non-interactive tooltips hide instantly on leave — no after-image trail.
  const handleMouseEnter = (e: React.MouseEvent) => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (visible || showTimer.current) return;
    const x = e.clientX;
    const y = e.clientY;
    showTimer.current = setTimeout(() => {
      showTimer.current = null;
      setPos({ x, y });
      setVisible(true);
    }, 120);
  };

  const hideNow = () => {
    setVisible(false);
    setExpanded(false);
  };

  const handleMouseLeave = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (!interactive) {
      hideNow();
      return;
    }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hideNow, 150);
  };

  // Hovering the (interactive) tooltip itself keeps it open.
  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const hasContent = item.item_class || isEquipment || hasImplicit || hasBonus;

  if (!hasContent) return children;

  const nameColor = "#c8c8c8";

  // One "could be" unique: zh name when available, a drop-source badge derived
  // from the FilterBlade text, and the source text itself underneath.
  const SRC_LABEL: Record<string, string> = {
    global: t.srcGlobal,
    boss: t.srcBoss,
    league: t.srcLeague,
    nodrop: t.srcNoDrop,
  };
  const renderCandidate = (c: UniqueCandidate) => {
    const displayName = language === "ch" && c.name_ch ? `${c.name_ch} ${c.unique}` : c.unique;
    const textLine = (c.text || "").split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean).join(" ");
    // Legacy (drop-disabled per poewiki) wins over the derived source badge;
    // no source text (trade-data extras) -> no badge rather than a wrong "Global".
    const src = c.legacy ? null : c.text ? deriveDropSource(c.text) : null;
    return (
      <div key={c.unique} className="bonus-unique">
        <span className="bonus-uname">{displayName}</span>
        {c.legacy && <span className="bonus-src src-legacy">{t.srcLegacy}</span>}
        {src && <span className={`bonus-src src-${src}`}>{SRC_LABEL[src]}</span>}
        {c.ruleLink?.entryName && <span className="bonus-rule-link"> ⚑</span>}
        {textLine && <div className="bonus-utext">{textLine}</div>}
      </div>
    );
  };

  const displayClass = (() => {
    if (!item.item_class) return "";
    const key = (CLASS_KEY_MAP as Record<string, string>)[item.item_class] || item.item_class;
    return language === "ch" ? (t as any)[key] || item.item_class : item.item_class;
  })();

  return (
    <>
      {React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      })}
      {visible && (
        <div
          className={`poe-tooltip ${interactive ? "interactive" : ""}`}
          style={{ top: pos.y + 15, left: pos.x + 15 }}
          onMouseEnter={cancelHide}
          onMouseLeave={handleMouseLeave}
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

          {/* Properties Section (Weapon / Defence / Drop Level) — skipped for
              unique bases, where the candidate list is what matters */}
          {!uniqueFocus && (hasWeaponStats ||
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
          {!uniqueFocus && isEquipment && hasReqs && (
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
          {!uniqueFocus && hasImplicit && (
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

          {/* Bonus / "Could be" Section (FilterBlade hover info) */}
          {hasBonus && (
            <>
              <div className="separator" />
              <div className="bonus-block">
                {flatLines.map((line, i) => (
                  <div key={i} className="bonus-text">{line}</div>
                ))}
                {flatTags.length > 0 && (
                  <div className="bonus-tags">
                    {flatTags.map((tag) => (
                      <span key={tag} className="bonus-tag">
                        {language === "ch" ? BONUS_TAG_CH[tag] || tag : tag}
                      </span>
                    ))}
                  </div>
                )}
                {candidates.length > 0 && (
                  <div className="bonus-could-be">
                    <div className="bonus-label">
                      {candidates.length === 1 ? t.bonusDropsAs : t.bonusCouldBe}:
                    </div>
                    <div className={expanded ? "bonus-all-list" : undefined}>
                      {(expanded ? candidates : candidates.slice(0, MAX_CANDIDATES)).map(renderCandidate)}
                    </div>
                    {candidates.length > MAX_CANDIDATES && (
                      <div
                        className="bonus-more clickable"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded((v) => !v);
                        }}
                      >
                        {expanded
                          ? `▲ ${language === "ch" ? "收起" : "less"}`
                          : `+${candidates.length - MAX_CANDIDATES} ${t.bonusAndMore} ▼`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ItemTooltip;
