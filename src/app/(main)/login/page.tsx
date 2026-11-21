import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Brandmark account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="space-y-6">
      <header className="max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back. Enter your email and password to continue.
        </p>
      </header>

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
            placeholder: "••••••••",
            icon: <Lock className="h-4 w-4" />,
          },
        ]}
        submitLabel="Sign in"
        onSuccess={() => {
          const nextUrl = next || "/";
          window.location.href = nextUrl;
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
    </div>
  );
}
