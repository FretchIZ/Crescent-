import { apiHandler, ApiError, clientIp, jsonOk, readJson } from "@/lib/api";
import { searchSchema } from "@/lib/validation";
import { getCurrentUser, ensureVisitorId } from "@/lib/auth/session";
import { runSearch, type SearchFilters } from "@/lib/ai/search";
import { getFavoriteKeySet, toPublicItem } from "@/lib/items";
import { enforceRateLimit, hashRateKey } from "@/lib/rate-limit";
import {
  getCachedSearch,
  normalizeSearchQuery,
  searchCacheKey,
  SEARCH_CACHE_HEADERS,
  setCachedSearch,
} from "@/lib/search-cache";
import { SORT_VALUES, type ItemType, type SortOption } from "@/lib/constants";
import { getCatalogVersion } from "@/lib/catalog-version";

export const POST = apiHandler(async (request) => {
  const user = await getCurrentUser();
  const ip = clientIp(request);
  await enforceRateLimit(`search:${user?.id ?? hashRateKey(ip ?? "unknown")}`, 30, 60 * 1000);

  const body = await readJson(request, searchSchema);
  const visitorId = user ? undefined : await ensureVisitorId();

  const result = await runSearch({
    query: body.query,
    sessionId: body.sessionId,
    itemType: body.itemType,
    filters: body.filters,
    sort: body.sort,
    page: body.page,
    pageSize: body.pageSize,
    refine: body.refine,
    user,
    visitorId,
  });

  const favorites = await getFavoriteKeySet(user?.id);
  const isFavorite = (type: string, id: string) => favorites.has(`${type}:${id}`);

  return jsonOk({
    ...result,
    items: result.items.map((item) => toPublicItem(item, isFavorite(item.type, item.id))),
    alternatives: result.alternatives.map((item) => toPublicItem(item, isFavorite(item.type, item.id))),
  });
});

/**
 * Anonymous, CDN-cacheable search. Cache hits never touch Postgres, Redis or
 * the ranking engine; misses write no history/personalization rows.
 */
export const GET = apiHandler(async (request) => {
  const url = new URL(request.url);
  const key = searchCacheKey(url.searchParams, await getCatalogVersion());
  const hit = await getCachedSearch(key);
  if (hit) {
    return new Response(hit, {
      headers: { ...SEARCH_CACHE_HEADERS, "x-cache": "HIT" },
    });
  }

  await enforceRateLimit(`search:get:${hashRateKey(clientIp(request) ?? "unknown")}`, 30, 60_000);

  const params = normalizeSearchQuery(url.searchParams);
  if (params.q.length < 3) {
    throw new ApiError(422, "Describe what you are looking for in a few words.", "query_too_short");
  }
  if (params.q.length > 500) {
    throw new ApiError(422, "Please keep your request under 500 characters.", "query_too_long");
  }

  const itemType = (["PRODUCT", "SERVICE", "BOTH"] as const).find((value) => value === params.type?.toUpperCase());
  const sort = SORT_VALUES.find((value) => value === params.sort) as SortOption | undefined;
  const number = (name: string) => (params[name] === undefined ? undefined : Number(params[name]));
  const filters: SearchFilters = {
    ...(params.category ? { category: params.category } : {}),
    ...(params.brand ? { brand: params.brand } : {}),
    ...(params.location ? { location: params.location } : {}),
    ...(params.availability ? { availability: params.availability } : {}),
    ...(params.delivery === "online" || params.delivery === "onsite"
      ? { delivery: params.delivery }
      : {}),
    ...(number("minPrice") !== undefined ? { minPrice: number("minPrice") } : {}),
    ...(number("maxPrice") !== undefined ? { maxPrice: number("maxPrice") } : {}),
    ...(number("minRating") !== undefined ? { minRating: number("minRating") } : {}),
  };

  const result = await runSearch({
    query: params.q,
    itemType: itemType as ItemType | "BOTH" | undefined,
    filters,
    sort,
    page: number("page"),
    pageSize: number("pageSize"),
    user: null,
    persist: false,
  });
  const body = JSON.stringify({ ok: true, data: result });
  await setCachedSearch(key, body);
  return new Response(body, {
    headers: { ...SEARCH_CACHE_HEADERS, "x-cache": "MISS" },
  });
});
