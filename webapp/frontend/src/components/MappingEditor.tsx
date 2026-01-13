import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';

interface MappingEditorProps {
  configPath: string;
  onSave: () => void;
  language: Language;
}

interface MappingData {
  file_name: string;
  theme_category: string;
  available_tiers: string[];
  content: {
    _meta: any;
    mapping: Record<string, string>;
    rules: any[];
  };
}

const MappingEditor: React.FC<MappingEditorProps> = ({ configPath, onSave, language }) => {
  const t = useTranslation(language);
  const [data, setData] = useState<MappingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({});

  const API_BASE_URL = 'http://localhost:8000';

  useEffect(() => {
    if (!configPath) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const fileName = configPath.split('/').pop() || configPath;
        const response = await axios.get(`${API_BASE_URL}/api/mapping-info/${fileName}`);
        setData(response.data);
        setLocalMapping(response.data.content.mapping);
      } catch (err: any) {
        console.error("Error loading mapping:", err);
        setError("Failed to load mapping data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [configPath]);

  const handleTierChange = (item: string, newTier: string) => {
    setLocalMapping(prev => ({
      ...prev,
      [item]: newTier
    }));
  };

  const handleSave = async () => {
    if (!data) return;
    setLoading(true);
    try {
      const newContent = {
        ...data.content,
        mapping: localMapping
      };
      await axios.post(`${API_BASE_URL}/api/config/${configPath}`, newContent);
      if (onSave) onSave();
      alert(t.saveSuccess);
    } catch (err: any) {
      console.error("Error saving:", err);
      alert("Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!data) return [];
    return Object.keys(localMapping).filter(item => 
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [localMapping, searchTerm, data]);

  if (loading && !data) return <div>{t.loading}</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div>{t.selectFile}</div>;

  return (
    <div className="mapping-editor">
      <div className="toolbar">
        <input 
          type="text" 
          placeholder={t.filterPlaceholder} 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-box"
        />
        <button onClick={handleSave} disabled={loading} className="save-btn">
          {t.saveConfig}
        </button>
        <span className="info">Found {data.available_tiers.length} tiers for {data.theme_category}</span>
      </div>

      <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
        <table className="mapping-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Current Tier</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item}>
                <td>{item}</td>
                <td>
                  <select 
                    value={localMapping[item]} 
                    onChange={e => handleTierChange(item, e.target.value)}
                  >
                    {data.available_tiers.map(tier => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                    {!data.available_tiers.includes(localMapping[item]) && (
                       <option value={localMapping[item]}>{localMapping[item]} (Unknown)</option>
                    )}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <style>{`
        .mapping-editor { display: flex; flex-direction: column; gap: 10px; }
        .toolbar { display: flex; gap: 10px; align-items: center; padding: 10px; background: #f5f5f5; border-radius: 4px; }
        .search-box { padding: 5px; flex-grow: 1; }
        .save-btn { padding: 5px 15px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        .save-btn:disabled { background: #ccc; }
        .mapping-table { width: 100%; border-collapse: collapse; }
        .mapping-table th, .mapping-table td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        .mapping-table th { background-color: #eee; position: sticky; top: 0; }
        .table-container { border: 1px solid #ddd; }
      `}</style>
    </div>
  );
};

export default MappingEditor;