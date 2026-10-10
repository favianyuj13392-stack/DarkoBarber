import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import prismaPlugin from './plugins/prisma.plugin';
import authPlugin from './plugins/auth.plugin';
import s3Plugin from './plugins/s3.plugin';
import { authRoutes } from './modules/auth/auth.routes';
import { clientsRoutes } from './modules/clients/clients.routes';
import { cutsRoutes } from './modules/cuts/cuts.routes';
import { photosRoutes } from './modules/photos/photos.routes';

dotenv.config();

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify(opts);

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(s3Plugin);

  await app.register(authRoutes);
  await app.register(clientsRoutes);
  await app.register(cutsRoutes);
  await app.register(photosRoutes);

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}
