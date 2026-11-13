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

/**
 * Iniciar corte en sillón (POST /api/cuts)
 */
export async function startCut(
  clientProfileId: string,
  clientRequestId?: string,
  clientPhone?: string,
  clientName?: string
): Promise<{ cut: CutRecord }> {
  const token = getStoredToken();
  const reqId = clientRequestId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cut-${Date.now()}`);

  try {
    const response = await fetch('/api/cuts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Request-Id': reqId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        clientProfileId,
        clientPhone,
        clientName,
        clientRequestId: reqId,
        startedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('Backend startCut returned error, using offline cut session:', err);
      return {
        cut: {
          id: reqId,
          barberId: 'barber-diego',
          clientProfileId,
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        },
      };
    }

    return await response.json();
  } catch (error) {
    console.warn('Network error calling startCut, continuing offline:', error);
    return {
      cut: {
        id: reqId,
        barberId: 'barber-diego',
        clientProfileId,
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Finalizar corte y registrar ficha técnica (POST /api/cuts/:id/finalize)
 */
export async function finalizeCut(
  cutId: string,
  chips: CutChips,
  photos?: Array<{ url: string; angle: string }>,
  isPublic?: boolean
): Promise<{ cut: CutRecord }> {
  const token = getStoredToken();

  try {
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

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Network error finalizeCut, using local completion:', error);
  }

  return {
    cut: {
      id: cutId,
      barberId: 'barber-diego',
      clientProfileId: 'client-active',
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
      finishedAt: new Date().toISOString(),
      chips,
    },
  };
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
