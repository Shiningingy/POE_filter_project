import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import type { CategoryFile } from '../components/Sidebar';
import CategoryView from '../components/CategoryView';
import InspectorPanel from '../components/InspectorPanel'; 
import axios from 'axios';
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
  const [tierContent, setTierContent] = useState<string>('');
  const [inspectedTier, setInspectedTier] = useState<any>(null);

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
                <button onClick={onSave} disabled={loading}>Save Config</button>
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
                  viewerBackground={viewerBackground}
                />
            )}
          </div>
        </div>
      </div>

      <InspectorPanel 
        inspectedTier={inspectedTier}
        clipboardStyle={styleClipboard}
        onClearClipboard={() => setStyleClipboard(null)}
        onCopyStyle={setStyleClipboard}
        onPasteStyle={handlePasteStyle}
        language={language}
        viewerBackground={viewerBackground}
        setViewerBackground={setViewerBackground}
      />

      <style>{`
        .editor-view { display: flex; flex: 1; overflow: hidden; height: 100%; width: 100%; }
        .main-content { flex: 1; display: flex; flex-direction: column; background: #f0f2f5; min-width: 0; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; background: white; border-bottom: 1px solid #ddd; height: 60px; flex-shrink: 0; }
        .top-bar h2 { margin: 0; font-size: 1.1rem; color: #333; }
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