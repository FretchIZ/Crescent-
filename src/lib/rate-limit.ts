import { ApiError } from "./api";

/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single Node process (dev / single-instance deploys).
 * For multi-instance production, back this with Redis or a CDN-level
 * limiter — the interface below is the seam to swap implementations.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) {
    // Opportunistic eviction of stale buckets to bound memory.
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t > windowMs)) buckets.delete(k);
    }
  }
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

/** Standard presets used by the API layer. */
export const RATE = {
  search: { limit: 30, windowMs: 60_000 }, // 30 searches / minute
  auth: { limit: 10, windowMs: 60_000 }, // 10 auth attempts / minute
  write: { limit: 60, windowMs: 60_000 }, // 60 writes / minute
} as const;

/** Throw-friendly helper: returns true when the request is allowed. */
export function checkRate(
  key: string,
  preset: { limit: number; windowMs: number }
): RateLimitResult {
  return rateLimit(key, preset);
}

/**
 * Route-level guard used by the API layer. Throws a 429 ApiError when the
 * caller has exhausted the window, so handlers stay free of branching.
 */
export function enforceRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const result = rateLimit(key, { limit, windowMs });
  if (!result.allowed) {
    throw new ApiError(429, "Too many requests. Please slow down and try again shortly.", "rate_limited", {
      retryAfterSec: result.retryAfterSec,
    });
  }
  return result;
}
