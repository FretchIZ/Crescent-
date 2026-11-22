"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

export function ResendVerificationButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const body = await response.json().catch(() => null);
      setMessage(
        response.ok
          ? (body?.data?.message ?? "Verification link sent.")
          : (body?.error?.message ?? "Could not send a verification link.")
      );
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline disabled:opacity-50"
      >
        {busy ? "Sending…" : "Resend verification"} <ChevronRight className="h-3 w-3" />
      </button>
      {message ? <p className="mt-1 text-[11px] text-muted">{message}</p> : null}
    </div>
  );
}
