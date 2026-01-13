import React from 'react';
import Sidebar from '../components/Sidebar';
import ConfigEditor from '../components/ConfigEditor';
import MappingEditor from '../components/MappingEditor';

interface EditorViewProps {
  configs: string[];
  selectedConfigPath: string;
  setSelectedConfigPath: (path: string) => void;
  configContent: string;
  setConfigContent: (content: string) => void;
  loading: boolean;
  jsonError: string;
  onSave: () => void;
  message: string;
}

const EditorView: React.FC<EditorViewProps> = ({
  configs,
  selectedConfigPath,
  setSelectedConfigPath,
  configContent,
  setConfigContent,
  loading,
  jsonError,
  onSave,
  message
}) => {
  const isBaseMapping = selectedConfigPath.startsWith('base_mapping/');

  return (
    <div className="editor-view">
      <Sidebar 
        files={configs} 
        selectedFile={selectedConfigPath} 
        onSelect={setSelectedConfigPath} 
      />
      
      <div className="main-content">
        <div className="top-bar">
          <h2>Editor</h2>
          <div className="actions">
             {!isBaseMapping && selectedConfigPath && (
                <button onClick={onSave} disabled={loading || !!jsonError}>Save Config</button>
             )}
          </div>
        </div>

        {message && <div className="message-bar">{message}</div>}

        <div className="workspace">
          <div className="editor-pane full-width">
            {!selectedConfigPath ? (
              <div className="placeholder">Select a file from the sidebar to edit</div>
            ) : isBaseMapping ? (
                <MappingEditor 
                    configPath={selectedConfigPath} 
                    onSave={onSave}
                />
            ) : (
                <ConfigEditor
                  configPath={selectedConfigPath}
                  configContent={configContent}
                  onConfigContentChange={setConfigContent}
                  loading={loading}
                  jsonError={jsonError} 
                />
            )}
          </div>
        </div>
      </div>
      <style>{`
        .editor-view { display: flex; flex: 1; overflow: hidden; height: 100%; }
        .main-content { flex: 1; display: flex; flex-direction: column; background: #f0f0f0; min-width: 0; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-bottom: 1px solid #ddd; }
        .top-bar h2 { margin: 0; font-size: 1.2rem; }
        .workspace { flex: 1; padding: 20px; overflow: hidden; display: flex; }
        .editor-pane { background: white; padding: 20px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-y: auto; display: flex; flex-direction: column; }
        .editor-pane.full-width { flex: 1; }
        .placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: #888; font-size: 1.2rem; }
        .message-bar { padding: 5px 20px; background: #e8f5e9; color: #2e7d32; font-size: 0.9rem; }
      `}</style>
    </div>
  );
};

export default EditorView;
