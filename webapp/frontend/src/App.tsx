import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import ConfigEditor from './components/ConfigEditor'; 
import MappingEditor from './components/MappingEditor'; 
import DropSimulator from './components/DropSimulator'; 
import Sidebar from './components/Sidebar'; 
import { getThemes } from './services/api'; 
import { useTranslation } from './utils/localization';
import type { Language } from './utils/localization';
import type { CategoryFile } from './components/Sidebar';
import EditorView from './views/EditorView';
import SimulatorView from './views/SimulatorView';
import ExportView from './views/ExportView';

function App() {
  const [currentView, setCurrentView] = useState<'editor' | 'simulator' | 'export'>('editor');
  const [language, setLanguage] = useState<Language>('ch');
  const [gameVersion, setGameVersion] = useState<'poe1' | 'poe2'>('poe1');
  const [gameMode, setGameMode] = useState<'normal' | 'ruthless'>('ruthless');
  
  const t = useTranslation(language);

  // Selection state
  const [selectedFile, setSelectedFile] = useState<CategoryFile | null>(null);
  
  // Data for ConfigEditor (fallback)
  const [configContent, setConfigContent] = useState<string>('{}'); 
  const [filterPreview, setFilterPreview] = useState<string>('');
  
  // Status State
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string>(''); 

  const API_BASE_URL = 'http://localhost:8000'; 

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

  const fetchConfigContent = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/config/${path}`);
      const contentString = JSON.stringify(response.data.content, null, 2);
      setConfigContent(contentString);
      validateJson(contentString); 
      setMessage(`Loaded: ${path}`);
    } catch (error) {
      console.error(`Error fetching config ${path}:`, error);
      setMessage(t.loadFailed);
      setConfigContent('{}'); 
      setJsonError('Failed to load or parse config content.');
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  const saveConfigContent = async () => {
    if (!selectedFile) return;
    if (!validateJson(configContent)) {
      setMessage('Cannot save: Invalid JSON content.');
      return;
    }

    setLoading(true);
    try {
      const contentObject = JSON.parse(configContent);
      await axios.post(`${API_BASE_URL}/api/config/${selectedFile.tier_path}`, contentObject);
      setMessage(t.saveSuccess);
    } catch (error) {
      console.error(`Error saving config:`, error);
      setMessage('Failed to save config.');
    } finally {
      setLoading(false);
    }
  };

  const generateFilter = async () => {
    setLoading(true);
    try {
      setMessage(t.generating);
      const response = await axios.post(`${API_BASE_URL}/api/generate`);
      setMessage(`${t.generatedSuccess}\n${response.data.output || ''}`);
      await fetchFilterPreview(); 
    } catch (error: any) {
      console.error('Error generating filter:', error);
      setMessage(`Failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterPreview = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/generated-filter`);
      setFilterPreview(response.data.content);
    } catch (error) {
      console.error('Error fetching filter preview:', error);
      setFilterPreview('Error loading filter preview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFilterPreview();
  }, [fetchFilterPreview]); 

  useEffect(() => {
    if (selectedFile && !selectedFile.tier_path.includes('tier_definition')) {
        fetchConfigContent(selectedFile.tier_path);
    }
  }, [selectedFile, fetchConfigContent]);

  return (
    <div className="App">
      <div className="navbar">
        <div className="brand">{t.appTitle}</div>
        
        <div className="mode-switches">
            <div className="switch-group">
                <label>{t.gameVersion}:</label>
                <select value={gameVersion} onChange={(e) => setGameVersion(e.target.value as any)}>
                    <option value="poe1">POE 1</option>
                    <option value="poe2">POE 2</option>
                </select>
            </div>

            {gameVersion === 'poe1' && (
                <div className="switch-group">
                    <label>{t.gameMode}:</label>
                    <select value={gameMode} onChange={(e) => setGameMode(e.target.value as any)}>
                        <option value="normal">{t.normalMode}</option>
                        <option value="ruthless">{t.ruthlessMode}</option>
                    </select>
                </div>
            )}
        </div>

        <div className="nav-links">
          <button className={currentView === 'editor' ? 'active' : ''} onClick={() => setCurrentView('editor')}>{t.editor}</button>
          <button className={currentView === 'simulator' ? 'active' : ''} onClick={() => setCurrentView('simulator')}>{t.simulator}</button>
          <button className={currentView === 'export' ? 'active' : ''} onClick={() => setCurrentView('export')}>{t.saveExport}</button>
        </div>

        <div className="language-selector">
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                <option value="ch">中文</option>
                <option value="en">English</option>
            </select>
        </div>
      </div>

      <div className="app-body">
        {currentView === 'editor' && (
          <EditorView 
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
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
          <SimulatorView filterContent={filterPreview} language={language} />
        )}
        {currentView === 'export' && (
          <ExportView 
            onGenerate={generateFilter} 
            loading={loading} 
            message={message} 
            language={language}
          />
        )}
      </div>

      <style>{`
        .App { display: flex; flex-direction: column; height: 100vh; font-family: 'Segoe UI', sans-serif; }
        .navbar { 
          display: flex; align-items: center; padding: 0 20px; 
          background: #333; color: white; height: 60px; flex-shrink: 0; 
          gap: 20px;
        }
        .brand { font-weight: bold; font-size: 1.2rem; }
        
        .mode-switches { display: flex; gap: 15px; margin-left: 20px; border-left: 1px solid #555; padding-left: 20px; }
        .switch-group { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #aaa; }
        .switch-group select { background: #444; color: white; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; }

        .nav-links { display: flex; height: 100%; flex-grow: 1; justify-content: center; }
        .nav-links button {
          background: none; border: none; color: #ccc; 
          padding: 0 20px; cursor: pointer; height: 100%; font-size: 1rem;
          border-bottom: 3px solid transparent;
        }
        .nav-links button:hover { color: white; background: #444; }
        .nav-links button.active { color: white; border-bottom-color: #2196F3; background: #2a2a2a; }
        
        .language-selector select { padding: 5px; border-radius: 4px; border: none; background: #444; color: white; }
        
        .app-body { flex: 1; overflow: hidden; position: relative; }
      `}</style>
    </div>
  );
}

export default App;