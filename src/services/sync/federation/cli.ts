#!/usr/bin/env bun
/**
 * Federation Sync CLI
 *
 * Standalone daemon that syncs claude-mem observations between machines.
 * Can run alongside the worker or independently.
 *
 * Usage:
 *   bun run src/services/sync/federation/cli.ts
 *   bun run src/services/sync/federation/cli.ts --config ~/.claude-mem/federation.json
 *   bun run src/services/sync/federation/cli.ts --once   # Single sync, then exit
 *
 * Config file format (~/.claude-mem/federation.json):
 * {
 *   "peers": [
 *     { "name": "spark-1", "url": "http://192.168.1.76:37777", "enabled": true },
 *     { "name": "mepstudio", "url": "http://mepstudio:37777", "enabled": true }
 *   ],
 *   "intervalSeconds": 300,
 *   "batchSize": 500
 * }
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { hostname } from 'os';
import { FederationSync, type FederationConfig, type FederationPeer } from './FederationSync.js';

const DEFAULT_CONFIG_PATH = join(
  process.env.CLAUDE_MEM_DATA_DIR || join(process.env.HOME || '~', '.claude-mem'),
  'federation.json'
);

function loadConfig(configPath: string): FederationConfig {
  const machineId = hostname();
  const workerPort = process.env.CLAUDE_MEM_WORKER_PORT || '37777';

  const defaults: FederationConfig = {
    machineId,
    localUrl: `http://localhost:${workerPort}`,
    peers: [],
    intervalSeconds: 300,
    batchSize: 500
  };

  if (!existsSync(configPath)) {
    console.error(`Config not found at ${configPath}`);
    console.error('Create federation.json with your peer list. Example:');
    console.error(JSON.stringify({
      peers: [
        { name: 'spark-1', url: 'http://192.168.1.76:37777', enabled: true },
        { name: 'mepstudio', url: 'http://mepstudio:37777', enabled: true }
      ],
      intervalSeconds: 300,
      batchSize: 500
    }, null, 2));
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));

  return {
    ...defaults,
    ...raw,
    machineId,  // Always use actual hostname
    localUrl: raw.localUrl || defaults.localUrl
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configFlag = args.indexOf('--config');
  const configPath = configFlag >= 0 ? args[configFlag + 1] : DEFAULT_CONFIG_PATH;
  const once = args.includes('--once');

  const config = loadConfig(configPath);

  // Filter out self from peers
  config.peers = config.peers.filter(p => p.name !== config.machineId);

  console.log(`[federation-sync] Machine: ${config.machineId}`);
  console.log(`[federation-sync] Local worker: ${config.localUrl}`);
  console.log(`[federation-sync] Peers: ${config.peers.map(p => `${p.name} (${p.url})`).join(', ')}`);

  // Verify local worker is reachable
  try {
    const healthRes = await fetch(`${config.localUrl}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!healthRes.ok) {
      console.error(`[federation-sync] Local worker unhealthy: ${healthRes.status}`);
      process.exit(1);
    }
    console.log('[federation-sync] Local worker healthy');
  } catch (err) {
    console.error(`[federation-sync] Cannot reach local worker at ${config.localUrl}: ${err}`);
    process.exit(1);
  }

  // Verify peers are reachable
  for (const peer of config.peers) {
    try {
      const res = await fetch(`${peer.url}/api/sync/identity`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const identity = await res.json() as { machine: string; observations: number; projects: number };
        console.log(`[federation-sync] Peer ${peer.name}: ${identity.observations} obs, ${identity.projects} projects`);
      } else {
        console.warn(`[federation-sync] Peer ${peer.name} returned ${res.status} -- will retry on sync`);
      }
    } catch {
      console.warn(`[federation-sync] Peer ${peer.name} unreachable at ${peer.url} -- will retry on sync`);
    }
  }

  const sync = new FederationSync(config);

  if (once) {
    console.log('[federation-sync] Running single sync cycle...');
    await sync.syncAll();
    console.log('[federation-sync] Done');
    return;
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[federation-sync] Shutting down...');
    sync.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`[federation-sync] Starting sync loop (every ${config.intervalSeconds}s)`);
  sync.start();
}

main().catch(err => {
  console.error('[federation-sync] Fatal error:', err);
  process.exit(1);
});
