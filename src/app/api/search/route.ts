import { apiHandler, clientIp, jsonOk, readJson } from "@/lib/api";
import { searchSchema } from "@/lib/validation";
import { getCurrentUser, ensureVisitorId } from "@/lib/auth/session";
import { runSearch } from "@/lib/ai/search";
import { getFavoriteKeySet, toPublicItem } from "@/lib/items";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = apiHandler(async (request) => {
  const user = await getCurrentUser();
  const ip = clientIp(request);
  enforceRateLimit(`search:${user?.id ?? ip}`, 30, 60 * 1000);

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
