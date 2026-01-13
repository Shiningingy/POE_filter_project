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

  const handleAddRule = () => {
    const newRule: Rule = {
      targets: [],
      conditions: {},
      overrides: {},
      comment: "New rule"
    };
    onChange([...rules, newRule]);
    setEditingIndex(rules.length);
  };

  const handleDeleteRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    onChange(newRules);
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleUpdateRule = (index: number, updatedRule: Rule) => {
    const newRules = [...rules];
    newRules[index] = updatedRule;
    onChange(newRules);
  };

  return (
    <div className="rule-manager">
      <div className="header">
        <h3>{t.rules}</h3>
        <button className="add-btn" onClick={handleAddRule}>+ {t.addRule}</button>
      </div>

      <div className="rules-list">
        {rules.map((rule, index) => (
          <div key={index} className={`rule-card ${editingIndex === index ? 'editing' : ''}`}>
            <div className="rule-summary" onClick={() => setEditingIndex(editingIndex === index ? null : index)}>
              <span className="comment">{rule.comment || `Rule ${index + 1}`}</span>
              <span className="targets-count">{rule.targets.length} {t.targets}</span>
              <button className="delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteRule(index); }}>×</button>
            </div>

            {editingIndex === index && (
              <div className="rule-details">
                <div className="field">
                  <label>{t.comment}</label>
                  <input 
                    type="text" 
                    value={rule.comment} 
                    onChange={e => handleUpdateRule(index, { ...rule, comment: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>{t.targets} (comma separated)</label>
                  <textarea 
                    value={rule.targets.join(', ')} 
                    onChange={e => handleUpdateRule(index, { ...rule, targets: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                  />
                </div>

                <div className="field-group">
                  <div className="field">
                    <label>{t.conditions} (JSON)</label>
                    <textarea 
                      value={JSON.stringify(rule.conditions)} 
                      onChange={e => {
                        try { handleUpdateRule(index, { ...rule, conditions: JSON.parse(e.target.value) }); } catch(e) {}
                      }}
                    />
                  </div>
                  <div className="field">
                    <label>{t.overrides} (JSON)</label>
                    <textarea 
                      value={JSON.stringify(rule.overrides)} 
                      onChange={e => {
                        try { handleUpdateRule(index, { ...rule, overrides: JSON.parse(e.target.value) }); } catch(e) {}
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .rule-manager { margin-top: 20px; border-top: 2px solid #eee; padding-top: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .add-btn { background: #4CAF50; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer; }
        .rule-card { border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; background: #f9f9f9; }
        .rule-summary { padding: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
        .rule-summary:hover { background: #f0f0f0; }
        .rule-card.editing { border-color: #2196F3; background: white; }
        .comment { font-weight: bold; }
        .targets-count { font-size: 0.8rem; color: #666; }
        .delete-btn { background: #ff5252; color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; }
        
        .rule-details { padding: 15px; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 10px; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field label { font-size: 0.8rem; color: #888; font-weight: bold; }
        .field input, .field textarea { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
        .field textarea { min-height: 60px; font-family: monospace; font-size: 0.8rem; }
        .field-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      `}</style>
    </div>
  );
};

export default RuleManager;
