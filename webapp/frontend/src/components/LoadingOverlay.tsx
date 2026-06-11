// Reusable loading indicator.
// - fullscreen: app-start splash (covers everything, branded)
// - inline (default): fills its parent panel while that view's data loads
import React from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface LoadingOverlayProps {
  language: Language;
  fullscreen?: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ language, fullscreen, message }) => {
  const t = useTranslation(language);
  const text = message || t.loadingData;

  return (
    <div className={fullscreen ? 'ld-fullscreen' : 'ld-inline'}>
      {fullscreen && <div className="ld-brand">{t.appTitle}</div>}
      <div className="ld-spinner" />
      <div className="ld-text">{text}</div>
      <style>{`
        .ld-fullscreen {
          position: fixed; inset: 0; z-index: 3000;
          background: #2b2b2b; color: #eee;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
        }
        .ld-inline {
          flex: 1; width: 100%; min-height: 160px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
          color: #888; padding: 40px 0;
        }
        .ld-brand { font-size: 1.4rem; font-weight: bold; letter-spacing: 1px; }
        .ld-spinner {
          width: 38px; height: 38px; border-radius: 50%;
          border: 4px solid rgba(128,128,128,0.25); border-top-color: #4CAF50;
          animation: ld-spin 0.9s linear infinite;
        }
        .ld-text { font-size: 0.9rem; }
        @keyframes ld-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default LoadingOverlay;
