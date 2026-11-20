import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import { PresenceService } from './presence.service';
import { presenceGateway } from './presence.gateway';
import { clientPresenceMessageSchema } from './presence.schemas';
import { z } from 'zod';
import { isSessionCurrent } from '../../utils/session-version';
import { BarberAuthPayload } from '../../types';
import { checkChairBindRateLimit } from './chair-bind-rate-limit';
import { ChairBindingService } from './chair-binding.service';
import { PhotoConsentService } from './photo-consent.service';

const chairBindBodySchema = z.object({
  barberId: z.string().trim().min(1).max(64),
  barberName: z.string().trim().max(120).optional(),
  deviceId: z.string().trim().min(1).max(128).optional(),
});

const consentRequestSchema = z.object({
  clientId: z.string().trim().min(1).max(64).optional(),
  clientPhone: z.string().trim().max(32).optional(),
  cutId: z.string().trim().min(1).max(64).optional(),
  styleName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

const consentResponseSchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  isPublic: z.boolean(),
});

const chairRespondSchema = z.object({ action: z.enum(['accept', 'decline']) });

const presenceRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new PresenceService(fastify.prisma);

  const chairBindings = new ChairBindingService(fastify.prisma);

  const photoConsents = new PhotoConsentService(fastify.prisma);

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

      if (!isSessionCurrent(decoded.tv, barber.tokenVersion)) {
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

          if (message.type === 'HEARTBEAT' || message.type === 'PING') {
            const ack = await service.handleHeartbeat(barber.id);
            socket.send(
              JSON.stringify({
                type: message.type === 'PING' ? 'PONG' : 'HEARTBEAT_ACK',
                timestamp: ack.timestamp,
              })
            );
          } else if (message.type === 'UPDATE_WAITING_COUNT') {
            await service.updateWaitingCount(
              barber.id,
              barber.shopId,
              message.waitingCount
            );
          } else if (message.type === 'SET_STATUS' || message.type === 'UPDATE_STATUS') {
            await service.setStatus(barber.id, barber.shopId, message.status as any);
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
  fastify.get('/presence/map', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=3, s-maxage=5');
    const chairs = await service.getMapChairs();

    const accept = request.headers.accept || '';
    const query = (request.query as Record<string, string>) || {};

    if (accept.includes('text/html') && !query.json && !query.raw) {
      reply.type('text/html');
      return reply.send(renderMapHtml(chairs));
    }

    return reply.status(200).send(chairs);
  });

  // 2b. Public Chair Info Resolution (Immutable QR Pointer): GET /presence/chair/:barberId
  fastify.get('/presence/chair/:barberId', async (request, reply) => {
    const { barberId } = request.params as { barberId: string };
    const barber = await fastify.prisma.barber.findUnique({
      where: { id: barberId },
      include: { shop: true },
    });
    if (!barber || !barber.isActive) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Barbero no encontrado' });
    }
    return reply.status(200).send({
      barberId: barber.id,
      displayName: barber.displayName,
      avatarUrl: barber.avatarUrl || '/assets/images/1.png',
      shopName: barber.shop?.name || 'Fade Studio — Sopocachi',
      shopId: barber.shopId,
    });
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

  // 4. Client-to-Barber Chair Handshake: POST /presence/chair/bind
  // The client identity comes ONLY from the Bearer token (role 'cliente').
  fastify.post(
    '/presence/chair/bind',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser || authUser.role !== 'cliente') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'A client account is required to sit in a chair',
        });
      }

      const parsed = chairBindBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'INVALID_PAYLOAD',
          message: 'A valid barberId is required',
        });
      }
      const body = parsed.data;

      const limit = checkChairBindRateLimit(authUser.id, request.ip);
      if (!limit.allowed) {
        reply.header('Retry-After', String(limit.retryAfterSeconds));
        return reply.status(429).send({
          error: 'RATE_LIMITED',
          message: 'Too many chair scans. Try again shortly.',
        });
      }

      const barber = await fastify.prisma.barber.findUnique({
        where: { id: body.barberId },
        select: { id: true, email: true, displayName: true },
      });
      if (!barber) {
        return reply.status(404).send({ error: 'BARBER_NOT_FOUND', message: 'Barber not found' });
      }

      // Self-capture guard: a barber cannot farm rewards with their own email.
      if (
        barber.email &&
        authUser.email &&
        barber.email.trim().toLowerCase() === authUser.email.trim().toLowerCase()
      ) {
        return reply.status(403).send({
          error: 'SELF_CAPTURE_NOT_ALLOWED',
          message: 'You cannot be captured by your own account',
        });
      }

      // A client can be captured only once: the guard makes the assignment atomic.
      const capture = await fastify.prisma.client.updateMany({
        where: { id: authUser.id, firstScanBarberId: null },
        data: {
          firstScanBarberId: barber.id,
          firstScanAt: new Date(),
          acquisitionStatus: 'PENDING',
          signupIp: request.ip ?? null,
          signupDeviceId: body.deviceId ?? null,
        },
      });
      const isFirstScan = capture.count === 1;

      const acquiredCount = await fastify.prisma.client.count({
        where: { firstScanBarberId: barber.id, acquisitionStatus: 'QUALIFIED' },
      });

      const client = {
        id: authUser.id,
        displayName: authUser.displayName || 'Cliente FADE',
        phone: authUser.phone ?? '',
        email: authUser.email ?? undefined,
        avatarUrl: authUser.avatarUrl ?? undefined,
      };

      const binding = await chairBindings.createPending({
        barberId: barber.id,
        clientId: authUser.id,
        isFirstScan,
        acquiredCount,
      });

      // Attempt to notify active WebSocket connection directly
      for (const entry of presenceGateway.getAllSockets()) {
        const matchId = entry.barberId.toLowerCase() === barber.id.toLowerCase();
        if (matchId && entry.socket.readyState === WebSocket.OPEN) {
          entry.socket.send(
            JSON.stringify({
              type: 'CLIENT_CHAIR_HANDSHAKE',
              client,
              barberId: barber.id,
              timestamp: binding.createdAt.getTime(),
              requestId: binding.id,
              isFirstScan,
              acquiredCount,
            })
          );
        }
      }

      return reply.status(200).send({
        success: true,
        message: 'Chair handshake recorded and broadcasted',
        requestId: binding.id,
        expiresAt: binding.expiresAt.toISOString(),
        client,
        isFirstScan,
        acquiredCount,
      });
    }
  );

  // 5. Barber polling for a pending chair handshake: GET /presence/chair/session
  // Authenticated: the barber is taken from the token, never from the query string.
  fastify.get(
    '/presence/chair/session',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      reply.header('Pragma', 'no-cache');
      reply.header('Expires', '0');

      const binding = await chairBindings.claimNextForBarber(request.barber.id);
      if (!binding) {
        return reply.status(200).send({ hasPending: false, client: null });
      }

      return reply.status(200).send({
        hasPending: true,
        requestId: binding.id,
        client: {
          id: binding.client.id,
          displayName: binding.client.displayName || 'Cliente FADE',
          phone: binding.client.phone ?? '',
          email: binding.client.email ?? undefined,
          avatarUrl: binding.client.avatarUrl ?? undefined,
        },
        timestamp: binding.createdAt.getTime(),
        isFirstScan: binding.isFirstScan,
        acquiredCount: binding.acquiredCount,
      });
    }
  );

  // 5b. Barber accepts or dismisses a handshake addressed to them.
  fastify.post(
    '/presence/chair/session/:requestId/respond',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const { requestId } = request.params as { requestId: string };
      const parsed = chairRespondSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'INVALID_PAYLOAD', message: 'action must be accept or decline' });
      }
      const updated = await chairBindings.respond(request.barber.id, requestId, parsed.data.action);
      if (!updated) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Pending chair request not found' });
      }
      return reply.status(200).send({ requestId: updated.id, status: updated.status });
    }
  );

  // 5c. Client checks the state of their own handshake: GET /presence/chair/bind/:requestId
  fastify.get(
    '/presence/chair/bind/:requestId',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const authUser = request.authUser;
      if (!authUser || authUser.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'A client account is required' });
      }
      const { requestId } = request.params as { requestId: string };
      const row = await chairBindings.getForClient(authUser.id, requestId);
      if (!row) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Chair request not found' });
      }
      return reply.status(200).send({
        requestId: row.id,
        status: row.status,
        expiresAt: row.expiresAt.toISOString(),
      });
    }
  );

  const noStore = (reply: { header: (k: string, v: string) => unknown }) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
  };

  // 6. Barber sends a photo consent request to the client: POST /presence/chair/consent-request
  // Only ids and short text are stored; photos travel through the regular photo endpoints.
  fastify.post(
    '/presence/chair/consent-request',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      noStore(reply);
      const parsed = consentRequestSchema.safeParse(request.body ?? {});
      if (!parsed.success || (!parsed.data.clientId && !parsed.data.clientPhone)) {
        return reply
          .status(400)
          .send({ error: 'INVALID_PAYLOAD', message: 'clientId or clientPhone is required' });
      }
      const result = await photoConsents.create({ barberId: request.barber.id, ...parsed.data });
      if (!result.ok) {
        if (result.error === 'NOT_SERVING_CLIENT') {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'You can only request consent from a client you are serving',
          });
        }
        return reply.status(404).send({ error: result.error, message: 'Client or cut not found' });
      }
      return reply.status(200).send({
        success: true,
        message: 'Consent request stored',
        requestId: result.request.id,
        expiresAt: result.request.expiresAt.toISOString(),
      });
    }
  );

  // 7. Client polls for their pending photo consent request: GET /presence/chair/consent-request
  fastify.get(
    '/presence/chair/consent-request',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      noStore(reply);
      const authUser = request.authUser;
      if (!authUser || authUser.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'A client account is required' });
      }
      const row = await photoConsents.getPendingForClient(authUser.id);
      if (!row) {
        return reply.status(200).send({ hasPending: false, request: null });
      }
      return reply.status(200).send({
        hasPending: true,
        request: {
          requestId: row.id,
          barberId: row.barber.id,
          barberName: row.barber.displayName,
          clientPhone: row.client.phone ?? '',
          styleName: row.styleName ?? '',
          notes: row.notes ?? undefined,
          timestamp: row.createdAt.getTime(),
          expiresAt: row.expiresAt.toISOString(),
        },
      });
    }
  );

  // 8. Client answers their photo consent request: POST /presence/chair/consent-response
  fastify.post(
    '/presence/chair/consent-response',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      noStore(reply);
      const authUser = request.authUser;
      if (!authUser || authUser.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'A client account is required' });
      }
      const parsed = consentResponseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: 'INVALID_PAYLOAD', message: 'requestId and isPublic are required' });
      }
      const row = await photoConsents.respond(authUser.id, parsed.data.requestId, parsed.data.isPublic);
      if (!row) {
        return reply
          .status(404)
          .send({ error: 'NOT_FOUND', message: 'Pending consent request not found' });
      }

      // Notify the active barber WebSocket (best effort; polling is the source of truth).
      for (const entry of presenceGateway.getAllSockets()) {
        if (entry.barberId === row.barberId && entry.socket.readyState === WebSocket.OPEN) {
          entry.socket.send(
            JSON.stringify({
              type: 'PHOTO_CONSENT_RESPONSE',
              requestId: row.id,
              isPublic: row.isPublic,
              clientPhone: authUser.phone ?? '',
              timestamp: row.respondedAt?.getTime() ?? Date.now(),
            })
          );
        }
      }

      return reply.status(200).send({ success: true, message: 'Consent response recorded', status: row.status });
    }
  );

  // 9. Barber polls for the client's answer: GET /presence/chair/consent-response
  fastify.get(
    '/presence/chair/consent-response',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      noStore(reply);
      const { requestId } = (request.query as { requestId?: string }) || {};
      const { answered, status } = await photoConsents.consumeResponseForBarber(
        request.barber.id,
        requestId || undefined
      );
      if (!answered) {
        return reply.status(200).send({ hasResponse: false, response: null, status });
      }
      return reply.status(200).send({
        hasResponse: true,
        status,
        response: {
          requestId: answered.id,
          barberId: answered.barberId,
          clientPhone: answered.client.phone ?? '',
          isPublic: answered.isPublic,
          timestamp: answered.respondedAt?.getTime() ?? Date.now(),
        },
      });
    }
  );

  // 10. Update Barber Presence: PUT /presence/:barberId
  fastify.put(
    '/presence/:barberId',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const { barberId } = request.params as { barberId: string };

      // A barber may only mutate their own presence (prevents cross-barber sabotage)
      if (barberId !== request.barber.id) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'You can only update your own presence',
        });
      }

      const body = (request.body as Record<string, unknown>) || {};

      if (body.waitingCount !== undefined) {
        await service.updateWaitingCount(
          barberId,
          request.barber.shopId,
          Number(body.waitingCount) as any
        );
      }

      if (body.status !== undefined) {
        await service.setStatus(
          barberId,
          request.barber.shopId,
          String(body.status) as any
        );
      }

      const presence = await service.getPresence(barberId);
      return reply.status(200).send(presence);
    }
  );
};

export const presenceRoutes = fp(presenceRoutesPlugin, {
  name: 'presence-routes',
  dependencies: ['prisma-plugin', 'auth-plugin', 'websocket-plugin'],
});

function renderMapHtml(chairs: any[]): string {
  const chair = chairs[0] || {
    displayName: 'Diego',
    shopName: 'Darko Studio',
    status: 'GRAY',
    waitingCount: 0,
    updatedAt: new Date().toISOString(),
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string; desc: string }> = {
    GREEN: { label: 'LIBRE', color: '#10B981', bg: 'rgba(16,185,129,0.15)', desc: 'Sillón disponible ahora mismo' },
    RED: { label: 'CORTANDO', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', desc: 'En servicio (Cliente en sillón)' },
    YELLOW: { label: 'SALA CON ESPERA', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', desc: 'Cortando con cola en sala' },
    GRAY: { label: 'DESCONECTADO', color: '#71717A', bg: 'rgba(113,113,122,0.15)', desc: 'Barbero fuera de turno o receso' },
  };

  const current = statusConfig[chair.status] || statusConfig.GRAY;
  const waitingText = chair.waitingCount === 0 ? 'Nadie' : chair.waitingCount === 1 ? '1 a 2' : '3+';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FADE · Mapa de Ocupación en Vivo</title>
  <style>
    body { margin: 0; background: #000000; color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
    .card { width: 100%; max-width: 480px; background: #0B0B0B; border: 1px solid #222222; border-radius: 28px; padding: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .title { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #B68F4E; font-weight: 800; }
    .live-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #10B981; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } 100% { opacity: 1; transform: scale(1); } }
    .shop-name { font-size: 26px; font-weight: 800; color: #FFFFFF; margin: 0 0 6px 0; }
    .barber { font-size: 14px; color: #A1A1AA; margin: 0 0 24px 0; }
    .status-badge { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 20px; background: ${current.bg}; border: 1px solid ${current.color}40; margin-bottom: 20px; transition: all 0.3s; }
    .status-circle { width: 16px; height: 16px; border-radius: 50%; background: ${current.color}; box-shadow: 0 0 12px ${current.color}; transition: all 0.3s; }
    .status-info { flex: 1; }
    .status-label { font-size: 16px; font-weight: 800; color: ${current.color}; letter-spacing: 0.5px; transition: all 0.3s; }
    .status-desc { font-size: 12px; color: #D1D5DB; margin-top: 2px; }
    .details { background: #141414; border: 1px solid #1F1F1F; border-radius: 18px; padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 12px; }
    .details dt { color: #71717A; margin-bottom: 4px; }
    .details dd { color: #D9C9B0; font-weight: 700; margin: 0; font-size: 13px; }
    .cta-btn { display: block; text-align: center; background: #D9C9B0; color: #000000; font-weight: 800; padding: 16px; border-radius: 16px; text-decoration: none; font-size: 14px; transition: transform 0.1s; border: 1px solid #B68F4E; }
    .cta-btn:hover { transform: scale(1.02); }
    .raw-link { display: block; text-align: center; margin-top: 14px; font-size: 11px; color: #71717A; text-decoration: none; }
    .raw-link:hover { color: #A1A1AA; }
  </style>
  <script>
    setInterval(async () => {
      try {
        const res = await fetch('/presence/map?json=1');
        const data = await res.json();
        if (data && data[0]) {
          const c = data[0];
          const badge = document.getElementById('status-badge');
          const circle = document.getElementById('status-circle');
          const label = document.getElementById('status-label');
          const desc = document.getElementById('status-desc');
          const waiting = document.getElementById('waiting-count');
          const updated = document.getElementById('updated-time');
          
          const cfg = {
            GREEN: { label: 'LIBRE', color: '#10B981', bg: 'rgba(16,185,129,0.15)', desc: 'Sillón disponible ahora mismo' },
            RED: { label: 'CORTANDO', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', desc: 'En servicio (Cliente en sillón)' },
            YELLOW: { label: 'SALA CON ESPERA', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', desc: 'Cortando con gente en sala' },
            GRAY: { label: 'DESCONECTADO', color: '#71717A', bg: 'rgba(113,113,122,0.15)', desc: 'Barbero fuera de turno o receso' }
          }[c.status] || { label: c.status, color: '#71717A', bg: 'rgba(113,113,122,0.15)', desc: '' };

          badge.style.background = cfg.bg;
          badge.style.borderColor = cfg.color + '40';
          circle.style.background = cfg.color;
          circle.style.boxShadow = '0 0 12px ' + cfg.color;
          label.style.color = cfg.color;
          label.textContent = cfg.label;
          desc.textContent = cfg.desc;
          waiting.textContent = c.waitingCount === 0 ? 'Nadie' : (c.waitingCount === 1 ? '1 a 2' : '3+');
          updated.textContent = new Date(c.updatedAt).toLocaleTimeString();
        }
      } catch(e) {}
    }, 2000);
  </script>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="title">Mapa Público de Ocupación</span>
      <span class="live-tag"><span class="dot"></span> En Vivo (2s)</span>
    </div>
    <h1 class="shop-name">${chair.shopName || 'Darko Studio'}</h1>
    <p class="barber">Barbero titular: <strong>${chair.displayName || 'Diego'}</strong> · Sopocachi</p>

    <div class="status-badge" id="status-badge">
      <div class="status-circle" id="status-circle"></div>
      <div class="status-info">
        <div class="status-label" id="status-label">${current.label}</div>
        <div class="status-desc" id="status-desc">${current.desc}</div>
      </div>
    </div>

    <div class="details">
      <div>
        <dt>Gente en Sala</dt>
        <dd id="waiting-count">${waitingText}</dd>
      </div>
      <div>
        <dt>Última Sincronización</dt>
        <dd id="updated-time">${new Date(chair.updatedAt).toLocaleTimeString()}</dd>
      </div>
    </div>

    <a href="http://localhost:5173" class="cta-btn" target="_blank">Abrir PWA de Barberos (FADE) &rarr;</a>
    <a href="/presence/map?json=1" class="raw-link">Ver respuesta JSON cruda para desarrolladores</a>
  </div>
</body>
</html>`;
}

