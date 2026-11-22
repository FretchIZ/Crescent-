import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth/session";
import { parseJson } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import type { ItemType, SortOption } from "@/lib/constants";
import { loadCatalog, type RankedItem } from "@/lib/items";
import {
  extractIntent,
  refineIntent,
  refinementSuggestions,
  CATEGORY_TO_INTEREST,
  type SearchIntent,
} from "@/lib/ai/intent";
import { rankItems } from "@/lib/ai/rank";
import { openAIEmbedding } from "@/lib/ai/embeddings";
import { aiEnabled } from "@/lib/env";

export type SearchFilters = {
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  category?: string;
  availability?: string;
  location?: string;
  brand?: string;
  delivery?: "online" | "onsite";
};

export type SearchParams = {
  query: string;
  sessionId?: string;
  itemType?: ItemType | "BOTH";
  filters?: SearchFilters;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  refine?: boolean;
  user?: SessionUser | null;
  visitorId?: string;
  /** CDN-cacheable GET requests skip all history/personalization writes. */
  persist?: boolean;
};

export type SearchFacets = {
  categories: Array<{ slug: string; name: string; count: number }>;
  brands: Array<{ name: string; count: number }>;
  locations: Array<{ name: string; count: number }>;
  availability: Array<{ value: string; count: number }>;
  priceRange: { min: number; max: number };
};

export type SearchResponse = {
  sessionId: string;
  queryId: string;
  intent: SearchIntent;
  items: RankedItem[];
  alternatives: RankedItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
  agent: {
    reply: string;
    steps: string[];
    suggestions: string[];
    clarification?: string;
  };
  mode: "local" | "openai";
  tookMs: number;
};

const REFINEMENT_PATTERN =
  /\b(cheaper|under|below|only|higher rated|better rated|near me|nearby|something else|different|show more|more options|this week|services only|products only|both)\b/i;

function isSearchIntent(value: unknown): value is SearchIntent {
  if (!value || typeof value !== "object") return false;
  const intent = value as Partial<SearchIntent>;
  return (
    typeof intent.rawQuery === "string" &&
    Array.isArray(intent.keywords) &&
    Array.isArray(intent.categorySlugs) &&
    Array.isArray(intent.requiredAttributes) &&
    Array.isArray(intent.optionalAttributes)
  );
}

function applyRequestFilters(items: RankedItem[], filters: SearchFilters | undefined): RankedItem[] {
  if (!filters) return items;
  return items.filter((item) => {
    const price = item.priceCents / 100;
    if (filters.minPrice !== undefined && price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && price > filters.maxPrice) return false;
    if (filters.minRating !== undefined && item.ratingAvg < filters.minRating) return false;
    if (filters.category && item.category.slug !== filters.category) return false;
    if (filters.availability && item.availability !== filters.availability) return false;
    if (filters.brand && item.brand !== filters.brand) return false;
    if (filters.location && !(item.location ?? "").toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.delivery === "online") {
      const online =
        item.deliveryMode === "ONLINE" ||
        item.deliveryMode === "BOTH" ||
        (item.deliveryOptions?.includes("Delivery") ?? false);
      if (!online) return false;
    }
    if (filters.delivery === "onsite") {
      const onsite =
        item.deliveryMode === "ONSITE" ||
        item.deliveryMode === "BOTH" ||
        (item.deliveryOptions?.includes("Pickup") ?? false);
      if (!onsite) return false;
    }
    return true;
  });
}

function buildFacets(items: RankedItem[]): SearchFacets {
  const categories = new Map<string, { name: string; count: number }>();
  const brands = new Map<string, number>();
  const locations = new Map<string, number>();
  const availability = new Map<string, number>();
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (const item of items) {
    const category = categories.get(item.category.slug) ?? { name: item.category.name, count: 0 };
    category.count += 1;
    categories.set(item.category.slug, category);
    if (item.brand) brands.set(item.brand, (brands.get(item.brand) ?? 0) + 1);
    if (item.location) locations.set(item.location, (locations.get(item.location) ?? 0) + 1);
    availability.set(item.availability, (availability.get(item.availability) ?? 0) + 1);
    const price = item.priceCents / 100;
    min = Math.min(min, price);
    max = Math.max(max, price);
  }

  return {
    categories: [...categories.entries()]
      .map(([slug, value]) => ({ slug, name: value.name, count: value.count }))
      .sort((a, b) => b.count - a.count),
    brands: [...brands.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    locations: [...locations.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    availability: [...availability.entries()].map(([value, count]) => ({ value, count })),
    priceRange: { min: Number.isFinite(min) ? min : 0, max },
  };
}

function constraintSummary(intent: SearchIntent, itemType: ItemType | "BOTH"): string {
  const parts: string[] = [];
  if (intent.categorySlugs.length > 0) parts.push(intent.categorySlugs.join(" / "));
  if (intent.maxPrice !== undefined) parts.push(`up to ${formatPrice(intent.maxPrice * 100)}`);
  if (intent.location) parts.push(`near ${intent.location}`);
  if (intent.requiredAttributes.length > 0) {
    parts.push(intent.requiredAttributes.map((a) => a.value.toLowerCase()).join(", "));
  }
  if (parts.length === 0) {
    return itemType === "BOTH" ? "across products and services" : itemType === "PRODUCT" ? "across products" : "across services";
  }
  return `using ${parts.join(", ")}`;
}

function buildAgentReply(params: {
  intent: SearchIntent;
  total: number;
  catalogSize: number;
  top: RankedItem | undefined;
  alternatives: RankedItem[];
  refined: boolean;
  itemType: ItemType | "BOTH";
}): string {
  const { intent, total, catalogSize, top, alternatives, refined, itemType } = params;
  const typeLabel = itemType === "BOTH" ? "products and services" : itemType === "PRODUCT" ? "products" : "services";

  if (total === 0) {
    const fallback =
      alternatives.length > 0
        ? ` The closest options I could find are ${alternatives
            .slice(0, 2)
            .map((item) => `${item.name} (${formatPrice(item.priceCents)})`)
            .join(" and ")} — slightly outside your filters.`
        : "";
    return `I checked all ${catalogSize} indexed ${typeLabel} and found nothing that matches every constraint.${fallback} Try widening the budget or removing an attribute, and I'll look again.`;
  }

  const topSentence = top
    ? `My top match is ${top.name} from ${top.seller.name} at ${formatPrice(top.priceCents)}${
        top.priceUnit ? ` ${top.priceUnit}` : ""
      } — ${top.matchReasons[0]?.toLowerCase() ?? "it fits your description"}.`
    : "";
  const refinementNote = refined ? " I kept the earlier context and updated only what you changed." : "";

  return `I checked ${catalogSize} indexed ${typeLabel} and kept ${total} that fit ${constraintSummary(
    intent,
    itemType
  )}.${refinementNote} ${topSentence} Match scores come from attribute fit, budget, ratings, and your saved interests — not from invented data.`;
}

/** Persist the search, its top results, and the conversation turn. */
async function persistSearch(params: {
  sessionId: string | null;
  userId?: string;
  visitorId?: string;
  query: string;
  intent: SearchIntent;
  items: RankedItem[];
  total: number;
  mode: "local" | "openai";
  durationMs: number;
  agentReply: string;
}): Promise<{ sessionId: string; queryId: string }> {
  let sessionId = params.sessionId;
  if (sessionId) {
    const existing = await db.searchSession.findFirst({
      where: {
        id: sessionId,
        ...(params.userId ? { userId: params.userId } : params.visitorId ? { visitorId: params.visitorId } : {}),
      },
      select: { id: true },
    });
    if (!existing) sessionId = null;
  }

  if (!sessionId) {
    const session = await db.searchSession.create({
      data: {
        userId: params.userId ?? null,
        visitorId: params.visitorId ?? null,
        title: params.query.slice(0, 120),
      },
      select: { id: true },
    });
    sessionId = session.id;
  } else {
    await db.searchSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date(), ...(params.userId ? {} : { visitorId: params.visitorId ?? null }) },
    });
  }

  const query = await db.searchQuery.create({
    data: {
      sessionId,
      userId: params.userId ?? null,
      queryText: params.query.slice(0, 500),
      intent: JSON.stringify(params.intent),
      resultCount: params.total,
      mode: params.mode,
      durationMs: Math.round(params.durationMs),
    },
    select: { id: true },
  });

  if (params.items.length > 0) {
    await db.searchResult.createMany({
      data: params.items.slice(0, 24).map((item, index) => ({
        searchQueryId: query.id,
        itemType: item.type,
        itemId: item.id,
        rank: index + 1,
        score: item.matchScore,
        explanation: item.explanation.slice(0, 500),
      })),
    });
  }

  await db.aIMessage.createMany({
    data: [
      { sessionId, role: "user", content: params.query.slice(0, 500), intent: JSON.stringify(params.intent) },
      { sessionId, role: "assistant", content: params.agentReply.slice(0, 2000) },
    ],
  });

  return { sessionId, queryId: query.id };
}

async function updatePersonalization(params: {
  userId: string;
  consent: boolean;
  intent: SearchIntent;
  items: RankedItem[];
}) {
  if (!params.consent) return;

  const topCategories = [...new Set(params.items.slice(0, 8).map((item) => item.category.slug))]
    .map((slug) => CATEGORY_TO_INTEREST[slug])
    .filter(Boolean)
    .slice(0, 3);

  const existing = await db.interest.findMany({ where: { userId: params.userId }, select: { label: true, weight: true } });
  const existingLabels = new Set(existing.map((interest) => interest.label.toLowerCase()));
  const newLabels = topCategories.filter((label) => !existingLabels.has(label.toLowerCase()));

  if (newLabels.length > 0) {
    const count = await db.interest.count({ where: { userId: params.userId } });
    if (count < 20) {
      await db.interest.createMany({
        data: newLabels.slice(0, Math.max(0, 20 - count)).map((label) => ({
          userId: params.userId,
          label,
          weight: 0.5,
          source: "inferred",
        })),
      });
    }
  }

  if (params.items.length > 0) {
    await db.recommendation.deleteMany({ where: { userId: params.userId, source: "search" } });
    await db.recommendation.createMany({
      data: params.items.slice(0, 6).map((item) => ({
        userId: params.userId,
        itemType: item.type,
        itemId: item.id,
        score: item.matchScore,
        reason: `From your search: “${params.intent.rawQuery.slice(0, 90)}”`,
        source: "search",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      })),
    });
    const stale = await db.recommendation.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: "desc" },
      skip: 30,
      select: { id: true },
    });
    if (stale.length > 0) {
      await db.recommendation.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
    }
  }
}

export async function runSearch(params: SearchParams): Promise<SearchResponse> {
  const started = Date.now();
  const query = params.query.trim();
  if (query.length < 3) {
    throw new ApiError(422, "Describe what you are looking for in a few words.", "query_too_short");
  }
  if (query.length > 500) {
    throw new ApiError(422, "Please keep your request under 500 characters.", "query_too_long");
  }

  const page = Math.min(Math.max(params.page ?? 1, 1), 50);
  const pageSize = Math.min(Math.max(params.pageSize ?? 12, 1), 48);

  // Resolve prior context for multi-turn refinement.
  let previousIntent: SearchIntent | null = null;
  if (params.sessionId) {
    const previous = await db.searchQuery.findFirst({
      where: {
        sessionId: params.sessionId,
        ...(params.user?.id ? { userId: params.user.id } : params.visitorId ? { session: { visitorId: params.visitorId } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { intent: true },
    });
    if (previous) {
      const parsed = parseJson<unknown>(previous.intent, null);
      if (isSearchIntent(parsed)) previousIntent = parsed;
    }
  }

  const isRefinement = Boolean(previousIntent) && (params.refine || REFINEMENT_PATTERN.test(query));
  const intent = isRefinement && previousIntent ? refineIntent(previousIntent, query) : await extractIntent(query);
  if (params.itemType && params.itemType !== "BOTH") intent.itemType = params.itemType;

  const user = params.user ?? null;
  let interests: string[] = [];
  let consent = false;
  if (user) {
    const [profile, savedInterests] = await Promise.all([
      db.userProfile.findUnique({ where: { userId: user.id }, select: { personalizationConsent: true } }),
      db.interest.findMany({ where: { userId: user.id }, select: { label: true, weight: true }, orderBy: { weight: "desc" } }),
    ]);
    consent = profile?.personalizationConsent ?? false;
    interests = consent ? savedInterests.map((interest) => interest.label) : [];
  }

  const catalog = await loadCatalog();
  const typeFiltered =
    intent.itemType === "PRODUCT"
      ? catalog.filter((item) => item.type === "PRODUCT")
      : intent.itemType === "SERVICE"
        ? catalog.filter((item) => item.type === "SERVICE")
        : catalog;

  let openAIQueryEmbedding: number[] | null = null;
  if (aiEnabled && catalog.some((item) => item.embedding && item.embedding.length > 64)) {
    openAIQueryEmbedding = await openAIEmbedding(query);
  }

  const ranked = rankItems(typeFiltered, intent, { interests, openAIQueryEmbedding });
  const filtered = applyRequestFilters(ranked, params.filters);

  if (intent.sort && params.sort === undefined) params.sort = intent.sort;
  const sort = params.sort ?? "relevance";
  if (sort !== "relevance") {
    filtered.sort((a, b) => {
      if (sort === "price_asc") return a.priceCents - b.priceCents;
      if (sort === "price_desc") return b.priceCents - a.priceCents;
      if (sort === "rating") return b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount;
      if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
      return b.matchScore - a.matchScore;
    });
  }

  const facets = buildFacets(ranked);
  const total = filtered.length;
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Graceful alternatives when constraints are too tight.
  let alternatives: RankedItem[] = [];
  if (total < 3) {
    const resultIds = new Set(filtered.map((item) => item.id));
    const relaxed = applyRequestFilters(ranked, {
      ...params.filters,
      maxPrice: undefined,
      minPrice: undefined,
      minRating: undefined,
      availability: undefined,
      delivery: undefined,
    }).filter((item) => !resultIds.has(item.id));
    alternatives = relaxed.slice(0, 4);
  }

  const agentReply = buildAgentReply({
    intent,
    total,
    catalogSize: catalog.length,
    top: pageItems[0] ?? filtered[0],
    alternatives,
    refined: isRefinement,
    itemType: intent.itemType,
  });

  const mode: "local" | "openai" = intent.mode;
  const shouldPersist = params.persist !== false;
  const persisted = shouldPersist
    ? await persistSearch({
        sessionId: params.sessionId ?? null,
        userId: user?.id,
        visitorId: params.visitorId,
        query,
        intent,
        items: filtered,
        total,
        mode,
        durationMs: Date.now() - started,
        agentReply,
      })
    : { sessionId: params.sessionId ?? `cache-${query.length}-${intent.keywords.length}`, queryId: "cache" };

  if (user && shouldPersist) {
    await updatePersonalization({ userId: user.id, consent, intent, items: filtered.slice(0, 12) });
  }

  const steps = [
    "Read your request",
    `Searched ${catalog.length} indexed items`,
    intent.maxPrice !== undefined || intent.requiredAttributes.length > 0 ? "Applied your constraints" : "Kept the search open",
    "Ranked by fit, budget, and verified ratings",
  ];

  return {
    sessionId: persisted.sessionId,
    queryId: persisted.queryId,
    intent,
    items: pageItems,
    alternatives,
    total,
    page,
    pageSize,
    facets,
    agent: {
      reply: agentReply,
      steps,
      suggestions: refinementSuggestions(intent),
      clarification: intent.clarification,
    },
    mode,
    tookMs: Date.now() - started,
  };
}

/** Read a user's recent searches for the history page. */
export async function getSearchHistory(userId: string, limit = 30) {
  const queries = await db.searchQuery.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      queryText: true,
      resultCount: true,
      mode: true,
      createdAt: true,
      sessionId: true,
      intent: true,
    },
  });
  return queries.map((query) => {
    const intent = parseJson<unknown>(query.intent, null);
    return {
      ...query,
      intent: isSearchIntent(intent) ? intent : null,
    };
  });
}

export async function getPersonalizedRecommendations(userId: string, limit = 6): Promise<RankedItem[]> {
  const rows = await db.recommendation.findMany({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: { itemType: true, itemId: true, reason: true },
  });

  if (rows.length === 0) {
    const { getFeaturedItems } = await import("@/lib/items");
    return getFeaturedItems(limit);
  }

  const { getItemBySlugOrId } = await import("@/lib/items");
  const items = await Promise.all(rows.map((row) => getItemBySlugOrId(row.itemType as ItemType, row.itemId)));
  return items
    .map((item, index) => (item ? { ...item, explanation: rows[index]!.reason } : null))
    .filter((item): item is RankedItem => Boolean(item));
}
