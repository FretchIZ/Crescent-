"use client";

import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/input";

type FieldSpec = { label: string; name: string; type: string; placeholder: string };

function TokenForm({
  action,
  token,
  fields,
  submitLabel,
  successTitle,
  successMessage,
  missingMessage,
}: {
  action: string;
  token: string;
  fields: FieldSpec[];
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  missingMessage: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="This link is incomplete"
        description={missingMessage}
        action={
          <Link href="/forgot-password" className="text-sm font-semibold text-accent-ink hover:underline">
            Request a new link
          </Link>
        }
      />
    );
  }

  if (done) {
    return (
      <div className="surface max-w-md p-6">
        <h2 className="text-lg font-semibold">{successTitle}</h2>
        <p className="mt-2 text-sm text-muted">{successMessage}</p>
        <Link href="/login" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-ink hover:underline">
          Continue to sign in <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (values.password !== values.confirmPassword && fields.some((f) => f.name === "confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const payload: Record<string, string> = { token };
      for (const field of fields) {
        if (field.name !== "confirmPassword") payload[field.name] = values[field.name] ?? "";
      }
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.message ?? "This link is invalid or has expired.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4 surface p-6">
      {error ? (
        <div className="rounded-lg border border-[#f3c6c6] bg-[#fdf3f3] p-3 text-sm text-[#8f1d1d]">
          {error}
        </div>
      ) : null}
      {fields.map((field) => (
        <Field key={field.name} label={field.label}>
          <Input
            type={field.type}
            name={field.name}
            value={values[field.name] ?? ""}
            onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
            placeholder={field.placeholder}
            autoComplete={field.name === "password" ? "new-password" : undefined}
            required
          />
        </Field>
      ))}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <ChevronRight className="h-4 w-4 animate-spin" /> : null} {submitLabel}
      </Button>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  return (
    <TokenForm
      action="/api/auth/verify-email"
      token={token}
      fields={[]}
      submitLabel="Verify email"
      successTitle="Email verified"
      successMessage="Your email address is verified. You can now use all account features."
      missingMessage="Open the verification link from your email to confirm your address."
    />
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <TokenForm
      action="/api/auth/reset-password"
      token={token}
      fields={[
        { label: "New password", name: "password", type: "password", placeholder: "At least 8 characters" },
        { label: "Confirm password", name: "confirmPassword", type: "password", placeholder: "Repeat your new password" },
      ]}
      submitLabel="Set new password"
      successTitle="Password updated"
      successMessage="Your password has been changed. Sign in with your new password."
      missingMessage="Open the reset link from your email, or request a new one."
    />
  );
}
