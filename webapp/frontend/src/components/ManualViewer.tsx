import React, { useState } from 'react';
import type { Language } from '../utils/localization';
import ManualContent from './ManualContent';

// Modal reader for the bundled user manual. The markdown rendering itself lives in
// ManualContent (shared with the Overview page); this just wraps it in the overlay
// + header chrome.

interface ManualViewerProps {
  language: Language;
  onClose: () => void;
}

const ManualViewer: React.FC<ManualViewerProps> = ({ language, onClose }) => {
  const [doc, setDoc] = useState<Language>(language);

  return (
    <div className="manual-overlay" onClick={onClose}>
      <div className="manual-panel" onClick={(e) => e.stopPropagation()}>
        <div className="manual-header">
          <span className="manual-title">📖 {doc === 'ch' ? '用户手册' : 'User Manual'}</span>
          <div className="manual-lang-toggle">
            <button className={doc === 'ch' ? 'active' : ''} onClick={() => setDoc('ch')}>中文</button>
            <button className={doc === 'en' ? 'active' : ''} onClick={() => setDoc('en')}>EN</button>
          </div>
          <button className="manual-close" onClick={onClose}>✕</button>
        </div>
        <div className="manual-body-wrap">
          <ManualContent doc={doc} onDocChange={setDoc} />
        </div>
      </div>

      <style>{`
        .manual-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center; z-index: 3100;
        }
        .manual-panel {
          background: white; border-radius: 8px; width: min(960px, 94vw); height: 90vh;
          display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.45);
          overflow: hidden;
        }
        .manual-header {
          display: flex; align-items: center; gap: 14px; padding: 12px 18px;
          background: #2c2c2c; color: white; flex-shrink: 0;
        }
        .manual-title { font-weight: bold; font-size: 1.05rem; flex: 1; }
        .manual-lang-toggle { display: flex; gap: 4px; }
        .manual-lang-toggle button {
          padding: 3px 12px; border-radius: 14px; border: 1px solid #555;
          background: #3a3a3a; color: #bbb; cursor: pointer; font-size: 0.78rem;
        }
        .manual-lang-toggle button.active { background: #2196F3; border-color: #2196F3; color: white; }
        .manual-close {
          background: none; border: none; color: #aaa; font-size: 1.1rem;
          cursor: pointer; padding: 2px 6px;
        }
        .manual-close:hover { color: white; }
        .manual-body-wrap { flex: 1; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default ManualViewer;
