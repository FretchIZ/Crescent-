import { apiHandler, jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export const GET = apiHandler(async () => {
  const user = await getCurrentUser();
  if (!user) return jsonOk({ user: null, profile: null, stats: null });

  const [profile, favorites, searches, bookings, interests] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.favorite.count({ where: { userId: user.id } }),
    db.searchQuery.count({ where: { userId: user.id } }),
    db.booking.count({ where: { userId: user.id, status: { in: ["PENDING", "CONFIRMED"] } } }),
    db.interest.count({ where: { userId: user.id } }),
  ]);

  return jsonOk({
    user,
    profile,
    stats: { favorites, searches, activeBookings: bookings, interests },
  });
});
