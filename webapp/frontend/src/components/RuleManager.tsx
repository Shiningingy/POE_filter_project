import React, { useState, useMemo } from 'react';
import { useTranslation } from '../utils/localization';
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
  categoryName: string; // New prop to determine context
}

const RuleManager: React.FC<RuleManagerProps> = ({ 
  tierKey, 
  allRules, 
  onGlobalRulesChange, 
  language, 
  availableItems,
  categoryName
}) => {
  const t = useTranslation(language);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const tierRulesIndices = useMemo(() => {
    return allRules.map((r, i) => ({ r, i })).filter(({ r }) => {
        if (r.overrides?.Tier) return r.overrides.Tier === tierKey;
        return r.targets.some(target => availableItems.includes(target));
    }).map(item => item.i);
  }, [allRules, tierKey, availableItems]);

  const handleAddRule = () => {
    const newRule: Rule = {
      targets: [],
      conditions: {},
      overrides: { Tier: tierKey },
      comment: "New Rule"
    };
    onGlobalRulesChange([...allRules, newRule]);
    setEditingIndex(allRules.length);
  };

  const handleUpdateRule = (globalIndex: number, updatedRule: Rule) => {
    const newRules = [...allRules];
    newRules[globalIndex] = updatedRule;
    onGlobalRulesChange(newRules);
  };

  const updateCondition = (globalIndex: number, key: string, value: string) => {
    const rule = allRules[globalIndex];
    const nextConditions = { ...rule.conditions };
    if (value === "") delete nextConditions[key];
    else nextConditions[key] = value;
    handleUpdateRule(globalIndex, { ...rule, conditions: nextConditions });
  };

  // Define Factor Sets based on Documentation
  const getRelevantFactors = () => {
    const cat = categoryName.toLowerCase();
    const factors = [
        { key: 'ItemLevel', label: 'Item Level' },
        { key: 'DropLevel', label: 'Drop Level' },
    ];

    if (cat.includes('gem')) {
        factors.push({ key: 'GemLevel', label: 'Gem Level' });
        factors.push({ key: 'Quality', label: 'Quality' });
    } else if (cat.includes('map')) {
        factors.push({ key: 'MapTier', label: 'Map Tier' });
        factors.push({ key: 'Quality', label: 'Quality' });
    } else if (cat.includes('currency') || cat.includes('stackable') || cat.includes('essence')) {
        factors.push({ key: 'StackSize', label: 'Stack Size' });
    } else if (cat.includes('weapon') || cat.includes('armour') || cat.includes('boots') || cat.includes('gloves') || cat.includes('helmet') || cat.includes('shield')) {
        factors.push({ key: 'Quality', label: 'Quality' });
        factors.push({ key: 'Sockets', label: 'Sockets' });
        factors.push({ key: 'LinkedSockets', label: 'Links' });
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
                <span className="comment">{rule.comment || `Rule ${globalIndex + 1}`}</span>
                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onGlobalRulesChange(allRules.filter((_, i) => i !== globalIndex)); setEditingIndex(null); }}>×</button>
              </div>

              {isEditing && (
                <div className="details">
                  <div className="field">
                    <label>{t.targets}</label>
                    <input 
                      type="text"
                      placeholder="Item names..."
                      value={rule.targets.join(', ')} 
                      onChange={e => handleUpdateRule(globalIndex, { ...rule, targets: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                    />
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
                    
                    {/* Common Booleans */}
                    <div className="mini-factor">
                        <span>Corrupted</span>
                        <select value={rule.conditions["Corrupted"] || ""} onChange={e => updateCondition(globalIndex, "Corrupted", e.target.value)}>
                            <option value="">Any</option>
                            <option value="True">Yes</option>
                            <option value="False">No</option>
                        </select>
                    </div>

                    {(categoryName.toLowerCase().includes('weapon') || categoryName.toLowerCase().includes('armour') || categoryName.toLowerCase().includes('jewellery')) && (
                        <div className="mini-factor">
                            <span>Influence</span>
                            <select value={rule.conditions["HasInfluence"] || ""} onChange={e => updateCondition(globalIndex, "HasInfluence", e.target.value)}>
                                <option value="">None</option>
                                <option value="Shaper">Shaper</option>
                                <option value="Elder">Elder</option>
                                <option value="Crusader">Crusader</option>
                                <option value="Redeemer">Redeemer</option>
                                <option value="Hunter">Hunter</option>
                                <option value="Warlord">Warlord</option>
                            </select>
                        </div>
                    )}
                  </div>
                  
                  <div className="field">
                    <label>{t.comment}</label>
                    <input type="text" value={rule.comment} onChange={e => handleUpdateRule(globalIndex, { ...rule, comment: e.target.value })} />
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
        .rule-header .label { font-size: 0.85rem; font-weight: bold; color: #777; }
        .mini-add-btn { background: #e3f2fd; color: #2196F3; border: 1px solid #2196F3; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
        
        .rules-stack { display: flex; flex-direction: column; gap: 5px; }
        .inline-rule-card { border: 1px solid #eee; border-radius: 4px; background: #fafafa; }
        .inline-rule-card.editing { border-color: #2196F3; background: white; }
        .summary { padding: 6px 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .summary .comment { font-size: 0.85rem; color: #444; }
        .delete-btn { background: none; border: none; color: #ff5252; cursor: pointer; font-size: 1.2rem; line-height: 1; }
        
        .details { padding: 10px; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 8px; }
        .field { display: flex; flex-direction: column; gap: 3px; }
        .field label { font-size: 0.7rem; color: #999; font-weight: bold; text-transform: uppercase; }
        .field input { padding: 5px; border: 1px solid #ddd; border-radius: 3px; font-size: 0.85rem; }
        
        .factors-mini-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f0f0f0; padding: 8px; border-radius: 4px; }
        .mini-factor { display: flex; flex-direction: column; gap: 2px; }
        .mini-factor span { font-size: 0.65rem; color: #666; font-weight: bold; }
        .mini-factor .inputs { display: flex; gap: 2px; }
        .mini-factor select { padding: 2px; font-size: 0.75rem; width: 60px; border: 1px solid #ccc; border-radius: 2px; }
        .mini-factor input { padding: 2px; font-size: 0.75rem; width: 40px; border: 1px solid #ccc; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default RuleManager;