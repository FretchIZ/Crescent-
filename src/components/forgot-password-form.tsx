"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {message ? (
        <div className="max-w-md rounded-lg border border-line bg-panel p-4 text-sm text-ink">
          {message}
        </div>
      ) : null}
      <AuthForm
        action="/api/auth/forgot-password"
        fields={[
          {
            label: "Email",
            type: "email",
            name: "email",
            placeholder: "you@example.com",
            icon: <Mail className="h-4 w-4" />,
          },
        ]}
        submitLabel="Send reset link"
        onSuccess={(data) =>
          setMessage(data?.message ?? "If an account exists, a reset link has been sent.")
        }
        switchText="Remembered your password?"
        switchLink="/login"
        switchLabel="Sign in"
      />
    </div>
  );
}
