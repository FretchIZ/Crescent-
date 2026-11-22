# Scaling roadmap (Phase 4 & 5 hooks)

Phases 1–3 are implemented in code: pooled Postgres schema, Redis-backed rate
limits/session cache, and a versioned catalog snapshot with precomputed lexical
vectors plus CDN-cacheable anonymous search. The following are deliberately
left as documented hooks because they require product decisions or a data
migration.

## Phase 4 — SQL-side top-K with pgvector

Use when the active catalog grows beyond a few thousand items and ranking every
row in memory no longer fits the latency budget.

1. Enable `pgvector` on the managed Postgres instance and add a vector column
   (Prisma has no native vector type; use raw SQL for the column and queries):

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
   ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);
   CREATE INDEX CONCURRENTLY product_embedding_hnsw
     ON "Product" USING hnsw (embedding_vector vector_cosine_ops);
   CREATE INDEX CONCURRENTLY service_embedding_hnsw
     ON "Service" USING hnsw (embedding_vector vector_cosine_ops);
   ```

2. At ingest time, write the embedding to both `embedding` (JSON, used by the
   current code) and `embedding_vector` (SQL). Keep `searchText` for lexical
   fallback.
3. Replace the `loadCatalog()` + `rankItems()` pair in
   `src/lib/ai/search.ts` with a parameterized `SELECT ... ORDER BY embedding_vector
   <=> $1 LIMIT $topK`, then apply the existing filter/facet/agent layers to the
   top-K rows only.
4. Add a read replica for catalog reads once write volume affects read latency;
   route `db.product/service.findMany` and the vector query to the replica while
   keeping auth/writes on the primary.

The existing `RankedItem` shape and API response envelope do not need to change,
so this can be rolled out behind an env flag.

## Phase 5 — Frontend / edge speed

`src/app/layout.tsx` intentionally keeps `dynamic = "force-dynamic"` until the
data-heavy pages are converted; removing it alone would make Next.js attempt
build-time database reads with no database available.

1. Convert `/`, `/products`, `/services`, `/categories`, and
   `/item/[type]/[slug]` to fetch from the cached API/client layer instead of
   calling Prisma directly in the server component.
2. Then remove the root `force-dynamic` and add per-page:

   ```ts
   export const revalidate = 60;
   ```

   Keep `export const dynamic = "force-dynamic"` on `/search`, `/admin`,
   `/settings`, `/profile`, `/history`, `/saved`, and all `/auth/*` pages
   because they read cookies or per-user data.

3. `GET /api/items` and `GET /api/items/[type]/[id]` already return
   `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` for
   anonymous callers and `private, no-store` for signed-in callers.
4. Wrap review/related-item sections in `<Suspense>` with skeletons, and add
   `priority` to the first above-the-fold `next/image`.
5. Edge-runtime candidates: `GET /api/search` (KV + cached ranking), and
   `GET /api/items*` once Prisma is behind Neon HTTP or Prisma Accelerate. Keep
   write/auth routes on Node.js.
