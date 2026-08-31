import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import type { CategoryFile } from '../components/Sidebar';
import CategoryView from '../components/CategoryView';
import InspectorPanel from '../components/InspectorPanel'; 
import ContextMenu from '../components/ContextMenu';
import SoundBulkEditor from '../components/SoundBulkEditor';
import VisibilityOverview from '../components/VisibilityOverview';
import axios from 'axios';
import { useTranslation, ruleFactorLabel } from '../utils/localization';
import type { Language } from '../utils/localization';
import { resolveStyle } from '../utils/styleResolver';
import { resolveThemeKey } from '../utils/filterStyle';
import { STRICTNESS_LEVELS, type StrictnessLevel, type LevelingSelection, isLevelingSelected } from '../utils/filterGenerator';

interface EditorViewProps {
  selectedFile: CategoryFile | null;
  setSelectedFile: (file: CategoryFile) => void;
  configContent: string;
  setConfigContent: (content: string) => void;
  loading: boolean;
  message: string;
  language: Language;
  styleClipboard: any;
  setStyleClipboard: (style: any) => void;
  viewerBackground: string;
  setViewerBackground: (bg: string) => void;
  onJumpToRule?: (filePath: string, ruleIndex?: number) => void;
  strictness?: StrictnessLevel;
  levelingSelection?: LevelingSelection;
  onLevelingSelectionChange?: (sel: LevelingSelection) => void;
}

const EditorView: React.FC<EditorViewProps> = ({
  selectedFile,
  setSelectedFile,
  configContent,
  setConfigContent,
  loading,
  message,
  language,
  styleClipboard,
  setStyleClipboard,
  viewerBackground,
  setViewerBackground,
  onJumpToRule,
  strictness,
  levelingSelection,
  onLevelingSelectionChange
}) => {
  const t = useTranslation(language);
  const strictnessIdx = Math.max(0, (STRICTNESS_LEVELS as readonly string[]).indexOf(strictness ?? 'soft'));
  // Effective-hidden for the live preview: a permanent hide bucket, a strictness gate
  // the current level reaches, OR a leveling tier deselected by the Campaign picker.
  // ⚠️ A `_meta.highlight_layer` category DROPS its block at the gate instead of hiding
  // it, so read "hidden" as "emits no Show here" — the item still shows from its owning
  // category. See the gate in filterGenerator.ts.
  const tierHidden = (td: any): boolean =>
    !!td?.is_hide_tier ||
    (typeof td?.hide_at_strictness === 'number' && strictnessIdx >= td.hide_at_strictness) ||
    !isLevelingSelected(td?.lv_group, levelingSelection);
  const [inspectedTierKey, setInspectedTierKey] = useState<string | null>(null);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [pingedCondition, setPingedCondition] = useState<{ tierKey: string, ruleIndex: number, conditionKey: string, timestamp: number } | null>(null);
  const [toast, setToast] = useState<{ message: string, timestamp: number } | null>(null);
  const [tierItems, setTierItems] = useState<Record<string, any[]>>({});
  // The mapping file's _meta.item_class. Kept OUT of configContent on purpose:
  // persistConfig writes configContent straight back to the tier_definition, so
  // merging a mapping-only field in would copy it into 94 tier files.
  const [mappingItemClass, setMappingItemClass] = useState<string | null>(null);
  // Mirrors `_meta.suppress_basetype_sounds` from the category's MAPPING file. The
  // editor injects the same per-basetype sounds the generators do, so without this it
  // would keep showing an alert the exported filter no longer emits.
  const [suppressBasetypeSounds, setSuppressBasetypeSounds] = useState(false);
  const [soundMap, setSoundMap] = useState<any>({ basetype_sounds: {}, class_sounds: {} });
  const [themeData, setThemeData] = useState<any>(null);
  const [fallbackMenu, setFallbackMenu] = useState<{ x: number, y: number } | null>(null);
  const [showSoundManager, setShowSoundManager] = useState(false);
  const [showVisibilityOverview, setShowVisibilityOverview] = useState(false);
  // Lifts the protect-guard on the 57 `show_in_editor: false` T0 chase tiers so
  // their items can be deleted or re-tiered. Off by default and persisted, so it
  // survives a reload but is never the state you land in by accident.
  //
  // MAINTAINER-ONLY: import.meta.env.DEV is true under `npm run dev` and false in
  // every production build, so the button is absent and the flag is pinned false
  // on the deployed site. It gates the initial state as well as the render, so a
  // stale localStorage '1' carried over from a dev session cannot switch it on.
  const [adminMode, setAdminMode] = useState<boolean>(
    () => import.meta.env.DEV && localStorage.getItem('editorAdminMode') === '1'
  );
  useEffect(() => {
    localStorage.setItem('editorAdminMode', adminMode ? '1' : '0');
  }, [adminMode]);

  const API_BASE_URL = '';

  // Hoisted out of the mount effect so the sound editor can re-run the SAME load
  // after it writes. The old inline refetch hardcoded the 'sharket' theme, so it
  // could not be reused for anything else.
  const loadTheme = useCallback(async () => {
      try {
          const settingsRes = await axios.get(`${API_BASE_URL}/api/settings`);
          const baseTheme = settingsRes.data.base_theme || 'sharket';
          const themeRes = await axios.get(`${API_BASE_URL}/api/themes/${baseTheme}`);
          setThemeData(themeRes.data.theme_data);
          setSoundMap(themeRes.data.sound_map_data);
      } catch (err) {
          console.error("Failed to load theme", err);
      }
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  useEffect(() => {
      if (pingedCondition) {
          const locName = ruleFactorLabel(pingedCondition.conditionKey, language);
          setToast({ 
              message: `${t.conditionAlreadyAdded}: ${locName}`,
              timestamp: pingedCondition.timestamp 
          });
          const timer = setTimeout(() => setToast(null), 1500);
          return () => clearTimeout(timer);
      }
  }, [pingedCondition, language]);

  // Both the category preview (getAugmentedRules) and the item cards read
  // soundMap.basetype_sounds directly to mirror what the generators inject. Deriving
  // one map here beats threading a flag through every consumer, and a suppressed
  // category then behaves exactly as if those entries did not exist - which is what
  // the exported filter does.
  const effectiveSoundMap = useMemo(
    () => (suppressBasetypeSounds ? { ...soundMap, basetype_sounds: {} } : soundMap),
    [soundMap, suppressBasetypeSounds],
  );

  const isDirtyRef = React.useRef(false);
  // A ref alone cannot drive the auto-save effect - it never re-renders. This
  // counter is what markDirty() ticks so the debounce can restart.
  const [dirtyTick, setDirtyTick] = useState(0);

  const inspectedTier = useMemo(() => {
      if (!inspectedTierKey || !configContent) return null;
      try {
          const parsed = JSON.parse(configContent);
          const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
          if (!catKey || !parsed[catKey][inspectedTierKey]) return null;

          const tierData = parsed[catKey][inspectedTierKey];
          const catData = parsed[catKey];
          const items = tierItems[inspectedTierKey] || [];
          
          let rules = catData.rules || catData._meta?.rules || [];

          if (effectiveSoundMap?.basetype_sounds) {
              const augmentedRules = [...rules];
              const tierItemNames = items.map(i => i.name);

              tierItemNames.forEach(name => {
                  const sData = effectiveSoundMap.basetype_sounds[name];
                  if (sData) {
                      const handled = rules.some((r: any) => r.targets?.includes(name));
                      if (!handled) {
                          augmentedRules.push({
                              targets: [name],
                              overrides: { PlayAlertSound: [sData.file, sData.volume] },
                              comment: `__AUTO_SOUND__:${name}`,
                              isImplicit: true
                          });
                      }
                  }
              });
              rules = augmentedRules;
          }

          const themeCategory = resolveThemeKey(catData, catKey);
          const resolvedStyle = resolveStyle(tierData, themeData, themeCategory, soundMap, inspectedTierKey);

          return {
              key: inspectedTierKey,
              name: inspectedTierKey,
              style: resolvedStyle,
              visibility: tierHidden(tierData),
              category: themeCategory,
              rules: rules,
              baseTypes: items.map(i => i.name)
          };
      } catch (e) { return null; }
  }, [inspectedTierKey, configContent, tierItems, soundMap, effectiveSoundMap, themeData]);

  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (isDirtyRef.current) {
              e.preventDefault();
              e.returnValue = '';
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const markDirty = () => { isDirtyRef.current = true; setDirtyTick((n) => n + 1); };
  const markClean = () => { isDirtyRef.current = false; };

  const handleRuleEdit = (_tierKey: string, ruleIndex: number | null) => {
    setEditingRuleIndex(ruleIndex);
  };

  const fetchTierItems = async (keys: string[]) => {
    if (keys.length === 0) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tier-items`, { tier_keys: keys });
      setTierItems(res.data.items);
    } catch (err) {
      console.error("Failed to load tier items", err);
    }
  };

  const handleManualItemUpdate = (tierKey: string, updatedItems: any[]) => {
      setTierItems(prev => ({
          ...prev,
          [tierKey]: updatedItems
      }));
  };

  useEffect(() => {
    if (selectedFile?.tier_path) {
      const ts = new Date().getTime();
      Promise.all([
          axios.get(`${API_BASE_URL}/api/config/${selectedFile.tier_path}?t=${ts}`),
          selectedFile.mapping_path ? axios.get(`${API_BASE_URL}/api/config/${selectedFile.mapping_path}?t=${ts}`) : Promise.resolve({ data: { content: {} } })
      ])
      .then(([tierRes, mapRes]) => {
            const tierData = tierRes.data.content;
            const mapData = mapRes.data.content;
            const catKey = Object.keys(tierData).find(k => !k.startsWith('//'));
            const mergedData = JSON.parse(JSON.stringify(tierData));

            const mic = mapData?._meta?.item_class;
            setMappingItemClass(typeof mic === 'string' ? mic : (mic?.en ?? null));
            setSuppressBasetypeSounds(!!mapData?._meta?.suppress_basetype_sounds);

            if (catKey) {
                if (mapData.rules) {
                    mergedData[catKey].rules = mapData.rules;
                }
                const keys = Object.keys(mergedData[catKey]).filter(k => !k.startsWith('//') && k !== '_meta' && k !== 'rules');
                fetchTierItems(keys);
            }
            setConfigContent(JSON.stringify(mergedData, null, 2));
            markClean();
      })
      .catch(err => console.error("Failed to load content", err));
    }
  }, [selectedFile]);

  // `raw` lets a caller persist content it has just built, without waiting for
  // the parent state round-trip. `silent` skips the alert for automatic saves.
  const persistConfig = async (raw?: string, silent = false) => {
      if (!selectedFile) return;
      try {
          const currentViewData = JSON.parse(raw ?? configContent);
          const catKey = Object.keys(currentViewData).find(k => !k.startsWith('//'));
          
          if (catKey) {
              const viewCategory = currentViewData[catKey];
              const rules = viewCategory.rules || [];
              const tierToSave = JSON.parse(JSON.stringify(currentViewData));
              const saveCategory = tierToSave[catKey];
              
              delete saveCategory.rules;
              if (saveCategory._meta?.rules) delete saveCategory._meta.rules;

              let mappingToSave: any = null;
              if (selectedFile.mapping_path) {
                  const ts = new Date().getTime();
                  const mapRes = await axios.get(`${API_BASE_URL}/api/config/${selectedFile.mapping_path}?t=${ts}`);
                  mappingToSave = mapRes.data.content;
                  mappingToSave.rules = rules;
              }

              await Promise.all([
                  axios.post(`${API_BASE_URL}/api/config/${selectedFile.tier_path}`, tierToSave),
                  selectedFile.mapping_path ? axios.post(`${API_BASE_URL}/api/config/${selectedFile.mapping_path}`, mappingToSave) : Promise.resolve()
              ]);
              
              if (!silent) alert(t.saveSuccess);
              markClean();
          }
      } catch (e) {
          console.error("Save failed", e);
          if (!silent) alert(t.saveFailed);
          throw e;
      }
  };

  const handleSave = () => persistConfig();

  // AUTO-SAVE. Rule edits used to live only in component state until this button
  // was pressed, so collapsing a rule, moving it between tiers, or switching
  // category silently dropped them. Item tier assignments already posted
  // immediately, which is what made the inconsistency so easy to miss - half the
  // editor persisted itself and half did not.
  //
  // Debounced rather than per-keystroke: persistConfig does a GET-then-POST per
  // save, and typing a rule comment would otherwise fire one round trip per
  // character. The timer restarts on every change, so a save lands once the user
  // pauses.
  useEffect(() => {
    if (dirtyTick === 0 || !selectedFile?.tier_path) return;
    const timer = setTimeout(() => {
      if (!isDirtyRef.current) return;
      persistConfig(undefined, true)
        .then(() => {
          setToast({ message: t.autoSaved, timestamp: Date.now() });
          setTimeout(() => setToast(null), 1200);
        })
        .catch(() => {
          // markClean() never ran, so the beforeunload guard still protects the
          // edit and the Save button remains the manual fallback.
          setToast({ message: t.autoSaveFailed, timestamp: Date.now() });
          setTimeout(() => setToast(null), 2500);
        });
    }, 1000);
    return () => clearTimeout(timer);
  }, [dirtyTick, selectedFile?.tier_path]);

  // A newly inserted tier lives only in editor state until the category is
  // saved, but assigning items to it posts to the API immediately - so the
  // backend rejects the write (or, before that guard existed, accepted an
  // assignment that silently emitted nothing). Persisting the tier the moment
  // it is created keeps disk and editor in step for every downstream path.
  const persistNewTier = (raw: string) => persistConfig(raw, true);

  const handlePasteStyle = (tierKey: string, style: any) => {
    if (!style || !configContent) return;
    try {
        const parsed = JSON.parse(configContent);
        const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
        if (catKey && parsed[catKey][tierKey]) {
            const currentTheme = parsed[catKey][tierKey].theme || {};
            parsed[catKey][tierKey].theme = { ...currentTheme, ...style };
            setConfigContent(JSON.stringify(parsed, null, 2));
            markDirty();
        }
    } catch (e) { console.error("Paste failed", e); }
  };

  const handleAddRulePreset = (tierKey: string, preset: any) => {
      try {
          const parsed = JSON.parse(configContent);
          const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
          if (catKey) {
              if (!parsed[catKey].rules) parsed[catKey].rules = [];
              const currentRules = parsed[catKey].rules;

              if (editingRuleIndex !== null) {
                const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
                const tierRulesIndices = currentRules.map((r: any, i: number) => ({r, i})).filter(({r}: any) => 
                    !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
                );
                
                const targetEntry = tierRulesIndices[editingRuleIndex];
                if (targetEntry) {
                    const targetRule = currentRules[targetEntry.i];
                    if (!targetRule.conditions) targetRule.conditions = {};
                    const addedKey = Object.keys(preset.conditions || {}).find(k => !targetRule.conditions[k]);
                    Object.assign(targetRule.conditions, preset.conditions || {});
                    if (preset.raw) targetRule.raw = (targetRule.raw || "") + "\n" + preset.raw;
                    
                    const condKey = addedKey || Object.keys(preset.conditions || {})[0];
                    const locName = ruleFactorLabel(condKey, language);
                    setToast({ message: `${t.conditionAdded}: ${locName}`, timestamp: Date.now() });
                    setTimeout(() => setToast(null), 1500);
                }
            } else {
                currentRules.push({
                    targets: [],
                    conditions: preset.conditions || {},
                    overrides: preset.overrides || { Tier: tierKey },
                    comment: preset.comment || "",
                    raw: preset.raw || ""
                });
                setToast({ message: t.ruleAdded, timestamp: Date.now() });
                setTimeout(() => setToast(null), 1500);
            }
            setConfigContent(JSON.stringify(parsed, null, 2));
            markDirty();
        }
    } catch (e) { console.error("Failed to add preset", e); }
  };

  const handleRemoveRule = (tierKey: string, ruleIndex: number) => {
    try {
        const parsed = JSON.parse(configContent);
        const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
        if (catKey && parsed[catKey].rules) {
            const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
            const tierRulesIndices = parsed[catKey].rules.map((r: any, i: number) => ({r, i})).filter(({r}: any) => 
                !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
            );
            
            const targetEntry = tierRulesIndices[ruleIndex];
            if (targetEntry) {
                parsed[catKey].rules.splice(targetEntry.i, 1);
                setConfigContent(JSON.stringify(parsed, null, 2));
                markDirty();
            }
        }
    } catch (e) { console.error("Failed to remove rule", e); }
  };

  const handleGlobalContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setFallbackMenu({ x: e.clientX, y: e.clientY });
  };

  const activeCategoryRules = useMemo(() => {
      if (!configContent) return [];
      try {
          const parsed = JSON.parse(configContent);
          const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
          if (!catKey) return [];
          return parsed[catKey].rules || parsed[catKey]._meta?.rules || [];
      } catch (e) { return []; }
  }, [configContent]);

  // The editing category's item class (EN) — used to recommend class-applicable
  // conditions in the rule editor. It lives in the MAPPING's _meta (102 of 103
  // categories); only 9 tier_definitions carry one, so reading configContent
  // alone left this null nearly everywhere and no condition was ever
  // recommended beyond the universal ones.
  const categoryClass = useMemo<string | null>(() => {
      if (mappingItemClass) return mappingItemClass;
      if (!configContent) return null;
      try {
          const parsed = JSON.parse(configContent);
          const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
          const ic = catKey ? parsed[catKey]?._meta?.item_class : null;
          return typeof ic === 'string' ? ic : (ic?.en ?? null);
      } catch { return null; }
  }, [configContent, mappingItemClass]);

  return (
    <div className="editor-view" onContextMenu={handleGlobalContextMenu}>
      <Sidebar 
        selectedFile={selectedFile?.path || ''} 
        onSelect={setSelectedFile} 
        language={language}
        onOpenSoundManager={() => setShowSoundManager(true)}
      />
      
      <div className="main-content">
        <div className="top-bar">
          <h2>{t.toolbar}</h2>
          <div className="actions">
             {import.meta.env.DEV && (
                <button
                   className={`admin-btn ${adminMode ? 'on' : ''}`}
                   onClick={() => setAdminMode(!adminMode)}
                   title={t.adminModeHint}
                >
                    {adminMode ? '🔓' : '🔒'} {t.adminMode}
                </button>
             )}
             <button className="visibility-btn" onClick={() => setShowVisibilityOverview(true)}>
                 🎚 {t.strictnessGates}
             </button>
             {selectedFile && (
                <button className="save-btn" onClick={handleSave} disabled={loading}>
                    💾 {t.saveConfig}
                </button>
             )}
          </div>
        </div>

        {message && <div className="message-bar">{message}</div>}

        <div className="workspace">
          <div className="editor-pane">
            {!selectedFile ? (
              <div className="placeholder">{t.selectCategory}</div>
            ) : (
                <CategoryView
                  configContent={configContent}
                  onConfigContentChange={(newContent) => {
                    setConfigContent(newContent); 
                    markDirty();
                  }}
                  language={language}
                  onInspectTier={(tier) => setInspectedTierKey(tier.key)} 
                  onRuleEdit={handleRuleEdit}
                  onPingCondition={(tierKey, ruleIdx, condKey) => setPingedCondition({ tierKey, ruleIndex: ruleIdx, conditionKey: condKey, timestamp: Date.now() })}
                  viewerBackground={viewerBackground}
                  tierItems={tierItems}
                  fetchTierItems={fetchTierItems}
                  defaultMappingPath={selectedFile.mapping_path}
                  categoryClass={categoryClass}
                  onPersistNewTier={persistNewTier}
                  onUpdateTierItems={handleManualItemUpdate}
                  pingedCondition={pingedCondition}
                  soundMap={effectiveSoundMap}
                  themeData={themeData}
                  strictness={strictness}
                  levelingSelection={levelingSelection}
                  onLevelingSelectionChange={onLevelingSelectionChange}
                  adminMode={adminMode}
                />
            )}
          </div>
        </div>
      </div>

      <InspectorPanel 
        inspectedTier={inspectedTier}
        editingRuleIndex={editingRuleIndex}
        clipboardStyle={styleClipboard}
        onClearClipboard={() => setStyleClipboard(null)}
        onCopyStyle={setStyleClipboard}
        onPasteStyle={handlePasteStyle}
        onAddRulePreset={handleAddRulePreset}
        onRemoveRule={handleRemoveRule}
        onDeselectRule={() => setEditingRuleIndex(null)}
        language={language}
        viewerBackground={viewerBackground}
        setViewerBackground={setViewerBackground}
        onPingCondition={(tierKey, ruleIdx, condKey) => setPingedCondition({ tierKey, ruleIndex: ruleIdx, conditionKey: condKey, timestamp: Date.now() })}
        soundMap={effectiveSoundMap}
        categoryClass={categoryClass}
      />

      {toast && (
          <div key={toast.timestamp} className="ping-toast">
              {toast.message}
          </div>
      )}

      {showVisibilityOverview && (
          <VisibilityOverview
            language={language}
            onClose={() => setShowVisibilityOverview(false)}
            onApplied={(touchedFiles) => {
                // Refresh the open file if its visibility was changed
                const currentRel = selectedFile?.tier_path?.replace(/^tier_definition\//, '');
                if (currentRel && touchedFiles.includes(currentRel)) {
                    axios.get(`/api/config/${selectedFile!.tier_path}`)
                        .then(res => setConfigContent(JSON.stringify(res.data.content, null, 2)))
                        .catch(err => console.error(err));
                }
            }}
          />
      )}

      {showSoundManager && (
          <SoundBulkEditor
            language={language}
            onClose={() => setShowSoundManager(false)}
            onJumpToRule={onJumpToRule}
            categoryRules={activeCategoryRules}
            themeData={themeData}
            fullConfig={configContent ? JSON.parse(configContent) : null}
            onSave={() => { void loadTheme(); }}
          />
      )}

      {fallbackMenu && (
          <ContextMenu 
            x={fallbackMenu.x}
            y={fallbackMenu.y}
            onClose={() => setFallbackMenu(null)}
            language={language}
            options={[]}
          />
      )}

      <style>{`
        .editor-view { display: flex; flex: 1; overflow: hidden; height: 100%; width: 100%; }
        .main-content { flex: 1; display: flex; flex-direction: column; background: #f0f2f5; min-width: 0; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background: white; border-bottom: 1px solid #ddd; height: 60px; flex-shrink: 0; }
        .top-bar h2 { margin: 0; font-size: 1.1rem; color: #333; }
        .save-btn { 
            background: #4CAF50; color: white !important; border: none; padding: 8px 20px; 
            border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 0.9rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: background 0.2s;
        }
        .save-btn:hover { background: #43a047; }
        .save-btn:disabled { background: #ccc; cursor: not-allowed; }
        .actions { display: flex; gap: 10px; }
        .visibility-btn {
            background: white; color: #333; border: 1px solid #ccc; padding: 8px 16px;
            border-radius: 4px; cursor: pointer; font-size: 0.9rem;
        }
        .visibility-btn:hover { border-color: #4CAF50; color: #2e7d32; }
        .admin-btn {
            background: white; color: #333; border: 1px solid #ccc; padding: 8px 16px;
            border-radius: 4px; cursor: pointer; font-size: 0.9rem;
        }
        .admin-btn:hover { border-color: #e53935; color: #c62828; }
        /* Unmistakable while the guard is lifted - this is not a state to sit in. */
        .admin-btn.on {
            background: #c62828; color: #fff; border-color: #c62828; font-weight: 600;
        }
        .admin-btn.on:hover { background: #b71c1c; color: #fff; }

        .workspace { flex: 1; padding: 0; overflow: hidden; display: flex; }
        .editor-pane { 
          background: #f0f2f5; 
          padding: 20px; 
          overflow-y: auto; 
          display: flex; 
          flex-direction: column; 
          flex: 1;
        }
        .placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 1.2rem; background: #fafafa; border: 2px dashed #eee; border-radius: 8px; margin: 20px; }
        .message-bar { padding: 8px 25px; background: #e8f5e9; color: #2e7d32; font-size: 0.85rem; border-bottom: 1px solid #c8e6c9; }
        
        .ping-toast {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #323232;
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 3000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: fadeInOut 1.5s ease-in-out;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, 20px); }
            15% { opacity: 1; transform: translate(-50%, 0); }
            85% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
        }
      `}</style>
    </div>
  );
};

export default EditorView;
