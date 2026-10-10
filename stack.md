# DarkoSync Barber — Stack Técnico Definitivo

**Versión:** 1.0  
**Fecha:** 9 de octubre 2026  
**Estado:** Aprobado para MVP  
**Principio:** Barato, controlable, offline-first, cero fricción operativa en el sillón.

> Este documento es la fuente de verdad de arquitectura.  
> Cualquier cambio de stack debe actualizarse aquí primero y justificar el motivo.

---

## 1. Resumen Ejecutivo del Stack

| Capa                    | Tecnología                          | Justificación principal                                      | Costo estimado MVP |
|-------------------------|-------------------------------------|--------------------------------------------------------------|--------------------|
| Frontend                | Vite + React + TypeScript + PWA     | Rápido, offline-light real, excelente DX                    | $0 (Cloudflare)   |
| Hosting Frontend        | Cloudflare Pages                    | CDN global, preview deploys, integración nativa con R2       | $0                |
| Backend                 | Node.js + TypeScript + Fastify      | Mismo lenguaje que frontend, WebSockets nativos, liviano     | VPS (~$6-12/mes)  |
| Base de datos + Auth    | Supabase (PostgreSQL + Auth)        | PostgreSQL relacional + Auth simplificada (PIN/email)        | Free → $25/mes    |
| Storage de imágenes     | Cloudflare R2                       | Más barato del mercado, sin egress, ya lo tenemos            | Casi $0           |
| ORM                     | Prisma                              | Productividad + type-safety + migraciones claras             | $0                |
| Real-time (semáforo)    | WebSockets (Fastify p/ barberos) + HTTP/SSE (mapa público) | Control fino de sillones sin saturar sockets | Incluido |
| Offline & Sync          | Service Worker + Dexie.js + Outbox ligero | Caídas breves de señal resueltas sin sobreingeniería   | $0                |
| Contenedores            | Docker + Docker Compose             | Reproducibilidad local y producción                          | $0                |
| CI/CD                   | GitHub Actions                      | Simple y suficiente                                          | $0                |

---

## 2. Frontend

### Core
- **Vite** (bundler)
- **React 18+** + **TypeScript**
- **React Router**
- **Zustand** (estado global transitorio y UI)
- **Dexie.js** + `dexie-react-hooks` (`useLiveQuery` como fuente única de verdad reactiva para el barbero)
- *TanStack Query:* reservado únicamente para el portal público de clientes si se requiere cachear endpoints HTTP de lectura

### PWA & Offline-Light
- `vite-plugin-pwa` (Workbox)
- IndexedDB gobernado por Dexie.js para fichas locales y cola Outbox (retención corta de 1-2 horas)
- Drenado de cola en eventos `online` y `visibilitychange` (compatible con Android y Safari iOS)
- Modo oscuro OLED forzado (CSS variables + `prefers-color-scheme`)

### UI
- Tailwind CSS + Headless UI o Radix (solo lo necesario)
- Touch targets mínimos 48×48 dp
- Toda acción primaria en thumb-zone (tercio inferior)

### Hosting
- **Cloudflare Pages**
- Build command: `npm run build`
- Output directory: `dist`
- Variables de entorno para API URL y claves públicas

---

## 3. Backend

### Runtime & Framework
- **Node.js 20 LTS** (o 22)
- **TypeScript**
- **Fastify** (única frontera de autorización y validación de reglas de negocio)
- Plugins oficiales: `@fastify/websocket`, `@fastify/cors`, `@fastify/jwt` (sin `@fastify/multipart`)

### Estructura recomendada
```
src/
├── modules/
│   ├── auth/          # email/PIN barberos + lookup cliente
│   ├── cuts/          # fichas + chips + anti-ráfaga con flag
│   ├── presence/      # semáforo (WebSocket barberos + HTTP mapa)
│   ├── portfolio/
│   └── sync/          # drenado outbox + hidratación pull
├── plugins/
├── lib/               # supabase client, r2 client, prisma
└── app.ts
```

### Autenticación
- Barberos: Email + password o PIN numérico rápido de 4 dígitos + control de sesión única
- Clientes: Número de teléfono simple (sin OTP mandatorio por SMS para evitar fallos de operadoras en Bolivia)
- Fastify valida credenciales y tokens en cada request protegido

### Real-time (Semáforo)
- WebSocket nativo con Fastify exclusivo para terminales de barberos
- Endpoint HTTP con caché o SSE para el mapa público de clientes
- Rooms por `barberId` y `shopId`

### Uploads de fotos
- El frontend comprime a WebP en el navegador y sube directo a R2 con URL pre-firmada por Fastify
- El backend nunca recibe el archivo binario (ahorra CPU y ancho de banda del VPS)

---

## 4. Base de Datos & Auth → Supabase

- **PostgreSQL** managed
- **Supabase Auth** (OTP + email)
- Row Level Security (RLS) activado desde el día 1
- Tablas principales (borrador):
  - `barbers`
  - `shops`
  - `clients`
  - `cuts` (fichas técnicas + chips en JSONB o columnas tipadas)
  - `cut_photos`
  - `presence` (estado actual del sillón)
  - `follows`
  - `subscriptions` / `plans`

### Por qué Supabase y no Postgres self-hosted en el VPS
- Auth OTP lista (crítico en Bolivia)
- Backups automáticos
- Dashboard para debug
- Realtime opcional
- Migración futura a VPS es trivial (es Postgres estándar)

---

## 5. Storage de Imágenes → Cloudflare R2

- Bucket privado
- URLs pre-firmadas de escritura (expire 5-10 min)
- URLs públicas de lectura firmadas o con dominio custom
- Organización de keys:
  ```
  cuts/{barberId}/{cutId}/{uuid}.webp
  portfolio/{barberId}/{uuid}.webp
  ```
- Compresión y conversión a WebP/AVIF se puede hacer en el cliente (browser) o con un worker de Cloudflare si hace falta

---

## 6. ORM → Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // para migraciones con Supabase
}
```

- Migraciones versionadas en el repo
- Prisma Client generado en el backend
- Uso de `JSONB` para los chips del corte (flexibilidad sin migraciones constantes)

**Alternativa futura:** Drizzle si el equipo prefiere más control y menos magia.

---

## 7. Infraestructura & DevOps

### VPS
- Proveedor recomendado: Hetzner, Contabo o equivalente barato y estable
- Spec inicial: 2-4 vCPU / 4-8 GB RAM / 40-80 GB SSD
- Ubuntu 24.04 LTS
- Docker + Docker Compose
- Caddy o Nginx como reverse proxy (SSL automático)

### Docker Compose (producción)
Servicios:
- `api` (backend Fastify)
- (Redis **no** está en el MVP — eliminado para evitar sobrecostos y complejidad operativa)
- (Postgres **no** va aquí → está en Supabase)

### CI/CD (GitHub Actions)
1. Push a `main`:
   - Build + test frontend → deploy a Cloudflare Pages
   - Build backend → SSH al VPS → `docker compose pull && docker compose up -d`
2. Preview environments en PRs (Cloudflare Pages lo da gratis)

### Monitoreo mínimo viable
- Uptime Kuma o Better Uptime (ping al healthcheck del backend)
- Logs del backend rotados o enviados a un servicio barato (Axiom free tier / Logtail)
- Alertas por Telegram o email cuando el semáforo o la API caen

---

## 8. Librerías Clave (versiones orientativas)

**Frontend**
- `vite` + `vite-plugin-pwa`
- `react` + `react-dom`
- `typescript`
- `dexie` + `dexie-react-hooks` (fuente única de verdad reactiva local)
- `zustand` (estado transitorio UI/sesión)
- `tailwindcss`
- `@tanstack/react-query` (únicamente si se requiere en el portal cliente)

**Backend**
- `fastify`
- `@fastify/websocket`
- `@fastify/jwt`
- `@fastify/cors`
- `@supabase/supabase-js`
- `@aws-sdk/client-s3` (compatible con Cloudflare R2)
- `prisma` + `@prisma/client`
- `zod` (validación estricta de esquemas y reglas de negocio)

---

## 9. Decisiones de Arquitectura Congeladas (MVP)

| Decisión                         | Estado     | Motivo |
|----------------------------------|------------|--------|
| Web-first (PWA)                  | Congelado  | Cero fricción de descarga |
| Offline-light (Dexie + Outbox)   | Congelado  | Cubre cortes breves sin sobreingeniería |
| Fastify como única frontera auth | Congelado  | Prisma en backend se salta RLS de Supabase |
| Dexie.js + Zustand               | Congelado  | DX limpia, sin colisión de cachés |
| Imágenes directas en R2          | Congelado  | Costo casi nulo y ahorro de CPU |
| Frontend en Cloudflare Pages     | Congelado  | No cargar el VPS |
| Backend en VPS (Fastify)         | Congelado  | Control + costo predecible ($6-12) |
| Sin Redis ni BullMQ en MVP       | Congelado  | Simplicidad Radical |
| RN-07 no bloqueante (`rapid_closure`) | Congelado | No trabar al barbero en el sillón |
| Auth pragmática (PIN/email)      | Congelado  | Evitar fragilidad de SMS en Bolivia |
| Un solo corte activo por barbero | Congelado  | RN-06 |

---

## 10. Lo que NO se hace en el MVP

- App nativa (React Native / Flutter)
- Cloudinary u otro storage caro
- Next.js (innecesario para esta PWA)
- Self-hosted Postgres (por ahora)
- Kubernetes / orquestadores complejos
- Microservicios
- GraphQL (REST + WebSockets es suficiente)

---

## 11. Criterio de Cambio de Stack

Solo se cambia una pieza del stack si se cumple **al menos una** de estas condiciones:

1. El costo mensual supera el 15% de los ingresos recurrentes.
2. Un cuello de botella de rendimiento afecta la experiencia del barbero en el sillón (latencia > 300 ms o caídas).
3. La complejidad operativa (mantener X) está consumiendo más de 4-5 horas semanales.
4. Aparece un requisito de producto que la tecnología actual no puede cumplir de forma limpia.

Cualquier cambio debe documentarse en este archivo con fecha, motivo y responsable.

---

**Próximo documento recomendado:**  
`architecture.md` (diagrama de flujo de datos + modelo de datos detallado + estrategia de sincronización offline)
