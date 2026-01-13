import React from 'react';

interface ConfigEditorProps {
  configPath: string;
  configContent: string;
  onConfigContentChange: (newContent: string) => void;
  loading: boolean;
  jsonError: string; // Pass jsonError for displaying
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({
  configPath,
  configContent,
  onConfigContentChange,
  loading,
  jsonError,
}) => {
  // This component will dynamically render different forms/editors
  // based on the configPath or the parsed configContent structure.

  // For now, it will render a simple textarea.
  // In future iterations, this will be replaced with more structured input fields.

  return (
    <div className="config-editor">
      <h2>Config Editor: {configPath}</h2>
      <textarea
        className="json-editor"
        value={configContent}
        onChange={(e) => onConfigContentChange(e.target.value)}
        rows={25}
        cols={80}
        placeholder="Select a config file to edit..."
        disabled={loading || !configPath}
      ></textarea>
      {jsonError && <p className="error-message">JSON Error: {jsonError}</p>}
    </div>
  );
};

export default ConfigEditor;