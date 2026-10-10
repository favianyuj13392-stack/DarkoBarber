# Specification: Photo Storage via Cloudflare R2 (`photos`)

## Overview
Generates presigned PUT URLs for direct-to-storage photo uploads from the browser to Cloudflare R2, bypassing the VPS. Handles photo metadata persistence and in-chair consent flags.

## Requirements

### Requirement: Generate Presigned Upload URL (`POST /cuts/:id/photos/presign`)
The system MUST generate an AWS S3-compatible presigned PUT URL allowing the client to upload an image directly to Cloudflare R2 within a 5-minute expiration window.

#### Scenario: Generate upload URL for valid cut
- **Given** an authenticated barber and a cut belonging to that barber
- **When** a request `POST /cuts/:id/photos/presign` is received with `contentType: "image/webp"`
- **Then** the response status MUST be `200 OK`
- **And** the body MUST contain a `presignedUrl` targeting R2 and an `r2Key` following the pattern `cuts/{barberId}/{cutId}/{uuid}.webp`
- **And** the signed URL MUST expire after 300 seconds (5 minutes)

#### Scenario: Reject presigning for cut belonging to another barber
- **Given** cut `"cut-999"` belongs to barber `"barber-A"`
- **When** authenticated barber `"barber-B"` requests presigning for `"cut-999"`
- **Then** the response status MUST be `403 Forbidden`

---

### Requirement: Confirm Photo Upload (`POST /cuts/:id/photos/confirm`)
The system MUST persist metadata and consent state for an uploaded photo after the frontend finishes PUTting to R2.

#### Scenario: Confirm photo with in-chair consent
- **Given** an image successfully uploaded to R2 with key `r2Key: "cuts/b1/c1/photo-1.webp"`
- **When** a `POST /cuts/:id/photos/confirm` request is sent with `r2Key`, and `isPublic: true`
- **Then** the response status MUST be `201 Created`
- **And** a `CutPhoto` record MUST be saved associated with the cut, setting `isPublic: true`

#### Scenario: Default privacy when consent is absent
- **When** a `POST /cuts/:id/photos/confirm` request is sent without specifying `isPublic`
- **Then** the `CutPhoto` record MUST be created with `isPublic: false` by default
