import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

// Result summary shown after importing a sound snapshot (merged / applied /
// created / skipped counts + skip reasons + missing-audio list). Purely
// presentational; the bone owns the report data.
const SoundImportReportModal = ({
  report,
  language,
  onClose,
}: {
  report: any;
  language: Language;
  onClose: () => void;
}) => {
  const t = useTranslation(language);
  return (
    <div className="modal-overlay report-overlay" onClick={onClose}>
      <div className="import-report" onClick={e => e.stopPropagation()}>
        <div className="report-header">
          <h3>{t.tsImportReport}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="report-body">
          <div className="report-summary">
            {report.mapMerged > 0 && <span className="pill pill-map">{report.mapMerged} {t.tsMapEntriesMerged}</span>}
            <span className="pill pill-ok">{report.updated.length} {t.tsApplied}</span>
            <span className="pill pill-new">{report.created.length} {t.tsCreated}</span>
            <span className="pill pill-skip">{report.skipped.length} {t.tsSkipped}</span>
          </div>
          {report.skipped.length > 0 && (
            <div className="report-section">
              <h4>{t.tsSkipped}</h4>
              {report.skipped.map((s: any, i: number) => (
                <div key={i} className="report-row">
                  <span className="row-main">{s.rule.comment || s.rule.targets.join(', ')}</span>
                  <span className="row-file">{s.rule.file.replace(/^base_mapping\//, '')}</span>
                  <span className="row-reason">
                    {s.reason === 'file-missing' ? t.tsSkipFileMissing
                      : s.reason === 'target-not-in-file' ? t.tsSkipTargetMissing
                      : t.tsSkipNoMatch}
                  </span>
                </div>
              ))}
            </div>
          )}
          {report.missingAudio.length > 0 && (
            <div className="report-section warn">
              <h4>⚠ {t.tsMissingAudio}</h4>
              {report.missingAudio.map((p: string) => <div key={p} className="report-row"><span className="row-main">{p}</span></div>)}
            </div>
          )}
        </div>
        <div className="report-footer">
          <button className="col-save-btn report-close" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default SoundImportReportModal;
