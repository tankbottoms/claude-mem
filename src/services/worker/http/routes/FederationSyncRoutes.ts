/**
 * Federation Sync Routes
 *
 * Enables cross-machine observation sync for claude-mem federation.
 *
 * GET  /api/sync/export  - Export observations/summaries since a given epoch
 * POST /api/sync/import  - Import observations/summaries from a remote machine
 * GET  /api/sync/status  - Show sync tracking state per remote machine
 */

import { hostname } from 'os';
import { Database } from 'bun:sqlite';
import express, { Request, Response } from 'express';
import { BaseRouteHandler } from '../BaseRouteHandler.js';
import { logger } from '../../../../utils/logger.js';
import type { DatabaseManager } from '../../DatabaseManager.js';

const EXPORT_DEFAULT_LIMIT = 500;
const EXPORT_MAX_LIMIT = 2000;

export class FederationSyncRoutes extends BaseRouteHandler {
  private machineId: string;

  constructor(private dbManager: DatabaseManager) {
    super();
    this.machineId = hostname();
  }

  setupRoutes(app: express.Application): void {
    app.get('/api/sync/export', this.handleExport.bind(this));
    app.post('/api/sync/import', this.handleImport.bind(this));
    app.get('/api/sync/status', this.handleStatus.bind(this));
    app.get('/api/sync/identity', this.handleIdentity.bind(this));
  }

  /**
   * GET /api/sync/export?since_epoch=<ts>&limit=500&project=<optional>
   * Returns observations and session_summaries created after the given epoch.
   * Only exports locally-created records (source_machine IS NULL or matches this machine).
   */
  private handleExport = this.wrapHandler((req: Request, res: Response): void => {
    const sinceEpoch = parseInt(req.query.since_epoch as string || '0', 10);
    const limit = Math.min(
      parseInt(req.query.limit as string || String(EXPORT_DEFAULT_LIMIT), 10),
      EXPORT_MAX_LIMIT
    );
    const project = req.query.project as string | undefined;

    const db = this.dbManager.getSessionStore().db;

    // Export only local observations (not ones we imported from other machines)
    let obsQuery = `
      SELECT * FROM observations
      WHERE created_at_epoch > ?
        AND (source_machine IS NULL OR source_machine = ?)
    `;
    const obsParams: (string | number)[] = [sinceEpoch, this.machineId];

    if (project) {
      obsQuery += ' AND project = ?';
      obsParams.push(project);
    }
    obsQuery += ' ORDER BY created_at_epoch ASC LIMIT ?';
    obsParams.push(limit);

    const observations = db.prepare(obsQuery).all(...obsParams) as Record<string, unknown>[];

    // Export session summaries
    let sumQuery = `
      SELECT * FROM session_summaries
      WHERE created_at_epoch > ?
    `;
    const sumParams: (string | number)[] = [sinceEpoch];

    if (project) {
      sumQuery += ' AND project = ?';
      sumParams.push(project);
    }
    sumQuery += ' ORDER BY created_at_epoch ASC LIMIT ?';
    sumParams.push(limit);

    const summaries = db.prepare(sumQuery).all(...sumParams) as Record<string, unknown>[];

    res.json({
      machine: this.machineId,
      since_epoch: sinceEpoch,
      observations: observations.length,
      summaries: summaries.length,
      data: {
        observations,
        summaries
      }
    });

    logger.debug('SYNC', `Exported ${observations.length} obs + ${summaries.length} summaries since ${sinceEpoch}`);
  });

  /**
   * POST /api/sync/import
   * Body: { machine: string, observations: [...], summaries: [...] }
   * Imports observations from a remote machine, deduplicating by content_hash.
   */
  private handleImport = this.wrapHandler((req: Request, res: Response): void => {
    const { machine, observations, summaries } = req.body;

    if (!machine || typeof machine !== 'string') {
      this.badRequest(res, 'machine identifier is required');
      return;
    }

    if (machine === this.machineId) {
      this.badRequest(res, 'cannot import from self');
      return;
    }

    const sessionStore = this.dbManager.getSessionStore();
    const db = sessionStore.db;

    let obsImported = 0;
    let obsSkipped = 0;
    let sumImported = 0;
    let sumSkipped = 0;

    // Import observations
    if (Array.isArray(observations)) {
      const checkHash = db.prepare(
        'SELECT id FROM observations WHERE content_hash = ?'
      );
      const checkSync = db.prepare(
        'SELECT local_id FROM federation_sync WHERE remote_id = ? AND source_machine = ? AND record_type = ?'
      );

      for (const obs of observations) {
        // Skip if already synced (by remote_id + source_machine)
        const existing = checkSync.get(obs.id, machine, 'observation') as { local_id: number } | undefined;
        if (existing) {
          obsSkipped++;
          continue;
        }

        // Skip if content_hash already exists locally
        if (obs.content_hash) {
          const hashExists = checkHash.get(obs.content_hash) as { id: number } | undefined;
          if (hashExists) {
            // Record the mapping so we don't check again
            db.prepare(
              'INSERT OR IGNORE INTO federation_sync (remote_id, source_machine, record_type, local_id, synced_at_epoch) VALUES (?, ?, ?, ?, ?)'
            ).run(obs.id, machine, 'observation', hashExists.id, Math.floor(Date.now() / 1000));
            obsSkipped++;
            continue;
          }
        }

        // Ensure sdk_session exists for this observation
        const memorySessionId = obs.memory_session_id;
        this.ensureSessionExists(db, memorySessionId, obs.project, machine);

        // Insert observation with source_machine tracking
        const result = db.prepare(`
          INSERT INTO observations (
            memory_session_id, project, text, type, title, subtitle,
            facts, narrative, concepts, files_read, files_modified,
            prompt_number, discovery_tokens, content_hash,
            created_at, created_at_epoch, source_machine
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          memorySessionId, obs.project, obs.text, obs.type,
          obs.title, obs.subtitle, obs.facts, obs.narrative,
          obs.concepts, obs.files_read, obs.files_modified,
          obs.prompt_number || 0, obs.discovery_tokens || 0,
          obs.content_hash,
          obs.created_at, obs.created_at_epoch,
          machine
        );

        const localId = Number(result.lastInsertRowid);

        // Record sync mapping
        db.prepare(
          'INSERT OR IGNORE INTO federation_sync (remote_id, source_machine, record_type, local_id, synced_at_epoch) VALUES (?, ?, ?, ?, ?)'
        ).run(obs.id, machine, 'observation', localId, Math.floor(Date.now() / 1000));

        obsImported++;
      }
    }

    // Import session summaries
    if (Array.isArray(summaries)) {
      const checkSyncSum = db.prepare(
        'SELECT local_id FROM federation_sync WHERE remote_id = ? AND source_machine = ? AND record_type = ?'
      );

      for (const sum of summaries) {
        const existing = checkSyncSum.get(sum.id, machine, 'summary') as { local_id: number } | undefined;
        if (existing) {
          sumSkipped++;
          continue;
        }

        const memorySessionId = sum.memory_session_id;
        this.ensureSessionExists(db, memorySessionId, sum.project, machine);

        const result = db.prepare(`
          INSERT INTO session_summaries (
            memory_session_id, project, request, investigated, learned,
            completed, next_steps, files_read, files_edited, notes,
            prompt_number, discovery_tokens, created_at, created_at_epoch
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          memorySessionId, sum.project, sum.request, sum.investigated,
          sum.learned, sum.completed, sum.next_steps,
          sum.files_read, sum.files_edited, sum.notes,
          sum.prompt_number || 0, sum.discovery_tokens || 0,
          sum.created_at, sum.created_at_epoch
        );

        const localId = Number(result.lastInsertRowid);

        db.prepare(
          'INSERT OR IGNORE INTO federation_sync (remote_id, source_machine, record_type, local_id, synced_at_epoch) VALUES (?, ?, ?, ?, ?)'
        ).run(sum.id, machine, 'summary', localId, Math.floor(Date.now() / 1000));

        sumImported++;
      }
    }

    logger.info('SYNC', `Import from ${machine}: ${obsImported} obs imported, ${obsSkipped} skipped, ${sumImported} summaries imported, ${sumSkipped} skipped`);

    res.json({
      success: true,
      machine: this.machineId,
      from: machine,
      observations: { imported: obsImported, skipped: obsSkipped },
      summaries: { imported: sumImported, skipped: sumSkipped }
    });
  });

  /**
   * GET /api/sync/status
   * Returns sync tracking state: last sync times per remote machine, counts.
   */
  private handleStatus = this.wrapHandler((req: Request, res: Response): void => {
    const db = this.dbManager.getSessionStore().db;

    const perMachine = db.prepare(`
      SELECT
        source_machine,
        record_type,
        COUNT(*) as count,
        MAX(synced_at_epoch) as last_synced_epoch,
        MAX(remote_id) as max_remote_id
      FROM federation_sync
      GROUP BY source_machine, record_type
      ORDER BY source_machine, record_type
    `).all() as Array<{
      source_machine: string;
      record_type: string;
      count: number;
      last_synced_epoch: number;
      max_remote_id: number;
    }>;

    const localObsCount = db.prepare(
      'SELECT COUNT(*) as count FROM observations WHERE source_machine IS NULL OR source_machine = ?'
    ).get(this.machineId) as { count: number };

    const remoteObsCount = db.prepare(
      'SELECT COUNT(*) as count FROM observations WHERE source_machine IS NOT NULL AND source_machine != ?'
    ).get(this.machineId) as { count: number };

    res.json({
      machine: this.machineId,
      local_observations: localObsCount.count,
      remote_observations: remoteObsCount.count,
      sync_tracking: perMachine
    });
  });

  /**
   * GET /api/sync/identity
   * Returns this machine's identity for federation discovery.
   */
  private handleIdentity = this.wrapHandler((req: Request, res: Response): void => {
    const db = this.dbManager.getSessionStore().db;
    const obsCount = db.prepare('SELECT COUNT(*) as count FROM observations').get() as { count: number };
    const projectCount = db.prepare('SELECT COUNT(DISTINCT project) as count FROM observations').get() as { count: number };

    res.json({
      machine: this.machineId,
      observations: obsCount.count,
      projects: projectCount.count,
      platform: process.platform,
      arch: process.arch
    });
  });

  /**
   * Ensure an sdk_session exists for imported observations.
   * Creates a placeholder session if one doesn't exist.
   */
  private ensureSessionExists(db: Database, memorySessionId: string, project: string, sourceMachine: string): void {
    const existing = db.prepare(
      'SELECT memory_session_id FROM sdk_sessions WHERE memory_session_id = ?'
    ).get(memorySessionId) as { memory_session_id: string } | undefined;

    if (!existing) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO sdk_sessions (
          content_session_id, memory_session_id, project, status,
          created_at, custom_title
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        `federated-${sourceMachine}-${memorySessionId}`,
        memorySessionId,
        project,
        'completed',
        now,
        `Synced from ${sourceMachine}`
      );
    }
  }
}
