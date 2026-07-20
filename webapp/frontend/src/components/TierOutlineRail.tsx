import React from 'react';

// Secondary outline navbar for big categories (e.g. Campaign "Gear Progression"
// with ~40 tier blocks): a sticky rail listing every tier block, click-to-scroll.
// Anchors are the `tierblock-<key>` ids SortableTierBlock renders. Pure
// presentation — appears only when CategoryView decides the tier count warrants it.

interface OutlineEntry {
  key: string;
  label: string;
  isHide?: boolean;
}

interface TierOutlineRailProps {
  title: string;
  entries: OutlineEntry[];
}

const TierOutlineRail: React.FC<TierOutlineRailProps> = ({ title, entries }) => {
  const jump = (key: string) => {
    document.getElementById(`tierblock-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="tier-outline-rail">
      <div className="tor-title" title={title}>{title}</div>
      <div className="tor-list">
        {entries.map((e) => (
          <button
            key={e.key}
            className={`tor-item ${e.isHide ? 'hide-tier' : ''}`}
            title={e.label}
            onClick={() => jump(e.key)}
          >
            {e.label}
          </button>
        ))}
      </div>
      <style>{`
        .category-view { display: flex; align-items: flex-start; gap: 14px; }
        .category-view > .category-section { flex: 1; min-width: 0; }
        .tier-outline-rail {
          position: sticky; top: 12px;
          width: 190px; flex-shrink: 0;
          max-height: calc(100vh - 60px);
          display: flex; flex-direction: column;
          background: #f6f8fa; border: 1px solid #d1d9e0; border-radius: 6px;
          padding: 8px 6px;
        }
        .tor-title {
          font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.5px; color: #57606a; padding: 2px 8px 6px;
          border-bottom: 1px solid #d1d9e0; margin-bottom: 6px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .tor-list { overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
        .tor-item {
          text-align: left; background: none; border: none; cursor: pointer;
          font-size: 0.76rem; color: #444c56; padding: 3px 8px; border-radius: 4px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .tor-item:hover { background: #e1eaf2; color: #2196F3; }
        .tor-item.hide-tier { color: #9aa2ab; font-style: italic; }
        @media (max-width: 1100px) { .tier-outline-rail { display: none; } }
      `}</style>
    </div>
  );
};

export default TierOutlineRail;
