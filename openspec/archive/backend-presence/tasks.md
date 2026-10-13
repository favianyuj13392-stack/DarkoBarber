# Tasks: Real-Time Barber Presence & Occupancy Traffic Light (`backend-presence`)

## Review Workload Forecast

- **Delivery Strategy**: `ask-on-risk` (cached)
- **Estimated Changed Lines**: ~320 - 380 lines
- **400-Line Budget Risk**: Low (well within the 400-line limit)
- **Chained PRs Recommended**: No (single cohesive presence slice)
- **Decision Needed Before Apply**: No

---

## Task Breakdown

### 1. Data Layer & Schema Migration
- [x] 1.1 Update `server/prisma/schema.prisma` adding `Presence` model, `PresenceStatus` enum (`GREEN`, `RED`, `YELLOW`, `GRAY`), and relation to `Barber`. Run `prisma generate`.
- [x] 1.2 Update `server/prisma/seed.ts` to seed an initial `Presence` record for pilot barber Diego (`status: GRAY`, `waitingCount: 0`).

### 2. WebSocket Gateway & Connection Infrastructure
- [x] 2.1 Install `@fastify/websocket` dependency in `server/package.json` and configure plugin in `server/src/plugins/websocket.plugin.ts`.
- [x] 2.2 Implement in-memory socket registry and room broadcasting service (`server/src/modules/presence/presence.gateway.ts`).

### 3. Business Logic, State Machine & Watchdogs
- [x] 3.1 Implement `PresenceService` (`server/src/modules/presence/presence.service.ts`):
  - State machine transitions (`GREEN`, `RED`, `YELLOW`, `GRAY`).
  - DB synchronization and active cut pointer tracking.
  - Lounge micro-tap updates (`waitingCount`).
- [x] 3.2 Implement background watchdog timer (`server/src/modules/presence/presence.watchdog.ts`):
  - Inactivity watchdog: transitions sockets with >90s missing heartbeats to `GRAY`.
  - RF-2.4 Phantom turn auto-recovery: resets cuts older than 50 minutes (`expiresAt < now()`) to `GREEN`.
- [x] 3.3 Hook cut operations in `server/src/modules/cuts/cuts.service.ts`:
  - `startCut()` triggers transition to `RED` with `expiresAt = now + 50 min`.
  - `finalizeCut()` triggers transition to `GREEN` (or based on lounge count).

### 4. Endpoints & Routes Implementation
- [x] 4.1 Implement WebSocket route `GET /ws/presence` (`server/src/modules/presence/presence.routes.ts`):
  - JWT authentication during upgrade.
  - Handle client messages: `HEARTBEAT`, `UPDATE_WAITING_COUNT`, `SET_STATUS`.
  - Send server messages: `PRESENCE_CONNECTED`, `HEARTBEAT_ACK`, `PRESENCE_CHANGED`.
- [x] 4.2 Implement public HTTP endpoint `GET /presence/map` (`server/src/modules/presence/presence.routes.ts`):
  - Return all barber chairs with presence and shop metadata.
  - Set HTTP edge caching headers (`Cache-Control: public, max-age=3, s-maxage=5`).
- [x] 4.3 Register presence module routes and watchdog lifecycle in `server/src/app.ts`.

### 5. Automated Verification Suite
- [x] 5.1 Implement presence integration tests in `server/tests/presence.test.ts`:
  - Handshake authentication: accept valid JWT, reject invalid/missing JWT (`4401`).
  - Heartbeat processing: `HEARTBEAT` returns `HEARTBEAT_ACK` and updates DB timestamp.
  - Cut lifecycle sync: `POST /cuts` turns chair to `RED`; `POST /cuts/:id/finalize` resets to `GREEN`.
  - Lounge micro-tap: updating `waitingCount` switches `RED` to `YELLOW`.
  - Phantom turn watchdog: expired cut automatically reverts to `GREEN`.
  - Public map query: `GET /presence/map` returns formatted chair list with cache headers.
