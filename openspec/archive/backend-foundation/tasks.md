# Tasks: Backend Foundation Core API

## Review Workload Forecast

- **Delivery Strategy**: `ask-on-risk` (cached)
- **Estimated Changed Lines**: ~480 - 550 lines
- **400-Line Budget Risk**: High (new service setup with schemas, routes, and tests)
- **Chained PRs Recommended**: Yes (Can split cleanly into PR 1: Setup & Data Layer + Auth; PR 2: Clients, Cuts, Photos & Integration Tests)
- **Decision Needed Before Apply**: Yes (under `ask-on-risk`, orchestrator must pause and evaluate chained PRs vs `size:exception`)

---

## Task Breakdown

### 1. Project Setup & Data Layer
- [x] 1.1 Initialize `server/` directory with `package.json`, dependencies (`fastify`, `@fastify/jwt`, `@fastify/cors`, `@prisma/client`, `zod`, `@aws-sdk/client-s3`), and `tsconfig.json`.
- [x] 1.2 Configure `prisma/schema.prisma` with `Barber`, `Shop`, `Client`, `ClientProfile`, `Cut`, and `CutPhoto` models.
- [x] 1.3 Create Prisma client plugin (`src/plugins/prisma.plugin.ts`) and pilot database seed script (`prisma/seed.ts`) with test barbers and hashed PINs.

### 2. Core Security & Plugins
- [x] 2.1 Implement Fastify JWT authentication and single-device concurrency check hook (`src/plugins/auth.plugin.ts`).
- [x] 2.2 Implement Cloudflare R2 / S3 client and presigned URL service decorator (`src/plugins/s3.plugin.ts`).
- [x] 2.3 Assemble Fastify application factory (`src/app.ts`) and process runner (`src/server.ts`).

### 3. Business Modules Implementation
- [x] 3.1 Implement Auth module:
  - Route: `POST /auth/login` (email/password and 4-digit PIN authentication with deviceId update).
  - Route: `GET /auth/me` (active session verification and profile retrieval).
- [x] 3.2 Implement Clients module:
  - Route: `GET /clients/:phone/history` (lookup by phone with multi-profile cut hydration).
  - Route: `POST /clients` (register new client and primary profile).
- [x] 3.3 Implement Cuts module:
  - Route: `POST /cuts` (start cut with RN-06 active cut check and `clientRequestId` idempotency).
  - Route: `POST /cuts/:id/finalize` (finalize cut with Zod chips validation, duration calculation, and non-blocking `rapidClosure: true` flag for RN-07).
- [x] 3.4 Implement Photos module:
  - Route: `POST /cuts/:id/photos/presign` (generate 5-minute R2 presigned PUT URL).
  - Route: `POST /cuts/:id/photos/confirm` (persist photo record with in-chair consent).

### 4. Automated Verification Suite
- [x] 4.1 Write Auth integration tests (`tests/auth.test.ts`): PIN login, password login, invalid credentials, and `SESSION_SUPERSEDED` behavior.
- [x] 4.2 Write Clients integration tests (`tests/clients.test.ts`): phone lookup with historical cuts, multi-profile handling, and 404 response.
- [x] 4.3 Write Cuts integration tests (`tests/cuts.test.ts`):
  - RN-06: 409 Conflict when second cut is attempted in progress.
  - RN-07: Finalize under 15 min succeeds with `rapidClosure: true`.
  - Finalize above 15 min succeeds with `rapidClosure: false`.
  - Idempotency with duplicated `clientRequestId`.
- [x] 4.4 Write Photos integration tests (`tests/photos.test.ts`): presigned URL generation and metadata confirmation.
