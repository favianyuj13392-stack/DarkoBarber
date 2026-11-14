import { getStoredToken } from './auth.service';

export interface EmailVerificationStatus {
  email: string | null;
  verified: boolean;
}

export type VerifyRequestResult =
  | { kind: 'sent' }
  | { kind: 'already-verified' }
  | { kind: 'rate-limited'; retryAfterSeconds?: number }
  | { kind: 'no-email' }
  | { kind: 'error' };

function authHeaders(): Record<string, string> | null {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/** Fetches the signed-in client's email verification status. Returns null when it cannot be determined. */
export async function fetchEmailVerificationStatus(): Promise<EmailVerificationStatus | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch('/api/clients/me/email/status', { headers });
    if (!res.ok) return null;
    return (await res.json()) as EmailVerificationStatus;
  } catch {
    return null;
  }
}

/** Asks the server to email a verification link to the signed-in client. */
export async function requestEmailVerification(): Promise<VerifyRequestResult> {
  const headers = authHeaders();
  if (!headers) return { kind: 'error' };

  let res: Response;
  try {
    res = await fetch('/api/clients/me/email/verify-request', { method: 'POST', headers });
  } catch {
    return { kind: 'error' };
  }

  if (res.status === 200) {
    const body = (await res.json().catch(() => ({}))) as { verified?: boolean };
    return body.verified ? { kind: 'already-verified' } : { kind: 'sent' };
  }
  if (res.status === 429) {
    const retry = Number.parseInt(res.headers.get('Retry-After') ?? '', 10);
    return {
      kind: 'rate-limited',
      retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : undefined,
    };
  }
  if (res.status === 400) return { kind: 'no-email' };
  return { kind: 'error' };
}

/** Confirms an email verification token from the emailed link. Resolves true when verified. */
export async function confirmEmailVerification(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
