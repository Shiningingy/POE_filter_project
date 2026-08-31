import React, { useState } from 'react';
import { getItemName, useTranslation, type Language } from '../utils/localization';

export interface OccurrenceRow {
  file: string;            // relative base_mapping path (the per-file occurrence key)
  label: string;          // human-readable category/file label
  tiers: string[];        // tier labels this basetype occupies in the file
  currentSound: string | null; // currently resolved sound path for this occurrence
}

interface OccurrencePickerProps {
  itemName: string;
  itemNameCh?: string;
  rows: OccurrenceRow[];
  preChecked: string[];          // occurrence files that start checked
  language: Language;
  // 'assign' = choose which occurrences receive the target sound;
  // 'remove' = choose which occurrences to clear.
  mode: 'assign' | 'remove';
  targetSoundLabel?: string;     // shown in the header for assign mode
  onConfirm: (selectedFiles: string[]) => void;
  onClose: () => void;
}

const tierShort = (t: string) => {
  const m = t.match(/Tier (\d+)/);
  return m ? `T${m[1]}` : t;
};

const OccurrencePicker: React.FC<OccurrencePickerProps> = ({
  itemName, itemNameCh, rows, preChecked, language, mode, targetSoundLabel, onConfirm, onClose,
}) => {
  const t = useTranslation(language);
  const [checked, setChecked] = useState<Set<string>>(new Set(preChecked));

  const toggle = (file: string) =>
    setChecked(prev => {
      const n = new Set(prev);
      n.has(file) ? n.delete(file) : n.add(file);
      return n;
    });

  const allOn = rows.length > 0 && rows.every(r => checked.has(r.file));
  const toggleAll = () =>
    setChecked(allOn ? new Set() : new Set(rows.map(r => r.file)));

  const displayName = getItemName({ name: itemName, name_ch: itemNameCh }, language);

  return (
    <div className="occ-overlay" onClick={onClose}>
      <div className="occ-panel" onClick={e => e.stopPropagation()}>
        <div className="occ-header">
          <div>
            <h3>{mode === 'assign'
              ? (t.applySoundToWhichOccurrences)
              : (t.removeSoundFromWhichOccurrences)}</h3>
            <div className="occ-sub">
              <b>{displayName}</b>
              {mode === 'assign' && targetSoundLabel && (
                <> — {t.sound2}: <span className="occ-snd">{targetSoundLabel}</span></>
              )}
              <div className="occ-hint">
                {t.thisBasetypeExistsInSeveral}
              </div>
            </div>
          </div>
          <button className="occ-close" onClick={onClose}>×</button>
        </div>

        <div className="occ-toolbar">
          <button className="occ-all" onClick={toggleAll}>
            {allOn ? (t.deselectAll) : (t.lvSelectAll)}
          </button>
          <span className="occ-count">{checked.size}/{rows.length}</span>
        </div>

        <div className="occ-body">
          {rows.map(r => {
            const on = checked.has(r.file);
            return (
              <label key={r.file} className={`occ-row ${on ? 'on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(r.file)} />
                <div className="occ-main">
                  <div className="occ-cat">{r.label}</div>
                  <div className="occ-meta">
                    {r.tiers.length > 0 && (
                      <span className="occ-tiers">{r.tiers.map(tierShort).join(', ')}</span>
                    )}
                    <span className={`occ-cur ${r.currentSound ? '' : 'none'}`}>
                      🎵 {r.currentSound ? r.currentSound.split('/').pop() : (t.none2)}
                    </span>
                  </div>
                </div>
              </label>
            );
          })}
          {rows.length === 0 && (
            <div className="occ-empty">{t.noOccurrencesToChange}</div>
          )}
        </div>

        <div className="occ-footer">
          <button className="occ-cancel" onClick={onClose}>{t.cancel}</button>
          <button className="occ-confirm" disabled={checked.size === 0} onClick={() => onConfirm([...checked])}>
            {t.confirm} ({checked.size})
          </button>
        </div>
      </div>

      <style>{`
        .occ-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 3000; }
        .occ-panel { background: #222; color: #eee; width: 560px; max-width: 94vw; max-height: 86vh; border: 1px solid #444; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); display: flex; flex-direction: column; }
        .occ-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 22px; border-bottom: 1px solid #3a3a3a; }
        .occ-header h3 { margin: 0; font-size: 1.05rem; }
        .occ-sub { font-size: 0.82rem; color: #bbc; margin-top: 6px; line-height: 1.5; }
        .occ-snd { color: #9cf; font-weight: bold; }
        .occ-hint { font-size: 0.75rem; color: #99a; margin-top: 4px; }
        .occ-close { background: none; border: none; color: #aaa; font-size: 1.4rem; cursor: pointer; line-height: 1; }
        .occ-close:hover { color: #fff; }
        .occ-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 22px; border-bottom: 1px solid #3a3a3a; }
        .occ-all { background: #333; color: #ddd; border: 1px solid #455; border-radius: 4px; padding: 5px 12px; font-size: 0.75rem; cursor: pointer; }
        .occ-all:hover { background: #3a3a3a; color: #fff; }
        .occ-count { font-size: 0.78rem; color: #9bb; font-weight: bold; }
        .occ-body { padding: 12px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .occ-row { display: flex; align-items: center; gap: 12px; border: 1px solid #3a3a3a; border-radius: 6px; padding: 10px 12px; background: #2a2a2a; cursor: pointer; }
        .occ-row.on { border-color: #2196F3; box-shadow: 0 0 0 1px rgba(33,150,243,0.3); background: #25303a; }
        .occ-row input { width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }
        .occ-main { flex: 1; min-width: 0; }
        .occ-cat { font-size: 0.85rem; font-weight: 600; color: #dfe6ee; }
        .occ-meta { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
        .occ-tiers { font-size: 0.72rem; color: #8ab; background: #1d2730; border: 1px solid #2c3a45; border-radius: 4px; padding: 1px 6px; }
        .occ-cur { font-size: 0.72rem; color: #9c9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .occ-cur.none { color: #777; }
        .occ-empty { color: #888; text-align: center; padding: 30px 0; font-style: italic; }
        .occ-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #3a3a3a; }
        .occ-cancel { background: #333; color: #ddd; border: 1px solid #444; border-radius: 4px; padding: 8px 18px; cursor: pointer; }
        .occ-confirm { background: #2196F3; color: #fff; border: none; border-radius: 4px; padding: 8px 18px; font-weight: bold; cursor: pointer; }
        .occ-confirm:disabled { background: #2c3540; color: #667; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default OccurrencePicker;
