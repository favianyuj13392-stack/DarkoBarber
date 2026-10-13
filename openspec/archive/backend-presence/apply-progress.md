# Implementation Progress: Real-Time Barber Presence & Occupancy Traffic Light (`backend-presence`)

## Status: COMPLETED

## Summary
Implemented the full real-time barber presence and occupancy traffic light backend slice (`backend-presence`) on top of the Fastify monolith, including the PostgreSQL `Presence` schema, `@fastify/websocket` connection gateway, 4-state traffic light machine (`GREEN`, `RED`, `YELLOW`, `GRAY`), lounge micro-tap support, cut lifecycle synchronization, background inactivity and phantom turn watchdogs, and edge-cached public map endpoint.

## Critical Maintainer Requirements Implemented
1. **Waiting Count Mapping (`waitingCount`)**:
   - Explicitly enforced and documented in Zod schemas, TypeScript types, and Prisma schema:
     - `0`: 0 people / "Nadie"
     - `1`: 1 to 2 people / "1 a 2"
     - `2`: 3 or more people / "3 o más"
2. **WebSocket Initial Connection Status**:
   - Queries for an active (`IN_PROGRESS`) cut upon WebSocket connection:
     - Active cut exists -> initializes to `RED` (or `YELLOW` if `waitingCount > 0`) with `activeCutId` and 50-minute `expiresAt`.
     - No active cut -> initializes to `GREEN`.
3. **Manual `SET_STATUS` Restrictions**:
   - Strictly restricted via Zod schema (`z.enum(['GREEN', 'GRAY'])`) to accept only `'GREEN'` (ready/return) or `'GRAY'` (off-shift/break).
   - Rejects manual attempts to set `'RED'` or `'YELLOW'` with an `INVALID_PAYLOAD` error.
4. **Broadcast Room Scope**:
   - Broadcasts `PRESENCE_CHANGED` to all active sockets in `shop:${barber.shopId}` when the barber belongs to a shop, or to `barber:${barber.id}` when autonomous (`shopId === null`).

## Files Created & Modified

### Created
- `server/src/plugins/websocket.plugin.ts` — Fastify WebSocket (`@fastify/websocket@10.0.1`) registration plugin.
- `server/src/modules/presence/presence.schemas.ts` — Zod validation schemas and TypeScript contracts for WebSocket messages and public map items.
- `server/src/modules/presence/presence.gateway.ts` — In-memory active barber socket registry and room-scoped broadcast methods.
- `server/src/modules/presence/presence.service.ts` — State machine logic, database synchronization, cut lifecycle hooks, watchdog checks, and map queries.
- `server/src/modules/presence/presence.watchdog.ts` — Periodic 30s background timer for 90s heartbeat lapse disconnection and 50m phantom turn auto-recovery.
- `server/src/modules/presence/presence.routes.ts` — WebSocket route `/ws/presence`, public edge-cached `GET /presence/map`, and authenticated `GET /presence/me`.
- `server/tests/presence.test.ts` — 12 end-to-end integration tests covering WebSocket handshake, heartbeats, watchdogs, manual status restrictions, cut lifecycle sync, lounge micro-tap, and public map caching.

### Modified
- `server/package.json` — Added `@fastify/websocket@^10.0.1` and `@types/ws`.
- `server/prisma/schema.prisma` — Added `PresenceStatus` enum (`GREEN`, `RED`, `YELLOW`, `GRAY`), `Presence` model, and 1:1 relation on `Barber`.
- `server/prisma/seed.ts` — Added initial `Presence` record seeding (`status: GRAY`, `waitingCount: 0`) for pilot barber Diego.
- `server/src/types/index.ts` — Extended `FastifyInstance` interface with `presenceService`.
- `server/src/modules/cuts/cuts.service.ts` — Hooked `startCut()` to `presenceService.setCutting()` and `finalizeCut()` to `presenceService.setFree()`.
- `server/src/modules/cuts/cuts.routes.ts` — Passed `fastify.presenceService` into `CutsService`.
- `server/src/app.ts` — Registered `websocketPlugin`, `presenceRoutes`, and watchdog `onReady`/`onClose` lifecycle hooks.
- `server/tests/helpers.ts` — Added `prisma.presence.deleteMany({})` to `cleanDatabase`.
- `server/vitest.config.ts` — Added `hookTimeout: 30000` for reliable DB setup across sequential test suites.
- `openspec/changes/backend-presence/tasks.md` — Marked all 11 tasks `[x]`.

## Verification Results
- **TypeScript Build (`npm run build`)**: Passed with 0 errors.
- **Integration Test Suite (`npm test`)**: 5 test suites passed, **29/29 tests passing** (`auth.test.ts`: 4, `clients.test.ts`: 3, `cuts.test.ts`: 6, `photos.test.ts`: 4, `presence.test.ts`: 12).
