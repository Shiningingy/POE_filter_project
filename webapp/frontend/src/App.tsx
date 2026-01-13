import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import ConfigEditor from './components/ConfigEditor'; 
import MappingEditor from './components/MappingEditor'; 
import Sidebar from './components/Sidebar'; // Import Sidebar
import { getThemes } from './services/api'; 

function App() {
  const [themes, setThemes] = useState<string[]>([]);
  const [configs, setConfigs] = useState<string[]>([]);
  const [selectedConfigPath, setSelectedConfigPath] = useState<string>('');
  const [configContent, setConfigContent] = useState<string>('{}'); 
  const [filterPreview, setFilterPreview] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string>(''); 

  const API_BASE_URL = 'http://localhost:8000'; 

  // Fetches the list of themes
  const fetchThemes = useCallback(async () => {
    try {
      const response = await getThemes();
      setThemes(response.themes);
    } catch (error) {
      console.error('Error fetching themes:', error);
      setMessage('Failed to load themes.');
    }
  }, []);

  // Validates JSON input
  const validateJson = (jsonString: string) => {
    try {
      JSON.parse(jsonString);
      setJsonError('');
      return true;
    } catch (e: any) {
      setJsonError(e.message);
      return false;
    }
  };

  // Fetches the list of all available config files
  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/configs`);
      setConfigs(response.data.configs);
      // Don't auto-select first config, let user choose from sidebar
      setMessage('Select a file from the sidebar to edit.');
    } catch (error) {
      console.error('Error fetching configs:', error);
      setMessage('Failed to load config list.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetches the content of a specific config file
  const fetchConfigContent = useCallback(async (path: string) => {
    // Skip if it's a base mapping, MappingEditor handles its own fetching
    if (path.startsWith('base_mapping/')) return;

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/config/${path}`);
      const contentString = JSON.stringify(response.data.content, null, 2);
      setConfigContent(contentString);
      validateJson(contentString); 
      setMessage(`Loaded config: ${path}`);
    } catch (error) {
      console.error(`Error fetching config ${path}:`, error);
      setMessage(`Failed to load config: ${path}.`);
      setConfigContent('{}'); 
      setJsonError('Failed to load or parse config content.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Saves the content of the currently selected config file
  const saveConfigContent = async () => {
    if (!selectedConfigPath) {
      setMessage('No config file selected to save.');
      return;
    }
    if (!validateJson(configContent)) {
      setMessage('Cannot save: Invalid JSON content.');
      return;
    }

    setLoading(true);
    try {
      const contentObject = JSON.parse(configContent);
      await axios.post(`${API_BASE_URL}/api/config/${selectedConfigPath}`, contentObject);
      setMessage(`Config '${selectedConfigPath}' saved successfully!`);
    } catch (error) {
      console.error(`Error saving config ${selectedConfigPath}:`, error);
      setMessage(`Failed to save config: ${selectedConfigPath}.`);
    } finally {
      setLoading(false);
    }
  };

  // Triggers the filter generation on the backend
  const generateFilter = async () => {
    setLoading(true);
    try {
      setMessage('Generating filter...');
      const response = await axios.post(`${API_BASE_URL}/api/generate`);
      setMessage(`Filter generated successfully! ${response.data.output || ''}`);
      await fetchFilterPreview(); 
    } catch (error: any) {
      console.error('Error generating filter:', error);
      setMessage(`Failed to generate filter: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetches the content of the generated filter file
  const fetchFilterPreview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/generated-filter`);
      setFilterPreview(response.data.content);
      setMessage('Filter preview updated.');
    } catch (error) {
      console.error('Error fetching filter preview:', error);
      setMessage('Failed to fetch filter preview.');
      setFilterPreview('Error loading filter preview.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect to load data on component mount
  useEffect(() => {
    fetchThemes();
    fetchConfigs();
    fetchFilterPreview();
  }, [fetchThemes, fetchConfigs, fetchFilterPreview]); 

  // Effect to load content when selectedConfigPath changes
  useEffect(() => {
    if (selectedConfigPath) {
      fetchConfigContent(selectedConfigPath);
    }
  }, [selectedConfigPath, fetchConfigContent]);

  const isBaseMapping = selectedConfigPath.startsWith('base_mapping/');

  return (
    <div className="App">
      <div className="app-container">
        <Sidebar 
          files={configs} 
          selectedFile={selectedConfigPath} 
          onSelect={setSelectedConfigPath} 
        />
        
        <div className="main-content">
          <div className="top-bar">
            <h1>POE Filter Editor</h1>
            <div className="global-actions">
               {/* Only show Save button here for ConfigEditor */}
               {!isBaseMapping && selectedConfigPath && (
                  <button onClick={saveConfigContent} disabled={loading || !!jsonError}>Save Config</button>
               )}
               <button onClick={generateFilter} disabled={loading} className="generate-btn">Generate Filter</button>
            </div>
          </div>

          {message && <div className="message-bar">{message}</div>}

          <div className="workspace">
            <div className="editor-pane">
              {!selectedConfigPath ? (
                <div className="placeholder">Select a file from the sidebar to edit</div>
              ) : isBaseMapping ? (
                  <MappingEditor 
                      configPath={selectedConfigPath} 
                      onSave={() => setMessage(`Mapping '${selectedConfigPath}' saved!`)}
                  />
              ) : (
                  <ConfigEditor
                    configPath={selectedConfigPath}
                    configContent={configContent}
                    onConfigContentChange={(newContent) => {
                      setConfigContent(newContent);
                      validateJson(newContent);
                    }}
                    loading={loading}
                    jsonError={jsonError} 
                  />
              )}
            </div>

            <div className="preview-pane">
              <h3>Generated Filter Preview</h3>
              <textarea
                className="filter-output"
                value={filterPreview}
                readOnly
                placeholder="Generated filter will appear here..."
              ></textarea>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .app-container { display: flex; height: 100vh; overflow: hidden; }
        .main-content { flex: 1; display: flex; flex-direction: column; background: #f0f0f0; }
        .top-bar { 
          display: flex; justify-content: space-between; align-items: center; 
          padding: 10px 20px; background: white; border-bottom: 1px solid #ddd; 
        }
        .top-bar h1 { margin: 0; font-size: 1.2rem; color: #333; }
        .global-actions { display: flex; gap: 10px; }
        .generate-btn { background-color: #2196F3; color: white; border: none; padding: 8px 16px; cursor: pointer; }
        .message-bar { padding: 5px 20px; background: #e8f5e9; color: #2e7d32; font-size: 0.9rem; }
        
        .workspace { flex: 1; display: flex; padding: 20px; gap: 20px; overflow: hidden; }
        .editor-pane { flex: 2; display: flex; flex-direction: column; background: white; padding: 20px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-y: auto; }
        .preview-pane { flex: 1; display: flex; flex-direction: column; background: white; padding: 20px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        
        .filter-output { width: 100%; flex: 1; resize: none; border: 1px solid #ddd; font-family: monospace; font-size: 0.8rem; padding: 10px; }
        .placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: #888; font-size: 1.2rem; }
      `}</style>
    </div>
  );
}

export default App;