import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/token-forms";

export const metadata: Metadata = {
  title: "Verify email",
  description: "Confirm the email address on your Brandmark account.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="space-y-6">
      <header className="max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Verify your email</h1>
        <p className="mt-1 text-sm text-muted">
          Confirm this address to secure your account and enable password recovery.
        </p>
      </header>
      <VerifyEmailForm token={typeof token === "string" ? token : ""} />
    </div>
  );
}
