import { apiHandler, jsonOk } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { getAdminStats } from "@/lib/admin";

export const GET = apiHandler(async () => {
  await requireRole("ADMIN");
  return jsonOk(await getAdminStats());
});
