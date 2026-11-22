import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/auth/session";
import { exposeDevLink, resetEmail, sendMail, verificationEmail } from "@/lib/mailer";

/**
 * One active token per (user, purpose). Deriving the token from a server-side
 * HMAC makes concurrent "resend" requests converge on the same row via upsert,
 * so neither caller invalidates the other's link.
 */
function purposeToken(purpose: "verify" | "reset", userId: string): string {
  const secret = env.SESSION_SECRET ?? "development-only-secret";
  return createHmac("sha256", secret).update(`${purpose}:${userId}`).digest("hex");
}

export async function issueEmailVerification(user: { id: string; email: string; name: string }) {
  const token = purposeToken("verify", user.id);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  await db.$transaction([
    // Retire legacy random tokens from an older deployment, if any.
    db.emailVerificationToken.deleteMany({
      where: { userId: user.id, usedAt: null, tokenHash: { not: tokenHash } },
    }),
    db.emailVerificationToken.upsert({
      where: { tokenHash },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { expiresAt, usedAt: null },
    }),
  ]);
  const link = `${env.APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const message = verificationEmail(user.name, link);
  const result = await sendMail({ to: user.email, ...message });
  return { delivered: result.delivered, devLink: exposeDevLink() ? link : undefined };
}

export async function issuePasswordReset(user: { id: string; email: string; name: string }) {
  const token = purposeToken("reset", user.id);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  await db.$transaction([
    db.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null, tokenHash: { not: tokenHash } },
    }),
    db.passwordResetToken.upsert({
      where: { tokenHash },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { expiresAt, usedAt: null },
    }),
  ]);
  const link = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const message = resetEmail(user.name, link);
  const result = await sendMail({ to: user.email, ...message });
  return { delivered: result.delivered, devLink: exposeDevLink() ? link : undefined };
}
