import { describe, test, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { apiHandler, ApiError, redactRoute } from "@/lib/api";
import { safeRedirectPath } from "@/lib/utils";
import {
  __resetRateLimitForTests,
  hashRateKey,
  rateLimit,
} from "@/lib/rate-limit";
import { kvMode } from "@/lib/kv";
import { z } from "zod";

describe("safeRedirectPath", () => {
  test("keeps same-origin paths", () => {
    expect(safeRedirectPath("/search?q=flowers")).toBe("/search?q=flowers");
    expect(safeRedirectPath("/")).toBe("/");
  });

  test("rejects external and protocol-relative redirects", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath("/ok\nSet-Cookie: x=y")).toBe("/");
    expect(safeRedirectPath(undefined, "/login")).toBe("/login");
  });
});

describe("redactRoute", () => {
  test("removes opaque identifiers from telemetry paths", () => {
    expect(redactRoute("/api/items/PRODUCT/clh1234567890abcdefghijk")).toBe(
      "/api/items/PRODUCT/:id"
    );
    expect(redactRoute("/api/search")).toBe("/api/search");
  });
});

describe("deployment configuration", () => {
  const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");

  test("production Prisma schema targets PostgreSQL while local stays SQLite", () => {
    expect(read("prisma/schema.prisma")).toMatch(/provider\s*=\s*"sqlite"/);
    expect(read("prisma/schema.production.prisma")).toMatch(/provider\s*=\s*"postgresql"/);
  });

  test("vercel.json uses the production build and has no catch-all rewrite", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(config.buildCommand).toBe("npm run build:vercel");
    expect(config.installCommand).toBe("npm ci");
    expect(config.rewrites).toBeUndefined();
    expect(config.routes).toBeUndefined();
  });

  test("gitignore excludes secrets and local databases", () => {
    const ignore = read(".gitignore");
    expect(ignore).toContain(".env");
    expect(ignore).toContain("**/*.db");
  });
});

describe("distributed rate limiting", () => {
  test("uses the local fallback when KV is not configured", async () => {
    __resetRateLimitForTests();
    expect(kvMode()).toBe("memory");
    const key = `local-${Date.now()}`;
    expect((await rateLimit(key, { limit: 2, windowMs: 60_000 })).allowed).toBe(true);
    expect((await rateLimit(key, { limit: 2, windowMs: 60_000 })).allowed).toBe(true);
    const third = await rateLimit(key, { limit: 2, windowMs: 60_000 });
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  test("executes an atomic Redis script when KV credentials are present", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: [1, 4, 0] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    try {
      expect(kvMode()).toBe("redis");
      const result = await rateLimit("distributed-test", { limit: 5, windowMs: 60_000 });
      expect(result).toEqual({ allowed: true, remaining: 4, retryAfterSec: 0 });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = String(fetchSpy.mock.calls[0]![1]?.body);
      expect(body).toContain("EVAL");
      expect(body).toContain("rl:distributed-test");
      expect(body).not.toContain("127.0.0.1");
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  test("hashes IPs before using them as cache keys", () => {
    expect(hashRateKey("203.0.113.42")).toMatch(/^[a-f0-9]{24}$/);
    expect(hashRateKey("203.0.113.42")).not.toContain("203.0.113.42");
  });
});

describe("apiHandler telemetry", () => {
  test("logs the real status code when a handler throws an ApiError", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const handler = apiHandler(async () => {
        throw new ApiError(404, "Missing", "not_found");
      });
      const response = await handler(
        new Request("http://localhost/api/items/PRODUCT/clh1234567890abcdefghijk"),
        {} as never
      );
      expect(response.status).toBe(404);
      const entry = log.mock.calls.map((call) => String(call[0])).join("\n");
      expect(entry).toContain("404");
      expect(entry).toContain("/api/items/PRODUCT/:id");
      expect(entry).not.toContain("clh1234567890abcdefghijk");
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  test("logs validation failures as 400 and successes as 200", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const failing = apiHandler(async () => {
        z.object({ n: z.number() }).parse({ n: "bad" });
        return new Response("unreachable");
      });
      const badResponse = await failing(new Request("http://localhost/api/search"), {} as never);
      expect(badResponse.status).toBe(400);
      expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain("400");

      const succeeding = apiHandler(async () => new Response("ok"));
      const goodResponse = await succeeding(new Request("http://localhost/api/search"), {} as never);
      expect(goodResponse.status).toBe(200);
      expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain("200");
    } finally {
      log.mockRestore();
    }
  });
});
