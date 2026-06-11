import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { buildEmbeddedBlock } from '../utils/snapshot';
import type { Snapshot } from '../utils/snapshot';
import ImportPanel from '../components/ImportPanel';

type ExportFormat = 'filter' | 'sidecar' | 'embedded' | 'both';

interface ExportViewProps {
  onGenerate: () => Promise<string | null>;
  loading: boolean;
  message: string;
  gameMode?: 'normal' | 'ruthless';
  language: Language;
}

interface ExportResult {
  filterText: string;
  filterName: string;
  snapshotJson: string | null;
}

const ExportView: React.FC<ExportViewProps> = ({ onGenerate, loading, message, gameMode, language }) => {
  const t = useTranslation(language);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('sidecar');
  const [snapshotError, setSnapshotError] = useState(false);
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);

  const downloadBlob = (content: string, name: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runExport = async (content: string) => {
    const extension = gameMode === 'ruthless' ? '.ruthlessfilter' : '.filter';
    const format = exportFormat;

    let snapshot: Snapshot | null = null;
    if (format !== 'filter') {
      try {
        const res = await axios.get('/api/export-snapshot');
        snapshot = res.data;
      } catch (e) {
        console.error('Snapshot export failed, downloading filter only:', e);
        setSnapshotError(true);
      }
    }

    let filterText = content;
    if (snapshot && (format === 'embedded' || format === 'both')) {
      filterText = content.replace(/\s*$/, '\n') + await buildEmbeddedBlock(snapshot);
    }
    const filterName = `Sharket_Custom${extension}`;
    const snapshotJson = snapshot && (format === 'sidecar' || format === 'both')
      ? JSON.stringify(snapshot)
      : null;
    setLastExport({ filterText, filterName, snapshotJson });

    downloadBlob(filterText, filterName);
    if (snapshotJson) {
      // Staggered so the browser doesn't coalesce/block the second download.
      setTimeout(() => downloadBlob(snapshotJson, 'Sharket_Custom.snapshot.json', 'application/json'), 400);
    }
  };

  const handleGenerate = async () => {
    setSnapshotError(false);
    setLastExport(null);
    const content = await onGenerate();
    if (content) await runExport(content);
  };

  const extensionLabel = gameMode === 'ruthless' ? '.ruthlessfilter' : '.filter';

  const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
    { value: 'filter', label: t.exportFilterOnly },
    { value: 'sidecar', label: t.exportWithSidecar },
    { value: 'embedded', label: t.exportEmbedded },
    { value: 'both', label: t.exportBoth },
  ];

  return (
    <div className="export-view">
      <div className="top-bar">
        <h2>{t.exportTitle}</h2>
      </div>

      <div className="content-area">
        <div className="card">
          <h3>{t.exportCardTitle}</h3>
          <p>{t.exportCardDesc.replace('{ext}', extensionLabel)}</p>
          <div className="format-options">
            <div className="format-title">{t.exportFormat}</div>
            {FORMAT_OPTIONS.map(opt => (
              <label key={opt.value} className="format-option">
                <input
                  type="radio"
                  name="export-format"
                  checked={exportFormat === opt.value}
                  onChange={() => setExportFormat(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
            <div className="format-hint">{t.exportFormatHint}</div>
          </div>
          <div className="btn-group">
            <button onClick={handleGenerate} disabled={loading} className="generate-btn">
              {loading ? t.exportGenerating : t.exportGenerate}
            </button>
          </div>
          {message && <div className="log-output">{message}</div>}
          {snapshotError && <div className="snapshot-error">{t.exportSnapshotFailed}</div>}
          {lastExport && (
            <div className="redownload-row">
              <div className="redownload-hint">{t.exportBrowserBlockHint}</div>
              <button
                className="redownload-btn"
                onClick={() => downloadBlob(lastExport.filterText, lastExport.filterName)}
              >
                {t.exportRedownloadFilter}
              </button>
              {lastExport.snapshotJson && (
                <button
                  className="redownload-btn"
                  onClick={() => downloadBlob(lastExport.snapshotJson!, 'Sharket_Custom.snapshot.json', 'application/json')}
                >
                  {t.exportRedownloadSnapshot}
                </button>
              )}
            </div>
          )}
        </div>

        <ImportPanel language={language} />
      </div>

      <style>{`
        .export-view { display: flex; flex-direction: column; height: 100%; flex: 1; }
        .top-bar { padding: 10px 20px; background: white; border-bottom: 1px solid #ddd; }
        .top-bar h2 { margin: 0; font-size: 1.2rem; }
        .export-view .content-area { padding: 40px; background: #f0f0f0; flex: 1; overflow-y: auto; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; text-align: center; }
        .format-options { text-align: left; margin: 20px auto 0; max-width: 420px; }
        .format-title { font-weight: bold; font-size: 0.9rem; color: #333; margin-bottom: 6px; }
        .format-option { display: flex; align-items: center; gap: 8px; padding: 4px 2px; cursor: pointer; font-size: 0.9rem; color: #222; }
        .format-hint { font-size: 0.78rem; color: #888; margin-top: 6px; }
        .btn-group { display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 20px; }
        .generate-btn { background-color: #4CAF50; color: white; border: none; padding: 12px 24px; font-size: 1rem; border-radius: 4px; cursor: pointer; width: 250px; font-weight: bold; }
        .generate-btn:disabled { background-color: #ccc; }
        .log-output { margin-top: 20px; padding: 15px; background: #333; color: #0f0; font-family: monospace; text-align: left; border-radius: 4px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
        .snapshot-error { margin-top: 12px; padding: 10px 14px; background: #fff3f3; border: 1px solid #e57373; color: #b71c1c; border-radius: 4px; font-size: 0.85rem; text-align: left; }
        .redownload-row { margin-top: 16px; padding-top: 14px; border-top: 1px dashed #ddd; display: flex; flex-direction: column; gap: 8px; align-items: center; }
        .redownload-hint { font-size: 0.78rem; color: #888; }
        .redownload-btn { background: #2196F3; color: white; border: none; padding: 8px 18px; font-size: 0.85rem; border-radius: 4px; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default ExportView;
