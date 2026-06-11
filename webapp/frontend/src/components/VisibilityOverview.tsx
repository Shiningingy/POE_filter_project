// Global show/hide editor: every category × tier as Show/Hide toggles, for
// quickly muting junk across the whole filter ("strictness screen" feel).
// Reads the merged tier definitions via /api/simulator-bundle; Apply batch-
// writes each touched tier file via the config endpoints (VFS in the web build).
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation, DATA_FOLDER_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import LoadingOverlay from './LoadingOverlay';

interface TierRow {
  key: string;
  num: number | null;
  label: string;
  hideable: boolean;     // true = currently hidden
  locked: boolean;       // show_in_editor === false → not toggleable
}

interface FileRow {
  rel: string;           // path relative to tier_definition/
  folder: string;        // top-level folder ("Currency", "_campaign", ...)
  label: string;
  tiers: TierRow[];
}

interface VisibilityOverviewProps {
  language: Language;
  onClose: () => void;
  onApplied: (touchedFiles: string[]) => void;
}

const COLLAPSED_FOLDERS = ['_campaign', '_legacy'];

const VisibilityOverview: React.FC<VisibilityOverviewProps> = ({ language, onClose, onApplied }) => {
  const t = useTranslation(language);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  // rel -> tierKey -> new hideable value
  const [staged, setStaged] = useState<Record<string, Record<string, boolean>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/api/simulator-bundle');
        const rows: FileRow[] = [];
        Object.entries<any>(res.data?.tiers || {}).forEach(([path, content]) => {
          const rel = path.replace(/^tier_definition\//, '');
          const catKey = Object.keys(content || {}).find(k => !k.startsWith('//'));
          if (!catKey) return;
          const cat = content[catKey];
          const tiers: TierRow[] = [];
          Object.entries<any>(cat).forEach(([key, val]) => {
            if (key === '_meta' || !val || typeof val !== 'object') return;
            if (!('theme' in val) && !('localization' in val) && !('is_hide_tier' in val)) return;
            if (val.is_hide_tier) return; // permanent hide bucket — nothing to toggle
            const num = typeof val.theme?.Tier === 'number' ? val.theme.Tier : null;
            tiers.push({
              key,
              num,
              label: val.localization?.[language] || val.localization?.en || (num !== null ? `T${num}` : key),
              hideable: !!val.hideable,
              locked: val.show_in_editor === false,
            });
          });
          if (!tiers.length) return;
          tiers.sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
          rows.push({
            rel,
            folder: rel.includes('/') ? rel.split('/')[0] : '',
            label: cat?._meta?.localization?.[language] || cat?._meta?.localization?.en || catKey,
            tiers,
          });
        });
        rows.sort((a, b) => (a.rel < b.rel ? -1 : 1));
        setFiles(rows);
      } catch (e) {
        console.error('Failed to load tier definitions', e);
        setFiles([]);
      }
    };
    load();
  }, [language]);

  const effectiveHidden = (rel: string, tier: TierRow) =>
    staged[rel]?.[tier.key] !== undefined ? staged[rel][tier.key] : tier.hideable;

  const stage = (rel: string, tier: TierRow, hidden: boolean) => {
    setStaged(prev => {
      const next = { ...prev, [rel]: { ...(prev[rel] || {}) } };
      if (hidden === tier.hideable) delete next[rel][tier.key]; // back to original
      else next[rel][tier.key] = hidden;
      if (!Object.keys(next[rel]).length) delete next[rel];
      return next;
    });
  };

  const stageAll = (file: FileRow, hidden: boolean) => {
    file.tiers.filter(tr => !tr.locked).forEach(tr => stage(file.rel, tr, hidden));
  };

  const stagedCount = useMemo(
    () => Object.values(staged).reduce((n, m) => n + Object.keys(m).length, 0),
    [staged],
  );

  const groups = useMemo(() => {
    const byFolder: Record<string, FileRow[]> = {};
    (files || []).forEach(f => { (byFolder[f.folder] ||= []).push(f); });
    return Object.entries(byFolder).sort(([a], [b]) => {
      // normal folders first, _-prefixed (campaign/legacy) last
      const sa = a.startsWith('_') ? `~${a}` : a;
      const sb = b.startsWith('_') ? `~${b}` : b;
      return sa < sb ? -1 : 1;
    });
  }, [files]);

  const folderLabel = (folder: string) => {
    if (!folder) return language === 'ch' ? '其他' : 'Other';
    return language === 'ch' ? (DATA_FOLDER_CH[folder] || folder) : folder.replace(/^_/, '');
  };

  const handleApply = async () => {
    setBusy(true);
    const touched: string[] = [];
    try {
      for (const [rel, changes] of Object.entries(staged)) {
        const res = await axios.get(`/api/config/tier_definition/${rel}`);
        const content = JSON.parse(JSON.stringify(res.data.content));
        const catKey = Object.keys(content).find(k => !k.startsWith('//'));
        if (!catKey) continue;
        for (const [tierKey, hidden] of Object.entries(changes)) {
          if (content[catKey][tierKey]) content[catKey][tierKey].hideable = hidden;
        }
        await axios.post(`/api/config/tier_definition/${rel}`, content);
        touched.push(rel);
      }
      setStaged({});
      onApplied(touched);
      onClose();
    } catch (e: any) {
      alert(`${t.loadFailed}: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vo-overlay" onClick={onClose}>
      <div className="vo-modal" onClick={e => e.stopPropagation()}>
        <div className="vo-header">
          <h3>👁 {t.showHideEditor}</h3>
          <button className="vo-close" onClick={onClose}>×</button>
        </div>
        <div className="vo-hint">{t.visibilityHint}</div>

        {files === null ? (
          <LoadingOverlay language={language} />
        ) : (
          <div className="vo-body">
            {groups.map(([folder, rows]) => (
              <details key={folder || '__root__'} open={!COLLAPSED_FOLDERS.includes(folder)}>
                <summary className="vo-folder">{folderLabel(folder)}</summary>
                {rows.map(file => (
                  <div key={file.rel} className="vo-file">
                    <div className="vo-file-head">
                      <span className="vo-file-label" title={file.rel}>{file.label}</span>
                      <button className="vo-mini" onClick={() => stageAll(file, false)}>{t.showAll}</button>
                      <button className="vo-mini" onClick={() => stageAll(file, true)}>{t.hideAll}</button>
                    </div>
                    <div className="vo-tier-row">
                      {file.tiers.map(tier => {
                        const hidden = effectiveHidden(file.rel, tier);
                        const changed = staged[file.rel]?.[tier.key] !== undefined;
                        return (
                          <button
                            key={tier.key}
                            className={`vo-chip ${hidden ? 'is-hidden' : 'is-shown'} ${tier.locked ? 'locked' : ''} ${changed ? 'changed' : ''}`}
                            disabled={tier.locked}
                            title={tier.locked ? undefined : `${tier.key} → ${hidden ? t.show : t.hide}`}
                            onClick={() => stage(file.rel, tier, !hidden)}
                          >
                            {tier.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </details>
            ))}
          </div>
        )}

        <div className="vo-footer">
          <span className="vo-count">{stagedCount > 0 ? `${stagedCount} ${t.visibilityChanges}` : ''}</span>
          <button onClick={onClose}>{t.cancel}</button>
          <button className="vo-apply" disabled={stagedCount === 0 || busy} onClick={handleApply}>
            {busy ? '...' : t.applyChanges}
          </button>
        </div>
      </div>

      <style>{`
        .vo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1600; display: flex; align-items: center; justify-content: center; }
        .vo-modal { background: white; color: #222; border-radius: 8px; width: 760px; max-width: 94vw; height: 84vh; display: flex; flex-direction: column; padding: 16px 20px; }
        .vo-header { display: flex; justify-content: space-between; align-items: center; }
        .vo-header h3 { margin: 0; font-size: 1.05rem; }
        .vo-close { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #888; }
        .vo-hint { font-size: 0.78rem; color: #888; margin: 4px 0 10px; }
        .vo-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
        .vo-folder { font-weight: bold; font-size: 0.9rem; padding: 6px 4px; cursor: pointer; color: #333; position: sticky; top: 0; background: white; }
        .vo-file { padding: 6px 8px 8px 18px; border-bottom: 1px solid #f0f0f0; }
        .vo-file-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .vo-file-label { font-size: 0.85rem; font-weight: 600; color: #444; }
        .vo-mini { font-size: 0.68rem; border: 1px solid #ddd; background: #fafafa; border-radius: 3px; padding: 1px 8px; cursor: pointer; color: #666; }
        .vo-mini:hover { border-color: #999; }
        .vo-tier-row { display: flex; flex-wrap: wrap; gap: 5px; }
        .vo-chip { font-size: 0.74rem; border-radius: 3px; padding: 3px 10px; cursor: pointer; border: 1px solid; }
        .vo-chip.is-shown { background: #e8f5e9; border-color: #a5d6a7; color: #2e7d32; }
        .vo-chip.is-hidden { background: #ffebee; border-color: #ef9a9a; color: #b71c1c; text-decoration: line-through; }
        .vo-chip.changed { outline: 2px solid #2196F3; }
        .vo-chip.locked { opacity: 0.4; cursor: not-allowed; }
        .vo-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding-top: 12px; }
        .vo-count { margin-right: auto; font-size: 0.8rem; color: #2196F3; }
        .vo-footer button { padding: 7px 16px; border-radius: 4px; border: 1px solid #ccc; background: #fafafa; cursor: pointer; }
        .vo-apply { background: #4CAF50 !important; border-color: #4CAF50 !important; color: white; font-weight: bold; }
        .vo-apply:disabled { background: #ccc !important; border-color: #ccc !important; }
      `}</style>
    </div>
  );
};

export default VisibilityOverview;
