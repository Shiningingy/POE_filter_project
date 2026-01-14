import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useTranslation, getItemName } from '../utils/localization';
import type { Language } from '../utils/localization';

interface Rule {
  targets: string[];
  conditions: Record<string, string>;
  overrides: Record<string, any>;
  comment?: string;
}

interface RuleManagerProps {
  tierKey: string;
  allRules: Rule[];
  onGlobalRulesChange: (newRules: Rule[]) => void;
  language: Language;
  availableItems: string[]; 
  categoryName: string;
  translationCache: Record<string, string>;
}

const RuleManager: React.FC<RuleManagerProps> = ({ 
  tierKey, 
  allRules, 
  onGlobalRulesChange, 
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
    setEditingIndex(allRules.length);
  };

  const handleUpdateRule = (globalIndex: number, updatedRule: Rule) => {
    const newRules = [...allRules];
    newRules[globalIndex] = updatedRule;
    onGlobalRulesChange(newRules);
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
              <div className="summary" onClick={() => setEditingIndex(isEditing ? null : globalIndex)}>
                <input 
                    className="rule-name-input"
                    value={rule.comment || ""} 
                    placeholder={language === 'ch' ? `规则 ${globalIndex + 1}` : `Rule ${globalIndex + 1}`}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleUpdateRule(globalIndex, { ...rule, comment: e.target.value })}
                />
                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onGlobalRulesChange(allRules.filter((_, i) => i !== globalIndex)); setEditingIndex(null); }}>×</button>
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

                  <div className="factors-mini-grid">
                    {relevantFactors.map(f => {
                        const currentVal = rule.conditions[f.key] || "";
                        const operator = currentVal.match(/^[>=<!]+/)?.[0] || "";
                        const num = currentVal.replace(/^[>=<!]+/, "");
                        return (
                            <div key={f.key} className="mini-factor">
                                <span>{f.label}</span>
                                <div className="inputs">
                                    <select value={operator} onChange={e => updateCondition(globalIndex, f.key, `${e.target.value}${num}`)}>
                                        <option value="">Off</option>
                                        <option value=">=">&gt;=</option>
                                        <option value="<=">&lt;=</option>
                                        <option value="==">==</option>
                                    </select>
                                    <input type="number" value={num} onChange={e => updateCondition(globalIndex, f.key, `${operator}${e.target.value}`)} />
                                </div>
                            </div>
                        );
                    })}
                    <div className="mini-factor">
                        <span>Corrupted</span>
                        <select value={rule.conditions["Corrupted"] || ""} onChange={e => updateCondition(globalIndex, "Corrupted", e.target.value)}>
                            <option value="">Any</option><option value="True">Yes</option><option value="False">No</option>
                        </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .tier-rule-manager { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ddd; }
        .rule-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .mini-add-btn { background: #e3f2fd; color: #2196F3; border: 1px solid #2196F3; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
        .inline-rule-card { border: 1px solid #eee; border-radius: 4px; background: #fafafa; margin-bottom: 5px; }
        .inline-rule-card.editing { border-color: #2196F3; background: white; }
        .summary { padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; gap: 10px; }
        
        .rule-name-input { 
            flex: 1; 
            background: transparent; 
            border: 1px solid transparent; 
            font-size: 0.85rem; 
            color: #444; 
            font-weight: 600;
            padding: 2px 5px;
            border-radius: 3px;
        }
        .rule-name-input:hover { background: rgba(0,0,0,0.05); border-color: #ddd; }
        .rule-name-input:focus { background: white; border-color: #2196F3; outline: none; }

        .details { padding: 10px; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 10px; }
        .field label { font-size: 0.7rem; color: #999; font-weight: bold; text-transform: uppercase; }
        .field input { padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 0.85rem; }
        
        .label-with-tooltip { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
        .tooltip-icon { width: 14px; height: 14px; background: #bbb; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; cursor: help; }
        
        .target-manager { background: #f1f3f5; padding: 8px; border-radius: 4px; }
        .target-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
        .target-block { display: flex; align-items: center; gap: 5px; background: white; border: 1px solid #dee2e6; padding: 2px 8px; border-radius: 3px; font-size: 0.75rem; }
        .target-block button { background: none; border: none; padding: 0; color: #adb5bd; cursor: pointer; font-size: 1rem; }
        .target-block button:hover { color: #fa5252; }
        
        .add-target-box { position: relative; }
        .add-target-box input { width: 100%; border-color: #28a745; }
        .suggestions-pop { position: absolute; top: 100%; left: 0; right: 0; z-index: 100; background: white; border: 1px solid #ddd; max-height: 120px; overflow-y: auto; padding: 0; list-style: none; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .suggestions-pop li { padding: 5px 10px; cursor: pointer; font-size: 0.8rem; border-bottom: 1px solid #eee; }
        .suggestions-pop li:hover { background: #f8f9fa; }

        .factors-mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8f9fa; padding: 8px; border-radius: 4px; border: 1px solid #eee; }
        .mini-factor { display: flex; flex-direction: column; gap: 2px; }
        .mini-factor span { font-size: 0.65rem; color: #666; font-weight: bold; }
        .mini-factor .inputs { display: flex; gap: 2px; }
        .mini-factor select { padding: 2px; font-size: 0.75rem; width: 60px; }
        .mini-factor input { padding: 2px; font-size: 0.75rem; width: 40px; }
        .delete-btn { background: none; border: none; color: #ff5252; cursor: pointer; font-size: 1.2rem; line-height: 1; }
      `}</style>
    </div>
  );
};

export default RuleManager;
