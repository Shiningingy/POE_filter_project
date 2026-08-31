import React, { useState } from 'react';
import { useTranslation, translate, type Language } from '../utils/localization';
import MinimapIconPicker from './MinimapIconPicker';
import PlayEffectPicker from './PlayEffectPicker';
import SoundPicker from './SoundPicker';
import { DEFAULT_SOUND_VOLUME } from '../utils/filterStyle';

/**
 * The mini style editor for one ITEM CARD.
 *
 * A card is the per-occurrence representation of a base in the editor, and it may
 * carry its own style override. In practice that is almost always a sound — which
 * is why the right-click menu keeps its one-click sound entry and this sits above
 * it as the "everything else" door, rather than the menu growing a row per channel.
 *
 * Every channel is INHERIT by default: unset means the card takes the block's
 * look, and only what you deliberately set becomes an override. That matters
 * because each distinct override splits the block at generation — a card that
 * silently pinned all six channels would fragment a block for no reason.
 *
 * Clearing is explicit and returns the channel to the block, which is why the
 * confirm callback reports removals separately from values.
 */

const CHANNELS = ['FontSize', 'TextColor', 'BorderColor', 'BackgroundColor', 'PlayEffect', 'MinimapIcon'] as const;
const COLOR_CHANNELS = ['TextColor', 'BorderColor', 'BackgroundColor'] as const;

// A channel's filter-format name is NOT its translation key. This used to be
// `t['style' + channel]`, and no `styleFontSize` / `styleTextColor` / … key has ever
// existed — so every row label in this editor rendered the raw camelCase identifier,
// in BOTH languages, and the `|| k` fallback could not save it because the string
// lookup returns the key itself on a miss. The labels were there all along, under
// these names.
const LABEL_KEY: Record<string, string> = {
  FontSize: 'fontSize',
  TextColor: 'TextColor',
  BorderColor: 'BorderColor',
  BackgroundColor: 'BackgroundColor',
  PlayEffect: 'dropEffect',
  MinimapIcon: 'minimapIcon',
  PlayAlertSound: 'sound',
};

interface Props {
  itemName: string;
  /** The card's existing override (may be empty). */
  value: Record<string, any>;
  /** The block's resolved style — what the card inherits when a channel is unset. */
  blockStyle: Record<string, any>;
  language: Language;
  onConfirm: (overrides: Record<string, any>, removeKeys: string[]) => void;
  onClose: () => void;
}

const hexOf = (v: any): string => {
  if (typeof v !== 'string' || !v.startsWith('#')) return '#ffffff';
  return v.substring(0, 7);
};

const ItemCardStyleEditor: React.FC<Props> = ({ itemName, value, blockStyle, language, onConfirm, onClose }) => {
  const t = useTranslation(language) as any;
  const [draft, setDraft] = useState<Record<string, any>>({ ...value });
  const [picker, setPicker] = useState<null | 'icon' | 'beam' | 'sound'>(null);

  const isSet = (k: string) => k in draft;
  const setChannel = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const clearChannel = (k: string) => setDraft((d) => { const n = { ...d }; delete n[k]; return n; });

  const confirm = () => {
    // Everything the card USED to override and no longer does has to be removed
    // explicitly — the backend merges, so an absent key would otherwise persist.
    const removed = Object.keys(value).filter((k) => !(k in draft));
    onConfirm(draft, removed);
  };

  const inherited = (k: string) => {
    const v = blockStyle?.[k];
    if (v === undefined || v === null) return t.cardInherit || 'from block';
    if (Array.isArray(v)) return v[0];
    return String(v);
  };

  const row = (k: string, control: React.ReactNode) => (
    <div className="card-style-row" key={k}>
      <label className="card-style-label">{translate(LABEL_KEY[k] ?? k, language) ?? k}</label>
      <div className="card-style-control">{control}</div>
      {isSet(k) ? (
        <button className="card-style-clear" onClick={() => clearChannel(k)} title={t.cardClearChannel || 'Back to the block'}>✕</button>
      ) : (
        <span className="card-style-inherit" title={t.cardInheritHint || 'Unset — inherits the block'}>↳ {inherited(k)}</span>
      )}
    </div>
  );

  const soundPair = draft.PlayAlertSound;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card-style-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t.cardStyleTitle || 'Card style'} — {itemName}</h3>
          <button className="close-x" onClick={onClose}>×</button>
        </div>

        <p className="card-style-note">
          {t.cardStyleNote || 'Only what you set here overrides the block. Each override emits its own block.'}
        </p>

        {row('FontSize', (
          <input
            type="number" min={1} max={45}
            value={isSet('FontSize') ? draft.FontSize : (blockStyle?.FontSize ?? '')}
            onChange={(e) => setChannel('FontSize', parseInt(e.target.value, 10))}
          />
        ))}

        {COLOR_CHANNELS.map((k) => row(k, (
          <input
            type="color"
            value={hexOf(isSet(k) ? draft[k] : blockStyle?.[k])}
            onChange={(e) => setChannel(k, `${e.target.value}ff`)}
          />
        )))}

        {row('PlayEffect', (
          <button className="card-style-pick" onClick={() => setPicker('beam')}>
            {isSet('PlayEffect') ? String(draft.PlayEffect ?? '—') : (t.cardPick || 'Pick…')}
          </button>
        ))}

        {row('MinimapIcon', (
          <button className="card-style-pick" onClick={() => setPicker('icon')}>
            {isSet('MinimapIcon') ? String(draft.MinimapIcon ?? '—') : (t.cardPick || 'Pick…')}
          </button>
        ))}

        {row('PlayAlertSound', (
          <button className="card-style-pick" onClick={() => setPicker('sound')}>
            {Array.isArray(soundPair) ? `${soundPair[0]} (${soundPair[1]})` : (t.cardPick || 'Pick…')}
          </button>
        ))}

        <div className="modal-actions">
          <button onClick={onClose}>{t.cancel || 'Cancel'}</button>
          <button className="primary" onClick={confirm}>{t.confirm || 'Apply'}</button>
        </div>

        {picker === 'icon' && (
          <MinimapIconPicker
            value={isSet('MinimapIcon') ? draft.MinimapIcon : blockStyle?.MinimapIcon}
            title={itemName} language={language}
            onConfirm={(v) => { v === null ? clearChannel('MinimapIcon') : setChannel('MinimapIcon', v); setPicker(null); }}
            onClose={() => setPicker(null)}
          />
        )}
        {picker === 'beam' && (
          <PlayEffectPicker
            value={isSet('PlayEffect') ? draft.PlayEffect : blockStyle?.PlayEffect}
            title={itemName} language={language}
            onConfirm={(v) => { v === null ? clearChannel('PlayEffect') : setChannel('PlayEffect', v); setPicker(null); }}
            onClose={() => setPicker(null)}
          />
        )}
        {picker === 'sound' && (
          <SoundPicker
            language={language}
            initialPath={Array.isArray(soundPair) ? soundPair[0] : (Array.isArray(blockStyle?.PlayAlertSound) ? blockStyle.PlayAlertSound[0] : undefined)}
            initialVolume={Array.isArray(soundPair) ? soundPair[1] : (Array.isArray(blockStyle?.PlayAlertSound) ? blockStyle.PlayAlertSound[1] : DEFAULT_SOUND_VOLUME)}
            onConfirm={(path, vol) => { setChannel('PlayAlertSound', [path, vol]); setPicker(null); }}
            onClose={() => setPicker(null)}
          />
        )}

        <style>{`
          .card-style-editor { background: #fff; border-radius: 8px; padding: 16px; width: 420px; max-width: 92vw; max-height: 88vh; overflow-y: auto; }
          .card-style-note { font-size: 12px; color: #666; margin: 4px 0 12px; }
          .card-style-row { display: grid; grid-template-columns: 110px 1fr auto; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
          .card-style-label { font-size: 13px; color: #333; }
          .card-style-control input[type="number"] { width: 70px; padding: 4px; }
          .card-style-control input[type="color"] { width: 46px; height: 26px; padding: 0; border: 1px solid #ddd; }
          .card-style-pick { padding: 4px 8px; font-size: 12px; max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .card-style-clear { border: none; background: #eee; border-radius: 4px; cursor: pointer; padding: 2px 7px; }
          .card-style-inherit { font-size: 11px; color: #999; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
          .modal-actions .primary { background: #2b6cb0; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; }
        `}</style>
      </div>
    </div>
  );
};

export default ItemCardStyleEditor;
export { CHANNELS as CARD_STYLE_CHANNELS };
