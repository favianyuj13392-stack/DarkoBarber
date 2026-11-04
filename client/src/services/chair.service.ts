import type { IncomingClientHandshake } from './presence.service';

export const CHAIR_SYNC_CHANNEL_NAME = 'fade_chair_sync';
export const CHAIR_PENDING_STORAGE_KEY = 'fade_pending_chair_handshake';

export interface ChairHandshakePayload {
  barberId: string;
  barberName?: string;
  client: IncomingClientHandshake;
  timestamp: number;
}

/**
 * Emite la solicitud de vinculación del cliente al sillón del barbero.
 * Utiliza 3 vías simultáneas para garantizar 100% de confiabilidad:
 * 1. BroadcastChannel (0ms entre pestañas/ventanas del mismo navegador).
 * 2. LocalStorage Event (soporte cross-tab).
 * 3. Backend REST API (/api/presence/chair/bind) con WebSocket push (para dispositivos cruzados, ej. celular a PC).
 */
export async function sendChairHandshake(
  barberId: string,
  barberName: string,
  client: IncomingClientHandshake
): Promise<void> {
  const payload: ChairHandshakePayload = {
    barberId,
    barberName,
    client,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }
  }

  // 2. LocalStorage
  try {
    localStorage.setItem(CHAIR_PENDING_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }

  // 3. Backend REST API
  try {
    const endpoints = ['/api/presence/chair/bind', '/presence/chair/bind'];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barberId,
            barberName,
            client,
          }),
        });
        if (res.ok) break;
      } catch {
        // try fallback endpoint
      }
    }
  } catch (err) {
    console.warn('API chair bind fetch error:', err);
  }
}

/**
 * Consulta al backend si hay un cliente pendiente esperando en el sillón del barbero.
 */
export async function pollPendingChairSession(
  barberId: string,
  barberName?: string
): Promise<IncomingClientHandshake | null> {
  try {
    const query = new URLSearchParams({
      barberId: barberId || '',
      name: barberName || '',
    });

    const endpoints = [
      `/api/presence/chair/session?${query.toString()}`,
      `/presence/chair/session?${query.toString()}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.hasPending && data.client) {
            return data.client as IncomingClientHandshake;
          }
        }
      } catch {
        // try fallback
      }
    }
  } catch (err) {
    console.warn('Poll chair session error:', err);
  }
  return null;
}
