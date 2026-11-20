import { apiHandler, clientIp, jsonOk, readJson, ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/auth/session";

export const POST = apiHandler(async (request) => {
  const ip = clientIp(request);
  enforceRateLimit(`login:${ip}`, 20, 15 * 60 * 1000);

  const body = await readJson(request, loginSchema);
  enforceRateLimit(`login:email:${sha256(body.email).slice(0, 20)}`, 10, 15 * 60 * 1000);

  const user = await db.user.findUnique({
    where: { email: body.email },
    select: { id: true, email: true, name: true, role: true, emailVerified: true, passwordHash: true, createdAt: true },
  });

  const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
  if (!user || !valid) {
    await audit({
      actorId: user?.id ?? null,
      action: "auth.login_failed",
      metadata: { emailHash: sha256(body.email).slice(0, 16) },
      request,
    });
    throw new ApiError(401, "Email or password is incorrect.", "invalid_credentials");
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, request.headers.get("user-agent"), ip);
  await audit({ actorId: user.id, action: "auth.login", request });

  return jsonOk({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
  });
});
