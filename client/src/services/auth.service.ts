export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  role: 'barbero' | 'cliente';
  plan?: string;
  shopId?: string;
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
