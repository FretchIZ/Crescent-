import { apiHandler, clientIp, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { issueEmailVerification } from "@/lib/auth/tokens";
import { enforceRateLimit, hashRateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const POST = apiHandler(async (request) => {
  const user = await requireUser();
  await enforceRateLimit(`verify-resend:${user.id}:${hashRateKey(clientIp(request) ?? "unknown")}`, 3, 60 * 60 * 1000);

  if (user.emailVerified) {
    return jsonOk({ sent: false, message: "Your email is already verified." });
  }

  await issueEmailVerification(user);
  await audit({ actorId: user.id, action: "auth.verification_resent", request });

  return jsonOk({ sent: true, message: "A new verification link has been sent." });
});
