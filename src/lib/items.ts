import { db } from "@/lib/db";
import { parseJson, isStringArray, isStringRecord } from "@/lib/utils";
import { buildSearchText } from "@/lib/search-text";
import type { ItemType } from "@/lib/constants";
import { kvGet, kvSet } from "@/lib/kv";
import { bumpCatalogVersion, getCatalogVersion } from "@/lib/catalog-version";
import { revalidateCatalogTag } from "@/lib/revalidate";
import { clearCachedSearch } from "@/lib/search-cache";
import { prepareRankingVectors } from "@/lib/ai/rank";

export { buildSearchText };

export type CatalogItem = {
  id: string;
  type: ItemType;
  slug: string;
  name: string;
  summary: string;
  description: string;
  priceCents: number;
  priceUnit?: string;
  currency: string;
  imageUrl: string;
  images: string[];
  attributes: Record<string, string>;
  tags: string[];
  brand?: string;
  category: { slug: string; name: string };
  seller: { id: string; slug: string; name: string; verified: boolean; location: string | null };
  ratingAvg: number;
  ratingCount: number;
  availability: string;
  location: string | null;
  deliveryMode?: string;
  durationMinutes?: number | null;
  nextAvailableAt?: Date | null;
  deliveryOptions?: string[];
  verified: boolean;
  descriptionSource: string;
  sourceUrl: string | null;
  isFeatured: boolean;
  createdAt: Date;
  href: string;
};

export type RankedItem = CatalogItem & {
  searchText: string;
  embedding: number[] | null;
  /** Precomputed at catalog snapshot build time; serialized as [token, weight][]. */
  lexicalVector?: Array<[string, number]>;
  matchScore: number;
  matchReasons: string[];
  explanation: string;
};

export type PublicItem = Omit<CatalogItem, "createdAt"> & {
  createdAt: string;
  matchScore: number;
  matchReasons: string[];
  explanation: string;
  favorited?: boolean;
};

/** Public serialization: strips internal searchText/embedding vectors. */
export function toPublicItem(item: CatalogItem | RankedItem, favorited = false): PublicItem {
  const ranked = item as RankedItem;
  return {
    id: item.id,
    type: item.type,
    slug: item.slug,
    name: item.name,
    summary: item.summary,
    description: item.description,
    priceCents: item.priceCents,
    priceUnit: item.priceUnit,
    currency: item.currency,
    imageUrl: item.imageUrl,
    images: item.images,
    attributes: item.attributes,
    tags: item.tags,
    brand: item.brand,
    category: item.category,
    seller: item.seller,
    ratingAvg: item.ratingAvg,
    ratingCount: item.ratingCount,
    availability: item.availability,
    location: item.location,
    deliveryMode: item.deliveryMode,
    durationMinutes: item.durationMinutes ?? null,
    nextAvailableAt: item.nextAvailableAt ?? null,
    deliveryOptions: item.deliveryOptions,
    verified: item.verified,
    descriptionSource: item.descriptionSource,
    sourceUrl: item.sourceUrl,
    isFeatured: item.isFeatured,
    createdAt: item.createdAt.toISOString(),
    href: item.href,
    matchScore: ranked.matchScore ?? 0,
    matchReasons: ranked.matchReasons ?? [],
    explanation: ranked.explanation ?? "",
    favorited,
  };
}

export const productSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  priceCents: true,
  currency: true,
  brand: true,
  imageUrl: true,
  images: true,
  attributes: true,
  tags: true,
  ratingAvg: true,
  ratingCount: true,
  availability: true,
  location: true,
  deliveryOptions: true,
  verified: true,
  descriptionSource: true,
  sourceUrl: true,
  isFeatured: true,
  createdAt: true,
  searchText: true,
  embedding: true,
  category: { select: { slug: true, name: true } },
  seller: { select: { id: true, slug: true, name: true, verified: true, location: true } },
} as const;

export const serviceSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  priceCents: true,
  priceUnit: true,
  currency: true,
  imageUrl: true,
  images: true,
  attributes: true,
  tags: true,
  ratingAvg: true,
  ratingCount: true,
  availability: true,
  location: true,
  deliveryMode: true,
  durationMinutes: true,
  nextAvailableAt: true,
  verified: true,
  descriptionSource: true,
  sourceUrl: true,
  isFeatured: true,
  createdAt: true,
  searchText: true,
  embedding: true,
  category: { select: { slug: true, name: true } },
  seller: { select: { id: true, slug: true, name: true, verified: true, location: true } },
} as const;

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  priceCents: number;
  currency: string;
  brand: string | null;
  imageUrl: string;
  images: string;
  attributes: string;
  tags: string;
  ratingAvg: number;
  ratingCount: number;
  availability: string;
  location: string | null;
  deliveryOptions: string;
  verified: boolean;
  descriptionSource: string;
  sourceUrl: string | null;
  isFeatured: boolean;
  createdAt: Date;
  searchText: string | null;
  embedding: string | null;
  category: { slug: string; name: string };
  seller: { id: string; slug: string; name: string; verified: boolean; location: string | null };
};

type ServiceRow = Omit<ProductRow, "brand" | "deliveryOptions"> & {
  priceUnit: string | null;
  deliveryMode: string;
  durationMinutes: number | null;
  nextAvailableAt: Date | null;
};

function toProduct(row: ProductRow): RankedItem {
  return {
    id: row.id,
    type: "PRODUCT",
    slug: row.slug,
    name: row.name,
    summary: row.summary ?? row.description.slice(0, 150),
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    imageUrl: row.imageUrl,
    images: parseJson<string[]>(row.images, [], isStringArray),
    attributes: parseJson<Record<string, string>>(row.attributes, {}, isStringRecord),
    tags: parseJson<string[]>(row.tags, [], isStringArray),
    brand: row.brand ?? undefined,
    category: row.category,
    seller: row.seller,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    availability: row.availability,
    location: row.location,
    deliveryOptions: parseJson<string[]>(row.deliveryOptions, [], isStringArray),
    verified: row.verified,
    descriptionSource: row.descriptionSource,
    sourceUrl: row.sourceUrl,
    isFeatured: row.isFeatured,
    createdAt: row.createdAt,
    href: `/item/product/${row.slug}`,
    searchText: row.searchText ?? "",
    embedding: parseJson<number[] | null>(row.embedding, null, (v): v is number[] =>
      Array.isArray(v) && v.every((n) => typeof n === "number")
    ),
    matchScore: 0,
    matchReasons: [],
    explanation: "",
  };
}

function toService(row: ServiceRow): RankedItem {
  return {
    id: row.id,
    type: "SERVICE",
    slug: row.slug,
    name: row.name,
    summary: row.summary ?? row.description.slice(0, 150),
    description: row.description,
    priceCents: row.priceCents,
    priceUnit: row.priceUnit ?? undefined,
    currency: row.currency,
    imageUrl: row.imageUrl,
    images: parseJson<string[]>(row.images, [], isStringArray),
    attributes: parseJson<Record<string, string>>(row.attributes, {}, isStringRecord),
    tags: parseJson<string[]>(row.tags, [], isStringArray),
    category: row.category,
    seller: row.seller,
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    availability: row.availability,
    location: row.location,
    deliveryMode: row.deliveryMode,
    durationMinutes: row.durationMinutes,
    nextAvailableAt: row.nextAvailableAt,
    verified: row.verified,
    descriptionSource: row.descriptionSource,
    sourceUrl: row.sourceUrl,
    isFeatured: row.isFeatured,
    createdAt: row.createdAt,
    href: `/item/service/${row.slug}`,
    searchText: row.searchText ?? "",
    embedding: parseJson<number[] | null>(row.embedding, null, (v): v is number[] =>
      Array.isArray(v) && v.every((n) => typeof n === "number")
    ),
    matchScore: 0,
    matchReasons: [],
    explanation: "",
  };
}

export { getCatalogVersion };
const SNAPSHOT_TTL_MS = 15_000; // in-memory TTL (5–30 s target)
const SNAPSHOT_KV_TTL_SEC = 120; // distributed copy; version bump invalidates sooner

type Snapshot = { version: string; items: RankedItem[]; expiresAt: number };
let memorySnapshot: Snapshot | null = null;
let snapshotClock: () => number = Date.now;

/** Test-only hook for deterministic TTL checks. */
export function __setCatalogClockForTests(fn: () => number): void {
  snapshotClock = fn;
}

/** Authoritative read — used only on a snapshot miss. */
export async function fetchCatalogFromDb(): Promise<RankedItem[]> {
  const [products, services] = await Promise.all([
    db.product.findMany({ where: { isActive: true }, select: productSelect }),
    db.service.findMany({ where: { isActive: true }, select: serviceSelect }),
  ]);
  return prepareRankingVectors([...products.map(toProduct), ...services.map(toService)]);
}

function reviveSnapshot(json: string): RankedItem[] {
  const items = JSON.parse(json) as RankedItem[];
  return items.map((item) => ({
    ...item,
    createdAt: new Date(item.createdAt),
    nextAvailableAt: item.nextAvailableAt ? new Date(item.nextAvailableAt) : item.nextAvailableAt,
  }));
}

/**
 * Warm reads return a module-level snapshot (sub-millisecond ranking). Cold or
 * stale reads hydrate from KV once, then from Postgres, and precompute lexical
 * vectors a single time per snapshot.
 */
export async function loadCatalog(): Promise<RankedItem[]> {
  const version = await getCatalogVersion();
  const now = snapshotClock();
  if (memorySnapshot && memorySnapshot.version === version && memorySnapshot.expiresAt > now) {
    return memorySnapshot.items;
  }

  const key = `catalog:snapshot:${version}`;
  const cached = await kvGet(key);
  if (cached) {
    const items = reviveSnapshot(cached);
    memorySnapshot = { version, items, expiresAt: now + SNAPSHOT_TTL_MS };
    return items;
  }

  const items = await fetchCatalogFromDb();
  await kvSet(key, JSON.stringify(items), SNAPSHOT_KV_TTL_SEC);
  memorySnapshot = { version, items, expiresAt: snapshotClock() + SNAPSHOT_TTL_MS };
  return items;
}

/** Call after any catalog/category/seller write (admin, feed ingest, seed). */
export async function invalidateCatalog(): Promise<void> {
  await bumpCatalogVersion();
  memorySnapshot = null;
  clearCachedSearch();
  await revalidateCatalogTag();
}

export type CatalogFilters = {
  q?: string;
  type?: ItemType | "ALL";
  category?: string;
  seller?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  location?: string;
  availability?: string;
  delivery?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export async function listCatalog(filters: CatalogFilters): Promise<{
  items: RankedItem[];
  total: number;
  page: number;
  pageSize: number;
  categories: Array<{ slug: string; name: string; count: number }>;
  brands: Array<{ name: string; count: number }>;
  locations: Array<{ name: string; count: number }>;
  priceRange: { min: number; max: number };
}> {
  const all = await loadCatalog();
  let filtered = all;

  if (filters.type && filters.type !== "ALL") filtered = filtered.filter((item) => item.type === filters.type);
  if (filters.category) filtered = filtered.filter((item) => item.category.slug === filters.category);
  if (filters.seller) filtered = filtered.filter((item) => item.seller.slug === filters.seller);
  if (filters.brand) filtered = filtered.filter((item) => item.brand === filters.brand);
  if (filters.minPrice !== undefined) filtered = filtered.filter((item) => item.priceCents / 100 >= filters.minPrice!);
  if (filters.maxPrice !== undefined) filtered = filtered.filter((item) => item.priceCents / 100 <= filters.maxPrice!);
  if (filters.minRating !== undefined) filtered = filtered.filter((item) => item.ratingAvg >= filters.minRating!);
  if (filters.location) filtered = filtered.filter((item) => (item.location ?? "").toLowerCase().includes(filters.location!.toLowerCase()));
  if (filters.availability) filtered = filtered.filter((item) => item.availability === filters.availability);
  if (filters.delivery === "online") {
    filtered = filtered.filter((item) => item.deliveryMode === "ONLINE" || item.deliveryMode === "BOTH" || item.deliveryOptions?.includes("Delivery"));
  }
  if (filters.delivery === "onsite") {
    filtered = filtered.filter((item) => item.deliveryMode === "ONSITE" || item.deliveryMode === "BOTH" || item.deliveryOptions?.includes("Pickup"));
  }
  if (filters.q && filters.q.trim()) {
    const query = filters.q.toLowerCase();
    filtered = filtered.filter((item) =>
      `${item.name} ${item.summary} ${item.tags.join(" ")} ${item.category.name} ${item.seller.name} ${item.brand ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }

  const sort = filters.sort ?? "relevance";
  filtered.sort((a, b) => {
    if (sort === "price_asc") return a.priceCents - b.priceCents;
    if (sort === "price_desc") return b.priceCents - a.priceCents;
    if (sort === "rating") return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
    if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
    return Number(b.isFeatured) - Number(a.isFeatured) || b.ratingAvg - a.ratingAvg;
  });

  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 48);
  const page = Math.max(filters.page ?? 1, 1);
  const total = filtered.length;
  const items = filtered.slice((page - 1) * pageSize, page * pageSize).map((item) => ({
    ...item,
    matchScore: 0,
    matchReasons: [],
    explanation: "",
  }));

  const categoryCounts = new Map<string, { name: string; count: number }>();
  const brandCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  for (const item of all) {
    if (filters.type && filters.type !== "ALL" && item.type !== filters.type) continue;
    const category = categoryCounts.get(item.category.slug) ?? { name: item.category.name, count: 0 };
    category.count += 1;
    categoryCounts.set(item.category.slug, category);
    if (item.brand) brandCounts.set(item.brand, (brandCounts.get(item.brand) ?? 0) + 1);
    if (item.location) locationCounts.set(item.location, (locationCounts.get(item.location) ?? 0) + 1);
  }

  const prices = all.map((item) => item.priceCents / 100);
  return {
    items,
    total,
    page,
    pageSize,
    categories: [...categoryCounts.entries()]
      .map(([slug, value]) => ({ slug, name: value.name, count: value.count }))
      .sort((a, b) => b.count - a.count),
    brands: [...brandCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    locations: [...locationCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    priceRange: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  };
}

export async function getItemBySlugOrId(type: ItemType, idOrSlug: string): Promise<RankedItem | null> {
  if (type === "PRODUCT") {
    const row = await db.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true },
      select: productSelect,
    });
    return row ? toProduct(row) : null;
  }
  const row = await db.service.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true },
    select: serviceSelect,
  });
  return row ? toService(row) : null;
}

export async function getRelatedItems(item: RankedItem, limit = 4): Promise<CatalogItem[]> {
  const all = await loadCatalog();
  const sameCategory = all.filter((candidate) => candidate.id !== item.id && candidate.category.slug === item.category.slug);
  const pool = sameCategory.length >= limit ? sameCategory : [...sameCategory, ...all.filter((c) => c.id !== item.id && c.category.slug !== item.category.slug)];
  return pool
    .sort((a, b) => {
      const shared = (candidate: CatalogItem) =>
        candidate.tags.filter((tag) => item.tags.includes(tag)).length + (candidate.seller.slug === item.seller.slug ? 1 : 0);
      return shared(b) - shared(a) || b.ratingAvg - a.ratingAvg;
    })
    .slice(0, limit);
}

export async function getFavoriteKeySet(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const favorites = await db.favorite.findMany({ where: { userId }, select: { itemType: true, itemId: true } });
  return new Set(favorites.map((favorite) => `${favorite.itemType}:${favorite.itemId}`));
}

export async function recordView(params: {
  viewerKey: string;
  userId?: string;
  itemType: ItemType;
  itemId: string;
}) {
  await db.itemView.upsert({
    where: {
      viewerKey_itemType_itemId: {
        viewerKey: params.viewerKey,
        itemType: params.itemType,
        itemId: params.itemId,
      },
    },
    update: { viewedAt: new Date() },
    create: {
      viewerKey: params.viewerKey,
      userId: params.userId ?? null,
      itemType: params.itemType,
      itemId: params.itemId,
    },
  });
  // Keep the per-viewer history bounded.
  const extra = await db.itemView.findMany({
    where: { viewerKey: params.viewerKey },
    orderBy: { viewedAt: "desc" },
    skip: 50,
    select: { id: true },
  });
  if (extra.length > 0) {
    await db.itemView.deleteMany({ where: { id: { in: extra.map((row) => row.id) } } });
  }
}

export async function getRecentlyViewed(viewerKey: string, limit = 6): Promise<RankedItem[]> {
  const views = await db.itemView.findMany({
    where: { viewerKey },
    orderBy: { viewedAt: "desc" },
    take: limit,
    select: { itemType: true, itemId: true },
  });
  const items = await Promise.all(
    views.map((view) => getItemBySlugOrId(view.itemType as ItemType, view.itemId))
  );
  return items.filter((item): item is RankedItem => Boolean(item));
}

export async function getFeaturedItems(limit = 6): Promise<RankedItem[]> {
  const all = await loadCatalog();
  return all
    .filter((item) => item.isFeatured)
    .sort((a, b) => b.ratingAvg - a.ratingAvg)
    .slice(0, limit);
}

export async function getCategoryCounts(): Promise<Array<{ slug: string; name: string; description: string | null; kind: string; icon: string; count: number }>> {
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true, services: true } } },
  });
  return categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    description: category.description,
    kind: category.kind,
    icon: category.icon,
    count: category._count.products + category._count.services,
  }));
}
