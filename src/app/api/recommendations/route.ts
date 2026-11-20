import { apiHandler, jsonOk } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { getFavoriteKeySet, getFeaturedItems, toPublicItem } from "@/lib/items";
import { getPersonalizedRecommendations } from "@/lib/ai/search";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  const items = user ? await getPersonalizedRecommendations(user.id) : await getFeaturedItems(6);
  const favorites = await getFavoriteKeySet(user?.id);
  return jsonOk({
    items: items.map((item) => toPublicItem(item, favorites.has(`${item.type}:${item.id}`))),
    personalized: Boolean(user),
  });
});
