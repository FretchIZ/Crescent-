import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Lock, User } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your Brandmark account.",
};

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <header className="max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Create account</h1>
        <p className="mt-1 text-sm text-muted">
          Join Brandmark to save favorites, get personalized recommendations, and book services.
        </p>
      </header>

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
            placeholder: "••••••••",
            icon: <Lock className="h-4 w-4" />,
          },
        ]}
        submitLabel="Create account"
        onSuccess={(data: any) => {
          window.location.href = data.emailVerification ? "/verify-email" : "/";
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
    </div>
  );
}
