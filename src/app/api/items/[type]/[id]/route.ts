import { apiHandler, jsonOk, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { getItemBySlugOrId, getRelatedItems, getFavoriteKeySet, toPublicItem } from "@/lib/items";
import { getCurrentUser } from "@/lib/auth/session";
import { isItemType } from "@/lib/constants";

export const GET = apiHandler(async (request, context) => {
  const params = (await context.params) as { type: string; id: string };
  if (!isItemType(params.type)) throw new ApiError(404, "Item not found", "not_found");

  const item = await getItemBySlugOrId(params.type, params.id);
  if (!item) throw new ApiError(404, "Item not found", "not_found");

  const user = await getCurrentUser();
  const favorites = await getFavoriteKeySet(user?.id);
  const [reviews, related] = await Promise.all([
    db.review.findMany({
      where: params.type === "PRODUCT" ? { productId: item.id } : { serviceId: item.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        verifiedPurchase: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    getRelatedItems(item, 4),
  ]);

  return jsonOk({
    item: toPublicItem(item, favorites.has(`${item.type}:${item.id}`)),
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      verifiedPurchase: review.verifiedPurchase,
      createdAt: review.createdAt.toISOString(),
      author: review.user.name,
    })),
    related: related.map((entry) => toPublicItem(entry, favorites.has(`${entry.type}:${entry.id}`))),
  });
});
