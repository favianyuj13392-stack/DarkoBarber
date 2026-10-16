import { PrismaClient, Plan } from '@prisma/client';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PresenceService } from '../modules/presence/presence.service';

export interface BarberAuthPayload {
  barberId: string;
  userId?: string;
  role?: 'barbero' | 'cliente';
  shopId: string | null;
  deviceId: string;
}

export interface AuthPayload {
  userId: string;
  role: 'barbero' | 'cliente';
  barberId?: string;
  shopId?: string | null;
  deviceId?: string;
}

export interface AuthenticatedBarber {
  id: string;
  phone: string | null;
  email?: string | null;
  displayName: string;
  shopId: string | null;
  deviceId: string | null;
  plan: Plan;
}

export interface AuthenticatedUser {
  id: string;
  role: 'barbero' | 'cliente';
  email: string | null;
  displayName: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  shopId?: string | null;
  plan?: Plan;
  deviceId?: string | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthPayload;
    user: AuthenticatedUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    authenticateBarber: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    generatePresignedUrl: (key: string, contentType: string) => Promise<string>;
    presenceService: PresenceService;
  }

  interface FastifyRequest {
    barber: AuthenticatedBarber;
    authUser?: AuthenticatedUser;
  }
}
