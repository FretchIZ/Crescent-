import { apiHandler, clientIp, jsonOk, readJson, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validation";
import { revokeAllSessions, sha256 } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { enforceRateLimit, hashRateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const POST = apiHandler(async (request) => {
  await enforceRateLimit(`reset:${hashRateKey(clientIp(request) ?? "unknown")}`, 10, 15 * 60 * 1000);
  const body = await readJson(request, resetPasswordSchema);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: sha256(body.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "This reset link is invalid or has expired. Request a new one.", "invalid_token");
  }

  const passwordHash = await hashPassword(body.password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  await revokeAllSessions(record.userId);

  await audit({ actorId: record.userId, action: "auth.password_reset", request });
  return jsonOk({ reset: true });
});
