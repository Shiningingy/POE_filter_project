import React, { useState } from 'react';
import { useTranslation, type Language } from '../utils/localization';
import SoundBulkEditor from '../components/SoundBulkEditor';
import ThemePresetEditor from '../components/ThemePresetEditor';
import DecoratorEditor from '../components/DecoratorEditor';

interface ThemeViewProps {
  language: Language;
  onJumpToRule?: (filePath: string, ruleIndex?: number) => void;
}

const ThemeView: React.FC<ThemeViewProps> = ({ language, onJumpToRule }) => {
  const t = useTranslation(language);
  const [showSoundBulkEditor, setShowSoundBulkEditor] = useState(false);
  const [showThemePresetEditor, setShowThemePresetEditor] = useState(false);
  const [showDecoratorEditor, setShowDecoratorEditor] = useState(false);

  return (
    <div className="theme-view">
      <div className="theme-view-header">
        <h2>{t.themeSoundManagement}</h2>
        <p className="subtitle">
          {t.manageGlobalThemePresetsSound}
        </p>
      </div>

      <div className="management-grid">
        {/* Sound Management Section */}
        <div className="management-card">
          <div className="card-icon">🎵</div>
          <div className="card-content">
            <h3>{t.soundManagement}</h3>
            <p>{t.bulkEditItemSoundMappings}</p>
            <button className="manage-btn" onClick={() => setShowSoundBulkEditor(true)}>
              {t.openSoundBulkEditor}
            </button>
          </div>
        </div>

        {/* Theme Presets Section */}
        <div className="management-card">
          <div className="card-icon">🎨</div>
          <div className="card-content">
            <h3>{t.themePresets}</h3>
            <p>{t.viewAndSwitchGlobalTheme}</p>
            <button className="manage-btn" onClick={() => setShowThemePresetEditor(true)}>
              {t.openThemeEditor}
            </button>
          </div>
        </div>
        {/* State Decorators. Deliberately here and not in the nav: every nav leaf is a
            slice of item space, while a decorator is a LAYER over all of them — and it
            belongs beside the preset it composes with. */}
        <div className="management-card">
          <div className="card-icon">🩹</div>
          <div className="card-content">
            <h3>{t.stateDecorators}</h3>
            <p>{t.corruptedFracturedAndFriendsAuthored}</p>
            <button className="manage-btn" onClick={() => setShowDecoratorEditor(true)}>
              {t.openDecoratorEditor}
            </button>
          </div>
        </div>
      </div>

      {showDecoratorEditor && (
        <DecoratorEditor language={language} onClose={() => setShowDecoratorEditor(false)} />
      )}

      {showSoundBulkEditor && (
        <SoundBulkEditor
          language={language}
          onClose={() => setShowSoundBulkEditor(false)}
          onJumpToRule={onJumpToRule}
          onSave={() => {
            // Logic to refresh if needed
          }}
        />
      )}

      {showThemePresetEditor && (
        <ThemePresetEditor
          language={language}
          onClose={() => setShowThemePresetEditor(false)}
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
