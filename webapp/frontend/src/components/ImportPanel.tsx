import React, { useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation, DATA_FOLDER_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import { SNAPSHOT_VERSION, parseSnapshotInput, groupSnapshotFiles } from '../utils/snapshot';
import type { Snapshot, SnapshotGroup } from '../utils/snapshot';

interface ImportPanelProps {
  language: Language;
}

interface ImportResult {
  written: string[];
  deleted: string[];
  backed_up_to: string | null;
}

const ImportPanel: React.FC<ImportPanelProps> = ({ language }) => {
  const t = useTranslation(language);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [fileName, setFileName] = useState('');
  const [groups, setGroups] = useState<SnapshotGroup[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const groupLabel = (g: SnapshotGroup): string => {
    if (g.kind === 'theme') return t.importThemeGroup;
    if (g.kind === 'sounds') return t.importSoundsGroup;
    if (g.kind === 'settings') return t.importSettingsGroup;
    if (language === 'ch') {
      const ch = DATA_FOLDER_CH[g.label];
      return ch ? `${ch} ${g.label}` : g.label;
    }
    return g.label;
  };

  const handleFile = async (file: File) => {
    setError('');
    setResult(null);
    setSnapshot(null);
    setGroups([]);
    const text = await file.text();
    const snap = await parseSnapshotInput(text);
    if (!snap) {
      setError(t.importInvalidFile);
      return;
    }
    if (snap.version > SNAPSHOT_VERSION) {
      setError(t.importNewerVersion);
      return;
    }
    const grouped = groupSnapshotFiles(snap.files || {});
    setSnapshot(snap);
    setFileName(file.name);
    setGroups(grouped);
    setChecked(new Set(grouped.map(g => g.key)));
  };

  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    if (!snapshot) return;
    const selected = groups.filter(g => checked.has(g.key));
    if (selected.length === 0) {
      setError(t.importNothingSelected);
      return;
    }
    setError('');
    setApplying(true);
    try {
      const files: Record<string, unknown> = {};
      const syncPrefixes: string[] = [];
      for (const g of selected) {
        for (const p of g.paths) files[p] = snapshot.files[p];
        syncPrefixes.push(...g.syncPrefixes);
      }
      const res = await axios.post('/api/import-snapshot', { files, sync_prefixes: syncPrefixes });
      setResult(res.data);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setError(e?.response?.data?.detail || String(e));
      setApplying(false);
    }
  };

  return (
    <div className="card import-panel">
      <h3>{t.importTitle}</h3>
      <p>{t.importDesc}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.filter,.ruthlessfilter"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <button className="choose-file-btn" onClick={() => fileInputRef.current?.click()} disabled={applying}>
        {t.importChooseFile}
      </button>

      {error && <div className="import-error">{error}</div>}

      {snapshot && !result && (
        <div className="import-selection">
          <div className="import-file-info">
            {t.importDetected}: <strong>{fileName}</strong>
            {' '}({Object.keys(snapshot.files).length} {t.importFilesCount}{snapshot.created ? `, ${snapshot.created}` : ''})
          </div>
          <div className="import-select-toggle">
            <button onClick={() => setChecked(new Set(groups.map(g => g.key)))}>{t.importSelectAll}</button>
            <button onClick={() => setChecked(new Set())}>{t.importSelectNone}</button>
          </div>
          <div className="import-group-list">
            {groups.map(g => (
              <label key={g.key} className="import-group">
                <input
                  type="checkbox"
                  checked={checked.has(g.key)}
                  onChange={() => toggle(g.key)}
                />
                <span className="import-group-name">{groupLabel(g)}</span>
                <span className="import-group-count">{g.paths.length} {t.importFilesCount}</span>
              </label>
            ))}
          </div>
          <button className="apply-btn" onClick={handleApply} disabled={applying || checked.size === 0}>
            {applying ? t.importApplying : t.importApply}
          </button>
        </div>
      )}

      {result && (
        <div className="import-result">
          <div className="import-success">{t.importApplied}</div>
          <div className="import-summary">
            {result.written.length} {t.importWrittenSummary}
            {result.deleted.length > 0 && <>, {result.deleted.length} {t.importDeletedSummary}</>}
          </div>
          {result.backed_up_to
            ? <div className="import-backup">{t.importBackupNote} <code>{result.backed_up_to}</code></div>
            : <div className="import-backup">{t.importDemoNoBackup}</div>}
        </div>
      )}

      <style>{`
        .import-panel { margin-top: 20px; }
        .choose-file-btn { background-color: #2196F3; color: white; border: none; padding: 10px 20px; font-size: 0.95rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .choose-file-btn:disabled { background-color: #ccc; }
        .import-error { margin-top: 12px; padding: 10px; background: #fdecea; color: #b71c1c; border-radius: 4px; font-size: 0.9rem; }
        .import-selection { margin-top: 16px; text-align: left; }
        .import-file-info { font-size: 0.9rem; color: #444; margin-bottom: 10px; }
        .import-select-toggle { display: flex; gap: 8px; margin-bottom: 8px; }
        .import-select-toggle button { padding: 3px 10px; font-size: 0.8rem; background: #eee; color: #333; border: 1px solid #ccc; border-radius: 4px; }
        .import-group-list { max-height: 260px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 4px; padding: 6px; }
        .import-group { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 4px; cursor: pointer; }
        .import-group:hover { background: #f5f5f5; }
        .import-group-name { flex: 1; font-size: 0.9rem; color: #222; }
        .import-group-count { font-size: 0.78rem; color: #888; }
        .apply-btn { margin-top: 12px; background-color: #4CAF50; color: white; border: none; padding: 10px 24px; font-size: 0.95rem; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; }
        .apply-btn:disabled { background-color: #ccc; }
        .import-result { margin-top: 14px; text-align: left; }
        .import-success { color: #2e7d32; font-weight: bold; }
        .import-summary { font-size: 0.85rem; color: #555; margin-top: 4px; }
        .import-backup { font-size: 0.8rem; color: #777; margin-top: 4px; }
        .import-backup code { background: #f0f0f0; padding: 1px 4px; border-radius: 3px; }
      `}</style>
    </div>
  );
};

export default ImportPanel;
