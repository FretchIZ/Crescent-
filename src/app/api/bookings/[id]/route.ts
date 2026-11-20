import { apiHandler, jsonOk, readJson, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { bookingActionSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const PATCH = apiHandler(async (request, context) => {
  const user = await requireUser();
  const { id } = (await context.params) as { id: string };
  const { action } = await readJson(request, bookingActionSchema);

  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      service: { select: { seller: { select: { userId: true } } } },
    },
  });
  if (!booking) throw new ApiError(404, "Booking not found", "not_found");

  const isOwner = booking.userId === user.id;
  const isSeller = booking.service.seller.userId === user.id;
  const isAdmin = user.role === "ADMIN";

  if (action === "cancel") {
    if (!isOwner && !isAdmin) throw new ApiError(403, "You cannot cancel this booking", "forbidden");
    if (["CANCELLED", "COMPLETED"].includes(booking.status)) {
      throw new ApiError(409, "This booking can no longer be cancelled.", "invalid_state");
    }
  } else {
    if (!isSeller && !isAdmin) throw new ApiError(403, "Only the provider can update this booking", "forbidden");
    if (booking.status === "CANCELLED") throw new ApiError(409, "Cancelled bookings cannot be updated.", "invalid_state");
  }

  const nextStatus = action === "cancel" ? "CANCELLED" : action === "confirm" ? "CONFIRMED" : "COMPLETED";
  await db.booking.update({ where: { id }, data: { status: nextStatus } });
  await audit({
    actorId: user.id,
    action: `booking.${action}`,
    entityType: "Booking",
    entityId: booking.id,
    request,
  });

  return jsonOk({ id: booking.id, status: nextStatus });
});
