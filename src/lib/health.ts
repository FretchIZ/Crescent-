import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { kvPing } from "@/lib/kv";

/** Never let a dependency probe stall the health endpoint. */
const DEPENDENCY_TIMEOUT_MS = 3_000;

type HealthStatus = "ok" | "degraded";
type Check = { ok: boolean; latencyMs?: number; error?: string };

export type HealthReport = {
  status: HealthStatus;
  timestamp: string;
  version: string;
  tookMs: number;
  checks: {
    database: Check;
    cache: Check & { mode: "redis" | "memory" };
    configuration: Check;
    ai: Check;
  };
};

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Health check timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Builds a health report without leaking stack traces, connection strings or
 * credentials. Raw dependency errors are intentionally discarded.
 */
export async function getHealthReport(): Promise<HealthReport> {
  const started = Date.now();

  // Database probe — the only critical external dependency.
  const dbStarted = Date.now();
  let database: Check;
  try {
    await withTimeout(db.$queryRaw`SELECT 1`, DEPENDENCY_TIMEOUT_MS);
    database = { ok: true, latencyMs: Date.now() - dbStarted };
  } catch {
    database = {
      ok: false,
      latencyMs: Date.now() - dbStarted,
      error: "Database unavailable or timed out",
    };
  }

  // Redis/KV probe. A process-local fallback is healthy in dev/test but is
  // explicitly degraded in production, where limits/sessions must be shared.
  const cachePing = await kvPing();
  const cache: HealthReport["checks"]["cache"] = {
    ok: cachePing.ok && (!isProduction || cachePing.mode === "redis"),
    latencyMs: cachePing.latencyMs,
    mode: cachePing.mode,
    ...(cachePing.ok ? {} : { error: "Cache unavailable or timed out" }),
    ...(cachePing.ok && !isProduction && cachePing.mode === "memory"
      ? { note: "Local in-memory fallback (not shared across instances)" }
      : {}),
    ...(isProduction && cachePing.mode === "memory"
      ? { error: "Redis/KV credentials are required in production" }
      : {}),
  };

  // Configuration probe — no values are ever returned.
  const configuration: Check = {
    ok:
      Boolean(env.DATABASE_URL) &&
      Boolean(env.APP_URL) &&
      (!isProduction || Boolean(env.SESSION_SECRET)),
  };

  // The local ranking engine is always available; OpenAI is optional.
  const ai: Check = {
    ok: true,
    latencyMs: 0,
  };

  const status: HealthStatus =
    database.ok && configuration.ok && cache.ok ? "ok" : "degraded";

  return {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    tookMs: Date.now() - started,
    checks: { database, cache, configuration, ai },
  };
}

/** Structured, credential-free health response with the correct status code. */
export async function healthResponse(): Promise<NextResponse> {
  const report = await getHealthReport();
  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
