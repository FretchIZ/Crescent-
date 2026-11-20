import { apiHandler, jsonOk, readJson, ApiError, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { reviewSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const POST = apiHandler(async (request) => {
  const user = await requireUser();
  enforceRateLimit(`review:${user.id}:${clientIp(request)}`, 5, 60 * 60 * 1000);
  const body = await readJson(request, reviewSchema);

  const item =
    body.itemType === "PRODUCT"
      ? await db.product.findFirst({ where: { OR: [{ id: body.itemId }, { slug: body.itemId }], isActive: true }, select: { id: true } })
      : await db.service.findFirst({ where: { OR: [{ id: body.itemId }, { slug: body.itemId }], isActive: true }, select: { id: true } });
  if (!item) throw new ApiError(404, "That item is no longer available", "not_found");

  const existing = await db.review.findFirst({
    where: {
      userId: user.id,
      ...(body.itemType === "PRODUCT" ? { productId: item.id } : { serviceId: item.id }),
    },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, "You have already reviewed this item.", "already_reviewed");

  const review = await db.review.create({
    data: {
      userId: user.id,
      productId: body.itemType === "PRODUCT" ? item.id : null,
      serviceId: body.itemType === "SERVICE" ? item.id : null,
      rating: body.rating,
      title: body.title?.trim() || null,
      body: body.body.trim(),
      // The platform cannot verify purchases yet; never claim otherwise.
      verifiedPurchase: false,
    },
    select: { id: true, rating: true, title: true, body: true, createdAt: true },
  });

  await audit({ actorId: user.id, action: "review.create", entityType: "Review", entityId: review.id, request });
  return jsonOk({ review: { ...review, createdAt: review.createdAt.toISOString() } }, { status: 201 });
});
