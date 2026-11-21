"use client";

import { useEffect } from "react";

/** Fire-and-forget recently-viewed tracking. Failures never affect the page. */
export function RecordView({ itemType, itemId }: { itemType: "PRODUCT" | "SERVICE"; itemId: string }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType, itemId }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [itemType, itemId]);

  return null;
}
