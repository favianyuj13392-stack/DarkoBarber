# Specification: Barber Authentication (`auth`)

## Overview
Provides authentication and session management for pilot barbers. Barbers authenticate using either email/password or a fast 4-digit numeric PIN. Sessions are governed by JWTs and enforce single-device active concurrency.

## Requirements

### Requirement: Barber Login with Credentials or PIN
The system MUST allow seeded pilot barbers to authenticate using their registered email and password, or their registered identifier and 4-digit numeric PIN.

#### Scenario: Successful login with email and password
- **Given** an existing active barber with email `"diego@darkobarber.com"` and password `"Secret123!"`
- **When** a `POST /auth/login` request is received with email, password, and `deviceId: "dev-iphone-14"`
- **Then** the response status MUST be `200 OK`
- **And** the response MUST return a valid JWT token containing `barberId`, `shopId`, and `deviceId` claims
- **And** the barber record's `deviceId` in the database MUST be updated to `"dev-iphone-14"`

#### Scenario: Successful login with 4-digit PIN
- **Given** an existing active barber with phone `"77212345"` and PIN `"1234"`
- **When** a `POST /auth/login` request is received with identifier `"77212345"`, PIN `"1234"`, and `deviceId: "dev-pixel-7"`
- **Then** the response status MUST be `200 OK`
- **And** the response MUST return a valid JWT token

#### Scenario: Failed login with invalid credentials
- **Given** an existing active barber with email `"diego@darkobarber.com"`
- **When** a `POST /auth/login` request is received with an incorrect password or PIN
- **Then** the response status MUST be `401 Unauthorized`
- **And** the response MUST return an error message indicating invalid credentials

---

### Requirement: Single Active Device Enforcement
The system MUST invalidate previous sessions if the barber signs in from a different device (RN-06/device policy).

#### Scenario: Token rejection after login from another device
- **Given** a barber authenticated on device `"dev-old-device"` holding JWT `token_A`
- **When** the barber logs in from a new device `"dev-new-device"` generating JWT `token_B`
- **And** a subsequent request to a protected endpoint is made using `token_A`
- **Then** the response status MUST be `401 Unauthorized`
- **And** the error code MUST indicate `"SESSION_SUPERSEDED"`

---

### Requirement: Session Verification (`GET /auth/me`)
The system MUST provide an endpoint to verify token validity and retrieve current barber profile details.

#### Scenario: Retrieve authenticated profile
- **Given** a valid JWT token for an active barber
- **When** a `GET /auth/me` request is sent with `Authorization: Bearer <token>`
- **Then** the response status MUST be `200 OK`
- **And** the response body MUST contain `id`, `displayName`, `shopId`, `plan`, and `activeCutId`
