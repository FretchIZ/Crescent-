import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { ApiError } from "@/lib/api";
import { isRole, type Role } from "@/lib/constants";

export const SESSION_COOKIE = "bm_session";
export const VISITOR_COOKIE = "bm_visitor";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashWithSecret(value: string): string {
  const secret = env.SESSION_SECRET ?? "development-only-secret";
  return createHmac("sha256", secret).update(value).digest("hex").slice(0, 32);
}

export function hashIp(ip: string): string {
  return hashWithSecret(`ip:${ip}`);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  createdAt: Date;
};

const SESSION_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

export async function createSession(userId: string, userAgent?: string | null, ip?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: userAgent?.slice(0, 250) ?? null,
      ipHash: ip ? hashIp(ip) : null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { token, expiresAt };
}

/** Cached per request so multiple components can ask for the user cheaply. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, expiresAt: true, user: { select: SESSION_SELECT } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const role = session.user.role;
  if (!isRole(role)) return null;
  return { ...session.user, role };
});

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function revokeAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please sign in to continue", "unauthenticated");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "You do not have access to this resource", "forbidden");
  }
  return user;
}

export async function getVisitorId(): Promise<string | null> {
  const store = await cookies();
  return store.get(VISITOR_COOKIE)?.value ?? null;
}

export async function ensureVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE)?.value;
  if (existing && /^[a-zA-Z0-9_-]{16,64}$/.test(existing)) return existing;
  const id = randomToken(18);
  store.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

/** Constant-time comparison helper for one-time tokens. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
