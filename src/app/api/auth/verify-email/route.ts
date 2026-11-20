import { apiHandler, jsonOk, readJson, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyEmailSchema } from "@/lib/validation";
import { sha256 } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const POST = apiHandler(async (request) => {
  const { token } = await readJson(request, verifyEmailSchema);

  const record = await db.emailVerificationToken.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { emailVerified: true } } },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "This verification link is invalid or has expired.", "invalid_token");
  }

  if (!record.user.emailVerified) {
    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
      db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    await audit({ actorId: record.userId, action: "auth.email_verified", request });
  } else {
    await db.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  }

  return jsonOk({ verified: true });
});
