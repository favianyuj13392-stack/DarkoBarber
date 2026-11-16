import { getStoredToken } from './auth.service';

export interface CutChips {
  baseLateral: string;
  tipoDegradado: string;
  parteSuperior: string;
  barba: {
    included: boolean;
    alturaMejilla?: string;
  };
  adicionales?: string[];
  notasEspeciales?: string[];
}

export interface CutRecord {
  id: string;
  barberId: string;
  clientProfileId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  finishedAt?: string;
  chips?: CutChips;
}

export interface ClientHistoryResponse {
  client: {
    /** null when the barber has no history with this phone (empty response). */
    id: string | null;
    phone: string;
    displayName: string | null;
    avatarUrl?: string;
    isVerified?: boolean;
    notes?: string;
    preferences?: {
      neckline?: string;
      topTexture?: string;
      product?: string;
      razorShave?: boolean;
    };
  };
  cuts: Array<{
    id: string;
    date: string;
    styleName: string;
    fadeType: string;
    shopName: string;
    location: string;
    barberName: string;
    isVerified: boolean;
    coverPhoto: string;
    photos: Array<{ id: string; url: string; angle: string; isPublic?: boolean }>;
    chips: CutChips;
  }>;
}

export interface StartCutParams {
  /** Registered client id from the chair handshake. Preferred when known. */
  clientId?: string;
  clientProfileId?: string;
  clientPhone?: string;
  clientName?: string;
  clientRequestId?: string;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return body.message || fallback;
}

/**
 * Starts a cut on the chair (POST /api/cuts). The server needs a real client identification
 * (client id, profile id or phone). Throws when the cut was not created so the UI never
 * shows a cut that does not exist.
 */
export async function startCut(params: StartCutParams): Promise<{ cut: CutRecord }> {
  const token = getStoredToken();
  const reqId =
    params.clientRequestId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cut-${Date.now()}`);

  const response = await fetch('/api/cuts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Request-Id': reqId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      clientId: params.clientId || undefined,
      clientProfileId: params.clientProfileId || undefined,
      clientPhone: params.clientPhone || undefined,
      clientName: params.clientName || undefined,
      clientRequestId: reqId,
      startedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo iniciar el corte'));
  }
  return await response.json();
}

/**
 * Finalizes a cut and stores its technical sheet (POST /api/cuts/:id/finalize).
 * Throws when the server did not confirm, instead of pretending the cut was saved.
 */
export async function finalizeCut(
  cutId: string,
  chips: CutChips,
  photos?: Array<{ url: string; angle: string }>,
  isPublic?: boolean
): Promise<{ cut: CutRecord }> {
  const token = getStoredToken();

  const response = await fetch(`/api/cuts/${cutId}/finalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      chips,
      photos,
      isPublic,
      finishedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'No se pudo finalizar el corte'));
  }
  return await response.json();
}

/**
 * Fetches a client's history by phone (GET /api/clients/:phone/history).
 * Barbers get a 200 with empty cuts when the client is new to them or unknown.
 * Throws on network/HTTP failures so callers can show an error state instead of fake data.
 */
export async function getClientHistory(
  phone: string,
  clientName?: string
): Promise<ClientHistoryResponse> {
  const token = getStoredToken();
  const cleanPhone = phone.replace(/\D/g, '');

  const response = await fetch(`/api/clients/${cleanPhone}/history`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Could not load client history (HTTP ${response.status})`);
  }

  const data = (await response.json()) as ClientHistoryResponse;
  if (clientName && data?.client) {
    data.client.displayName = clientName;
  }
  return { ...data, cuts: data?.cuts ?? [] };
}
