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
import { startWatchdogs, stopWatchdogs } from './modules/presence/presence.watchdog';

dotenv.config();

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(opts);

  await app.register(cors, {
    origin: true,
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
