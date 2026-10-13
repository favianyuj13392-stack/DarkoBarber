# Proposal: Real-Time Barber Presence & Occupancy Traffic Light (`backend-presence`)

## 1. Why

While the `backend-foundation` slice established data persistence, barber authentication, and cut ingestion, the second pillar of DarkoSync Barber is the **Passive Occupancy Traffic Light (Semáforo Pasivo de Ocupación)**. 

Barbershops in La Paz (Sopocachi, San Miguel, Miraflores) operate on a walk-in, arrival-order culture. Potential clients pass by or leave when they observe a "false full" shop (a barber who is 3 minutes away from finishing with zero waiting clients). Traditional scheduling software fails because barbers will not micromanage calendars with wet or powdery hands. 

The presence system eliminates calendars by reflecting real-time chair availability:
- **Green** (Libre): Barber is connected, ready for walk-ins.
- **Red** (Cortando): Barber has an active cut in progress.
- **Yellow** (Cortando + espera): Barber is cutting and has 1 or more people waiting in the lounge.
- **Gray** (Desconectado): Barber is off-shift or has had no network heartbeat for >90 seconds.

Completing this backend slice now fulfills all server-side real-time and state requirements while design teams finalize the mobile PWA UI mockups.

## 2. What Changes

We extend the Fastify backend in `server/` with real-time bidirectional messaging and presence monitoring:
- **Database Model**: Add `Presence` model and `PresenceStatus` enum (`GREEN`, `RED`, `YELLOW`, `GRAY`) in Prisma schema.
- **WebSocket Protocol for Barbers**: Authenticated WebSocket gateway (`@fastify/websocket`) dedicated exclusively to barber devices. Handles heartbeats (every 30-45s) and pushes presence status transitions.
- **Heartbeat & Disconnection Watchdog**: An in-memory tracker detects when a barber socket drops or misses heartbeats for >90s, updating status to `GRAY`.
- **Phantom Turn Timeout (RF-2.4)**: If a cut remains in `RED` for >50 minutes without manual activity, an automated check transitions the chair back to `GREEN` to prevent orphaned locks.
- **Lounge Micro-Tap Support (RF-2.3)**: Allows barbers to update `waitingCount` (0, 1-2, 3+) via WebSocket or HTTP payload, switching `RED` to `YELLOW` when clients are waiting.
- **Cut Lifecycle Integration**: Hooking cut lifecycle mutations (`POST /cuts` -> auto-transition to `RED`; `POST /cuts/:id/finalize` -> auto-transition to `GREEN` or `YELLOW`).
- **Public Map HTTP & SSE Endpoint**: Decoupled read-only endpoint (`GET /presence/map`) for public clients viewing the city map, preserving VPS connection capacity without opening public WebSocket sockets.

## 3. Scope Boundaries & Slice Limits

### In Scope
- Prisma migration adding `Presence` table and relation to `Barber`.
- Fastify WebSocket plugin setup and connection authentication (`/ws/presence`).
- Barber presence state machine (`GREEN`, `RED`, `YELLOW`, `GRAY`).
- Barber heartbeat tracking with 90s grace period before `GRAY`.
- 50-minute phantom turn auto-expiry worker/interval in Fastify.
- Cut event integration: automatic state transition on cut start and cut finalization.
- Public read endpoint: `GET /presence/map` (and optional SSE `/presence/stream`).
- Unit and integration tests covering socket auth, heartbeat disconnects, phantom turn timeouts, and public map feeds.

### Out of Scope (Explicit Non-Goals)
- Redis Pub/Sub: Not needed for 1-50 concurrent pilot barbers on a single Fastify instance. In-memory maps handle socket rooms and timers cleanly.
- Public client WebSockets: Thousands of map visitors must not open persistent WebSockets on a $6/mo VPS. HTTP polling with cache or lightweight SSE suffices.
- Mobile UI implementation: PWA frontend implementation remains deferred to frontend changes.

## 4. Impact & Technical Considerations

- **Memory & VPS Resource Footprint**: Native `@fastify/websocket` (built on `ws`) consumes ~30-50 KB per active socket. 30 concurrent barbers consume <2 MB RAM, fully sustainable on minimal VPS hardware.
- **Reliability in Unstable Networks**: 90-second heartbeat grace period prevents flapping between active and `GRAY` when mobile radios transition between cellular cells in La Paz topography.

## 5. Risks & Tradeoffs

| Risk / Tradeoff | Decision / Mitigation |
|---|---|
| VPS restart clearing socket state | Every transition writes directly to the PostgreSQL `Presence` table. Upon startup, any stale connection without heartbeat within 90s is marked `GRAY`. |
| Phantom cuts remaining `RED` indefinitely | Handled by scheduled 60s background interval comparing `expiresAt` against `now()`, resetting expired cuts to `GREEN`. |
| Socket flood from public map viewers | Barbers use WebSockets; the public map uses HTTP caching / SSE. Zero socket descriptor exhaustion risk. |
