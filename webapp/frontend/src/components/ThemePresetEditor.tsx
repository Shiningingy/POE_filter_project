import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation, CLASS_KEY_MAP, translations } from '../utils/localization';
import type { Language } from '../utils/localization';

interface ThemePresetEditorProps {
  language: Language;
  onClose: () => void;
}

const ThemePresetEditor: React.FC<ThemePresetEditorProps> = ({ language, onClose }) => {
  const t = useTranslation(language);
  const [themes, setThemes] = useState<string[]>([]);
  const [activeTheme, setActiveTheme] = useState<string>('sharket');
  const [currentThemeInUse, setCurrentThemeInUse] = useState<string>('sharket');
  const [themeData, setThemeData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Currency');
  const [loading, setLoading] = useState(false);
  
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [sourceCategoryForSeries, setSourceCategoryForSeries] = useState<string>('Templates');
  const [showUniformControls, setShowUniformControls] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [themesRes, settingsRes] = await Promise.all([
            axios.get('/api/themes'),
            axios.get('/api/settings')
        ]);
        setThemes(themesRes.data.themes || []);
        const active = settingsRes.data.active_theme || 'sharket';
        setCurrentThemeInUse(active);
        setActiveTheme(active);
      } catch (e) {
        console.error("Failed to fetch initial data", e);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!activeTheme) return;
    const fetchThemeData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/themes/${activeTheme}`);
        let data = res.data.theme_data;
        
        if (!data['Templates']) {
            const source = data['Currency'] || data['Stackable Currency'] || {};
            data['Templates'] = JSON.parse(JSON.stringify(source));
            for (let i = 0; i <= 9; i++) {
                const key = `Tier ${i}`;
                if (!data['Templates'][key]) {
                    data['Templates'][key] = { FontSize: 32, TextColor: '#ffffff', BackgroundColor: '#000000aa' };
                }
            }
        }
        
        setThemeData(data);
        setUnsavedChanges(false);
      } catch (e) {
        console.error("Failed to fetch theme data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchThemeData();
  }, [activeTheme]);

  // Helpers
  const getLocalizedCategory = (cat: string) => {
    return (t as any)[CLASS_KEY_MAP[cat] || cat] || cat;
  };

  const previewItems = useMemo(() => {
    if (!themeData || !themeData[selectedCategory]) return [];
    
    const categoryStyles = themeData[selectedCategory];
    const tiers = Object.keys(categoryStyles)
      .filter(k => k.startsWith('Tier'))
      .sort((a, b) => {
        const getRank = (key: string) => {
            const match = key.match(/Tier (\d+)/);
            if (match) return parseInt(match[1]);
            if (key.includes('Hide')) return 999;
            return 100;
        };
        return getRank(a) - getRank(b);
      });

    return tiers.map(tier => ({
      name: `${selectedCategory} ${tier}`,
      tierKey: tier,
      style: categoryStyles[tier] 
    }));
  }, [themeData, selectedCategory]);

  // Determine Active Style
  const activeStyle = useMemo(() => {
      if (isBulkEditing && previewItems.length > 0) {
          return previewItems[0].style; 
      } else if (editingTier && themeData && themeData[selectedCategory]) {
          return themeData[selectedCategory][editingTier];
      }
      return null;
  }, [isBulkEditing, previewItems, editingTier, themeData, selectedCategory]);

  // Handlers
  const handleSave = async () => {
    if (!themeData) return;
    try {
      await axios.post(`/api/themes/${activeTheme}`, { theme_data: themeData });
      alert(language === 'ch' ? "外观预设已保存！" : "Theme saved successfully!");
      setUnsavedChanges(false);
    } catch (e) {
      alert(language === 'ch' ? "保存失败。" : "Failed to save theme.");
      console.error(e);
    }
  };

  const handleCreateNew = async () => {
      const newName = prompt(language === 'ch' ? "请输入新预设名称:" : "Enter name for new theme:");
      if (!newName) return;
      
      // Basic validation
      if (themes.includes(newName)) {
          alert(language === 'ch' ? "该名称已存在。" : "Theme name already exists.");
          return;
      }
      
      try {
          // Save current data as new theme
          await axios.post(`/api/themes/${newName}`, { theme_data: themeData });
          
          // Refresh list and switch
          const themesRes = await axios.get('/api/themes');
          setThemes(themesRes.data.themes || []);
          setActiveTheme(newName);
          setUnsavedChanges(false);
          alert(language === 'ch' ? "新预设已创建！" : "New theme created!");
      } catch (e) {
          alert("Failed to create theme.");
          console.error(e);
      }
  };

  const handleApply = async () => {
      try {
          await axios.post('/api/settings', { active_theme: activeTheme });
          setCurrentThemeInUse(activeTheme);
          alert(language === 'ch' ? `已应用预设: ${activeTheme}` : `Applied theme: ${activeTheme}`);
      } catch (e) {
          alert("Failed to apply theme");
      }
  };

  const handleApplySeries = () => {
      if (!themeData || !selectedCategory || !sourceCategoryForSeries) return;
      if (!themeData[sourceCategoryForSeries]) return;

      if (!confirm(
          language === 'ch' 
          ? `确定要将 "${getLocalizedCategory(sourceCategoryForSeries)}" 的样式系列应用到 "${getLocalizedCategory(selectedCategory)}" 吗？\n这将覆盖当前分类的所有阶级样式。` 
          : `Are you sure you want to apply the "${getLocalizedCategory(sourceCategoryForSeries)}" series to "${getLocalizedCategory(selectedCategory)}"?\nThis will overwrite styles for all tiers in this category.`
      )) return;

      setThemeData((prev: any) => {
          const newData = { ...prev };
          const sourceStyles = newData[sourceCategoryForSeries];
          const targetTiers = Object.keys(newData[selectedCategory]).filter(k => k.startsWith('Tier'));
          
          targetTiers.forEach(tier => {
              if (sourceStyles[tier]) {
                  newData[selectedCategory][tier] = { ...sourceStyles[tier] };
              } 
          });
          return newData;
      });
      setUnsavedChanges(true);
  };

  const updateStyle = (key: string, value: any) => {
    if (isBulkEditing) {
        if (!selectedCategory || !themeData) return;
        setThemeData((prev: any) => {
            const newData = { ...prev };
            const tiers = Object.keys(newData[selectedCategory]).filter(k => k.startsWith('Tier'));
            tiers.forEach(tier => {
                newData[selectedCategory][tier] = {
                    ...newData[selectedCategory][tier],
                    [key]: value
                };
            });
            return newData;
        });
        setUnsavedChanges(true);
    } else {
        if (!editingTier || !selectedCategory || !themeData) return;
        setThemeData((prev: any) => {
            const newData = { ...prev };
            if (!newData[selectedCategory]) newData[selectedCategory] = {};
            if (!newData[selectedCategory][editingTier]) newData[selectedCategory][editingTier] = {};
            
            newData[selectedCategory][editingTier] = {
                ...newData[selectedCategory][editingTier],
                [key]: value
            };
            return newData;
        });
        setUnsavedChanges(true);
    }
  };

  return (
    <div className="theme-editor-modal modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="header-left">
            <h2>🎨 {language === 'ch' ? "外观预设编辑器" : "Theme Preset Editor"}</h2>
            <div className="theme-selector-wrap">
                <select 
                className="theme-select"
                value={activeTheme}
                onChange={(e) => {
                    if (unsavedChanges && !confirm(language === 'ch' ? "未保存的更改将会丢失。是否继续？" : "Unsaved changes will be lost. Continue?")) return;
                    setActiveTheme(e.target.value);
                }}
                >
                {themes.map(theme => (
                    <option key={theme} value={theme}>{theme}{theme === currentThemeInUse ? ` (${(t as any).current})` : ''}</option>
                ))}
                </select>
                <button 
                    className="icon-btn" 
                    onClick={handleCreateNew} 
                    title={language === 'ch' ? "新建预设 (复制当前)" : "Create New Theme (Clone Current)"}
                >
                    ➕
                </button>
                <button 
                    className="apply-btn" 
                    onClick={handleApply} 
                    disabled={activeTheme === currentThemeInUse}
                    title={t.applyTheme}
                >
                    {activeTheme === currentThemeInUse ? '✅' : (language === 'ch' ? "应用" : "Apply")}
                </button>
            </div>
            {unsavedChanges && <span className="unsaved-badge">● {language === 'ch' ? "未保存" : "Unsaved"}</span>}
          </div>
          <div className="header-actions">
             <button className="save-btn" disabled={!unsavedChanges} onClick={handleSave}>
               {language === 'ch' ? "保存" : "Save"}
             </button>
             <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="editor-layout">
          {/* Sidebar: Categories */}
          <div className="category-sidebar">
            <h3>{language === 'ch' ? "类别" : "Categories"}</h3>
            <div className="category-list">
              {themeData && Object.keys(themeData).sort((a, b) => {
                  if (a === 'Templates') return -1;
                  if (b === 'Templates') return 1;
                  return a.localeCompare(b);
              }).map(cat => (
                <div 
                  key={cat} 
                  className={`category-item ${selectedCategory === cat ? 'active' : ''} ${cat === 'Templates' ? 'template-category' : ''}`}
                  onClick={() => { setSelectedCategory(cat); setEditingTier(null); setIsBulkEditing(false); }}
                >
                  {cat === 'Templates' ? (language === 'ch' ? "★ 全局模板" : "★ Global Templates") : getLocalizedCategory(cat)}
                </div>
              ))}
            </div>
          </div>

          {/* Main: Preview Area */}
          <div className="preview-area" onClick={() => { setEditingTier(null); setIsBulkEditing(false); }}>
            <div className="preview-header">
              <h3>{getLocalizedCategory(selectedCategory)}</h3>
              <div className="actions">
                  <button 
                    className={`bulk-edit-btn ${isBulkEditing ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setIsBulkEditing(!isBulkEditing); setEditingTier(null); }}
                  >
                    {language === 'ch' ? "批量编辑分类" : "Bulk Edit Category"}
                  </button>
                  <span className="theme-badge">{activeTheme}</span>
              </div>
            </div>
            
            {loading ? (
              <div className="loading">Loading...</div>
            ) : (
              <div className={`preview-grid ${isBulkEditing ? 'bulk-mode' : ''}`}>
                {previewItems.map((item: any) => (
                  <div 
                    key={item.tierKey} 
                    className={`preview-row ${editingTier === item.tierKey ? 'editing' : ''}`}
                    onClick={(e) => { 
                        if (isBulkEditing) return;
                        e.stopPropagation(); 
                        setEditingTier(item.tierKey); 
                    }}
                  >
                    <span className="tier-label">{item.tierKey}</span>
                    <div 
                      className="poe-item-preview"
                      style={{
                        fontSize: `${(item.style.FontSize || 32) * 0.8}px`,
                        color: item.style.TextColor || '#fff',
                        backgroundColor: item.style.BackgroundColor || 'transparent',
                        borderColor: item.style.BorderColor || 'transparent',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        padding: '5px 10px',
                        boxShadow: item.style.PlayEffect ? `0 0 10px ${item.style.TextColor || '#fff'}` : 'none' 
                      }}
                    >
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel: Style Editor */}
          {activeStyle && (
            <div className="style-editor-panel" onClick={(e) => e.stopPropagation()}>
              <h3>
                  {isBulkEditing 
                    ? (language === 'ch' ? `批量编辑: ${getLocalizedCategory(selectedCategory)}` : `Bulk Edit: ${getLocalizedCategory(selectedCategory)}`) 
                    : (language === 'ch' ? `编辑: ${editingTier}` : `Editing: ${editingTier}`)
                  }
              </h3>
              
              {isBulkEditing && (
                  <div className="bulk-actions">
                      <div className="series-copier">
                          <h4>{language === 'ch' ? "应用样式系列 (T0 → T0...)" : "Apply Series Pattern (T0 → T0...)"}</h4>
                          <p className="help-text">
                              {language === 'ch'
                                ? "从 '全局模板' 或其他分类复制整套阶级样式。"
                                : "Copy the entire Tier structure from Templates or another category."}
                          </p>
                          <div className="series-controls">
                              <select 
                                value={sourceCategoryForSeries} 
                                onChange={e => setSourceCategoryForSeries(e.target.value)}
                              >
                                  <option value="Templates">{language === 'ch' ? "★ 全局模板" : "★ Global Templates"}</option>
                                  {Object.keys(themeData || {}).sort().filter(c => c !== 'Templates').map(c => (
                                      <option key={c} value={c}>{getLocalizedCategory(c)}</option>
                                  ))}
                              </select>
                              <button className="apply-series-btn" onClick={handleApplySeries}>
                                  {language === 'ch' ? "应用系列" : "Apply Series"}
                              </button>
                          </div>
                      </div>
                      
                      <hr className="separator" />
                      
                      <div 
                        className="toggle-uniform" 
                        onClick={() => setShowUniformControls(!showUniformControls)}
                      >
                          {showUniformControls ? '▼' : '▶'} {language === 'ch' ? "高级: 统一修改所有阶级 (覆盖式)" : "Advanced: Set Uniform Style (Override All)"}
                      </div>
                  </div>
              )}

              {(activeStyle && (!isBulkEditing || showUniformControls)) && (
                <>
                  <div className="control-group">
                    <label>{t.fontSize}</label>
                    <input 
                      type="number" 
                      value={activeStyle.FontSize || 32} 
                      onChange={(e) => updateStyle('FontSize', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="control-group">
                    <label>{t.textColor}</label>
                    <div className="color-input-wrapper">
                      <input 
                        type="color" 
                        value={(activeStyle.TextColor || '#ffffff').slice(0, 7)} 
                        onChange={(e) => updateStyle('TextColor', e.target.value + (activeStyle.TextColor?.slice(7) || 'ff'))}
                      />
                      <input 
                        type="text" 
                        value={activeStyle.TextColor || '#ffffffff'} 
                        onChange={(e) => updateStyle('TextColor', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="control-group">
                    <label>{t.bgColor}</label>
                    <div className="color-input-wrapper">
                      <input 
                        type="color" 
                        value={(activeStyle.BackgroundColor || '#000000').slice(0, 7)} 
                        onChange={(e) => updateStyle('BackgroundColor', e.target.value + (activeStyle.BackgroundColor?.slice(7) || 'ff'))}
                      />
                      <input 
                        type="text" 
                        value={activeStyle.BackgroundColor || '#000000ff'}
                        onChange={(e) => updateStyle('BackgroundColor', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="control-group">
                    <label>{t.borderColor}</label>
                    <div className="color-input-wrapper">
                      <input 
                        type="color" 
                        value={(activeStyle.BorderColor || '#000000').slice(0, 7)} 
                        onChange={(e) => updateStyle('BorderColor', e.target.value + (activeStyle.BorderColor?.slice(7) || 'ff'))}
                      />
                      <input 
                        type="text" 
                        value={activeStyle.BorderColor || '#00000000'}
                        onChange={(e) => updateStyle('BorderColor', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .theme-editor-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal-content { background: #fff; width: 95%; height: 95%; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { padding: 15px 25px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #fff; }
        .header-left { display: flex; align-items: center; gap: 20px; }
        .header-actions { display: flex; align-items: center; gap: 15px; }
        .theme-selector-wrap { display: flex; align-items: center; gap: 10px; background: #f5f5f5; padding: 4px; border-radius: 6px; border: 1px solid #ddd; }
        .theme-select { padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 0.95rem; font-weight: bold; background: white; }
        .apply-btn { padding: 6px 12px; border-radius: 4px; border: none; background: #2196F3; color: white; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
        .apply-btn:disabled { background: #e0e0e0; color: #999; cursor: default; }
        .icon-btn { background: #eee; border: 1px solid #ddd; border-radius: 4px; padding: 5px 10px; cursor: pointer; transition: all 0.2s; }
        .icon-btn:hover { background: #e0e0e0; border-color: #ccc; }
        
        .editor-layout { display: flex; flex: 1; overflow: hidden; }
        
        .category-sidebar { width: 220px; border-right: 1px solid #eee; display: flex; flex-direction: column; background: #f9f9f9; }
        .category-sidebar h3 { padding: 15px; margin: 0; border-bottom: 1px solid #eee; font-size: 0.9rem; color: #666; text-transform: uppercase; }
        .category-list { flex: 1; overflow-y: auto; padding: 10px; }
        .category-item { padding: 8px 12px; cursor: pointer; border-radius: 6px; margin-bottom: 2px; color: #444; font-weight: 500; font-size: 0.9rem; }
        .category-item:hover { background: #e3f2fd; color: #2196F3; }
        .category-item.active { background: #2196F3; color: white; }
        .template-category { color: #d32f2f; font-weight: bold; background: #fff8f8; border-left: 3px solid #d32f2f; }
        
        .preview-area { flex: 1; padding: 30px; overflow-y: auto; background: #151515; color: #eee; display: flex; flex-direction: column; align-items: center; }
        .preview-header { width: 100%; max-width: 600px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 15px; }
        .theme-badge { background: #333; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: #aaa; border: 1px solid #444; }
        .actions { display: flex; gap: 10px; align-items: center; }
        
        .bulk-edit-btn { background: #2196F3; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; }
        .bulk-edit-btn:hover, .bulk-edit-btn.active { opacity: 1; box-shadow: 0 0 10px rgba(33, 150, 243, 0.5); }
        .bulk-mode .preview-row { opacity: 0.5; pointer-events: none; }
        
        .preview-grid { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 600px; }
        .preview-row { display: flex; align-items: center; gap: 20px; padding: 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
        .preview-row:hover { background: #252525; }
        .preview-row.editing { background: #2a2a2a; border-color: #2196F3; box-shadow: 0 0 15px rgba(33, 150, 243, 0.2); }
        .tier-label { width: 80px; text-align: right; color: #666; font-family: monospace; font-size: 0.9rem; }
        .poe-item-preview { font-family: 'Fontin', sans-serif; display: inline-block; min-width: 300px; text-align: center; cursor: pointer; }
        
        .style-editor-panel { width: 300px; background: #fff; border-left: 1px solid #ddd; padding: 20px; overflow-y: auto; box-shadow: -5px 0 15px rgba(0,0,0,0.05); }
        .style-editor-panel h3 { margin-top: 0; color: #333; font-size: 1.1rem; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .bulk-warning { background: #fff3e0; color: #f57c00; padding: 10px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 15px; border: 1px solid #ffe0b2; }
        
        .bulk-actions { margin-bottom: 20px; }
        .series-copier { background: #f0f7ff; padding: 15px; border-radius: 8px; border: 1px solid #bbdefb; }
        .series-copier h4 { margin: 0 0 8px 0; color: #1565c0; font-size: 0.9rem; }
        .series-controls { display: flex; gap: 8px; margin-bottom: 8px; }
        .series-controls select { flex: 1; padding: 6px; border: 1px solid #90caf9; border-radius: 4px; }
        .apply-series-btn { background: #1976D2; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.8rem; }
        .apply-series-btn:hover { background: #1565C0; }
        .help-text { font-size: 0.75rem; color: #555; margin: 0; font-style: italic; }
        .separator { margin: 20px 0; border: none; border-top: 1px solid #eee; }
        .toggle-uniform { color: #666; font-size: 0.8rem; cursor: pointer; user-select: none; font-weight: bold; }
        .toggle-uniform:hover { color: #333; }

        .control-group { margin-bottom: 20px; }
        .control-group label { display: block; font-size: 0.85rem; font-weight: bold; color: #666; margin-bottom: 8px; }
        .control-group input[type="number"], .control-group input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .color-input-wrapper { display: flex; gap: 10px; align-items: center; }
        .color-input-wrapper input[type="color"] { width: 40px; height: 36px; padding: 0; border: none; background: none; cursor: pointer; }
        
        .save-btn { background: #4CAF50; color: white; border: none; padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; }
        .save-btn:disabled { background: #ccc; cursor: not-allowed; }
        .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666; padding: 0 10px; }
        .unsaved-badge { color: #ff9800; font-weight: bold; font-size: 0.8rem; }
      `}</style>
    </div>
  );
};

export default ThemePresetEditor;