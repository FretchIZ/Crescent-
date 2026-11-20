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
| `npm run build` | Prisma generate + production build |
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
| Auth | `POST /api/auth/register`, `/login`, `/logout`, `/forgot-password`, `/reset-password`, `/verify-email`; `GET /api/auth/me` |
| Catalog | `GET /api/items`, `GET /api/items/[type]/[id]` |
| Search | `POST /api/search` |
| Discovery | `GET /api/recommendations` |
| Account | `GET/PUT /api/preferences`, `PUT /api/profile` |
| Engagement | `GET/POST/DELETE /api/favorites`, `POST /api/reviews`, `GET/POST /api/bookings`, `PATCH /api/bookings/[id]` |
| History | `DELETE /api/history` |
| Admin | `GET /api/admin/stats`, `GET /api/admin/audit` |

## Configuration

See `.env.example`. Everything except `DATABASE_URL` and `SESSION_SECRET` is optional:

- `OPENAI_API_KEY` — enables embeddings for semantic ranking; without it the built-in local engine is used.
- `RESEND_API_KEY` — enables transactional email; without it, verification/reset links are logged in development.

## Deployment

The schema is portable to PostgreSQL:

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Change `datasource db { provider = "sqlite" }` to `"postgresql"` in `prisma/schema.prisma`.
3. Run `npx prisma migrate deploy` (or `db push` for a first deploy) and seed if desired.
4. Set `APP_URL` to the public URL and a strong `SESSION_SECRET`.
5. Deploy on Vercel (or any Node host) with `npm run build` / `npm start`.

Note: the in-memory rate limiter is per-instance; use a shared store (e.g. Redis) for multi-instance deployments.

## Repository hygiene

`.env`, the local SQLite database, build output, dependencies, and the vendored Next.js tarball are intentionally ignored. Never commit real credentials.

## Author

Fretch M. Lucero — [@FretchIZ](https://github.com/FretchIZ)
