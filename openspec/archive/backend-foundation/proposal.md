# Proposal: Backend Foundation Core API

## 1. Why

The DarkoSync Barber system requires a lean, resilient, and lightweight server-side authority to power the client-facing and barber-facing workflows. While the barber PWA operates in an offline-light capacity, the backend serves as the single source of truth for:
1. Barber authentication (PIN/password) and multi-device session governance.
2. Client and cut history retrieval (pull/hydration when network is available).
3. Cut mutation ingestion (persisting cuts, enforcing plan limits, and tracking rapid closures without blocking UI).
4. Direct-to-storage image uploads via Cloudflare R2 presigned URLs.

By delivering this slice first, we establish the persistence layer, schema contracts, and API foundation without prematurely incurring real-time WebSocket state management complexity.

## 2. What Changes

We implement the foundational backend services inside the `server/` directory:
- **Runtime & Architecture**: Fastify HTTP server with TypeScript in a modular structure (`src/modules/auth`, `src/modules/clients`, `src/modules/cuts`, `src/modules/photos`).
- **Database Layer**: Prisma schema targeting PostgreSQL (Supabase-hosted), defining `Barber`, `Shop`, `Client`, `ClientProfile`, `Cut`, and `CutPhoto`.
- **Authorization & Security**: Fastify serves as the sole authorization authority. Validates session JWTs and enforces business rules in TypeScript (bypassing reliance on Supabase RLS through Prisma connection).
- **Barber Auth Module**: Controlled authentication supporting Email/Password and 4-digit numeric PIN with single-active-session handling.
- **Client & Profile Module**: Telephone-based lookup (`GET /clients/:phone/history`) returning client profiles and technical cut records to hydrate the barber's local Dexie.js database.
- **Cut Ingestion & Rules**: Endpoint to record cuts (`POST /cuts` and `POST /cuts/:id/finalize`). Enforces RN-06 (one cut in progress per barber), validates chips using semi-flexible Zod schema, and logs `rapid_closure: true` if duration < 15 min without blocking execution (RN-07).
- **R2 Presigned URLs**: S3-compatible presigned PUT URL generator for WebP photo uploads directly to Cloudflare R2 (`POST /cuts/:id/photos/presign`), followed by photo metadata confirmation (`POST /cuts/:id/photos/confirm`).

## 3. Scope Boundaries & First-Slice Limits

### In Scope
- Fastify server configuration with CORS, JWT, and error handling plugins.
- Prisma schema, migrations, and database seed script for pilot barbers.
- Auth endpoints: `POST /auth/login` (email/password or PIN), `GET /auth/me`.
- Client endpoints: `GET /clients/:phone/history`, `POST /clients/lookup-or-create`.
- Cut endpoints: `POST /cuts` (start cut), `POST /cuts/:id/finalize` (complete cut with chips & duration flag).
- Photo presigning: `POST /cuts/:id/photos/presign`, `POST /cuts/:id/photos/confirm`.
- Unit and integration tests for auth, business rules (RN-06, RN-07 flag), and cut ingestion.

### Out of Scope (Explicit Non-Goals for this slice)
- Real-time WebSockets and presence room orchestration (deferred to `backend-presence` slice).
- Public self-service signup for barbers (onboarding handled via controlled admin seeding).
- SMS OTP verification gateways (unreliable delivery in Bolivia; phone identity is used directly).
- Redis, message queues (BullMQ), or multi-instance clustering.
- Payment gateway integration (explicitly prohibited by RN-01).

## 4. Impact & Technical Considerations

- **Simplicity & Team Velocity**: Written entirely in TypeScript sharing data shapes with the frontend; runnable locally via Docker Compose.
- **Operational Cost**: Uses zero-cost tiers (Supabase Free, Cloudflare R2) and low-memory Node.js process suitable for a $6/mo VPS.
- **Reliability in Bolivia**: Eliminates external SMS dependencies and allows offline-light client apps to sync whenever connectivity is recovered.

## 5. Risks & Tradeoffs

| Risk / Tradeoff | Decision / Mitigation |
|-----------------|-----------------------|
| Prisma bypasses Supabase RLS | Fastify enforces all authorization checks and role validations in TypeScript service layer before hitting Prisma. |
| Group profiles complexity (Father + Son) | Modeled as `Client -> ClientProfile -> Cut` from Day 1 to avoid breaking migrations later. Single clients default to primary profile. |
| Chip evolution breaking backend | Semi-flexible Zod validation stored in JSONB column allows frontend to add new chip keys without requiring DB migrations. |
| Ingestion of rapid cuts (<15 min) | The backend accepts and persists the cut, stamping `rapid_closure: true` for audit, ensuring zero disruption to physical workflow. |
