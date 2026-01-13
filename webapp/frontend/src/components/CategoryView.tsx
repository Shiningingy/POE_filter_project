import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TierStyleEditor from './TierStyleEditor';
import TierItemManager from './TierItemManager';
import { resolveStyle } from '../utils/styleResolver';
import type { Language } from '../utils/localization';

interface CategoryViewProps {
  configPath: string;
  configContent: string;
  onConfigContentChange: (newContent: string) => void;
  loading: boolean;
  language: Language;
}

interface TierItem {
  name: string;
  name_ch?: string;
  source: string;
}

const CategoryView: React.FC<CategoryViewProps> = ({
...
              return (
                <div key={tierKey} className="tier-block">
                  <TierStyleEditor
                    tierName={tierData.localization?.[language] || tierKey}
                    style={resolved}
                    onChange={(newStyle) => handleTierUpdate(categoryKey, tierKey, newStyle)}
                    language={language}
                  />
                  <TierItemManager 
                    tierKey={tierKey}
                    items={items}
                    allTiers={allTiers}
                    onMoveItem={handleMoveItem}
                    language={language}
                  />
                </div>
              );
            })}
...          </div>
        );
      })}
      
      <style>{`
        .category-view { padding-bottom: 50px; }
        .editor-title { font-size: 1.1rem; color: #888; margin-bottom: 20px; }
        .category-section { margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 20px; }
        .category-section h3 { border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-top: 0; color: #333; }
        .tier-block { margin-bottom: 20px; border: 1px solid #eee; border-radius: 4px; padding: 10px; }
      `}</style>
    </div>
  );
};

export default CategoryView;