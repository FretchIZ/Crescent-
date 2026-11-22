import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";

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

      <RegisterForm />
    </div>
  );
}
