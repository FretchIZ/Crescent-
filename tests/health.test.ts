import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "node:child_process";

// Use a dedicated database so health tests never race with the API test suite.
const HEALTH_DB_URL = "file:./prisma/health-test.db";
;(process.env as Record<string, string>).DATABASE_URL = HEALTH_DB_URL;
;(process.env as Record<string, string>).NODE_ENV = "test";
;(process.env as Record<string, string>).SESSION_SECRET =
  "test-secret-key-that-is-at-least-32-chars-long!!!";
;(process.env as Record<string, string>).VERCEL_GIT_COMMIT_SHA = "test-sha-12345";

type Db = typeof import("@/lib/db").db;
let db: Db;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate --force-reset", {
    env: {
      ...(process.env as Record<string, string>),
      DATABASE_URL: HEALTH_DB_URL,
      NODE_ENV: "test",
    },
    stdio: "ignore",
  });
  ({ db } = await import("@/lib/db"));
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("Health check", () => {
  test("/api/health returns structured JSON when the database is reachable", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(body.version).toBe("test-sha-12345");
    expect(body.checks.database.ok).toBe(true);
    expect(typeof body.checks.database.latencyMs).toBe("number");
    expect(body.checks.cache.ok).toBe(true);
    expect(["redis", "memory"]).toContain(body.checks.cache.mode);
    expect(body.checks.configuration.ok).toBe(true);
    expect(body.checks.ai.ok).toBe(true);
    expect(typeof body.tookMs).toBe("number");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("/health exposes the same report", async () => {
    const { GET } = await import("@/app/health/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database.ok).toBe(true);
    expect(body.version).toBe("test-sha-12345");
  });

  test("returns 503 and a degraded report when the database check fails", async () => {
    const spy = vi.spyOn(db, "$queryRaw").mockRejectedValueOnce(
      new Error("Connection refused for postgresql://user:super-secret@db.internal/app")
    );
    try {
      const { GET } = await import("@/app/api/health/route");
      const res = await GET();
      expect(res.status).toBe(503);

      const text = await res.text();
      expect(text).not.toContain("super-secret");
      expect(text).not.toContain("Connection refused");
      const body = JSON.parse(text);
      expect(body.status).toBe("degraded");
      expect(body.checks.database.ok).toBe(false);
      expect(body.checks.database.error).toBe("Database unavailable or timed out");
    } finally {
      spy.mockRestore();
    }
  });
});
