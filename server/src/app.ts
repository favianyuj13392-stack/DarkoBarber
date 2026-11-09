import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import websocketPlugin from './plugins/websocket.plugin';
import prismaPlugin from './plugins/prisma.plugin';
import authPlugin from './plugins/auth.plugin';
import s3Plugin from './plugins/s3.plugin';
import { presenceRoutes } from './modules/presence/presence.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { clientsRoutes } from './modules/clients/clients.routes';
import { cutsRoutes } from './modules/cuts/cuts.routes';
import { photosRoutes } from './modules/photos/photos.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import { startWatchdogs, stopWatchdogs } from './modules/presence/presence.watchdog';

dotenv.config();

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 30 * 1024 * 1024, // 30 MB body limit for mobile photos and multi-angle portfolios
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

  // Register API routes with /api prefix for full client compatibility
  await app.register(async (api) => {
    await api.register(authRoutes);
    await api.register(clientsRoutes);
    await api.register(cutsRoutes);
    await api.register(photosRoutes);
    await api.register(presenceRoutes);
    await api.register(bookingsRoutes);
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
