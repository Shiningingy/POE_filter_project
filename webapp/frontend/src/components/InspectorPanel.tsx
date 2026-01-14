import React from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { generateFilterText } from '../utils/styleResolver';

interface InspectorPanelProps {
  inspectedTier: { name: string; key: string; style: any; visibility: boolean } | null;
  clipboardStyle: any;
  onClearClipboard: () => void;
  onCopyStyle: (style: any) => void;
  onPasteStyle: (tierKey: string, style: any) => void;
  language: Language;
  viewerBackground: string;
  setViewerBackground: (bg: string) => void;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ 
  inspectedTier, 
  clipboardStyle, 
  onClearClipboard,
  onCopyStyle,
  onPasteStyle,
  language,
  viewerBackground,
  setViewerBackground
}) => {
  const t = useTranslation(language);

  const backgrounds = [
    { id: 'Item_bg_coast.jpg', name: t.coast },
    { id: 'Item_bg_forest.jpg', name: t.forest },
    { id: 'Item_bg_sand.jpg', name: t.sand }
  ];

  const filterText = inspectedTier 
    ? generateFilterText(inspectedTier.style, inspectedTier.name, ["Item Name"], inspectedTier.visibility)
    : "";

  const handleCopyCode = () => {
    if (filterText) {
      navigator.clipboard.writeText(filterText);
      alert("Code copied!");
    }
  };

  return (
    <div className="inspector-panel">
      <div className="inspector-section">
        <h3>{t.inspector}</h3>
        {inspectedTier ? (
          <div className="inspected-info">
            <div className="tier-header-row">
                <div className="tier-id">{inspectedTier.name}</div>
            </div>
            
            <div className="tier-action-group">
                <button 
                    className="action-btn-full" 
                    onClick={() => onCopyStyle(inspectedTier.style)}
                >
                    📋 {t.copyStyle}
                </button>
                <button 
                    className="action-btn-full" 
                    onClick={() => onPasteStyle(inspectedTier.key, clipboardStyle)}
                    disabled={!clipboardStyle}
                >
                    📥 {t.pasteStyle}
                </button>
            </div>

            <div className="code-header">
                <span>{t.rawFilter}</span>
                <button onClick={handleCopyCode} className="copy-code-link">{t.copyText}</button>
            </div>
            <pre className="code-block">{filterText}</pre>
          </div>
        ) : (
          <div className="empty-state">Hover/Click a tier to inspect</div>
        )}
      </div>

      <div className="inspector-section">
        <h3>{t.viewerSettings}</h3>
        <div className="bg-switcher">
            <label>{t.background}</label>
            <div className="bg-options">
                {backgrounds.map(bg => (
                    <button 
                        key={bg.id}
                        className={`bg-btn ${viewerBackground === bg.id ? 'active' : ''}`}
                        onClick={() => setViewerBackground(bg.id)}
                    >
                        {bg.name}
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="inspector-section">
        <div className="section-header">
            <h3>{t.styleClipboard}</h3>
            {clipboardStyle && (
                <button className="clear-btn" onClick={onClearClipboard}>{t.clearClipboard}</button>
            )}
        </div>
        {clipboardStyle ? (
          <div className="clipboard-preview">
            <div className="preview-swatch" style={{
                color: clipboardStyle.TextColor?.substring(0, 7),
                borderColor: clipboardStyle.BorderColor?.substring(0, 7),
                backgroundColor: clipboardStyle.BackgroundColor?.substring(0, 7),
                fontSize: '14px',
                borderStyle: 'solid',
                borderWidth: '1px',
                padding: '10px',
                textAlign: 'center'
            }}>
                {t.itemPreview}
            </div>
            <div className="clipboard-meta">
                FontSize: {clipboardStyle.FontSize}
            </div>
          </div>
        ) : (
          <div className="empty-state">No style copied</div>
        )}
      </div>

      <style>{`
        .inspector-panel {
          width: 350px;
          background: #fff;
          border-left: 1px solid #ddd;
          display: flex;
          flex-direction: column;
          padding: 20px;
          gap: 20px;
          height: 100%;
          overflow-y: auto;
          flex-shrink: 0;
        }
        .inspector-section h3 { margin: 0 0 15px 0; font-size: 1rem; color: #333; border-bottom: 2px solid #eee; padding-bottom: 5px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .section-header h3 { margin: 0; }
        
        .inspected-info { display: flex; flex-direction: column; gap: 15px; }
        .tier-id { font-weight: bold; color: #2196F3; font-size: 1rem; border-left: 4px solid #2196F3; padding-left: 10px; }
        
        .tier-action-group { display: flex; flex-direction: column; gap: 8px; }
        .action-btn-full { 
            display: flex; align-items: center; justify-content: center; gap: 10px;
            background: white; border: 1px solid #ddd; border-radius: 6px; 
            padding: 10px; cursor: pointer; font-size: 0.9rem; color: #444; font-weight: bold;
            transition: all 0.2s;
        }
        .action-btn-full:hover:not(:disabled) { border-color: #2196F3; background: #e3f2fd; color: #2196F3; }
        .action-btn-full:disabled { opacity: 0.4; cursor: not-allowed; }

        .code-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #888; font-weight: bold; margin-top: 10px; }
        .copy-code-link { background: none; border: none; color: #2196F3; cursor: pointer; font-size: 0.8rem; text-decoration: underline; }
        .code-block { 
            background: #1e1e1e; 
            color: #d4d4d4; 
            padding: 15px; 
            border-radius: 4px; 
            font-family: 'Consolas', monospace; 
            font-size: 0.75rem; 
            margin: 0;
            white-space: pre-wrap;
            line-height: 1.4;
            border: 1px solid #333;
            text-align: left;
        }
        
        .clipboard-preview { background: white; padding: 15px; border-radius: 6px; border: 1px solid #ddd; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .clipboard-meta { margin-top: 10px; font-size: 0.8rem; color: #666; }
        .clear-btn { background: none; border: 1px solid #ccc; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; color: #888; }
        
        .empty-state { color: #aaa; font-style: italic; font-size: 0.9rem; padding: 20px; text-align: center; border: 1px dashed #ccc; border-radius: 6px; }

        .bg-switcher { display: flex; flex-direction: column; gap: 10px; }
        .bg-switcher label { font-size: 0.85rem; color: #666; font-weight: bold; }
        .bg-options { display: flex; gap: 5px; }
        .bg-btn { 
            flex: 1; padding: 6px; font-size: 0.75rem; background: white; 
            border: 1px solid #ddd; border-radius: 4px; cursor: pointer;
            color: #333;
            transition: all 0.2s;
        }
        .bg-btn:hover { border-color: #2196F3; color: #2196F3; }
        .bg-btn.active { background: #2196F3; color: white; border-color: #2196F3; }
      `}</style>
    </div>
  );
};

export default InspectorPanel;