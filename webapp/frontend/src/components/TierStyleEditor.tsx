import React from 'react';

interface StyleProps {
  FontSize?: number;
  TextColor?: string;
  BorderColor?: string;
  BackgroundColor?: string;
}

interface TierStyleEditorProps {
  tierName: string;
  style: StyleProps;
  onChange: (newStyle: StyleProps) => void;
}

const TierStyleEditor: React.FC<TierStyleEditorProps> = ({ tierName, style, onChange }) => {
  
  const handleChange = (key: keyof StyleProps, value: any) => {
    onChange({
      ...style,
      [key]: value
    });
  };

  const rgbaToHex = (rgba: string | undefined) => {
    if (!rgba) return '#000000';
    // Handle #RRGGBBAA format which input type="color" might not like fully
    // Input color expects #RRGGBB. Alpha is usually separate or ignored here for simplicity.
    if (rgba.startsWith('#')) return rgba.substring(0, 7);
    return '#000000'; 
  };

  // Helper to convert hex back to #RRGGBBAA (defaulting to FF alpha for now)
  const hexToRgba = (hex: string) => {
    return `${hex}ff`;
  };

  return (
    <div className="tier-style-editor">
      <div className="header">
        <h4>{tierName}</h4>
        <div className="preview-box" style={{
          fontSize: `${(style.FontSize || 32) / 2}px`, // Scale down
          color: style.TextColor ? style.TextColor.substring(0, 7) : 'white', // basic hex for visual
          borderColor: style.BorderColor ? style.BorderColor.substring(0, 7) : 'transparent',
          backgroundColor: style.BackgroundColor ? style.BackgroundColor.substring(0, 7) : 'rgba(0,0,0,0.5)',
          borderStyle: 'solid',
          borderWidth: '1px',
          padding: '4px 8px',
          display: 'inline-block'
        }}>
          Item Preview
        </div>
      </div>

      <div className="controls-grid">
        <label>
          Font Size:
          <input 
            type="number" 
            value={style.FontSize || 32} 
            onChange={(e) => handleChange('FontSize', parseInt(e.target.value))}
          />
        </label>
        <label>
          Text Color:
          <input 
            type="color" 
            value={rgbaToHex(style.TextColor)} 
            onChange={(e) => handleChange('TextColor', hexToRgba(e.target.value))}
          />
        </label>
        <label>
          Border Color:
          <input 
            type="color" 
            value={rgbaToHex(style.BorderColor)} 
            onChange={(e) => handleChange('BorderColor', hexToRgba(e.target.value))}
          />
        </label>
        <label>
          BG Color:
          <input 
            type="color" 
            value={rgbaToHex(style.BackgroundColor)} 
            onChange={(e) => handleChange('BackgroundColor', hexToRgba(e.target.value))}
          />
        </label>
      </div>

      <style>{`
        .tier-style-editor {
          border: 1px solid #ddd;
          padding: 15px;
          margin-bottom: 10px;
          border-radius: 4px;
          background: white;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .header h4 { margin: 0; }
        .controls-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }
        .controls-grid label {
          display: flex;
          flex-direction: column;
          font-size: 0.9rem;
          color: #666;
        }
        input[type="number"], input[type="color"] {
          margin-top: 4px;
          padding: 4px;
          border: 1px solid #ccc;
          border-radius: 4px;
          width: 100%;
          height: 30px;
        }
      `}</style>
    </div>
  );
};

export default TierStyleEditor;
