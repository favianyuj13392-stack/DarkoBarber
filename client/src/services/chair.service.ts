import type { IncomingClientHandshake } from './presence.service';
import { getStoredToken } from './auth.service';
import { getDeviceId } from '../utils/device-id';

/** Same-browser channel still used to refresh the client's cut feed (not for handshakes or consent). */
export const CHAIR_SYNC_CHANNEL_NAME = 'fade_chair_sync';

/** A photo consent request as seen by the addressed client. Server-driven. */
export interface PhotoConsentRequestPayload {
  requestId: string;
  barberId: string;
  barberName: string;
  clientPhone: string;
  styleName: string;
  notes?: string;
  timestamp: number;
  expiresAt: string;
}

export interface PhotoConsentResponsePayload {
  requestId: string;
  barberId: string;
  clientPhone: string;
  isPublic: boolean;
  timestamp: number;
}

export type PhotoConsentRequestStatus = 'PENDING' | 'GRANTED' | 'DENIED' | 'EXPIRED';

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
  requestId?: string;
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
    requestId?: string;
    client: IncomingClientHandshake;
    isFirstScan?: boolean;
    acquiredCount?: number;
  };
  const result: ChairBindResult = {
    requestId: data.requestId,
    client: {
      ...data.client,
      isFirstScan: data.isFirstScan,
      acquiredCount: data.acquiredCount,
    },
    isFirstScan: Boolean(data.isFirstScan),
    acquiredCount: data.acquiredCount ?? 0,
  };

  return result;
}

function authHeaders(json = false): Record<string, string> | null {
  const token = getStoredToken();
  if (!token) return null;
  return json
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { Authorization: `Bearer ${token}` };
}

/**
 * Barber side: asks the server whether a client is waiting at this barber's chair.
 * The barber is identified by the session token; each handshake is returned once.
 * Resolves to null when nothing is pending or the request failed.
 */
export async function pollPendingChairSession(): Promise<IncomingClientHandshake | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch('/api/presence/chair/session', { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hasPending?: boolean;
      requestId?: string;
      client?: IncomingClientHandshake;
    };
    if (data.hasPending && data.client) {
      return { ...data.client, requestId: data.requestId };
    }
  } catch {
    // transient network error: the next poll retries
  }
  return null;
}

/** Barber side: accept or dismiss a handshake received through the poll. */
export async function respondChairRequest(
  requestId: string,
  action: 'accept' | 'decline'
): Promise<boolean> {
  const headers = authHeaders(true);
  if (!headers) return false;
  try {
    const res = await fetch(`/api/presence/chair/session/${encodeURIComponent(requestId)}/respond`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Barber side: asks the addressed client for photo publication consent.
 * Only ids and short text are sent; photos use the regular photo endpoints.
 * Returns the request id, or throws when the server refuses.
 */
export async function requestPhotoConsent(payload: {
  clientId?: string;
  clientPhone?: string;
  cutId?: string;
  styleName?: string;
  notes?: string;
}): Promise<string> {
  const headers = authHeaders(true);
  if (!headers) throw new Error('Barber session missing');
  const res = await fetch('/api/presence/chair/consent-request', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || `Consent request failed (${res.status})`);
  }
  const data = (await res.json()) as { requestId: string };
  return data.requestId;
}

/** Client side: fetches the pending consent request addressed to the signed-in client. */
export async function pollPhotoConsentRequest(): Promise<PhotoConsentRequestPayload | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch('/api/presence/chair/consent-request', { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as { hasPending?: boolean; request?: PhotoConsentRequestPayload };
    return data.hasPending && data.request ? data.request : null;
  } catch {
    return null;
  }
}

/** Client side: answers a consent request. Returns false when the server did not record it. */
export async function respondPhotoConsent(requestId: string, isPublic: boolean): Promise<boolean> {
  const headers = authHeaders(true);
  if (!headers) return false;
  try {
    const res = await fetch('/api/presence/chair/consent-response', {
      method: 'POST',
      headers,
      body: JSON.stringify({ requestId, isPublic }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Barber side: checks the answer to a consent request. `response` is set once when the
 * client answered; `status` tells the UI whether the request is still open or expired.
 */
export async function pollPhotoConsentResponse(
  requestId: string
): Promise<{ response: PhotoConsentResponsePayload | null; status: PhotoConsentRequestStatus | null }> {
  const headers = authHeaders();
  if (!headers) return { response: null, status: null };
  try {
    const res = await fetch(
      `/api/presence/chair/consent-response?requestId=${encodeURIComponent(requestId)}`,
      { headers }
    );
    if (!res.ok) return { response: null, status: null };
    const data = (await res.json()) as {
      hasResponse?: boolean;
      response?: PhotoConsentResponsePayload;
      status?: PhotoConsentRequestStatus | null;
    };
    return {
      response: data.hasResponse && data.response ? data.response : null,
      status: data.status ?? null,
    };
  } catch {
    return { response: null, status: null };
  }
}
