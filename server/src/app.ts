import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { defaultBodyLimit } from './utils/body-limits';
import dotenv from 'dotenv';
import websocketPlugin from './plugins/websocket.plugin';
import prismaPlugin from './plugins/prisma.plugin';
import authPlugin from './plugins/auth.plugin';
import s3Plugin from './plugins/s3.plugin';
import errorHandlerPlugin from './plugins/error-handler.plugin';
import helmet from '@fastify/helmet';
import rateLimitPlugin from './plugins/rate-limit.plugin';
import { presenceRoutes } from './modules/presence/presence.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { clientsRoutes } from './modules/clients/clients.routes';
import { cutsRoutes } from './modules/cuts/cuts.routes';
import { photosRoutes } from './modules/photos/photos.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import { emailVerificationRoutes } from './modules/rewards/email-verification.routes';
import { adminRewardsRoutes } from './modules/rewards/admin.routes';
import { startWatchdogs, stopWatchdogs } from './modules/presence/presence.watchdog';

dotenv.config();

/**
 * TRUST_PROXY is opt-in: unset means X-Forwarded-For is ignored and the socket
 * address is the client IP. Accepts "true", a hop count ("1"), or a comma-separated
 * list of trusted proxy IPs/CIDRs.
 */
function resolveTrustProxy(): boolean | number | string[] | undefined {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw || raw === 'false') return undefined;
  if (raw === 'true') return true;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const trustProxy = resolveTrustProxy();
  const app = Fastify({
    ...(trustProxy !== undefined ? { trustProxy } : {}),
    // Small global limit; image-carrying routes opt in to uploadBodyLimit() individually.
    bodyLimit: defaultBodyLimit(),
    ...opts,
  });

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [
        'https://fade.darkosync.com',
        'https://api.fade.darkosync.com',
        'http://localhost:3000',
        'http://localhost:5173',
      ];

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl) or within allowed list
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        cb(null, true);
        return;
      }
      cb(new Error('Blocked by CORS policy'), false);
    },
    credentials: true,
  });

  await app.register(errorHandlerPlugin);

  // Security headers. This server only returns JSON (no HTML), so instead of the
  // browser-page default CSP we ship the strictest one: nothing may load or frame
  // a response from the API. Other helmet defaults (HSTS, nosniff, referrer policy,
  // frame/CORP/COOP headers, X-Powered-By removal) stay enabled.
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
      },
    },
  });

  await app.register(rateLimitPlugin);
  await app.register(websocketPlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(s3Plugin);

  await app.register(presenceRoutes);
  await app.register(authRoutes);
  await app.register(clientsRoutes);
  await app.register(cutsRoutes);
  await app.register(photosRoutes);
  await app.register(bookingsRoutes);
  await app.register(emailVerificationRoutes);
  await app.register(adminRewardsRoutes, { prefix: '/admin/rewards' });

  // Register API routes with /api prefix for full client compatibility
  await app.register(async (api) => {
    await api.register(authRoutes);
    await api.register(clientsRoutes);
    await api.register(cutsRoutes);
    await api.register(photosRoutes);
    await api.register(presenceRoutes);
    await api.register(bookingsRoutes);
    await api.register(emailVerificationRoutes);
    await api.register(adminRewardsRoutes, { prefix: '/admin/rewards' });
  }, { prefix: '/api' });

  app.addHook('onReady', async () => {
    if (app.presenceService) {
      startWatchdogs(app.presenceService);
    }
  });

  app.addHook('onClose', async () => {
    stopWatchdogs();
  });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}
