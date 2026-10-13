import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import { PresenceService } from './presence.service';
import { presenceGateway } from './presence.gateway';
import { clientPresenceMessageSchema } from './presence.schemas';
import { BarberAuthPayload } from '../../types';

const presenceRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new PresenceService(fastify.prisma);

  // Expose service on root fastify instance for watchdog and cut hooks
  fastify.decorate('presenceService', service);

  // 1. WebSocket Route: /ws/presence?token=...
  fastify.get(
    '/ws/presence',
    { websocket: true },
    async (socket: WebSocket, request) => {
      const query = request.query as { token?: string };
      const token = query?.token;

      if (!token) {
        socket.close(4401, 'Unauthorized');
        return;
      }

      let decoded: BarberAuthPayload;
      try {
        decoded = fastify.jwt.verify<BarberAuthPayload>(token);
      } catch {
        socket.close(4401, 'Unauthorized');
        return;
      }

      const barber = await fastify.prisma.barber.findUnique({
        where: { id: decoded.barberId },
      });

      if (!barber) {
        socket.close(4401, 'Unauthorized');
        return;
      }

      if (barber.deviceId && decoded.deviceId !== barber.deviceId) {
        socket.close(4401, 'Session superseded');
        return;
      }

      // Register connection in memory gateway
      presenceGateway.registerSocket(barber.id, barber.shopId, socket);

      // Attach listeners before async DB setup so no client messages are dropped
      socket.on('message', async (rawData) => {
        try {
          const rawString = rawData.toString();
          let json: unknown;
          try {
            json = JSON.parse(rawString);
          } catch {
            socket.send(
              JSON.stringify({
                type: 'ERROR',
                code: 'INVALID_JSON',
                message: 'Invalid JSON payload',
              })
            );
            return;
          }

          const parseResult = clientPresenceMessageSchema.safeParse(json);
          if (!parseResult.success) {
            socket.send(
              JSON.stringify({
                type: 'ERROR',
                code: 'INVALID_PAYLOAD',
                message: 'Invalid message structure or disallowed status',
              })
            );
            return;
          }

          const message = parseResult.data;

          if (message.type === 'HEARTBEAT') {
            const ack = await service.handleHeartbeat(barber.id);
            socket.send(
              JSON.stringify({
                type: 'HEARTBEAT_ACK',
                timestamp: ack.timestamp,
              })
            );
          } else if (message.type === 'UPDATE_WAITING_COUNT') {
            await service.updateWaitingCount(
              barber.id,
              barber.shopId,
              message.waitingCount
            );
          } else if (message.type === 'SET_STATUS') {
            await service.setStatus(barber.id, barber.shopId, message.status);
          }
        } catch (err: any) {
          fastify.log.error(err, '[PresenceWS] Error processing message');
          socket.send(
            JSON.stringify({
              type: 'ERROR',
              code: 'INTERNAL_ERROR',
              message: err.message ?? 'Internal error processing message',
            })
          );
        }
      });

      socket.on('close', async () => {
        const wasActive = presenceGateway.removeSocket(barber.id, socket);
        if (wasActive) {
          await service.handleDisconnect(barber.id, barber.shopId);
        }
      });

      // Handle connection initialization in service
      try {
        const initial = await service.handleConnect(
          {
            id: barber.id,
            phone: barber.phone,
            displayName: barber.displayName,
            shopId: barber.shopId,
            deviceId: barber.deviceId,
            plan: barber.plan,
          },
          socket
        );

        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'PRESENCE_CONNECTED',
              status: initial.status,
              waitingCount: initial.waitingCount,
              activeCutId: initial.activeCutId,
            })
          );
        }
      } catch (err: any) {
        fastify.log.error(err, '[PresenceWS] Error on handleConnect');
        socket.close(1011, 'Internal connection error');
      }
    }
  );

  // 2. Public HTTP Map Endpoint: GET /presence/map
  fastify.get('/presence/map', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=3, s-maxage=5');
    const chairs = await service.getMapChairs();
    return reply.status(200).send(chairs);
  });

  // 3. Authenticated Barber Presence: GET /presence/me
  fastify.get(
    '/presence/me',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const presence = await service.getPresence(request.barber.id);
      if (!presence) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Presence record not found',
        });
      }
      return reply.status(200).send(presence);
    }
  );
};

export const presenceRoutes = fp(presenceRoutesPlugin, {
  name: 'presence-routes',
  dependencies: ['prisma-plugin', 'auth-plugin', 'websocket-plugin'],
});
