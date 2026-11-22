/**
 * Tiny Redis-compatible KV client using the Upstash / Vercel KV REST API.
 *
 * Two modes:
 *  - configured: distributed Redis via REST (single in-flight HTTP call per
 *    command, short timeout), shared by every serverless instance;
 *  - unconfigured: process-local Map fallback for local dev, tests and CI.
 *
 * Only opaque keys/values are stored here. Never put raw tokens, emails,
 * headers or IPs in a cache key — callers pass hashes instead.
 */

const KV_TIMEOUT_MS = 1_500;

type Entry = { value: string; expiresAt?: number };
type Mode = "redis" | "memory";

const memory = new Map<string, Entry>();
let clock: () => number = Date.now;

type KvConfig = { url: string; token: string };

function config(): KvConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function kvMode(): Mode {
  return config() ? "redis" : "memory";
}

export function kvEnabled(): boolean {
  return kvMode() === "redis";
}

async function command<T>(...args: Array<string | number>): Promise<T | null> {
  const cfg = config();
  if (!cfg) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KV_TIMEOUT_MS);
  try {
    const response = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("kv_command_failed");
    const json = (await response.json()) as { result?: T; error?: string };
    if (json.error) throw new Error("kv_command_error");
    return json.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== undefined && entry.expiresAt <= clock()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

export async function kvGet(key: string): Promise<string | null> {
  if (!config()) return memoryGet(key);
  return command<string>("GET", key);
}

export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (!config()) {
    memory.set(key, {
      value,
      expiresAt: ttlSeconds ? clock() + ttlSeconds * 1000 : undefined,
    });
    return;
  }
  if (ttlSeconds) await command("SET", key, value, "EX", Math.max(1, Math.ceil(ttlSeconds)));
  else await command("SET", key, value);
}

export async function kvDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!config()) {
    for (const key of keys) memory.delete(key);
    return;
  }
  await command("DEL", ...keys);
}

export async function kvIncr(key: string): Promise<number> {
  if (!config()) {
    const next = Number(memoryGet(key) ?? "0") + 1;
    const previous = memory.get(key);
    memory.set(key, {
      value: String(next),
      expiresAt: previous?.expiresAt,
    });
    return next;
  }
  return Number((await command<number>("INCR", key)) ?? 0);
}

/** Atomic Lua execution when Redis is configured. */
export async function kvEval<T>(script: string, keys: string[], args: Array<string | number>): Promise<T | null> {
  if (!config()) return null;
  return command<T>("EVAL", script, String(keys.length), ...keys, ...args);
}

export async function kvPing(): Promise<{ ok: boolean; latencyMs: number; mode: Mode }> {
  const started = Date.now();
  const mode = kvMode();
  try {
    if (mode === "redis") {
      const pong = await command<string>("PING");
      if (String(pong).toUpperCase() !== "PONG") throw new Error("kv_ping_failed");
    } else {
      // Exercises the fallback store without leaving a key behind.
      const probe = "__health_probe__";
      memory.set(probe, { value: "1" });
      memory.delete(probe);
    }
    return { ok: true, latencyMs: Date.now() - started, mode };
  } catch {
    return { ok: false, latencyMs: Date.now() - started, mode };
  }
}

/** Test-only helpers — never used by application code. */
export function __resetKvForTests(): void {
  memory.clear();
  clock = Date.now;
}

export function __setKvClockForTests(fn: () => number): void {
  clock = fn;
}
