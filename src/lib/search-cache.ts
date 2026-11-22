import { createHash } from "node:crypto";
import { kvGet, kvSet } from "@/lib/kv";

export const SEARCH_CACHE_TTL_SEC = 30;
export const SEARCH_CACHE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
} as const;

type MemoryEntry = { body: string; expiresAt: number };
const memory = new Map<string, MemoryEntry>();
let clock: () => number = Date.now;

/** Stable, lowercase key over only cache-safe (anonymous) search parameters. */
export function normalizeSearchQuery(params: URLSearchParams): Record<string, string> {
  const get = (name: string) => params.get(name)?.trim() ?? "";
  const normalized: Record<string, string> = {
    q: get("q").toLowerCase().replace(/\s+/g, " ").slice(0, 500),
  };
  for (const name of [
    "type",
    "category",
    "brand",
    "location",
    "availability",
    "delivery",
    "sort",
  ]) {
    const value = get(name).toLowerCase();
    if (value) normalized[name] = value;
  }
  for (const name of ["minPrice", "maxPrice", "minRating", "page", "pageSize"]) {
    const value = get(name);
    if (value && Number.isFinite(Number(value))) normalized[name] = String(Number(value));
  }
  return normalized;
}

export function searchCacheKey(params: URLSearchParams, catalogVersion = "0"): string {
  // The version makes cached results self-invalidating on catalog writes.
  return createHash("sha256")
    .update(catalogVersion + "\n" + JSON.stringify(normalizeSearchQuery(params)))
    .digest("hex")
    .slice(0, 32);
}

/** Discard local search hits after a catalog write (KV keys expire via version). */
export function clearCachedSearch(): void {
  memory.clear();
}

export async function getCachedSearch(key: string): Promise<string | null> {
  const local = memory.get(key);
  if (local) {
    if (local.expiresAt > clock()) return local.body;
    memory.delete(key);
  }
  return kvGet(`search:get:${key}`);
}

export async function setCachedSearch(key: string, body: string): Promise<void> {
  memory.set(key, { body, expiresAt: clock() + SEARCH_CACHE_TTL_SEC * 1000 });
  await kvSet(`search:get:${key}`, body, SEARCH_CACHE_TTL_SEC);
}

/** Test-only helpers. */
export function __resetSearchCacheForTests(): void {
  memory.clear();
  clock = Date.now;
}

export function __setSearchCacheClockForTests(fn: () => number): void {
  clock = fn;
}
