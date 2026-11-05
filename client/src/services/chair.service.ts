import type { IncomingClientHandshake } from './presence.service';

export const CHAIR_SYNC_CHANNEL_NAME = 'fade_chair_sync';
export const CHAIR_PENDING_STORAGE_KEY = 'fade_pending_chair_handshake';
export const PHOTO_CONSENT_REQUEST_STORAGE_KEY = 'fade_photo_consent_request';
export const PHOTO_CONSENT_RESPONSE_STORAGE_KEY = 'fade_photo_consent_response';

export interface ChairHandshakePayload {
  barberId: string;
  barberName?: string;
  client: IncomingClientHandshake;
  timestamp: number;
}

export interface PhotoConsentRequestPayload {
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

export interface PhotoConsentResponsePayload {
  barberId: string;
  clientPhone: string;
  isPublic: boolean;
  timestamp: number;
}

/**
 * Emite la solicitud de vinculación del cliente al sillón del barbero.
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
        // try fallback
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

/**
 * El barbero envía la solicitud de publicación al celular del cliente.
 */
export async function requestPhotoConsent(
  payload: Omit<PhotoConsentRequestPayload, 'timestamp'>
): Promise<void> {
  const fullPayload: PhotoConsentRequestPayload = {
    ...payload,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
      bc.postMessage({
        type: 'PHOTO_CONSENT_REQUEST',
        ...fullPayload,
      });
      bc.close();
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }
  }

  // 2. LocalStorage
  try {
    localStorage.setItem(PHOTO_CONSENT_REQUEST_STORAGE_KEY, JSON.stringify(fullPayload));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }

  // 3. Backend REST API
  try {
    const endpoints = ['/api/presence/chair/consent-request', '/presence/chair/consent-request'];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullPayload),
        });
        if (res.ok) break;
      } catch {
        // fallback
      }
    }
  } catch (err) {
    console.warn('Request photo consent error:', err);
  }
}

/**
 * El cliente consulta si su barbero le mandó solicitud de publicación de fotos.
 */
export async function pollPhotoConsentRequest(
  clientPhone?: string,
  barberId?: string,
  barberName?: string
): Promise<PhotoConsentRequestPayload | null> {
  try {
    const params = new URLSearchParams();
    if (clientPhone) params.append('phone', clientPhone.replace(/\D/g, ''));
    if (barberId) params.append('barberId', barberId);
    if (barberName) params.append('name', barberName);

    const endpoints = [
      `/api/presence/chair/consent-request?${params.toString()}`,
      `/presence/chair/consent-request?${params.toString()}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.hasPending && data.request) {
            return data.request as PhotoConsentRequestPayload;
          }
        }
      } catch {
        // fallback
      }
    }
  } catch (err) {
    console.warn('Poll photo consent request error:', err);
  }
  return null;
}

/**
 * El cliente responde si autoriza publicación pública o solo privado.
 */
export async function respondPhotoConsent(
  barberId: string,
  clientPhone: string,
  isPublic: boolean,
  barberName?: string
): Promise<void> {
  const payload: PhotoConsentResponsePayload & { barberName?: string } = {
    barberId,
    barberName,
    clientPhone,
    isPublic,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
      bc.postMessage({
        type: 'PHOTO_CONSENT_RESPONSE',
        ...payload,
      });
      bc.close();
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }
  }

  // 2. LocalStorage
  try {
    localStorage.setItem(PHOTO_CONSENT_RESPONSE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }

  // 3. Backend REST API
  try {
    const endpoints = ['/api/presence/chair/consent-response', '/presence/chair/consent-response'];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) break;
      } catch {
        // fallback
      }
    }
  } catch (err) {
    console.warn('Respond photo consent error:', err);
  }
}

/**
 * El barbero consulta si el cliente ya respondió a la solicitud de consentimiento.
 */
export async function pollPhotoConsentResponse(
  barberId?: string,
  barberName?: string,
  clientPhone?: string
): Promise<PhotoConsentResponsePayload | null> {
  try {
    const params = new URLSearchParams();
    if (barberId) params.append('barberId', barberId);
    if (barberName) params.append('name', barberName);
    if (clientPhone) params.append('phone', clientPhone.replace(/\D/g, ''));

    const endpoints = [
      `/api/presence/chair/consent-response?${params.toString()}`,
      `/presence/chair/consent-response?${params.toString()}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.hasResponse && data.response) {
            return data.response as PhotoConsentResponsePayload;
          }
        }
      } catch {
        // fallback
      }
    }
  } catch (err) {
    console.warn('Poll photo consent response error:', err);
  }
  return null;
}
