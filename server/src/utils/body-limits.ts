/**
 * Request body size limits (bytes).
 *
 *   BODY_LIMIT_BYTES         global default for every route (default 1 MiB)
 *   UPLOAD_BODY_LIMIT_BYTES  only for routes that receive inline images as data URLs
 *                            (barber portfolio, barber profile avatar) (default 30 MiB)
 *
 * Photo uploads for cuts use presigned R2 URLs and never pass through the API body.
 */

const MIB = 1024 * 1024;

function bytesFromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function defaultBodyLimit(): number {
  return bytesFromEnv('BODY_LIMIT_BYTES', MIB);
}

export function uploadBodyLimit(): number {
  return bytesFromEnv('UPLOAD_BODY_LIMIT_BYTES', 30 * MIB);
}
