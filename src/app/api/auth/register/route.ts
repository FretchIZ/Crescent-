import { apiHandler, clientIp, jsonOk, readJson, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { issueEmailVerification } from "@/lib/auth/tokens";
import { enforceRateLimit, hashRateKey } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const POST = apiHandler(async (request) => {
  await enforceRateLimit(`register:${hashRateKey(clientIp(request) ?? "unknown")}`, 8, 60 * 60 * 1000);
  const body = await readJson(request, registerSchema);

  const existing = await db.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists. Try signing in instead.", "email_taken");
  }

  const passwordHash = await hashPassword(body.password);
  const user = await db.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash,
      role: "CUSTOMER",
      profile: { create: {} },
    },
    select: { id: true, email: true, name: true, role: true, emailVerified: true, createdAt: true },
  });

  const verification = await issueEmailVerification({ id: user.id, email: user.email, name: user.name });
  await createSession(user.id, request.headers.get("user-agent"), clientIp(request));
  await audit({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id, request });

  return jsonOk({ user, emailVerification: verification }, { status: 201 });
});
