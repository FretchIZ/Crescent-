import { apiHandler, jsonOk } from "@/lib/api";
import { catalogQuerySchema } from "@/lib/validation";
import { listCatalog, getFavoriteKeySet, toPublicItem } from "@/lib/items";
import { getCurrentUser } from "@/lib/auth/session";
import type { SortOption } from "@/lib/constants";

export const GET = apiHandler(async (request) => {
  const url = new URL(request.url);
  const parsed = catalogQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  const user = await getCurrentUser();
  const favorites = await getFavoriteKeySet(user?.id);

  const result = await listCatalog({
    ...parsed,
    sort: parsed.sort as SortOption | undefined,
  });

  return jsonOk(
    {
      ...result,
      items: result.items.map((item) => toPublicItem(item, favorites.has(`${item.type}:${item.id}`))),
    },
    user
      ? { headers: { "Cache-Control": "private, no-store" } }
      : { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
});
