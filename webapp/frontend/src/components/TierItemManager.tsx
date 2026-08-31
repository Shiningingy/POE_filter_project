import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_SOUND_VOLUME } from '../utils/filterStyle';
import axios from 'axios';
import { useTranslation } from '../utils/localization';
import type { Language } from '../utils/localization';
import ContextMenu from './ContextMenu';
import ItemCard from './ItemCard';
import SoundPicker from './SoundPicker';
import ItemCardStyleEditor from './ItemCardStyleEditor';
import { SOUND_OVERRIDE_KEYS } from '../utils/themeSoundExport';

interface TierItem {
  name: string;
  name_ch?: string;
  source: string;
  current_tier?: string;
  current_tiers?: string[];
  category_ch?: string;
  sub_type?: string;
  match_mode?: 'exact' | 'partial';
  rule_index?: number | null;
}

interface TierOption {
  key: string;
  label: string;
  show_in_editor?: boolean;
  is_hide_tier?: boolean;
}

interface TierItemManagerProps {
  tierKey: string;
  items: TierItem[];
  allTiers: TierOption[]; 
  onMoveItem: (item: TierItem, newTier: string, isAppend?: boolean, oldTier?: string) => void;
  onDeleteItem: (item: TierItem, fromTier: string) => void;
  onUpdateOverride: (item: TierItem, overrides: any, removeKeys?: string[], tierKey?: string, suppressAuto?: boolean) => void;
  onRemoveRuleTarget: (item: TierItem, ruleIndex: number) => void;
  language: Language;
  onRuleEdit?: (tierKey: string, ruleIndex: number) => void;
  categoryRules?: any[];
  onRefresh?: () => void;
  soundMap?: any;
  tierStyle?: any;
  /** The tier's item_overrides — one entry per CARD that has its own style. */
  itemOverrides?: Record<string, any>;
  /** Admin mode lifts the protect-guard on `show_in_editor: false` tiers (the 57
   *  T0 chase rungs), so their items can be deleted and re-tiered by hand. */
  adminMode?: boolean;
}

const TierItemManager: React.FC<TierItemManagerProps> = ({
  tierKey,
  items,
  allTiers,
  onMoveItem,
  onDeleteItem,
  onUpdateOverride,
  onRemoveRuleTarget,
  language,
  onRuleEdit,
  categoryRules = [],
  onRefresh,
  soundMap,
  tierStyle,
  itemOverrides = {},
  adminMode = false
}) => {
  const t = useTranslation(language);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [addSearch, setAddSearch] = useState('');
  const [suggestions, setSuggestions] = useState<TierItem[]>([]);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: TierItem } | null>(null);
  const [soundEditorItem, setSoundEditorItem] = useState<TierItem | null>(null);
  const [soundEditorInitial, setSoundEditorInitial] = useState<{ path: string, volume: number, source: string }>({ path: '', volume: DEFAULT_SOUND_VOLUME, source: '' });

  // Play Sound Helper
  const playSound = (file: string, vol: number = 300) => {
      // Normalize path
      let cleanPath = file;
      if (file.includes('AlertSound')) {
          // It's likely "Default/AlertSoundX.mp3" or "6 300" style if raw
      }
      
      const url = `/sounds/${cleanPath.replace(/\\/g, '/')}`;
      const audio = new Audio(url);
      audio.volume = Math.min(Math.max(vol / DEFAULT_SOUND_VOLUME, 0), 1);
      audio.play().catch(e => console.error("Failed to play sound", e));
  };

  const resolveItemSound = (item: TierItem) => {
      let soundFile: string | null = null;
      let soundVol = DEFAULT_SOUND_VOLUME;
      let sourceLabel = "";

      // 0. The CARD's own override wins over everything: it is the most specific
      //    statement there is, and the generator splits the block out for it.
      const cardSound = (itemOverrides[item.name] || {}).PlayAlertSound;
      if (Array.isArray(cardSound)) {
          return { soundFile: cardSound[0], soundVol: cardSound[1],
                   sourceLabel: (t as any).fromCard || "Card override" };
      }

      // 1. Check Rule Override
      if (item.rule_index !== undefined && item.rule_index !== null) {
          const rule = categoryRules[item.rule_index];
          if (rule && rule.overrides) {
              // PlayAlertSound MUST be in this list: it is the key the sound picker
              // and the Sound Bulk Editor write. It was missing, so a sound set
              // through either path never showed on the card - the filter emitted it
              // correctly, the editor just could not see it, which reads exactly like
              // "setting the sound does nothing".
              // Its value is [file, volume], so string-guard the "disabled:" probe.
              const overrideKey = SOUND_OVERRIDE_KEYS.find(k => {
                  const v = rule.overrides[k];
                  return v && !(typeof v === "string" && v.startsWith("disabled:"));
              });
              if (overrideKey) {
                  const val = rule.overrides[overrideKey];
                  if (Array.isArray(val)) { 
                      soundFile = val[0]; 
                      soundVol = val[1]; 
                  } else if (typeof val === 'string') {
                      if (val.match(/^\d+ \d+$/)) {
                          const parts = val.split(' ');
                          soundFile = `Default/AlertSound${parts[0]}.mp3`;
                          soundVol = parseInt(parts[1]);
                      } else {
                          soundFile = val;
                      }
                  }
                  sourceLabel = (t as any).fromRule || "Rule Override";
              }
          }
      }

      // 1b. A sound set on THIS item by a rule that is not the card's own rule.
      // The sound picker and the Sound Bulk Editor write a bare rule - targets: [item],
      // no conditions, no Tier override - so /api/tier-items produces no separate card
      // for it and the item keeps rule_index null. Step 1 therefore never saw it, and
      // the card showed the tier default while the filter happily emitted the custom
      // sound. Scan the category's rules for one that targets this item and carries a
      // sound.
      // A rule pinned to THIS tier is the more specific one and is what the
      // generator matches first, so it has to win over a bare global rule here too
      // - otherwise the card shows a sound the filter does not actually emit.
      if (!soundFile) {
          const scoped = categoryRules.filter((r: any) =>
              r?.overrides && r.targets?.includes(item.name) &&
              !Object.keys(r.conditions || {}).length &&
              r.overrides.Tier === tierKey);
          const bare = categoryRules.filter((r: any) =>
              r?.overrides && r.targets?.includes(item.name) && !r.overrides.Tier);
          for (const r of [...scoped, ...bare]) {
              const k = SOUND_OVERRIDE_KEYS.find(key => {
                  const v = r.overrides[key];
                  return v && !(typeof v === "string" && v.startsWith("disabled:"));
              });
              if (!k) continue;
              const val = r.overrides[k];
              if (Array.isArray(val)) { soundFile = val[0]; soundVol = val[1]; }
              else if (typeof val === 'string') {
                  const m = val.match(/^(\d+) (\d+)$/);
                  if (m) { soundFile = `Default/AlertSound${m[1]}.mp3`; soundVol = parseInt(m[2]); }
                  else soundFile = val;
              }
              if (soundFile) { sourceLabel = (t as any).fromRule || "Rule Override"; break; }
          }
      }

      // 2. Check Auto-Sound (if no rule override AND item is not part of a rule)
      if (!soundFile && item.rule_index == null && soundMap?.basetype_sounds?.[item.name]) {
          const s = soundMap.basetype_sounds[item.name];
          soundFile = s.file;
          soundVol = s.volume;
          sourceLabel = (t as any).fromAutoSound || "Auto-Sound";
      }

      // 3. Check Tier Default (Only for non-rule items or rules that don't override sound)
      if (!soundFile && tierStyle?.PlayAlertSound) {
          // resolvedStyle already parses into [file, vol] format
          const [file, vol] = tierStyle.PlayAlertSound;
          soundFile = file;
          soundVol = vol;
          sourceLabel = (t as any).fromTierDefault || "Tier Default";
      }

      return { soundFile, soundVol, sourceLabel };
  };

  // Deduplicate items to prevent key errors
  const uniqueItems = useMemo(() => {
      const seen = new Set();
      return items.filter(i => {
          const key = `${i.name}-${i.rule_index ?? 'std'}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
      });
  }, [items]);

  // Map global rule index to local tier index for badges
  const ruleBadgeMap = useMemo(() => {
      const map: Record<number, number> = {};
      let localCount = 0;
      categoryRules.forEach((r, globalIdx) => {
          // 1. Must match this tier (if tier override exists) or target items in this tier
          const hasTierOverride = !!r.overrides?.Tier;
          const tierMatch = hasTierOverride ? r.overrides.Tier === tierKey : r.targets?.some((target: string) => uniqueItems.some(i => i.name === target));
          
          if (!tierMatch) return;

          // 2. Hide "Sound-only" rules (consistent with RuleManager)
          const hasConditions = Object.keys(r.conditions || {}).length > 0;
          const overrideKeys = Object.keys(r.overrides || {}).filter(k => k !== 'Tier');
          
          const hasSound = overrideKeys.some(k => k.toLowerCase().includes('sound'));
          const hasVisuals = overrideKeys.some(k => ["TextColor", "BackgroundColor", "BorderColor", "PlayEffect", "MinimapIcon"].includes(k));
          
          if (hasSound && !hasConditions && !hasVisuals && !hasTierOverride) return;

          localCount++;
          map[globalIdx] = localCount;
      });
      return map;
  }, [categoryRules, tierKey, uniqueItems]);

  const filteredItems = uniqueItems.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (i.name_ch && i.name_ch.includes(searchTerm))
  );

  const ruleItems = filteredItems.filter(i => {
    if (i.rule_index === undefined || i.rule_index === null) return false;
    const rule = categoryRules[i.rule_index];
    const isTarget = rule?.targets?.includes(i.name);
    return isTarget || !rule?.applyToTier;
  });
  const standardItems = filteredItems.filter(i => {
    if (i.rule_index === undefined || i.rule_index === null) return true;
    const rule = categoryRules[i.rule_index];
    const isTarget = rule?.targets?.includes(i.name);
    return !!rule?.applyToTier && !isTarget;
  });

  useEffect(() => {
    if (addSearch.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        const res = await axios.get(`/api/search-items?q=${encodeURIComponent(addSearch)}`);
        setSuggestions(res.data.results.map((r: any) => ({ ...r, source: r.source_file })));
      } catch (e) {
        console.error(e);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [addSearch]);

  const handleAddItem = (item: TierItem) => {
    // Check if item is T0 by origin
    const isT0ByOrigin = item.current_tiers?.some(tk => {
        const opt = allTiers.find(o => o.key === tk);
        return opt && opt.show_in_editor === false;
    });

    const targetTierOpt = allTiers.find(o => o.key === tierKey);
    if (isT0ByOrigin && targetTierOpt?.is_hide_tier) {
        const confirmMsg = t.t0MoveWarning.replace("{name}", item.name_ch || item.name);
        if (!window.confirm(confirmMsg)) return;
    }

    onMoveItem(item, tierKey, true); // isAppend = true
    setAddSearch('');
    setSuggestions([]);
  };

  const handleRightClick = (e: React.MouseEvent, item: TierItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const toggleItemMode = async (item: TierItem) => {
      const currentMode = item.match_mode || 'exact';
      const newMode = currentMode === 'exact' ? 'partial' : 'exact';
      
      try {
          await axios.post('/api/update-item-tier', {
              item_name: item.name,
              source_file: item.source,
              new_tier: tierKey, // Keep same tier
              match_mode: newMode
          });
          if (onRefresh) onRefresh();
      } catch (err) {
          console.error("Failed to toggle match mode", err);
      }
      setContextMenu(null);
  };

  const getTierColor = (tk: string) => {
    const match = tk.match(/Tier (\d+)/);
    if (!match) return '#ddd';
    const num = parseInt(match[1]);
    const colors = ['#ff0000', '#e700e7', '#af00ff', '#3400ff', '#0090ff', '#00ffb5', '#00ff2d', '#aeff00', '#ffff00', '#ff9d00'];
    return colors[num] || '#ddd';
  };

  // The card's own style override. Sound keeps its one-click entry because it is
  // ~99% of use; everything else lives behind this one door rather than growing
  // the right-click menu a row per channel.
  const [styleEditorItem, setStyleEditorItem] = useState<TierItem | null>(null);

  const handleCardStyle = (item: TierItem) => {
    setStyleEditorItem(item);
    setContextMenu(null);
  };

  const onCardStyleConfirm = (overrides: Record<string, any>, removeKeys: string[]) => {
    if (styleEditorItem) {
      onUpdateOverride(styleEditorItem, overrides, removeKeys.length ? removeKeys : undefined, tierKey);
    }
    setStyleEditorItem(null);
  };

  const handleSoundOverride = (item: TierItem) => {
    const { soundFile, soundVol, sourceLabel } = resolveItemSound(item);
    // Say so up front when the sound will land on a shared rule. The rule's
    // conditions are the block, so its targets cannot be given separate sounds
    // without splitting the rule.
    const siblings = ruleSiblingCount(item);
    const source = siblings > 0
        ? `${sourceLabel} (+${siblings})`
        : sourceLabel;
    setSoundEditorItem(item);
    setSoundEditorInitial({ path: soundFile || '', volume: soundVol, source });
    setContextMenu(null);
  };

  // tierKey travels with every sound write so the change lands on THIS occurrence.
  // A base type in three tiers is three blocks and can hold three sounds; the old
  // call wrote one bare rule for the base type, so all three spoke at once.
  const onSoundConfirm = (path: string, volume: number) => {
      if (soundEditorItem) {
          onUpdateOverride(soundEditorItem, { PlayAlertSound: [path, volume] }, undefined, tierKey);
      }
      setSoundEditorItem(null);
  };

  const hasRuleSound = (item: TierItem) => {
      const own = item.rule_index != null ? categoryRules[item.rule_index] : null;
      if (own && SOUND_OVERRIDE_KEYS.some(k => own.overrides?.[k])) return true;
      return categoryRules.some((r: any) =>
          r?.targets?.includes(item.name) &&
          Object.keys(r.conditions || {}).length === 0 &&
          SOUND_OVERRIDE_KEYS.some(k => r.overrides?.[k]));
  };

  // Already pinned as "no auto-sound here" - the card is back on its tier's sound.
  const autoSuppressed = (item: TierItem) =>
      categoryRules.some((r: any) =>
          r?.targets?.includes(item.name) && r?.suppress_auto_sound);

  // An auto-sound comes from the sound map, not from any rule, so there is no key
  // to strip - it needs the pinned-empty-rule route instead.
  const isAutoSound = (item: TierItem) =>
      !hasRuleSound(item) && !autoSuppressed(item) &&
      !!soundMap?.basetype_sounds?.[item.name];

  // Clearing has to be explicit: sound could only ever be ADDED, so an item that
  // picked up a per-item alert had no way back to its tier's. Removing every sound
  // key from the occurrence's rule leaves it with nothing to say, and the backend
  // then drops it - which IS the fallback, since the tier block matches next.
  const handleClearSound = (item: TierItem) => {
      onUpdateOverride(item, {}, [...SOUND_OVERRIDE_KEYS], tierKey, isAutoSound(item));
      setContextMenu(null);
  };

  // Offer it whenever the card has a sound that is NOT simply inherited from its
  // tier - a rule's, or one injected per-base-type from the sound map. The
  // auto-sound was previously unreachable: no rule carried it, so the menu entry
  // never appeared and the only way to drop it was editing the sound map by hand.
  const hasOwnSound = (item: TierItem) => hasRuleSound(item) || isAutoSound(item);

  // How many OTHER base types share this card's rule. The sound lives on the rule
  // (its conditions are the block), so setting one here sets it for all of them.
  const ruleSiblingCount = (item: TierItem) => {
      if (item.rule_index == null) return 0;
      const r = categoryRules[item.rule_index];
      return Math.max(0, (r?.targets?.length || 0) - 1);
  };

  const renderTierLabels = (tier: string | string[] | undefined | null, catCh?: string) => {
      if (!tier) return [t.untiered];
      const tiers = Array.isArray(tier) ? tier : [tier];
      return tiers.map(tk => {
          const match = tk.match(/Tier (\d+)(?: (.*))?/);
          if (match) {
              const num = match[1];
              const suffix = match[2];
              if (language === 'ch' && catCh) return `T${num} ${catCh}`;
              if (suffix) return `T${num} ${suffix}`;
              return `T${num}`;
          }
          return tk;
      });
  };

  const renderItem = (item: TierItem) => {
      const currentTierOpt = allTiers.find(opt => opt.key === tierKey);
      const isLocationLocked = currentTierOpt && currentTierOpt.show_in_editor === false;
      
      const isRuleItem = item.rule_index !== undefined && item.rule_index !== null;

      const isT0ByOrigin = item.current_tiers?.some(tk => {
          const opt = allTiers.find(o => o.key === tk);
          return opt && opt.show_in_editor === false;
      });

      // Unlock if it is a rule item, or if admin mode has lifted the guard
      const isLocked = !adminMode && !isRuleItem && isLocationLocked && isT0ByOrigin;
      
      // Calculate local badge index
      let localBadge = item.rule_index; 
      if (isRuleItem && ruleBadgeMap[item.rule_index!] !== undefined) {
          localBadge = ruleBadgeMap[item.rule_index!] - 1; // 0-based for display? ItemCard adds +1
      }

      // Sound Logic using Helper
      const { soundFile, soundVol, sourceLabel } = resolveItemSound(item);
      
      // Show icon ONLY if explicit override or auto-sound (not tier default)
      const hasIcon = !!soundFile && sourceLabel !== ((t as any).fromTierDefault || "Tier Default");

      return (
        <ItemCard 
          key={`${item.name}-${item.rule_index || 'std'}`} 
          item={isRuleItem ? { ...item, rule_index: localBadge } : item}
          language={language}
          matchMode={item.match_mode || 'exact'}
          hasSound={hasIcon}
          hasStyleOverride={Object.keys(itemOverrides[item.name] || {}).some(k => k !== 'PlayAlertSound')}
          onPlaySound={() => soundFile && playSound(soundFile, soundVol)}
          onContextMenu={(e) => handleRightClick(e, item)}
          onDelete={
              isLocked 
              ? undefined 
              : () => {
                  if (item.rule_index !== undefined && item.rule_index !== null) {
                      const rule = categoryRules[item.rule_index];
                      const isTarget = rule?.targets?.includes(item.name);
                      if (rule?.applyToTier && !isTarget) {
                          onDeleteItem(item, tierKey);
                      } else {
                          onRemoveRuleTarget(item, item.rule_index);
                      }
                  } else {
                      onDeleteItem(item, tierKey);
                  }
              }
          }
          onClick={(e) => {
              if (e.detail === 2 && isRuleItem && onRuleEdit) {
                  onRuleEdit(tierKey, item.rule_index!);
              }
          }}
          className={isLocked ? 'locked' : ''}
        />
      );
  };

  return (
    <div className="tier-item-manager">
      <div className="mgr-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="mgr-title">📦 {t.itemsInTier} ({items.length})</span>
        <span className="mgr-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="mgr-content">
          <div className="add-area">
            <input 
              type="text" 
              placeholder={t.searchPlaceholder} 
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              className="search-box add-input"
            />
            {suggestions.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.map(s => (
                  <li key={s.name} onClick={() => handleAddItem(s)} className="suggestion-item">
                    <ItemCard 
                      item={s}
                      language={language}
                      showStagedIndicator={false}
                    />
                    <div className="source-tags">
                        {renderTierLabels(s.current_tier, s.category_ch).map((lbl, idx) => (
                            <span key={idx} className="source-hint">{lbl}</span>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="filter-area">
            <input 
                type="text" 
                placeholder={t.filterPlaceholder} 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-box"
            />
          </div>
          
          <div className="item-grid-container">
            {ruleItems.length > 0 && (
                <div className="rule-items-section">
                    <div className="section-label">{t.conditionalItems}</div>
                    <div className="item-grid">
                        {ruleItems.map(renderItem)}
                    </div>
                </div>
            )}
            
            <div className="item-grid">
                {standardItems.map(renderItem)}
            </div>
            
            {filteredItems.length === 0 && <div className="empty-msg">{t.noItems}</div>}
          </div>
        </div>
      )}

      {styleEditorItem && (
        <ItemCardStyleEditor
          itemName={styleEditorItem.name_ch || styleEditorItem.name}
          value={itemOverrides[styleEditorItem.name] || {}}
          blockStyle={tierStyle || {}}
          language={language}
          onConfirm={onCardStyleConfirm}
          onClose={() => setStyleEditorItem(null)}
        />
      )}

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          language={language}
          options={
            contextMenu.item.rule_index !== undefined && contextMenu.item.rule_index !== null
            ? [
                { 
                    label: `🔗 ${t.goToRule}`, 
                    onClick: () => {
                        if (onRuleEdit) onRuleEdit(tierKey, contextMenu.item.rule_index!);
                    } 
                },
                {
                    label: `🗑 ${t.removeFromRule}`,
                    onClick: () => onRemoveRuleTarget(contextMenu.item, contextMenu.item.rule_index!),
                    className: "delete-option"
                },
                // A card shown as a RULE's target used to get only the two entries
                // above, so "right-click -> set sound" simply did not exist for it -
                // and in a category like Uniques most cards are rule targets.
                //
                // It is worth having here: the override lands on the item's own tier,
                // so it applies wherever the owning rule's conditions do NOT match
                // (a plain Chain Belt takes it; a Replica Chain Belt still takes the
                // Replica rule's sound, because that block emits first). Use
                // "go to rule" instead when the sound should belong to the rule.
                { divider: true, label: '', onClick: () => {} },
                {
                    label: `🎨 ${(t as any).cardStyleTitle || "Card style"}`,
                    onClick: () => handleCardStyle(contextMenu.item)
                },
                {
                    label: `🎵 ${(t as any).soundSelection || "Sound Selection"}`,
                    onClick: () => handleSoundOverride(contextMenu.item)
                },
                ...(hasOwnSound(contextMenu.item) ? [{
                    label: `🔇 ${(t as any).clearSound || "Clear sound (use tier)"}`,
                    onClick: () => handleClearSound(contextMenu.item)
                }] : [])
            ].map((opt: any) => ({ ...opt, className: opt.divider && !opt.label ? "divider" : (opt.className || "") }))
            : [
                { title: true, label: (t as any).quickMove, onClick: () => {} },
                ...allTiers.map(tOption => {
                    const isT0ByOrigin = contextMenu.item.current_tiers?.some(tk => {
                        const opt = allTiers.find(o => o.key === tk);
                        return opt && opt.show_in_editor === false;
                    });
                    const isLocationLocked = (() => {
                        const opt = allTiers.find(o => o.key === tierKey);
                        return opt && opt.show_in_editor === false;
                    })();

                    const isCurrent = tOption.key === tierKey;
                    const isLocked = (!adminMode && isLocationLocked && isT0ByOrigin && contextMenu.item.rule_index === undefined);

                    return {
                        label: isCurrent ? `${tOption.label} ${(t as any).current}` : tOption.label,
                        color: getTierColor(tOption.key),
                        onClick: () => {
                            if (isT0ByOrigin && tOption.is_hide_tier) {
                                const confirmMsg = t.t0MoveWarning.replace("{name}", contextMenu.item.name_ch || contextMenu.item.name);
                                if (!window.confirm(confirmMsg)) return;
                            }
                            onMoveItem(contextMenu.item, tOption.key, false, tierKey);
                        },
                        disabled: isLocked || isCurrent
                    };
                }),
                { title: true, label: (t as any).itemSettings, onClick: () => {} },
                { 
                    label: (contextMenu.item.match_mode || 'exact') === 'exact' 
                        ? `≈ ${(t as any).switchToPartial}`
                        : `E ${(t as any).switchToExact}`,
                    onClick: () => toggleItemMode(contextMenu.item)
                },
                { divider: true, label: '', onClick: () => {} },
                { label: `🎨 ${(t as any).cardStyleTitle || "Card style"}`, onClick: () => handleCardStyle(contextMenu.item) },
                { label: `🎵 ${(t as any).soundSelection || "Sound Selection"}`, onClick: () => handleSoundOverride(contextMenu.item) },
                ...(hasOwnSound(contextMenu.item) ? [{
                    label: `🔇 ${(t as any).clearSound || "Clear sound (use tier)"}`,
                    onClick: () => handleClearSound(contextMenu.item)
                }] : [])
            ].map((opt: any) => ({ ...opt, className: opt.label === "divider" || (opt.divider && !opt.label) ? "divider" : (opt.className || "") }))
          }
        />
      )}

      {soundEditorItem && (
          <SoundPicker 
            language={language}
            initialPath={soundEditorInitial.path}
            initialVolume={soundEditorInitial.volume}
            currentSource={soundEditorInitial.source}
            onClose={() => setSoundEditorItem(null)}
            onConfirm={onSoundConfirm}
          />
      )}

      <style>{`        .tier-item-manager { margin-top: 12px; border-top: 1px solid #eee; padding-top: 5px; }
        .mgr-header { padding: 10px 0; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: #555; transition: color 0.2s; }
        .mgr-header:hover { color: #2196F3; }
        .mgr-title { font-size: 0.95rem; font-weight: 600; }
        .mgr-arrow { font-size: 0.8rem; opacity: 0.5; }

        .mgr-content { padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef; }
        .search-box { width: calc(100% - 24px); padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 0.9rem; background: #fff; }
        .add-input { border-color: #28a745; margin-bottom: 5px; }
        .add-area { position: relative; margin-bottom: 12px; }
        .suggestions-list { 
            position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; 
            background: #fff; border: 1px solid #ced4da; border-radius: 6px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-height: 250px; 
            overflow-y: auto; padding: 5px; list-style: none; 
        }
        .suggestion-item { padding: 4px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-radius: 4px; }
        .suggestion-item:hover { background: #e7f5ff; }
        .suggestion-item > div:first-child { flex: 1; }
        
        .source-tags { display: flex; gap: 4px; margin-left: 10px; }
        .source-hint { color: #6c757d; font-size: 0.75rem; font-weight: bold; background: #f8f9fa; padding: 2px 6px; border-radius: 4px; border: 1px solid #e9ecef; white-space: nowrap; }

        .filter-area { margin-bottom: 12px; }

        .item-grid { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; }
        .empty-msg { width: 100%; text-align: center; color: #adb5bd; padding: 20px; font-size: 0.85rem; font-style: italic; }
        
        .rule-items-section { margin-bottom: 15px; border-bottom: 1px dashed #ddd; padding-bottom: 10px; }
        .section-label { font-size: 0.75rem; color: #673ab7; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
      `}</style>
    </div>
  );
};

export default TierItemManager;