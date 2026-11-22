import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { execSync } from "node:child_process";

// Dedicated database so catalog-cache tests never race with api.test.ts.
const CACHE_DB_URL = "file:./prisma/cache-test.db";
;(process.env as Record<string, string>).DATABASE_URL = CACHE_DB_URL;
;(process.env as Record<string, string>).NODE_ENV = "test";
;(process.env as Record<string, string>).SESSION_SECRET =
  "test-secret-key-that-is-at-least-32-chars-long!!!";

type Db = typeof import("@/lib/db").db;
let db: Db;
const j = JSON.stringify;

beforeAll(async () => {
  execSync("npx prisma db push --skip-generate --force-reset", {
    env: { ...(process.env as Record<string, string>), DATABASE_URL: CACHE_DB_URL, NODE_ENV: "test" },
    stdio: "ignore",
  });
  ({ db } = await import("@/lib/db"));

  const category = await db.category.create({
    data: { slug: "home-garden", name: "Home & Garden", kind: "BOTH", sortOrder: 0 },
  });
  const seller = await db.seller.create({
    data: { slug: "green-thumb", name: "Green Thumb Nursery", verified: true },
  });
  const common = {
    currency: "PHP",
    categoryId: category.id,
    sellerId: seller.id,
    imageUrl: "/placeholder.svg",
    ratingAvg: 4.5,
    ratingCount: 10,
    availability: "IN_STOCK",
    location: "Manila",
    verified: true,
    descriptionSource: "PROVIDER",
  };
  await db.product.create({
    data: {
      ...common,
      slug: "terracotta-pot",
      name: "Terracotta Plant Pot",
      summary: "Classic terracotta pot for houseplants",
      description: "An unglazed terracotta pot for herbs and succulents.",
      priceCents: 250,
      tags: j(["garden", "pot", "terracotta"]),
      attributes: j({ material: "terracotta" }),
    },
  });
  await db.product.create({
    data: {
      ...common,
      slug: "snake-plant",
      name: "Snake Plant",
      summary: "Easy-care indoor snake plant",
      description: "A hardy snake plant that thrives in low light.",
      priceCents: 350,
      tags: j(["plant", "indoor", "air-purifying"]),
      attributes: j({ care: "low" }),
    },
  });
  await db.service.create({
    data: {
      ...common,
      slug: "garden-consultation",
      name: "Garden Consultation",
      summary: "30-minute garden design consultation",
      description: "Book a consultation with a garden design expert.",
      priceCents: 1000,
      priceUnit: "session",
      tags: j(["garden", "consultation", "design"]),
      attributes: j({}),
      deliveryMode: "ONSITE",
      durationMinutes: 30,
    },
  });
});

afterAll(async () => {
  const { __resetKvForTests, __setKvClockForTests } = await import("@/lib/kv");
  const { __resetSearchCacheForTests, __setSearchCacheClockForTests } = await import("@/lib/search-cache");
  const { __setCatalogClockForTests } = await import("@/lib/items");
  const { __resetCatalogVersionForTests } = await import("@/lib/catalog-version");
  __setKvClockForTests(Date.now);
  __setSearchCacheClockForTests(Date.now);
  __setCatalogClockForTests(Date.now);
  __resetKvForTests();
  __resetSearchCacheForTests();
  __resetCatalogVersionForTests();
  await db?.$disconnect();
});

describe("Catalog snapshot cache", () => {
  test("warm loads avoid Postgres and reuse precomputed vectors", async () => {
    const { loadCatalog } = await import("@/lib/items");
    const spy = vi.spyOn(db.product, "findMany");

    const cold = await loadCatalog();
    expect(cold.length).toBe(3);
    expect(cold[0]!.lexicalVector?.length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledTimes(1);

    await loadCatalog();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  test("expires after the TTL and refreshes on write invalidation", async () => {
    const { loadCatalog, invalidateCatalog, __setCatalogClockForTests } = await import("@/lib/items");
    const { __setKvClockForTests } = await import("@/lib/kv");
    const spy = vi.spyOn(db.product, "findMany");
    await invalidateCatalog(); // discard snapshot left by the previous test
    let now = Date.now();
    __setCatalogClockForTests(() => now);
    __setKvClockForTests(() => now);

    await loadCatalog();
    expect(spy).toHaveBeenCalledTimes(1);

    now += 121_000; // past both the 15 s in-memory TTL and 120 s KV snapshot TTL
    await loadCatalog();
    expect(spy).toHaveBeenCalledTimes(2);

    await invalidateCatalog();
    await loadCatalog();
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});

describe("GET /api/search", () => {
  test("returns CDN cache headers, hits the cache, and writes no history", async () => {
    const { GET } = await import("@/app/api/search/route");
    const request = new Request("http://localhost/api/search?q=garden%20pot");
    const started = Date.now();
    const cold = await GET(request, { params: Promise.resolve({}) } as never);
    const coldMs = Date.now() - started;
    expect(cold.headers.get("x-cache")).toBe("MISS");
    expect(cold.headers.get("cache-control")).toBe("public, s-maxage=30, stale-while-revalidate=120");
    expect((await cold.json()).data.items.length).toBeGreaterThan(0);
    expect(await db.searchQuery.count()).toBe(0);

    const warmStarted = Date.now();
    const warm = await GET(
      new Request("http://localhost/api/search?q=GARDEN   POT"),
      { params: Promise.resolve({}) } as never
    );
    const warmMs = Date.now() - warmStarted;
    expect(warm.headers.get("x-cache")).toBe("HIT");
    expect(warm.headers.get("cache-control")).toBe("public, s-maxage=30, stale-while-revalidate=120");
    expect(await db.searchQuery.count()).toBe(0);

    console.log(
      `[benchmark] /api/search cold=${coldMs}ms warm=${warmMs}ms (cache hit; lower is better)`
    );
  });

  test("catalog writes invalidate cached search results via the versioned key", async () => {
    const { getCatalogVersion } = await import("@/lib/catalog-version");
    const {
      searchCacheKey,
      setCachedSearch,
      getCachedSearch,
      __resetSearchCacheForTests,
    } = await import("@/lib/search-cache");
    const { invalidateCatalog } = await import("@/lib/items");
    const params = new URLSearchParams("q=garden pot");

    const version = await getCatalogVersion();
    const key = searchCacheKey(params, version);
    await setCachedSearch(key, JSON.stringify({ ok: true, data: { stale: true } }));
    expect(await getCachedSearch(key)).toContain("stale");

    await invalidateCatalog();
    const newVersion = await getCatalogVersion();
    expect(Number(newVersion)).toBeGreaterThan(Number(version));

    const newKey = searchCacheKey(params, newVersion);
    expect(newKey).not.toBe(key);
    expect(await getCachedSearch(newKey)).toBeNull();

    __resetSearchCacheForTests();
  });
});
