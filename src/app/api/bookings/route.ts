import { apiHandler, jsonOk, readJson, ApiError, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/session";
import { enforceRateLimit, hashRateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const GET = apiHandler(async () => {
  const user = await requireUser();
  const bookings = await db.booking.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      service: {
        select: {
          slug: true,
          name: true,
          imageUrl: true,
          priceCents: true,
          priceUnit: true,
          currency: true,
          location: true,
          seller: { select: { name: true } },
        },
      },
    },
  });

  return jsonOk({
    bookings: bookings.map((booking) => ({
      id: booking.id,
      status: booking.status,
      preferredAt: booking.preferredAt.toISOString(),
      notes: booking.notes,
      createdAt: booking.createdAt.toISOString(),
      service: {
        slug: booking.service.slug,
        name: booking.service.name,
        imageUrl: booking.service.imageUrl,
        priceCents: booking.service.priceCents,
        priceUnit: booking.service.priceUnit,
        currency: booking.service.currency,
        location: booking.service.location,
        seller: booking.service.seller.name,
      },
    })),
  });
});

export const POST = apiHandler(async (request) => {
  const user = await requireUser();
  await enforceRateLimit(`booking:${user.id}:${hashRateKey(clientIp(request) ?? "unknown")}`, 10, 60 * 60 * 1000);
  const body = await readJson(request, bookingSchema);

  const service = await db.service.findFirst({
    where: { OR: [{ id: body.serviceId }, { slug: body.serviceId }], isActive: true },
    select: { id: true, availability: true, sellerId: true },
  });
  if (!service) throw new ApiError(404, "That service is no longer available", "not_found");
  if (service.availability === "UNAVAILABLE") {
    throw new ApiError(409, "This provider is not accepting bookings right now.", "unavailable");
  }

  const idempotencyKey =
    request.headers.get("idempotency-key")?.trim() || body.idempotencyKey || undefined;

  if (idempotencyKey) {
    const existing = await db.booking.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true, preferredAt: true },
    });
    if (existing) {
      return jsonOk({ booking: { ...existing, preferredAt: existing.preferredAt.toISOString() } });
    }
  }

  const data = {
    userId: user.id,
    serviceId: service.id,
    preferredAt: body.preferredAt,
    notes: body.notes?.trim() || null,
    status: "PENDING",
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
  const select = { id: true, status: true, preferredAt: true } as const;

  let booking: { id: string; status: string; preferredAt: Date };
  try {
    booking = await db.booking.create({ data, select });
  } catch (error) {
    // Two concurrent retries with the same key: the loser reads the winner.
    const uniqueViolation = (error as { code?: string }).code === "P2002";
    if (!idempotencyKey || !uniqueViolation) throw error;
    const raced = await db.booking.findUnique({ where: { idempotencyKey }, select });
    if (!raced) throw error;
    booking = raced;
  }

  await audit({ actorId: user.id, action: "booking.create", entityType: "Booking", entityId: booking.id, request });
  return jsonOk({ booking: { ...booking, preferredAt: booking.preferredAt.toISOString() } }, { status: 201 });
});
