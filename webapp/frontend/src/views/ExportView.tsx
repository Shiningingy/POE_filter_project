import React, { useEffect, useRef } from 'react';

interface ExportViewProps {
  onGenerate: () => void;
  loading: boolean;
  message: string;
  filterContent?: string;
  gameMode?: 'normal' | 'ruthless';
}

const ExportView: React.FC<ExportViewProps> = ({ onGenerate, loading, message, filterContent, gameMode }) => {
  const lastDownloadedContent = useRef<string | null>(null);

  const triggerDownload = (content: string) => {
    const extension = gameMode === 'ruthless' ? '.ruthlessfilter' : '.filter';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Sharket_Custom${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    lastDownloadedContent.current = content;
  };

  // Auto-trigger download when generation completes and content is NEW
  useEffect(() => {
    if (filterContent && !loading && filterContent !== lastDownloadedContent.current) {
        triggerDownload(filterContent);
    }
  }, [filterContent, loading]);

  const extensionLabel = gameMode === 'ruthless' ? '.ruthlessfilter' : '.filter';

  return (
    <div className="export-view">
      <div className="top-bar">
        <h2>Save & Export</h2>
      </div>
      
      <div className="content-area">
        <div className="card">
          <h3>Compile & Download</h3>
          <p>Generate your customized {extensionLabel} file and download it immediately.</p>
          <div className="btn-group">
            <button onClick={onGenerate} disabled={loading} className="generate-btn">
              {loading ? 'Generating...' : 'Generate & Download'}
            </button>
          </div>
          {message && <div className="log-output">{message}</div>}
        </div>
      </div>

      <style>{`
        .export-view { display: flex; flex-direction: column; height: 100%; flex: 1; }
        .top-bar { padding: 10px 20px; background: white; border-bottom: 1px solid #ddd; }
        .top-bar h2 { margin: 0; font-size: 1.2rem; }
        .content-area { padding: 40px; background: #f0f0f0; flex: 1; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; text-align: center; }
        .btn-group { display: flex; flex-direction: column; gap: 10px; align-items: center; margin-top: 20px; }
        .generate-btn { background-color: #4CAF50; color: white; border: none; padding: 12px 24px; font-size: 1rem; border-radius: 4px; cursor: pointer; width: 250px; font-weight: bold; }
        .generate-btn:disabled { background-color: #ccc; }
        .download-btn { background-color: #2196F3; color: white; border: none; padding: 12px 24px; font-size: 1rem; border-radius: 4px; cursor: pointer; width: 250px; font-weight: bold; }
        .log-output { margin-top: 20px; padding: 15px; background: #333; color: #0f0; font-family: monospace; text-align: left; border-radius: 4px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
      `}</style>
    </div>
  );
};

export default ExportView;
