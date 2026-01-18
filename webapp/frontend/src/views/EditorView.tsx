import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import type { CategoryFile } from '../components/Sidebar';
import CategoryView from '../components/CategoryView';
import InspectorPanel from '../components/InspectorPanel'; 
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

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
  setViewerBackground
}) => {
  const t = useTranslation(language);
  const [inspectedTier, setInspectedTier] = useState<any>(null);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [tierItems, setTierItems] = useState<Record<string, any[]>>({});
  const isDirtyRef = React.useRef(false);

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

  const markDirty = () => { isDirtyRef.current = true; };
  const markClean = () => { isDirtyRef.current = false; };

  const handleRuleEdit = (_tierKey: string, ruleIndex: number | null) => {
    setEditingRuleIndex(ruleIndex);
  };

  const API_BASE_URL = '';

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
      
      // Load BOTH Tier Definition and Base Mapping
      Promise.all([
          axios.get(`${API_BASE_URL}/api/config/${selectedFile.tier_path}?t=${ts}`),
          selectedFile.mapping_path ? axios.get(`${API_BASE_URL}/api/config/${selectedFile.mapping_path}?t=${ts}`) : Promise.resolve({ data: { content: {} } })
      ])
      .then(([tierRes, mapRes]) => {
            const tierData = tierRes.data.content;
            const mapData = mapRes.data.content;
            
            // MERGE RULES into Tier Data for Frontend View
            const catKey = Object.keys(tierData).find(k => !k.startsWith('//'));
            const mergedData = JSON.parse(JSON.stringify(tierData)); // Deep copy
            
            if (catKey) {
                // Inject rules from mapping file (root level 'rules')
                if (mapData.rules) {
                    mergedData[catKey].rules = mapData.rules;
                }
                
                // Fetch items
                const keys = Object.keys(mergedData[catKey]).filter(k => k.startsWith('Tier'));
                fetchTierItems(keys);
            }
            
            // Update the VIEW
            setConfigContent(JSON.stringify(mergedData, null, 2));
            markClean(); // Initial load is clean
      })
      .catch(err => console.error("Failed to load content", err));
    }
  }, [selectedFile]);

  // Override the Save function to split and save both files
  const handleSave = async () => {
      if (!selectedFile) return;
      try {
          const currentViewData = JSON.parse(configContent);
          const catKey = Object.keys(currentViewData).find(k => !k.startsWith('//'));
          
          if (catKey) {
              const viewCategory = currentViewData[catKey];
              const rules = viewCategory.rules || [];

              // 1. Prepare Tier Definition (remove items and rules)
              const tierToSave = JSON.parse(JSON.stringify(currentViewData));
              const saveCategory = tierToSave[catKey];
              
              // Remove rules from Tier Definition (they live in mapping)
              delete saveCategory.rules;
              if (saveCategory._meta?.rules) delete saveCategory._meta.rules;

              // 2. Prepare Base Mapping (update only rules)
              let mappingToSave: any = null;
              if (selectedFile.mapping_path) {
                  // We need to fetch the original mapping to preserve other fields
                  const ts = new Date().getTime();
                  const mapRes = await axios.get(`${API_BASE_URL}/api/config/${selectedFile.mapping_path}?t=${ts}`);
                  mappingToSave = mapRes.data.content;
                  mappingToSave.rules = rules;
              }

              // 3. Save Both
              await Promise.all([
                  axios.post(`${API_BASE_URL}/api/config/${selectedFile.tier_path}`, tierToSave),
                  selectedFile.mapping_path ? axios.post(`${API_BASE_URL}/api/config/${selectedFile.mapping_path}`, mappingToSave) : Promise.resolve()
              ]);
              
              alert("Saved successfully!");
              markClean();
          }
      } catch (e) {
          console.error("Save failed", e);
          alert("Save failed");
      }
  };

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
            
            if (inspectedTier && inspectedTier.key === tierKey) {
                setInspectedTier({ ...inspectedTier, style: parsed[catKey][tierKey].theme });
            }
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
                // Find rule in THIS tier
                const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
                const tierRulesIndices = currentRules.map((r: any, i: number) => ({r, i})).filter(({r}: any) => 
                    !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
                );
                
                const targetEntry = tierRulesIndices[editingRuleIndex];
                if (targetEntry) {
                    const targetRule = currentRules[targetEntry.i];
                    if (!targetRule.conditions) targetRule.conditions = {};
                    Object.assign(targetRule.conditions, preset.conditions || {});
                    if (preset.raw) targetRule.raw = (targetRule.raw || "") + "\n" + preset.raw;
                }
            } else {
                currentRules.push({
                    targets: [],
                    conditions: preset.conditions || {},
                    overrides: preset.overrides || { Tier: tierKey },
                    comment: preset.comment || "",
                    raw: preset.raw || ""
                });
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

  return (
    <div className="editor-view">
      <Sidebar 
        selectedFile={selectedFile?.path || ''} 
        onSelect={setSelectedFile} 
        language={language}
      />
      
      <div className="main-content">
        <div className="top-bar">
          <h2>Editor: {selectedFile?.localization[language] || '...'} <small style={{fontSize: '0.7em', color: '#999'}}>({selectedFile?.mapping_path || 'No Mapping'})</small></h2>
          <div className="actions">
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
              <div className="placeholder">Select a category from the sidebar to edit</div>
            ) : (
                <CategoryView
                  configContent={configContent}
                  onConfigContentChange={(newContent) => {
                    // Update the merged view
                    setConfigContent(newContent); 
                    markDirty();
                  }}
                  language={language}
                  onInspectTier={setInspectedTier} 
                  onRuleEdit={handleRuleEdit}
                  viewerBackground={viewerBackground}
                  tierItems={tierItems}
                  fetchTierItems={fetchTierItems}
                  defaultMappingPath={selectedFile.mapping_path}
                  onUpdateTierItems={handleManualItemUpdate}
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
      />

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
      `}</style>
    </div>
  );
};

export default EditorView;