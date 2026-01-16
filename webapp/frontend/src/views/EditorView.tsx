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
  jsonError: string;
  onSave: () => void;
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
  jsonError,
  onSave,
  message,
  language,
  styleClipboard,
  setStyleClipboard,
  viewerBackground,
  setViewerBackground
}) => {
  const t = useTranslation(language);
  const [tierContent, setTierContent] = useState<string>('');
  const [inspectedTier, setInspectedTier] = useState<any>(null);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [tierItems, setTierItems] = useState<Record<string, any[]>>({});

  const handleRuleEdit = (tierKey: string, ruleIndex: number | null) => {
    setEditingRuleIndex(ruleIndex);
  };

  const API_BASE_URL = 'http://localhost:8000';

  const [mappingContent, setMappingContent] = useState<string>('');

  const fetchTierItems = async (keys: string[]) => {
    if (keys.length === 0) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tier-items`, { tier_keys: keys });
      setTierItems(res.data.items);
    } catch (err) {
      console.error("Failed to load tier items", err);
    }
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
            
            // Store raw content
            setTierContent(JSON.stringify(tierData, null, 2));
            setMappingContent(JSON.stringify(mapData, null, 2));

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
              // 1. Prepare Tier Definition (Remove rules)
              const tierToSave = JSON.parse(JSON.stringify(currentViewData));
              if (tierToSave[catKey].rules) delete tierToSave[catKey].rules;
              if (tierToSave[catKey]._meta?.rules) delete tierToSave[catKey]._meta.rules;

              // 2. Prepare Mapping (Update rules)
              const mappingToSave = JSON.parse(mappingContent || "{}");
              if (currentViewData[catKey].rules) {
                  mappingToSave.rules = currentViewData[catKey].rules;
              }
              
              // 3. Save Both
              await Promise.all([
                  axios.post(`${API_BASE_URL}/api/config/${selectedFile.tier_path}`, tierToSave),
                  selectedFile.mapping_path ? axios.post(`${API_BASE_URL}/api/config/${selectedFile.mapping_path}`, mappingToSave) : Promise.resolve()
              ]);
              
              // Call parent onSave to trigger generic success message or refresh
              if (onSave) onSave(); // Note: Parent onSave might try to save too, but we are intercepting logic here? 
              // Actually EditorView calls onSave prop. We should probably NOT call parent's onSave if it blindly saves configContent to tierPath.
              // Instead, we show success here.
              alert("Saved successfully!");
          }
      } catch (e) {
          console.error("Save failed", e);
          alert("Save failed");
      }
  };

  const handlePasteStyle = (tierKey: string, style: any) => {
    if (!style || !tierContent) return;
    
    try {
        const parsed = JSON.parse(tierContent);
        // Find category (assuming first one)
        const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
        if (catKey) {
            const currentTheme = parsed[catKey][tierKey].theme || {};
            parsed[catKey][tierKey].theme = { ...currentTheme, ...style };
            const newContent = JSON.stringify(parsed, null, 2);
            setTierContent(newContent);
            setConfigContent(newContent);
            
            // Refresh inspected tier UI if it's the one we just pasted to
            if (inspectedTier && inspectedTier.key === tierKey) {
                setInspectedTier({ ...inspectedTier, style: parsed[catKey][tierKey].theme });
            }
        }
    } catch (e) {
        console.error("Paste failed", e);
    }
  };

      const handleAddRulePreset = (tierKey: string, preset: any) => {

      if (!tierContent) return;

      try {

          const parsed = JSON.parse(tierContent);

          const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));

          if (catKey) {

              // Ensure rules array exists at root

              if (!parsed[catKey].rules) parsed[catKey].rules = [];

              // Migrate old if needed

              if (parsed[catKey]._meta?.rules) {

                  parsed[catKey].rules = [...parsed[catKey].rules, ...parsed[catKey]._meta.rules];

                  delete parsed[catKey]._meta.rules;

              }

              

              const currentRules = parsed[catKey].rules;

  

              if (editingRuleIndex !== null) {

  
                // UPDATE CURRENT RULE
                const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
                const tierRules = currentRules.filter((r: any) => 
                    !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
                );
                const targetRule = tierRules[editingRuleIndex];
                
                if (targetRule) {
                    if (!targetRule.conditions) targetRule.conditions = {};
                    
                    if (Array.isArray(preset.conditions)) {
                        preset.conditions.forEach((c: any) => {
                            targetRule.conditions[c.key] = c.value;
                        });
                    } else {
                        Object.assign(targetRule.conditions, preset.conditions);
                    }
                    if (preset.raw) targetRule.raw = (targetRule.raw || "") + "\n" + preset.raw;
                }
            } else {
                // ADD NEW RULE
                // Limit removed to support sequential processing
                
                const conditions: Record<string, string> = {};
                if (Array.isArray(preset.conditions)) {
                    preset.conditions.forEach((c: any) => { conditions[c.key] = c.value; });
                } else {
                    Object.assign(conditions, preset.conditions);
                }
                
                const newRule = {
                    targets: [],
                    conditions: conditions,
                    overrides: preset.overrides || { Tier: tierKey },
                    comment: preset.comment || "",
                    raw: preset.raw || ""
                };
                currentRules.push(newRule);
            }
            
            const newContent = JSON.stringify(parsed, null, 2);
            setTierContent(newContent);
            setConfigContent(newContent);

            // Trigger inspector refresh if this tier is active
            if (inspectedTier && inspectedTier.key === tierKey) {
                const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
                setInspectedTier({
                    ...inspectedTier,
                    rules: parsed[catKey].rules.filter((r: any) => 
                        !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
                    )
                });
            }
        }
    } catch (e) {
        console.error("Failed to add preset", e);
    }
  };

  const handleRemoveRule = (tierKey: string, ruleIndex: number) => {
    if (!tierContent) return;
    try {
        const parsed = JSON.parse(tierContent);
        const catKey = Object.keys(parsed).find(k => !k.startsWith('//'));
        
        // Normalize rules location
        let rules = parsed[catKey].rules || parsed[catKey]._meta?.rules || [];
        
        if (catKey && rules) {
            // We need to find the GLOBAL index of the rule
            const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
            const tierRules = rules.filter((r: any) => 
                !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
            );
            
            const targetRule = tierRules[ruleIndex];
            if (targetRule) {
                // Filter out the target rule
                parsed[catKey].rules = rules.filter((r: any) => r !== targetRule);
                if (parsed[catKey]._meta?.rules) delete parsed[catKey]._meta.rules; // Cleanup old

                const newContent = JSON.stringify(parsed, null, 2);
                setTierContent(newContent);
                setConfigContent(newContent);

                // Refresh inspector
                if (inspectedTier && inspectedTier.key === tierKey) {
                    setInspectedTier({
                        ...inspectedTier,
                        rules: parsed[catKey].rules.filter((r: any) => 
                            !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
                        )
                    });
                }
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
                  configPath={selectedFile.tier_path}
                  configContent={configContent}
                  onConfigContentChange={(newContent) => {
                    // Update the merged view
                    setConfigContent(newContent); 
                    // Note: We don't update tierContent directly here, because newContent is merged.
                    // Splitting happens on Save.
                  }}
                  loading={loading}
                  language={language}
                  onInspectTier={setInspectedTier} 
                  onCopyStyle={setStyleClipboard} 
                  onRuleEdit={handleRuleEdit}
                  viewerBackground={viewerBackground}
                  tierItems={tierItems}
                  fetchTierItems={fetchTierItems}
                  defaultMappingPath={selectedFile.mapping_path}
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