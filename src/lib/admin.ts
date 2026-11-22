import { db } from "@/lib/db";
import { parseJson } from "@/lib/utils";

/**
 * Shared admin dashboard data. Used by both the API route and the server
 * component so the server never needs to fetch its own relative URL (which
 * does not work outside the browser).
 */
export async function getAdminStats() {
  const [
    users,
    products,
    services,
    searches,
    favorites,
    bookings,
    reviews,
    recentSearches,
    recentAudit,
    recentUsers,
    roleCounts,
  ] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.service.count(),
    db.searchQuery.count(),
    db.favorite.count(),
    db.booking.count(),
    db.review.count(),
    db.searchQuery.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        queryText: true,
        resultCount: true,
        mode: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        metadata: true,
        actor: { select: { email: true, name: true } },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, role: true, createdAt: true, emailVerified: true },
    }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  return {
    totals: { users, products, services, searches, favorites, bookings, reviews },
    roles: roleCounts.map((row) => ({ role: row.role, count: row._count._all })),
    recentSearches: recentSearches.map((search) => ({
      ...search,
      createdAt: search.createdAt.toISOString(),
      userEmail: search.user?.email ?? "Guest",
    })),
    recentAudit: recentAudit.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      createdAt: log.createdAt.toISOString(),
      metadata: parseJson<Record<string, unknown>>(log.metadata, {}),
      actor: log.actor?.name ?? "System",
    })),
    recentUsers: recentUsers.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
  };
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
