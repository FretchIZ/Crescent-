export const CATALOG_TAG = "catalog";

/**
 * Best-effort Next.js cache invalidation. Catalog writes call this after the
 * database commit; outside a Next request (seed scripts, tests) there is no
 * static-generation store, so the no-op is intentional.
 */
export async function revalidateCatalogTag(): Promise<void> {
  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(CATALOG_TAG);
  } catch {
    // No request-scoped cache to invalidate (CLI / test context).
  }
}
