import axios from "axios";
import { useEffect, useState } from "react";

// FilterBlade-style "bonus info" hover data, loaded once and cached module-side.
//  - items:   item-name -> {description, tags}      (currency / scarabs / fragments / ...)
//  - uniques: base-type -> {text, uniques[]}         (which valuable uniques a base could be)

export interface BonusFlatInfo {
  description: string;
  tags: string[];
}

export interface UniqueCandidate {
  unique: string;
  text: string;
  priority: number;
  ruleLink?: { entryName?: string; text?: string } | null;
  hideInHoverBox?: boolean;
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
