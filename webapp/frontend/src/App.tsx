import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import { useTranslation } from './utils/localization';
import type { Language } from './utils/localization';
import { STRICTNESS_LEVELS, type StrictnessLevel, type LevelingSelection } from './utils/filterGenerator';
import OverviewView from './views/OverviewView';
import EditorView from './views/EditorView';
import SimulatorView from './views/SimulatorView';
import ExportView from './views/ExportView';
import ThemeView from './views/ThemeView';
import ImportForeignFilterView from './views/ImportForeignFilterView';
import type { CategoryFile } from './components/Sidebar';
import { AppDataProvider, useAppData } from './services/AppDataContext';
import AdminPanel from './components/AdminPanel';
import LoadingOverlay from './components/LoadingOverlay';
import WelcomeModal from './components/WelcomeModal';
import ManualViewer from './components/ManualViewer';
import CampaignPicker from './components/CampaignPicker';

// App-start splash: covers the UI until the shared base data
// (class hierarchy/properties) is in. Must live inside AppDataProvider.
const StartupSplash = ({ language }: { language: Language }) => {
  const { loading } = useAppData();
  return loading ? <LoadingOverlay language={language} fullscreen /> : null;
};

type ViewName = 'overview' | 'editor' | 'simulator' | 'export' | 'theme' | 'import-foreign';

function App() {
  const [currentView, setCurrentView] = useState<ViewName>('overview');
  const [language, setLanguage] = useState<Language>('ch');
  // PoE 2 isn't supported yet, so the game version is fixed to poe1 (no navbar selector).
  const [gameVersion] = useState<'poe1' | 'poe2'>('poe1');
  const [gameMode, setGameMode] = useState<'normal' | 'ruthless'>('ruthless');
  const [strictness, setStrictness] = useState<StrictnessLevel>('soft');
  // Campaign/leveling picker selection (persisted setting; {} = show all leveling)
  const [levelingSelection, setLevelingSelection] = useState<LevelingSelection>({});
  const [showCampaign, setShowCampaign] = useState<boolean>(false);
  const [baseTheme, setBaseTheme] = useState<string>('sharket');
  const t = useTranslation(language);

  // Load persisted settings once (Campaign selection + active theme) so the
  // Overview cards and generation reflect the saved state. Both the local backend
  // and the demo VFS serve /api/settings.
  useEffect(() => {
    axios.get('/api/settings')
      .then(res => {
        if (res.data?.leveling_selection) setLevelingSelection(res.data.leveling_selection);
        if (res.data?.base_theme) setBaseTheme(res.data.base_theme);
      })
      .catch(() => {});
  }, []);

  // First-visit welcome + in-app manual reader
  const [showWelcome, setShowWelcome] = useState<boolean>(
    () => !localStorage.getItem('sharket_welcome_seen')
  );
  const [showManual, setShowManual] = useState<boolean>(false);
  const dismissWelcome = (openManual: boolean) => {
    localStorage.setItem('sharket_welcome_seen', '1');
    setShowWelcome(false);
    if (openManual) setShowManual(true);
  };

  // Selection state
  const [selectedFile, setSelectedFile] = useState<CategoryFile | null>(null);
  
  // Clipboard for Styles
  const [styleClipboard, setStyleClipboard] = useState<any>(null);
  
  // Data for ConfigEditor (fallback)
  const [configContent, setConfigContent] = useState<string>('{}'); 
  const [filterPreview, setFilterPreview] = useState<string>('');
  
  // Status State
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [viewerBackground, setViewerBackground] = useState<string>('Item_bg_coast.jpg');

  const API_BASE_URL = ''; 

  const handleJumpToRule = useCallback(async (filePath: string, _ruleIndex?: number) => {
      // 1. Find the CategoryFile object for this path
      const structureRes = await axios.get('/api/category-structure');
      const findFile = (node: any): CategoryFile | null => {
          if (node.files) {
              for (const f of node.files) {
                  if (f.path.includes(filePath) || filePath.includes(f.path)) return f;
              }
          }
          if (node.categories) {
              for (const c of node.categories) {
                  const found = findFile(c);
                  if (found) return found;
              }
          }
          if (node.subgroups) {
              for (const s of node.subgroups) {
                  const found = findFile(s);
                  if (found) return found;
              }
          }
          return null;
      };
      
      const fileObj = findFile(structureRes.data);
      if (fileObj) {
          setSelectedFile(fileObj);
          setCurrentView('editor');
          // Note: Scrolling to specific rule index needs support in RuleManager.
          // For now, opening the file is a huge win.
      }
  }, []);

  const fetchConfigContent = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/config/${path}`);
      const contentString = JSON.stringify(response.data.content, null, 2);
      setConfigContent(contentString);
      setMessage(`Loaded: ${path}`);
    } catch (error) {
      console.error(`Error fetching config ${path}:`, error);
      setMessage(t.loadFailed);
      setConfigContent('{}'); 
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  const generateFilter = async (selectionOverride?: LevelingSelection): Promise<string | null> => {
    setLoading(true);
    try {
      setMessage(t.generating);
      const response = await axios.post(`${API_BASE_URL}/api/generate`, {
        game_version: gameVersion,
        game_mode: gameMode,
        strictness,
        leveling_selection: selectionOverride ?? levelingSelection,
      });
      setMessage(`${t.generatedSuccess}\n${response.data.output || ''}`);
      return await fetchFilterPreview();
    } catch (error: any) {
      console.error('Error generating filter:', error);
      setMessage(`Failed: ${error.response?.data?.detail || error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Campaign picker Apply: this is a *customization*, not a generation trigger — it
  // updates the working selection + persists it (like the strictness selector), and
  // the change is captured at the next explicit Export/generate. It does NOT auto-
  // generate the output filter.
  // Update + persist the selection without UI side effects — also used by the
  // editor's per-tier ⚡ boost chips.
  const handleLevelingChange = async (sel: LevelingSelection) => {
    setLevelingSelection(sel);
    try { await axios.post(`${API_BASE_URL}/api/settings`, { leveling_selection: sel }); } catch { /* demo VFS / offline */ }
  };

  const handleApplyCampaign = async (sel: LevelingSelection) => {
    setShowCampaign(false);
    await handleLevelingChange(sel);
    setMessage(t.campaignApplied);
  };

  const fetchFilterPreview = useCallback(async (): Promise<string | null> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/generated-filter`);
      setFilterPreview(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching filter preview:', error);
      setFilterPreview('Error loading filter preview.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFilterPreview();
  }, [fetchFilterPreview]);

  useEffect(() => {
    document.title = t.appTitle;
  }, [t.appTitle]);

  useEffect(() => {
    if (selectedFile && !selectedFile.tier_path.includes('tier_definition')) {
        fetchConfigContent(selectedFile.tier_path);
    }
  }, [selectedFile, fetchConfigContent]);

  return (
    <AppDataProvider>
    <StartupSplash language={language} />
    <div className="App">
      <div className="navbar">
        <div className="brand">{t.appTitle}</div>
        
        <div className="mode-switches">
            {gameVersion === 'poe1' && (
                <div className="switch-group">
                    <label>{t.strictness}:</label>
                    <select value={strictness} onChange={(e) => setStrictness(e.target.value as StrictnessLevel)}>
                        {STRICTNESS_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>{t.strictnessLevels[lvl]}</option>
                        ))}
                    </select>
                </div>
            )}

        </div>

        <div className="nav-links">
          <button className={currentView === 'overview' ? 'active' : ''} onClick={() => setCurrentView('overview')}>{t.overview}</button>
          <button className={currentView === 'editor' ? 'active' : ''} onClick={() => setCurrentView('editor')}>{t.editor}</button>
          <button className={currentView === 'theme' ? 'active' : ''} onClick={() => setCurrentView('theme')}>{language === 'ch' ? "外观与音效" : "Theme & Sound"}</button>
          <button className={currentView === 'simulator' ? 'active' : ''} onClick={() => setCurrentView('simulator')}>{t.simulator}</button>
          <button className={currentView === 'export' ? 'active' : ''} onClick={() => setCurrentView('export')}>{t.saveExport}</button>
          <button className={currentView === 'import-foreign' ? 'active' : ''} onClick={() => setCurrentView('import-foreign')}>{t.importForeign}</button>
        </div>

        <AdminPanel language={language} />

        <button
          className="manual-btn"
          title={language === 'ch' ? '用户手册' : 'User Manual'}
          onClick={() => setShowManual(true)}
        >
          📖
        </button>

        <div className="language-selector">
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                <option value="ch">中文</option>
                <option value="en">English</option>
            </select>
        </div>
      </div>

      <div className="app-body">
        {currentView === 'overview' && (
          <OverviewView
            language={language}
            gameVersion={gameVersion}
            gameMode={gameMode}
            setGameMode={setGameMode}
            strictness={strictness}
            setStrictness={setStrictness}
            levelingSelection={levelingSelection}
            baseTheme={baseTheme}
            onOpenCampaign={() => setShowCampaign(true)}
            onNavigate={setCurrentView}
          />
        )}
        <div className="view-slot" style={{ display: currentView === 'editor' ? 'flex' : 'none' }}>
          <EditorView
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            configContent={configContent}
            setConfigContent={setConfigContent}
            loading={loading}
            message={message}
            language={language}
            strictness={strictness}
            levelingSelection={levelingSelection}
            onLevelingSelectionChange={handleLevelingChange}
            styleClipboard={styleClipboard}
            setStyleClipboard={setStyleClipboard}
            viewerBackground={viewerBackground}
            setViewerBackground={setViewerBackground}
            onJumpToRule={handleJumpToRule}
          />
        </div>
        {currentView === 'theme' && (
          <ThemeView language={language} onJumpToRule={handleJumpToRule} />
        )}
        <div className="view-slot" style={{ display: currentView === 'simulator' ? 'flex' : 'none' }}>
          <SimulatorView filterContent={filterPreview} language={language} onJumpToRule={handleJumpToRule} />
        </div>
        {currentView === 'export' && (
          <ExportView
            onGenerate={generateFilter}
            loading={loading}
            message={message}
            gameMode={gameMode}
            strictness={strictness}
            language={language}
          />
        )}
        {currentView === 'import-foreign' && (
          <ImportForeignFilterView language={language} />
        )}
      </div>

      {showWelcome && (
        <WelcomeModal
          language={language}
          setLanguage={setLanguage}
          onClose={() => dismissWelcome(false)}
          onOpenManual={() => dismissWelcome(true)}
        />
      )}
      {showManual && (
        <ManualViewer language={language} onClose={() => setShowManual(false)} />
      )}
      {showCampaign && (
        <CampaignPicker
          language={language}
          initialSelection={levelingSelection}
          onClose={() => setShowCampaign(false)}
          onApply={handleApplyCampaign}
        />
      )}

      <style>{`
        .App { display: flex; flex-direction: column; height: 100vh; font-family: 'Segoe UI', sans-serif; }
        .navbar { 
          display: flex; align-items: center; padding: 0 30px; 
          background: #333; color: white; height: 60px; flex-shrink: 0; 
          gap: 20px;
        }
        .brand { font-weight: bold; font-size: 1.2rem; }
        
        .mode-switches { display: flex; gap: 15px; margin-left: 20px; border-left: 1px solid #555; padding-left: 20px; }
        .switch-group { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #aaa; }
        .switch-group select { background: #444; color: white; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; }
        .campaign-btn { background: #444; color: #eaf6ff; border: 1px solid #2f9fe0; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }
        .campaign-btn:hover { background: #14618a; }

        .nav-links { display: flex; height: 100%; flex-grow: 1; justify-content: center; }
        .nav-links button {
          background: none; border: none; color: #ccc; 
          padding: 0 20px; cursor: pointer; height: 100%; font-size: 1rem;
          border-bottom: 3px solid transparent;
        }
        .nav-links button:hover { color: white; background: #444; }
        .nav-links button.active { color: white; border-bottom-color: #2196F3; background: #2a2a2a; }
        
        .language-selector select { padding: 5px; border-radius: 4px; border: none; background: #444; color: white; }
        .manual-btn { background: #444; border: none; border-radius: 4px; padding: 5px 10px; font-size: 1rem; cursor: pointer; line-height: 1; }
        .manual-btn:hover { background: #555; }
        
        .app-body { flex: 1; overflow: hidden; position: relative; }
        .view-slot { position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
      `}</style>
    </div>
    </AppDataProvider>
  );
}

export default App;
