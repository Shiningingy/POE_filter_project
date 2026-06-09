import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation, CLASS_KEY_MAP, CLASS_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import SoundPicker from './SoundPicker';
import MinimapIconPicker, { getIconStyle, formatMinimapIcon } from './MinimapIconPicker';
import PlayEffectPicker, { formatPlayEffect } from './PlayEffectPicker';
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
  const [navGroups, setNavGroups] = useState<any[]>([]);

  // selectedCategory holds the THEME RESOLUTION KEY (target_category / theme_category),
  // not the display name. "Default" is the global fallback bucket.
  const [selectedCategory, setSelectedCategory] = useState<string>('Default');
  // selectedLeaf tracks the clicked nav leaf by its unique path (or '__default__')
  // so the active highlight is per-leaf — several leaves can share one resolution key.
  const [selectedLeaf, setSelectedLeaf] = useState<string>('__default__');
  // Collapsible nav groups/subgroups, mirroring the editor Sidebar.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [unsavedOverrides, setUnsavedOverrides] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importState, setImportState] = useState<ImportModalState>({ sourceTheme: '', sourceCategory: 'Templates' });
  const [previewImportData, setPreviewImportData] = useState<any>(null);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showEffectPicker, setShowEffectPicker] = useState(false);

  const [viewerBackground, setViewerBackground] = useState<string>('Item_bg_coast.jpg');

  const backgrounds = [
    { id: "Item_bg_coast.jpg", name: t.coast },
    { id: "Item_bg_forest.jpg", name: t.forest },
    { id: "Item_bg_sand.jpg", name: t.sand },
    { id: "color_black", name: t.black },
    { id: "color_white", name: t.white },
    { id: "color_grey", name: t.grey }
  ];

  // Initial Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [themesRes, settingsRes, overridesRes, navRes] = await Promise.all([
            axios.get('/api/themes'),
            axios.get('/api/settings'),
            axios.get('/api/custom-overrides'),
            axios.get('/api/category-structure')
        ]);
        setThemes(themesRes.data.themes || []);
        const base = settingsRes.data.base_theme || 'sharket';
        setCurrentThemeInUse(base);
        setActiveTheme(base);
        setOverridesData(overridesRes.data || {});
        setNavGroups(navRes.data.categories || []);
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
        const data = res.data.theme_data || {};
        // Ensure the global fallback bucket exists (seeded from a sane default if absent).
        if (!data['Default']) {
            data['Default'] = JSON.parse(JSON.stringify(data['Stackable Currency'] || {}));
            for (let i = 0; i <= 9; i++) {
                if (!data['Default'][`Tier ${i}`]) data['Default'][`Tier ${i}`] = { FontSize: 32, TextColor: '#ffffffff', BackgroundColor: '#000000aa' };
            }
        }
        setBaseThemeData(data);
      } catch (e) { console.error(e); }
    };
    fetchBaseTheme();
  }, [activeTheme]);

  // Helpers
  const getLocalizedCategory = (cat: string) =>
    (language === 'ch' && CLASS_CH[cat]) || (t as any)[CLASS_KEY_MAP[cat] || cat] || cat;

  const sortTierKeys = (obj: any) =>
      Object.keys(obj || {}).filter(k => k.startsWith('Tier')).sort((a, b) => {
          const nA = parseInt(a.match(/Tier (\d+)/)?.[1] || '99');
          const nB = parseInt(b.match(/Tier (\d+)/)?.[1] || '99');
          return nA - nB;
      });

  const getTiers = (data: any, cat: string) => sortTierKeys(data?.[cat]);

  // Flat nav leaves keyed by resolution key (target_category), for label lookup + initial select.
  const navLeaves = useMemo(() => {
      const out: { key: string; label_en: string; label: string }[] = [];
      navGroups.forEach((g: any) => (g.files || []).forEach((f: any) => {
          const key = f.target_category || f.localization?.en;
          if (!key) return;
          out.push({ key, label_en: f.localization?.en || key, label: f.localization?.[language] || f.localization?.en || key });
      }));
      return out;
  }, [navGroups, language]);

  const catLabel = (cat: string) => {
      if (cat === 'Default') return language === 'ch' ? '默认 (后备样式)' : 'Default (fallback)';
      const leaf = navLeaves.find(l => l.key === cat);
      return leaf?.label || getLocalizedCategory(cat);
  };

  // Select a nav leaf: edits the leaf's resolution key but highlights only this leaf.
  const selectLeaf = (f: any) => {
      const key = f.target_category || f.localization?.en;
      if (!key) return;
      setSelectedCategory(key);
      setSelectedLeaf(f.path || key);
      setEditingTier(null);
      setIsBulkEditing(false);
  };

  const renderLeaf = (f: any) => {
      const key = f.target_category || f.localization?.en;
      if (!key) return null;
      const label = f.localization?.[language] || f.localization?.en || key;
      const id = f.path || key;
      return (
          <div
              key={id}
              className={`category-item file-leaf ${selectedLeaf === id ? 'active' : ''}`}
              onClick={() => selectLeaf(f)}
          >
              {label}
              {overridesData[key] && <span className="override-dot">•</span>}
          </div>
      );
  };

  // Effective per-tier styles for the selected category: its own base (or "Default"
  // fallback) merged with any overrides — mirrors how the generator resolves styling.
  const effectiveTiers = useMemo(() => {
      if (!baseThemeData) return {};
      const base = JSON.parse(JSON.stringify(baseThemeData[selectedCategory] || baseThemeData['Default'] || {}));
      const ov = overridesData[selectedCategory] || {};
      Object.keys(ov).forEach(tier => { base[tier] = { ...base[tier], ...ov[tier] }; });
      return base;
  }, [baseThemeData, overridesData, selectedCategory]);

  const previewItems = useMemo(() => {
    return sortTierKeys(effectiveTiers).map(tier => ({
        name: `${catLabel(selectedCategory)} ${tier}`,
        tierKey: tier,
        style: effectiveTiers[tier],
        isOverridden: overridesData[selectedCategory]?.[tier] !== undefined
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTiers, selectedCategory, overridesData, language]);

  const activeStyle = useMemo(() => {
      if (isBulkEditing && previewItems.length > 0) return previewItems[0].style;
      else if (editingTier) return effectiveTiers[editingTier] || null;
      return null;
  }, [isBulkEditing, previewItems, editingTier, effectiveTiers]);

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
          if (!selectedCategory) return;
          sortTierKeys(effectiveTiers).forEach(tier => updateOverride(selectedCategory, tier, key, value));
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

      const targetTiers = sortTierKeys(effectiveTiers).length > 0
          ? sortTierKeys(effectiveTiers)
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
            <h2>🎨 {t.themeEditorTitle}</h2>
            <div className="theme-selector-wrap">
                <span className="label">{t.baseThemeLabel}</span>
                <select className="theme-select" value={activeTheme} onChange={(e) => setActiveTheme(e.target.value)}>
                    {themes.map(th => <option key={th} value={th}>{th}</option>)}
                </select>
                <button className="apply-btn primary-action-btn" onClick={async () => {
                    await axios.post('/api/settings', { base_theme: activeTheme });
                    setCurrentThemeInUse(activeTheme);
                    alert(t.baseThemeApplied);
                }}>{activeTheme === currentThemeInUse ? '✅' : t.applyBase}</button>
            </div>
            {unsavedOverrides && <span className="unsaved-badge">● {t.unsavedOverrides}</span>}
          </div>
          <div className="header-actions">
             <button className="save-btn primary-action-btn" disabled={!unsavedOverrides} onClick={async () => {
                 await axios.post('/api/custom-overrides', overridesData);
                 setUnsavedOverrides(false);
                 alert(t.overridesSaved);
             }}>💾 {t.saveOverrides}</button>
             <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="editor-layout">
          <div className="category-sidebar">
            <div className="category-list">
              {/* Global fallback bucket */}
              <div
                className={`category-item template-category ${selectedLeaf === '__default__' ? 'active' : ''}`}
                onClick={() => { setSelectedCategory('Default'); setSelectedLeaf('__default__'); setEditingTier(null); setIsBulkEditing(false); }}
              >
                ★ {catLabel('Default')}
                {overridesData['Default'] && <span className="override-dot">•</span>}
              </div>
              {/* Nav-mirrored categories: separators, collapsible groups, subgroups, leaves */}
              {navGroups.map((group: any, gi: number) => {
                if (group.separator) {
                  return (
                    <div key={`sep-${gi}`} className="category-separator">
                      {group.separator[language] || group.separator.en}
                    </div>
                  );
                }
                const directFiles = group.files || [];
                const hasSub = (group.subgroups || []).length > 0;
                // Auto-flatten a single-file, no-subgroup group into one clickable row.
                if (!hasSub && directFiles.length === 1) {
                  const f = directFiles[0];
                  const key = f.target_category || f.localization?.en;
                  const id = f.path || key;
                  const gLabel = group._meta?.localization?.[language] || group._meta?.localization?.en || f.localization?.[language] || key;
                  return (
                    <div
                      key={`g-${gi}`}
                      className={`category-item group-flat ${selectedLeaf === id ? 'active' : ''}`}
                      onClick={() => selectLeaf(f)}
                    >
                      {gLabel}
                      {overridesData[key] && <span className="override-dot">•</span>}
                    </div>
                  );
                }
                const gid = `g-${gi}`;
                const gOpen = expanded[gid];
                const gName = group._meta?.localization?.[language] || group._meta?.localization?.en || '';
                return (
                  <div key={gid} className="cat-group">
                    <div className="cat-group-header" onClick={() => toggle(gid)}>
                      <span className="arrow">{gOpen ? '▼' : '▶'}</span>{gName}
                    </div>
                    {gOpen && (
                      <>
                        {(group.subgroups || []).map((sub: any, si: number) => {
                          const sid = `${gid}-s-${si}`;
                          const sOpen = expanded[sid];
                          const sName = sub._meta?.localization?.[language] || sub._meta?.localization?.en || '';
                          return (
                            <div key={sid} className="cat-subgroup">
                              <div className="cat-subgroup-header" onClick={() => toggle(sid)}>
                                <span className="arrow">{sOpen ? '▼' : '▶'}</span>{sName}
                              </div>
                              {sOpen && (sub.files || []).map(renderLeaf)}
                            </div>
                          );
                        })}
                        {directFiles.map(renderLeaf)}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="preview-area" onClick={() => { setEditingTier(null); setIsBulkEditing(false); }} style={getBackgroundStyle()}>
            <div className="preview-header">
              <h3>{catLabel(selectedCategory)}</h3>
              <BackgroundSwitcher />
              <button className={`bulk-edit-btn primary-action-btn ${isBulkEditing ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setIsBulkEditing(!isBulkEditing); setEditingTier(null); }}>
                {t.bulkEditImport}
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
                        borderWidth: '1px', borderStyle: 'solid', padding: '5px 10px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}>
                        {item.style.MinimapIcon && (
                            <div style={getIconStyle(item.style.MinimapIcon.split(' ')[1], item.style.MinimapIcon.split(' ')[2], 0.8)}></div>
                        )}
                        <span>{item.name}</span>
                        {item.style.PlayEffect && (
                            <span
                                className={`beam-mini ${item.style.PlayEffect.includes('Temp') ? 'is-temp' : ''}`}
                                style={{ color: item.style.PlayEffect.split(' ')[0].toLowerCase() }}
                                title={item.style.PlayEffect}
                            ></span>
                        )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {activeStyle && (
            <div className="style-editor-panel" onClick={e => e.stopPropagation()}>
              <div className="panel-header">
                <h3>{isBulkEditing ? t.bulkEdit : `${t.editingLabel}: ${editingTier}`}</h3>
              </div>

              {isBulkEditing && (
                  <div className="bulk-actions">
                      <button className="import-modal-btn" onClick={() => setShowImportModal(true)}>
                          📥 {t.importSeriesFromTheme}
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
                                {activeStyle.PlayAlertSound ? (activeStyle.PlayAlertSound[0].split('/').pop()) : t.none}
                            </span>
                        </div>
                    </div>
                    <div className="control-group">
                        <label>{t.minimapIcon}</label>
                        <div className="sound-display-box" onClick={() => setShowIconPicker(true)}>
                            {activeStyle.MinimapIcon ? (
                                <div style={getIconStyle(activeStyle.MinimapIcon.split(' ')[1], activeStyle.MinimapIcon.split(' ')[2], 0.8)}></div>
                            ) : (
                                <span className="sound-icon">📍</span>
                            )}
                            <span className="sound-name">
                                {activeStyle.MinimapIcon ? formatMinimapIcon(activeStyle.MinimapIcon, t) : t.none}
                            </span>
                        </div>
                    </div>
                    <div className="control-group">
                        <label>{t.dropEffect}</label>
                        <div className="sound-display-box" onClick={() => setShowEffectPicker(true)}>
                            {activeStyle.PlayEffect ? (
                                <span className="effect-swatch" style={{ background: activeStyle.PlayEffect.split(' ')[0].toLowerCase() }}></span>
                            ) : (
                                <span className="sound-icon">✨</span>
                            )}
                            <span className="sound-name">
                                {activeStyle.PlayEffect ? formatPlayEffect(activeStyle.PlayEffect, t) : t.none}
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
                        <h3>{t.importStyleSeries}</h3>
                        <BackgroundSwitcher />
                    </div>
                    <button className="close-x" onClick={() => setShowImportModal(false)}>×</button>
                  </div>

                  <div className="import-body">
                    <div className="import-controls">
                        <div className="control-col">
                            <label>{t.sourceTheme}</label>
                            <select value={importState.sourceTheme} onChange={e => setImportState({...importState, sourceTheme: e.target.value})}>
                                <option value="">{t.selectThemeOption}</option>
                                {themes.map(th => <option key={th} value={th}>{th}</option>)}
                            </select>
                        </div>
                        <div className="control-col">
                            <label>{t.sourceCategory}</label>
                            <select value={importState.sourceCategory} onChange={e => setImportState({...importState, sourceCategory: e.target.value})}>
                                <option value="Templates">{t.globalTemplates}</option>
                                {previewImportData && Object.keys(previewImportData).sort().filter(c => c !== 'Templates').map(c => (
                                    <option key={c} value={c}>{getLocalizedCategory(c)}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="preview-compare">
                        <div className="col" style={getBackgroundStyle()}>
                            <h4>{t.currentLabel} ({activeTheme})</h4>
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
                            <h4>{t.newLabel} ({importState.sourceTheme || '...'})</h4>
                            <div className="mini-list">
                                {previewImportData && (previewImportData[importState.sourceCategory] || previewImportData['Templates']) ? (
                                    getTiers(previewImportData, importState.sourceCategory).map(tier => {
                                        const s = (previewImportData[importState.sourceCategory] || previewImportData['Templates'])[tier];
                                        return (
                                            <div key={tier} className="mini-preview" style={{
                                                color: s.TextColor, backgroundColor: s.BackgroundColor, borderColor: s.BorderColor
                                            }}>{tier}</div>
                                        );
                                    })
                                ) : (
                                    <div className="missing-notice">{t.selectSourceTheme}</div>
                                )}
                            </div>
                        </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                      <button className="cancel-btn" onClick={() => setShowImportModal(false)}>{t.cancel}</button>
                      <button className="confirm-btn primary-action-btn" onClick={handleConfirmImport} disabled={!importState.sourceTheme}>{t.confirmImport}</button>
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

      {/* Minimap Icon Picker */}
      {showIconPicker && (
          <MinimapIconPicker
              value={activeStyle?.MinimapIcon}
              title={editingTier || undefined}
              language={language}
              onClose={() => setShowIconPicker(false)}
              onConfirm={(v) => {
                  handleUpdateStyle('MinimapIcon', v);
                  setShowIconPicker(false);
              }}
          />
      )}

      {/* Drop Effect Picker */}
      {showEffectPicker && (
          <PlayEffectPicker
              value={activeStyle?.PlayEffect}
              title={editingTier || undefined}
              language={language}
              onClose={() => setShowEffectPicker(false)}
              onConfirm={(v) => {
                  handleUpdateStyle('PlayEffect', v);
                  setShowEffectPicker(false);
              }}
          />
      )}

      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .effect-swatch { width: 14px; height: 14px; border-radius: 50%; display: inline-block; flex-shrink: 0; box-shadow: 0 0 5px currentColor; border: 1px solid rgba(0,0,0,0.2); }
        .beam-mini { width: 5px; height: 18px; border-radius: 2px; background: currentColor; box-shadow: 0 0 6px currentColor; flex-shrink: 0; display: inline-block; }
        .beam-mini.is-temp { background: repeating-linear-gradient(to bottom, currentColor, currentColor 3px, transparent 3px, transparent 6px); }
        
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
        
        .category-sidebar { width: 220px; border-right: 1px solid #ddd; display: flex; flex-direction: column; background: #fff; min-height: 0; }
        .category-list { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; }
        .category-item { padding: 10px 15px; cursor: pointer; border-radius: 6px; margin-bottom: 2px; color: #444; font-weight: 500; font-size: 0.9rem; display: flex; justify-content: space-between; transition: background 0.2s; }
        .category-item:hover { background: #f5f5f5; }
        .category-item.active { background: #2196F3; color: white; }
        .cat-group-header { padding: 9px 12px; cursor: pointer; font-weight: bold; color: #333; font-size: 0.9rem; border-radius: 6px; display: flex; align-items: center; gap: 6px; }
        .cat-group-header:hover { background: #f5f5f5; }
        .cat-subgroup-header { padding: 7px 12px 7px 22px; cursor: pointer; font-weight: 600; color: #666; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; border-radius: 6px; }
        .cat-subgroup-header:hover { background: #f5f5f5; }
        .arrow { font-size: 0.6rem; color: #999; width: 10px; display: inline-block; flex-shrink: 0; }
        .group-flat { font-weight: bold; color: #333; }
        .cat-group .file-leaf { padding-left: 28px; }
        .cat-subgroup .file-leaf { padding-left: 38px; }
        .template-category { color: #d32f2f; font-weight: bold; background: #fff8f8; border-left: 4px solid #d32f2f; }
        .category-separator { padding: 12px 15px 4px; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; color: #999; letter-spacing: 0.05em; border-top: 1px solid #f0f0f0; margin-top: 6px; }
        .category-separator:first-child { border-top: none; margin-top: 0; }
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