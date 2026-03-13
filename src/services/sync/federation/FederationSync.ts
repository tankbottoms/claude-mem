/**
 * Federation Sync Service
 *
 * Pulls observations and session summaries from remote claude-mem workers
 * and pushes local ones to remote machines. Uses the /api/sync/* endpoints
 * exposed by FederationSyncRoutes.
 *
 * Designed to run as a background loop within the worker process or as
 * a standalone daemon via the CLI entry point.
 */

import { hostname } from 'os';
import { logger } from '../../../utils/logger.js';

export interface FederationPeer {
  name: string;
  url: string;  // e.g. "http://192.168.1.76:37777" or "http://spark-2:37777"
  enabled: boolean;
}

export interface FederationConfig {
  /** This machine's identity */
  machineId: string;
  /** Local worker URL for pushing imported data */
  localUrl: string;
  /** Remote peers to sync with */
  peers: FederationPeer[];
  /** Sync interval in seconds */
  intervalSeconds: number;
  /** Max records per sync batch */
  batchSize: number;
}

interface SyncState {
  /** Last exported epoch per peer (what we've sent them) */
  lastExportEpoch: Map<string, number>;
  /** Last imported epoch per peer (what we've received from them) */
  lastImportEpoch: Map<string, number>;
}

interface ExportResponse {
  machine: string;
  since_epoch: number;
  observations: number;
  summaries: number;
  data: {
    observations: Record<string, unknown>[];
    summaries: Record<string, unknown>[];
  };
}

interface ImportResponse {
  success: boolean;
  machine: string;
  from: string;
  observations: { imported: number; skipped: number };
  summaries: { imported: number; skipped: number };
}

interface SyncStatusResponse {
  machine: string;
  local_observations: number;
  remote_observations: number;
  sync_tracking: Array<{
    source_machine: string;
    record_type: string;
    count: number;
    last_synced_epoch: number;
    max_remote_id: number;
  }>;
}

export class FederationSync {
  private config: FederationConfig;
  private state: SyncState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: FederationConfig) {
    this.config = config;
    this.state = {
      lastExportEpoch: new Map(),
      lastImportEpoch: new Map()
    };
  }

  /**
   * Start the sync loop. Runs immediately then repeats on interval.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    logger.info('SYNC', `Federation sync started: ${this.config.peers.length} peers, ${this.config.intervalSeconds}s interval`);

    // Run immediately, then on interval
    this.syncAll().catch(err => {
      logger.error('SYNC', 'Initial sync failed', {}, err as Error);
    });

    this.timer = setInterval(() => {
      this.syncAll().catch(err => {
        logger.error('SYNC', 'Sync cycle failed', {}, err as Error);
      });
    }, this.config.intervalSeconds * 1000);
  }

  /**
   * Stop the sync loop.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info('SYNC', 'Federation sync stopped');
  }

  /**
   * Run a full sync cycle: pull from each peer, then push to each peer.
   */
  async syncAll(): Promise<void> {
    const enabledPeers = this.config.peers.filter(p => p.enabled);

    for (const peer of enabledPeers) {
      try {
        await this.pullFromPeer(peer);
      } catch (err) {
        logger.error('SYNC', `Pull from ${peer.name} failed`, { url: peer.url }, err as Error);
      }

      try {
        await this.pushToPeer(peer);
      } catch (err) {
        logger.error('SYNC', `Push to ${peer.name} failed`, { url: peer.url }, err as Error);
      }
    }
  }

  /**
   * Pull observations from a remote peer and import them locally.
   */
  async pullFromPeer(peer: FederationPeer): Promise<void> {
    const sinceEpoch = this.state.lastImportEpoch.get(peer.name) || 0;

    // Fetch remote observations
    const exportUrl = `${peer.url}/api/sync/export?since_epoch=${sinceEpoch}&limit=${this.config.batchSize}`;
    const exportRes = await fetch(exportUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000)
    });

    if (!exportRes.ok) {
      throw new Error(`Export from ${peer.name} returned ${exportRes.status}`);
    }

    const exportData = await exportRes.json() as ExportResponse;

    if (exportData.observations === 0 && exportData.summaries === 0) {
      logger.debug('SYNC', `No new data from ${peer.name} since epoch ${sinceEpoch}`);
      return;
    }

    // Import into local worker
    const importRes = await fetch(`${this.config.localUrl}/api/sync/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine: exportData.machine,
        observations: exportData.data.observations,
        summaries: exportData.data.summaries
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!importRes.ok) {
      throw new Error(`Local import returned ${importRes.status}`);
    }

    const importData = await importRes.json() as ImportResponse;

    // Update watermark to the latest epoch we received
    const maxObsEpoch = exportData.data.observations.reduce(
      (max, obs) => Math.max(max, (obs.created_at_epoch as number) || 0), sinceEpoch
    );
    const maxSumEpoch = exportData.data.summaries.reduce(
      (max, sum) => Math.max(max, (sum.created_at_epoch as number) || 0), sinceEpoch
    );
    this.state.lastImportEpoch.set(peer.name, Math.max(maxObsEpoch, maxSumEpoch));

    logger.info('SYNC', `Pulled from ${peer.name}: ${importData.observations.imported} obs, ${importData.summaries.imported} summaries`);
  }

  /**
   * Push local observations to a remote peer.
   */
  async pushToPeer(peer: FederationPeer): Promise<void> {
    const sinceEpoch = this.state.lastExportEpoch.get(peer.name) || 0;

    // Export from local
    const exportUrl = `${this.config.localUrl}/api/sync/export?since_epoch=${sinceEpoch}&limit=${this.config.batchSize}`;
    const exportRes = await fetch(exportUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30000)
    });

    if (!exportRes.ok) {
      throw new Error(`Local export returned ${exportRes.status}`);
    }

    const exportData = await exportRes.json() as ExportResponse;

    if (exportData.observations === 0 && exportData.summaries === 0) {
      logger.debug('SYNC', `No new local data to push to ${peer.name} since epoch ${sinceEpoch}`);
      return;
    }

    // Push to remote
    const importRes = await fetch(`${peer.url}/api/sync/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine: exportData.machine,
        observations: exportData.data.observations,
        summaries: exportData.data.summaries
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!importRes.ok) {
      throw new Error(`Push to ${peer.name} returned ${importRes.status}`);
    }

    const importData = await importRes.json() as ImportResponse;

    // Update watermark
    const maxObsEpoch = exportData.data.observations.reduce(
      (max, obs) => Math.max(max, (obs.created_at_epoch as number) || 0), sinceEpoch
    );
    const maxSumEpoch = exportData.data.summaries.reduce(
      (max, sum) => Math.max(max, (sum.created_at_epoch as number) || 0), sinceEpoch
    );
    this.state.lastExportEpoch.set(peer.name, Math.max(maxObsEpoch, maxSumEpoch));

    logger.info('SYNC', `Pushed to ${peer.name}: ${importData.observations.imported} obs, ${importData.summaries.imported} summaries`);
  }

  /**
   * Get sync status from the local worker.
   */
  async getStatus(): Promise<SyncStatusResponse> {
    const res = await fetch(`${this.config.localUrl}/api/sync/status`, {
      signal: AbortSignal.timeout(10000)
    });
    return await res.json() as SyncStatusResponse;
  }

  /**
   * Create a FederationConfig from environment or settings.
   */
  static createDefaultConfig(): FederationConfig {
    const machineId = hostname();
    const workerPort = process.env.CLAUDE_MEM_WORKER_PORT || '37777';

    return {
      machineId,
      localUrl: `http://localhost:${workerPort}`,
      peers: [],
      intervalSeconds: 300,  // 5 minutes
      batchSize: 500
    };
  }
}
