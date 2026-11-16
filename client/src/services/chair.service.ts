import type { IncomingClientHandshake } from './presence.service';
import { getStoredToken } from './auth.service';
import { getDeviceId } from '../utils/device-id';

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
  clientName?: string;
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
  clientName?: string;
  isPublic: boolean;
  timestamp: number;
}

export const PENDING_CHAIR_BIND_STORAGE_KEY = 'fade_pending_chair_bind';

export interface PendingChairBind {
  barberId: string;
  barberName: string;
  shopName?: string;
  avatarUrl?: string;
}

export type ChairBindErrorCode =
  | 'AUTH_REQUIRED'
  | 'SELF_CAPTURE_NOT_ALLOWED'
  | 'BARBER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'UNKNOWN';

export class ChairBindError extends Error {
  readonly code: ChairBindErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(code: ChairBindErrorCode, message: string, status = 0, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ChairBindError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ChairBindResult {
  client: IncomingClientHandshake;
  isFirstScan: boolean;
  acquiredCount: number;
}

/** Remembers a chair scan so it can be resumed after the client signs in. */
export function savePendingChairBind(pending: PendingChairBind): void {
  try {
    sessionStorage.setItem(PENDING_CHAIR_BIND_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // storage unavailable: the client will have to scan again after login
  }
}

/** Reads and clears the pending chair scan, if any. */
export function consumePendingChairBind(): PendingChairBind | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHAIR_BIND_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_CHAIR_BIND_STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<PendingChairBind>;
    if (!parsed || typeof parsed.barberId !== 'string' || !parsed.barberId) return null;
    return {
      barberId: parsed.barberId,
      barberName: typeof parsed.barberName === 'string' ? parsed.barberName : '',
      shopName: parsed.shopName,
      avatarUrl: parsed.avatarUrl,
    };
  } catch {
    return null;
  }
}

/** Friendly Spanish message for a failed chair bind. */
export function describeChairBindError(err: unknown): string {
  if (err instanceof ChairBindError) {
    switch (err.code) {
      case 'RATE_LIMITED':
        return err.retryAfterSeconds
          ? `Demasiados escaneos. Intenta de nuevo en ${err.retryAfterSeconds} segundos.`
          : 'Demasiados escaneos. Intenta de nuevo en unos instantes.';
      case 'SELF_CAPTURE_NOT_ALLOWED':
        return 'No puedes vincularte al sillón con tu propia cuenta de barbero.';
      case 'BARBER_NOT_FOUND':
        return 'No encontramos a ese barbero. Revisa el código QR e intenta de nuevo.';
      case 'AUTH_REQUIRED':
        return 'Inicia sesión como cliente para sentarte en el sillón.';
      case 'NETWORK':
        return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
      default:
        return 'No pudimos vincularte al sillón. Intenta de nuevo.';
    }
  }
  return 'No pudimos vincularte al sillón. Intenta de nuevo.';
}

/**
 * Binds the signed-in client to a barber chair. The client identity comes
 * from the Bearer token only; the server answers with the client data it will
 * show to the barber. Throws ChairBindError on any failure.
 */
export async function sendChairHandshake(
  barberId: string,
  barberName?: string
): Promise<ChairBindResult> {
  const token = getStoredToken();
  if (!token) {
    throw new ChairBindError('AUTH_REQUIRED', 'Client token missing', 401);
  }

  let res: Response;
  try {
    res = await fetch('/api/presence/chair/bind', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        barberId,
        barberName: barberName || undefined,
        deviceId: getDeviceId(),
      }),
    });
  } catch {
    throw new ChairBindError('NETWORK', 'Network error');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    const message = body.message || body.error || `Chair bind failed (${res.status})`;
    if (res.status === 429) {
      const retryHeader = Number.parseInt(res.headers.get('Retry-After') ?? '', 10);
      throw new ChairBindError(
        'RATE_LIMITED',
        message,
        res.status,
        Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined
      );
    }
    if (res.status === 404) throw new ChairBindError('BARBER_NOT_FOUND', message, res.status);
    if (res.status === 403 && body.error === 'SELF_CAPTURE_NOT_ALLOWED') {
      throw new ChairBindError('SELF_CAPTURE_NOT_ALLOWED', message, res.status);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ChairBindError('AUTH_REQUIRED', message, res.status);
    }
    throw new ChairBindError('UNKNOWN', message, res.status);
  }

  const data = (await res.json()) as {
    client: IncomingClientHandshake;
    isFirstScan?: boolean;
    acquiredCount?: number;
  };
  const result: ChairBindResult = {
    client: {
      ...data.client,
      isFirstScan: data.isFirstScan,
      acquiredCount: data.acquiredCount,
    },
    isFirstScan: Boolean(data.isFirstScan),
    acquiredCount: data.acquiredCount ?? 0,
  };

  // Same-browser sync for the barber view, only after the server confirmed the bind.
  const payload: ChairHandshakePayload = {
    barberId,
    barberName,
    client: result.client,
    timestamp: Date.now(),
  };
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
      bc.postMessage(payload);
      bc.close();
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }
  }
  try {
    localStorage.setItem(CHAIR_PENDING_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }

  return result;
}

/**
 * Consulta al backend si hay un cliente pendiente esperando en el sillón del barbero.
 */
export async function pollPendingChairSession(
  barberId: string,
  barberName?: string
): Promise<IncomingClientHandshake | null> {
  try {
    const token = getStoredToken();
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
        const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
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
        if (res.ok) {
          break;
        } else {
          console.warn(`POST consent-request to ${url} returned status: ${res.status}`);
        }
      } catch (err) {
        console.warn(`Fetch error for ${url}:`, err);
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
  barberName?: string,
  clientName?: string
): Promise<PhotoConsentRequestPayload | null> {
  try {
    const params = new URLSearchParams();
    if (clientPhone) params.append('phone', clientPhone.replace(/\D/g, ''));
    if (barberId) params.append('barberId', barberId);
    if (barberName) params.append('name', barberName);
    if (clientName) params.append('clientName', clientName);

    const endpoints = [
      `/api/presence/chair/consent-request?${params.toString()}`,
      `/presence/chair/consent-request?${params.toString()}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { 'Cache-Control': 'no-cache' },
        });
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
  barberName?: string,
  clientName?: string
): Promise<void> {
  const payload: PhotoConsentResponsePayload & { barberName?: string; clientName?: string } = {
    barberId,
    barberName,
    clientPhone,
    clientName,
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

  // 2. LocalStorage: Registrar respuesta y limpiar solicitud previa
  try {
    localStorage.removeItem(PHOTO_CONSENT_REQUEST_STORAGE_KEY);
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
  clientPhone?: string,
  clientName?: string
): Promise<PhotoConsentResponsePayload | null> {
  try {
    const params = new URLSearchParams();
    if (barberId) params.append('barberId', barberId);
    if (barberName) params.append('name', barberName);
    if (clientPhone) params.append('phone', clientPhone.replace(/\D/g, ''));
    if (clientName) params.append('clientName', clientName);

    const endpoints = [
      `/api/presence/chair/consent-response?${params.toString()}`,
      `/presence/chair/consent-response?${params.toString()}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { 'Cache-Control': 'no-cache' },
        });
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
