import React, { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "../utils/localization";
import type { Language } from "../utils/localization";

export interface CategoryFile {
  path: string;
  tier_path: string;
  mapping_path: string;
  target_category: string;
  localization: { en: string; ch: string };
}

interface SidebarProps {
  selectedFile: string;
  onSelect: (file: CategoryFile) => void;
  language: Language;
}

interface CategorySubGroup {
  _meta: {
    localization: { en: string; ch: string };
  };
  files: CategoryFile[];
}

interface Category {
  _meta: { localization: { en: string; ch: string } };
  subgroups?: CategorySubGroup[];
  files?: CategoryFile[];
}

interface CategoryStructure {
  categories: Category[];
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedFile,
  onSelect,
  language,
}) => {
  const [structure, setStructure] = useState<CategoryStructure | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`http://localhost:8000/api/category-structure?t=${new Date().getTime()}`)
      .then((res) => setStructure(res.data))
      .catch((err) => {
        console.error("Failed to load sidebar structure", err);
        setError("Failed to load sidebar structure");
      });
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (error) return <div className="sidebar error">{error}</div>;
  if (!structure)
    return <div className="sidebar loading">Loading structure...</div>;

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        {structure.categories.map((cat, catIdx) => {
          const catName = cat._meta.localization[language];
          const isCatExpanded = expanded[`cat-${catIdx}`];

          return (
            <div key={catIdx} className="category-group">
              <div
                className="group-header"
                onClick={() => toggle(`cat-${catIdx}`)}
              >
                <span className="arrow">{isCatExpanded ? "▼" : "▶"}</span>
                {catName}
              </div>

              {isCatExpanded && (
                <>
                  {cat.subgroups?.map((sub, subIdx) => {
                    const subName = sub._meta.localization[language];
                    const subId = `cat-${catIdx}-sub-${subIdx}`;
                    const isSubExpanded = expanded[subId];

                    return (
                      <div key={subIdx} className="subgroup">
                        <div
                          className="subgroup-header"
                          onClick={() => toggle(subId)}
                        >
                          <span className="arrow">
                            {isSubExpanded ? "▼" : "▶"}
                          </span>
                          {subName}
                        </div>

                        {isSubExpanded && (
                          <div className="file-list">
                            {sub.files.map((file, fileIdx) => {
                              const fileName = file.localization[language];
                              const isSelected = file.path === selectedFile;

                              return (
                                <div
                                  key={fileIdx}
                                  className={`file-item ${
                                    isSelected ? "selected" : ""
                                  }`}
                                  onClick={() => onSelect(file)}
                                >
                                  {fileName}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {cat.files?.map((file, fileIdx) => {
                    const fileName = file.localization[language];
                    const isSelected = file.path === selectedFile;
                    return (
                      <div
                        key={fileIdx}
                        className={`file-item direct-file ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => onSelect(file)}
                      >
                        {fileName}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .sidebar { width: 15%; background: #2c2c2c; color: #fff; height: 100%; display: flex; flex-direction: column; border-right: 1px solid #1a1a1a; min-width: 250px; }
        .sidebar.loading, .sidebar.error { align-items: center; justify-content: center; color: #888; font-style: italic; font-size: 0.9rem; }
        .sidebar.error { color: #f44336; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 10px 0; }
        .group-header { padding: 10px 15px; background: #1a1a1a; cursor: pointer; font-weight: bold; font-size: 0.9rem; text-transform: uppercase; color: #888; display: flex; align-items: center; }
        .subgroup-header { padding: 8px 25px; cursor: pointer; font-size: 0.85rem; color: #bbb; display: flex; align-items: center; }
        .file-list { padding-left: 45px; }
        .file-item { padding: 6px 15px; cursor: pointer; font-size: 0.85rem; color: #999; border-radius: 4px 0 0 4px; margin-bottom: 1px; }
        .file-item:hover { background: #3d3d3d; color: #fff; }
        .file-item.selected { background: #2196F3; color: #fff; font-weight: bold; }
        .arrow { width: 15px; font-size: 0.7rem; display: inline-block; margin-right: 5px; }
        .file-item.direct-file { margin-left: 25px; }
      `}</style>
    </div>
  );
};

export default Sidebar;
