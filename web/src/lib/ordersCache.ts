import type { OrderRecord, ItemRecord } from "./flatten";

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const PREFIX = "simla_oc_";

interface CacheEntry {
  ts: number;
  records: OrderRecord[];
  items: ItemRecord[];
}

export interface CachedData {
  records: OrderRecord[];
  items: ItemRecord[];
  cachedAt: number;
}

export function makeKey(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  types: string[]
): string {
  const sig = [apiKey.slice(-10), dateFrom, dateTo, [...types].sort().join(",")].join("|");
  return PREFIX + btoa(sig).replace(/[+/=]/g, "");
}

export function readCache(key: string): CachedData | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return { records: entry.records, items: entry.items, cachedAt: entry.ts };
  } catch {
    return null;
  }
}

export function writeCache(
  key: string,
  data: { records: OrderRecord[]; items: ItemRecord[] }
): void {
  try {
    const entry: CacheEntry = { ts: Date.now(), records: data.records, items: data.items };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full — silently skip caching
  }
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
