import { apiHandler, clientIp, jsonOk, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validation";
import { issuePasswordReset } from "@/lib/auth/tokens";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const POST = apiHandler(async (request) => {
  const ip = clientIp(request);
  enforceRateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
  const body = await readJson(request, forgotPasswordSchema);

  const user = await db.user.findUnique({
    where: { email: body.email },
    select: { id: true, email: true, name: true },
  });

  // Always return the same response to avoid account enumeration.
  let devLink: string | undefined;
  if (user) {
    const result = await issuePasswordReset(user);
    devLink = result.devLink;
    await audit({ actorId: user.id, action: "auth.password_reset_requested", request });
  }

  return jsonOk({
    message: "If an account exists for that email, a reset link has been sent.",
    ...(devLink ? { devLink } : {}),
  });
});
