/**
 * Request body size limits (bytes).
 *
 *   BODY_LIMIT_BYTES         global default for every route (default 1 MiB)
 *   UPLOAD_BODY_LIMIT_BYTES  only for routes that receive inline images as data URLs
 *                            (barber portfolio, barber profile avatar) (default 30 MiB)
 *
 *   FINALIZE_BODY_LIMIT_BYTES  only for the cut finalize routes, which receive up to a few
 *                              client-compressed photos as data URLs (default 5 MiB)
 *
 * Presigned R2 uploads exist for cut photos but the chair flow does not use them yet.
 */

const MIB = 1024 * 1024;

function bytesFromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function defaultBodyLimit(): number {
  return bytesFromEnv('BODY_LIMIT_BYTES', MIB);
}

export function finalizeBodyLimit(): number {
  return bytesFromEnv('FINALIZE_BODY_LIMIT_BYTES', 5 * MIB);
}

export function uploadBodyLimit(): number {
  return bytesFromEnv('UPLOAD_BODY_LIMIT_BYTES', 30 * MIB);
}
