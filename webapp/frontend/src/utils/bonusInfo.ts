import axios from "axios";
import { useEffect, useState } from "react";

// FilterBlade-style "bonus info" hover data, loaded once and cached module-side.
//  - items:   item-name -> {description, tags}      (currency / scarabs / fragments / ...)
//  - uniques: base-type -> {text, uniques[]}         (which valuable uniques a base could be)

export interface BonusFlatInfo {
  description: string;
  tags: string[];
  // Official GGPK usage description (currency-like items): zh for CH-mode
  // display, en so the tooltip can dedup FilterBlade lines against it.
  description_ch?: string;
  description_en?: string;
}

export interface UniqueCandidate {
  unique: string;
  name_ch?: string; // from the GGPK words.json dump
  text: string;
  priority: number;
  ruleLink?: { entryName?: string; text?: string } | null;
  hideInHoverBox?: boolean;
  legacy?: boolean; // drop-disabled per poewiki (fated/legacy/league-removed)
}

// Where a unique drops, derived from FilterBlade's hover text keywords.
export type DropSource = "global" | "boss" | "league" | "nodrop";

const NODROP_RE =
  /does not drop|vendor recipe|created (?:with|from|by)|upgraded (?:with|from|by)|corrupting|fated|prophecy/i;
const LEAGUE_RE =
  /heist|blueprint|contract|safehouse|catarina|delve|delirium|blight|breach|legion|incursion|temple of atzoatl|ritual|expedition|logbook|synthesis|betrayal|abyss|sanctum|ultimatum|harbinger|beyond|warband|talisman|essence|perandus|ambush|domination|anarchy|torment|bestiary|harvest|metamorph|crucible|affliction|necropolis|settlers|kalguur|ancestor|incubat|labyrinth|rogue exile/i;
const BOSS_RE = /drops? from|drops? exclusively|boss|guardian|conqueror|pinnacle/i;

export function deriveDropSource(text: string | null | undefined): DropSource {
  if (!text) return "global";
  if (NODROP_RE.test(text)) return "nodrop";
  if (LEAGUE_RE.test(text)) return "league";
  if (BOSS_RE.test(text)) return "boss";
  return "global";
}

export interface UniqueBaseInfo {
  text: string | null;
  uniques: UniqueCandidate[];
}

export interface BonusInfoData {
  items: Record<string, BonusFlatInfo>;
  uniques: Record<string, UniqueBaseInfo>;
}

const EMPTY: BonusInfoData = { items: {}, uniques: {} };

let cache: BonusInfoData | null = null;
let inflight: Promise<BonusInfoData> | null = null;
const subscribers = new Set<(d: BonusInfoData) => void>();

export function getBonusInfo(): BonusInfoData | null {
  return cache;
}

export function loadBonusInfo(): Promise<BonusInfoData> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = axios
    .get<BonusInfoData>("/api/bonus-info")
    .then((res) => {
      cache = {
        items: res.data?.items || {},
        uniques: res.data?.uniques || {},
      };
      subscribers.forEach((cb) => cb(cache as BonusInfoData));
      return cache;
    })
    .catch(() => {
      // Fail soft (e.g. static demo with no backend) — tooltips just omit the section.
      cache = EMPTY;
      return EMPTY;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

// React hook: returns the cached data, kicking off a one-time fetch if needed.
export function useBonusInfo(): BonusInfoData {
  const [data, setData] = useState<BonusInfoData>(cache || EMPTY);
  useEffect(() => {
    if (cache) {
      setData(cache);
      return;
    }
    const cb = (d: BonusInfoData) => setData(d);
    subscribers.add(cb);
    loadBonusInfo();
    return () => {
      subscribers.delete(cb);
    };
  }, []);
  return data;
}
