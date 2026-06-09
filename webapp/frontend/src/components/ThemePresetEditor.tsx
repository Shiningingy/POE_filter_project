import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation, CLASS_KEY_MAP } from '../utils/localization';
import type { Language } from '../utils/localization';
import SoundPicker from './SoundPicker';
import { getAssetUrl } from '../utils/assetUtils';

interface ThemePresetEditorProps {
  language: Language;
  onClose: () => void;
}

interface ImportModalState {
    sourceTheme: string;
    sourceCategory: string;
}

const ThemePresetEditor: React.FC<ThemePresetEditorProps> = ({ language, onClose }) => {
  const t = useTranslation(language);
  const [themes, setThemes] = useState<string[]>([]);
  const [activeTheme, setActiveTheme] = useState<string>('sharket'); 
  const [currentThemeInUse, setCurrentThemeInUse] = useState<string>('sharket');
  
  const [baseThemeData, setBaseThemeData] = useState<any>(null);
  const [overridesData, setOverridesData] = useState<any>({});
  
  const [selectedCategory, setSelectedCategory] = useState<string>('Currency');
  
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [unsavedOverrides, setUnsavedOverrides] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importState, setImportState] = useState<ImportModalState>({ sourceTheme: '', sourceCategory: 'Templates' });
  const [previewImportData, setPreviewImportData] = useState<any>(null);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  
  const [viewerBackground, setViewerBackground] = useState<string>('Item_bg_coast.jpg');

  const backgrounds = [
    { id: "Item_bg_coast.jpg", name: language === 'ch' ? "海滩" : "Coast" },
    { id: "Item_bg_forest.jpg", name: language === 'ch' ? "丛林" : "Forest" },
    { id: "Item_bg_sand.jpg", name: language === 'ch' ? "沙漠" : "Sand" },
    { id: "color_black", name: language === 'ch' ? "黑" : "Black" },
    { id: "color_white", name: language === 'ch' ? "白" : "White" },
    { id: "color_grey", name: language === 'ch' ? "灰" : "Grey" }
  ];

  // Initial Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [themesRes, settingsRes, overridesRes] = await Promise.all([
            axios.get('/api/themes'),
            axios.get('/api/settings'),
            axios.get('/api/custom-overrides')
        ]);
        setThemes(themesRes.data.themes || []);
        const base = settingsRes.data.base_theme || 'sharket';
        setCurrentThemeInUse(base);
        setActiveTheme(base); 
        setOverridesData(overridesRes.data || {});
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, []);

  // Fetch Base Theme Data
  useEffect(() => {
    if (!activeTheme) return;
    const fetchBaseTheme = async () => {
      try {
        const res = await axios.get(`/api/themes/${activeTheme}`);
        let data = res.data.theme_data;
        if (!data['Templates']) {
            const source = data['Currency'] || data['Stackable Currency'] || {};
            data['Templates'] = JSON.parse(JSON.stringify(source));
            for (let i = 0; i <= 9; i++) {
                if (!data['Templates'][`Tier ${i}`]) data['Templates'][`Tier ${i}`] = { FontSize: 32, TextColor: '#ffffff', BackgroundColor: '#000000aa' };
            }
        }
        setBaseThemeData(data);
      } catch (e) { console.error(e); } 
    };
    fetchBaseTheme();
  }, [activeTheme]);

  // Compute Merged Data
  const mergedThemeData = useMemo(() => {
      if (!baseThemeData) return null;
      const merged = JSON.parse(JSON.stringify(baseThemeData));
      Object.keys(overridesData).forEach(cat => {
          if (!merged[cat]) merged[cat] = {};
          Object.keys(overridesData[cat]).forEach(tier => {
              merged[cat][tier] = { ...merged[cat][tier], ...overridesData[cat][tier] };
          });
      });
      return merged;
  }, [baseThemeData, overridesData]);

  // Helpers
  const getLocalizedCategory = (cat: string) => (t as any)[CLASS_KEY_MAP[cat] || cat] || cat;

  const getTiers = (data: any, cat: string) => {
      if (!data || !data[cat]) return [];
      return Object.keys(data[cat]).filter(k => k.startsWith('Tier')).sort((a, b) => {
          const nA = parseInt(a.match(/Tier (\d+)/)?.[1] || '99');
          const nB = parseInt(b.match(/Tier (\d+)/)?.[1] || '99');
          return nA - nB;
      });
  };

  const previewItems = useMemo(() => {
    if (!mergedThemeData || !mergedThemeData[selectedCategory]) return [];
    return getTiers(mergedThemeData, selectedCategory).map(tier => ({
        name: `${selectedCategory} ${tier}`,
        tierKey: tier,
        style: mergedThemeData[selectedCategory][tier],
        isOverridden: overridesData[selectedCategory]?.[tier] !== undefined
    }));
  }, [mergedThemeData, selectedCategory, overridesData]);

  const activeStyle = useMemo(() => {
      if (isBulkEditing && previewItems.length > 0) return previewItems[0].style; 
      else if (editingTier && mergedThemeData && mergedThemeData[selectedCategory]) return mergedThemeData[selectedCategory][editingTier];
      return null;
  }, [isBulkEditing, previewItems, editingTier, mergedThemeData, selectedCategory]);

  // Actions
  const updateOverride = (cat: string, tier: string, key: string, value: any) => {
      setOverridesData((prev: any) => {
          const newData = { ...prev };
          if (!newData[cat]) newData[cat] = {};
          if (!newData[cat][tier]) newData[cat][tier] = {};
          newData[cat][tier][key] = value;
          return newData;
      });
      setUnsavedOverrides(true);
  };

  const handleUpdateStyle = (key: string, value: any) => {
      if (isBulkEditing) {
          if (!selectedCategory || !mergedThemeData) return;
          getTiers(mergedThemeData, selectedCategory).forEach(tier => updateOverride(selectedCategory, tier, key, value));
      } else {
          if (!editingTier || !selectedCategory) return;
          updateOverride(selectedCategory, editingTier, key, value);
      }
  };

  // Import Logic
  useEffect(() => {
      if (!showImportModal || !importState.sourceTheme) return;
      const fetchPreview = async () => {
          try {
              const res = await axios.get(`/api/themes/${importState.sourceTheme}`);
              setPreviewImportData(res.data.theme_data);
          } catch (e) { console.error(e); }
      };
      fetchPreview();
  }, [showImportModal, importState.sourceTheme]);

  const handleConfirmImport = () => {
      if (!previewImportData) return;
      const sourceStyles = previewImportData[importState.sourceCategory] || previewImportData['Templates'];
      if (!sourceStyles) return;

      const targetTiers = getTiers(mergedThemeData, selectedCategory).length > 0 
          ? getTiers(mergedThemeData, selectedCategory)
          : getTiers(previewImportData, importState.sourceCategory);

      setOverridesData((prev: any) => {
          const newData = { ...prev };
          if (!newData[selectedCategory]) newData[selectedCategory] = {};
          targetTiers.forEach(tier => {
              if (sourceStyles[tier]) {
                  newData[selectedCategory][tier] = { ...sourceStyles[tier] };
              }
          });
          return newData;
      });
      setUnsavedOverrides(true);
      setShowImportModal(false);
  };

  const getBackgroundStyle = () => {
      if (viewerBackground.startsWith('color_')) {
          const c = viewerBackground.split('_')[1];
          if (c === 'grey') return { backgroundColor: '#333' };
          if (c === 'white') return { backgroundColor: '#fff' };
          return { backgroundColor: '#000' };
      }
      return { backgroundImage: `url('${getAssetUrl(`assets/item_bg/${viewerBackground}`)}')`, backgroundSize: 'cover' };
  };

  const BackgroundSwitcher = () => (
    <div className="bg-picker">
        {backgrounds.map(bg => (
            <button 
              key={bg.id} 
              className={`bg-btn ${viewerBackground === bg.id ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setViewerBackground(bg.id); }}
              title={bg.name}
            >
                {bg.name}
            </button>
        ))}
    </div>
  );

  return (
    <div className="theme-editor-modal modal-overlay">
      <div className="modal-content main-content-frame">
        <div className="modal-header">
          <div className="header-left">
            <h2>🎨 {language === 'ch' ? "外观预设编辑器" : "Theme Editor"}</h2>
            <div className="theme-selector-wrap">
                <span className="label">{language === 'ch' ? "基础主题:" : "Base Theme:"}</span>
                <select className="theme-select" value={activeTheme} onChange={(e) => setActiveTheme(e.target.value)}>
                    {themes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="apply-btn primary-action-btn" onClick={async () => {
                    await axios.post('/api/settings', { base_theme: activeTheme });
                    setCurrentThemeInUse(activeTheme);
                    alert("Base Theme Applied!");
                }}>{activeTheme === currentThemeInUse ? '✅' : (language === 'ch' ? "应用基础" : "Apply Base")}</button>
            </div>
            {unsavedOverrides && <span className="unsaved-badge">● {language === 'ch' ? "未保存的修改" : "Unsaved Overrides"}</span>}
          </div>
          <div className="header-actions">
             <button className="save-btn primary-action-btn" disabled={!unsavedOverrides} onClick={async () => {
                 await axios.post('/api/custom-overrides', overridesData);
                 setUnsavedOverrides(false);
                 alert("Saved!");
             }}>💾 {language === 'ch' ? "保存覆盖" : "Save Overrides"}</button>
             <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="editor-layout">
          <div className="category-sidebar">
            <div className="category-list">
              {mergedThemeData && Object.keys(mergedThemeData).sort((a, b) => (a === 'Templates' ? -1 : b === 'Templates' ? 1 : a.localeCompare(b))).map(cat => (
                <div 
                  key={cat} 
                  className={`category-item ${selectedCategory === cat ? 'active' : ''} ${cat === 'Templates' ? 'template-category' : ''}`}
                  onClick={() => { setSelectedCategory(cat); setEditingTier(null); setIsBulkEditing(false); }}
                >
                  {cat === 'Templates' ? (language === 'ch' ? "★ 全局模板" : "★ Global Templates") : getLocalizedCategory(cat)}
                  {overridesData[cat] && <span className="override-dot">•</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="preview-area" onClick={() => { setEditingTier(null); setIsBulkEditing(false); }} style={getBackgroundStyle()}>
            <div className="preview-header">
              <h3>{getLocalizedCategory(selectedCategory)}</h3>
              <BackgroundSwitcher />
              <button className={`bulk-edit-btn primary-action-btn ${isBulkEditing ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setIsBulkEditing(!isBulkEditing); setEditingTier(null); }}>
                {language === 'ch' ? "批量编辑 / 导入" : "Bulk Edit / Import"}
              </button>
            </div>
            
            <div className={`preview-grid ${isBulkEditing ? 'bulk-mode' : ''}`}>
                {previewItems.map((item: any) => (
                  <div key={item.tierKey} className={`preview-row ${editingTier === item.tierKey ? 'editing' : ''}`} onClick={(e) => { 
                        if (isBulkEditing) return; e.stopPropagation(); setEditingTier(item.tierKey); 
                    }}>
                    <span className="tier-label">{item.tierKey}{item.isOverridden && '*'}</span>
                    <div className="poe-item-preview" style={{
                        fontSize: `${(item.style.FontSize || 32) * 0.8}px`,
                        color: item.style.TextColor || '#fff',
                        backgroundColor: item.style.BackgroundColor || 'transparent',
                        borderColor: item.style.BorderColor || 'transparent',
                        borderWidth: '1px', borderStyle: 'solid', padding: '5px 10px'
                    }}>{item.name}</div>
                  </div>
                ))}
            </div>
          </div>

          {activeStyle && (
            <div className="style-editor-panel" onClick={e => e.stopPropagation()}>
              <div className="panel-header">
                <h3>{isBulkEditing ? (language === 'ch' ? "批量编辑" : "Bulk Edit") : (language === 'ch' ? `编辑: ${editingTier}` : `Editing: ${editingTier}`)}</h3>
              </div>
              
              {isBulkEditing && (
                  <div className="bulk-actions">
                      <button className="import-modal-btn" onClick={() => setShowImportModal(true)}>
                          📥 {language === 'ch' ? "从其他主题导入系列..." : "Import Series from Theme..."}
                      </button>
                  </div>
              )}

              {(!isBulkEditing || showImportModal === false) && (
                  <>
                    <div className="control-group">
                        <label>{t.fontSize}</label>
                        <input type="number" value={activeStyle.FontSize || 32} onChange={(e) => handleUpdateStyle('FontSize', parseInt(e.target.value))} />
                    </div>
                    {['TextColor', 'BackgroundColor', 'BorderColor'].map(k => (
                        <div className="control-group" key={k}>
                            <label>{(t as any)[k] || k}</label>
                            <div className="color-input-wrapper">
                                <input type="color" value={(activeStyle[k] || '#000000').slice(0, 7)} onChange={e => handleUpdateStyle(k, e.target.value + (activeStyle[k]?.slice(7) || 'ff'))} />
                                <input type="text" value={activeStyle[k] || ''} onChange={e => handleUpdateStyle(k, e.target.value)} />
                            </div>
                        </div>
                    ))}
                    <div className="control-group">
                        <label>{t.sound}</label>
                        <div className="sound-display-box" onClick={() => setShowSoundPicker(true)}>
                            <span className="sound-icon">🎵</span>
                            <span className="sound-name">
                                {activeStyle.PlayAlertSound ? (activeStyle.PlayAlertSound[0].split('/').pop()) : (language === 'ch' ? "未指定" : "None")}
                            </span>
                        </div>
                    </div>
                  </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Centered Import Modal */}
      {showImportModal && (
          <div className="modal-overlay import-overlay" onClick={() => setShowImportModal(false)}>
              <div className="modal-content import-content" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <div className="header-left">
                        <h3>{language === 'ch' ? "导入样式系列" : "Import Style Series"}</h3>
                        <BackgroundSwitcher />
                    </div>
                    <button className="close-x" onClick={() => setShowImportModal(false)}>×</button>
                  </div>
                  
                  <div className="import-body">
                    <div className="import-controls">
                        <div className="control-col">
                            <label>{language === 'ch' ? "来源主题" : "Source Theme"}</label>
                            <select value={importState.sourceTheme} onChange={e => setImportState({...importState, sourceTheme: e.target.value})}>
                                <option value="">-- Select Theme --</option>
                                {themes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="control-col">
                            <label>{language === 'ch' ? "来源分类" : "Source Category"}</label>
                            <select value={importState.sourceCategory} onChange={e => setImportState({...importState, sourceCategory: e.target.value})}>
                                <option value="Templates">{language === 'ch' ? "★ 全局模板" : "★ Global Templates"}</option>
                                {previewImportData && Object.keys(previewImportData).sort().filter(c => c !== 'Templates').map(c => (
                                    <option key={c} value={c}>{getLocalizedCategory(c)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="preview-compare">
                        <div className="col" style={getBackgroundStyle()}>
                            <h4>Current ({activeTheme})</h4>
                            <div className="mini-list">
                                {previewItems.map(i => (
                                    <div key={i.tierKey} className="mini-preview" style={{
                                        color: i.style.TextColor, backgroundColor: i.style.BackgroundColor, borderColor: i.style.BorderColor
                                    }}>{i.tierKey}</div>
                                ))}
                            </div>
                        </div>
                        <div className="col arrow">➔</div>
                        <div className="col" style={getBackgroundStyle()}>
                            <h4>New ({importState.sourceTheme || '...'})</h4>
                            <div className="mini-list">
                                {previewImportData && (previewImportData[importState.sourceCategory] || previewImportData['Templates']) ? (
                                    getTiers(previewImportData, importState.sourceCategory).map(t => {
                                        const s = (previewImportData[importState.sourceCategory] || previewImportData['Templates'])[t];
                                        return (
                                            <div key={t} className="mini-preview" style={{
                                                color: s.TextColor, backgroundColor: s.BackgroundColor, borderColor: s.BorderColor
                                            }}>{t}</div>
                                        );
                                    })
                                ) : (
                                    <div className="missing-notice">{language === 'ch' ? "请选择来源主题" : "Select a source theme"}</div>
                                )}
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                      <button className="cancel-btn" onClick={() => setShowImportModal(false)}>{t.cancel}</button>
                      <button className="confirm-btn primary-action-btn" onClick={handleConfirmImport} disabled={!importState.sourceTheme}>{language === 'ch' ? "确认应用" : "Confirm Import"}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Centered Sound Picker */}
      {showSoundPicker && (
          <div className="modal-overlay sound-overlay" onClick={() => setShowSoundPicker(false)}>
              <div className="picker-wrapper" onClick={e => e.stopPropagation()}>
                <SoundPicker 
                    language={language}
                    onClose={() => setShowSoundPicker(false)}
                    initialPath={activeStyle?.PlayAlertSound?.[0]}
                    onConfirm={(path, vol) => {
                        handleUpdateStyle('PlayAlertSound', [path, vol]);
                        setShowSoundPicker(false);
                    }}
                />
              </div>
          </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        
        .theme-editor-modal .modal-content { background: #fff; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
        .theme-editor-modal .main-content-frame { width: 95%; height: 95%; }
        
        .modal-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff; flex-shrink: 0; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        
        .theme-selector-wrap { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 4px 12px; border-radius: 6px; border: 1px solid #ddd; }
        .theme-selector-wrap .label { font-size: 0.8rem; font-weight: bold; color: #666; }
        .theme-select { padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 0.95rem; font-weight: bold; background: white !important; color: black !important; }
        
        .primary-action-btn { background: #2196F3 !important; color: white !important; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .primary-action-btn:hover { background: #1976D2 !important; }
        .primary-action-btn:disabled { background: #e0e0e0 !important; color: #aaa !important; cursor: not-allowed; }

        .editor-layout { display: flex; flex: 1; overflow: hidden; background: #f0f2f5; }
        
        .category-sidebar { width: 220px; border-right: 1px solid #ddd; display: flex; flex-direction: column; background: #fff; }
        .category-list { flex: 1; overflow-y: auto; padding: 10px; }
        .category-item { padding: 10px 15px; cursor: pointer; border-radius: 6px; margin-bottom: 2px; color: #444; font-weight: 500; font-size: 0.9rem; display: flex; justify-content: space-between; transition: background 0.2s; }
        .category-item:hover { background: #f5f5f5; }
        .category-item.active { background: #2196F3; color: white; }
        .template-category { color: #d32f2f; font-weight: bold; background: #fff8f8; border-left: 4px solid #d32f2f; }
        .override-dot { color: #ff9800; font-weight: bold; font-size: 1.5rem; line-height: 0.5; }
        
        .preview-area { flex: 1; padding: 30px; overflow-y: auto; background-color: #111; color: #eee; display: flex; flex-direction: column; align-items: center; background-size: cover; background-position: center; transition: background 0.3s; }
        .preview-header { width: 100%; max-width: 700px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 15px; }
        .theme-badge { background: #222; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; color: #888; border: 1px solid #333; }
        
        .bg-picker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; background: rgba(255,255,255,0.1); border-radius: 6px; }
        .bg-btn { padding: 4px 8px; font-size: 0.7rem; border: 1px solid #555; background: #333; color: #aaa; border-radius: 4px; cursor: pointer; font-weight: bold; white-space: nowrap; }
        .bg-btn.active { border-color: #2196F3; color: white; background: #2196F3; }
        
        .preview-grid { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 700px; }
        .preview-row { display: flex; align-items: center; gap: 20px; padding: 12px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: background 0.2s; }
        .preview-row:hover { background: rgba(255,255,255,0.1); }
        .preview-row.editing { background: #222; border-color: #2196F3; }
        
        .tier-label { width: 90px; text-align: right; color: #ccc; text-shadow: 1px 1px 2px black; font-family: monospace; font-size: 0.85rem; font-weight: bold; }
        .poe-item-preview { font-family: 'Fontin', sans-serif; display: inline-block; min-width: 350px; text-align: center; }
        
        .style-editor-panel { width: 320px; background: #fff; border-left: 1px solid #ddd; padding: 25px; overflow-y: auto; flex-shrink: 0; }
        .panel-header { margin-bottom: 25px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px; }
        .panel-header h3 { margin: 0; color: #333; font-size: 1.1rem; }
        
        .control-group { margin-bottom: 20px; }
        .control-group label { display: block; font-size: 0.8rem; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 8px; }
        .control-group input[type="number"], .control-group input[type="text"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; background: white !important; color: black !important; }
        .color-input-wrapper { display: flex; gap: 8px; align-items: center; }
        .color-input-wrapper input[type="color"] { width: 45px; height: 40px; padding: 0; border: none; background: none; cursor: pointer; }
        
        .sound-display-box { padding: 12px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: #fafafa; display: flex; align-items: center; gap: 10px; transition: background 0.2s; }
        .sound-display-box:hover { background: #f0f7ff; border-color: #2196F3; }
        .sound-name { font-size: 0.85rem; color: #333; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .import-content { width: 800px; height: auto; max-height: 90vh; }
        .import-body { padding: 25px; flex: 1; overflow-y: auto; }
        .import-controls { display: flex; gap: 25px; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #eee; }
        .control-col { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .control-col select { padding: 10px; border-radius: 6px; border: 1px solid #ddd; background: white !important; color: black !important; }
        
        .preview-compare { display: flex; gap: 20px; align-items: stretch; margin-bottom: 20px; }
        .col { flex: 1; border: 1px solid #eee; padding: 15px; border-radius: 8px; background: #fff; display: flex; flex-direction: column; background-size: cover; background-position: center; transition: background 0.3s; }
        .col h4 { margin: 0 0 15px 0; font-size: 0.9rem; color: #666; text-align: center; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px; background: rgba(255,255,255,0.8); border-radius: 4px; }
        .mini-list { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .mini-preview { padding: 8px; text-align: center; font-size: 0.75rem; border-radius: 4px; border: 1px solid transparent; font-weight: bold; }
        .missing-notice { color: #999; text-align: center; padding: 40px 0; font-style: italic; }
        .col.arrow { flex: 0; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #ddd; border: none; background: none; }

        .modal-footer { padding: 15px 25px; background: #f9f9f9; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px; }
        .cancel-btn { background: #f5f5f5; color: #666 !important; border: 1px solid #ddd; padding: 10px 25px; border-radius: 6px; cursor: pointer; }
        .close-btn { background: none; border: none; font-size: 1.5rem; color: #666; padding: 0 10px; cursor: pointer; }
        .close-x { background: none; border: none; font-size: 1.8rem; color: #999; cursor: pointer; }
        .unsaved-badge { color: #ff9800; font-weight: bold; font-size: 0.8rem; margin-left: 10px; }
        .import-modal-btn { width: 100%; padding: 12px; background: #e3f2fd; color: #1565C0; border: 1px dashed #1565C0; border-radius: 6px; cursor: pointer; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default ThemePresetEditor;