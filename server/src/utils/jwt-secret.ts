export const MIN_JWT_SECRET_LENGTH = 32;

// Fixed secret used only when NODE_ENV === 'test'. Never reachable in other environments.
export const TEST_JWT_SECRET = 'test-only-jwt-secret-do-not-use-in-production-0123456789';

/**
 * Resolves the JWT signing secret. Fails fast when it is missing or too short,
 * except under NODE_ENV === 'test', where a fixed secret is used if none is set.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;

  if (env.NODE_ENV === 'test') {
    return secret && secret.length >= MIN_JWT_SECRET_LENGTH ? secret : TEST_JWT_SECRET;
  }

  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set and at least ${MIN_JWT_SECRET_LENGTH} characters long. Refusing to start.`
    );
  }
  return secret;
}
