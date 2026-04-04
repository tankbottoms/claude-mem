/**
 * Supervisor Process Registry
 *
 * JSON-persisted process registry with PID liveness validation.
 * Tracks all managed processes (worker, chroma-mcp, SDK agents)
 * and provides session-scoped reaping on cleanup.
 *
 * Persistence file: ~/.claude-mem/supervisor.json
 *
 * From Glucksberg/claude-mem PR #1370
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';

const SUPERVISOR_FILE = path.join(os.homedir(), '.claude-mem', 'supervisor.json');

export interface RegisteredProcess {
  id: string;           // Unique ID (e.g., 'worker', 'chroma-mcp', 'sdk:42:12345')
  pid: number;
  type: 'worker' | 'chroma' | 'sdk' | 'mcp';
  sessionId?: number;   // For session-scoped processes
  registeredAt: number;
  label?: string;       // Human-readable description
}

/**
 * Check if a PID is alive using signal 0.
 */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // ESRCH = not found
  }
}

export class ProcessRegistry {
  private processes: Map<string, RegisteredProcess> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  /**
   * Register a process in the registry.
   */
  register(entry: RegisteredProcess): void {
    this.processes.set(entry.id, entry);
    this.saveToDisk();
    logger.debug('SUPERVISOR', `Registered process: ${entry.id} (PID ${entry.pid}, type=${entry.type})`);
  }

  /**
   * Unregister a process by ID.
   */
  unregister(id: string): void {
    if (this.processes.delete(id)) {
      this.saveToDisk();
      logger.debug('SUPERVISOR', `Unregistered process: ${id}`);
    }
  }

  /**
   * Find a registered process by PID.
   */
  getByPid(pid: number): RegisteredProcess | undefined {
    for (const entry of this.processes.values()) {
      if (entry.pid === pid) return entry;
    }
    return undefined;
  }

  /**
   * Get all processes for a given session ID.
   */
  getBySession(sessionId: number): RegisteredProcess[] {
    return Array.from(this.processes.values()).filter(e => e.sessionId === sessionId);
  }

  /**
   * Get all processes of a given type.
   */
  getByType(type: RegisteredProcess['type']): RegisteredProcess[] {
    return Array.from(this.processes.values()).filter(e => e.type === type);
  }

  /**
   * Get all registered processes.
   */
  getAll(): RegisteredProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get count of active (alive) processes.
   */
  getAliveCount(): number {
    let count = 0;
    for (const entry of this.processes.values()) {
      if (isPidAlive(entry.pid)) count++;
    }
    return count;
  }

  /**
   * Prune dead processes from the registry.
   * Returns the number of entries removed.
   */
  pruneDeadEntries(): number {
    let pruned = 0;
    for (const [id, entry] of this.processes) {
      if (!isPidAlive(entry.pid)) {
        this.processes.delete(id);
        pruned++;
        logger.debug('SUPERVISOR', `Pruned dead process: ${id} (PID ${entry.pid})`);
      }
    }
    if (pruned > 0) {
      this.saveToDisk();
    }
    return pruned;
  }

  /**
   * Kill all processes for a session (SIGTERM -> wait -> SIGKILL).
   */
  async reapSession(sessionId: number, gracePeriodMs: number = 5000): Promise<number> {
    const sessionProcesses = this.getBySession(sessionId);
    let killed = 0;

    for (const entry of sessionProcesses) {
      if (!isPidAlive(entry.pid)) {
        this.unregister(entry.id);
        continue;
      }

      // Send SIGTERM
      try {
        process.kill(entry.pid, 'SIGTERM');
        logger.info('SUPERVISOR', `Sent SIGTERM to ${entry.id} (PID ${entry.pid})`);
      } catch {
        this.unregister(entry.id);
        continue;
      }

      // Wait for graceful exit
      await new Promise(r => setTimeout(r, gracePeriodMs));

      // SIGKILL if still alive
      if (isPidAlive(entry.pid)) {
        try {
          process.kill(entry.pid, 'SIGKILL');
          killed++;
          logger.warn('SUPERVISOR', `Sent SIGKILL to ${entry.id} (PID ${entry.pid}) after ${gracePeriodMs}ms grace`);
        } catch {
          // Already dead
        }
      }

      this.unregister(entry.id);
    }

    return killed;
  }

  /**
   * Load registry state from disk.
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(SUPERVISOR_FILE)) {
        const data = JSON.parse(fs.readFileSync(SUPERVISOR_FILE, 'utf8'));
        if (Array.isArray(data)) {
          for (const entry of data) {
            this.processes.set(entry.id, entry);
          }
        }
      }
    } catch {
      // Corrupted file — start fresh
      this.processes.clear();
    }
  }

  /**
   * Persist registry state to disk.
   */
  private saveToDisk(): void {
    try {
      const dir = path.dirname(SUPERVISOR_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.processes.values());
      fs.writeFileSync(SUPERVISOR_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.warn('SUPERVISOR', 'Failed to persist registry', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
