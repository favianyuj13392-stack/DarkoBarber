import { useReducedMotion } from 'framer-motion';

/** True when the user asked the OS to minimise motion. Treat null (SSR) as false. */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}
