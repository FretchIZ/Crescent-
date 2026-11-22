import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Request a password reset link for your Brandmark account.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <header className="max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Reset your password</h1>
        <p className="mt-1 text-sm text-muted">
          Enter the email address on your account. We&apos;ll send a link that expires in 30 minutes.
        </p>
      </header>
      <ForgotPasswordForm />
    </div>
  );
}
