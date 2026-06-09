import React from 'react';
import type { Language } from '../utils/localization';

export interface OccurrenceRuleRow {
  file: string;            // relative base_mapping path
  label: string;          // category / file label
  tiers: string[];
  currentSound: string | null;
}

interface OccurrenceRuleListProps {
  itemName: string;
  itemNameCh?: string;
  itemClass?: string;
  rows: OccurrenceRuleRow[];
  language: Language;
  onEditRules: (file: string) => void;   // open the ported rule-block for this file
  onJumpToEditor?: (file: string) => void;
  onClose: () => void;
}

const tierShort = (t: string) => {
  const m = t.match(/Tier (\d+)/);
  return m ? `T${m[1]}` : t;
};

const OccurrenceRuleList: React.FC<OccurrenceRuleListProps> = ({
  itemName, itemNameCh, itemClass, rows, language, onEditRules, onJumpToEditor, onClose,
}) => {
  const ch = language === 'ch';
  const displayName = ch && itemNameCh ? itemNameCh : itemName;

  return (
    <div className="orl-overlay" onClick={onClose}>
      <div className="orl-panel" onClick={(e) => e.stopPropagation()}>
        <div className="orl-header">
          <div>
            <h3>{ch ? '适用的规则 / 分类' : 'Applicable Rules / Categories'}</h3>
            <div className="orl-sub">
              <b>{displayName}</b>{itemClass ? ` · ${itemClass}` : ''} — {ch
                ? '该底材出现在以下分类文件中，选择一个查看或编辑其规则与样式：'
                : 'This basetype appears in the files below. Pick one to view or edit its rules & styles:'}
            </div>
          </div>
          <button className="orl-close" onClick={onClose}>×</button>
        </div>

        <div className="orl-body">
          {rows.map((r) => (
            <div key={r.file} className="orl-row">
              <div className="orl-main">
                <div className="orl-cat">{r.label}</div>
                <div className="orl-meta">
                  {r.tiers.length > 0 && (
                    <span className="orl-tiers">{r.tiers.map(tierShort).join(', ')}</span>
                  )}
                  <span className={`orl-cur ${r.currentSound ? '' : 'none'}`}>
                    🎵 {r.currentSound ? r.currentSound.split('/').pop() : (ch ? '无' : 'none')}
                  </span>
                </div>
              </div>
              <div className="orl-actions">
                {onJumpToEditor && (
                  <button className="orl-jump" onClick={() => onJumpToEditor(r.file)}>
                    {ch ? '编辑器' : 'Editor'}
                  </button>
                )}
                <button className="orl-edit" onClick={() => onEditRules(r.file)}>
                  {ch ? '编辑规则与样式' : 'Edit rules & styles'}
                </button>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="orl-empty">{ch ? '没有可显示的分类' : 'No categories to show'}</div>
          )}
        </div>

        <div className="orl-footer">
          <button className="orl-cancel" onClick={onClose}>{ch ? '关闭' : 'Close'}</button>
        </div>
      </div>

      <style>{`
        .orl-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2800; }
        .orl-panel { background: #222; color: #eee; width: 600px; max-width: 94vw; max-height: 86vh; border: 1px solid #444; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: flex; flex-direction: column; }
        .orl-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 22px; border-bottom: 1px solid #3a3a3a; }
        .orl-header h3 { margin: 0; font-size: 1.05rem; }
        .orl-sub { font-size: 0.8rem; color: #9aa; margin-top: 6px; line-height: 1.5; }
        .orl-close { background: none; border: none; color: #aaa; font-size: 1.4rem; cursor: pointer; line-height: 1; }
        .orl-close:hover { color: #fff; }
        .orl-body { padding: 14px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .orl-row { display: flex; align-items: center; gap: 12px; border: 1px solid #3a3a3a; border-radius: 6px; padding: 12px 14px; background: #2a2a2a; }
        .orl-main { flex: 1; min-width: 0; }
        .orl-cat { font-size: 0.88rem; font-weight: 600; color: #dfe6ee; }
        .orl-meta { display: flex; align-items: center; gap: 12px; margin-top: 5px; }
        .orl-tiers { font-size: 0.72rem; color: #8ab; background: #1d2730; border: 1px solid #2c3a45; border-radius: 4px; padding: 1px 6px; }
        .orl-cur { font-size: 0.72rem; color: #9c9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .orl-cur.none { color: #777; }
        .orl-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
        .orl-jump { background: #333; color: #9cf; border: 1px solid #455; border-radius: 4px; padding: 5px 10px; font-size: 0.72rem; cursor: pointer; }
        .orl-jump:hover { background: #3a3a3a; color: #fff; }
        .orl-edit { background: #2196F3; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; font-size: 0.75rem; font-weight: bold; cursor: pointer; white-space: nowrap; }
        .orl-edit:hover { background: #1976D2; }
        .orl-empty { color: #888; text-align: center; padding: 30px 0; font-style: italic; }
        .orl-footer { display: flex; justify-content: flex-end; padding: 14px 22px; border-top: 1px solid #3a3a3a; }
        .orl-cancel { background: #333; color: #ddd; border: 1px solid #444; border-radius: 4px; padding: 8px 18px; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default OccurrenceRuleList;
