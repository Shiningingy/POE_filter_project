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
  availableItems: string[]; // Items currently in this tier (for suggestions)
}

const RuleManager: React.FC<RuleManagerProps> = ({ 
  tierKey, 
  allRules, 
  onGlobalRulesChange, 
  language, 
  availableItems 
}) => {
  const t = useTranslation(language);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Filter rules that belong to this tier. 
  // We identify them by checking overrides.Tier or if target items belong to this tier.
  // For simplicity in this UI, we'll assume a rule "belongs" to a tier if it's explicitly set in overrides
  // OR if we are creating it from this Tier's UI.
  const tierRulesIndices = useMemo(() => {
    return allRules.map((r, i) => ({ r, i })).filter(({ r }) => {
        // If the rule has a Tier override, it belongs to that tier's UI
        if (r.overrides?.Tier) return r.overrides.Tier === tierKey;
        // Otherwise, if any of its targets are in the 'availableItems' for this tier
        return r.targets.some(target => availableItems.includes(target));
    }).map(item => item.i);
  }, [allRules, tierKey, availableItems]);

  const handleAddRule = () => {
    const newRule: Rule = {
      targets: [],
      conditions: {},
      overrides: { Tier: tierKey }, // Explicitly bind to this tier
      comment: "New " + tierKey + " Rule"
    };
    onGlobalRulesChange([...allRules, newRule]);
    setEditingIndex(allRules.length);
  };

  const handleDeleteRule = (globalIndex: number) => {
    const newRules = allRules.filter((_, i) => i !== globalIndex);
    onGlobalRulesChange(newRules);
    setEditingIndex(null);
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

  const POE_FACTORS = [
    { key: 'ItemLevel', label: 'Item Level' },
    { key: 'DropLevel', label: 'Drop Level' },
    { key: 'Quality', label: 'Quality' },
    { key: 'GemLevel', label: 'Gem Level' },
    { key: 'StackSize', label: 'Stack Size' },
  ];

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
                <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteRule(globalIndex); }}>×</button>
              </div>

              {isEditing && (
                <div className="details">
                  <div className="field">
                    <label>{t.targets}</label>
                    <input 
                      type="text"
                      placeholder="Item names (comma separated)..."
                      value={rule.targets.join(', ')} 
                      onChange={e => handleUpdateRule(globalIndex, { ...rule, targets: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                    />
                  </div>

                  <div className="factors-mini-grid">
                    {POE_FACTORS.map(f => {
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
        .mini-add-btn:hover { background: #2196F3; color: white; }
        
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
        .mini-factor select { padding: 2px; font-size: 0.75rem; width: 50px; }
        .mini-factor input { padding: 2px; font-size: 0.75rem; width: 40px; }
      `}</style>
    </div>
  );
};

export default RuleManager;
