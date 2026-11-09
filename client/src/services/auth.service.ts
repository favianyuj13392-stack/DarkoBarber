export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: 'barbero' | 'cliente';
  plan?: string;
  shopId?: string;
  avatarUrl?: string;
  bio?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  specialties?: string[];
  shopName?: string;
  shopAddress?: string;
  shopZone?: string;
  totalCuts?: number;
  portfolio?: string[];
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface ApiError {
  error: string;
  message?: string;
  issues?: unknown;
}

const DEVICE_ID_KEY = 'fade_device_id';
const TOKEN_KEY = 'fade_auth_token';
const USER_KEY = 'fade_user_profile';

export const getDeviceId = (): string => {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getStoredUser = (): UserProfile | null => {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as UserProfile;
  } catch {
    return null;
  }
};

export const clearAuthSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export async function loginWithEmailPassword(
  email: string,
  password: string,
  role: 'barbero' | 'cliente' = 'barbero'
): Promise<LoginResponse> {
  const deviceId = getDeviceId();

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Request-Id': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
    },
    body: JSON.stringify({
      identifier: email.trim().toLowerCase(),
      secret: password,
      type: 'password',
      role,
      deviceId,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(errorData.message || errorData.error || 'Credenciales inválidas');
  }

  const rawData = (await response.json()) as { token: string; barber?: UserProfile; user?: UserProfile };

  if (rawData.user && rawData.user.role !== role) {
    throw new Error(`Esta cuenta pertenece a un ${rawData.user.role}. Por favor cambia de rol para ingresar.`);
  }
  
  // Normalizar respuesta del backend (soporta formato barber o user unificado)
  const userProfile: UserProfile = rawData.user || {
    id: rawData.barber?.id || 'unknown-id',
    displayName: rawData.barber?.displayName || (role === 'barbero' ? 'Barbero FADE' : 'Cliente FADE'),
    email,
    role,
    plan: rawData.barber?.plan || (role === 'barbero' ? 'AUTONOMO' : 'CLIENT'),
    shopId: rawData.barber?.shopId,
  };

  const loginResponse: LoginResponse = {
    token: rawData.token,
    user: userProfile,
  };

  localStorage.setItem(TOKEN_KEY, loginResponse.token);
  localStorage.setItem(USER_KEY, JSON.stringify(loginResponse.user));

  return loginResponse;
}

export async function registerClient(
  email: string,
  password: string,
  displayName: string,
  phone?: string
): Promise<LoginResponse> {
  const deviceId = getDeviceId();

  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Request-Id': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName.trim(),
      phone: phone?.trim() || undefined,
      role: 'cliente',
      deviceId,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(errorData.message || errorData.error || 'Error al crear la cuenta');
  }

  const rawData = (await response.json()) as { token: string; user: UserProfile };
  const loginResponse: LoginResponse = {
    token: rawData.token,
    user: rawData.user,
  };

  localStorage.setItem(TOKEN_KEY, loginResponse.token);
  localStorage.setItem(USER_KEY, JSON.stringify(loginResponse.user));

  return loginResponse;
}

export async function registerBarber(
  email: string,
  password: string,
  displayName: string,
  phone?: string
): Promise<LoginResponse> {
  const deviceId = getDeviceId();

  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Request-Id': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName.trim(),
      phone: phone?.trim() || undefined,
      role: 'barbero',
      deviceId,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(errorData.message || errorData.error || 'Error al crear la cuenta de barbero');
  }

  const rawData = (await response.json()) as { token: string; user?: UserProfile; barber?: UserProfile };
  const userProfile: UserProfile = rawData.user || rawData.barber || {
    id: 'unknown-id',
    displayName: displayName.trim(),
    email: email.trim().toLowerCase(),
    role: 'barbero',
    plan: 'AUTONOMO',
  };

  const loginResponse: LoginResponse = {
    token: rawData.token,
    user: userProfile,
  };

  localStorage.setItem(TOKEN_KEY, loginResponse.token);
  localStorage.setItem(USER_KEY, JSON.stringify(loginResponse.user));

  return loginResponse;
}

export async function loginWithGoogle(credential: string, role: 'barbero' | 'cliente'): Promise<LoginResponse> {
  const deviceId = getDeviceId();

  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Request-Id': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
    },
    body: JSON.stringify({
      idToken: credential,
      role,
      deviceId,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(errorData.message || errorData.error || 'Error al autenticar con Google');
  }

  const data = (await response.json()) as LoginResponse;
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));

  return data;
}

export async function fetchBarberProfile(): Promise<UserProfile | null> {
  const token = getStoredToken();
  if (!token) return getStoredUser();

  try {
    const res = await fetch('/api/barbers/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      const currentUser = getStoredUser();
      const merged: UserProfile = {
        ...currentUser,
        ...data,
        role: 'barbero',
      };
      localStorage.setItem(USER_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('Could not fetch remote barber profile:', err);
  }

  return getStoredUser();
}

export async function updateBarberProfile(
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const token = getStoredToken();
  const current = getStoredUser() || ({} as UserProfile);

  const localUpdated: UserProfile = {
    ...current,
    ...updates,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(localUpdated));

  if (token) {
    try {
      const res = await fetch('/api/barbers/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const remoteUpdated = await res.json();
        const merged: UserProfile = {
          ...localUpdated,
          ...remoteUpdated,
          role: 'barbero',
        };
        localStorage.setItem(USER_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Could not persist barber profile to server, saved locally:', err);
    }
  }

  return localUpdated;
}

export interface ShopInfo {
  id: string;
  name: string;
  address?: string | null;
  zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export async function fetchShops(): Promise<ShopInfo[]> {
  try {
    const res = await fetch('/api/shops');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch shops from server, using defaults:', err);
  }

  return [
    {
      id: 'shop-sopocachi-darko',
      name: 'Darko Studio',
      address: 'Av. 20 de Octubre #2314, esq. Rosendo Gutiérrez',
      zone: 'Sopocachi',
      latitude: -16.5113,
      longitude: -68.1287,
    },
    {
      id: 'shop-miraflores-fade',
      name: 'FADE Miraflores',
      address: 'Av. Busch #1420, entre Villalobos y Pasoskanki',
      zone: 'Miraflores',
      latitude: -16.4998,
      longitude: -68.1205,
    },
    {
      id: 'shop-san-miguel-fade',
      name: 'FADE San Miguel Studio',
      address: 'Calle 21 de Calacoto #8320, San Miguel',
      zone: 'San Miguel',
      latitude: -16.5412,
      longitude: -68.0821,
    },
  ];
}

export async function updateBarberLocation(payload: {
  shopId?: string;
  customShop?: {
    name: string;
    address?: string;
    zone?: string;
    latitude?: number;
    longitude?: number;
  };
}): Promise<UserProfile> {
  const token = getStoredToken();
  const current = getStoredUser() || ({} as UserProfile);

  let updatedUser: UserProfile = { ...current };

  if (payload.shopId) {
    updatedUser.shopId = payload.shopId;
  }
  if (payload.customShop) {
    updatedUser.shopName = payload.customShop.name;
    updatedUser.shopAddress = payload.customShop.address;
    updatedUser.shopZone = payload.customShop.zone;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));

  if (token) {
    try {
      const res = await fetch('/api/barbers/me/location', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        updatedUser = {
          ...current,
          shopId: data.shopId,
          shopName: data.shop?.name || updatedUser.shopName,
          shopAddress: data.shop?.address || updatedUser.shopAddress,
          shopZone: data.shop?.zone || updatedUser.shopZone,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        return updatedUser;
      }
    } catch (err) {
      console.warn('Could not update barber location on server, saved locally:', err);
    }
  }

  return updatedUser;
}

export interface SubscriptionInfo {
  barberId: string;
  plan: 'AUTONOMO' | 'BARBERIA_BASE' | 'ALTO_FLUJO';
  priceBs: number;
  monthlyCutsCount: number;
  maxCuts: number;
  percentage: number;
  nextBillingDate: string;
  status: 'ACTIVE' | 'GRACE_PERIOD' | 'EXPIRED';
  graceDaysRemaining: number;
}

export async function fetchBarberSubscription(): Promise<SubscriptionInfo | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/barbers/me/subscription', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch barber subscription:', err);
  }

  const currentUser = getStoredUser();
  const plan = (currentUser?.plan as any) || 'AUTONOMO';
  const priceBs = plan === 'BARBERIA_BASE' ? 110 : plan === 'ALTO_FLUJO' ? 190 : 45;
  const maxCuts = plan === 'BARBERIA_BASE' ? 200 : plan === 'ALTO_FLUJO' ? 9999 : 60;

  return {
    barberId: currentUser?.id || 'barber-diego',
    plan,
    priceBs,
    monthlyCutsCount: currentUser?.totalCuts || 1,
    maxCuts,
    percentage: Math.min(100, Math.round(((currentUser?.totalCuts || 1) / maxCuts) * 100)),
    nextBillingDate: new Date(Date.now() + 25 * 86400000).toISOString(),
    status: 'ACTIVE',
    graceDaysRemaining: 5,
  };
}

export async function updateBarberPlan(
  plan: 'AUTONOMO' | 'BARBERIA_BASE' | 'ALTO_FLUJO'
): Promise<SubscriptionInfo | null> {
  const token = getStoredToken();
  const currentUser = getStoredUser();
  if (currentUser) {
    currentUser.plan = plan;
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  }

  if (token) {
    try {
      const res = await fetch('/api/barbers/me/subscription/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not update barber plan on server:', err);
    }
  }

  return fetchBarberSubscription();
}

export interface BarberServiceItem {
  id: string;
  barberId?: string;
  name: string;
  priceBs: number;
  durationMin: number;
  category?: string;
  isActive?: boolean;
}

export async function fetchBarberServices(): Promise<BarberServiceItem[]> {
  const token = getStoredToken();
  const defaultServices: BarberServiceItem[] = [
    { id: 'srv-1', name: 'Corte Clásico', priceBs: 45, durationMin: 30, category: 'corte', isActive: true },
    { id: 'srv-2', name: 'Mid / Low Fade', priceBs: 55, durationMin: 40, category: 'corte', isActive: true },
    { id: 'srv-3', name: 'Perfilado de Barba', priceBs: 30, durationMin: 20, category: 'barba', isActive: true },
    { id: 'srv-4', name: 'Combo Fade + Barba', priceBs: 75, durationMin: 50, category: 'combo', isActive: true },
  ];

  if (!token) return defaultServices;

  try {
    const res = await fetch('/api/barbers/me/services', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn('Could not fetch barber services:', err);
  }

  return defaultServices;
}

export async function createBarberService(service: {
  name: string;
  priceBs: number;
  durationMin?: number;
  category?: string;
}): Promise<BarberServiceItem> {
  const token = getStoredToken();
  if (token) {
    try {
      const res = await fetch('/api/barbers/me/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(service),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not create service on server:', err);
    }
  }

  return {
    id: `local-srv-${Date.now()}`,
    name: service.name,
    priceBs: service.priceBs,
    durationMin: service.durationMin || 30,
    category: service.category || 'corte',
    isActive: true,
  };
}

export async function updateBarberService(
  serviceId: string,
  updates: Partial<BarberServiceItem>
): Promise<BarberServiceItem | null> {
  const token = getStoredToken();
  if (token) {
    try {
      const res = await fetch(`/api/barbers/me/services/${serviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not update service on server:', err);
    }
  }
  return null;
}

export async function deleteBarberService(serviceId: string): Promise<boolean> {
  const token = getStoredToken();
  if (token) {
    try {
      const res = await fetch(`/api/barbers/me/services/${serviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch (err) {
      console.warn('Could not delete service on server:', err);
    }
  }
  return true;
}

export async function addBarberPortfolioPhoto(photoUrl: string): Promise<UserProfile | null> {
  const token = getStoredToken();
  const current = getStoredUser();

  if (current) {
    const updatedPortfolio = [photoUrl, ...(current.portfolio || [])];
    current.portfolio = updatedPortfolio;
    localStorage.setItem(USER_KEY, JSON.stringify(current));
  }

  if (token) {
    try {
      const res = await fetch('/api/barbers/me/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photoUrl }),
      });
      if (res.ok) {
        const updated = await res.json();
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        return updated;
      }
    } catch (err) {
      console.warn('Could not add portfolio photo to server:', err);
    }
  }

  return current;
}

export async function deleteBarberPortfolioPhoto(photoUrl: string): Promise<UserProfile | null> {
  const token = getStoredToken();
  const current = getStoredUser();

  if (current && current.portfolio) {
    current.portfolio = current.portfolio.filter((p) => p !== photoUrl);
    localStorage.setItem(USER_KEY, JSON.stringify(current));
  }

  if (token) {
    try {
      const res = await fetch('/api/barbers/me/portfolio', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photoUrl }),
      });
      if (res.ok) {
        const updated = await res.json();
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        return updated;
      }
    } catch (err) {
      console.warn('Could not delete portfolio photo from server:', err);
    }
  }

  return current;
}
