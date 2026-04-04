/**
 * Supervisor Shutdown Cascade
 *
 * Graceful shutdown for all registered processes:
 * SIGTERM -> wait grace period -> SIGKILL
 *
 * From Glucksberg/claude-mem PR #1370
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';
import { type ProcessRegistry, isPidAlive } from './process-registry.js';

const SUPERVISOR_FILE = path.join(os.homedir(), '.claude-mem', 'supervisor.json');
const SHUTDOWN_GRACE_MS = 5_000;

/**
 * Run the full shutdown cascade:
 * 1. SIGTERM all registered children (except self)
 * 2. Wait grace period
 * 3. SIGKILL any survivors
 * 4. Clean up PID file and supervisor.json
 */
export async function runShutdownCascade(registry: ProcessRegistry): Promise<void> {
  const allProcesses = registry.getAll();
  const myPid = process.pid;

  // Filter out self
  const children = allProcesses.filter(p => p.pid !== myPid);

  if (children.length === 0) {
    cleanup();
    return;
  }

  logger.info('SUPERVISOR', `Shutdown cascade: sending SIGTERM to ${children.length} processes`);

  // Phase 1: SIGTERM all children
  for (const entry of children) {
    if (!isPidAlive(entry.pid)) continue;
    try {
      process.kill(entry.pid, 'SIGTERM');
      logger.debug('SUPERVISOR', `SIGTERM -> ${entry.id} (PID ${entry.pid})`);
    } catch {
      // Already dead
    }
  }

  // Phase 2: Wait for graceful exit
  await new Promise(r => setTimeout(r, SHUTDOWN_GRACE_MS));

  // Phase 3: SIGKILL survivors
  let survivors = 0;
  for (const entry of children) {
    if (!isPidAlive(entry.pid)) continue;
    survivors++;
    try {
      process.kill(entry.pid, 'SIGKILL');
      logger.warn('SUPERVISOR', `SIGKILL -> ${entry.id} (PID ${entry.pid}) survived ${SHUTDOWN_GRACE_MS}ms grace`);
    } catch {
      // Already dead
    }
  }

  if (survivors > 0) {
    logger.warn('SUPERVISOR', `Shutdown cascade: killed ${survivors} stubborn processes`);
  }

  cleanup();
}

/**
 * Clean up supervisor state files.
 */
function cleanup(): void {
  try {
    if (fs.existsSync(SUPERVISOR_FILE)) {
      fs.unlinkSync(SUPERVISOR_FILE);
    }
  } catch {
    // Best effort
  }

  // Also clean up worker PID file
  const pidFile = path.join(os.homedir(), '.claude-mem', 'worker.pid');
  try {
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
  } catch {
    // Best effort
  }
}
