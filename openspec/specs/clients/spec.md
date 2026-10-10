# Specification: Client & Profile Management (`clients`)

## Overview
Allows barbers to look up client history by phone number to hydrate the PWA's local database. Supports multi-profile associations (`Client -> ClientProfile -> Cut`) under a single telephone number (e.g. parents and children).

## Requirements

### Requirement: Lookup Client History by Telephone
The system MUST retrieve client profiles and historical technical cut data when queried by phone number.

#### Scenario: Existing client with historical cuts
- **Given** a client registered with phone `"70123456"` having profile `"Carlos"` and 2 completed cuts
- **When** an authenticated barber sends `GET /clients/70123456/history`
- **Then** the response status MUST be `200 OK`
- **And** the response body MUST include client details, available profiles array, and past technical cuts ordered by date descending
- **And** each cut in the list MUST include `chips`, `startedAt`, `finishedAt`, and associated photo metadata

#### Scenario: Client with multiple profiles (e.g., father and son)
- **Given** a client with phone `"71987654"` having profiles `"Rodrigo"` and `"Rodrigo Jr."`
- **When** an authenticated barber sends `GET /clients/71987654/history`
- **Then** the response status MUST be `200 OK`
- **And** `profiles` array MUST contain both `"Rodrigo"` and `"Rodrigo Jr."` with their respective distinct cut histories

#### Scenario: Client not found
- **Given** no client exists with phone `"69000000"`
- **When** an authenticated barber sends `GET /clients/69000000/history`
- **Then** the response status MUST be `404 Not Found`
- **And** the body MUST return `{ "exists": false, "phone": "69000000" }` allowing the frontend to immediately offer new client registration

---

### Requirement: Create or Upsert Client Profile
The system MUST allow registering a client and profile when starting a cut for a new client.

#### Scenario: Create client and primary profile
- **When** a `POST /clients` request is sent with `phone: "75551234"` and `name: "Mateo"`
- **Then** the response status MUST be `201 Created`
- **And** a `Client` record with phone `"75551234"` and a default `ClientProfile` with name `"Mateo"` MUST be created in the database
