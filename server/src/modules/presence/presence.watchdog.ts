import { PresenceService } from './presence.service';

let watchdogInterval: NodeJS.Timeout | null = null;

/**
 * Execute a single cycle of presence watchdogs:
 * 1. Sockets with missing heartbeats > 90s transition to GRAY.
 * 2. Phantom turns (>50m without finalization) auto-recover to GREEN.
 */
export async function runWatchdogCycle(service: PresenceService): Promise<{ lapsed: number; recovered: number }> {
  const lapsed = await service.checkHeartbeatLapses();
  const recovered = await service.recoverPhantomTurns();
  return { lapsed, recovered };
}

/**
 * Start periodic watchdog interval (every 30 seconds).
 */
export function startWatchdogs(service: PresenceService, intervalMs = 30000): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
  }

  watchdogInterval = setInterval(async () => {
    try {
      await runWatchdogCycle(service);
    } catch (err) {
      console.error('[PresenceWatchdog] Error executing watchdog cycle:', err);
    }
  }, intervalMs);

  // Unref so the interval does not hold process open during tests or graceful exits
  if (watchdogInterval.unref) {
    watchdogInterval.unref();
  }
}

/**
 * Stop background watchdog timer on server teardown.
 */
export function stopWatchdogs(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}
