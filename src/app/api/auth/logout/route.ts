import { apiHandler, jsonOk } from "@/lib/api";
import { destroyCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const POST = apiHandler(async (request) => {
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) await audit({ actorId: user.id, action: "auth.logout", request });
  return jsonOk({ signedOut: true });
});
