"use client";

import Link from "next/link";
import { Lock, Mail, User } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export function RegisterForm() {
  return (
    <>
      <AuthForm
        action="/api/auth/register"
        fields={[
          {
            label: "Full name",
            type: "text",
            name: "name",
            placeholder: "Maria Santos",
            icon: <User className="h-4 w-4" />,
          },
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
            placeholder: "At least 8 characters",
            icon: <Lock className="h-4 w-4" />,
          },
        ]}
        submitLabel="Create account"
        onSuccess={() => {
          window.location.href = "/";
        }}
        switchText="Already have an account?"
        switchLink="/login"
        switchLabel="Sign in"
      />

      <div className="max-w-md border-t border-line pt-4 text-xs text-muted">
        <p className="mb-2">By creating an account you agree to our Terms and Privacy Policy.</p>
        <div className="flex gap-2">
          <Link href="/terms" className="link">Terms of service</Link>
          <Link href="/privacy" className="link">Privacy policy</Link>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          A verification email will be sent to your address. In development, the link is logged to the server console.
        </p>
      </div>
    </>
  );
}
