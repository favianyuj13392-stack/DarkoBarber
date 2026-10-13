# Technical Design: Real-Time Barber Presence & Occupancy Traffic Light (`backend-presence`)

## 1. System Architecture & Real-Time Module Layout

We extend the Fastify monolith in `server/` with `@fastify/websocket`. Real-time socket communication is restricted to barbers. The public map consumes cached HTTP or Server-Sent Events.

```
server/
├── prisma/
│   └── schema.prisma           # Add Presence model & PresenceStatus enum
├── src/
│   ├── modules/
│   │   ├── presence/
│   │   │   ├── presence.gateway.ts     # WebSocket connection handler & room broadcasting
│   │   │   ├── presence.service.ts     # State machine, DB sync, and status logic
│   │   │   ├── presence.watchdog.ts    # Background timers (90s heartbeat & 50m phantom turn)
│   │   │   ├── presence.routes.ts      # HTTP endpoints (/presence/map) and /ws/presence
│   │   │   └── presence.schemas.ts     # Zod payload & message contracts
│   │   └── cuts/
│   │       └── cuts.service.ts         # Hooked to notify presence on cut start/finalize
│   ├── plugins/
│   │   └── websocket.plugin.ts         # @fastify/websocket registration
│   └── app.ts                          # Registered presence routes and plugins
└── tests/
    └── presence.test.ts                # WebSocket & HTTP integration tests
```

---

## 2. Data Model (Prisma Schema Additions)

```prisma
enum PresenceStatus {
  GREEN   // Libre
  RED     // Cortando (ficha abierta)
  YELLOW  // Cortando + gente en sala
  GRAY    // Desconectado / fuera de turno
}

model Barber {
  // Existing fields...
  presence      Presence?
}

model Presence {
  barberId      String         @id
  barber        Barber         @relation(fields: [barberId], references: [id], onDelete: Cascade)
  status        PresenceStatus @default(GRAY)
  waitingCount  Int            @default(0) // 0: Nadie, 1: 1 a 2, 2: 3 o más
  activeCutId   String?
  expiresAt     DateTime?      // Timeout for phantom cut auto-cancellation (startedAt + 50 min)
  lastHeartbeat DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([status])
}
```

---

## 3. Real-Time WebSocket Communication Protocol

### Connection Handshake
- **Endpoint**: `/ws/presence?token=<JWT>`
- **Authentication**: Validated using Fastify JWT plugin during connection upgrade. Invalid tokens immediately trigger socket closure with code `4401`.

### In-Memory Connection Tracking (No Redis)
Piloting 1-50 barbers requires zero external state brokers:
```ts
interface ActiveBarberSocket {
  barberId: string;
  shopId: string | null;
  socket: WebSocket;
  lastHeartbeat: number;
}

// In-memory active socket registry
const activeSockets = new Map<string, ActiveBarberSocket>();
```

### Message Protocol

#### Client -> Server (Barber Device)
| Message Type | Payload | Behavior |
|---|---|---|
| `HEARTBEAT` | `{ "type": "HEARTBEAT" }` | Resets 90s disconnection timer, updates `lastHeartbeat`. |
| `UPDATE_WAITING_COUNT` | `{ "type": "UPDATE_WAITING_COUNT", "waitingCount": 0 \| 1 \| 2 }` | Updates `waitingCount`. If in `RED` and `waitingCount > 0`, shifts to `YELLOW`. |
| `SET_STATUS` | `{ "type": "SET_STATUS", "status": "GREEN" \| "GRAY" }` | Allows manual disconnection (e.g. going to lunch). |

#### Server -> Client
| Message Type | Payload | Trigger |
|---|---|---|
| `PRESENCE_CONNECTED` | `{ "type": "PRESENCE_CONNECTED", "status": string, "waitingCount": number, "activeCutId": string \| null }` | Sent immediately after successful connection. |
| `HEARTBEAT_ACK` | `{ "type": "HEARTBEAT_ACK", "timestamp": string }` | Response to `HEARTBEAT`. |
| `PRESENCE_CHANGED` | `{ "type": "PRESENCE_CHANGED", "barberId": string, "status": string, "waitingCount": number, "activeCutId": string \| null }` | Broadcast to shop room when status changes. |

---

## 4. State Machine & Business Rules Integration

### Presence Transitions
```
                [Socket Connect / Auth]
                         │
                         ▼
        ┌────────────────────────────────┐
        │ Has activeCutId in progress?   │
        └───────┬────────────────┬───────┘
            Yes │                │ No
                ▼                ▼
             [ RED ]          [ GREEN ]
                │
                ├─ waitingCount > 0 ──► [ YELLOW ]
                ├─ waitingCount = 0 ──► [ RED ]
                ├─ Cut Finalized ─────► [ GREEN ]
                ├─ >50 min inactivity ─► [ GREEN ] (Phantom Turn Reset)
                └─ Disconnect / >90s ─► [ GRAY ]
```

### Hooking into Cut Lifecycle
1. **`CutsService.startCut()`**:
   - Updates `Presence.status = RED`, `Presence.activeCutId = cut.id`, `Presence.expiresAt = now + 50 min`.
   - Broadcasts `PRESENCE_CHANGED` to barber's shop room.
2. **`CutsService.finalizeCut()`**:
   - Updates `Presence.status = GREEN`, `Presence.activeCutId = null`, `Presence.expiresAt = null`.
   - Broadcasts `PRESENCE_CHANGED` to barber's shop room.

---

## 5. Background Watchdogs (`presence.watchdog.ts`)

A lightweight timer runs every **30 seconds** in Fastify:
1. **Heartbeat Lapse Watchdog**:
   - Checks `activeSockets`. If `now - lastHeartbeat > 90,000 ms`, closes socket and marks database status `GRAY`.
2. **Phantom Turn Watchdog (RF-2.4)**:
   - Queries `Presence` table for `status IN ('RED', 'YELLOW') AND expiresAt < now()`.
   - Updates status to `GREEN`, clears `activeCutId`, and broadcasts update.

---

## 6. Public Map HTTP Endpoint

### `GET /presence/map`
- **Access**: Public, unauthenticated.
- **Cache**: `Cache-Control: public, max-age=3, s-maxage=5` (Cloudflare edge caching).
- **Response Shape (200 OK)**:
  ```json
  [
    {
      "barberId": "uuid-1",
      "displayName": "Diego",
      "shopId": "shop-1",
      "shopName": "Darko Studio",
      "status": "GREEN",
      "waitingCount": 0,
      "updatedAt": "2026-10-10T19:30:00Z"
    }
  ]
  ```

---

## 7. Verification & Automated Testing Plan

Tests executed via **Vitest** in `server/tests/presence.test.ts`:
1. **WebSocket Handshake**: Valid token connects successfully; missing/invalid token rejected (`4401`).
2. **Heartbeat**: Sending `HEARTBEAT` responds with `HEARTBEAT_ACK` and updates timestamp.
3. **Cut Integration**: Triggering `POST /cuts` changes status to `RED`; finalizing cut changes status to `GREEN`.
4. **Micro-Tap Lounge**: Updating waiting count shifts status between `RED` and `YELLOW`.
5. **Watchdog Timers**: Simulated time expiration resets phantom turn from `RED` to `GREEN`.
6. **Public Map**: `GET /presence/map` returns formatted chair list with caching headers.
