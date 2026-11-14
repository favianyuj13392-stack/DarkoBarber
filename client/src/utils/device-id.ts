const DEVICE_ID_KEY = 'fade_device_id';

let memoryDeviceId: string | null = null;

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fall through to the non-crypto fallback
  }
  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Returns a stable anonymous device identifier. It is persisted in localStorage
 * when available; otherwise a per-page-load in-memory id is used.
 */
export function getDeviceId(): string {
  if (memoryDeviceId) return memoryDeviceId;

  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      memoryDeviceId = stored;
      return stored;
    }
  } catch {
    // storage unavailable: use the in-memory fallback below
  }

  const created = generateId();
  memoryDeviceId = created;
  try {
    localStorage.setItem(DEVICE_ID_KEY, created);
  } catch {
    // keep the in-memory id
  }
  return created;
}
