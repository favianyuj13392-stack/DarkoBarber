# Specification: Real-Time Barber Presence & Occupancy Traffic Light (`presence`)

## Overview
Defines real-time presence tracking for barber chairs, enforcing the 4-state traffic light (`GREEN`, `RED`, `YELLOW`, `GRAY`), automated disconnection watchdogs (heartbeat failure to `GRAY`), phantom turn timeouts (50 min to `GREEN`), and public map reads.

## Requirements

### Requirement: Barber WebSocket Connection & Authentication
The system MUST allow authenticated barbers to establish a persistent WebSocket connection to broadcast presence and receive status updates.

#### Scenario: Successful authenticated WebSocket connection
- **Given** an authenticated barber holding a valid JWT token
- **When** the barber initiates a WebSocket handshake to `/ws/presence?token=<valid_jwt>`
- **Then** the connection MUST be accepted
- **And** a `Presence` record in the database MUST have its `status` updated from `GRAY` to `GREEN` (or `RED` if an active cut is in progress)
- **And** the server MUST send an initial message `{ "type": "PRESENCE_CONNECTED", "status": string, "waitingCount": number }`

#### Scenario: Rejection of unauthenticated WebSocket connection
- **When** a client initiates a WebSocket handshake without a token or with an invalid/expired token
- **Then** the connection MUST be closed with code `4401` (Unauthorized)

---

### Requirement: Heartbeat & Inactivity Watchdog
The system MUST track periodic heartbeats from connected barbers and transition the chair to `GRAY` if heartbeats lapse for more than 90 seconds.

#### Scenario: Heartbeat processing
- **Given** a connected barber WebSocket
- **When** the barber sends a message `{ "type": "HEARTBEAT" }`
- **Then** the server MUST respond with `{ "type": "HEARTBEAT_ACK", "timestamp": string }`
- **And** the database `Presence.lastHeartbeat` MUST be updated to current time

#### Scenario: Transition to GRAY upon socket disconnection or 90s heartbeat lapse
- **Given** a barber chair in status `GREEN`
- **When** the WebSocket is closed or 90 seconds elapse without a heartbeat
- **Then** the chair status in `Presence` MUST transition to `GRAY`
- **And** public status queries MUST reflect the barber as disconnected (`GRAY`)

---

### Requirement: Cut Lifecycle Synchronization (RF-2.1)
The system MUST synchronize chair presence with cut operations.

#### Scenario: Transition to RED on cut start
- **Given** a barber in status `GREEN`
- **When** `POST /cuts` is executed successfully for this barber
- **Then** the chair status in `Presence` MUST immediately update to `RED`
- **And** `activeCutId` MUST be set and `expiresAt` set to 50 minutes from now
- **And** connected WebSocket clients in the barber's shop room MUST receive a broadcast `{ "type": "PRESENCE_CHANGED", "status": "RED", "activeCutId": string }`

#### Scenario: Transition to YELLOW when cutting with waiting clients
- **Given** a barber cutting in status `RED`
- **When** the barber submits a lounge update `{ "type": "UPDATE_WAITING_COUNT", "waitingCount": 1 }`
- **Then** the chair status MUST transition to `YELLOW` (Cortando + gente en sala)

#### Scenario: Transition to GREEN on cut finalization
- **Given** a barber in status `RED` or `YELLOW`
- **When** `POST /cuts/:id/finalize` is executed successfully
- **Then** `activeCutId` MUST be cleared to `null`
- **And** the chair status MUST transition back to `GREEN` (Libre)

---

### Requirement: Phantom Turn Timeout (RF-2.4)
The system MUST prevent orphaned "Cortando" states by resetting cuts inactive for more than 50 minutes.

#### Scenario: Auto-recovery of phantom turn
- **Given** a barber chair in status `RED` whose `expiresAt` is in the past (>50 minutes since started)
- **When** the presence background watchdog runs
- **Then** the chair status MUST transition to `GREEN`
- **And** the server MUST broadcast a status update to the barber's room

---

### Requirement: Public Map Presence Endpoint
The system MUST provide a high-throughput, low-latency HTTP endpoint for map visitors.

#### Scenario: Retrieve all active salon chairs for map
- **When** a `GET /presence/map` request is received
- **Then** the response status MUST be `200 OK`
- **And** the body MUST return a list of barber chairs with `{ barberId, displayName, shopId, shopName, status, waitingCount, updatedAt }`
- **And** the response headers MUST include caching directives (`Cache-Control: public, max-age=3, s-maxage=5`)
