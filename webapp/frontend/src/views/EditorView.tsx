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

  const handleRuleEdit = (tierKey: string, ruleIndex: number | null) => {
    setEditingRuleIndex(ruleIndex);
    // If we're editing a rule but another tier is inspected, the user expects to see the code for the rule they just clicked.
    // However, onInspectTier is usually triggered by clicking the visual block.
    // For now we just sync the index.
  };

  useEffect(() => {
    if (selectedFile?.tier_path) {
      axios.get(`http://localhost:8000/api/config/${selectedFile.tier_path}`)
        .then(res => {
            const content = JSON.stringify(res.data.content, null, 2);
            setTierContent(content);
            setConfigContent(content);
        })
        .catch(err => console.error("Failed to load tier content", err));
    }
  }, [selectedFile, setConfigContent]);

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
            if (!parsed[catKey]._meta) parsed[catKey]._meta = {};
            if (!parsed[catKey]._meta.rules) parsed[catKey]._meta.rules = [];
            
            const currentRules = parsed[catKey]._meta.rules;

            if (editingRuleIndex !== null) {
                // UPDATE CURRENT RULE: Find the global index of the rule being edited
                const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
                const tierRules = currentRules.filter((r: any) => 
                    !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
                );
                const targetRule = tierRules[editingRuleIndex];
                
                if (targetRule) {
                    targetRule.conditions = { ...targetRule.conditions, ...preset.conditions };
                    if (preset.raw) targetRule.raw = (targetRule.raw || "") + "\n" + preset.raw;
                }
            } else {
                // ADD NEW RULE (Original logic)
                const newRule = {
                    targets: [],
                    conditions: preset.conditions || {},
                    overrides: preset.overrides || { Tier: tierKey },
                    comment: preset.comment || "New Preset Rule",
                    raw: preset.raw || ""
                };
                currentRules.push(newRule);
            }
            
            const newContent = JSON.stringify(parsed, null, 2);
            setTierContent(newContent);
            setConfigContent(newContent);
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
        if (catKey && parsed[catKey]._meta?.rules) {
            // We need to find the GLOBAL index of the rule
            // The index passed from Inspector is relative to the INSPECTED TIER'S subset of rules.
            // But for simplicity in this implementation, we'll just match by reference or rebuild the list.
            // Actually, let's just use the index if it matches the filtered list.
            
            const currentTierItems = tierItems[tierKey]?.map(i => i.name) || [];
            const tierRules = parsed[catKey]._meta.rules.filter((r: any) => 
                !r.targets?.length || r.targets.some((t: string) => currentTierItems.includes(t))
            );
            
            const targetRule = tierRules[ruleIndex];
            if (targetRule) {
                parsed[catKey]._meta.rules = parsed[catKey]._meta.rules.filter((r: any) => r !== targetRule);
                const newContent = JSON.stringify(parsed, null, 2);
                setTierContent(newContent);
                setConfigContent(newContent);
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
          <h2>Editor: {selectedFile?.localization[language] || '...'}</h2>
          <div className="actions">
             {selectedFile && (
                <button className="save-btn" onClick={onSave} disabled={loading}>
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
                  configContent={tierContent}
                  onConfigContentChange={(newContent) => {
                    setTierContent(newContent);
                    setConfigContent(newContent); 
                  }}
                  loading={loading}
                  language={language}
                  onInspectTier={setInspectedTier} 
                  styleClipboard={styleClipboard} 
                  onCopyStyle={setStyleClipboard} 
                  onRuleEdit={handleRuleEdit}
                  viewerBackground={viewerBackground}
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