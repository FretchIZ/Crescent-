import { apiHandler, jsonOk, readJson, ApiError, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { favoriteSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/session";
import { getItemBySlugOrId, toPublicItem } from "@/lib/items";
import { enforceRateLimit, hashRateKey } from "@/lib/rate-limit";
import type { ItemType } from "@/lib/constants";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  const favorites = await db.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { itemType: true, itemId: true, createdAt: true },
  });

  const items = await Promise.all(
    favorites.map(async (favorite) => {
      const item = await getItemBySlugOrId(favorite.itemType as ItemType, favorite.itemId);
      return item ? { ...toPublicItem(item, true), savedAt: favorite.createdAt.toISOString() } : null;
    })
  );

  return jsonOk({ items: items.filter(Boolean), count: favorites.length });
});

export const POST = apiHandler(async (request) => {
  const user = await requireUser();
  await enforceRateLimit(`favorite:${user.id}:${hashRateKey(clientIp(request) ?? "unknown")}`, 60, 60 * 1000);
  const body = await readJson(request, favoriteSchema);

  const item = await getItemBySlugOrId(body.itemType as ItemType, body.itemId);
  if (!item) throw new ApiError(404, "That item is no longer available", "not_found");

  await db.favorite.upsert({
    where: { userId_itemType_itemId: { userId: user.id, itemType: body.itemType, itemId: item.id } },
    update: {},
    create: { userId: user.id, itemType: body.itemType, itemId: item.id },
  });

  return jsonOk({ favorited: true, itemId: item.id });
});

export const DELETE = apiHandler(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const itemType = url.searchParams.get("itemType");
  const itemId = url.searchParams.get("itemId");
  if (!itemType || !itemId) throw new ApiError(422, "itemType and itemId are required", "validation_error");

  await db.favorite.deleteMany({ where: { userId: user.id, itemType, itemId } });
  return jsonOk({ favorited: false, itemId });
});
