import React from 'react';
import type { ItemProps, FilterContext, RuleMatch } from '../utils/simulatorEngine';
import type { Language } from '../utils/localization';

interface SimulatorMatchPickerProps {
  item: ItemProps;
  matches: RuleMatch[];
  context: FilterContext;
  language: Language;
  onPick: (m: RuleMatch) => void;
  onClose: () => void;
  onJumpToRule?: (file: string, ruleIndex?: number) => void;
}

const tierDefKey = (file: string) => file.replace(/^base_mapping\//, 'tier_definition/');

const SimulatorMatchPicker: React.FC<SimulatorMatchPickerProps> = ({
  item, matches, context, language, onPick, onClose, onJumpToRule,
}) => {
  const ch = language === 'ch';
  const displayName = ch && item.name_ch ? item.name_ch : item.name;

  const categoryLabel = (file: string) => {
    const def = context.tierDefinitions?.[tierDefKey(file)];
    const catKey = def && Object.keys(def).find((k) => !k.startsWith('//'));
    const loc = catKey && def[catKey]?._meta?.localization;
    return (ch ? loc?.ch : loc?.en) || file.replace(/^base_mapping\//, '').replace(/\.json$/, '');
  };

  return (
    <div className="smp-overlay" onClick={onClose}>
      <div className="smp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="smp-header">
          <div>
            <h3>{ch ? '多条规则生效' : 'Multiple Rules Apply'}</h3>
            <div className="smp-sub">
              {displayName} · {item.class} — {ch
                ? '该掉落物受多个分类文件的规则影响，选择要编辑的一个：'
                : 'This drop is affected by rules in more than one file. Pick one to edit:'}
            </div>
          </div>
          <button className="smp-close" onClick={onClose}>×</button>
        </div>

        <div className="smp-body">
          {matches.map((m, idx) => {
            const isWinner = idx === 0;
            return (
              <div key={`${m.file}:${m.ruleIndex}:${idx}`} className={`smp-card ${isWinner ? 'winner' : ''}`}>
                <div className="smp-card-main">
                  <div className="smp-card-head">
                    <span className="smp-rank">
                      {ch ? `优先级 ${idx + 1}` : `Priority ${idx + 1}`}
                      {isWinner && <span className="smp-badge">{ch ? '当前生效' : 'ACTIVE'}</span>}
                    </span>
                    <span className="smp-source">{m.isBaseMapping ? (ch ? '底材映射' : 'Base Mapping') : (m.ruleComment || (ch ? '自定义规则' : 'Custom Rule'))}</span>
                  </div>
                  <div className="smp-meta">
                    <span className="smp-cat">{categoryLabel(m.file)}</span>
                    <span className="smp-swatch" style={{ ...m.style, padding: '2px 10px' }}>{m.tier}</span>
                  </div>
                  {m.conditionsSummary && <div className="smp-cond">{m.conditionsSummary}</div>}
                </div>
                <div className="smp-card-actions">
                  <button className="smp-jump" onClick={() => onJumpToRule?.(m.file, m.ruleIndex ?? undefined)}>
                    {ch ? '编辑器' : 'Editor'}
                  </button>
                  <button className="smp-edit" onClick={() => onPick(m)}>
                    {ch ? '编辑规则与样式' : 'Edit rules & styles'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="smp-footer">
          <button className="smp-cancel" onClick={onClose}>{ch ? '关闭' : 'Close'}</button>
        </div>
      </div>

      <style>{`
        .smp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2500; }
        .smp-panel { background: #222; color: #eee; width: 560px; max-width: 94vw; max-height: 86vh; border: 1px solid #444; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: flex; flex-direction: column; }
        .smp-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 22px; border-bottom: 1px solid #3a3a3a; }
        .smp-header h3 { margin: 0; font-size: 1.05rem; }
        .smp-sub { font-size: 0.8rem; color: #9aa; margin-top: 6px; line-height: 1.4; }
        .smp-close { background: none; border: none; color: #aaa; font-size: 1.4rem; cursor: pointer; line-height: 1; }
        .smp-close:hover { color: #fff; }
        .smp-body { padding: 16px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .smp-card { border: 1px solid #3a3a3a; border-radius: 6px; padding: 12px 14px; background: #2a2a2a; display: flex; gap: 12px; align-items: center; }
        .smp-card.winner { border-color: #2196F3; box-shadow: 0 0 0 1px rgba(33,150,243,0.3); }
        .smp-card-main { flex: 1; min-width: 0; }
        .smp-card-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .smp-rank { font-size: 0.72rem; font-weight: bold; color: #8ab; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 8px; }
        .smp-badge { background: #2196F3; color: #fff; font-size: 0.6rem; padding: 1px 6px; border-radius: 10px; letter-spacing: 0.05em; }
        .smp-source { font-size: 0.8rem; color: #ccc; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
        .smp-meta { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
        .smp-cat { font-size: 0.78rem; color: #9bb; font-weight: 600; }
        .smp-swatch { border-radius: 2px; font-size: 0.78rem; white-space: nowrap; }
        .smp-cond { font-size: 0.72rem; color: #9a9; margin-top: 6px; }
        .smp-card-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
        .smp-jump { background: #333; color: #9cf; border: 1px solid #455; border-radius: 4px; padding: 5px 10px; font-size: 0.72rem; cursor: pointer; }
        .smp-jump:hover { background: #3a3a3a; color: #fff; }
        .smp-edit { background: #2196F3; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-size: 0.75rem; font-weight: bold; cursor: pointer; white-space: nowrap; }
        .smp-edit:hover { background: #1976D2; }
        .smp-footer { display: flex; justify-content: flex-end; padding: 14px 22px; border-top: 1px solid #3a3a3a; }
        .smp-cancel { background: #333; color: #ddd; border: 1px solid #444; border-radius: 4px; padding: 8px 18px; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default SimulatorMatchPicker;
