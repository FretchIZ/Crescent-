import { apiHandler, jsonOk, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const DELETE = apiHandler(async (request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const query = await db.searchQuery.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!query) throw new ApiError(404, "Search not found", "not_found");
    await db.searchQuery.delete({ where: { id } });
  } else {
    await db.$transaction([
      db.searchSession.deleteMany({ where: { userId: user.id } }),
      db.searchQuery.deleteMany({ where: { userId: user.id } }),
      db.recommendation.deleteMany({ where: { userId: user.id, source: "search" } }),
    ]);
  }

  await audit({ actorId: user.id, action: id ? "history.delete_one" : "history.clear", request });
  return jsonOk({ deleted: true });
});
