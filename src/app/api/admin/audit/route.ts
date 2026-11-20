import { apiHandler, jsonOk } from "@/lib/api";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { paginationSchema } from "@/lib/validation";
import { parseJson } from "@/lib/utils";

export const GET = apiHandler(async (request) => {
  await requireRole("ADMIN");
  const url = new URL(request.url);
  const { page = 1, limit = 25 } = paginationSchema.parse(Object.fromEntries(url.searchParams.entries()));

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { email: true, name: true } },
      },
    }),
    db.auditLog.count(),
  ]);

  return jsonOk({
    total,
    page,
    limit,
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: parseJson<Record<string, unknown>>(log.metadata, {}),
      createdAt: log.createdAt.toISOString(),
      actor: log.actor?.name ?? "System",
      actorEmail: log.actor?.email ?? null,
    })),
  });
});
