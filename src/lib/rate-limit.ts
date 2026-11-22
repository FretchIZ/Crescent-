import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "./api";
import { kvEval } from "./kv";

/**
 * Distributed sliding-window rate limiter.
 *
 * With Upstash/Vercel KV credentials, limits are enforced by an atomic Lua
 * script in Redis so every serverless instance shares the same counters.
 * Without credentials, a bounded process-local fallback keeps local dev and
 * tests working (single-instance semantics only).
 */

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;
const WINDOW_TTL_SEC = 86_400;

// ZSET member = timestamp + random suffix, so same-millisecond hits are distinct.
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
  return {0, 0, math.max(1, retry)}
end
redis.call('ZADD', key, now, now .. '-' .. ARGV[4])
redis.call('EXPIRE', key, ARGV[5])
return {1, limit - count - 1, 0}
`;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/** Never persist raw IPs in Redis keys. */
export function hashRateKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function localRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now: number
): RateLimitResult {
  if (buckets.size > MAX_BUCKETS) {
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

export async function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const now = Date.now();
  const redisKey = `rl:${key}`;
  const result = await kvEval<[number, number, number]>(SLIDING_WINDOW_SCRIPT, [redisKey], [
    now,
    windowMs,
    limit,
    randomBytes(8).toString("hex"),
    WINDOW_TTL_SEC,
  ]);

  if (!result || !Array.isArray(result)) return localRateLimit(key, { limit, windowMs }, now);
  return {
    allowed: Number(result[0]) === 1,
    remaining: Number(result[1]),
    retryAfterSec: Number(result[2]),
  };
}

/** Standard presets used by the API layer. */
export const RATE = {
  search: { limit: 30, windowMs: 60_000 }, // 30 searches / minute
  auth: { limit: 10, windowMs: 60_000 }, // 10 auth attempts / minute
  write: { limit: 60, windowMs: 60_000 }, // 60 writes / minute
} as const;

export async function checkRate(
  key: string,
  preset: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  return rateLimit(key, preset);
}

/**
 * Route-level guard used by the API layer. Throws a 429 ApiError when the
 * caller has exhausted the window, so handlers stay free of branching.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const result = await rateLimit(key, { limit, windowMs });
  if (!result.allowed) {
    throw new ApiError(429, "Too many requests. Please slow down and try again shortly.", "rate_limited", {
      retryAfterSec: result.retryAfterSec,
    });
  }
  return result;
}

/** Test-only: clear local limiter buckets. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
