import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

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

      <LoginForm next={typeof next === "string" ? next : undefined} />
    </div>
  );
}
