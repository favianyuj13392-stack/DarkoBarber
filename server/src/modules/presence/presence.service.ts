import { PrismaClient, PresenceStatus } from '@prisma/client';
import { WebSocket } from 'ws';
import { presenceGateway } from './presence.gateway';
import { AuthenticatedBarber } from '../../types';
import { ChairMapItem, PresenceChangedMessage } from './presence.schemas';

export class PresenceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Handle barber WebSocket connection.
   * Requirement 2:
   * Query for an IN_PROGRESS cut for this barber:
   * - If active cut exists: status MUST initialize to RED (or YELLOW if waitingCount > 0).
   * - If no active cut exists: status MUST initialize to GREEN.
   * Update DB and broadcast accordingly.
   */
  async handleConnect(barber: AuthenticatedBarber, connectingSocket?: WebSocket) {
    const activeCut = await this.prisma.cut.findFirst({
      where: {
        barberId: barber.id,
        status: 'IN_PROGRESS',
      },
    });

    const currentPresence = await this.prisma.presence.findUnique({
      where: { barberId: barber.id },
    });

    const waitingCount = currentPresence?.waitingCount ?? 0;
    let initialStatus: PresenceStatus;
    let activeCutId: string | null = null;
    let expiresAt: Date | null = null;

    if (activeCut) {
      initialStatus = waitingCount > 0 ? PresenceStatus.YELLOW : PresenceStatus.RED;
      activeCutId = activeCut.id;
      // Expires at 50 min from cut start
      expiresAt = new Date(activeCut.startedAt.getTime() + 50 * 60 * 1000);
    } else {
      initialStatus = PresenceStatus.GREEN;
      activeCutId = null;
      expiresAt = null;
    }

    const updated = await this.prisma.presence.upsert({
      where: { barberId: barber.id },
      update: {
        status: initialStatus,
        activeCutId,
        expiresAt,
        lastHeartbeat: new Date(),
      },
      create: {
        barberId: barber.id,
        status: initialStatus,
        waitingCount,
        activeCutId,
        expiresAt,
        lastHeartbeat: new Date(),
      },
    });

    // Broadcast presence change to other sockets in the room (connecting socket gets PRESENCE_CONNECTED)
    const changeMessage: PresenceChangedMessage = {
      type: 'PRESENCE_CHANGED',
      barberId: barber.id,
      status: updated.status,
      waitingCount: updated.waitingCount,
      activeCutId: updated.activeCutId,
    };
    presenceGateway.broadcastPresence(barber.id, barber.shopId, changeMessage, connectingSocket);

    return {
      status: updated.status,
      waitingCount: updated.waitingCount,
      activeCutId: updated.activeCutId,
    };
  }

  /**
   * Handle barber heartbeat message.
   * Resets in-memory heartbeat and updates DB timestamp.
   */
  async handleHeartbeat(barberId: string) {
    presenceGateway.touchHeartbeat(barberId);
    await this.prisma.presence.updateMany({
      where: { barberId },
      data: { lastHeartbeat: new Date() },
    });
    return { timestamp: new Date().toISOString() };
  }

  /**
   * Update lounge waiting count (0: Nadie, 1: 1 a 2, 2: 3 o más).
   * If chair is in RED and waitingCount > 0, shifts to YELLOW.
   * If chair is in YELLOW and waitingCount === 0, shifts back to RED.
   */
  async updateWaitingCount(barberId: string, shopId: string | null, waitingCount: number) {
    const current = await this.prisma.presence.findUnique({
      where: { barberId },
    });

    let newStatus = current?.status ?? PresenceStatus.GRAY;
    if (newStatus === PresenceStatus.RED && waitingCount > 0) {
      newStatus = PresenceStatus.YELLOW;
    } else if (newStatus === PresenceStatus.YELLOW && waitingCount === 0) {
      newStatus = PresenceStatus.RED;
    }

    const updated = await this.prisma.presence.upsert({
      where: { barberId },
      update: {
        waitingCount,
        status: newStatus,
        lastHeartbeat: new Date(),
      },
      create: {
        barberId,
        waitingCount,
        status: newStatus,
        lastHeartbeat: new Date(),
      },
    });

    const changeMessage: PresenceChangedMessage = {
      type: 'PRESENCE_CHANGED',
      barberId,
      status: updated.status,
      waitingCount: updated.waitingCount,
      activeCutId: updated.activeCutId,
    };
    presenceGateway.broadcastPresence(barberId, shopId, changeMessage);

    return updated;
  }

  /**
   * Manual status change:
   * Only accepts 'GREEN' or 'GRAY'.
   * If returning from 'GRAY' ('GREEN' requested) while an active cut is still in progress,
   * restores to RED/YELLOW instead of masking the active cut as GREEN.
   */
  async setStatus(barberId: string, shopId: string | null, status: 'GREEN' | 'GRAY') {
    const current = await this.prisma.presence.findUnique({
      where: { barberId },
    });

    let targetStatus: PresenceStatus;
    if (status === 'GRAY') {
      targetStatus = PresenceStatus.GRAY;
    } else if (current?.activeCutId) {
      targetStatus = (current.waitingCount ?? 0) > 0 ? PresenceStatus.YELLOW : PresenceStatus.RED;
    } else {
      targetStatus = PresenceStatus.GREEN;
    }

    const updated = await this.prisma.presence.upsert({
      where: { barberId },
      update: {
        status: targetStatus,
        lastHeartbeat: new Date(),
      },
      create: {
        barberId,
        status: targetStatus,
        waitingCount: 0,
        lastHeartbeat: new Date(),
      },
    });

    const changeMessage: PresenceChangedMessage = {
      type: 'PRESENCE_CHANGED',
      barberId,
      status: updated.status,
      waitingCount: updated.waitingCount,
      activeCutId: updated.activeCutId,
    };
    presenceGateway.broadcastPresence(barberId, shopId, changeMessage);

    return updated;
  }

  /**
   * Handle socket disconnection (transition chair to GRAY).
   * Guards against race conditions when a barber rapidly reconnects.
   */
  async handleDisconnect(barberId: string, shopId: string | null) {
    if (presenceGateway.getSocket(barberId)) {
      return;
    }

    const current = await this.prisma.presence.findUnique({
      where: { barberId },
    });

    if (presenceGateway.getSocket(barberId)) {
      return;
    }

    await this.prisma.presence.updateMany({
      where: { barberId },
      data: {
        status: PresenceStatus.GRAY,
      },
    });

    if (presenceGateway.getSocket(barberId)) {
      return;
    }

    const changeMessage: PresenceChangedMessage = {
      type: 'PRESENCE_CHANGED',
      barberId,
      status: PresenceStatus.GRAY,
      waitingCount: current?.waitingCount ?? 0,
      activeCutId: current?.activeCutId ?? null,
    };
    presenceGateway.broadcastPresence(barberId, shopId, changeMessage);
  }

  /**
   * Cut lifecycle hook: Start cut.
   * Shifts chair to RED (or YELLOW if lounge clients waiting),
   * sets activeCutId and expiresAt (now + 50 min).
   */
  async setCutting(barberId: string, cutId: string, shopId: string | null) {
    const current = await this.prisma.presence.findUnique({
      where: { barberId },
    });

    const waitingCount = current?.waitingCount ?? 0;
    const newStatus = waitingCount > 0 ? PresenceStatus.YELLOW : PresenceStatus.RED;
    const expiresAt = new Date(Date.now() + 50 * 60 * 1000);

    const updated = await this.prisma.presence.upsert({
      where: { barberId },
      update: {
        status: newStatus,
        activeCutId: cutId,
        expiresAt,
      },
      create: {
        barberId,
        status: newStatus,
        waitingCount,
        activeCutId: cutId,
        expiresAt,
      },
    });

    const changeMessage: PresenceChangedMessage = {
      type: 'PRESENCE_CHANGED',
      barberId,
      status: updated.status,
      waitingCount: updated.waitingCount,
      activeCutId: updated.activeCutId,
    };
    presenceGateway.broadcastPresence(barberId, shopId, changeMessage);

    return updated;
  }

  /**
   * Cut lifecycle hook: Finalize cut.
   * Resets activeCutId and expiresAt, shifts status to GREEN.
   */
  async setFree(barberId: string, shopId: string | null) {
    const updated = await this.prisma.presence.updateMany({
      where: { barberId },
      data: {
        status: PresenceStatus.GREEN,
        activeCutId: null,
        expiresAt: null,
      },
    });

    const current = await this.prisma.presence.findUnique({
      where: { barberId },
    });

    const changeMessage: PresenceChangedMessage = {
      type: 'PRESENCE_CHANGED',
      barberId,
      status: PresenceStatus.GREEN,
      waitingCount: current?.waitingCount ?? 0,
      activeCutId: null,
    };
    presenceGateway.broadcastPresence(barberId, shopId, changeMessage);

    return updated;
  }

  /**
   * RF-2.4 Phantom Turn Auto-Recovery:
   * Cancels orphaned IN_PROGRESS cuts and resets chairs in RED or YELLOW that exceeded 50 minutes (expiresAt < now).
   */
  async recoverPhantomTurns(): Promise<number> {
    const now = new Date();
    const expiredPresences = await this.prisma.presence.findMany({
      where: {
        status: { in: [PresenceStatus.RED, PresenceStatus.YELLOW] },
        expiresAt: { lt: now },
      },
      include: {
        barber: true,
      },
    });

    if (expiredPresences.length === 0) {
      return 0;
    }

    for (const item of expiredPresences) {
      await this.prisma.$transaction([
        this.prisma.cut.updateMany({
          where: {
            barberId: item.barberId,
            status: 'IN_PROGRESS',
          },
          data: {
            status: 'CANCELLED',
            finishedAt: now,
          },
        }),
        this.prisma.presence.update({
          where: { barberId: item.barberId },
          data: {
            status: PresenceStatus.GREEN,
            activeCutId: null,
            expiresAt: null,
          },
        }),
      ]);

      const changeMessage: PresenceChangedMessage = {
        type: 'PRESENCE_CHANGED',
        barberId: item.barberId,
        status: PresenceStatus.GREEN,
        waitingCount: item.waitingCount,
        activeCutId: null,
      };
      presenceGateway.broadcastPresence(item.barberId, item.barber.shopId, changeMessage);
    }

    return expiredPresences.length;
  }

  /**
   * Inactivity Watchdog:
   * Sockets with missing heartbeats > 90s transition to GRAY and close.
   */
  async checkHeartbeatLapses(): Promise<number> {
    const activeSockets = presenceGateway.getAllSockets();
    const now = Date.now();
    let lapsedCount = 0;

    for (const entry of activeSockets) {
      if (now - entry.lastHeartbeat > 90000) {
        lapsedCount++;
        presenceGateway.removeSocket(entry.barberId, entry.socket);

        await this.prisma.presence.updateMany({
          where: { barberId: entry.barberId },
          data: { status: PresenceStatus.GRAY },
        });

        const current = await this.prisma.presence.findUnique({
          where: { barberId: entry.barberId },
        });

        const changeMessage: PresenceChangedMessage = {
          type: 'PRESENCE_CHANGED',
          barberId: entry.barberId,
          status: PresenceStatus.GRAY,
          waitingCount: current?.waitingCount ?? 0,
          activeCutId: current?.activeCutId ?? null,
        };
        presenceGateway.broadcastPresence(entry.barberId, entry.shopId, changeMessage);

        try {
          entry.socket.close(1000, 'Heartbeat timeout');
        } catch {
          // ignore
        }
      }
    }

    return lapsedCount;
  }

  /**
   * Public map query:
   * Returns list of all chairs with presence and shop metadata.
   */
  async getMapChairs(): Promise<ChairMapItem[]> {
    const barbers = await this.prisma.barber.findMany({
      include: {
        presence: true,
        shop: true,
      },
      orderBy: {
        displayName: 'asc',
      },
    });

    return barbers.map((barber) => ({
      barberId: barber.id,
      displayName: barber.displayName,
      avatarUrl: barber.avatarUrl,
      bio: barber.bio,
      linkedin: barber.linkedin,
      instagram: barber.instagram,
      specialties: barber.specialties,
      shopId: barber.shopId,
      shopName: barber.shop?.name ?? null,
      address: barber.shop?.address ?? null,
      zone: barber.shop?.zone ?? null,
      latitude: barber.shop?.latitude ?? null,
      longitude: barber.shop?.longitude ?? null,
      status: barber.presence?.status ?? PresenceStatus.GRAY,
      waitingCount: barber.presence?.waitingCount ?? 0,
      updatedAt: (barber.presence?.updatedAt ?? barber.updatedAt).toISOString(),
    }));
  }

  /**
   * Get current presence for authenticated barber.
   */
  async getPresence(barberId: string) {
    return this.prisma.presence.findUnique({
      where: { barberId },
    });
  }
}
