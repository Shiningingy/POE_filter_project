import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import type { CategoryFile } from '../components/Sidebar';
import CategoryView from '../components/CategoryView';
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
  language
}) => {
  const [tierContent, setTierContent] = useState<string>('');

  useEffect(() => {
    if (selectedFile?.tier_path) {
      axios.get(`http://localhost:8000/api/config/${selectedFile.tier_path}`)
        .then(res => setTierContent(JSON.stringify(res.data.content, null, 2)))
        .catch(err => console.error("Failed to load tier content", err));
    }
  }, [selectedFile]);

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
          <div className="editor-pane full-width">
            {!selectedFile ? (
              <div className="placeholder">Select a category from the sidebar to edit</div>
            ) : (
                <CategoryView
                  configPath={selectedFile.tier_path}
                  configContent={tierContent}
                  onConfigContentChange={(newContent) => {
                    setTierContent(newContent);
                    // Pass to parent if we want global save button to work
                    setConfigContent(newContent); 
                  }}
                  loading={loading}
                  language={language}
                />
            )}
          </div>
        </div>
      </div>
      <style>{`
        .editor-view { display: flex; flex: 1; overflow: hidden; height: 100%; }
        .main-content { flex: 1; display: flex; flex-direction: column; background: #f0f2f5; min-width: 0; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 25px; background: white; border-bottom: 1px solid #ddd; height: 60px; flex-shrink: 0; }
        .top-bar h2 { margin: 0; font-size: 1.1rem; color: #333; }
        .workspace { flex: 1; padding: 25px; overflow: hidden; display: flex; }
        .editor-pane { 
          background: white; 
          padding: 30px; 
          border-radius: 8px; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
          overflow-y: auto; 
          display: flex; 
          flex-direction: column; 
          flex: 1;
          border: 1px solid #e1e4e8;
        }
        .placeholder { 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          height: 100%; 
          color: #999; 
          font-size: 1.2rem;
          background: #fafafa;
          border: 2px dashed #eee;
          border-radius: 8px;
        }
        .message-bar { padding: 8px 25px; background: #e8f5e9; color: #2e7d32; font-size: 0.85rem; border-bottom: 1px solid #c8e6c9; }
      `}</style>
    </div>
  );
};

export default EditorView;