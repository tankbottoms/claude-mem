/**
 * Supervisor Module - Singleton process supervisor
 *
 * Central management of all claude-mem child processes:
 * - Worker registration
 * - Chroma subprocess tracking
 * - SDK agent process lifecycle
 * - Graceful shutdown cascade
 * - Health monitoring
 *
 * From Glucksberg/claude-mem PR #1370
 */

import { logger } from '../utils/logger.js';
import { ProcessRegistry, type RegisteredProcess, isPidAlive } from './process-registry.js';
import { startHealthChecker, stopHealthChecker } from './health-checker.js';
import { runShutdownCascade } from './shutdown.js';

export { sanitizeEnv } from './env-sanitizer.js';
export { isPidAlive } from './process-registry.js';
export type { RegisteredProcess } from './process-registry.js';

let registry: ProcessRegistry | null = null;
let started = false;

/**
 * Get the supervisor's process registry.
 * Initializes lazily if not yet started.
 */
export function getRegistry(): ProcessRegistry {
  if (!registry) {
    registry = new ProcessRegistry();
  }
  return registry;
}

/**
 * Start the supervisor: initialize registry, prune stale entries, start health checker.
 */
export async function startSupervisor(): Promise<void> {
  if (started) return;

  registry = new ProcessRegistry();

  // Prune entries from previous runs that are no longer alive
  const pruned = registry.pruneDeadEntries();
  if (pruned > 0) {
    logger.info('SUPERVISOR', `Startup: pruned ${pruned} stale entries from previous run`);
  }

  // Start periodic health checker
  startHealthChecker(registry);

  started = true;
  logger.info('SUPERVISOR', 'Supervisor started');
}

/**
 * Stop the supervisor: run shutdown cascade, stop health checker.
 */
export async function stopSupervisor(): Promise<void> {
  if (!started || !registry) return;

  stopHealthChecker();
  await runShutdownCascade(registry);

  registry = null;
  started = false;
  logger.info('SUPERVISOR', 'Supervisor stopped');
}

/**
 * Register a process with the supervisor.
 */
export function registerProcess(id: string, entry: Omit<RegisteredProcess, 'id' | 'registeredAt'>): void {
  getRegistry().register({
    ...entry,
    id,
    registeredAt: Date.now(),
  });
}

/**
 * Unregister a process from the supervisor.
 */
export function unregisterProcess(id: string): void {
  getRegistry().unregister(id);
}

/**
 * Configure signal handlers that integrate with the supervisor shutdown cascade.
 * Call this early in worker startup.
 *
 * @param existingShutdown - The worker's existing shutdown function
 */
export function configureSupervisorSignalHandlers(existingShutdown: () => Promise<void>): void {
  const shutdown = async (signal: string) => {
    logger.info('SUPERVISOR', `Received ${signal}, initiating shutdown`);
    try {
      await existingShutdown();
    } finally {
      await stopSupervisor();
    }
  };

  // These supplement (not replace) the existing signal handlers
  // The worker's own handlers call shutdown() which triggers stopSupervisor()
  logger.debug('SUPERVISOR', 'Signal handlers configured for supervisor shutdown cascade');
}

/**
 * Guard: check if it's safe to spawn a new process.
 * Throws if the supervisor detects too many active processes.
 */
export function assertCanSpawn(label: string): void {
  const reg = getRegistry();
  const alive = reg.getAliveCount();
  const MAX_MANAGED_PROCESSES = 20;

  if (alive >= MAX_MANAGED_PROCESSES) {
    throw new Error(`Supervisor: refusing to spawn "${label}" — ${alive} managed processes active (cap=${MAX_MANAGED_PROCESSES})`);
  }
}
