import React, { useState } from 'react';
import type { Language } from '../utils/localization';
import SoundBulkEditor from '../components/SoundBulkEditor';

interface ThemeViewProps {
  language: Language;
}

const ThemeView: React.FC<ThemeViewProps> = ({ language }) => {
  const [showSoundBulkEditor, setShowSoundBulkEditor] = useState(false);

  return (
    <div className="theme-view">
      <div className="theme-view-header">
        <h2>{language === 'ch' ? "外观与音效管理" : "Theme & Sound Management"}</h2>
        <p className="subtitle">
          {language === 'ch' 
            ? "在此管理全局外观预设、音效映射以及自动音效逻辑。" 
            : "Manage global theme presets, sound mappings, and auto-sound logic here."}
        </p>
      </div>

      <div className="management-grid">
        {/* Sound Management Section */}
        <div className="management-card">
          <div className="card-icon">🎵</div>
          <div className="card-content">
            <h3>{language === 'ch' ? "音效管理" : "Sound Management"}</h3>
            <p>{language === 'ch' ? "使用看板方式批量编辑物品的音效映射。" : "Bulk edit item sound mappings using a Kanban-style interface."}</p>
            <button className="manage-btn" onClick={() => setShowSoundBulkEditor(true)}>
              {language === 'ch' ? "打开音效批量编辑器" : "Open Sound Bulk Editor"}
            </button>
          </div>
        </div>

        {/* Theme Presets Section (Placeholder) */}
        <div className="management-card disabled">
          <div className="card-icon">🎨</div>
          <div className="card-content">
            <h3>{language === 'ch' ? "外观预设 (开发中)" : "Theme Presets (WIP)"}</h3>
            <p>{language === 'ch' ? "快速应用全局外观模板到特定类别。" : "Quickly apply global theme templates to specific categories."}</p>
            <button className="manage-btn" disabled>
              {language === 'ch' ? "尚未开放" : "Coming Soon"}
            </button>
          </div>
        </div>
      </div>

      {showSoundBulkEditor && (
        <SoundBulkEditor 
          language={language}
          onClose={() => setShowSoundBulkEditor(false)}
          onSave={() => {
            // Logic to refresh if needed
          }}
        />
      )}

      <style>{`
        .theme-view {
          padding: 40px;
          background: #f0f2f5;
          height: 100%;
          overflow-y: auto;
        }
        .theme-view-header {
          margin-bottom: 40px;
        }
        .theme-view-header h2 {
          margin: 0;
          font-size: 1.8rem;
          color: #333;
        }
        .subtitle {
          color: #666;
          margin-top: 10px;
        }
        
        .management-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 25px;
        }
        
        .management-card {
          background: white;
          border-radius: 12px;
          padding: 25px;
          display: flex;
          gap: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .management-card:hover:not(.disabled) {
          transform: translateY(-5px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        .management-card.disabled {
          opacity: 0.7;
          filter: grayscale(0.5);
        }
        
        .card-icon {
          font-size: 2.5rem;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8f9fa;
          border-radius: 12px;
        }
        
        .card-content {
          flex: 1;
        }
        .card-content h3 {
          margin: 0 0 10px 0;
          font-size: 1.2rem;
          color: #333;
        }
        .card-content p {
          margin: 0 0 20px 0;
          color: #666;
          font-size: 0.9rem;
          line-height: 1.5;
        }
        
        .manage-btn {
          background: #2196F3;
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        }
        .manage-btn:hover:not(:disabled) {
          background: #1976D2;
        }
        .manage-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ThemeView;
