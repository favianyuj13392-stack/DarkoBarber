import { WebSocket } from 'ws';
import { PresenceChangedMessage, ServerPresenceMessage } from './presence.schemas';

export interface ActiveBarberSocket {
  barberId: string;
  shopId: string | null;
  socket: WebSocket;
  lastHeartbeat: number;
}

export class PresenceGateway {
  private activeSockets = new Map<string, ActiveBarberSocket>();

  registerSocket(barberId: string, shopId: string | null, socket: WebSocket): void {
    const existing = this.activeSockets.get(barberId);
    if (existing && existing.socket !== socket) {
      try {
        existing.socket.close(1000, 'Superseded by new connection');
      } catch {
        // Socket already closed
      }
    }

    this.activeSockets.set(barberId, {
      barberId,
      shopId,
      socket,
      lastHeartbeat: Date.now(),
    });
  }

  removeSocket(barberId: string, socket?: WebSocket): boolean {
    const existing = this.activeSockets.get(barberId);
    if (existing) {
      if (!socket || existing.socket === socket) {
        this.activeSockets.delete(barberId);
        return true;
      }
    }
    return false;
  }

  getSocket(barberId: string): ActiveBarberSocket | undefined {
    return this.activeSockets.get(barberId);
  }

  touchHeartbeat(barberId: string): void {
    const entry = this.activeSockets.get(barberId);
    if (entry) {
      entry.lastHeartbeat = Date.now();
    }
  }

  getAllSockets(): ActiveBarberSocket[] {
    return Array.from(this.activeSockets.values());
  }

  /**
   * Broadcast presence change according to scope requirements:
   * - Room 'shop:${barber.shopId}' if barber has a shopId
   * - Room 'barber:${barber.id}' if autonomous (shopId === null)
   */
  broadcastPresence(
    barberId: string,
    shopId: string | null,
    message: PresenceChangedMessage,
    excludeSocket?: WebSocket
  ): void {
    const payload = JSON.stringify(message);
    const updatePayload = JSON.stringify({
      ...message,
      type: 'PRESENCE_UPDATE',
      updatedAt: new Date().toISOString(),
    });

    if (shopId) {
      // Broadcast to all active sockets belonging to the same shop
      for (const entry of this.activeSockets.values()) {
        if (
          entry.shopId === shopId &&
          entry.socket !== excludeSocket &&
          entry.socket.readyState === WebSocket.OPEN
        ) {
          entry.socket.send(payload);
          entry.socket.send(updatePayload);
        }
      }
    } else {
      // Autonomous barber: broadcast to barber's own active socket(s)
      const entry = this.activeSockets.get(barberId);
      if (
        entry &&
        entry.socket !== excludeSocket &&
        entry.socket.readyState === WebSocket.OPEN
      ) {
        entry.socket.send(payload);
        entry.socket.send(updatePayload);
      }
    }
  }

  sendToBarber(barberId: string, message: ServerPresenceMessage): void {
    const entry = this.activeSockets.get(barberId);
    if (entry && entry.socket.readyState === WebSocket.OPEN) {
      entry.socket.send(JSON.stringify(message));
    }
  }
}

export const presenceGateway = new PresenceGateway();
