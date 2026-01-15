import React, { useState, useMemo } from "react";
import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";

interface Rule {
  targets: string[];
  conditions: Record<string, string>;
  overrides: Record<string, any>;
  comment?: string;
  raw?: string;
}

interface RuleManagerProps {
  tierKey: string;
  allRules: Rule[];
  onGlobalRulesChange: (newRules: Rule[]) => void;
  onRuleEdit: (tierKey: string, ruleIndex: number | null) => void;
  language: Language;
  availableItems: string[];
  categoryName: string;
  translationCache: Record<string, string>; // Kept in interface but unused
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
  translationCache: _translationCache, // Unused
}) => {
  const t = useTranslation(language);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const tierRulesIndices = useMemo(() => {
    return allRules
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (r.overrides?.Tier) return r.overrides.Tier === tierKey;
        return r.targets.some((target) => availableItems.includes(target));
      })
      .map((item) => item.i);
  }, [allRules, tierKey, availableItems]);

  const handleAddRule = () => {
    if (tierRulesIndices.length > 0) {
        alert(language === 'ch' ? '每个阶级目前仅限一个附加规则' : 'Only 1 additional rule per Tier is allowed for now.');
        return;
    }
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
    <div className="tier-rule-manager">
      <div className="rule-header">
        <span className="label">🛠 {t.rules} ({tierRulesIndices.length})</span>
        <button className="mini-add-btn" onClick={handleAddRule}>+ {t.addRule}</button>
      </div>

      <div className="rules-stack">
        {tierRulesIndices.map((globalIndex) => {
          const rule = allRules[globalIndex];
          const isEditing = editingIndex === globalIndex;

          return (
            <div key={globalIndex} className={`inline-rule-card ${isEditing ? 'editing' : ''}`}>
              <div className="summary" onClick={() => setEditingAndNotify(isEditing ? null : globalIndex)}>
                <div className="rule-badge">#{globalIndex + 1}</div>
                <input 
                    className="rule-name-input"
                    value={rule.comment || ""} 
                    placeholder={language === 'ch' ? `规则备注...` : `Rule Comment...`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateRule(globalIndex, { ...rule, comment: e.target.value })}
                />
                <button className="delete-btn" title={t.deleteRule} onClick={(e) => { 
                    e.stopPropagation(); 
                    onGlobalRulesChange(allRules.filter((_, i) => i !== globalIndex)); 
                    setEditingAndNotify(null); 
                }}>×</button>
              </div>

              {isEditing && (
                <div className="details">
                  <div className="section-divider">
                    <span>{t.conditions}</span>
                  </div>


                  <div className="factors-mini-grid">
                    {Object.entries(rule.conditions).map(
                      ([key, currentVal]) => {
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
                                          {language === "ch"
                                            ? "范围"
                                            : "Between"}
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
                          {language === "ch"
                            ? "添加条件..."
                            : "Add condition..."}
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
                    <span>{t.rawText}</span>
                  </div>

                  <div className="raw-code-field">
                    <textarea
                      placeholder="# Custom lines like: 
    SetFontSize 45"
                      value={rule.raw || ""}
                      onChange={(e) =>
                        handleUpdateRule(globalIndex, {
                          ...rule,
                          raw: e.target.value,
                        })
                      }
                    />
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

        .target-manager { background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
        .target-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .target-block { display: flex; align-items: center; gap: 6px; background: white; border: 1px solid #dee2e6; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); color: #222; }
        .target-block button { background: none; border: none; padding: 0; color: #adb5bd; cursor: pointer; font-size: 1.1rem; line-height: 1; }
        .target-block button:hover { color: #ff5252; }
        
        .add-target-box { position: relative; }
        .add-target-box input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; color: #222; }
        .suggestions-pop { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #ddd; max-height: 150px; overflow-y: auto; padding: 0; list-style: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 4px; }
        .suggestions-pop li { padding: 8px 12px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid #eee; color: #222; }
        .suggestions-pop li:hover { background: #f0f7ff; color: #2196F3; }

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
      `}</style>
    </div>
  );
};

export default RuleManager;