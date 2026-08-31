import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { resolve, useTranslation, type Language } from '../utils/localization';
import LoadingOverlay from './LoadingOverlay';

/**
 * State decorators — the layer that composes ACROSS categories.
 *
 * A decorator states ONE channel and then `Continue`s, so the item keeps being matched
 * and whatever claims it supplies the rest. Verified in game 2026-08-03: later blocks
 * override only the properties THEY set, so a decorator's channel survives exactly where
 * the claiming block leaves that channel unset (reference_poe_filter_format.md §3).
 *
 * That is why this is not a nav leaf. Every other editor surface is a slice of item space
 * — Amulets, Currency, Maps. A decorator is a layer over all of them, and it lives beside
 * the preset it composes with.
 *
 * Two invariants this UI has to keep, both enforced again by validate_curation:
 *   * conditions are mandatory — a decorator without them would repaint every item;
 *   * one channel, ideally. The more it claims, the fewer looks it can compose with
 *     (FilterBlade sets exactly one on 42 of its 44).
 */

const FILE = '_decorators/States.json';
const CATEGORY = 'States';
/** Decorators must emit BEFORE anything they decorate. Campaign sits at -110. */
const GEN_ORDER = -1000;

type Channel = 'BorderColor' | 'TextColor' | 'BackgroundColor';

interface StatePreset {
  key: string;
  en: string;
  ch: string;
  conditions: Record<string, string>;
}

/** Item states the filter format can actually test. */
const STATE_PRESETS: StatePreset[] = [
  { key: 'Corrupted',   en: 'Corrupted',        ch: '腐化',     conditions: { Corrupted: 'True' } },
  { key: 'Fractured',   en: 'Fractured',        ch: '破碎',     conditions: { FracturedItem: 'True' } },
  { key: 'Synthesised', en: 'Synthesised',      ch: '合成',     conditions: { SynthesisedItem: 'True' } },
  { key: 'Mirrored',    en: 'Mirrored',         ch: '复制',     conditions: { Mirrored: 'True' } },
  { key: 'Enchanted',   en: 'Enchanted',        ch: '附魔',     conditions: { AnyEnchantment: 'True' } },
  { key: 'Shaper',      en: 'Shaper influence', ch: '塑界者',   conditions: { HasInfluence: 'Shaper' } },
  { key: 'Elder',       en: 'Elder influence',  ch: '腐蚀者',   conditions: { HasInfluence: 'Elder' } },
];

const CHANNELS: { key: Channel; en: string; ch: string }[] = [
  { key: 'BorderColor',     en: 'Border',     ch: '边框' },
  { key: 'TextColor',       en: 'Text',       ch: '文字' },
  { key: 'BackgroundColor', en: 'Background', ch: '背景' },
];

interface Deco {
  key: string;              // tier key inside the category
  conditions: Record<string, any>;
  channel: Channel;
  colour: string;           // #rrggbbaa
  en: string;
  ch: string;
  foreign?: string;         // path, when the decorator lives outside our own file
}

const hexOf = (v: any): string => (typeof v === 'string' && v.startsWith('#') ? v : '#ffffffff');
const rgba = (hex: string): string => {
  const h = hex.replace('#', '');
  const n = (i: number) => parseInt(h.slice(i, i + 2) || 'ff', 16);
  return `rgba(${n(0)},${n(2)},${n(4)},${(h.length >= 8 ? n(6) : 255) / 255})`;
};

const DecoratorEditor: React.FC<{ language: Language; onClose: () => void }> = ({ language, onClose }) => {
  const ch = language === 'ch';
  const t = useTranslation(language);
  const [loading, setLoading] = useState(true);
  const [decos, setDecos] = useState<Deco[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/simulator-bundle');
        const found: Deco[] = [];
        for (const [path, doc] of Object.entries<any>(res.data?.tiers || {})) {
          const catKey = Object.keys(doc || {}).find(k => !k.startsWith('//'));
          if (!catKey) continue;
          for (const [tierKey, tier] of Object.entries<any>(doc[catKey] || {})) {
            if (tierKey === '_meta' || !tier || typeof tier !== 'object' || !tier.decorator) continue;
            const theme = tier.theme || {};
            const channel = (CHANNELS.find(c => theme[c.key] !== undefined)?.key) || 'BorderColor';
            found.push({
              key: tierKey,
              conditions: tier.conditions || {},
              channel,
              colour: hexOf(theme[channel]),
              en: tier.localization?.en || tierKey,
              ch: tier.localization?.ch || tierKey,
              foreign: path.endsWith(FILE) ? undefined : path,
            });
          }
        }
        setDecos(found);
      } catch (e) {
        console.error('failed to load decorators', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const owned = useMemo(() => decos.filter(d => !d.foreign), [decos]);
  const foreign = useMemo(() => decos.filter(d => d.foreign), [decos]);

  const update = (key: string, patch: Partial<Deco>) => {
    setDecos(ds => ds.map(d => (d.key === key && !d.foreign ? { ...d, ...patch } : d)));
    setDirty(true);
  };

  const add = (p: StatePreset) => {
    setAdding(false);
    if (decos.some(d => d.key === p.key)) { setMsg(t.thatStateAlreadyExists); return; }
    setDecos(ds => [...ds, {
      key: p.key, conditions: p.conditions, channel: 'BorderColor',
      colour: '#ff4d4dff', en: p.en, ch: p.ch,
    }]);
    setDirty(true);
  };

  const remove = (key: string) => { setDecos(ds => ds.filter(d => d.key !== key)); setDirty(true); };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const cat: any = {
        _meta: {
          theme_category: CATEGORY,
          localization: { en: 'State Decorators', ch: '状态叠加' },
          tier_order: owned.map(d => d.key),
          // NB: gen_order does NOT go here. filterGenerator reads it from the MAPPING
          // file's _meta, and writing it in both places is the duplicate-identity trap
          // that had the theme board editing the wrong bucket for 13 nav leaves.
        },
      };
      for (const d of owned) {
        cat[d.key] = {
          decorator: true,
          conditions: d.conditions,
          // ONLY the stated channel. No Tier row is consulted for a decorator, so no
          // rung is needed and none is written.
          theme: { [d.channel]: d.colour },
          localization: { en: d.en, ch: d.ch },
        };
      }
      await axios.post(`/api/config/tier_definition/${FILE}`, { [CATEGORY]: cat });
      // The mapping partner keeps the pair symmetrical; a decorator maps no bases.
      await axios.post(`/api/config/base_mapping/${FILE}`, {
        _meta: {
          item_class: { en: 'State Decorators', ch: '状态叠加' },
          localization: { ch: {} },
          // ★ Emission order lives HERE - it is what the generator sorts on. A decorator
          // must precede everything it decorates, and campaign already sits at -110.
          gen_order: GEN_ORDER,
        },
        mapping: {}, rules: [],
      });
      setDirty(false);
      setMsg(t.saved);
    } catch (e: any) {
      setMsg((t.saveFailed2) + (e?.message || 'error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="deco-modal modal-overlay">
        <div className="modal-content"><LoadingOverlay language={language} /></div>
      </div>
    );
  }

  return (
    <div className="deco-modal modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="deco-box">
        <div className="deco-head">
          <h3>{t.stateDecorators}</h3>
          <span className="deco-count">{owned.length}</span>
          <span className="spacer" />
          <button className="btn" onClick={() => setAdding(a => !a)}>{t.addState}</button>
          <button className="btn primary" disabled={!dirty || saving} onClick={save}>
            {saving ? (t.saving) : (t.save)}
          </button>
          <button className="btn" onClick={onClose}>{t.close}</button>
        </div>

        <p className="deco-hint">
          {t.aStateSetsOneChannel}
        </p>

        {adding && (
          <div className="deco-add">
            {STATE_PRESETS.map(p => (
              <button key={p.key} className="btn sm" onClick={() => add(p)}>
                {resolve(p, language)}
              </button>
            ))}
          </div>
        )}

        {msg && <div className="deco-msg">{msg}</div>}

        {owned.length === 0 && !adding && (
          <div className="deco-empty">
            {t.noStateDecoratorsYetAdd}
          </div>
        )}

        <div className="deco-list">
          {owned.map(d => (
            <div className="deco-row" key={d.key}>
              <div className="deco-name">
                <strong>{resolve(d, language)}</strong>
                <code>{Object.entries(d.conditions).map(([k, v]) => `${k} ${v}`).join(' · ')}</code>
              </div>

              <select value={d.channel} onChange={e => update(d.key, { channel: e.target.value as Channel })}>
                {CHANNELS.map(c => <option key={c.key} value={c.key}>{ch ? c.ch : c.en}</option>)}
              </select>

              <input type="color" value={d.colour.slice(0, 7)}
                     onChange={e => update(d.key, { colour: e.target.value + d.colour.slice(7).padEnd(2, 'f') })} />

              {/* Composed preview: a neutral plate that states NO border, so the
                  decorator is visible exactly as it would be in game. */}
              <div className="deco-preview" style={{
                borderColor: d.channel === 'BorderColor' ? rgba(d.colour) : 'transparent',
                color: d.channel === 'TextColor' ? rgba(d.colour) : '#c8c8c8',
                background: d.channel === 'BackgroundColor' ? rgba(d.colour) : '#000000bb',
              }}>
                {t.sampleItem}
              </div>

              <button className="btn sm danger" onClick={() => remove(d.key)}>{t.remove}</button>
            </div>
          ))}
        </div>

        {foreign.length > 0 && (
          <div className="deco-foreign">
            {t.decoratorsDefinedElsewhereReadOnly}
            {foreign.map(d => <code key={d.foreign! + d.key}>{d.key} — {d.foreign}</code>)}
          </div>
        )}
      </div>

      <style>{`
        .deco-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000;
                      display: flex; align-items: center; justify-content: center; padding: 24px; }
        .deco-box { background: #fff; border-radius: 10px; width: min(980px, 100%); max-height: 88vh;
                    display: flex; flex-direction: column; gap: 12px; padding: 18px;
                    box-shadow: 0 18px 50px rgba(0,0,0,0.35); overflow-y: auto; }
        .deco-head { display: flex; align-items: center; gap: 10px; }
        .deco-head h3 { margin: 0; }
        .deco-count { font-family: ui-monospace, Consolas, monospace; color: #888; font-size: 0.8rem; }
        .deco-head .spacer { flex: 1; }
        .deco-hint { margin: 0; color: #666; font-size: 0.85rem; line-height: 1.5; }
        .deco-add { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px; background: #f6f7f9; border-radius: 8px; }
        .deco-msg { padding: 8px 10px; background: #eef6ff; border: 1px solid #cfe4ff; border-radius: 6px; font-size: 0.85rem; }
        .deco-empty { padding: 30px; text-align: center; color: #999; }
        .deco-list { display: flex; flex-direction: column; gap: 8px; }
        .deco-row { display: grid; grid-template-columns: 1fr 130px 48px 200px auto; gap: 10px;
                    align-items: center; padding: 10px; border: 1px solid #eee; border-radius: 8px; }
        .deco-name { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .deco-name code { font-size: 0.72rem; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .deco-row select, .deco-row input[type=color] { padding: 4px; border: 1px solid #ddd; border-radius: 6px; }
        .deco-preview { font-family: Fontin, Georgia, serif; text-align: center; padding: 5px 10px;
                        border: 2px solid transparent; border-radius: 2px; }
        .btn { background: #f2f3f5; border: 1px solid #ddd; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
        .btn:hover { border-color: #2196F3; }
        .btn.primary { background: #2196F3; border-color: #2196F3; color: #fff; font-weight: 600; }
        .btn.primary:disabled { background: #b9c3cc; border-color: #b9c3cc; cursor: not-allowed; }
        .btn.sm { padding: 4px 10px; font-size: 0.8rem; }
        .btn.danger:hover { border-color: #d9534f; color: #d9534f; }
        .deco-foreign { display: flex; flex-direction: column; gap: 3px; color: #888; font-size: 0.78rem;
                        border-top: 1px solid #eee; padding-top: 10px; }
        @media (max-width: 820px) { .deco-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default DecoratorEditor;
