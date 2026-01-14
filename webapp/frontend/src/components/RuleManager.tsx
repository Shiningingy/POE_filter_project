import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useTranslation, getItemName } from '../utils/localization';
import type { Language } from '../utils/localization';

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
  translationCache: Record<string, string>;
}

const RULE_FACTOR_LOCALIZATION: Record<string, { en: string, ch: string }> = {
    'ItemLevel': { en: 'Item Level', ch: '物品等级' },
    'DropLevel': { en: 'Drop Level', ch: '掉落等级' },
    'GemLevel': { en: 'Gem Level', ch: '宝石等级' },
    'Quality': { en: 'Quality', ch: '品质' },
    'MapTier': { en: 'Map Tier', ch: '地图阶级' },
    'StackSize': { en: 'Stack Size', ch: '堆叠数量' },
    'Sockets': { en: 'Sockets', ch: '插槽' },
    'LinkedSockets': { en: 'Links', ch: '连线' },
    'Corrupted': { en: 'Corrupted', ch: '已污染' },
    'Mirrored': { en: 'Mirrored', ch: '已复制' },
    'Identified': { en: 'Identified', ch: '已鉴定' },
    'FracturedItem': { en: 'Fractured', ch: '破碎物品' },
    'SynthesisedItem': { en: 'Synthesised', ch: '合成物品' },
    'HasInfluence': { en: 'Influence', ch: '势力' },
    'BlightedMap': { en: 'Blighted', ch: '菌潮' },
    'BlightRavagedMap': { en: 'Blight-ravaged', ch: '菌潮灭绝' },
    'VaalGem': { en: 'Vaal', ch: '瓦尔' },
    'TransfiguredGem': { en: 'Transfigured', ch: '变异' },
};

const RuleManager: React.FC<RuleManagerProps> = ({
  tierKey, 
  allRules, 
  onGlobalRulesChange, 
  onRuleEdit,
  language, 
  availableItems,
  categoryName,
  translationCache
}) => {
  const t = useTranslation(language);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const [targetSearch, setTargetSearch] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const tierRulesIndices = useMemo(() => {
    return allRules.map((r, i) => ({ r, i })).filter(({ r }) => {
        if (r.overrides?.Tier) return r.overrides.Tier === tierKey;
        return r.targets.some(target => availableItems.includes(target));
    }).map(item => item.i);
  }, [allRules, tierKey, availableItems]);

  useEffect(() => {
    if (targetSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const res = await axios.get(`http://localhost:8000/api/search-items?q=${encodeURIComponent(targetSearch)}`);
        setSuggestions(res.data.results);
      } catch (e) { console.error(e); }
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

  const getAllFactorsForSelection = (ruleConditions: Record<string, string>) => {
    const factorKeys = new Set(relevantFactors.map(f => f.key));
    Object.keys(ruleConditions).forEach(k => factorKeys.add(k));
    
    return Array.from(factorKeys).map(key => {
        const standard = relevantFactors.find(f => f.key === key);
        const loc = RULE_FACTOR_LOCALIZATION[key];
        return { 
            key, 
            label: loc ? loc[language] : (standard?.label || key) 
        };
    });
  };

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
                  <div className="field">
                    <div className="label-with-tooltip">
                        <label>{t.targets}</label>
                        <div className="tooltip-icon" title={t.targetTooltip}>?</div>
                    </div>
                    
                    <div className="target-manager">
                        <div className="target-grid">
                            {rule.targets.map(target => (
                                <div key={target} className="target-block">
                                    <span>{getItemName({ name: target, name_ch: translationCache[target] }, language)}</span>
                                    <button onClick={() => removeTarget(globalIndex, target)}>×</button>
                                </div>
                            ))}
                        </div>
                        <div className="add-target-box">
                            <input 
                                type="text" 
                                placeholder={t.searchPlaceholder}
                                value={targetSearch}
                                onChange={e => setTargetSearch(e.target.value)}
                            />
                            {suggestions.length > 0 && (
                                <ul className="suggestions-pop">
                                    {suggestions.map(s => (
                                        <li key={s.name} onClick={() => addTarget(globalIndex, s.name)}>
                                            {getItemName(s, language)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                  </div>

                  <div className="section-divider">
                    <span>{t.conditions}</span>
                  </div>

                  <div className="factors-mini-grid">
                    {getAllFactorsForSelection(rule.conditions).map(f => {
                        const currentVal = rule.conditions[f.key] || "";
                        const operator = currentVal.match(/^[>=<!]+/)?.[0] || "";
                        const num = currentVal.replace(/^[>=<!]+/, "");
                        
                        const isBool = ["True", "False"].includes(currentVal) || 
                                     ["corrupted", "mirrored", "identified", "fractureditem", "synthesiseditem", "blightedmap", "blightravagedmap", "vaalgem", "transfiguredgem"].includes(f.key.toLowerCase());

                        return (
                            <div key={f.key} className="mini-factor">
                                <div className="factor-header">
                                    <span>{f.label}</span>
                                    <button className="remove-factor-btn" onClick={() => updateCondition(globalIndex, f.key, "")}>×</button>
                                </div>
                                <div className="inputs">
                                    {isBool ? (
                                        <select 
                                            value={rule.conditions[f.key] || ""} 
                                            onChange={e => updateCondition(globalIndex, f.key, e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="">Any</option>
                                            <option value="True">Yes</option>
                                            <option value="False">No</option>
                                        </select>
                                    ) : (
                                        <div className="op-val-pair">
                                            <select value={operator} onChange={e => updateCondition(globalIndex, f.key, `${e.target.value}${num}`)}>
                                                <option value="">Off</option>
                                                <option value=">=">&gt;=</option>
                                                <option value="<=">&lt;=</option>
                                                <option value="==">==</option>
                                            </select>
                                            <input 
                                                type="text" 
                                                value={num} 
                                                onChange={e => updateCondition(globalIndex, f.key, `${operator}${e.target.value}`)} 
                                            />
                                        </div>
                                    )}
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
                        placeholder="# Custom lines like: 
    SetFontSize 45"
                        value={rule.raw || ""} 
                        onChange={e => handleUpdateRule(globalIndex, { ...rule, raw: e.target.value })}
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
        .mini-add-btn { background: #e3f2fd; color: #2196F3; border: 1px solid #2196F3; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; }
        
        .inline-rule-card { border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; margin-bottom: 10px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .inline-rule-card.editing { border-color: #2196F3; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15); }
        
        .summary { padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 12px; background: #fcfcfc; }
        .rule-badge { background: #eee; color: #666; font-size: 0.7rem; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
        
        .rule-name-input { 
            flex: 1; 
            background: transparent; 
            border: 1px solid transparent; 
            font-size: 0.9rem; 
            color: #333; 
            font-weight: 600;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .rule-name-input:hover { background: rgba(0,0,0,0.03); }
        .rule-name-input:focus { background: white; border-color: #ddd; outline: none; }

        .details { padding: 15px; border-top: 1px solid #f0f0f0; display: flex; flex-direction: column; gap: 15px; }
        
        .section-divider { display: flex; align-items: center; gap: 10px; margin: 5px 0; }
        .section-divider span { font-size: 0.7rem; color: #bbb; font-weight: bold; text-transform: uppercase; white-space: nowrap; }
        .section-divider::after { content: ""; height: 1px; background: #eee; width: 100%; }

        .label-with-tooltip { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
        .tooltip-icon { 
            display: inline-flex; width: 14px; height: 14px; 
            background: #bbb; color: white; border-radius: 50%; 
            align-items: center; justify-content: center; 
            font-size: 10px; cursor: help; 
        }

        .target-manager { background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
        .target-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .target-block { display: flex; align-items: center; gap: 6px; background: white; border: 1px solid #dee2e6; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .target-block button { background: none; border: none; padding: 0; color: #adb5bd; cursor: pointer; font-size: 1.1rem; line-height: 1; }
        .target-block button:hover { color: #fa5252; }
        
        .add-target-box { position: relative; }
        .add-target-box input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; }
        .suggestions-pop { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #ddd; max-height: 150px; overflow-y: auto; padding: 0; list-style: none; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 4px; }
        .suggestions-pop li { padding: 8px 12px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid #eee; }
        .suggestions-pop li:hover { background: #f0f7ff; color: #2196F3; }

        .factors-mini-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .mini-factor { display: flex; flex-direction: column; gap: 4px; background: #fcfcfc; padding: 8px; border-radius: 4px; border: 1px solid #f0f0f0; }
        .factor-header { display: flex; justify-content: space-between; align-items: center; }
        .mini-factor span { font-size: 0.75rem; color: #555; font-weight: bold; }
        .remove-factor-btn { background: none; border: none; color: #ccc; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0; transition: color 0.2s; }
        .remove-factor-btn:hover { color: #ff5252; }
        
        .op-val-pair { display: flex; gap: 4px; }
        .op-val-pair select { flex: 0 0 60px; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; }
        .op-val-pair input { flex: 1; width: 100%; padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; }
        
        .mini-factor select { padding: 4px; font-size: 0.8rem; border: 1px solid #ddd; border-radius: 4px; }

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