/**
 * ChromaSyncQueue - Processes observations marked needs_chroma_sync=1
 *
 * Runs as a background task during worker startup (after backfillAllProjects)
 * and can be triggered on-demand after federation imports.
 */

import { Database } from 'bun:sqlite';
import { ChromaSync, type StoredObservation } from './ChromaSync.js';
import { ChromaMcpManager } from './ChromaMcpManager.js';
import { logger } from '../../utils/logger.js';

const BATCH_SIZE = 50;

export class ChromaSyncQueue {
  /**
   * Process all observations with needs_chroma_sync=1.
   * Returns count of successfully synced observations.
   * Non-throwing: logs errors and returns partial count.
   */
  static async processQueue(db: Database): Promise<number> {
    const chromaMcp = ChromaMcpManager.getInstance();
    if (!chromaMcp.isAvailable()) {
      logger.debug('CHROMA_QUEUE', 'ChromaDB not available, skipping queue processing');
      return 0;
    }

    const pending = db.prepare(
      `SELECT id, memory_session_id, project, text, type, title, subtitle,
              facts, narrative, concepts, files_read, files_modified,
              prompt_number, discovery_tokens, created_at, created_at_epoch
       FROM observations WHERE needs_chroma_sync = 1 LIMIT ?`
    ).all(BATCH_SIZE) as StoredObservation[];

    if (pending.length === 0) return 0;

    logger.info('CHROMA_QUEUE', `Processing ${pending.length} deferred ChromaDB syncs`);

    let synced = 0;
    for (const obs of pending) {
      const ok = await ChromaSync.trySyncImportedObservation(obs);
      if (ok) {
        db.prepare('UPDATE observations SET needs_chroma_sync = 0 WHERE id = ?').run(obs.id);
        synced++;
      } else {
        logger.warn('CHROMA_QUEUE', `ChromaDB became unavailable after syncing ${synced}/${pending.length}`);
        break;
      }
    }

    logger.info('CHROMA_QUEUE', `Synced ${synced}/${pending.length} deferred observations to ChromaDB`);
    return synced;
  }
}
