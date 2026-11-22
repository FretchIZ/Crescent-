"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

type AuthFormProps = {
  action: string;
  fields: Array<{ label: string; type: string; name: string; placeholder: string; icon: React.ReactElement }>;
  submitLabel: string;
  onSuccess: (data: any) => void;
  switchText: string;
  switchLink: string;
  switchLabel: string;
};

export function AuthForm({
  action,
  fields,
  submitLabel,
  onSuccess,
  switchText,
  switchLink,
  switchLabel,
}: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      onSuccess(body.data ?? body);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4 surface p-6">
      {error && (
        <div className="rounded-lg border border-[#f3c6c6] bg-[#fdf3f3] p-3 text-sm text-[#8f1d1d]">
          {error}
        </div>
      )}
      {fields.map((field) => (
        <Field key={field.name} label={field.label}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              {field.icon}
            </span>
            <Input
              type={field.type}
              name={field.name}
              value={values[field.name] ?? ""}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              placeholder={field.placeholder}
              className="pl-10 bg-panel"
              required
            />
          </div>
        </Field>
      ))}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <ChevronRight className="h-4 w-4 animate-spin" /> : null} {submitLabel}
      </Button>
      <p className="text-xs text-muted">
        {switchText}{" "}
        <Link href={switchLink} className="link font-semibold">
          {switchLabel}
        </Link>
      </p>
    </form>
  );
}
