# Specification: Cut Lifecycle & Offline Sync (`cuts`)

## Overview
Manages the recording, validation, and finalization of cuts. Enforces business rules RN-06 (one cut in progress per barber), RN-07 (non-blocking anti-rush logging with `rapid_closure: true`), and ensures idempotent offline queue draining via `clientRequestId`.

## Requirements

### Requirement: Start Cut (`POST /cuts`)
The system MUST allow an authenticated barber to start a cut session for a client profile.

#### Scenario: Successfully start a cut
- **Given** an authenticated barber with no cuts currently in progress
- **When** a `POST /cuts` request is received with `clientProfileId: "prof-123"` and `clientRequestId: "req-uuid-1"`
- **Then** the response status MUST be `201 Created`
- **And** a `Cut` record with `status: "IN_PROGRESS"` and `startedAt` timestamp MUST be saved
- **And** the barber's active cut pointer MUST be set to this cut's ID

#### Scenario: Enforce RN-06 (Single active cut per barber)
- **Given** an authenticated barber who already has a cut with status `"IN_PROGRESS"`
- **When** the barber attempts a `POST /cuts` to start another cut
- **Then** the response status MUST be `409 Conflict`
- **And** the error code MUST be `"ACTIVE_CUT_EXISTS"`

---

### Requirement: Finalize Cut (`POST /cuts/:id/finalize`)
The system MUST allow finalizing a cut, validating technical chips, and calculating duration. The action MUST NEVER block the physical workflow.

#### Scenario: Standard finalization with valid chips
- **Given** a cut with status `"IN_PROGRESS"` started 25 minutes ago
- **When** a `POST /cuts/:id/finalize` request is received with valid chips payload:
  ```json
  {
    "chips": {
      "baseLateral": "#1",
      "tipoDegradado": "Mid Fade",
      "parteSuperior": "Tijera Texturizado",
      "barba": { "included": true, "alturaMejilla": "Media" },
      "adicionales": ["Cejas navaja"]
    }
  }
  ```
- **Then** the response status MUST be `200 OK`
- **And** `status` MUST be updated to `"FINISHED"`, `finishedAt` set, and `rapid_closure` MUST be `false`

#### Scenario: Enforce RN-07 (Non-blocking anti-rush flag)
- **Given** a cut with status `"IN_PROGRESS"` started 7 minutes ago without `"Corte Express"` chip
- **When** the barber submits `POST /cuts/:id/finalize`
- **Then** the response status MUST be `200 OK` (NEVER blocked or rejected)
- **And** `status` MUST be set to `"FINISHED"`
- **And** the `Cut` record MUST have `rapid_closure: true` stored in the database for auditing and metrics

#### Scenario: Express cut threshold check
- **Given** a cut started 6 minutes ago with chip `"Corte Express"` in `adicionales`
- **When** the barber submits `POST /cuts/:id/finalize`
- **Then** the response status MUST be `200 OK`
- **And** `rapid_closure` MUST be `true` because it finished below the 8-minute express threshold

---

### Requirement: Idempotent Sync for Offline Outbox
The system MUST guarantee idempotency for cut mutations synced from the client outbox using `clientRequestId`.

#### Scenario: Duplicate sync payload received
- **Given** a cut mutation with `clientRequestId: "550e8400-e29b-41d4-a716-446655440000"` already successfully processed
- **When** the client resends the exact same payload with `clientRequestId: "550e8400-e29b-41d4-a716-446655440000"`
- **Then** the response status MUST be `200 OK`
- **And** no duplicate cut record MUST be created in the database
