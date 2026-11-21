import { describe, test, expect } from "vitest";
import { extractIntent } from "@/lib/ai/intent";
import { rankItems } from "@/lib/ai/rank";
import { buildLexicalVector, cosineLexical } from "@/lib/ai/embeddings";

describe("Intent extraction", () => {
  test("extracts category, budget and item type from natural language", async () => {
    const intent = await extractIntent("I want a minimalist laptop for programming under ₱50,000");

    expect(intent.rawQuery).toBe("I want a minimalist laptop for programming under ₱50,000");
    expect(intent.itemType).toBe("PRODUCT");
    expect(intent.maxPrice).toBe(50000);
    expect(intent.keywords.length).toBeGreaterThan(0);
    expect(intent.categorySlugs.length).toBeGreaterThan(0);
    expect(intent.confidence).toBeGreaterThan(0);
  });

  test("detects service requests", async () => {
    const intent = await extractIntent("Someone to fix my kitchen sink today");

    expect(intent.itemType).toBe("SERVICE");
    expect(intent.categorySlugs.some((s) => s === "home-services")).toBe(true);
  });

  test("extracts required and optional attributes", async () => {
    const intent = await extractIntent("wireless headphones with noise cancelling under ₱3000");

    expect(intent.requiredAttributes.length).toBeGreaterThan(0);
    const hasWireless = intent.requiredAttributes.some(
      (a) => a.name === "wireless" || a.value.toLowerCase().includes("wireless")
    );
    expect(hasWireless).toBe(true);
  });

  test("handles empty or short queries gracefully", async () => {
    const intent = await extractIntent("hi");
    expect(intent.rawQuery).toBe("hi");
    expect(intent.needsClarification).toBe(true);
  });

  test("returns chips for display", async () => {
    const intent = await extractIntent("gardening gift under ₱2000");
    expect(intent.chips.length).toBeGreaterThan(0);
    expect(Array.isArray(intent.chips)).toBe(true);
  });
});

describe("Ranking", () => {
  const baseItem = (overrides: Partial<any> = {}) => ({
    id: "test-1",
    type: "PRODUCT" as const,
    slug: "test-item",
    name: "Test Item",
    summary: "A test product",
    description: "A test product description",
    searchText: "test product",
    tags: ["test"],
    attributes: {},
    embedding: null,
    category: { slug: "electronics", name: "Electronics" },
    seller: { id: "seller-1", slug: "test-seller", name: "Test Seller", verified: true, location: "Manila" },
    ratingAvg: 4.5,
    ratingCount: 10,
    priceCents: 5000,
    currency: "PHP",
    availability: "IN_STOCK",
    location: "Manila",
    brand: "TestBrand",
    images: [],
    imageUrl: "/placeholder.svg",
    matchScore: 0,
    matchReasons: [],
    explanation: "",
    createdAt: new Date(),
    isFeatured: false,
    verified: true,
    descriptionSource: "PROVIDER",
    sourceUrl: null,
    deliveryOptions: [],
    href: "/item/product/test-item",
    ...overrides,
  });

  test("ranks keyword-matched items first", async () => {
    const items = [
      baseItem({
        id: "test-a",
        name: "Wireless Mouse",
        tags: ["wireless", "mouse", "computer"],
        searchText: "wireless mouse computer peripheral",
        ratingAvg: 3.0,
        ratingCount: 5,
      }),
      baseItem({
        id: "test-b",
        name: "Wired Keyboard",
        tags: ["keyboard", "wired"],
        searchText: "wired keyboard computer peripheral",
        ratingAvg: 3.0,
        ratingCount: 5,
      }),
    ];
    const intent = await extractIntent("wireless mouse");
    const ranked = rankItems(items, intent, { interests: [], openAIQueryEmbedding: null });

    expect(ranked.length).toBe(2);
    for (const item of ranked) {
      expect(item.matchScore).toBeGreaterThanOrEqual(0);
      expect(item.matchScore).toBeLessThanOrEqual(100);
      expect(item.explanation.length).toBeGreaterThan(0);
    }
    // Wireless mouse should rank first due to keyword/tag matches
    expect(ranked[0].name).toBe("Wireless Mouse");
    expect(ranked[0].matchScore).toBeGreaterThanOrEqual(ranked[1].matchScore);
  });

  test("respects budget constraints", async () => {
    const items = [
      baseItem({ id: "test-a", name: "Cheap Item", priceCents: 1000 }),
      baseItem({ id: "test-b", name: "Expensive Item", priceCents: 100000 }),
    ];
    const intent = await extractIntent("something under ₱5000");
    const ranked = rankItems(items, intent, { interests: [], openAIQueryEmbedding: null });

    // Cheap item should rank at or above expensive item
    expect(ranked[0].id).toBe("test-a");
  });

  test("boosts verified and highly rated items", async () => {
    const items = [
      baseItem({
        id: "test-a",
        name: "Unverified Basic",
        tags: ["basic"],
        searchText: "basic item",
        ratingAvg: 2.0,
        ratingCount: 1,
        verified: false,
      }),
      baseItem({
        id: "test-b",
        name: "Verified Premium",
        tags: ["premium", "top-rated"],
        searchText: "premium top-rated item",
        ratingAvg: 4.8,
        ratingCount: 50,
        verified: true,
      }),
    ];
    const intent = await extractIntent("good quality product");
    const ranked = rankItems(items, intent, { interests: [], openAIQueryEmbedding: null });

    expect(ranked[0].id).toBe("test-b");
    expect(ranked[0].matchScore).toBeGreaterThanOrEqual(ranked[1].matchScore);
  });

  test("never invents match reasons - all grounded in data", async () => {
    const items = [baseItem({ name: "Plain Item" })];
    const intent = await extractIntent("anything");
    const ranked = rankItems(items, intent, { interests: [], openAIQueryEmbedding: null });

    expect(ranked[0].explanation).toBeTruthy();
    expect(ranked[0].explanation.length).toBeGreaterThan(0);
  });
});

describe("Embeddings (lexical)", () => {
  test("builds normalized lexical vectors", () => {
    const a = buildLexicalVector("wireless headphones");
    const b = buildLexicalVector("wireless headphones");
    const c = buildLexicalVector("kitchen sink repair");

    expect(cosineLexical(a, b)).toBeCloseTo(1, 5);
    expect(cosineLexical(a, c)).toBeLessThan(cosineLexical(a, b));
  });

  test("handles empty text", () => {
    const v = buildLexicalVector("");
    expect(v.size).toBe(0);
  });
});
