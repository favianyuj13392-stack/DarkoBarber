import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { AddressInfo } from 'net';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { PresenceStatus } from '@prisma/client';
import { presenceGateway } from '../src/modules/presence/presence.gateway';

function waitForMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: any) => {
      cleanup();
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        reject(err);
      }
    };
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      ws.off('message', onMessage);
      ws.off('error', onError);
    };
    ws.once('message', onMessage);
    ws.once('error', onError);
  });
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  if (ws.readyState === WebSocket.CLOSED) {
    return Promise.resolve({ code: 1000, reason: '' });
  }
  return new Promise((resolve) => {
    ws.once('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });
}

describe('Presence Module Integration Tests', () => {
  let app: FastifyInstance;
  let token: string;
  let barberId: string;
  let shopId: string;
  let port: number;
  let clientProfileId: string;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber, shop } = await seed();
    barberId = barber.id;
    shopId = shop.id;

    // Login pilot barber to obtain valid JWT
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77212345',
        secret: '1234',
        type: 'pin',
        deviceId: 'dev-presence-test',
      },
    });
    token = JSON.parse(loginRes.body).token;

    // Create a client for cut tests
    const client = await app.prisma.client.create({
      data: {
        phone: '79998888',
        profiles: {
          create: [{ name: 'Mateo' }],
        },
      },
      include: { profiles: true },
    });
    clientProfileId = client.profiles[0].id;

    // Listen on dynamic port for WebSocket tests
    await app.listen({ port: 0, host: '127.0.0.1' });
    port = (app.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('WebSocket Handshake & Authentication', () => {
    it('should reject connection without token with code 4401', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence`);
      const { code } = await waitForClose(ws);
      expect(code).toBe(4401);
    });

    it('should reject connection with invalid token with code 4401', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=invalid.token.here`);
      const { code } = await waitForClose(ws);
      expect(code).toBe(4401);
    });

    it('should accept connection with valid token and send PRESENCE_CONNECTED (GREEN)', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=${token}`);
      const connectedMsg = await waitForMessage(ws);

      expect(connectedMsg.type).toBe('PRESENCE_CONNECTED');
      expect(connectedMsg.status).toBe('GREEN');
      expect(connectedMsg.waitingCount).toBe(0);
      expect(connectedMsg.activeCutId).toBeNull();

      // Verify DB record
      const presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.status).toBe(PresenceStatus.GREEN);

      ws.close();
      await waitForClose(ws);
    });
  });

  describe('Heartbeat & Inactivity Watchdog', () => {
    it('should respond to HEARTBEAT with HEARTBEAT_ACK and update DB timestamp', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=${token}`);
      const connectedMsg = await waitForMessage(ws);
      expect(connectedMsg.type).toBe('PRESENCE_CONNECTED');

      const beforeHeartbeat = new Date();
      ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
      const ack = await waitForMessage(ws);

      expect(ack.type).toBe('HEARTBEAT_ACK');
      expect(ack.timestamp).toBeDefined();

      const presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(beforeHeartbeat.getTime() - 1000);

      ws.close();
      await waitForClose(ws);
    });

    it('should mark chair as GRAY when inactivity watchdog detects missing heartbeat > 90s', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=${token}`);
      const connectedMsg = await waitForMessage(ws);
      expect(connectedMsg.type).toBe('PRESENCE_CONNECTED');

      // Simulate heartbeat lapse (>90s ago)
      const active = presenceGateway.getSocket(barberId);
      expect(active).toBeDefined();
      active!.lastHeartbeat = Date.now() - 100000;

      // Run watchdog cycle
      const lapsed = await app.presenceService.checkHeartbeatLapses();
      expect(lapsed).toBe(1);

      // Verify DB presence transitioned to GRAY
      const presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.status).toBe(PresenceStatus.GRAY);

      await waitForClose(ws);
    });
  });

  describe('Manual Status Restrictions (SET_STATUS)', () => {
    it('should allow manually setting status to GRAY and GREEN', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=${token}`);
      const connectedMsg = await waitForMessage(ws);
      expect(connectedMsg.type).toBe('PRESENCE_CONNECTED');

      // Set to GRAY (break/off-shift)
      ws.send(JSON.stringify({ type: 'SET_STATUS', status: 'GRAY' }));
      const grayBroadcast = await waitForMessage(ws);
      expect(grayBroadcast.type).toBe('PRESENCE_CHANGED');
      expect(grayBroadcast.status).toBe('GRAY');

      let presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.status).toBe(PresenceStatus.GRAY);

      // Return to GREEN (ready)
      ws.send(JSON.stringify({ type: 'SET_STATUS', status: 'GREEN' }));
      const greenBroadcast = await waitForMessage(ws);
      expect(greenBroadcast.type).toBe('PRESENCE_CHANGED');
      expect(greenBroadcast.status).toBe('GREEN');

      presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.status).toBe(PresenceStatus.GREEN);

      ws.close();
      await waitForClose(ws);
    });

    it('should strictly reject manual attempts to set RED or YELLOW', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=${token}`);
      const connectedMsg = await waitForMessage(ws);
      expect(connectedMsg.type).toBe('PRESENCE_CONNECTED');

      ws.send(JSON.stringify({ type: 'SET_STATUS', status: 'RED' }));
      let errorMsg = await waitForMessage(ws);
      expect(errorMsg.type).toBe('ERROR');
      expect(errorMsg.code).toBe('INVALID_PAYLOAD');

      ws.send(JSON.stringify({ type: 'SET_STATUS', status: 'YELLOW' }));
      errorMsg = await waitForMessage(ws);
      expect(errorMsg.type).toBe('ERROR');
      expect(errorMsg.code).toBe('INVALID_PAYLOAD');

      ws.close();
      await waitForClose(ws);
    });
  });

  describe('Cut Lifecycle Synchronization & Lounge Micro-Tap', () => {
    it('should transition to RED on startCut, YELLOW/RED on micro-tap, and GREEN on finalizeCut', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=${token}`);
      const connectedMsg = await waitForMessage(ws);
      expect(connectedMsg.type).toBe('PRESENCE_CONNECTED');

      // 1. Start Cut -> status must be RED and broadcast PRESENCE_CHANGED
      const broadcastPromise1 = waitForMessage(ws);
      const startRes = await app.inject({
        method: 'POST',
        url: '/cuts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          clientProfileId,
          clientRequestId: 'cut-presence-sync-1',
        },
      });
      expect(startRes.statusCode).toBe(201);
      const cut = JSON.parse(startRes.body).cut;

      const cutStartMsg = await broadcastPromise1;
      expect(cutStartMsg.type).toBe('PRESENCE_CHANGED');
      expect(cutStartMsg.status).toBe('RED');
      expect(cutStartMsg.activeCutId).toBe(cut.id);

      let presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.status).toBe(PresenceStatus.RED);
      expect(presence?.activeCutId).toBe(cut.id);
      expect(presence?.expiresAt).toBeDefined();

      // 2. Lounge Micro-Tap: UPDATE_WAITING_COUNT
      // 0 -> 1: shifts RED to YELLOW
      ws.send(JSON.stringify({ type: 'UPDATE_WAITING_COUNT', waitingCount: 1 }));
      const tap1Msg = await waitForMessage(ws);
      expect(tap1Msg.type).toBe('PRESENCE_CHANGED');
      expect(tap1Msg.status).toBe('YELLOW');
      expect(tap1Msg.waitingCount).toBe(1);

      // 1 -> 2: remains YELLOW
      ws.send(JSON.stringify({ type: 'UPDATE_WAITING_COUNT', waitingCount: 2 }));
      const tap2Msg = await waitForMessage(ws);
      expect(tap2Msg.type).toBe('PRESENCE_CHANGED');
      expect(tap2Msg.status).toBe('YELLOW');
      expect(tap2Msg.waitingCount).toBe(2);

      // 2 -> 0: shifts back to RED
      ws.send(JSON.stringify({ type: 'UPDATE_WAITING_COUNT', waitingCount: 0 }));
      const tap0Msg = await waitForMessage(ws);
      expect(tap0Msg.type).toBe('PRESENCE_CHANGED');
      expect(tap0Msg.status).toBe('RED');
      expect(tap0Msg.waitingCount).toBe(0);

      // Reject invalid waitingCount (e.g. 3)
      ws.send(JSON.stringify({ type: 'UPDATE_WAITING_COUNT', waitingCount: 3 }));
      const errorMsg = await waitForMessage(ws);
      expect(errorMsg.type).toBe('ERROR');
      expect(errorMsg.code).toBe('INVALID_PAYLOAD');

      // 3. Finalize Cut -> status transitions back to GREEN
      const broadcastPromise2 = waitForMessage(ws);
      const finalizeRes = await app.inject({
        method: 'POST',
        url: `/cuts/${cut.id}/finalize`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          chips: {
            baseLateral: '#1',
            tipoDegradado: 'Mid Fade',
            parteSuperior: 'Tijera',
            barba: { included: false },
            adicionales: [],
          },
        },
      });
      expect(finalizeRes.statusCode).toBe(200);

      const cutEndMsg = await broadcastPromise2;
      expect(cutEndMsg.type).toBe('PRESENCE_CHANGED');
      expect(cutEndMsg.status).toBe('GREEN');
      expect(cutEndMsg.activeCutId).toBeNull();

      presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.status).toBe(PresenceStatus.GREEN);
      expect(presence?.activeCutId).toBeNull();
      expect(presence?.expiresAt).toBeNull();

      ws.close();
      await waitForClose(ws);
    });

    it('should initialize connection to RED when barber connects with an active cut', async () => {
      // Start a cut before connecting
      const startRes = await app.inject({
        method: 'POST',
        url: '/cuts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          clientProfileId,
          clientRequestId: 'cut-reconnect-test',
        },
      });
      expect(startRes.statusCode).toBe(201);
      const cut = JSON.parse(startRes.body).cut;

      // Connect barber
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/presence?token=${token}`);
      const connectedMsg = await waitForMessage(ws);

      expect(connectedMsg.type).toBe('PRESENCE_CONNECTED');
      expect(connectedMsg.status).toBe('RED');
      expect(connectedMsg.activeCutId).toBe(cut.id);

      // Clean up cut
      const finalizeMsgPromise = waitForMessage(ws);
      await app.inject({
        method: 'POST',
        url: `/cuts/${cut.id}/finalize`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          chips: {
            baseLateral: '#0',
            tipoDegradado: 'Low Fade',
            parteSuperior: 'Maquina',
            barba: { included: false },
            adicionales: [],
          },
        },
      });
      await finalizeMsgPromise;

      ws.close();
      await waitForClose(ws);
    });
  });

  describe('RF-2.4 Phantom Turn Auto-Recovery', () => {
    it('should reset expired cut (>50 min) to GREEN via recoverPhantomTurns', async () => {
      // Start a cut
      const startRes = await app.inject({
        method: 'POST',
        url: '/cuts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          clientProfileId,
          clientRequestId: 'cut-phantom-test',
        },
      });
      expect(startRes.statusCode).toBe(201);
      const cut = JSON.parse(startRes.body).cut;

      // Simulate expired phantom turn (expiresAt in the past)
      await app.prisma.presence.update({
        where: { barberId },
        data: {
          status: PresenceStatus.RED,
          expiresAt: new Date(Date.now() - 5000), // 5 seconds in the past
        },
      });

      // Run watchdog
      const recovered = await app.presenceService.recoverPhantomTurns();
      expect(recovered).toBeGreaterThanOrEqual(1);

      // Verify presence is back to GREEN
      const presence = await app.prisma.presence.findUnique({ where: { barberId } });
      expect(presence?.status).toBe(PresenceStatus.GREEN);
      expect(presence?.activeCutId).toBeNull();

      // Clean up cut
      await app.inject({
        method: 'POST',
        url: `/cuts/${cut.id}/finalize`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          chips: {
            baseLateral: '#1',
            tipoDegradado: 'Mid Fade',
            parteSuperior: 'Tijera',
            barba: { included: false },
            adicionales: [],
          },
        },
      });
    });
  });

  describe('Public Map & Authenticated Endpoints', () => {
    it('should return 200 OK with formatted chairs and edge caching headers for GET /presence/map', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/presence/map',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=3, s-maxage=5');

      const chairs = JSON.parse(res.body);
      expect(Array.isArray(chairs)).toBe(true);
      expect(chairs.length).toBeGreaterThanOrEqual(1);

      const diegoChair = chairs.find((c: any) => c.barberId === barberId);
      expect(diegoChair).toBeDefined();
      expect(diegoChair.displayName).toBe('Diego');
      expect(diegoChair.shopId).toBe(shopId);
      expect(diegoChair.shopName).toBe('Darko Studio');
      expect(diegoChair.status).toBeDefined();
      expect(typeof diegoChair.waitingCount).toBe('number');
      expect(diegoChair.updatedAt).toBeDefined();
    });

    it('should return authenticated barber presence via GET /presence/me', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/presence/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.barberId).toBe(barberId);
      expect(body.status).toBeDefined();
    });
  });
});
