"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Props = {
  itemType: "PRODUCT" | "SERVICE";
  itemId: string;
  initialFavorited: boolean;
  variant?: "icon" | "button";
  className?: string;
  label?: boolean;
};

export function FavoriteButton({
  itemType,
  itemId,
  initialFavorited,
  variant = "icon",
  className,
  label = false,
}: Props) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !favorited;
    setFavorited(next);
    try {
      const response = next
        ? await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemType, itemId }),
          })
        : await fetch(`/api/favorites?itemType=${itemType}&itemId=${encodeURIComponent(itemId)}`, {
            method: "DELETE",
          });

      if (response.status === 401) {
        setFavorited(!next);
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!response.ok) {
        setFavorited(!next);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setFavorited(!next);
    } finally {
      setBusy(false);
    }
  }

  const Icon = favorited ? BookmarkCheck : Bookmark;

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={favorited}
        aria-label={favorited ? "Remove from saved items" : "Save this item"}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-panel px-4 text-sm font-semibold transition hover:border-ink/25 hover:bg-canvas disabled:opacity-60",
          favorited && "border-accent/25 bg-accent-soft text-accent-ink",
          className
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        {label ? (favorited ? "Saved" : "Save") : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorited}
      aria-label={favorited ? "Remove from saved items" : "Save this item"}
      title={favorited ? "Remove from saved items" : "Save this item"}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full border border-line bg-panel/95 text-muted shadow-sm backdrop-blur transition hover:text-ink",
        favorited && "border-accent/20 text-accent",
        className
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className={cn("h-4 w-4", favorited && "fill-accent/15")} />}
    </button>
  );
}
