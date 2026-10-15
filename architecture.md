# DarkoSync Barber — Arquitectura Técnica Definitiva

**Versión:** 1.1  
**Fecha:** 9 de octubre 2026  
**Estado:** Aprobado para MVP (validado por cruzamiento de arquitecturas)  
**Principio rector:** Simplicidad Radical. El dispositivo del barbero es la fuente de verdad mientras trabaja. El servidor es un peer de sincronización y la autoridad final cuando hay conflicto. Un equipo muy pequeño debe poder mantener esto sin quemarse.

> Este documento define cómo fluyen los datos, cómo se maneja el offline, el semáforo en tiempo real y las fotos.  
> Cualquier cambio de arquitectura debe actualizarse aquí primero.

---

## 0. Criterios que gobiernan esta arquitectura

1. Cumplir los criterios de aceptación del producto (registro < 25 s, semáforo < 3 s, offline real, 70 % adopción historial).
2. Ser manejable por un equipo muy pequeño (1-3 personas).
3. Costo bajo y predecible los primeros 6 meses.
4. Dejar el terreno listo para escalar sin reescribir.
5. Evitar cualquier pieza que no aporte valor inmediato al barbero en el sillón.

---

## 1. Visión de Arquitectura (Resumen de 30 segundos)

```
┌─────────────────────────────────────────────────────────────┐
│                     DISPOSITIVO DEL BARBERO                 │
│  (PWA instalada – iOS Safari / Android Chrome)              │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │  UI (React) │←→│ IndexedDB    │←→│ Outbox (cola)     │ │
│  │  Optimistic │   │ (Dexie.js)   │   │ + fotos locales  │ │
│  └─────────────┘   └──────────────┘   └──────────────────┘ │
│         ↑                   ↑                    │          │
│         │                   │                    ▼          │
│  Service Worker + Background Sync (o fallback online event) │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ (cuando hay señal)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE + VPS                        │
│                                                             │
│  Cloudflare Pages ──► Frontend estático + PWA assets        │
│                                                             │
│  VPS (Docker)                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Fastify (Node.js + TS) — AUTORIDAD DE AUTORIZACIÓN  │  │
│  │  • Valida JWT de sesión / tokens                     │  │
│  │  • Única frontera de reglas de negocio               │  │
│  │    (RN-06, RN-07 no bloqueante con flag, límites)    │  │
│  │  • Genera presigned URLs de R2                       │  │
│  │  • WebSocket rooms (exclusivo para barberos)         │  │
│  │  • Endpoint HTTP / SSE para mapa público de clientes │  │
│  │  • Timeout de turno fantasma (TTL simple en memoria) │  │
│  │  • Prisma → escribe en PostgreSQL                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Cloudflare R2  ←── fotos directas desde el navegador       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE                                │
│  • PostgreSQL (fuente de verdad relacional)                 │
│  • Auth (Email/PIN barberos + Teléfono clientes sin OTP)    │
│  • RLS como defensa en profundidad (Prisma opera en backend)│
└─────────────────────────────────────────────────────────────┘
```

**Redis NO está en el MVP.** Se añade solo cuando haga falta (ver sección 9).

---

## 2. Por qué esta arquitectura (y no la más “completa”)

| Alternativa | Por qué la descartamos para el MVP |
|-------------|------------------------------------|
| Next.js + Vercel | Añade peso y complejidad innecesaria para una PWA de campo. Vite da más control offline y es más liviano. |
| Redis desde el día 1 | Útil, pero no obligatorio con 5-30 barberos concurrentes. Añade costo y superficie de mantenimiento. |
| PowerSync / ElectricSQL / RxDB | Overkill. Un barbero casi nunca edita el mismo registro desde dos dispositivos a la vez. |
| Todo online + cache | Muere en sótanos de La Paz. El barbero abandonaría la app el segundo día. |
| CRDTs (Yjs/Automerge) | Innecesarios. Los conflictos reales son raros y se resuelven con LWW + reglas de negocio. |
| Subir fotos a través del VPS | Quema CPU y ancho de banda. Presigned URL a R2 es más barato y rápido. |
| Solo Supabase Realtime para presencia | Funciona, pero el control fino (RN-06, RN-07, timeout, device único) es más limpio en nuestro backend. |
| Microservicios / Kubernetes | Rompe el principio de Simplicidad Radical para un equipo pequeño. |

---

## 2.1 Decisión: Offline-Light pospuesto / no implementado en MVP

> **Fecha de la decisión:** 15 de octubre 2026  
> **Estado:** APROBADO (Actualización de alcance MVP)  
> **Estrategia activa:** Online-First con UI Optimista y Reintentos Simples.

### Motivo
Después de análisis de campo, se determina que la complejidad de Offline-Light / Local-First (Dexie.js + Outbox + sincronización completa) NO se justifica en el MVP de DarkoSync Barber / FADE:
- En la gran mayoría de locales comerciales reales de La Paz (Sopocachi, Miraflores, San Miguel, Centro) la conectividad 4G y WiFi es estable y suficiente.
- Los casos de “sótano sin señal” son extremadamente raros en salones comerciales de las zonas piloto.
- El costo de sobreingeniería (código extra, tests con mocks de IndexedDB, colisiones de sincronización y riesgo de datos huérfanos) no se justifica por el beneficio real inmediato.

### Qué se deja de lado (en Standby / No prioritario para MVP)
- Persistencia local agresiva con Dexie.js como Single Source of Truth para la UI.
- Cola Outbox FIFO persistida en disco con motor `syncEngine` y drenado en segundo plano.
- Sincronización bidireccional compleja y persistencia de fotos en Blobs locales antes de subir.

### Qué se mantiene como mínimo aceptable (Estándar MVP)
- **Llamadas normales a la API REST (Fastify en puerto 4000):** Consumo directo vía HTTP `fetch` / TanStack Query.
- **Idempotencia con `clientRequestId`:** Se mantiene intacta. Toda mutación sensible (`POST /cuts`, `PATCH /cuts/:id`) envía `X-Client-Request-Id` (UUID v4). El backend garantiza que los reintentos de red normales nunca dupliquen un corte.
- **UI Optimista y Reintentos Simples:** Feedback visual inmediato al presionar botones (cambio de estado local en memoria reactiva) con 1 a 2 reintentos automáticos transparentes si una llamada HTTP falla por latencia transitoria.
- **WebSocket en Vivo:** El barbero mantiene su conexión WebSocket a `/ws/presence` para presencia en tiempo real y latidos cada 35 s.

---

## 3. Capas de Datos (Local-First — Standby para Fase Post-MVP)

> [!NOTE] STANDBY PARA FASE POST-MVP
> Las especificaciones de Dexie.js y Outbox detalladas a continuación quedan documentadas como referencia de evolución futura, pero NO se implementan en el MVP. El frontend del MVP operará en modo Online-First con llamadas REST directas, UI optimista y reintentos simples con `clientRequestId`.

### 3.1 IndexedDB como fuente primaria (cliente)

Usamos **Dexie.js**.

```ts
db.version(1).stores({
  clients:          'id, phone, updatedAt',
  cuts:             'id, clientId, barberId, status, createdAt, updatedAt, synced',
  cutPhotos:        'id, cutId, localBlobKey, r2Key, status', // local | uploading | synced
  presence:         'barberId, status, waitingCount, updatedAt',
  outbox:           '++id, type, payload, clientRequestId, createdAt, attempts, lastError',
  syncMeta:         'key, value'
});
```

- Toda lectura de UI viene de IndexedDB (instantánea).
- Toda escritura va primero a IndexedDB + se encola en `outbox`.

### 3.2 Outbox Pattern (Offline-Light)

```ts
{
  id: 42,
  type: 'CREATE_CUT' | 'UPDATE_PRESENCE' | 'FINALIZE_CUT' | 'UPLOAD_PHOTO_META',
  payload: { ... },
  clientRequestId: 'uuid-v4',   // idempotencia
  createdAt: 1728...,
  attempts: 0,
  lastError: null
}
```

- Idempotente (backend usa `clientRequestId`).
- Orden FIFO por barbero.
- Retención corta / offline-light: enfocado en cortes transitorios (1-2 horas sin red).
- Drenado en evento `online` + `visibilitychange` (soporte garantizado en Android y Safari iOS).

### 3.3 Conflictos

| Tipo de dato       | Estrategia                         | Motivo |
|--------------------|------------------------------------|--------|
| Ficha de corte     | Last-Write-Wins + clientRequestId | Un solo escritor |
| Estado del semáforo| Server-authoritative + timeout    | Backend aplica reglas |
| Foto               | Append-only                       | Nunca se edita |
| Historial cliente  | Append-only                       | Solo se agregan cortes |

### 3.4 Pull / Hidratación de Historial (con red)

- Cuando hay señal y el cliente escanea el QR o el barbero tipea el teléfono: `GET /clients/:phone/history`.
- Fastify valida permisos, recupera el perfil y los últimos cortes técnicos desde PostgreSQL, e hidrata Dexie.js localmente.
- Si no hay red (sótano), se pasa a modo degradado: la app no se bloquea esperando datos remotos y permite registrar la sesión localmente como un nuevo corte.

---

## 4. Flujo Crítico 1: Registro de Corte (Offline-Light)

1. Cliente escanea QR o barbero ingresa teléfono → si hay red, se hidrata historial y chips pre-cargados (“Repetir último corte”); si no hay red, inicia en modo nuevo/local.
2. Barbero ajusta chips + (opcional) toma fotos con consentimiento presencial en el sillón → se comprimen en el navegador → se guardan temporalmente en IndexedDB.
3. “Guardar y Finalizar” → escritura local en Dexie + outbox → UI optimista inmediata → Micro-Tap. (RN-07 nunca bloquea; si duró < 15 min se marca con `rapid_closure: true`).
4. Micro-Tap actualiza presencia local + outbox (y WebSocket si hay conexión).
5. Al recuperar señal: se drena el outbox → Fastify valida reglas y autoriza → Prisma escribe → presigned URLs → subida directa a R2 → confirmación.

**Tiempo percibido por el barbero:** < 1 segundo.  
**Sincronización real:** en cuanto vuelve la conexión.

---

## 5. Flujo Crítico 2: Semáforo en Tiempo Real

### 5.1 Modelo

```ts
type PresenceStatus = 'green' | 'red' | 'yellow' | 'gray';

interface Presence {
  barberId: string;
  status: PresenceStatus;
  waitingCount: 0 | 1 | 2; // 0, 1-2, 3+
  activeCutId: string | null;
  updatedAt: string;
  lastHeartbeat: string;
}
```

### 5.2 Transporte

- **Barberos (Bidireccional):** WebSocket nativo (Fastify).
  - Rooms por `barberId` y `shopId`.
  - Envío de presencia y heartbeats cada 30-45 s. Sin heartbeat en 90 s → `gray`.
- **Clientes / Mapa público (Lectura masiva):** Endpoint HTTP (`GET /presence/map`) con caché corta o Server-Sent Events (SSE) ligeros.
  - Evita saturar el VPS con cientos de WebSockets abiertos por usuarios pasivos que solo miran el mapa.
- **Persistencia:** Último estado en tabla `presence` de PostgreSQL.

### 5.3 Timeout de “Turno Fantasma” (RF-2.4) — enfoque simple

**MVP (sin Redis):**
- Al pasar a `red` se registra `expiresAt = now + 50 minutos` en la fila de `presence` (o en la ficha activa).
- Un chequeo liviano en el backend (cada 60-90 s o al recibir cualquier evento de ese barbero) cierra las fichas expiradas y emite el cambio a `green`.
- Alternativa aún más simple: el propio cliente del barbero, al recuperar foco o al hacer heartbeat, pregunta “¿sigo en rojo hace más de 50 min?” y el backend responde con el cierre.

**Fase 1.5 (cuando se añada Redis):**
- `SET presence:{barberId} "red" EX 3000`
- Escuchar el evento de expiración de Redis y emitir el cambio a `green`.  
  Exactamente la idea elegante de la otra arquitectura, pero solo cuando el volumen lo justifique.

---

## 6. Flujo de Fotos (R2 Presigned)

```
Cliente → POST /cuts/:id/photos/presign → Backend genera key + URL firmada (5 min)
Cliente → PUT directo a R2
Cliente → POST /cuts/:id/photos/confirm → Backend guarda metadata
```

- Nunca pasa el binario por el VPS.
- Compresión a WebP en el navegador.
- Foto opcional.

---

## 7. Modelo de Datos (alto nivel)

```prisma
model Barber {
  id            String   @id @default(uuid())
  userId        String   @unique
  displayName   String
  shopId        String?
  plan          Plan
  deviceId      String?
  cuts          Cut[]
  presence      Presence?
}

model Client {
  id            String   @id @default(uuid())
  phone         String   @unique
  profiles      ClientProfile[]
}

model ClientProfile {
  id            String   @id @default(uuid())
  clientId      String
  name          String
  cuts          Cut[]
}

model Cut {
  id                String   @id @default(uuid())
  clientRequestId   String   @unique
  barberId          String
  clientProfileId   String
  status            CutStatus
  chips             Json
  startedAt         DateTime
  finishedAt        DateTime?
  photos            CutPhoto[]
}

model CutPhoto {
  id          String   @id @default(uuid())
  cutId       String
  r2Key       String
  isPublic    Boolean  @default(false)
}

model Presence {
  barberId      String   @id
  status        PresenceStatus
  waitingCount  Int
  activeCutId   String?
  updatedAt     DateTime
  lastHeartbeat DateTime
  expiresAt     DateTime?  // para el timeout simple del MVP
}
```

(El schema completo + índices + RLS se define en `data-model.md`).

---

## 8. Seguridad y Reglas de Negocio (Fastify es la única frontera de autorización)

> **Nota técnica fundamental:** Dado que Fastify se conecta a PostgreSQL mediante Prisma (usando credenciales directas de conexión), **Prisma se salta el Row Level Security (RLS) de Supabase**. Por lo tanto, el backend Fastify asume el 100% de la responsabilidad de autenticar, autorizar y validar todas las reglas de negocio en TypeScript. Las políticas RLS en base de datos quedan únicamente como defensa en profundidad secundaria.

| Regla | Dónde se aplica | Comportamiento |
|-------|-----------------|----------------|
| RN-06 (un solo corte activo) | Fastify: al crear/activar un cut | Rechaza si ya existe un cut en progreso para ese barbero. |
| RN-07 (anti-ráfaga no bloqueante) | Fastify + Cliente: al finalizar cut | NUNCA bloquea el guardado. Si duración < 15 min (o < 8 min en express), guarda y marca `rapid_closure: true`. |
| Límite de cortes del plan | Fastify: antes de CREATE_CUT | Bloquea nueva ficha al superar el cupo mensual. |
| Device único | Fastify: middleware JWT + deviceId | Invalida sesiones anteriores del mismo barbero. |
| Consentimiento de foto | Fastify: confirmación de foto | Se define en el sillón presencialmente (`isPublic: boolean`). |
| Acceso al historial | Fastify: endpoint de hidratación | Permite lectura al ingresar teléfono o escanear QR. |

---

## 9. Plan de Escalado (cuándo añadir piezas)

| Señal de que hace falta | Acción | Esfuerzo estimado |
|-------------------------|--------|-------------------|
| Más de ~40-50 barberos concurrentes o necesidad de varias instancias del backend | Añadir **Redis** (pub/sub de presencia + cola + TTL nativo) | 1-2 días |
| Supabase se pone caro | Migrar Postgres al VPS | 1 fin de semana |
| Conflictos reales multi-dispositivo del mismo barbero | Evaluar PowerSync o RxDB | 1-2 semanas |
| Necesidad de app nativa | Reutilizar el mismo backend + mismo modelo de outbox | — |

**Principio:** no pagamos complejidad hasta que el dolor sea real.

---

## 10. Safari iOS (el punto débil realista)

- Background Sync no existe en iOS Safari.
- Solución: Outbox ligero (1-2 horas de retención) + drenado en `online` y `visibilitychange`.
- UI clara: chip discreto “Pendiente de sincronizar (N)”.
- No se requiere persistencia agresiva de Blobs por días: el barbero sincroniza al recuperar red en su turno.

---

## 11. Decisiones Congeladas

| Decisión | Estado | Motivo |
|----------|--------|--------|
| Offline-light (Outbox simple) | Congelado | Suficiente para caídas breves de red sin complejidad innecesaria |
| Fastify como única frontera de autorización | Congelado | Prisma opera en backend y bypasses RLS de Supabase |
| Vite + React + PWA (no Next.js) | Congelado | Más control offline + menos peso |
| Dexie.js + Zustand en PWA barbero | Congelado | Fuente única de verdad local sin colisión con TanStack Query |
| Sin Redis ni BullMQ en MVP | Congelado | Simplicidad Radical para equipo de 1-3 personas |
| WebSocket solo para barberos / HTTP para mapa | Congelado | Control fino de sillones sin saturar el VPS |
| Fotos directas a R2 (presigned) | Congelado | Ahorro de CPU y ancho de banda en VPS |
| RN-07 no bloqueante (`rapid_closure: true`) | Congelado | Cero fricción operativa en el sillón |
| Auth pragmática (PIN/Email barbero, teléfono cliente sin OTP) | Congelado | Evita la alta tasa de fallo de SMS en Bolivia |
| Monolito modular (Node.js + Fastify + TS) | Congelado | Mantenible y fácil de desplegar |

---

## 12. Próximos documentos

1. `data-model.md` → schema Prisma completo + índices + políticas RLS
2. `api-contracts.md` → endpoints REST + eventos WebSocket
3. `offline-sync-spec.md` → detalle del outbox, reintentos e idempotencia
4. Estructura de carpetas del monolito modular

---

**Este documento es la fuente de verdad arquitectónica.**  
Cualquier propuesta que añada piezas (Redis, Next.js, sync engines, etc.) debe justificar por qué el dolor actual ya justifica el costo de complejidad para un equipo muy pequeño.
