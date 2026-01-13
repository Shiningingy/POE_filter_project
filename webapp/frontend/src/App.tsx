import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import { getThemes } from './services/api';
import EditorView from './views/EditorView';
import SimulatorView from './views/SimulatorView';
import ExportView from './views/ExportView';

function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<'editor' | 'simulator' | 'export'>('editor');
  const [language, setLanguage] = useState<'ch' | 'en'>('ch');

  // Shared Data State
  const [themes, setThemes] = useState<string[]>([]);
  const [configs, setConfigs] = useState<string[]>([]);
  const [selectedConfigPath, setSelectedConfigPath] = useState<string>('');
  const [configContent, setConfigContent] = useState<string>('{}'); 
  const [filterPreview, setFilterPreview] = useState<string>('');
  
  // Status State
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string>(''); 

  const API_BASE_URL = 'http://localhost:8000'; 

  // --- API Calls ---

  const fetchThemes = useCallback(async () => {
    try {
      const response = await getThemes();
      setThemes(response.themes);
    } catch (error) {
      console.error('Error fetching themes:', error);
    }
  }, []);

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

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/configs`);
      setConfigs(response.data.configs);
    } catch (error) {
      console.error('Error fetching configs:', error);
      setMessage('Failed to load config list.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfigContent = useCallback(async (path: string) => {
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
      setConfigContent('{}'); 
      setJsonError('Failed to load or parse config content.');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfigContent = async () => {
    if (!selectedConfigPath) return;
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

  const generateFilter = async () => {
    setLoading(true);
    try {
      setMessage('Generating filter...');
      const response = await axios.post(`${API_BASE_URL}/api/generate`);
      setMessage(`Filter generated successfully!\n${response.data.output || ''}`);
      await fetchFilterPreview(); 
    } catch (error: any) {
      console.error('Error generating filter:', error);
      setMessage(`Failed to generate filter: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterPreview = useCallback(async () => {
    // Silent load mostly, unless error
    try {
      const response = await axios.get(`${API_BASE_URL}/api/generated-filter`);
      setFilterPreview(response.data.content);
    } catch (error) {
      console.error('Error fetching filter preview:', error);
      setFilterPreview('Error loading filter preview (Not generated yet?).');
    }
  }, []);

  // --- Effects ---

  useEffect(() => {
    fetchThemes();
    fetchConfigs();
    fetchFilterPreview();
  }, [fetchThemes, fetchConfigs, fetchFilterPreview]); 

  useEffect(() => {
    if (selectedConfigPath) {
      fetchConfigContent(selectedConfigPath);
    }
  }, [selectedConfigPath, fetchConfigContent]);

  // --- Rendering ---

  return (
    <div className="App">
      <div className="navbar">
        <div className="brand">POE Filter Editor</div>
        <div className="nav-links">
          <button className={currentView === 'editor' ? 'active' : ''} onClick={() => setCurrentView('editor')}>Editor</button>
          <button className={currentView === 'simulator' ? 'active' : ''} onClick={() => setCurrentView('simulator')}>Simulator</button>
          <button className={currentView === 'export' ? 'active' : ''} onClick={() => setCurrentView('export')}>Save & Export</button>
        </div>
        <div className="language-toggle">
            <button onClick={() => setLanguage(l => l === 'ch' ? 'en' : 'ch')}>
                {language === 'ch' ? 'Language: 中文' : 'Language: EN'}
            </button>
        </div>
      </div>

      <div className="app-body">
        {currentView === 'editor' && (
          <EditorView 
            configs={configs}
            selectedConfigPath={selectedConfigPath}
            setSelectedConfigPath={setSelectedConfigPath}
            configContent={configContent}
            setConfigContent={setConfigContent}
            loading={loading}
            jsonError={jsonError}
            onSave={saveConfigContent}
            message={message}
            language={language}
          />
        )}
        {currentView === 'simulator' && (
          <SimulatorView filterContent={filterPreview} />
        )}
        {currentView === 'export' && (
          <ExportView 
            onGenerate={generateFilter} 
            loading={loading} 
            message={message} 
          />
        )}
      </div>

      <style>{`
        .App { display: flex; flex-direction: column; height: 100vh; font-family: 'Segoe UI', sans-serif; }
        .navbar { 
          display: flex; align-items: center; padding: 0 20px; 
          background: #333; color: white; height: 50px; flex-shrink: 0; 
        }
        .brand { font-weight: bold; font-size: 1.2rem; margin-right: 40px; }
        .nav-links { display: flex; height: 100%; }
        .nav-links button {
          background: none; border: none; color: #ccc; 
          padding: 0 20px; cursor: pointer; height: 100%; font-size: 1rem;
          border-bottom: 3px solid transparent;
        }
        .nav-links button:hover { color: white; background: #444; }
        .nav-links button.active { color: white; border-bottom-color: #2196F3; background: #2a2a2a; }
        
        .app-body { flex: 1; overflow: hidden; position: relative; }
      `}</style>
    </div>
  );
}

export default App;
