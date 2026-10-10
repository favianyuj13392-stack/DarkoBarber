# Technical Design: Backend Foundation Core API

## 1. System Architecture & Module Structure

The backend is built as a modular Fastify monolith in TypeScript inside the `server/` root. Fastify functions as the single authorization and business logic boundary before persistence.

```
server/
├── prisma/
│   ├── schema.prisma           # Database models, enums & indices
│   └── seed.ts                 # Pilot barbers & shop seeding
├── src/
│   ├── modules/
│   │   ├── auth/               # Barber login (PIN/Password), JWT verification
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schemas.ts
│   │   ├── clients/            # Client telephone lookup & profile hydration
│   │   │   ├── clients.routes.ts
│   │   │   ├── clients.service.ts
│   │   │   └── clients.schemas.ts
│   │   ├── cuts/               # Cut lifecycle, RN-06 & RN-07 validation
│   │   │   ├── cuts.routes.ts
│   │   │   ├── cuts.service.ts
│   │   │   └── cuts.schemas.ts
│   │   └── photos/             # Cloudflare R2 presigned URLs & metadata
│   │       ├── photos.routes.ts
│   │       ├── photos.service.ts
│   │       └── photos.schemas.ts
│   ├── plugins/
│   │   ├── auth.plugin.ts      # Fastify JWT & device validation hook
│   │   ├── prisma.plugin.ts    # PrismaClient lifecycle decorator
│   │   └── s3.plugin.ts        # AWS S3 / Cloudflare R2 client decorator
│   ├── app.ts                  # Fastify application factory (testable with app.inject)
│   └── server.ts               # Process entrypoint & port binding
├── tests/
│   ├── auth.test.ts
│   ├── clients.test.ts
│   ├── cuts.test.ts
│   └── photos.test.ts
├── package.json
└── tsconfig.json
```

---

## 2. Data Model (Prisma Schema)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Plan {
  AUTONOMO      // 1 sillón, hasta 60 cortes/mes
  BARBERIA_BASE // hasta 3 sillones, 200 cortes/mes
  ALTO_FLUJO    // sillones ilimitados, cortes ilimitados
}

enum CutStatus {
  IN_PROGRESS
  FINISHED
  CANCELLED
}

model Shop {
  id          String   @id @default(uuid())
  name        String
  address     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  barbers     Barber[]
}

model Barber {
  id            String   @id @default(uuid())
  email         String?  @unique
  phone         String   @unique
  displayName   String
  pinHash       String   // Argon2 or bcrypt hash of 4-digit PIN
  passwordHash  String?  // Optional password for email login
  plan          Plan     @default(AUTONOMO)
  shopId        String?
  shop          Shop?    @relation(fields: [shopId], references: [id])
  deviceId      String?  // Current active mobile device ID
  cuts          Cut[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([phone])
}

model Client {
  id          String          @id @default(uuid())
  phone       String          @unique
  profiles    ClientProfile[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([phone])
}

model ClientProfile {
  id          String   @id @default(uuid())
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)
  name        String
  cuts        Cut[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([clientId])
}

model Cut {
  id                String      @id @default(uuid())
  clientRequestId   String      @unique // Idempotency key from client Outbox
  barberId          String
  barber            Barber      @relation(fields: [barberId], references: [id])
  clientProfileId   String
  clientProfile     ClientProfile @relation(fields: [clientProfileId], references: [id])
  status            CutStatus   @default(IN_PROGRESS)
  chips             Json?       // Technical chips object { baseLateral, tipoDegradado, etc. }
  startedAt         DateTime    @default(now())
  finishedAt        DateTime?
  rapidClosure      Boolean     @default(false) // RN-07 flag (<15 min or <8 min express)
  photos            CutPhoto[]
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([barberId, status])
  @@index([clientProfileId])
  @@index([startedAt])
}

model CutPhoto {
  id          String   @id @default(uuid())
  cutId       String
  cut         Cut      @relation(fields: [cutId], references: [id], onDelete: Cascade)
  r2Key       String   @unique
  isPublic    Boolean  @default(false) // Consent state defined in-chair
  createdAt   DateTime @default(now())

  @@index([cutId])
}
```

---

## 3. Authentication & Authorization Mechanism

### Fastify as the Single Authority
Fastify does not rely on database-level Supabase RLS policies. It verifies credentials, issues signed JWTs, and validates the claims on every protected request.

```ts
interface AuthTokenPayload {
  barberId: string;
  shopId: string | null;
  deviceId: string;
}
```

### PreHandler Authentication Hook (`authenticateBarber`)
1. Extract Bearer token from `Authorization` header.
2. Verify signature using Fastify JWT plugin (`@fastify/jwt`).
3. Query `Barber.deviceId` from database (or cached memory).
4. **Single-Device Enforcement:** If `token.deviceId !== barber.deviceId`, return `401 Unauthorized` with code `SESSION_SUPERSEDED`.
5. Attach `request.barber = { id, shopId, deviceId, plan }`.

---

## 4. API Endpoints & Request/Response Contracts

### Auth Module
- **`POST /auth/login`**
  - **Body**: `{ identifier: string, secret: string, type: "pin" | "password", deviceId: string }`
  - **Response 200**: `{ token: string, barber: { id, displayName, phone, plan, shopId } }`
  - **Response 401**: `{ error: "INVALID_CREDENTIALS", message: "Credenciales inválidas" }`

- **`GET /auth/me`**
  - **Headers**: `Authorization: Bearer <token>`
  - **Response 200**: Returns current barber profile and active cut (if any).

### Clients Module
- **`GET /clients/:phone/history`**
  - Returns client data and historical technical cuts to hydrate local Dexie.js cache:
  - **Response 200**:
    ```json
    {
      "client": { "id": "uuid", "phone": "70123456" },
      "profiles": [
        {
          "id": "uuid-profile-1",
          "name": "Carlos",
          "cuts": [
            {
              "id": "uuid-cut-1",
              "startedAt": "2026-10-09T14:30:00Z",
              "finishedAt": "2026-10-09T14:52:00Z",
              "chips": { "baseLateral": "#1", "tipoDegradado": "Mid Fade" },
              "photos": [{ "id": "photo-1", "r2Key": "cuts/...", "isPublic": false }]
            }
          ]
        }
      ]
    }
    ```
  - **Response 404**: `{ "exists": false, "phone": "70123456" }`

- **`POST /clients`**
  - **Body**: `{ phone: string, name: string }`
  - **Response 201**: `{ client: { id, phone }, profile: { id, name } }`

### Cuts Module
- **`POST /cuts`** (Start Cut)
  - **Body**: `{ clientProfileId: string, clientRequestId: string, startedAt?: string }`
  - **Logic**:
    1. Check if `clientRequestId` already exists -> return existing record (idempotency).
    2. Check if barber already has cut with `status: IN_PROGRESS` -> return `409 Conflict` (`ACTIVE_CUT_EXISTS`, RN-06).
    3. Verify monthly cut limit based on `Barber.plan` -> return `403 Forbidden` if limit reached (RN-03).
    4. Create `Cut` record with `status: IN_PROGRESS`.
  - **Response 201**: `{ cut: Cut }`

- **`POST /cuts/:id/finalize`** (Finalize Cut)
  - **Body**:
    ```json
    {
      "chips": {
        "baseLateral": string,
        "tipoDegradado": string,
        "parteSuperior": string,
        "barba": { "included": boolean, "alturaMejilla"?: string },
        "adicionales": string[],
        "notasEspeciales": string[]
      },
      "finishedAt"?: string
    }
    ```
  - **Logic**:
    1. Fetch Cut; verify `cut.barberId === request.barber.id`.
    2. Compute elapsed duration: `durationMinutes = (finishedAt - startedAt) / 60000`.
    3. Determine `isExpress = chips.adicionales.includes("Corte Express")`.
    4. Calculate `isRapid = isExpress ? (durationMinutes < 8) : (durationMinutes < 15)`.
    5. Update `Cut` with `status = FINISHED`, `finishedAt`, `chips`, and `rapidClosure = isRapid`. **Action is never blocked (RN-07).**
  - **Response 200**: `{ cut: Cut }`

### Photos Module
- **`POST /cuts/:id/photos/presign`**
  - **Body**: `{ contentType: "image/webp" }`
  - **Logic**:
    1. Verify cut belongs to barber.
    2. Generate S3 presigned PUT URL targeting Cloudflare R2 bucket with 300s TTL.
    3. Key format: `cuts/${barberId}/${cutId}/${uuid}.webp`.
  - **Response 200**: `{ presignedUrl: string, r2Key: string }`

- **`POST /cuts/:id/photos/confirm`**
  - **Body**: `{ r2Key: string, isPublic?: boolean }`
  - **Logic**:
    1. Insert `CutPhoto` linked to `cutId`, setting `isPublic: isPublic ?? false`.
  - **Response 201**: `{ photo: CutPhoto }`

---

## 5. Storage (Cloudflare R2 Integration)

Uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.

```ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function generatePresignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 300 });
}
```

---

## 6. Verification & Automated Testing Plan

Tests run using **Vitest** with Fastify's built-in `app.inject()` (zero network overhead, instant execution):
1. **`auth.test.ts`**: PIN & password logins, 401 on wrong secret, device invalidation.
2. **`clients.test.ts`**: Phone lookup with single profile, multiple profiles, 404 response structure.
3. **`cuts.test.ts`**:
   - RN-06: 409 Conflict when attempting second cut in progress.
   - RN-07: Finalize under 15 min succeeds (200 OK) with `rapidClosure: true`.
   - Normal cut duration finalizes with `rapidClosure: false`.
   - Idempotency with duplicated `clientRequestId`.
4. **`photos.test.ts`**: Presign URL generation and confirmation metadata with default/explicit consent.
