import React, { useState } from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface Rule {
  targets: string[];
  conditions: Record<string, string>;
  overrides: Record<string, any>;
  comment?: string;
}

interface RuleManagerProps {
  rules: Rule[];
  onChange: (newRules: Rule[]) => void;
  language: Language;
  availableItems: string[];
}

const RuleManager: React.FC<RuleManagerProps> = ({ rules, onChange, language, availableItems }) => {
  const t = useTranslation(language);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleUpdateRule = (index: number, updatedRule: Rule) => {
    const newRules = [...rules];
    newRules[index] = updatedRule;
    onChange(newRules);
  };

  const updateCondition = (index: number, key: string, value: string) => {
    const rule = rules[index];
    const nextConditions = { ...rule.conditions };
    if (value === "") delete nextConditions[key];
    else nextConditions[key] = value;
    handleUpdateRule(index, { ...rule, conditions: nextConditions });
  };

  const POE_FACTORS = [
    { key: 'ItemLevel', label: 'Item Level' },
    { key: 'DropLevel', label: 'Drop Level' },
    { key: 'Quality', label: 'Quality' },
    { key: 'GemLevel', label: 'Gem Level' },
    { key: 'StackSize', label: 'Stack Size' },
  ];

  return (
    <div className="rule-manager">
      <div className="header">
        <h3>{t.rules}</h3>
        <button className="add-btn" onClick={() => {
            const newRule = { targets: [], conditions: {}, overrides: {}, comment: "New Rule" };
            onChange([...rules, newRule]);
            setEditingIndex(rules.length);
        }}>+ {t.addRule}</button>
      </div>

      <div className="rules-list">
        {rules.map((rule, index) => (
          <div key={index} className={`rule-card ${editingIndex === index ? 'editing' : ''}`}>
            <div className="rule-summary" onClick={() => setEditingIndex(editingIndex === index ? null : index)}>
              <span className="comment">{rule.comment || `Rule ${index + 1}`}</span>
              <span className="targets-count">{rule.targets.length} {t.targets}</span>
              <button className="delete-btn" onClick={(e) => { e.stopPropagation(); onChange(rules.filter((_, i) => i !== index)); }}>×</button>
            </div>

            {editingIndex === index && (
              <div className="rule-details">
                <div className="field">
                  <label>{t.comment}</label>
                  <input type="text" value={rule.comment} onChange={e => handleUpdateRule(index, { ...rule, comment: e.target.value })} />
                </div>

                <div className="field">
                  <label>{t.targets}</label>
                  <textarea 
                    placeholder="Comma separated item names..."
                    value={rule.targets.join(', ')} 
                    onChange={e => handleUpdateRule(index, { ...rule, targets: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                  />
                </div>

                <div className="factors-ui">
                  <h4>Item Factors (Conditions)</h4>
                  <div className="factors-grid">
                    {POE_FACTORS.map(f => {
                        const currentVal = rule.conditions[f.key] || "";
                        const operator = currentVal.match(/^[>=<!]+/)?.[0] || "";
                        const num = currentVal.replace(/^[>=<!]+/, "");

                        return (
                            <div key={f.key} className="factor-row">
                                <span className="factor-label">{f.label}</span>
                                <select 
                                    value={operator} 
                                    onChange={e => updateCondition(index, f.key, `${e.target.value}${num}`)}
                                >
                                    <option value="">Off</option>
                                    <option value=">=">&gt;=</option>
                                    <option value="<=">&lt;=</option>
                                    <option value="==">==</option>
                                    <option value=">">&gt;</option>
                                    <option value="<">&lt;</option>
                                </select>
                                <input 
                                    type="number" 
                                    value={num} 
                                    placeholder="Value"
                                    onChange={e => updateCondition(index, f.key, `${operator}${e.target.value}`)}
                                />
                            </div>
                        )
                    })}
                    
                    <div className="factor-row">
                        <span className="factor-label">Corrupted</span>
                        <select 
                            value={rule.conditions["Corrupted"] || ""} 
                            onChange={e => updateCondition(index, "Corrupted", e.target.value)}
                        >
                            <option value="">Any</option>
                            <option value="True">True</option>
                            <option value="False">False</option>
                        </select>
                    </div>

                    <div className="factor-row">
                        <span className="factor-label">Influence</span>
                        <select 
                            value={rule.conditions["HasInfluence"] || ""} 
                            onChange={e => updateCondition(index, "HasInfluence", e.target.value)}
                        >
                            <option value="">None</option>
                            <option value="Shaper">Shaper</option>
                            <option value="Elder">Elder</option>
                            <option value="Crusader">Crusader</option>
                            <option value="Redeemer">Redeemer</option>
                            <option value="Hunter">Hunter</option>
                            <option value="Warlord">Warlord</option>
                        </select>
                    </div>
                  </div>
                </div>

                <div className="field">
                  <label>{t.overrides} (Advanced JSON)</label>
                  <textarea 
                    value={JSON.stringify(rule.overrides)} 
                    onChange={e => { try { handleUpdateRule(index, { ...rule, overrides: JSON.parse(e.target.value) }); } catch(e) {} }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .rule-manager { margin-top: 20px; border-top: 2px solid #eee; padding-top: 20px; }
        .rule-card { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; background: #fdfdfd; overflow: hidden; }
        .rule-summary { padding: 12px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; }
        .rule-card.editing { border-color: #2196F3; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        
        .rule-details { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field label { font-size: 0.85rem; font-weight: bold; color: #555; }
        .field input, .field textarea { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        
        .factors-ui { background: #f0f4f8; padding: 15px; border-radius: 6px; }
        .factors-ui h4 { margin: 0 0 15px 0; font-size: 0.9rem; color: #2c3e50; }
        .factors-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
        
        .factor-row { display: flex; align-items: center; gap: 8px; background: white; padding: 8px; border-radius: 4px; border: 1px solid #e1e8ed; }
        .factor-label { flex: 1; font-size: 0.8rem; font-weight: bold; color: #606f7b; }
        .factor-row select { padding: 4px; border-radius: 3px; border: 1px solid #ccc; font-size: 0.8rem; }
        .factor-row input { width: 60px; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 0.8rem; }
      `}</style>
    </div>
  );
};

export default RuleManager;