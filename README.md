# Brandmark — AI Product & Service Discovery

Brandmark is an AI-powered discovery platform for products and services. It turns a natural-language request into a structured search intent, ranks a unified product/service catalog against that intent, and supports conversational refinement, favorites, personalized recommendations, and service bookings.

This repository currently contains the **application backend** (Next.js App Router API + Prisma data layer) plus the seeded demo catalog. A browser UI can be layered on top of the same endpoints.

## Stack

- **Next.js 15** (App Router, route handlers)
- **TypeScript** (strict)
- **Prisma 6** + SQLite for local development (PostgreSQL-ready schema)
- **Zod** for request validation
- **bcryptjs** password hashing, hashed session + one-time tokens
- **Vitest** for tests

## Features

- **Natural-language search** with local intent extraction (category, budget, attributes, item type) and optional OpenAI embeddings when a key is configured.
- **Unified catalog** of products and services with filters (price, rating, category, brand, location, availability, delivery) and facets.
- **Conversational refinement** — follow-up queries refine the previous intent within a search session.
- **Personalization** — saved interests, search-derived interests, and generated recommendations.
- **Accounts** — register, login, logout, email verification, password reset, session revocation.
- **Favorites** for products and services.
- **Bookings** — request a service, provider confirms/completes, customer cancels.
- **Reviews** — one review per user per item, with explicit `verifiedPurchase` handling.
- **Admin** — platform stats and an append-only audit trail.
- **Security** — rate limiting, hashed tokens/IPs, role guards, uniform JSON error envelopes, security headers.

## Getting started

```bash
npm install
cp .env.example .env        # then set SESSION_SECRET
npm run db:setup            # prisma db push + seed
npm run dev                 # http://localhost:3000
```

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Demo accounts (seeded, development only)

| Role | Email | Password |
| --- | --- | --- |
| Customer | `demo@brandmark.local` | `DemoPass123!` |
| Seller | `seller@brandmark.local` | `SellerPass123!` |
| Admin | `admin@brandmark.local` | `AdminPass123!` |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Prisma generate (SQLite) + production build |
| `npm run build:vercel` | Prisma generate (PostgreSQL schema) + production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:push` | Sync schema to the database |
| `npm run db:seed` | Seed the demo catalog |
| `npm run db:setup` | Push + seed |
| `npm run db:studio` | Prisma Studio |

## API

All endpoints live under `/api` and share a JSON envelope:

```json
{ "ok": true, "data": { } }
{ "ok": false, "error": { "code": "invalid_credentials", "message": "…" } }
```

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification`; `GET /api/auth/me` |
| Health | `GET /api/health`, `GET /health` |
| Catalog | `GET /api/items`, `GET /api/items/[type]/[id]` |
| Search | `POST /api/search` |
| Discovery | `GET /api/recommendations` |
| Account | `GET/PUT /api/preferences`, `PUT /api/profile` |
| Engagement | `GET/POST/DELETE /api/favorites`, `POST /api/reviews`, `GET/POST /api/bookings`, `PATCH /api/bookings/[id]` |
| History | `DELETE /api/history` |
| Admin | `GET /api/admin/stats`, `GET /api/admin/audit` |

## Configuration

See `.env.example`. Locally, only `DATABASE_URL` is required; in production,
`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` and Redis/KV credentials are required:

- `OPENAI_API_KEY` — enables embeddings for semantic ranking; without it the built-in local engine is used.
- `RESEND_API_KEY` — enables transactional email; without it, verification/reset links are logged in development.

## Deployment (Vercel)

The local schema uses SQLite; Vercel uses a dedicated PostgreSQL schema so the
provider is never guessed at build time.

1. Import `FretchIZ/Crescent-` into Vercel. Framework: **Next.js**, build command
   `npm run build:vercel` (set in `vercel.json`), install command `npm ci`.
2. Provision PostgreSQL and Redis/KV, then set these **Environment Variables**
   for Production (and Preview if needed):
   - `DATABASE_URL` — **pooled** PostgreSQL URL (PgBouncer/Supavisor/Accelerate,
     `?pgbouncer=true`, `sslmode=require`) used by the application.
   - `DIRECT_URL` — direct (non-pooled) PostgreSQL URL, used only by migrations.
   - `SESSION_SECRET` — 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`); also signs derived email tokens.
   - `APP_URL` — the public deployment URL (used in emailed verification/reset links).
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_*`
     aliases) — distributed rate limits, session cache/revocation, catalog and
     search snapshots. **Required in production.**
   - Optional: `OPENAI_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`.
3. Create the production tables once: `npm run db:push:production` with the same
   `DATABASE_URL`/`DIRECT_URL`. Seeding the demo catalog is optional.
4. Deploy. Vercel Web Analytics and Speed Insights are wired in via the
   `@vercel/analytics` / `@vercel/speed-insights` App Router components.

Health probes are available at `GET /api/health` and `GET /health`. They return
`200` when Postgres **and** Redis/KV are reachable and `503` when degraded,
with a 3-second dependency timeout. `VERCEL_GIT_COMMIT_SHA` is reported as the
version. Without KV credentials, `/health` is intentionally degraded in
production (the process-local fallback is only for dev/test).

API requests are logged with method, redacted route, status and latency; page
requests are logged at the edge. Logs never contain credentials, cookies,
headers, query values or raw IPs. Rate-limit keys hash IPs.

### Read-path performance

- `loadCatalog()` serves warm searches from a 15-second in-process snapshot
  (backed by a versioned KV document), with lexical vectors precomputed once.
- Anonymous `GET /api/search?q=...` is CDN-cacheable (`s-maxage=30`,
  `stale-while-revalidate=120`) and writes no history/personalization rows.
- Catalog/admin/feed writes must call `invalidateCatalog()`; the seed script
  already does so. This bumps the KV version key and calls `revalidateTag`.
- Bookings accept an `Idempotency-Key` header; email tokens are deterministic
  per user/purpose and upserted, so concurrent requests cannot double-write.

See `docs/SCALING.md` for the pgvector/HNSW and ISR/Edge migration paths.

## Repository hygiene

`.env`, the local SQLite database, build output, dependencies, and the vendored Next.js tarball are intentionally ignored. Never commit real credentials.

## Author

Fretch M. Lucero — [@FretchIZ](https://github.com/FretchIZ)
