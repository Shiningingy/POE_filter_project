import React, { useState, useMemo } from 'react';

interface SidebarProps {
  files: string[];
  selectedFile: string;
  onSelect: (file: string) => void;
}

interface TreeNode {
  name: string;
  path?: string; // If it's a file
  children: Record<string, TreeNode>;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ files, selectedFile, onSelect }) => {
  // State to track expanded/collapsed folders. Key is the folder path (e.g., "tier_definition/Weapon")
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'base_mapping': true,
    'tier_definition': true
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Convert flat file list to tree structure
  const fileTree = useMemo(() => {
    const root: TreeNode = { name: 'root', children: {}, isOpen: true };

    files.forEach(filePath => {
      const parts = filePath.split('/');
      let current = root;
      let pathSoFar = '';

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;

        if (!current.children[part]) {
          current.children[part] = {
            name: part.replace('.json', ''), // Pretty print name
            children: {},
            isOpen: false
          };
        }
        
        if (isFile) {
          current.children[part].path = filePath;
        }
        
        current = current.children[part];
      });
    });
    return root;
  }, [files]);

  // Recursive render function
  const renderTree = (node: TreeNode, fullPath: string = '') => {
    const sortedKeys = Object.keys(node.children).sort((a, b) => {
        // Folders first, then files
        const aIsFile = !!node.children[a].path;
        const bIsFile = !!node.children[b].path;
        if (aIsFile && !bIsFile) return 1;
        if (!aIsFile && bIsFile) return -1;
        return a.localeCompare(b);
    });

    return (
      <ul className="tree-list">
        {sortedKeys.map(key => {
          const child = node.children[key];
          const currentPath = fullPath ? `${fullPath}/${key}` : key;
          const isFolder = !child.path;
          const isSelected = child.path === selectedFile;
          const isExpanded = expandedFolders[currentPath];

          return (
            <li key={key} className={isFolder ? 'folder-node' : 'file-node'}>
              {isFolder ? (
                <div className="folder-label" onClick={() => toggleFolder(currentPath)}>
                  <span className="arrow">{isExpanded ? '▼' : '▶'}</span>
                  <span className="name">{key === 'base_mapping' ? 'Base Mappings' : key === 'tier_definition' ? 'Tier Definitions' : child.name}</span>
                </div>
              ) : (
                <div 
                  className={`file-label ${isSelected ? 'selected' : ''}`} 
                  onClick={() => onSelect(child.path!)}
                >
                  <span className="name">{child.name}</span>
                </div>
              )}

              {isFolder && isExpanded && (
                renderTree(child, currentPath)
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="sidebar">
      <h3>Configuration Files</h3>
      <div className="sidebar-content">
        {renderTree(fileTree)}
      </div>
      <style>{`
        .sidebar {
          width: 300px;
          background: #2d2d2d;
          color: #e0e0e0;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #444;
          height: 100%;
          overflow: hidden;
        }
        .sidebar h3 {
          padding: 15px;
          margin: 0;
          background: #1f1f1f;
          border-bottom: 1px solid #444;
          font-size: 1rem;
        }
        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 10px 0;
        }
        .tree-list {
          list-style: none;
          padding-left: 15px;
          margin: 0;
        }
        .folder-label, .file-label {
          padding: 5px 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          border-radius: 4px;
          margin-bottom: 2px;
        }
        .folder-label:hover, .file-label:hover {
          background: #3d3d3d;
        }
        .file-label.selected {
          background: #4CAF50;
          color: white;
        }
        .arrow {
          margin-right: 8px;
          font-size: 0.8rem;
          color: #888;
          width: 12px;
        }
        .name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
