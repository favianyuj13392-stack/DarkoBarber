const ADMIN_KEY_STORAGE = 'fade_admin_api_key';

export interface AdminBarberItem {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  plan: 'GRATIS' | 'PRO';
  isActive: boolean;
  createdAt: string;
  shopName: string | null;
  cutsCountThisMonth: number;
  maxCuts: number | null;
}

export function getStoredAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setStoredAdminKey(key: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
}

export function clearStoredAdminKey(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

export async function verifyAdminKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/verify', {
      headers: {
        'x-admin-key': key.trim(),
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAdminBarbers(params?: {
  search?: string;
  plan?: 'GRATIS' | 'PRO';
}): Promise<AdminBarberItem[]> {
  const key = getStoredAdminKey();
  if (!key) throw new Error('Clave de administrador requerida');

  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.plan) query.set('plan', params.plan);

  const res = await fetch(`/api/admin/barbers?${query.toString()}`, {
    headers: {
      'x-admin-key': key,
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearStoredAdminKey();
      throw new Error('Clave de administrador inválida o expirada');
    }
    throw new Error('Error al obtener lista de barberos');
  }

  const data = (await res.json()) as { barbers: AdminBarberItem[] };
  return data.barbers;
}

export async function updateBarberPlanAdmin(
  barberId: string,
  plan: 'GRATIS' | 'PRO'
): Promise<boolean> {
  const key = getStoredAdminKey();
  if (!key) throw new Error('Clave de administrador requerida');

  const res = await fetch(`/api/admin/barbers/${barberId}/plan`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': key,
    },
    body: JSON.stringify({ plan }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Error al actualizar plan del barbero');
  }

  return true;
}
