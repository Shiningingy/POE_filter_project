// Strictness Gates editor: every category × tier as a "hide at strictness N"
// gate, for quickly shaping the whole filter's strictness curve in one screen.
// A gate writes `hide_at_strictness` on the tier, which BOTH generators honor
// (Standard → Hide, Ruthless → Minimal). Reads the merged tier definitions via
// /api/simulator-bundle; Apply batch-writes each touched tier file via the
// config endpoints (real files locally, VFS in the web build). Save/Import a
// preset (a .strictness.json bundle of gates) to reuse a curve, then fine-tune.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation, DATA_FOLDER_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import { STRICTNESS_LEVELS } from '../utils/filterGenerator';
import LoadingOverlay from './LoadingOverlay';

type Gate = number | null; // null = always show; N = hide at strictness index >= N

interface TierRow {
  key: string;
  num: number | null;
  label: string;
  gate: Gate;            // current hide_at_strictness on disk
  locked: boolean;       // show_in_editor === false → not editable
  protected: boolean;    // hideable === false → guarded, cannot be gated
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

const PRESET_FORMAT = 'sharket-strictness-preset';
const COLLAPSED_FOLDERS = ['_campaign', '_legacy'];

const VisibilityOverview: React.FC<VisibilityOverviewProps> = ({ language, onClose, onApplied }) => {
  const t = useTranslation(language);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  // rel -> tierKey -> new gate (number | null)
  const [staged, setStaged] = useState<Record<string, Record<string, Gate>>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
            if (val.is_hide_tier) return; // permanent hide bucket — no gate to set
            const num = typeof val.theme?.Tier === 'number' ? val.theme.Tier : null;
            tiers.push({
              key,
              num,
              label: val.localization?.[language] || val.localization?.en || (num !== null ? `T${num}` : key),
              gate: typeof val.hide_at_strictness === 'number' ? val.hide_at_strictness : null,
              locked: val.show_in_editor === false,
              protected: val.hideable === false,
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

  const effectiveGate = (rel: string, tier: TierRow): Gate =>
    staged[rel]?.[tier.key] !== undefined ? staged[rel][tier.key] : tier.gate;

  const stage = (rel: string, tier: TierRow, gate: Gate) => {
    setStaged(prev => {
      const next = { ...prev, [rel]: { ...(prev[rel] || {}) } };
      if (gate === tier.gate) delete next[rel][tier.key]; // back to original
      else next[rel][tier.key] = gate;
      if (!Object.keys(next[rel]).length) delete next[rel];
      return next;
    });
  };

  const stageAll = (file: FileRow, gate: Gate) => {
    file.tiers.filter(tr => !tr.locked && !tr.protected).forEach(tr => stage(file.rel, tr, gate));
  };

  const stagedCount = useMemo(
    () => Object.values(staged).reduce((n, m) => n + Object.keys(m).length, 0),
    [staged],
  );

  const groups = useMemo(() => {
    const byFolder: Record<string, FileRow[]> = {};
    (files || []).forEach(f => { (byFolder[f.folder] ||= []).push(f); });
    return Object.entries(byFolder).sort(([a], [b]) => {
      const sa = a.startsWith('_') ? `~${a}` : a;
      const sb = b.startsWith('_') ? `~${b}` : b;
      return sa < sb ? -1 : 1;
    });
  }, [files]);

  const folderLabel = (folder: string) => {
    if (!folder) return language === 'ch' ? '其他' : 'Other';
    return language === 'ch' ? (DATA_FOLDER_CH[folder] || folder) : folder.replace(/^_/, '');
  };

  const gateLabel = (g: Gate) => (g === null ? t.gateAlways : `≥ ${t.strictnessLevels[STRICTNESS_LEVELS[g]]}`);

  // ── Presets (file-based: a .strictness.json bundle of gates) ────────────────
  const buildPreset = () => {
    const gates: Record<string, Record<string, number>> = {};
    (files || []).forEach(f => {
      f.tiers.forEach(tier => {
        const g = effectiveGate(f.rel, tier);
        if (typeof g === 'number') (gates[f.rel] ||= {})[tier.key] = g;
      });
    });
    return { format: PRESET_FORMAT, version: 1, gates };
  };

  const savePreset = () => {
    const blob = new Blob([JSON.stringify(buildPreset(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sharket.strictness.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importPreset = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const gates = (data && data.gates) || {};
      // Stage every editable tier to the preset's gate (or clear it), so applying
      // reproduces the preset's curve exactly. Untouched tiers fall back to null.
      (files || []).forEach(f => {
        f.tiers.forEach(tier => {
          if (tier.locked || tier.protected) return; // never gate a guarded tier
          const desired = gates[f.rel]?.[tier.key];
          stage(f.rel, tier, typeof desired === 'number' ? desired : null);
        });
      });
    } catch (e) {
      alert(t.presetImportFailed);
    }
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
        for (const [tierKey, gate] of Object.entries(changes)) {
          if (!content[catKey][tierKey]) continue;
          if (gate === null) delete content[catKey][tierKey].hide_at_strictness;
          else content[catKey][tierKey].hide_at_strictness = gate;
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
          <h3>🎚 {t.strictnessGates}</h3>
          <div className="vo-header-actions">
            <button className="vo-mini" onClick={savePreset}>⬇ {t.savePreset}</button>
            <button className="vo-mini" onClick={() => fileRef.current?.click()}>⬆ {t.importPreset}</button>
            <button className="vo-close" onClick={onClose}>×</button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) importPreset(f); e.target.value = ''; }}
          />
        </div>
        <div className="vo-hint">{t.strictnessGatesHint}</div>

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
                      <select
                        className="vo-setall"
                        value=""
                        onChange={e => { const v = e.target.value; if (v !== '') stageAll(file, v === 'none' ? null : parseInt(v, 10)); }}
                      >
                        <option value="">{t.setAllGate}…</option>
                        <option value="none">{t.gateAlways}</option>
                        {STRICTNESS_LEVELS.map((lvl, i) => (
                          <option key={lvl} value={i}>{`≥ ${t.strictnessLevels[lvl]}`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="vo-tier-row">
                      {file.tiers.map(tier => {
                        const g = effectiveGate(file.rel, tier);
                        const changed = staged[file.rel]?.[tier.key] !== undefined;
                        return (
                          <label
                            key={tier.key}
                            className={`vo-gate ${g !== null ? 'is-hidden' : 'is-shown'} ${(tier.locked || tier.protected) ? 'locked' : ''} ${changed ? 'changed' : ''}`}
                            title={tier.protected ? `${tier.key} · ${t.protectTier}` : `${tier.key} → ${gateLabel(g)}`}
                          >
                            <span className="vo-gate-label">{tier.protected ? '🔒 ' : ''}{tier.label}</span>
                            <select
                              value={g === null ? '' : String(g)}
                              disabled={tier.locked || tier.protected}
                              onChange={e => { const v = e.target.value; stage(file.rel, tier, v === '' ? null : parseInt(v, 10)); }}
                            >
                              <option value="">{t.gateAlways}</option>
                              {STRICTNESS_LEVELS.map((lvl, i) => (
                                <option key={lvl} value={i}>{`≥ ${t.strictnessLevels[lvl]}`}</option>
                              ))}
                            </select>
                          </label>
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
        .vo-modal { background: white; color: #222; border-radius: 8px; width: 820px; max-width: 94vw; height: 84vh; display: flex; flex-direction: column; padding: 16px 20px; }
        .vo-header { display: flex; justify-content: space-between; align-items: center; }
        .vo-header h3 { margin: 0; font-size: 1.05rem; }
        .vo-header-actions { display: flex; align-items: center; gap: 8px; }
        .vo-close { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: #888; }
        .vo-hint { font-size: 0.78rem; color: #888; margin: 4px 0 10px; }
        .vo-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
        .vo-folder { font-weight: bold; font-size: 0.9rem; padding: 6px 4px; cursor: pointer; color: #333; position: sticky; top: 0; background: white; }
        .vo-file { padding: 6px 8px 8px 18px; border-bottom: 1px solid #f0f0f0; }
        .vo-file-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .vo-file-label { font-size: 0.85rem; font-weight: 600; color: #444; }
        .vo-mini { font-size: 0.72rem; border: 1px solid #ddd; background: #fafafa; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #555; }
        .vo-mini:hover { border-color: #999; }
        .vo-setall { font-size: 0.7rem; border: 1px solid #ddd; background: #fafafa; border-radius: 3px; padding: 1px 4px; cursor: pointer; color: #666; }
        .vo-tier-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .vo-gate { display: inline-flex; flex-direction: column; gap: 2px; border: 1px solid; border-radius: 4px; padding: 3px 6px; }
        .vo-gate.is-shown { background: #e8f5e9; border-color: #a5d6a7; }
        .vo-gate.is-hidden { background: #ffebee; border-color: #ef9a9a; }
        .vo-gate.changed { outline: 2px solid #2196F3; }
        .vo-gate.locked { opacity: 0.4; }
        .vo-gate-label { font-size: 0.72rem; color: #333; font-weight: 600; }
        .vo-gate select { font-size: 0.7rem; border: 1px solid #ccc; border-radius: 2px; background: white; cursor: pointer; }
        .vo-gate.is-hidden .vo-gate-label { color: #b71c1c; }
        .vo-gate.is-shown .vo-gate-label { color: #2e7d32; }
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
