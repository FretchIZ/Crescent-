import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/auth/session";
import { exposeDevLink, resetEmail, sendMail, verificationEmail } from "@/lib/mailer";

export async function issueEmailVerification(user: { id: string; email: string; name: string }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    db.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt },
    }),
  ]);
  const link = `${env.APP_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const message = verificationEmail(user.name, link);
  const result = await sendMail({ to: user.email, ...message });
  return { delivered: result.delivered, devLink: exposeDevLink() ? link : undefined };
}

export async function issuePasswordReset(user: { id: string; email: string; name: string }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt },
    }),
  ]);
  const link = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const message = resetEmail(user.name, link);
  const result = await sendMail({ to: user.email, ...message });
  return { delivered: result.delivered, devLink: exposeDevLink() ? link : undefined };
}
