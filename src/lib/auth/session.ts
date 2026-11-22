import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env, isProduction } from "@/lib/env";
import { ApiError } from "@/lib/api";
import { isRole, type Role } from "@/lib/constants";
import { kvDel, kvGet, kvSet } from "@/lib/kv";

export const SESSION_COOKIE = "bm_session";
export const VISITOR_COOKIE = "bm_visitor";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_CACHE_TTL_SEC = 60;
const REVOCATION_TTL_SEC = 60 * 60 * 24 * 31;

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

type CachedUser = Omit<SessionUser, "createdAt"> & { createdAt: string };

type CachedSession = {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  user: CachedUser;
};

// Cache keys only ever contain hashes or opaque IDs — never the raw cookie.
const cacheKey = (tokenHash: string) => `session:cache:${tokenHash}`;
const revokeKey = (tokenHash: string) => `session:revoke:${tokenHash}`;
const userRevokeKey = (userId: string) => `session:urevoke:${userId}`;

export async function createSession(userId: string, userAgent?: string | null, ip?: string | null) {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await db.session.create({
    data: {
      userId,
      tokenHash,
      userAgent: userAgent?.slice(0, 250) ?? null,
      ipHash: ip ? hashIp(ip) : null,
      expiresAt,
    },
    select: { id: true, createdAt: true },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  // Seed the cache at login so the next request never needs a DB lookup.
  const profile = await db.user.findUnique({ where: { id: userId }, select: SESSION_SELECT });
  if (profile && isRole(profile.role)) {
    await kvSet(
      cacheKey(tokenHash),
      JSON.stringify({
        sessionId: session.id,
        createdAt: session.createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        user: { ...profile, role: profile.role, createdAt: profile.createdAt.toISOString() },
      } satisfies CachedSession),
      SESSION_CACHE_TTL_SEC
    );
  }
  return { token, expiresAt };
}

/** Cached per request so multiple components can ask for the user cheaply. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);
  const [revoked, cachedRaw] = await Promise.all([kvGet(revokeKey(tokenHash)), kvGet(cacheKey(tokenHash))]);

  if (revoked) return null;

  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as CachedSession;
      const userRevokedAt = await kvGet(userRevokeKey(cached.user.id));
      const notRevoked =
        !userRevokedAt ||
        Number.isNaN(Date.parse(userRevokedAt)) ||
        new Date(userRevokedAt).getTime() < Date.parse(cached.createdAt);
      if (
        notRevoked &&
        Date.parse(cached.expiresAt) > Date.now() &&
        isRole(cached.user.role)
      ) {
        return { ...cached.user, role: cached.user.role, createdAt: new Date(cached.user.createdAt) };
      }
    } catch {
      // Corrupt cache entry: fall through to the authoritative database.
    }
    await kvDel(cacheKey(tokenHash));
  }

  const session = await db.session.findUnique({
    where: { tokenHash },
    select: { id: true, expiresAt: true, createdAt: true, userId: true, user: { select: SESSION_SELECT } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const role = session.user.role;
  if (!isRole(role)) return null;

  const user: SessionUser = { ...session.user, role };
  const userRevokedAt = await kvGet(userRevokeKey(user.id));
  if (userRevokedAt && !Number.isNaN(Date.parse(userRevokedAt)) && Date.parse(userRevokedAt) >= session.createdAt.getTime()) {
    return null;
  }

  await kvSet(
    cacheKey(tokenHash),
    JSON.stringify({
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      user: { ...user, createdAt: user.createdAt.toISOString() },
    } satisfies CachedSession),
    SESSION_CACHE_TTL_SEC
  );
  return user;
});

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = sha256(token);
    await Promise.all([
      db.session.deleteMany({ where: { tokenHash } }),
      // Revocation is checked before the cache, so logout is immediate even
      // when another instance still holds the cached session payload.
      kvSet(revokeKey(tokenHash), "1", REVOCATION_TTL_SEC),
      kvDel(cacheKey(tokenHash)),
    ]);
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Delete every DB session and invalidate all cached sessions for a user. */
export async function revokeAllSessions(userId: string) {
  await Promise.all([
    db.session.deleteMany({ where: { userId } }),
    kvSet(userRevokeKey(userId), String(Date.now()), REVOCATION_TTL_SEC),
  ]);
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
