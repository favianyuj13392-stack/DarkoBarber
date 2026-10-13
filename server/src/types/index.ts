import { PrismaClient, Plan } from '@prisma/client';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PresenceService } from '../modules/presence/presence.service';

export interface BarberAuthPayload {
  barberId: string;
  shopId: string | null;
  deviceId: string;
}

export interface AuthenticatedBarber {
  id: string;
  phone: string;
  displayName: string;
  shopId: string | null;
  deviceId: string | null;
  plan: Plan;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticateBarber: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    generatePresignedUrl: (key: string, contentType: string) => Promise<string>;
    presenceService: PresenceService;
  }

  interface FastifyRequest {
    barber: AuthenticatedBarber;
  }
}
