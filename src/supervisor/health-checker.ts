/**
 * Supervisor Health Checker
 *
 * Periodic sweep (every 30s) that prunes dead processes from the registry
 * and logs summary. Uses unref() to not prevent Node.js from exiting.
 *
 * From Glucksberg/claude-mem PR #1370
 */

import { logger } from '../utils/logger.js';
import type { ProcessRegistry } from './process-registry.js';

const HEALTH_CHECK_INTERVAL_MS = 30_000;

let healthInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic health checker.
 * Prunes dead entries from the registry every 30 seconds.
 */
export function startHealthChecker(registry: ProcessRegistry): void {
  if (healthInterval) return; // Already running

  healthInterval = setInterval(() => {
    try {
      const pruned = registry.pruneDeadEntries();
      if (pruned > 0) {
        const alive = registry.getAliveCount();
        logger.info('SUPERVISOR', `Health check: pruned ${pruned} dead processes, ${alive} alive`);
      }
    } catch (error) {
      logger.error('SUPERVISOR', 'Health check error', {}, error as Error);
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  // Don't prevent Node.js from exiting
  healthInterval.unref();

  logger.debug('SUPERVISOR', 'Health checker started (30s interval)');
}

/**
 * Stop the health checker.
 */
export function stopHealthChecker(): void {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
    logger.debug('SUPERVISOR', 'Health checker stopped');
  }
}
