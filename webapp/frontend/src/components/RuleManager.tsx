import React, { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";
import ItemCard from "./ItemCard";
import ContextMenu from "./ContextMenu";

interface Item {
  name: string;
  name_ch?: string;
  source: string;
  [key: string]: any;
}

interface Rule {
  targets: string[];
  targetMatchModes?: Record<string, 'exact' | 'partial'>; // New field
  conditions: Record<string, string>;
  overrides: Record<string, any>;
  comment?: string;
  raw?: string;
  disabled?: boolean;
  applyToTier?: boolean;
}

interface TierOption {
    key: string;
    label: string;
}

interface RuleManagerProps {
  tierKey: string;
  allRules: Rule[];
  onGlobalRulesChange: (newRules: Rule[]) => void;
  onRuleEdit: (tierKey: string, ruleIndex: number | null) => void;
  language: Language;
  availableItems: Item[];
  categoryName: string;
  translationCache: Record<string, string>;
  availableTiers?: TierOption[];
  activeRuleIndex?: number | null;
}

const RULE_FACTOR_LOCALIZATION: Record<string, { en: string; ch: string }> = {
  ItemLevel: { en: "Item Level", ch: "物品等级" },
  DropLevel: { en: "Drop Level", ch: "掉落等级" },
  GemLevel: { en: "Gem Level", ch: "宝石等级" },
  Quality: { en: "Quality", ch: "品质" },
  MapTier: { en: "Map Tier", ch: "地图阶级" },
  StackSize: { en: "Stack Size", ch: "堆叠数量" },
  Sockets: { en: "Sockets", ch: "插槽" },
  LinkedSockets: { en: "Links", ch: "连线" },
  Corrupted: { en: "Corrupted", ch: "已污染" },
  Mirrored: { en: "Mirrored", ch: "已复制" },
  Identified: { en: "Identified", ch: "已鉴定" },
  FracturedItem: { en: "Fractured", ch: "破碎物品" },
  SynthesisedItem: { en: "Synthesised", ch: "合成物品" },
  HasInfluence: { en: "Influence", ch: "势力" },
  BlightedMap: { en: "Blighted", ch: "菌潮" },
  BlightRavagedMap: { en: "Blight-ravaged", ch: "菌潮灭绝" },
  VaalGem: { en: "Vaal", ch: "瓦尔" },
  TransfiguredGem: { en: "Transfigured", ch: "变异" },
};

const RuleManager: React.FC<RuleManagerProps> = ({
  tierKey,
  allRules,
  onGlobalRulesChange,
  onRuleEdit,
  language,
  availableItems,
  categoryName,
  translationCache,
  availableTiers,
  activeRuleIndex
}) => {
  const t = useTranslation(language);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const ruleRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [targetSearch, setTargetSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, ruleIndex: number } | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<{ x: number, y: number, ruleIndex: number, itemName: string } | null>(null);

  const tierRulesIndices = useMemo(() => {
    return allRules
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        // 1. Must match this tier (if tier override exists) or target items in this tier
        const hasTierOverride = !!r.overrides?.Tier;
        const matchesTier = hasTierOverride ? r.overrides.Tier === tierKey : r.targets.some((target) => availableItems.some(i => i.name === target));
        if (!matchesTier) return false;

        // 2. Hide "Sound-only" rules (rules that only override sound and have no conditions/other visuals)
        const hasConditions = Object.keys(r.conditions || {}).length > 0;
        const overrideKeys = Object.keys(r.overrides || {}).filter(k => k !== 'Tier');
        
        const hasSound = overrideKeys.some(k => k.toLowerCase().includes('sound'));
        const hasVisuals = overrideKeys.some(k => ["TextColor", "BackgroundColor", "BorderColor", "PlayEffect", "MinimapIcon"].includes(k));
        
        // If it's sound-only (no conditions, no other visuals, no tier override), hide it
        if (hasSound && !hasConditions && !hasVisuals && !hasTierOverride) return false;

        return true;
      })
      .map((item) => item.i);
  }, [allRules, tierKey, availableItems]);

  const activeCount = tierRulesIndices.filter(i => !allRules[i].disabled).length;

  useEffect(() => {
      if (activeRuleIndex !== undefined && activeRuleIndex !== null) {
          setEditingIndex(activeRuleIndex);
          // Scroll into view
          setTimeout(() => {
              const el = ruleRefs.current[activeRuleIndex];
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
          }, 100);
      }
  }, [activeRuleIndex]);

  useEffect(() => {
    if (targetSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const res = await axios.get(
          `/api/search-items?q=${encodeURIComponent(
            targetSearch
          )}`
        );
        setSuggestions(res.data.results);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [targetSearch]);

  const handleAddRule = () => {
    const newRule: Rule = {
      targets: [],
      conditions: {},
      overrides: { Tier: tierKey },
      comment: ""
    };
    onGlobalRulesChange([...allRules, newRule]);
    setEditingAndNotify(allRules.length);
  };

  const handleUpdateRule = (globalIndex: number, updatedRule: Rule) => {
    const newRules = [...allRules];
    newRules[globalIndex] = updatedRule;
    onGlobalRulesChange(newRules);
    onRuleEdit(tierKey, globalIndex);
  };

  const setEditingAndNotify = (idx: number | null) => {
    setEditingIndex(idx);
    onRuleEdit(tierKey, idx);
  };

  const handleDeleteRule = (e: React.MouseEvent, globalIndex: number) => {
      e.stopPropagation();
      if (window.confirm(t.deleteRuleConfirm)) {
          onGlobalRulesChange(allRules.filter((_, i) => i !== globalIndex));
          setEditingAndNotify(null);
      }
  };
  
  const handleDeleteRuleNoConfirm = (globalIndex: number) => {
      onGlobalRulesChange(allRules.filter((_, i) => i !== globalIndex));
      setEditingAndNotify(null);
  };

  const toggleDisable = (e: React.MouseEvent, globalIndex: number) => {
      e.stopPropagation();
      const rule = allRules[globalIndex];
      handleUpdateRule(globalIndex, { ...rule, disabled: !rule.disabled });
  };

  const toggleItemMatchMode = (globalIndex: number, itemName: string) => {
      const rule = allRules[globalIndex];
      const modes = { ...(rule.targetMatchModes || {}) };
      const current = modes[itemName] || 'exact';
      modes[itemName] = current === 'exact' ? 'partial' : 'exact';
      handleUpdateRule(globalIndex, { ...rule, targetMatchModes: modes });
      setItemContextMenu(null);
  };

  const handleItemRightClick = (e: React.MouseEvent, globalIndex: number, itemName: string) => {
      e.preventDefault();
      e.stopPropagation();
      setItemContextMenu({ x: e.clientX, y: e.clientY, ruleIndex: globalIndex, itemName });
  };

  const handleMoveRule = (globalIndex: number, newTierKey: string) => {
      const rule = allRules[globalIndex];
      const newOverrides = { ...rule.overrides, Tier: newTierKey };
      handleUpdateRule(globalIndex, { ...rule, overrides: newOverrides });
      setEditingAndNotify(null); 
  };

  const handleRightClick = (e: React.MouseEvent, globalIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, ruleIndex: globalIndex });
  };

  const addTarget = (globalIndex: number, itemName: string) => {
    const rule = allRules[globalIndex];
    if (!rule.targets.includes(itemName)) {
        handleUpdateRule(globalIndex, { ...rule, targets: [...rule.targets, itemName] });
    }
    setTargetSearch('');
    setSuggestions([]);
  };

  const removeTarget = (globalIndex: number, itemName: string) => {
    const rule = allRules[globalIndex];
    handleUpdateRule(globalIndex, { ...rule, targets: rule.targets.filter(t => t !== itemName) });
  };

  const updateCondition = (globalIndex: number, key: string, value: string) => {
    const rule = allRules[globalIndex];
    const nextConditions = { ...rule.conditions };
    if (value === "") delete nextConditions[key];
    else nextConditions[key] = value;
    handleUpdateRule(globalIndex, { ...rule, conditions: nextConditions });
  };

  const addCondition = (globalIndex: number, key: string) => {
    const rule = allRules[globalIndex];
    if (rule.conditions[key] !== undefined) return;
    const isBool = ["Corrupted", "Mirrored", "Identified", "FracturedItem", "SynthesisedItem", "BlightedMap", "BlightRavagedMap", "VaalGem", "TransfiguredGem"].includes(key);
    updateCondition(globalIndex, key, isBool ? "True" : ">= 0");
  };

  const getRelevantFactors = () => {
    const cat = categoryName.toLowerCase();
    const factors = [
        { key: 'ItemLevel', label: 'Item Level' },
        { key: 'DropLevel', label: 'Drop Level' },
    ];
    if (cat.includes('gem')) {
        factors.push({ key: 'GemLevel', label: 'Gem Level' }, { key: 'Quality', label: 'Quality' });
    } else if (cat.includes('map')) {
        factors.push({ key: 'MapTier', label: 'Map Tier' }, { key: 'Quality', label: 'Quality' });
    } else if (cat.includes('currency') || cat.includes('stackable') || cat.includes('essence')) {
        factors.push({ key: 'StackSize', label: 'Stack Size' });
    } else if (cat.includes('weapon') || cat.includes('armour') || cat.includes('boots') || cat.includes('gloves') || cat.includes('helmet') || cat.includes('shield')) {
        factors.push({ key: 'Quality', label: 'Quality' }, { key: 'Sockets', label: 'Sockets' }, { key: 'LinkedSockets', label: 'Links' });
    }
    return factors;
  };

  const relevantFactors = useMemo(getRelevantFactors, [categoryName]);

  return (
    <div className="tier-rule-manager" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <div className="rule-header">
        <span className="label">🛠 {t.rules} ({activeCount}/{tierRulesIndices.length})</span>
        <button className="mini-add-btn" onClick={handleAddRule}>+ {t.addRule}</button>
      </div>

      <div className="rules-stack">
        {tierRulesIndices.map((globalIndex, localIndex) => {
          const rule = allRules[globalIndex];
          const isEditing = editingIndex === globalIndex;

          return (
            <div 
                key={globalIndex} 
                className={`inline-rule-card ${isEditing ? 'editing' : ''} ${rule.disabled ? 'disabled-card' : ''}`}
                onContextMenu={(e) => handleRightClick(e, globalIndex)}
                ref={el => { ruleRefs.current[globalIndex] = el; }}
            >
              <div className="summary" onClick={() => setEditingAndNotify(isEditing ? null : globalIndex)}>
                <div className={`rule-badge ${rule.disabled ? 'disabled-badge' : ''}`}>#{localIndex + 1}</div>
                <input 
                    className={`rule-name-input ${rule.disabled ? 'disabled-text' : ''}`}
                    value={rule.comment || ""} 
                    placeholder={t.ruleComment}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateRule(globalIndex, { ...rule, comment: e.target.value })}
                />
                <div className="rule-actions">
                    <button className="icon-btn" title={rule.disabled ? "Enable" : "Disable"} onClick={(e) => toggleDisable(e, globalIndex)}>
                        {rule.disabled ? '⚪' : '🟢'}
                    </button>
                    <button className="delete-btn" title={t.deleteRule} onClick={(e) => handleDeleteRule(e, globalIndex)}>×</button>
                </div>
              </div>

              {isEditing && (
                <div className="details">
                  <div className="section-divider">
                    <span>{t.targets}</span>
                  </div>

                  <div className="tier-apply-toggle">
                      <label className="checkbox-container">
                          <input 
                            type="checkbox" 
                            checked={!!rule.applyToTier} 
                            onChange={(e) => handleUpdateRule(globalIndex, { ...rule, applyToTier: e.target.checked })}
                          />
                          <span className="checkmark"></span>
                          <span className="toggle-label">
                              {language === 'ch' ? "应用至此阶级的所有物品" : "Apply to all items in this Tier"}
                          </span>
                      </label>
                  </div>

                  {!rule.applyToTier && (
                    <div className="target-manager">
                        <div className="target-grid">
                                                    {rule.targets.map(tName => {
                                                        const item = availableItems.find(i => i.name === tName) || { name: tName, name_ch: translationCache[tName] };
                                                        const displayItem = { ...item, rule_index: undefined };
                                                        const matchMode = rule.targetMatchModes?.[tName] || 'exact';
                                                        
                                                        return (
                                                            <ItemCard 
                                                                key={tName}
                                                                item={displayItem}
                                                                language={language}
                                                                onDelete={() => removeTarget(globalIndex, tName)}
                                                                onContextMenu={(e) => handleItemRightClick(e, globalIndex, tName)}
                                                                matchMode={matchMode}
                                                                className="compact-card"
                                                            />
                                                        );
                                                    })}
                            
                            {rule.targets.length === 0 && (
                                <div className="target-empty-hint">{t.targetTooltip}</div>
                            )}
                        </div>
                        
                        <div className="add-target-box">
                            <input 
                                type="text" 
                                placeholder={t.addItemTarget}
                                value={targetSearch}
                                onChange={e => setTargetSearch(e.target.value)}
                            />
                            {suggestions.length > 0 && (
                                <ul className="suggestions-pop">
                                    {suggestions.map(s => (
                                        <li key={s.name} onClick={() => addTarget(globalIndex, s.name)}>
                                            <ItemCard 
                                                item={s}
                                                language={language}
                                                showStagedIndicator={false}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                  )}

                  <div className="section-divider">
                    <span>{t.conditions}</span>
                  </div>

                  <div className="factors-mini-grid">
                    {Object.entries(rule.conditions).map(
                      ([key, currentVal]) => {
                        // ... (existing condition rendering)
                        const isRange = currentVal.startsWith("RANGE ");
                        const parts = isRange ? currentVal.split(" ") : [];
                        const op1 = isRange
                          ? parts[1]
                          : currentVal.match(/^[>=<!]+/)?.[0] || "";
                        const v1 = isRange
                          ? parts[2]
                          : currentVal.replace(/^[>=<!]+/, "");
                        const op2 = isRange ? parts[3] : "";
                        const v2 = isRange ? parts[4] : "";

                        const isBool =
                          ["True", "False"].includes(currentVal) ||
                          [
                            "corrupted",
                            "mirrored",
                            "identified",
                            "fractureditem",
                            "synthesiseditem",
                            "blightedmap",
                            "blightravagedmap",
                            "vaalgem",
                            "transfiguredgem",
                          ].includes(key.toLowerCase());

                        const label =
                          RULE_FACTOR_LOCALIZATION[key]?.[language] || key;

                        return (
                          <div
                            key={key}
                            className={`mini-factor ${isRange ? "range-factor" : ""}`}
                          >
                            <div className="factor-header">
                              <span>{label}</span>
                              <button
                                className="remove-factor-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCondition(globalIndex, key, "");
                                }}
                              >
                                ×
                              </button>
                            </div>
                            <div className="inputs">
                              {isBool ? (
                                <select
                                  value={currentVal || ""}
                                  onChange={(e) =>
                                    updateCondition(
                                      globalIndex,
                                      key,
                                      e.target.value
                                    )
                                  }
                                  style={{ width: "100%" }}
                                >
                                  <option value="True">Yes</option>
                                  <option value="False">No</option>
                                </select>
                              ) : (
                                <div className="op-val-pair">
                                  {!isRange ? (
                                    <>
                                      <select
                                        value={op1}
                                        onChange={(e) => {
                                          const newOp = e.target.value;
                                          if (newOp === "RANGE")
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `RANGE >= ${v1} <= 100`
                                            );
                                          else
                                            updateCondition(
                                              globalIndex,
                                              key,
                                              `${newOp}${v1}`
                                            );
                                        }}
                                      >
                                        <option value=">=">&gt;=</option>
                                        <option value="<=">&lt;=</option>
                                        <option value="==">==</option>
                                        <option value=">">&gt;</option>
                                        <option value="<">&lt;</option>
                                                                                <option value="RANGE">
                                                                                  {t.rangeBetween}
                                                                                </option>
                                                                              </select>
                                                                              <input
                                                                                type="text"
                                                                                value={v1}
                                                                                onChange={(e) =>
                                                                                  updateCondition(
                                                                                    globalIndex,
                                                                                    key,
                                                                                    `${op1}${e.target.value}`
                                                                                  )
                                                                                }
                                                                              />
                                                                            </>
                                                                          ) : (
                                                                            <div className="range-controls-row">
                                                                              <div className="range-half">
                                                                                <select
                                                                                  value={op1}
                                                                                  onChange={(e) =>
                                                                                    updateCondition(
                                                                                      globalIndex,
                                                                                      key,
                                                                                      `RANGE ${e.target.value} ${v1} ${op2} ${v2}`
                                                                                    )
                                                                                  }
                                                                                >
                                                                                  <option value=">=">&gt;=</option>
                                                                                  <option value=">">&gt;</option>
                                                                                </select>
                                                                                <input
                                                                                  type="text"
                                                                                  value={v1}
                                                                                  onChange={(e) =>
                                                                                    updateCondition(
                                                                                      globalIndex,
                                                                                      key,
                                                                                      `RANGE ${op1} ${e.target.value} ${op2} ${v2}`
                                                                                    )
                                                                                  }
                                                                                />
                                                                              </div>
                                                                              <span className="range-sep">AND</span>
                                                                              <div className="range-half">
                                                                                <select
                                                                                  value={op2}
                                                                                  onChange={(e) =>
                                                                                    updateCondition(
                                                                                      globalIndex,
                                                                                      key,
                                                                                      `RANGE ${op1} ${v1} ${e.target.value} ${v2}`
                                                                                    )
                                                                                  }
                                                                                >
                                                                                  <option value="<=">&lt;=</option>
                                                                                  <option value="<">&lt;</option>
                                                                                </select>
                                                                                <input
                                                                                  type="text"
                                                                                  value={v2}
                                                                                  onChange={(e) =>
                                                                                    updateCondition(
                                                                                      globalIndex,
                                                                                      key,
                                                                                      `RANGE ${op1} ${v1} ${op2} ${e.target.value}`
                                                                                    )
                                                                                  }
                                                                                />
                                                                              </div>
                                                                              <button
                                                                                className="range-back-btn"
                                                                                onClick={() =>
                                                                                  updateCondition(
                                                                                    globalIndex,
                                                                                    key,
                                                                                    `>= ${v1}`
                                                                                  )
                                                                                }
                                                                              >
                                                                                ×
                                                                              </button>
                                                                            </div>
                                                                          )}
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  </div>
                                                                );
                                                              }
                                                            )}
                                        
                                                            <div className="mini-factor add-condition-card">
                                                              <span>+ {t.conditions}</span>
                                                              <select
                                                                value=""
                                                                onChange={(e) =>
                                                                  addCondition(globalIndex, e.target.value)
                                                                }
                                                                className="add-cond-select"
                                                              >
                                                                <option value="" disabled>
                                                                  {t.addItemTarget}
                                                                </option>
                                                                {relevantFactors
                                                                  .filter((f) => rule.conditions[f.key] === undefined)
                                                                  .map((f) => (
                                                                    <option key={f.key} value={f.key}>
                                                                      {RULE_FACTOR_LOCALIZATION[f.key]?.[language] ||
                                                                        f.label}
                                                                    </option>
                                                                  ))}
                                                              </select>
                                                            </div>
                                                          </div>
                                        
                                                          <div className="section-divider">
                                                            <span>{t.themeOverrides}</span>
                                                          </div>
                                        
                                                          <div className="theme-overrides-grid">
                                                            {["TextColor", "BackgroundColor", "BorderColor"].map(key => {
                                                                const label = key === "TextColor" ? t.text : key === "BackgroundColor" ? t.background : t.border;
                                                                const hexToRgba = (hex: string) => `${hex}ff`;
                                                                const rgbaToHex = (rgba: string) => rgba?.startsWith("disabled:") ? rgba.split(":")[1].substring(0, 7) : (rgba?.substring(0, 7) || "#000000");
                                                                const val = rule.overrides?.[key];
                                                                const isActive = !!val && !val.startsWith("disabled:");
                                        
                                                                return (
                                                                    <div key={key} className="color-override-item">
                                                                        <label>{label}</label>
                                                                        <div className="color-input-group">
                                                                            <input 
                                                                                type="color" 
                                                                                value={rgbaToHex(val)} 
                                                                                disabled={!isActive}
                                                                                onChange={(e) => {
                                                                                    const newOverrides = { ...rule.overrides, [key]: hexToRgba(e.target.value) };
                                                                                    handleUpdateRule(globalIndex, { ...rule, overrides: newOverrides });
                                                                                }}
                                                                            />
                                                                            <button 
                                                                                className={`toggle-override-btn ${isActive ? 'active' : ''}`}
                                                                                onClick={() => {
                                                                                    const nextOverrides = { ...rule.overrides };
                                                                                    if (isActive) delete nextOverrides[key];
                                                                                    else nextOverrides[key] = key === "BackgroundColor" ? "#000000ff" : "#ffffffff";
                                                                                    handleUpdateRule(globalIndex, { ...rule, overrides: nextOverrides });
                                                                                }}
                                                                            >
                                                                                {isActive ? "ON" : "OFF"}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                          </div>
                                        
                                                          <div className="section-divider">
                                                            <span>{t.rawText}</span>
                                                          </div>
                                        
                                                          <div className="raw-code-field">
                                                            <textarea
                                                              placeholder="# Custom lines like: \n    SetFontSize 45"
                                                              value={rule.raw || ""}
                                                              onChange={(e) =>
                                                                handleUpdateRule(globalIndex, {
                                                                  ...rule,
                                                                  raw: e.target.value,
                                                                })
                                                              }
                                                            />
                                                          </div>
                                        
                                                          <div className="section-divider">
                                                            <span>{t.actions}</span>
                                                          </div>
                                                          <div className="actions-row">
                                                              {availableTiers && (
                                                                  <div className="move-control">
                                                                      <label>{t.moveTo}</label>
                                                                      <select 
                                                                        value={rule.overrides?.Tier || tierKey}
                                                                        onChange={(e) => handleMoveRule(globalIndex, e.target.value)}
                                                                        className="tier-select"
                                                                      >
                                                                          {availableTiers.map(t => (
                                                                              <option key={t.key} value={t.key}>{t.label}</option>
                                                                          ))}
                                                                      </select>
                                                                  </div>
                                                              )}
                                                          </div>
                                        
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .tier-rule-manager { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ddd; }
        .rule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .mini-add-btn { background: #e3f2fd; color: #222 !important; border: 1px solid #2196F3; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; }
        
        .inline-rule-card { border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; margin-bottom: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .inline-rule-card.editing { border-color: #2196F3; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15); }
        
        .summary { padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 12px; background: #fcfcfc; }
        .rule-badge { background: #eee; color: #666; font-size: 0.7rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
        
        .rule-name-input { 
            flex: 1; 
            background: transparent; 
            border: 1px solid transparent; 
            font-size: 0.9rem; 
            color: #222; 
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .rule-name-input:hover { background: rgba(0,0,0,0.03); }
        .rule-name-input:focus { background: white; border-color: #ddd; outline: none; }

        .details { padding: 15px; border-top: 1px solid #f0f0f0; display: flex; flex-direction: column; gap: 15px; }
        .field label { font-size: 0.7rem; color: #999; font-weight: bold; text-transform: uppercase; }
        .field input { padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 0.85rem; color: #222; background: #fff; }
        
        .label-with-tooltip { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
        .tooltip-icon { 
            display: inline-flex; width: 14px; height: 14px; 
            background: #bbb; color: white; border-radius: 50%; 
            align-items: center; justify-content: center; 
            font-size: 10px; cursor: help; 
        }

        .section-divider { display: flex; align-items: center; gap: 10px; margin: 5px 0; }
        .section-divider span { font-size: 0.7rem; color: #bbb; font-weight: bold; text-transform: uppercase; white-space: nowrap; }
        .section-divider::after { content: ""; height: 1px; background: #eee; width: 100%; }

        .target-manager { background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 12px; }
        .target-grid { display: flex; flex-wrap: wrap; gap: 8px; min-height: 20px; }
        .target-empty-hint { font-size: 0.75rem; color: #999; font-style: italic; line-height: 1.4; }
        .target-class-hint { font-size: 0.8rem; color: #2196F3; font-weight: bold; background: #e3f2fd; padding: 8px 12px; border-radius: 4px; width: 100%; border: 1px dashed #2196F3; }
        
        .compact-card { min-width: 140px; max-width: 200px; padding: 6px 10px; }

        .add-target-box { position: relative; }
        .add-target-box input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; background: #fff; box-sizing: border-box; }
        .add-target-box input:focus { border-color: #2196F3; outline: none; }
        
        .suggestions-pop { 
            position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; 
            background: white; border: 1px solid #ddd; border-radius: 6px;
            max-height: 250px; overflow-y: auto; padding: 5px; list-style: none; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        }
        .suggestions-pop li { padding: 2px; cursor: pointer; }
        .suggestions-pop li:hover { background: #f0f7ff; }

        .factors-mini-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .mini-factor { display: flex; flex-direction: column; gap: 4px; background: #fcfcfc; padding: 8px; border-radius: 4px; border: 1px solid #f0f0f0; }
        .mini-factor.range-factor { grid-column: span 2; }
        .factor-header { display: flex; justify-content: space-between; align-items: center; }
        .mini-factor span { font-size: 0.75rem; color: #555; font-weight: bold; }
        .remove-factor-btn { background: none; border: none; color: #ccc; cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0; transition: color 0.2s; }
        .remove-factor-btn:hover { color: #ff5252; }
        
        .add-condition-card { border-style: dashed; background: #fff; cursor: pointer; justify-content: center; min-width: 180px; }
        .add-condition-card:hover { border-color: #2196F3; }
        .add-cond-select { background: none; border: none; font-size: 0.75rem; color: #2196F3 !important; font-weight: bold; cursor: pointer; outline: none; width: 100%; }

        .op-val-pair { display: flex; gap: 4px; flex: 1; }
        .op-val-pair select { flex: 0 0 80px; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        .op-val-pair input { flex: 1; width: 100%; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        
        .range-controls-row { display: flex; align-items: center; gap: 10px; flex: 1; }
        .range-half { display: flex; gap: 4px; flex: 1; }
        .range-half select { flex: 0 0 60px; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        .range-half input { flex: 1; min-width: 40px; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }
        .range-sep { font-size: 0.7rem; color: #999; font-weight: bold; }
        .range-back-btn { background: none; border: none; color: #bbb; cursor: pointer; font-size: 1rem; }
        .range-back-btn:hover { color: #2196F3; }

        .mini-factor select { padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; color: #222; background: #fff; }

        .raw-code-field textarea {
            width: 100%;
            height: 100px;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 12px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.8rem;
            border: 1px solid #333;
            border-radius: 6px;
            resize: vertical;
            line-height: 1.5;
        }
        
        .delete-btn { background: none; border: none; color: #ff5252; cursor: pointer; font-size: 1.4rem; opacity: 0.6; transition: opacity 0.2s; }
        .delete-btn:hover { opacity: 1; }

        .disabled-card { opacity: 0.6; background: #f5f5f5; }
        .disabled-badge { background: #ccc; color: #888; }
        .disabled-text { color: #aaa; text-decoration: line-through; }
        .rule-actions { display: flex; align-items: center; gap: 8px; }
        .icon-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; padding: 0; opacity: 0.8; }
        .icon-btn:hover { opacity: 1; }
        .move-control { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; width: 100%; }
        .tier-select { padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; flex-grow: 1; max-width: 250px; }
        .actions-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }

        .tier-apply-toggle { margin-bottom: 10px; padding: 5px 0; }
        .checkbox-container { display: flex; align-items: center; cursor: pointer; font-size: 0.85rem; user-select: none; gap: 10px; }
        .checkbox-container input { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }
        .checkmark { height: 18px; width: 18px; background-color: #eee; border-radius: 4px; border: 1px solid #ddd; transition: all 0.2s; position: relative; }
        .checkbox-container:hover input ~ .checkmark { background-color: #ccc; }
        .checkbox-container input:checked ~ .checkmark { background-color: #2196F3; border-color: #2196F3; }
        .checkmark:after { content: ""; position: absolute; display: none; left: 6px; top: 2px; width: 4px; height: 9px; border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); }
        .checkbox-container input:checked ~ .checkmark:after { display: block; }
        .toggle-label { font-weight: 600; color: #444; }

        .theme-overrides-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; background: #fdfdfd; padding: 12px; border-radius: 6px; border: 1px solid #f0f0f0; }
        .color-override-item { display: flex; flex-direction: column; gap: 6px; }
        .color-override-item label { font-size: 0.7rem; color: #888; font-weight: bold; text-transform: uppercase; }
        .color-input-group { display: flex; align-items: center; gap: 8px; }
        .color-input-group input[type="color"] { width: 40px; height: 28px; padding: 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; }
        .color-input-group input[type="color"]:disabled { opacity: 0.3; cursor: not-allowed; }
        
        .toggle-override-btn { 
            padding: 4px 10px; font-size: 0.7rem; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; 
            font-weight: bold; transition: all 0.2s; background: #f5f5f5; color: #999;
        }
        .toggle-override-btn.active { background: #2196F3; color: white; border-color: #2196F3; }
      `}</style>
      
      {contextMenu && (
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            options={[
                {
                    label: allRules[contextMenu.ruleIndex].disabled ? t.enableRule : t.disableRule,
                    onClick: () => {
                        const rule = allRules[contextMenu.ruleIndex];
                        handleUpdateRule(contextMenu.ruleIndex, { ...rule, disabled: !rule.disabled });
                    }
                },
                { divider: true, label: '', onClick: () => {} },
                ...(availableTiers || []).map(tier => ({
                    label: `${t.moveTo} ${tier.label}`,
                    onClick: () => handleMoveRule(contextMenu.ruleIndex, tier.key)
                })),
                { divider: true, label: '', onClick: () => {} },
                {
                    label: t.deleteRuleLabel,
                    onClick: () => handleDeleteRuleNoConfirm(contextMenu.ruleIndex),
                    className: "delete-option"
                }
            ]}
        />
      )}

      {itemContextMenu && (
        <ContextMenu
            x={itemContextMenu.x}
            y={itemContextMenu.y}
            onClose={() => setItemContextMenu(null)}
            options={[
                {
                    label: (allRules[itemContextMenu.ruleIndex].targetMatchModes?.[itemContextMenu.itemName] || 'exact') === 'exact' 
                        ? (language === 'ch' ? "切换为模糊匹配" : "Switch to Partial Match")
                        : (language === 'ch' ? "切换为精确匹配" : "Switch to Exact Match"),
                    onClick: () => toggleItemMatchMode(itemContextMenu.ruleIndex, itemContextMenu.itemName)
                }
            ]}
        />
      )}
    </div>
  );
};

export default RuleManager;
