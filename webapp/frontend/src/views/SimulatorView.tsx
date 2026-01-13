import React, { useState } from 'react';
import DropSimulator from '../components/DropSimulator';

interface SimulatorViewProps {
  filterContent: string;
}

const SimulatorView: React.FC<SimulatorViewProps> = ({ filterContent }) => {
  const [mode, setMode] = useState<'visual' | 'text'>('visual');

  return (
    <div className="simulator-view">
      <div className="top-bar">
        <h2>Drop Simulator</h2>
        <div className="toggle-group">
          <button 
            className={mode === 'visual' ? 'active' : ''} 
            onClick={() => setMode('visual')}
          >
            Visual
          </button>
          <button 
            className={mode === 'text' ? 'active' : ''} 
            onClick={() => setMode('text')}
          >
            Raw Text
          </button>
        </div>
      </div>

      <div className="content-area">
        {mode === 'visual' ? (
          <DropSimulator />
        ) : (
          <textarea
            className="filter-output"
            value={filterContent}
            readOnly
            placeholder="Generated filter content will appear here..."
          ></textarea>
        )}
      </div>

      <style>{`
        .simulator-view { display: flex; flex-direction: column; height: 100%; flex: 1; overflow: hidden; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-bottom: 1px solid #ddd; }
        .top-bar h2 { margin: 0; font-size: 1.2rem; }
        .toggle-group button { padding: 5px 15px; background: #eee; border: 1px solid #ddd; cursor: pointer; }
        .toggle-group button.active { background: #2196F3; color: white; border-color: #2196F3; }
        .toggle-group button:first-child { border-radius: 4px 0 0 4px; }
        .toggle-group button:last-child { border-radius: 0 4px 4px 0; }
        .content-area { flex: 1; padding: 20px; background: #f0f0f0; overflow: hidden; display: flex; flex-direction: column; }
        .filter-output { flex: 1; width: 100%; resize: none; padding: 10px; font-family: monospace; border: 1px solid #ccc; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export default SimulatorView;
