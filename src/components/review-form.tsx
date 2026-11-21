"use client";

import { Loader2, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

export function ReviewForm({
  itemType,
  itemId,
  signedIn,
}: {
  itemType: "PRODUCT" | "SERVICE";
  itemId: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!signedIn) {
    return (
      <p className="text-xs text-muted">
        <Link href={`/login?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`} className="link">
          Sign in
        </Link>{" "}
        to write a review. Only real accounts can review.
      </p>
    );
  }

  if (done) {
    return <p className="text-xs font-medium text-good">Thanks — your review is published.</p>;
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PenLine className="h-3.5 w-3.5" /> Write a review
      </Button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId, rating, title: title.trim() || undefined, body: body.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) {
        setError(payload?.error?.message ?? "Could not publish the review.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-canvas p-4">
      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
        <Field label="Rating">
          <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className="field h-10 bg-panel">
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}★
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title (optional)">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} className="bg-panel" placeholder="Sum it up" />
        </Field>
      </div>
      <Field label="Your review" hint="At least 10 characters. Be specific and fair.">
        <Textarea
          required
          minLength={10}
          maxLength={1500}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-[96px] bg-panel"
          placeholder="What did you like or dislike?"
        />
      </Field>
      {error ? <p className="text-xs font-medium text-[#b91c1c]">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy || body.trim().length < 10}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Publish review
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
