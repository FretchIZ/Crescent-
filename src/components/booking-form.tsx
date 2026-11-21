"use client";

import { CalendarCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

function defaultSlot() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function BookingForm({
  serviceId,
  serviceName,
  signedIn,
}: {
  serviceId: string;
  serviceName: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [preferredAt, setPreferredAt] = useState(defaultSlot());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ id: string; preferredAt: string } | null>(null);

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-line bg-canvas p-4">
        <p className="text-sm font-semibold">Request this service</p>
        <p className="mt-1 text-xs text-muted">Sign in to send a booking request and track its status.</p>
        <div className="mt-3 flex gap-2">
          <Link href={`/login?next=${encodeURIComponent(window.location.pathname)}`} className="inline-flex h-9 items-center rounded-xl bg-accent px-3 text-xs font-semibold text-white">
            Sign in
          </Link>
          <Link href="/register" className="inline-flex h-9 items-center rounded-xl border border-line bg-panel px-3 text-xs font-semibold">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="rounded-xl border border-[#bbe3c9] bg-[#eef9f2] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-good">
          <CalendarCheck className="h-4 w-4" /> Request sent
        </p>
        <p className="mt-1 text-xs text-[#256b3f]">
          {serviceName} · {new Date(booked.preferredAt).toLocaleString("en-PH")}. The provider will confirm or decline.
        </p>
        <Link href="/profile" className="mt-2 inline-block text-xs font-semibold text-[#256b3f] underline">
          View your bookings
        </Link>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          preferredAt: new Date(preferredAt).toISOString(),
          notes: notes.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not send the request. Try another time.");
        return;
      }
      setBooked(body.data.booking);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const min = new Date(Date.now() + 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-canvas p-4">
      <p className="text-sm font-semibold">Request this service</p>
      <p className="mt-1 text-xs text-muted">Choose a preferred time. The provider confirms availability.</p>
      <div className="mt-3 space-y-3">
        <Field label="Preferred date & time">
          <Input
            type="datetime-local"
            required
            min={min}
            value={preferredAt}
            onChange={(event) => setPreferredAt(event.target.value)}
            className="bg-panel"
          />
        </Field>
        <Field label="Notes (optional)">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            placeholder="Anything the provider should know?"
            className="min-h-[72px] bg-panel"
          />
        </Field>
        {error ? <p className="text-xs font-medium text-[#b91c1c]">{error}</p> : null}
        <Button type="submit" disabled={busy || !preferredAt} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
          {busy ? "Sending…" : "Send request"}
        </Button>
      </div>
    </form>
  );
}
