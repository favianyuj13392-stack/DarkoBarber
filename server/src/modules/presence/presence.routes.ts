import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import { PresenceService } from './presence.service';
import { presenceGateway } from './presence.gateway';
import { clientPresenceMessageSchema } from './presence.schemas';
import { BarberAuthPayload } from '../../types';

const presenceRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new PresenceService(fastify.prisma);

  interface ChairBindingPayload {
    barberId: string;
    barberName?: string;
    client: {
      displayName: string;
      phone: string;
      avatarUrl?: string;
      notes?: string;
    };
    timestamp: number;
  }

  const pendingChairBindings = new Map<string, ChairBindingPayload>();

  interface ConsentRequestPayload {
    barberId: string;
    barberName: string;
    clientPhone: string;
    photoUrl: string;
    photos?: Array<{ id: string; url: string; angle: string }>;
    styleName: string;
    chips?: Record<string, unknown>;
    notes?: string;
    timestamp: number;
  }

  interface ConsentResponsePayload {
    barberId: string;
    clientPhone: string;
    isPublic: boolean;
    timestamp: number;
  }

  const pendingConsentRequests = new Map<string, ConsentRequestPayload>();
  const pendingConsentResponses = new Map<string, ConsentResponsePayload>();

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
  fastify.post('/presence/chair/bind', async (request, reply) => {
    const body = request.body as {
      barberId: string;
      barberName?: string;
      client: {
        displayName: string;
        phone: string;
        avatarUrl?: string;
        notes?: string;
      };
    };

    if (!body || !body.barberId || !body.client) {
      return reply.status(400).send({
        error: 'INVALID_PAYLOAD',
        message: 'barberId and client data are required',
      });
    }

    const payload: ChairBindingPayload = {
      barberId: body.barberId,
      barberName: body.barberName,
      client: body.client,
      timestamp: Date.now(),
    };

    // Store under various lookup keys for fuzzy matching
    pendingChairBindings.set(body.barberId.toLowerCase(), payload);
    if (body.barberName) {
      const normalizedName = body.barberName.toLowerCase().replace(/[^a-z0-9]/g, '');
      pendingChairBindings.set(normalizedName, payload);
    }

    // Attempt to notify active WebSocket connection directly
    const allSockets = presenceGateway.getAllSockets();
    for (const entry of allSockets) {
      const matchId = entry.barberId.toLowerCase() === body.barberId.toLowerCase();
      if (matchId && entry.socket.readyState === WebSocket.OPEN) {
        entry.socket.send(
          JSON.stringify({
            type: 'CLIENT_CHAIR_HANDSHAKE',
            client: body.client,
            barberId: body.barberId,
            timestamp: payload.timestamp,
          })
        );
      }
    }

    return reply.status(200).send({
      success: true,
      message: 'Chair handshake recorded and broadcasted',
      client: body.client,
    });
  });

  // 5. Barber Polling for Pending Chair Handshake: GET /presence/chair/session
  fastify.get('/presence/chair/session', async (request, reply) => {
    const query = (request.query as { barberId?: string; name?: string }) || {};
    const barberId = query.barberId?.toLowerCase() || '';
    const normalizedName = query.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';

    let binding = pendingChairBindings.get(barberId);
    if (!binding && normalizedName) {
      binding = pendingChairBindings.get(normalizedName);
    }

    // Expire bindings older than 90 seconds
    const now = Date.now();
    if (binding && now - binding.timestamp < 90000) {
      // Clear after read so it only pops up once
      if (barberId) pendingChairBindings.delete(barberId);
      if (normalizedName) pendingChairBindings.delete(normalizedName);

      return reply.status(200).send({
        hasPending: true,
        client: binding.client,
        timestamp: binding.timestamp,
      });
    }

    return reply.status(200).send({
      hasPending: false,
      client: null,
    });
  });

  // 6. Barber sends Photo Consent Request to Client: POST /presence/chair/consent-request
  fastify.post('/presence/chair/consent-request', async (request, reply) => {
    const body = request.body as ConsentRequestPayload;
    if (!body || !body.clientPhone) {
      return reply.status(400).send({ error: 'INVALID_PAYLOAD', message: 'clientPhone is required' });
    }
    const cleanPhone = body.clientPhone.replace(/\D/g, '');
    const payload: ConsentRequestPayload = {
      ...body,
      timestamp: Date.now(),
    };
    pendingConsentRequests.set(cleanPhone, payload);

    return reply.status(200).send({ success: true, message: 'Consent request stored' });
  });

  // 7. Client polls for Photo Consent Request: GET /presence/chair/consent-request
  fastify.get('/presence/chair/consent-request', async (request, reply) => {
    const query = (request.query as { phone?: string }) || {};
    const cleanPhone = (query.phone || '').replace(/\D/g, '');
    const req = pendingConsentRequests.get(cleanPhone);
    if (req && Date.now() - req.timestamp < 120000) {
      pendingConsentRequests.delete(cleanPhone);
      return reply.status(200).send({ hasPending: true, request: req });
    }
    return reply.status(200).send({ hasPending: false, request: null });
  });

  // 8. Client sends Photo Consent Response: POST /presence/chair/consent-response
  fastify.post('/presence/chair/consent-response', async (request, reply) => {
    const body = request.body as ConsentResponsePayload;
    if (!body || !body.barberId) {
      return reply.status(400).send({ error: 'INVALID_PAYLOAD', message: 'barberId is required' });
    }
    const payload: ConsentResponsePayload = {
      ...body,
      timestamp: Date.now(),
    };
    pendingConsentResponses.set(body.barberId.toLowerCase(), payload);

    // Notify active Barber WebSocket
    for (const entry of presenceGateway.getAllSockets()) {
      if (entry.barberId.toLowerCase() === body.barberId.toLowerCase() && entry.socket.readyState === WebSocket.OPEN) {
        entry.socket.send(JSON.stringify({
          type: 'PHOTO_CONSENT_RESPONSE',
          isPublic: body.isPublic,
          clientPhone: body.clientPhone,
          timestamp: payload.timestamp,
        }));
      }
    }

    return reply.status(200).send({ success: true, message: 'Consent response recorded' });
  });

  // 9. Barber polls for Photo Consent Response: GET /presence/chair/consent-response
  fastify.get('/presence/chair/consent-response', async (request, reply) => {
    const query = (request.query as { barberId?: string }) || {};
    const barberId = (query.barberId || '').toLowerCase();
    const resp = pendingConsentResponses.get(barberId);
    if (resp && Date.now() - resp.timestamp < 120000) {
      pendingConsentResponses.delete(barberId);
      return reply.status(200).send({ hasResponse: true, response: resp });
    }
    return reply.status(200).send({ hasResponse: false, response: null });
  });

  // 10. Update Barber Presence: PUT /presence/:barberId
  fastify.put(
    '/presence/:barberId',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const { barberId } = request.params as { barberId: string };
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

