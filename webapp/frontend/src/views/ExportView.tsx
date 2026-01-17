import React from 'react';

interface ExportViewProps {
  onGenerate: () => void;
  loading: boolean;
  message: string;
}

const ExportView: React.FC<ExportViewProps> = ({ onGenerate, loading, message }) => {
  return (
    <div className="export-view">
      <div className="top-bar">
        <h2>Save & Export</h2>
      </div>
      
      <div className="content-area">
        <div className="card">
          <h3>Generate Filter</h3>
          <p>Compile your configurations into a downloadable .filter file.</p>
          <button onClick={onGenerate} disabled={loading} className="generate-btn">
            {loading ? 'Generating...' : 'Generate Filter'}
          </button>
          {message && <div className="log-output">{message}</div>}
        </div>
      </div>

      <style>{`
        .export-view { display: flex; flex-direction: column; height: 100%; flex: 1; }
        .top-bar { padding: 10px 20px; background: white; border-bottom: 1px solid #ddd; }
        .top-bar h2 { margin: 0; font-size: 1.2rem; }
        .content-area { padding: 40px; background: #f0f0f0; flex: 1; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; text-align: center; }
        .generate-btn { background-color: #4CAF50; color: white; border: none; padding: 12px 24px; font-size: 1rem; border-radius: 4px; cursor: pointer; margin-top: 20px; }
        .generate-btn:disabled { background-color: #ccc; }
        .log-output { margin-top: 20px; padding: 15px; background: #333; color: #0f0; font-family: monospace; text-align: left; border-radius: 4px; white-space: pre-wrap; }
      `}</style>
    </div>
  );
};

export default ExportView;
