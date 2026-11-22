"use client";

import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { safeRedirectPath } from "@/lib/utils";

export function LoginForm({ next }: { next?: string }) {
  return (
    <>
      <AuthForm
        action="/api/auth/login"
        fields={[
          {
            label: "Email",
            type: "email",
            name: "email",
            placeholder: "you@example.com",
            icon: <Mail className="h-4 w-4" />,
          },
          {
            label: "Password",
            type: "password",
            name: "password",
            placeholder: "Your password",
            icon: <Lock className="h-4 w-4" />,
          },
        ]}
        submitLabel="Sign in"
        onSuccess={() => {
          window.location.href = safeRedirectPath(next);
        }}
        switchText="Don't have an account?"
        switchLink="/register"
        switchLabel="Create account"
      />

      <div className="max-w-md flex items-center justify-between text-xs text-muted">
        <Link href="/forgot-password" className="link">
          Forgot your password?
        </Link>
        <span className="text-xs font-semibold uppercase tracking-wider">Brandmark</span>
      </div>
    </>
  );
}
