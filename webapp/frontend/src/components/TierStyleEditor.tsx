import React, { useState } from 'react';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import { generateFilterText } from '../utils/styleResolver';

interface StyleProps {
  FontSize?: number;
  TextColor?: string;
  BorderColor?: string;
  BackgroundColor?: string;
  PlayEffect?: string;
  MinimapIcon?: string;
  PlayAlertSound?: [string, number];
}

interface TierStyleEditorProps {
  tierName: string;
  style: StyleProps;
  visibility: boolean; // mapped from hideable: true = Hidden/Minimal, false = Shown
  onChange: (newStyle: StyleProps, newVisibility: boolean) => void;
  language: Language;
}

const TierStyleEditor: React.FC<TierStyleEditorProps> = ({ tierName, style, visibility, onChange, language }) => {
  const t = useTranslation(language);
  const [showTooltip, setShowTooltip] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const handleChange = (key: keyof StyleProps, value: any) => {
    onChange({ ...style, [key]: value }, visibility);
  };

  const toggleVisibility = () => {
    onChange(style, !visibility);
  };

  const rgbaToHex = (rgba: string | undefined) => {
    if (!rgba) return '#000000';
    if (rgba.startsWith('#')) return rgba.substring(0, 7);
    return '#000000'; 
  };

  const hexToRgba = (hex: string) => `${hex}ff`;

  const filterText = generateFilterText(style, tierName, ["Item Name"], visibility);

  const handleCopy = () => {
    navigator.clipboard.writeText(filterText);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className={`tier-style-editor ${visibility ? 'hidden-tier' : ''}`}>
      <div className="header">
        <div className="title-area">
            <h4>{tierName}</h4>
            <button 
                className={`vis-toggle ${visibility ? 'is-hidden' : 'is-shown'}`}
                onClick={toggleVisibility}
            >
                {visibility ? `🚫 ${t.hide}` : `👁 ${t.show}`}
            </button>
        </div>
        
        <div 
          className="preview-container"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={handleCopy}
        >
            <div className="preview-box" style={{
              fontSize: `${(style.FontSize || 32) / 2}px`, 
              color: visibility ? '#555' : (style.TextColor ? style.TextColor.substring(0, 7) : 'white'),
              borderColor: visibility ? '#333' : (style.BorderColor ? style.BorderColor.substring(0, 7) : 'transparent'),
              backgroundColor: visibility ? '#222' : (style.BackgroundColor ? style.BackgroundColor.substring(0, 7) : 'rgba(0,0,0,0.5)'),
              borderStyle: 'solid',
              borderWidth: '1px',
              padding: '4px 16px',
              display: 'inline-block',
              cursor: 'pointer',
              textAlign: 'left',
              opacity: visibility ? 0.6 : 1
            }}>
              {copyFeedback ? "✓ Copied!" : t.itemPreview}
            </div>

            {showTooltip && (
                <div className="filter-tooltip">
                    <pre>{filterText}</pre>
                    <div className="copy-hint">Click to copy raw filter code</div>
                </div>
            )}
        </div>
      </div>

      {!visibility && (
        <div className="controls-grid">
            <label>
            {t.fontSize}:
            <input 
                type="number" 
                value={style.FontSize || 32} 
                onChange={(e) => handleChange('FontSize', parseInt(e.target.value))}
            />
            </label>
            <label>
            {t.textColor}:
            <input 
                type="color" 
                value={rgbaToHex(style.TextColor)} 
                onChange={(e) => handleChange('TextColor', hexToRgba(e.target.value))}
            />
            </label>
            <label>
            {t.borderColor}:
            <input 
                type="color" 
                value={rgbaToHex(style.BorderColor)} 
                onChange={(e) => handleChange('BorderColor', hexToRgba(e.target.value))}
            />
            </label>
            <label>
            {t.bgColor}:
            <input 
                type="color" 
                value={rgbaToHex(style.BackgroundColor)} 
                onChange={(e) => handleChange('BackgroundColor', hexToRgba(e.target.value))}
            />
            </label>
        </div>
      )}

      {!visibility && (
        <div className="sound-section">
            <label className="sound-input">
            🎵 Sound File:
            <div className="input-group">
                <input 
                type="text" 
                placeholder="e.g. Sharket掉落音效/example.mp3" 
                value={style.PlayAlertSound?.[0] || ''} 
                onChange={e => handleChange('PlayAlertSound', [e.target.value, style.PlayAlertSound?.[1] || 300])}
                />
                <input 
                type="number" 
                title="Volume"
                className="vol-input"
                value={style.PlayAlertSound?.[1] || 300} 
                onChange={e => handleChange('PlayAlertSound', [style.PlayAlertSound?.[0] || '', parseInt(e.target.value)])}
                />
            </div>
            </label>
        </div>
      )}

      <style>{`
        .tier-style-editor { border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 4px; background: white; transition: all 0.3s; }
        .tier-style-editor.hidden-tier { background: #f5f5f5; border-color: #eee; }
        
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .title-area { display: flex; align-items: center; gap: 15px; }
        .header h4 { margin: 0; }
        
        .vis-toggle { padding: 4px 12px; border-radius: 20px; border: 1px solid #ddd; cursor: pointer; font-size: 0.8rem; font-weight: bold; }
        .vis-toggle.is-shown { background: #e8f5e9; color: #2e7d32; border-color: #c8e6c9; }
        .vis-toggle.is-hidden { background: #ffebee; color: #c62828; border-color: #ffcdd2; }

        .preview-container { position: relative; }
        .filter-tooltip {
            position: absolute;
            bottom: 100%;
            right: 0;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 4px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            font-family: monospace;
            font-size: 0.75rem;
            z-index: 100;
            min-width: 300px;
            pointer-events: none;
            text-align: left;
        }
        .filter-tooltip pre { margin: 0; white-space: pre-wrap; text-align: left; }
        .copy-hint { border-top: 1px solid #444; margin-top: 8px; padding-top: 5px; font-size: 0.65rem; color: #888; text-align: center; }

        .controls-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 15px; }
        .controls-grid label { display: flex; flex-direction: column; font-size: 0.8rem; color: #666; }
        
        .sound-section { border-top: 1px solid #eee; padding-top: 10px; }
        .sound-input { display: flex; flex-direction: column; font-size: 0.8rem; color: #666; gap: 5px; }
        .input-group { display: flex; gap: 5px; }
        .input-group input[type="text"] { flex-grow: 1; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.8rem; }
        .vol-input { width: 60px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.8rem; }

        input[type="number"], input[type="color"] { margin-top: 4px; padding: 4px; border: 1px solid #ccc; border-radius: 4px; width: 100%; height: 30px; }
      `}</style>
    </div>
  );
};

export default TierStyleEditor;
