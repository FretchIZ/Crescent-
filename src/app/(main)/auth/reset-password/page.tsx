import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/token-forms";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your Brandmark account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="space-y-6">
      <header className="max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted">
          Your reset link is valid for 30 minutes and can only be used once.
        </p>
      </header>
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </div>
  );
}
