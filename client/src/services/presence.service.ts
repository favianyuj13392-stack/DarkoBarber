import { getStoredToken } from './auth.service';

export type BarberPresenceStatus = 'GREEN' | 'YELLOW' | 'RED' | 'OFFLINE';

export interface IncomingClientHandshake {
  displayName: string;
  phone: string;
  avatarUrl?: string;
  notes?: string;
}

export interface IncomingConsentResponse {
  isPublic: boolean;
  clientPhone: string;
}

export interface PresenceMessage {
  type: 'UPDATE_WAITING_COUNT' | 'SET_STATUS' | 'HEARTBEAT' | 'PING';
  waitingCount?: number;
  status?: BarberPresenceStatus;
  timestamp?: number;
}

class PresenceClient {
  private ws: WebSocket | null = null;
  private heartbeatInterval: number | null = null;
  private currentStatus: BarberPresenceStatus = 'GREEN';
  private waitingCount: number = 0;
  private listeners: Set<(status: BarberPresenceStatus, waitingCount: number) => void> = new Set();
  private handshakeListeners: Set<(client: IncomingClientHandshake) => void> = new Set();
  private consentResponseListeners: Set<(response: IncomingConsentResponse) => void> = new Set();

  connect(): void {
    const token = getStoredToken();
    if (!token) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:4000' : window.location.host;
    const url = `${protocol}//${host}/ws/presence?token=${token}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PRESENCE_UPDATE' || data.type === 'STATUS_CHANGED') {
            if (data.status) this.currentStatus = data.status;
            if (typeof data.waitingCount === 'number') this.waitingCount = data.waitingCount;
            this.notify();
          } else if (data.type === 'CLIENT_CHAIR_HANDSHAKE' && data.client) {
            this.notifyHandshake(data.client);
          } else if (data.type === 'PHOTO_CONSENT_RESPONSE') {
            this.consentResponseListeners.forEach((l) =>
              l({ isPublic: Boolean(data.isPublic), clientPhone: data.clientPhone })
            );
          }
        } catch {
          // ignore non-json
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
      };

      this.ws.onerror = () => {
        // Will close and reconnect on next demand
      };
    } catch (err) {
      console.warn('Could not establish presence WebSocket:', err);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Actualizar conteo de clientes en sala de espera (Micro-Tap)
   */
  updateWaitingCount(count: number): void {
    this.waitingCount = count;
    // GREEN if 0, YELLOW if 1+
    this.currentStatus = count === 0 ? 'GREEN' : 'YELLOW';
    this.notify();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'UPDATE_WAITING_COUNT',
          waitingCount: count,
        })
      );
    }
  }

  /**
   * Cambiar estado de presencia (GREEN, YELLOW, RED)
   */
  setStatus(status: BarberPresenceStatus): void {
    this.currentStatus = status;
    this.notify();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'SET_STATUS',
          status,
        })
      );
    }
  }

  getStatus(): BarberPresenceStatus {
    return this.currentStatus;
  }

  getWaitingCount(): number {
    return this.waitingCount;
  }

  subscribe(listener: (status: BarberPresenceStatus, waitingCount: number) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus, this.waitingCount);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onClientHandshake(listener: (client: IncomingClientHandshake) => void): () => void {
    this.handshakeListeners.add(listener);
    return () => {
      this.handshakeListeners.delete(listener);
    };
  }

  onPhotoConsentResponse(listener: (response: IncomingConsentResponse) => void): () => void {
    this.consentResponseListeners.add(listener);
    return () => {
      this.consentResponseListeners.delete(listener);
    };
  }

  notifyHandshake(client: IncomingClientHandshake): void {
    this.handshakeListeners.forEach((l) => l(client));
  }

  private notify(): void {
    this.listeners.forEach((l) => l(this.currentStatus, this.waitingCount));
  }
}

export const presenceService = new PresenceClient();
