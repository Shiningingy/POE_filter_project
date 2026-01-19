import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface SoundPickerProps {
  initialPath?: string;
  initialVolume?: number;
  currentSource?: string;
  language: Language;
  onClose: () => void;
  onConfirm: (path: string, volume: number) => void;
}

const SoundPicker: React.FC<SoundPickerProps> = ({
  initialPath = '',
  initialVolume = 300,
  currentSource,
  language,
  onClose,
  onConfirm
}) => {
  const t = useTranslation(language);
  const [defaults, setDefaults] = useState<string[]>([]);
  const [sharket, setSharket] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [customPathInput, setCustomPathInput] = useState(initialPath.startsWith('Sharket') || initialPath.startsWith('Default') ? '' : initialPath);
  const [volume, setVolume] = useState(initialVolume);
  
  const determineTab = (p: string) => {
      if (p.startsWith('Default')) return 'default';
      if (p.startsWith('Sharket')) return 'sharket';
      return 'custom';
  };
  
  const [activeTab, setActiveTab] = useState<'sharket' | 'default' | 'custom'>(determineTab(initialPath));

  useEffect(() => {
    axios.get('/api/sounds/list')
      .then(res => {
        setDefaults(res.data.defaults);
        setSharket(res.data.sharket);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load sounds", err);
        setLoading(false);
      });
  }, []);

  const playPreview = (path: string) => {
    const url = `/sounds/${path.replace(/\\/g, '/')}`;
    const audio = new Audio(url);
    audio.volume = Math.min(Math.max(volume / 300, 0), 1);
    audio.play().catch(e => console.error("Play failed", e));
  };

  const filteredSounds = (activeTab === 'sharket' ? sharket : defaults).filter(s => 
    s.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sound-picker-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{(t as any).soundSelection}</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <div className="sound-picker-body">
          {currentSource && (
              <div className="current-source-badge">
                  Source: {currentSource}
              </div>
          )}

          <div className="volume-section">
            <label>{t.volume}: {volume}</label>
            <input 
              type="range" 
              min="0" 
              max="600" 
              value={volume} 
              onChange={e => setVolume(parseInt(e.target.value))} 
            />
          </div>

          <div className="tabs">
            <button 
                className={activeTab === 'sharket' ? 'active' : ''} 
                onClick={() => setActiveTab('sharket')}
            >
                {t.sharket}
            </button>
            <button 
                className={activeTab === 'default' ? 'active' : ''} 
                onClick={() => setActiveTab('default')}
            >
                {t.default}
            </button>
            <button 
                className={activeTab === 'custom' ? 'active' : ''} 
                onClick={() => setActiveTab('custom')}
            >
                {(t as any).custom}
            </button>
          </div>

          {activeTab === 'custom' ? (
              <div className="custom-path-section">
                  <input 
                      type="text" 
                      placeholder={(t as any).enterPath}
                      value={customPathInput} 
                      onChange={e => {
                          setCustomPathInput(e.target.value);
                          setSelectedPath(e.target.value);
                      }} 
                  />
                  <div className="hint">e.g. MySounds/DropSound.mp3</div>
              </div>
          ) : (
              <>
                <div className="search-bar">
                    <input 
                    type="text" 
                    placeholder={t.search} 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>

                <div className="sound-list">
                    {loading ? <div className="loading">{t.loading}</div> : (
                    filteredSounds.map(path => (
                        <div 
                        key={path} 
                        className={`sound-item ${selectedPath === path ? 'selected' : ''}`}
                        onClick={() => {
                            setSelectedPath(path);
                            playPreview(path);
                        }}
                        >
                        <span className="play-btn">▶</span>
                        <span className="path-text">{path.split('/').pop()}</span>
                        </div>
                    ))
                    )}
                </div>
              </>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>{t.cancel}</button>
          <button 
            className="confirm-btn" 
            disabled={!selectedPath}
            onClick={() => onConfirm(selectedPath, volume)}
          >
            {t.ok}
          </button>
        </div>
      </div>

      <style>{`
        .sound-picker-content {
          background: #fff;
          width: 500px;
          max-height: 80vh;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .modal-header { padding: 15px 20px; background: #f9f9f9; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; color: #333; font-size: 1.1rem; }
        
        .current-source-badge { 
            background: #e8f5e9; color: #2e7d32; padding: 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; border: 1px solid #c8e6c9; 
        }

        .sound-picker-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; overflow: hidden; }
        
        .volume-section { display: flex; flex-direction: column; gap: 5px; }
        .volume-section label { font-size: 0.85rem; font-weight: bold; color: #666; }
        
        .tabs { display: flex; border-bottom: 1px solid #eee; }
        .tabs button { flex: 1; padding: 10px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: #999; font-weight: bold; border-radius: 0; }
        .tabs button.active { color: #2196F3; border-bottom-color: #2196F3; }
        
        .search-bar input, .custom-path-section input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .custom-path-section .hint { font-size: 0.75rem; color: #999; margin-top: 5px; font-style: italic; }
        
        .sound-list { height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; }
        .sound-item { padding: 8px 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-bottom: 1px solid #f9f9f9; }
        .sound-item:hover { background: #f0f7ff; }
        .sound-item.selected { background: #e3f2fd; color: #2196F3; font-weight: bold; }
        .play-btn { color: #2196F3; font-size: 0.8rem; }
        .path-text { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .modal-footer { padding: 15px 20px; background: #f9f9f9; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; }
        .confirm-btn { background: #2196F3; color: white !important; border: none; padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .confirm-btn:disabled { background: #ccc; cursor: not-allowed; }
        .cancel-btn { background: #eee; color: #666 !important; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; }
        .close-x { background: none; border: none; font-size: 1.5rem; color: #ccc; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default SoundPicker;
