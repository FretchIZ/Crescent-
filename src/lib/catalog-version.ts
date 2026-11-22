import { kvGet, kvIncr } from "./kv";

/** Shared version key; bumping it invalidates every catalog and search snapshot. */
export const CATALOG_VERSION_KEY = "catalog:version";

const VERSION_CACHE_TTL_MS = 5_000;
let cached: { value: string; expiresAt: number } | null = null;

/**
 * Short-lived in-memory mirror of the distributed version. Warm requests do
 * not need a KV round trip; a bump refreshes this instance immediately, and
 * other instances converge within VERSION_CACHE_TTL_MS.
 */
export async function getCatalogVersion(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = (await kvGet(CATALOG_VERSION_KEY)) ?? "0";
  cached = { value, expiresAt: Date.now() + VERSION_CACHE_TTL_MS };
  return value;
}

export async function bumpCatalogVersion(): Promise<number> {
  const next = await kvIncr(CATALOG_VERSION_KEY);
  cached = { value: String(next), expiresAt: Date.now() + VERSION_CACHE_TTL_MS };
  return next;
}

/** Test-only: discard the local version mirror. */
export function __resetCatalogVersionForTests(): void {
  cached = null;
}
