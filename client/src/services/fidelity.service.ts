import { getStoredToken } from './auth.service';

export interface FidelityStats {
  totalCuts: number;
  uniqueClients: number;
  recurringClients: number;
  recurrenceRate: number;
  averageCycleDays: number | null;
  topStyles: Array<{ name: string; count: number }>;
}

export interface FidelityStatsResponse {
  isPro: boolean;
  message?: string;
  stats: FidelityStats | null;
}

export interface ClientDueForCut {
  clientId: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  daysSinceLastCut: number;
  averageCycleDays: number;
  daysOverdue: number;
  lastCutDate: string;
  whatsappUrl: string | null;
}

export interface DueForCutResponse {
  isPro: boolean;
  message?: string;
  emailQuota: {
    sentThisMonth: number;
    monthlyLimit: number;
    remaining: number;
  };
  dueClients: ClientDueForCut[];
}

export interface SendReminderResult {
  success?: boolean;
  error?: string;
  message: string;
  remaining?: number;
}

/** Fetches loyalty & recurrence analytics for the authenticated barber */
export async function fetchFidelityStats(): Promise<FidelityStatsResponse> {
  const token = getStoredToken();
  const response = await fetch('/api/barbers/me/stats/fidelity', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Error fetching fidelity stats (HTTP ${response.status})`);
  }

  return await response.json();
}

/** Fetches list of clients overdue for their next haircut */
export async function fetchDueForCutClients(): Promise<DueForCutResponse> {
  const token = getStoredToken();
  const response = await fetch('/api/barbers/me/clients/due-for-cut', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Error fetching due clients (HTTP ${response.status})`);
  }

  return await response.json();
}

/** Dispatches a branded email reminder to a client due for a cut */
export async function sendDueForCutReminder(
  clientId: string
): Promise<SendReminderResult> {
  const token = getStoredToken();
  const response = await fetch('/api/barbers/me/notifications/send-reminder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ clientId }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      error: data.error || 'ERROR',
      message: data.message || 'No se pudo enviar el recordatorio.',
      remaining: data.remaining,
    };
  }

  return data;
}
