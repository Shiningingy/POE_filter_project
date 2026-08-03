import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useTranslation, CLASS_KEY_MAP, CLASS_CH } from '../utils/localization';
import type { Language } from '../utils/localization';
import SoundPicker from './SoundPicker';
import LoadingOverlay from './LoadingOverlay';
import { fetchTierLabelMap, fetchThemeKeyByPath } from '../utils/tierLabels';
import MinimapIconPicker, { getIconStyle, formatMinimapIcon } from './MinimapIconPicker';
import PlayEffectPicker, { formatPlayEffect } from './PlayEffectPicker';
import { getAssetUrl } from '../utils/assetUtils';
import { buildThemeExport, parseThemeExport, downloadJson } from '../utils/themeSoundExport';
import type { ThemeExport } from '../utils/themeSoundExport';
import ThemeHueGenerator from './ThemeHueGenerator';
import type { GeneratedTierStyle } from '../utils/themeGenerator';
import { mergeThemeOverrides } from '../utils/theme';

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

  // tier-definition path -> theme resolution key, straight from the tier definitions.
  // `themeKeysLoaded` gates the nav: a leaf's bucket is unknown until this arrives, and
  // rendering leaves before it would either hide them or guess a key. Set on success AND
  // on failure - a failed fetch must degrade to a visible, disabled nav, never to an
  // endless spinner (fetchThemeKeyByPath swallows its own errors and returns {}).
  //
  // ⚠️ MUST be declared above `leafKey` and the memos that call it. These are `const`
  // bindings, so a memo running during render that reads them from higher up the file
  // throws "Cannot access 'themeKeyByPath' before initialization" — which is exactly what
  // happened, and it only showed up when the board was opened in a browser: tsc, the
  // fixtures and the equivalence test were all still green.
  const [themeKeyByPath, setThemeKeyByPath] = useState<Record<string, string>>({});
  const [themeKeysLoaded, setThemeKeysLoaded] = useState(false);

  // selectedCategory holds the THEME RESOLUTION KEY (the tier definition's
  // theme_category), not the display name. "Default" is the global fallback bucket.
  const [selectedCategory, setSelectedCategory] = useState<string>('Default');
  // selectedLeaf tracks the clicked nav leaf by its unique path (or '__default__')
  // so the active highlight is per-leaf — several leaves can share one resolution key.
  const [selectedLeaf, setSelectedLeaf] = useState<string>('__default__');
  // Collapsible nav groups/subgroups, mirroring the editor Sidebar.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // --- sidebar: search + resize -------------------------------------------- //
  // 102 nav entries in a fixed 220px rail is a lot of scrolling when you are
  // sweeping category by category. Search flattens to results; the rail can be
  // dragged wider for the long localized names, and the width persists.
  const [navQuery, setNavQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('themeEditor.sidebarWidth'));
    return saved >= 160 && saved <= 560 ? saved : 220;
  });
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sidebarWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const next = dragRef.current.startW + (ev.clientX - dragRef.current.startX);
      setSidebarWidth(Math.min(560, Math.max(160, next)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // read the committed width from state rather than the stale closure
      setSidebarWidth(w => { localStorage.setItem('themeEditor.sidebarWidth', String(w)); return w; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Flattened nav, with a breadcrumb, so search can show results directly
  // instead of making the user expand groups to find a hit.
  const allLeaves = useMemo(() => {
    const out: { f: any; crumb: string }[] = [];
    for (const g of navGroups as any[]) {
      if (!g || g.separator) continue;
      const gName = g._meta?.localization?.[language] || g._meta?.localization?.en || '';
      for (const f of (g.files || [])) out.push({ f, crumb: gName });
      for (const s of (g.subgroups || [])) {
        const sName = s._meta?.localization?.[language] || s._meta?.localization?.en || '';
        for (const f of (s.files || [])) {
          out.push({ f, crumb: gName && sName ? `${gName} › ${sName}` : (gName || sName) });
        }
      }
    }
    return out;
  }, [navGroups, language]);

  /**
   * ★ The theme bucket a nav leaf edits — resolved from the leaf's TIER DEFINITION,
   * which is what the generator reads.
   *
   * This used to be `f.target_category`, a value hand-typed into both the nav yaml and
   * the compiled .json (that yaml is retired — see
   * filter_generation/archive/retired-code/). It had drifted on 13 of 92 leaves,
   * and because this key is the board's read AND write key, on those leaves the board
   * showed a look the filter does not emit and banked edits into a bucket nothing
   * reads — or, worse, into another category's real bucket (editing Contracts restyled
   * every Map). See filterStyle.resolveThemeKey.
   *
   * Until the map loads we return '' rather than guessing, so a leaf is never
   * momentarily bound to the wrong bucket and saved there.
   */
  const leafKey = (f: any): string => (f?.tier_path ? themeKeyByPath[f.tier_path] || '' : '');

  const navFilter = navQuery.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!navFilter) return [];
    const hit = (s?: string) => !!s && s.toLowerCase().includes(navFilter);
    return allLeaves.filter(({ f, crumb }) =>
      hit(leafKey(f) || f.localization?.en) ||
      hit(f.localization?.[language]) ||
      hit(f.localization?.en) ||
      hit(f.path) ||
      hit(crumb));
  }, [allLeaves, navFilter, language]);

  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [unsavedOverrides, setUnsavedOverrides] = useState(false);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importState, setImportState] = useState<ImportModalState>({ sourceTheme: '', sourceCategory: 'Templates' });
  const [previewImportData, setPreviewImportData] = useState<any>(null);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showEffectPicker, setShowEffectPicker] = useState(false);

  // Hue generator + save-merged-as-preset
  const [showHueGenerator, setShowHueGenerator] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');

  // Standalone theme-file import (a preset shared by another user)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingThemeFile, setPendingThemeFile] = useState<ThemeExport | null>(null);
  const [fileImportMode, setFileImportMode] = useState<'new' | 'overwrite'>('new');
  const [fileImportName, setFileImportName] = useState('');
  const [fileImportTarget, setFileImportTarget] = useState('');

  const [viewerBackground, setViewerBackground] = useState<string>('Item_bg_coast.jpg');

  // theme-category -> tier number -> {en, ch} display names from the tier
  // definitions, so this editor mirrors the editor's (renameable) tier names.
  const [tierLabelMap, setTierLabelMap] = useState<Record<string, Record<number, { en?: string; ch?: string }>>>({});

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
        const [themesRes, settingsRes, navRes] = await Promise.all([
            axios.get('/api/themes'),
            axios.get('/api/settings'),
            axios.get('/api/category-structure')
        ]);
        setThemes(themesRes.data.themes || []);
        const base = settingsRes.data.base_theme || 'sharket';
        setCurrentThemeInUse(base);
        setActiveTheme(base);
        // overridesData starts empty and stays SESSION-LOCAL: it is this editor's
        // working buffer, not a stored layer. custom_overrides.json used to persist
        // it and the generator merged it over the preset — a patch file keyed by
        // category × tier, from before the tier block owned its look. Edits are now
        // banked by "save as preset", which writes a real theme file.
        setNavGroups(navRes.data.categories || []);
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, []);

  // Tier display names from the tier definitions (shared module cache).
  useEffect(() => { fetchTierLabelMap().then(setTierLabelMap); }, []);
  // ...and, from the same cached walk, each leaf's theme resolution key.
  useEffect(() => {
    fetchThemeKeyByPath()
      .then(setThemeKeyByPath)
      .finally(() => setThemeKeysLoaded(true));
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

  // Flat nav leaves keyed by resolution key, for label lookup + initial select.
  // Walks subgroups too — keying only off top-level `files` missed the 10 leaves that
  // live under one (Heist, and all of League-Specific).
  const navLeaves = useMemo(() => {
      const out: { key: string; label_en: string; label: string }[] = [];
      allLeaves.forEach(({ f }) => {
          const key = leafKey(f);
          if (!key) return;
          out.push({ key, label_en: f.localization?.en || key, label: f.localization?.[language] || f.localization?.en || key });
      });
      return out;
  }, [allLeaves, language, themeKeyByPath]);

  /**
   * How many DISTINCT categories share a resolution key — several legitimately do (all 7
   * Campaign leaves resolve to `Campaign`), and editing one then changes all of them.
   * That is what the filter actually does, so the board says so rather than implying
   * each leaf has a private look.
   *
   * Keyed by tier_path, not by label: 10 of the 92 nav leaves are the SAME tier file
   * listed under two nav paths (Contracts appears as both "Maps & Fragments › Heist ›
   * Contracts" and "Heist Gear › Heist Contracts"). Counting labels made those look like
   * two categories sharing a look, when they are one category shown twice — a warning
   * that fires when nothing is shared trains you to ignore it.
   */
  const leavesPerKey = useMemo(() => {
      const seenPath: Record<string, Set<string>> = {};
      const n: Record<string, string[]> = {};
      allLeaves.forEach(({ f }) => {
          const key = leafKey(f);
          if (!key) return;
          const path = f.tier_path || f.path;
          if (!seenPath[key]) { seenPath[key] = new Set(); n[key] = []; }
          if (seenPath[key].has(path)) return;
          seenPath[key].add(path);
          n[key].push(f.localization?.[language] || f.localization?.en || key);
      });
      return n;
  }, [allLeaves, language, themeKeyByPath]);

  const catLabel = (cat: string) => {
      if (cat === 'Default') return language === 'ch' ? '默认 (后备样式)' : 'Default (fallback)';
      const leaf = navLeaves.find(l => l.key === cat);
      return leaf?.label || getLocalizedCategory(cat);
  };

  /**
   * The label of the leaf actually clicked. `catLabel` resolves a KEY, and the first leaf
   * holding that key wins — so with a shared bucket, clicking "Flask Progression" titled
   * the panel "Weapon Progression". Name what was clicked; the shared-look pill beside it
   * names the bucket.
   */
  const selectedLeafLabel = useMemo(() => {
      if (selectedLeaf === '__default__') return null;
      const hit = allLeaves.find(({ f }) => (f.path || leafKey(f)) === selectedLeaf);
      if (!hit) return null;
      return hit.f.localization?.[language] || hit.f.localization?.en || null;
  }, [allLeaves, selectedLeaf, language, themeKeyByPath]);

  // Select a nav leaf: edits the leaf's resolution key but highlights only this leaf.
  const selectLeaf = (f: any) => {
      const key = leafKey(f);
      if (!key) return;
      setSelectedCategory(key);
      setSelectedLeaf(f.path || key);
      setEditingTier(null);
      setIsBulkEditing(false);
  };

  const renderLeaf = (f: any) => {
      const key = leafKey(f);
      const label = f.localization?.[language] || f.localization?.en || f.path || '?';
      // A leaf whose tier file did not resolve has no bucket to edit. Show it greyed with
      // the reason rather than dropping it: a silently missing nav row is indistinguishable
      // from "this category does not exist", and the validator's check_nav flags the same
      // condition at build time.
      if (!key) {
          return (
              <div key={f.path || label} className="category-item file-leaf unresolved"
                   title={language === 'ch'
                     ? `无法解析主题分类：找不到 ${f.tier_path}`
                     : `no theme category: ${f.tier_path} did not load`}>
                  {label} ⚠
              </div>
          );
      }
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

  // Hide tier (Tier 9) is excluded: its style never shows in game.
  const visibleTierKeys = (obj: any) =>
      sortTierKeys(obj).filter(k => k !== 'Tier 9');

  const tierDisplayName = (tier: string) => {
      const num = parseInt(tier.match(/Tier (\d+)/)?.[1] || '');
      const loc = Number.isNaN(num) ? undefined : tierLabelMap[selectedCategory]?.[num];
      const label = loc?.[language] || loc?.en;
      return label || `${catLabel(selectedCategory)} ${tier}`;
  };

  const previewItems = useMemo(() => {
    return visibleTierKeys(effectiveTiers).map(tier => ({
        name: tierDisplayName(tier),
        tierKey: tier,
        style: effectiveTiers[tier],
        isOverridden: overridesData[selectedCategory]?.[tier] !== undefined
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTiers, selectedCategory, overridesData, language, tierLabelMap]);

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
          visibleTierKeys(effectiveTiers).forEach(tier => updateOverride(selectedCategory, tier, key, value));
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

  // ---- hue generator ----
  // Per-property spread keeps any existing override props the generator doesn't
  // emit (notably PlayAlertSound) intact.
  const handleGeneratorApply = (styles: Record<string, GeneratedTierStyle>) => {
      setOverridesData((prev: any) => {
          const next = { ...prev, [selectedCategory]: { ...(prev[selectedCategory] || {}) } };
          Object.entries(styles).forEach(([tier, style]) => {
              next[selectedCategory][tier] = { ...(next[selectedCategory][tier] || {}), ...style };
          });
          return next;
      });
      setUnsavedOverrides(true);
      setShowHueGenerator(false);
  };

  // ---- save merged (base + overrides, incl. unsaved) as a new preset ----
  const handleSaveAsPreset = async () => {
      const name = savePresetName.trim();
      if (!name || themes.includes(name) || !baseThemeData) return;
      const merged = mergeThemeOverrides(baseThemeData, overridesData);
      try {
          await axios.post(`/api/themes/${name}`, { theme_data: merged });
          setThemes(prev => prev.includes(name) ? prev : [...prev, name]);
          setShowSavePreset(false);
          // Opt-in: make the new preset the base theme and clear the working buffer
          // (visually identical — the edits were baked into the preset).
          if (window.confirm(t.hueGenSwitchConfirm)) {
              await axios.post('/api/settings', { base_theme: name });
              setOverridesData({});
              setUnsavedOverrides(false);
              setActiveTheme(name);
              setCurrentThemeInUse(name);
          } else {
              alert(`${t.hueGenPresetSaved}: ${name}`);
          }
      } catch (e) {
          console.error(e);
          alert('Save failed');
      }
  };

  // ---- standalone theme-file export/import ----
  const handleExportTheme = () => {
      if (!baseThemeData) return;
      downloadJson(buildThemeExport(activeTheme, baseThemeData), `${activeTheme}.theme.json`);
  };

  const suggestPresetName = (wanted: string) => {
      let name = wanted || 'imported';
      if (!themes.includes(name)) return name;
      name = `${name}-imported`;
      let i = 2;
      let candidate = name;
      while (themes.includes(candidate)) candidate = `${name}-${i++}`;
      return candidate;
  };

  const handleThemeFile = async (file: File) => {
      const parsed = parseThemeExport(await file.text());
      if (parsed === null) { alert(t.tsInvalidThemeFile); return; }
      if (parsed === 'newer') { alert(t.tsNewerVersion); return; }
      setPendingThemeFile(parsed);
      setFileImportMode('new');
      setFileImportName(suggestPresetName(parsed.name));
      setFileImportTarget(activeTheme);
  };

  const confirmThemeFileImport = async () => {
      if (!pendingThemeFile) return;
      const target = fileImportMode === 'new' ? fileImportName.trim() : fileImportTarget;
      if (!target) return;
      if (fileImportMode === 'overwrite' && !window.confirm(t.tsOverwriteConfirm)) return;
      try {
          await axios.post(`/api/themes/${target}`, { theme_data: pendingThemeFile.theme_data });
          if (!themes.includes(target)) setThemes(prev => [...prev, target]);
          // Switching activeTheme reloads via effect; overwriting the open one won't
          // retrigger it, so update the local data directly in that case.
          if (target === activeTheme) setBaseThemeData(JSON.parse(JSON.stringify(pendingThemeFile.theme_data)));
          else setActiveTheme(target);
          setPendingThemeFile(null);
          alert(`${t.tsImportedAsPreset}: ${target}`);
      } catch (e) {
          console.error(e);
          alert('Import failed');
      }
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

  // Wait for the tier walk too: until it lands no leaf knows which bucket it edits.
  if (!baseThemeData || !themeKeysLoaded) {
    return (
      <div className="theme-editor-modal modal-overlay">
        <div className="modal-content main-content-frame">
          <LoadingOverlay language={language} />
        </div>
      </div>
    );
  }

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
            <div className="file-io-btns">
                <button className="file-io-btn" onClick={handleExportTheme} title={`${t.tsExport} ${activeTheme}.theme.json`}>⬆ {t.tsExport}</button>
                <button className="file-io-btn" onClick={() => fileInputRef.current?.click()}>⬇ {t.tsImport}</button>
                <button className="file-io-btn" onClick={() => { setSavePresetName(suggestPresetName(`${activeTheme}-custom`)); setShowSavePreset(true); }}>💾 {t.hueGenSaveAsPreset}</button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleThemeFile(f);
                        e.target.value = '';
                    }}
                />
            </div>
            {unsavedOverrides && <span className="unsaved-badge">● {t.unsavedOverrides}</span>}
          </div>
          <div className="header-actions">
             {/* Banking edits means writing a preset. There is no override layer to
                 save to any more, and the merged-preset path was already lossless. */}
             <button className="save-btn primary-action-btn" disabled={!unsavedOverrides}
                     onClick={() => setShowSavePreset(true)}>💾 {t.hueGenSaveAsPreset}</button>
             <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="editor-layout">
          <div className="category-sidebar" style={{ width: sidebarWidth }}>
            <div className="nav-search">
              <input
                type="search"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder={language === 'ch' ? '搜索分类…' : 'Search categories…'}
                aria-label={language === 'ch' ? '搜索分类' : 'Search categories'}
              />
              {navFilter && (
                <span className="nav-count">
                  {searchHits.length} / {allLeaves.length}
                </span>
              )}
            </div>
            <div className="category-list">
              {/* Search: flat results with a breadcrumb, so a hit is one click away. */}
              {navFilter ? (
                searchHits.length === 0 ? (
                  <div className="nav-empty">
                    {language === 'ch' ? '没有匹配的分类' : 'No categories match'}
                  </div>
                ) : (
                  searchHits.map(({ f, crumb }) => {
                    const key = leafKey(f);
                    const id = f.path || key;
                    const label = f.localization?.[language] || f.localization?.en || key;
                    return (
                      <div
                        key={id}
                        className={`category-item search-hit ${selectedLeaf === id ? 'active' : ''}`}
                        onClick={() => selectLeaf(f)}
                      >
                        <span className="hit-label">
                          {label}
                          {overridesData[key] && <span className="override-dot">•</span>}
                        </span>
                        {crumb && <span className="leaf-crumb">{crumb}</span>}
                      </div>
                    );
                  })
                )
              ) : (
              <>
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
                  const key = leafKey(f);
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
              </>
              )}
            </div>
            <div
              className="resize-handle"
              onMouseDown={startResize}
              onDoubleClick={() => { setSidebarWidth(220); localStorage.setItem('themeEditor.sidebarWidth', '220'); }}
              title={language === 'ch' ? '拖动调整宽度（双击重置）' : 'Drag to resize (double-click to reset)'}
              role="separator"
              aria-orientation="vertical"
            />
          </div>

          <div className="preview-area" onClick={() => { setEditingTier(null); setIsBulkEditing(false); }} style={getBackgroundStyle()}>
            <div className="preview-header">
              <h3>{selectedLeafLabel || catLabel(selectedCategory)}</h3>
              {/* Several nav leaves can resolve to one theme key (all 7 Campaign leaves
                  do). Editing here changes every one of them, so name them rather than
                  let the author discover it in the exported filter. */}
              {(leavesPerKey[selectedCategory]?.length ?? 0) > 1 && (
                <span
                  className="shared-key-note"
                  title={leavesPerKey[selectedCategory].join(' · ')}
                >
                  {language === 'ch'
                    ? `共用样式「${selectedCategory}」，同时影响 ${leavesPerKey[selectedCategory].length} 个分类`
                    : `shared look "${selectedCategory}" — also affects ${leavesPerKey[selectedCategory].length - 1} other ${leavesPerKey[selectedCategory].length - 1 === 1 ? 'category' : 'categories'}`}
                </span>
              )}
              <BackgroundSwitcher />
              <button className="hue-gen-btn primary-action-btn" onClick={(e) => { e.stopPropagation(); setShowHueGenerator(true); }}>
                🎛 {t.hueGenOpen}
              </button>
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

      {/* Theme-file import choice dialog */}
      {pendingThemeFile && (
          <div className="modal-overlay import-overlay" onClick={() => setPendingThemeFile(null)}>
              <div className="modal-content theme-file-import" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                      <h3>{t.tsImportTheme}: {pendingThemeFile.name}</h3>
                      <button className="close-x" onClick={() => setPendingThemeFile(null)}>×</button>
                  </div>
                  <div className="theme-file-body">
                      <label className="mode-option">
                          <input type="radio" name="theme-import-mode" checked={fileImportMode === 'new'} onChange={() => setFileImportMode('new')} />
                          <span>{t.tsImportAsNew}</span>
                      </label>
                      {fileImportMode === 'new' && (
                          <div className="mode-detail">
                              <label>{t.tsPresetName}</label>
                              <input type="text" value={fileImportName} onChange={e => setFileImportName(e.target.value)} />
                          </div>
                      )}
                      <label className="mode-option">
                          <input type="radio" name="theme-import-mode" checked={fileImportMode === 'overwrite'} onChange={() => setFileImportMode('overwrite')} />
                          <span>{t.tsOverwriteExisting}</span>
                      </label>
                      {fileImportMode === 'overwrite' && (
                          <div className="mode-detail">
                              <select value={fileImportTarget} onChange={e => setFileImportTarget(e.target.value)}>
                                  {themes.map(th => <option key={th} value={th}>{th}</option>)}
                              </select>
                          </div>
                      )}
                  </div>
                  <div className="modal-footer">
                      <button className="cancel-btn" onClick={() => setPendingThemeFile(null)}>{t.cancel}</button>
                      <button
                          className="confirm-btn primary-action-btn"
                          disabled={fileImportMode === 'new' ? !fileImportName.trim() || themes.includes(fileImportName.trim()) : !fileImportTarget}
                          onClick={confirmThemeFileImport}
                      >{t.tsImport}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Hue generator (mix-match matrix) */}
      {showHueGenerator && (
          <ThemeHueGenerator
              language={language}
              categoryLabel={catLabel(selectedCategory)}
              tierName={tierDisplayName}
              backgroundStyle={getBackgroundStyle()}
              onApply={handleGeneratorApply}
              onClose={() => setShowHueGenerator(false)}
          />
      )}

      {/* Save merged theme as a new preset */}
      {showSavePreset && (
          <div className="modal-overlay import-overlay" onClick={() => setShowSavePreset(false)}>
              <div className="modal-content theme-file-import" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                      <h3>💾 {t.hueGenSaveAsPreset}</h3>
                      <button className="close-x" onClick={() => setShowSavePreset(false)}>×</button>
                  </div>
                  <div className="theme-file-body">
                      <p className="save-preset-desc">{t.hueGenSavePresetDesc}</p>
                      <div className="mode-detail" style={{ marginLeft: 0 }}>
                          <label>{t.hueGenPresetName}</label>
                          <input type="text" value={savePresetName} onChange={e => setSavePresetName(e.target.value)} />
                      </div>
                  </div>
                  <div className="modal-footer">
                      <button className="cancel-btn" onClick={() => setShowSavePreset(false)}>{t.cancel}</button>
                      <button
                          className="confirm-btn primary-action-btn"
                          disabled={!savePresetName.trim() || themes.includes(savePresetName.trim())}
                          onClick={handleSaveAsPreset}
                      >💾 {t.hueGenSaveAsPreset}</button>
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
                    // Without this the picker opened at the default volume, so
                    // confirming without touching the slider silently rewrote a
                    // tuned 100 or 200 as 300.
                    initialVolume={activeStyle?.PlayAlertSound?.[1]}
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
        
        /* Width comes from inline style (draggable, persisted); flex-shrink:0 keeps
           the flex parent from squeezing it back. position:relative anchors the
           resize handle. */
        .category-sidebar { flex: 0 0 auto; position: relative; border-right: 1px solid #ddd; display: flex; flex-direction: column; background: #fff; min-height: 0; }
        .category-list { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; }

        .nav-search { padding: 10px 10px 0; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .nav-search input { flex: 1; min-width: 0; padding: 6px 8px; font-size: 0.85rem; border: 1px solid #ddd; border-radius: 5px; background: #fafafa; color: #222; }
        .nav-search input:focus { outline: 2px solid #2196F3; outline-offset: -1px; background: #fff; }
        .nav-count { font-size: 0.7rem; color: #999; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .nav-empty { padding: 20px 12px; color: #999; font-size: 0.82rem; text-align: center; }

        .search-hit { flex-direction: column; align-items: flex-start; gap: 1px; }
        .search-hit .hit-label { display: flex; align-items: center; gap: 4px; }
        .leaf-crumb { font-size: 0.68rem; color: #aaa; }
        .category-item.active .leaf-crumb { color: rgba(255,255,255,0.75); }

        /* "this look is shared with N other categories" — a warning, not decoration:
           it is the difference between editing one category and editing seven. */
        .shared-key-note { font-size: 0.72rem; color: #b26a00; background: #fff5e0; border: 1px solid #f0d18a;
                           border-radius: 10px; padding: 2px 9px; white-space: nowrap; cursor: help; align-self: center; }

        /* Keep the title on one line - the shared-look pill next to it was squeezing it. */
        .preview-header h3 { flex-shrink: 0; white-space: nowrap; margin: 0; }

        /* A leaf whose tier file did not resolve: visible, but not clickable into a bucket. */
        .category-item.unresolved { color: #bbb; cursor: not-allowed; font-style: italic; }

        /* Sits over the right border so the whole edge is grabbable. */
        .resize-handle { position: absolute; top: 0; right: -3px; width: 7px; height: 100%; cursor: col-resize; z-index: 5; background: transparent; }
        .resize-handle:hover { background: rgba(33,150,243,0.25); }
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
        .preview-header { width: 100%; max-width: 700px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 15px; }
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
        .file-io-btns { display: flex; gap: 6px; }
        .file-io-btn { padding: 6px 14px; font-size: 0.8rem; font-weight: bold; background: #f5f5f5; color: #444; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; }
        .file-io-btn:hover { border-color: #2196F3; color: #2196F3; background: #f0f7ff; }
        .theme-file-import { width: 440px; }
        .save-preset-desc { margin: 0; font-size: 0.85rem; color: #666; line-height: 1.5; }
        .theme-file-body { padding: 20px 25px; display: flex; flex-direction: column; gap: 12px; }
        .mode-option { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #333; cursor: pointer; }
        .mode-detail { margin-left: 26px; display: flex; flex-direction: column; gap: 6px; }
        .mode-detail label { font-size: 0.75rem; font-weight: bold; color: #888; text-transform: uppercase; }
        .mode-detail input, .mode-detail select { padding: 9px; border: 1px solid #ddd; border-radius: 6px; background: white !important; color: black !important; }
      `}</style>
    </div>
  );
};

export default ThemePresetEditor;