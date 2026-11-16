import { useEffect, useRef } from 'react';

interface BackoffPollingOptions {
  /** Polling only runs while enabled. */
  enabled: boolean;
  /** Delay after an "active" tick (something was found or changed). */
  baseMs: number;
  /** Upper bound for the delay while nothing happens. */
  maxMs: number;
}

/**
 * Polls `tick` with a self-scheduling timeout. The delay grows (x1.5) after idle ticks
 * or failures and resets to `baseMs` when `tick` resolves to true. Polling pauses while
 * the tab is hidden and is fully cleaned up on unmount or when `enabled` turns false.
 */
export function useBackoffPolling(
  tick: () => Promise<boolean>,
  { enabled, baseMs, maxMs }: BackoffPollingOptions
): void {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = baseMs;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule();
        return;
      }
      let active = false;
      try {
        active = await tickRef.current();
      } catch {
        active = false;
      }
      if (cancelled) return;
      delay = active ? baseMs : Math.min(maxMs, Math.round(delay * 1.5));
      schedule();
    };

    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, baseMs, maxMs]);
}
