import { env, emailEnabled, isProduction } from "@/lib/env";

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Email delivery abstraction.
 *
 * - With RESEND_API_KEY set, mail is delivered through Resend's HTTP API.
 * - Without it, the message (including verification links) is written to the
 *   server log so local development and self-hosted demos remain functional.
 *   Nothing is silently dropped.
 */
export async function sendMail(mail: Mail): Promise<{ delivered: boolean }> {
  if (!emailEnabled) {
    if (isProduction) {
      // Never print one-time links in production logs. Configure RESEND_API_KEY
      // (or swap this adapter for your provider) to deliver these messages.
      console.warn("[mail] no email provider configured — message not delivered", {
        to: mail.to,
        subject: mail.subject,
      });
    } else {
      console.info("[mail] (no email provider configured) →", {
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      });
    }
    return { delivered: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[mail] provider rejected message", response.status, detail.slice(0, 300));
      return { delivered: false };
    }
    return { delivered: true };
  } catch (error) {
    console.error("[mail] delivery failed", error instanceof Error ? error.message : error);
    return { delivered: false };
  }
}

export function verificationEmail(name: string, link: string) {
  return {
    subject: "Verify your Brandmark email",
    text: `Hi ${name},\n\nConfirm your email address to finish setting up Brandmark:\n${link}\n\nThis link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
  };
}

export function resetEmail(name: string, link: string) {
  return {
    subject: "Reset your Brandmark password",
    text: `Hi ${name},\n\nUse this link to choose a new password:\n${link}\n\nThis link expires in 30 minutes and can only be used once. If you didn't request it, no action is needed.`,
  };
}

/**
 * Development convenience: expose one-time links in API responses only when
 * there is no email provider and we are not in production.
 */
export function exposeDevLink(): boolean {
  return !emailEnabled && !isProduction;
}
