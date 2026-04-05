# Federation Setup Guide

Claude-mem federation enables peer-to-peer observation sync across machines. Each machine runs its own worker service on port 37777 (HTTP) or 37778 (HTTPS). Sync uses a pull model -- each machine pulls new observations from configured peers via the `/api/federation/pull` endpoint. No central server is required; every node is equal.

---

## Table of Contents

1. [Single Machine Setup (Zero Config)](#1-single-machine-setup-zero-config)
2. [Federation Prerequisites](#2-federation-prerequisites)
3. [Configuring federation.json](#3-configuring-federationjson)
4. [Running Federation Sync](#4-running-federation-sync)
5. [HTTPS/TLS with Tailscale](#5-httpstls-with-tailscale)
6. [Viewer Machine Config (machines.ts)](#6-viewer-machine-config-machinests)
7. [Architecture Diagram](#7-architecture-diagram)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Single Machine Setup (Zero Config)

No federation configuration is needed for single-machine use.

- Install the claude-mem plugin.
- The worker starts automatically on `http://127.0.0.1:37777`.
- A SQLite database is created at `~/.claude-mem/claude-mem.db`.
- Observations are stored locally and available immediately.

Verify the worker is running:

```bash
curl -sf http://127.0.0.1:37777/api/health
```

---

## Quick Start with Setup Wizard

The interactive setup wizard automates the steps below. It validates prerequisites, creates or validates `federation.json`, tests peer connectivity, installs the cron job, and optionally configures HTTPS and the viewer:

```bash
./scripts/federation-setup.sh
```

Run with `--help` for usage details. Each step is opt-in with a y/n confirmation prompt.

---

## 2. Federation Prerequisites

Before setting up federation, confirm the following on **every** machine that will participate:

- **Worker service running** -- verify with `curl -sf http://127.0.0.1:37777/api/health` on each machine.
- **Network connectivity** between machines (LAN preferred; Tailscale for remote access).
- **`jq` and `python3` available** -- the sync script uses both for JSON parsing.
- **Unique hostname** per machine -- used to identify the source of observations.
- **Firewall rules** -- port 37777 (HTTP) and optionally 37778 (HTTPS) must be open between peers.

---

## 3. Configuring federation.json

The federation config lives at `~/.claude-mem/federation.json`. Each machine lists only its **peers** (not itself).

A reference template is available at [`docs/federation.example.json`](./federation.example.json).

### Minimal Example (Two Machines)

On **Machine A**, create `~/.claude-mem/federation.json`:

```json
{
  "peers": [
    {
      "name": "machine-b",
      "urls": ["http://192.168.1.200:37777"],
      "enabled": true
    }
  ]
}
```

On **Machine B**, create the same file listing Machine A:

```json
{
  "peers": [
    {
      "name": "machine-a",
      "urls": ["http://192.168.1.100:37777"],
      "enabled": true
    }
  ]
}
```

### Full Example with Fallback URLs

The `urls` array supports fallback -- if the first URL is unreachable, the next is tried in order:

```json
{
  "peers": [
    {
      "name": "gpu-node-1",
      "urls": ["http://192.168.1.100:37777"],
      "enabled": true
    },
    {
      "name": "dev-machine",
      "urls": [
        "http://192.168.1.200:37777",
        "https://dev-machine.your-tailnet.ts.net:37778"
      ],
      "enabled": true
    }
  ]
}
```

### Configuration Notes

- **`name`** -- A human-readable label for the peer. Used in logs.
- **`urls`** -- Array of URLs to try, in order. LAN IPs should come first, Tailscale URLs as fallback.
- **`enabled`** -- Set to `false` to temporarily disable a peer without removing it from the config.
- The legacy single-`url` field is also supported for backwards compatibility:
  ```json
  { "name": "old-format", "url": "http://192.168.1.50:37777" }
  ```

---

## 4. Running Federation Sync

### Manual Run

```bash
./scripts/federation-sync.sh --verbose
```

The `--verbose` flag enables timestamped logging for each peer, round, and import result.

### Automated via Cron

Add a cron entry to sync every 5 minutes:

```bash
crontab -e
```

Add the following line:

```
*/5 * * * * /path/to/claude-mem/scripts/federation-sync.sh >> /tmp/claude-mem-sync.log 2>&1
```

Replace `/path/to/claude-mem` with the actual path to your installation.

### How Sync Works

1. The script reads `~/.claude-mem/federation.json` and iterates over enabled peers.
2. For each peer, it tries URLs in order until one responds to `/api/health`.
3. It exports observations in batches from the peer via `/api/sync/export?since_epoch=N&limit=500`.
4. Each batch is imported locally via `POST /api/sync/import`.
5. The loop continues until no new observations are returned or the safety cap is reached.

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BATCH_SIZE` | 500 | Observations per export request |
| `MAX_ROUNDS` | 50 | Maximum rounds per peer (safety cap) |
| Max per peer per run | 25,000 | `BATCH_SIZE` x `MAX_ROUNDS` |

### Check Before Adding to Cron

Verify it is not already scheduled:

```bash
crontab -l | grep federation-sync
```

---

## 5. HTTPS/TLS with Tailscale

HTTPS is optional but recommended for peers accessed over the internet or Tailscale.

### Generate Certificates

Tailscale can provision TLS certificates for your MagicDNS hostname:

```bash
sudo tailscale cert $(tailscale status --self --json | jq -r '.Self.DNSName | rtrimstr(".")')
```

### Certificate Locations

| Platform | Directory |
|----------|-----------|
| macOS | `~/.local/share/tailscale/certs/` |
| Linux | `/var/lib/tailscale/certs/` |

The files are named `<hostname>.crt` and `<hostname>.key`.

You can also set a custom location:

```bash
export CLAUDE_MEM_HTTPS_CERT_DIR=/path/to/certs
```

### Enable HTTPS

Set these environment variables before starting the worker:

```bash
export CLAUDE_MEM_HTTPS_ENABLED=true
export CLAUDE_MEM_HTTPS_PORT=37778
```

On macOS, you can set these in the LaunchAgent plist under the `EnvironmentVariables` dictionary for persistence.

### Update Peer Configuration

Once HTTPS is enabled on a machine, add the HTTPS URL to that machine's entry in other peers' `federation.json`:

```json
{
  "name": "https-machine",
  "urls": [
    "http://192.168.1.100:37777",
    "https://https-machine.your-tailnet.ts.net:37778"
  ],
  "enabled": true
}
```

---

## 6. Viewer Machine Config (machines.ts)

The web viewer at `http://localhost:37777` can display federation machine badges with custom colors and Tailscale MagicDNS links.

### Setup

1. Copy the example template:

   ```bash
   cp src/ui/viewer/utils/machines.example.ts src/ui/viewer/utils/machines.ts
   ```

2. Edit `machines.ts` and populate:

   ```typescript
   const TAILSCALE_DOMAIN = 'your-tailnet.ts.net';

   const MACHINE_IPS: Record<string, string> = {
     'machine-a': '192.168.1.100',
     'machine-b': '192.168.1.200',
   };

   const MACHINE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
     'machine-a': { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)' },
     'machine-b': { bg: 'rgba(126, 231, 135, 0.15)', text: '#7ee687', border: 'rgba(126, 231, 135, 0.3)' },
   };
   ```

3. Rebuild the viewer: `bun run build`

`machines.ts` is gitignored -- your local configuration will never be committed.

---

## 7. Architecture Diagram

```
  Machine A                    Machine B                    Machine C
  ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
  │ Worker:37777│            │ Worker:37777│            │ Worker:37777│
  │ SQLite DB   │            │ SQLite DB   │            │ SQLite DB   │
  │ ChromaDB    │            │ ChromaDB    │            │ ChromaDB    │
  └──────┬──────┘            └──────┬──────┘            └──────┬──────┘
         │                          │                          │
         │    pull from B,C         │    pull from A,C         │    pull from A,B
         ├─────────────────────────>│<─────────────────────────┤
         │<─────────────────────────┤─────────────────────────>│
         │                          │                          │
    cron */5min               cron */5min               cron */5min
```

Each machine independently pulls from its configured peers on a cron schedule. There is no central coordinator -- every machine converges to the same observation set through bilateral pulls.

---

## 8. Troubleshooting

### Sync Not Running

- Verify cron is active: `crontab -l | grep federation-sync`
- Check worker health: `curl -sf http://127.0.0.1:37777/api/health`
- Review sync log: `cat /tmp/claude-mem-sync.log`
- Run manually with verbose output: `./scripts/federation-sync.sh --verbose`

### Peer Unreachable

- Test network connectivity: `curl -sf http://<peer-ip>:37777/api/health`
- Verify the worker is running on the remote machine.
- Check firewall rules -- port 37777 must be open.
- If using Tailscale, verify both machines are on the same tailnet: `tailscale status`

### Duplicate Observations

Duplicates are prevented by content hashing. The `federation_sync` table tracks imported records, and observations with matching `content_hash` values are skipped during import. No manual deduplication is needed.

### HTTPS Certificate Errors

- Regenerate certificates: `sudo tailscale cert <hostname>.your-tailnet.ts.net`
- Verify cert directory permissions -- the worker process must be able to read the `.crt` and `.key` files.
- Confirm the cert filenames match the MagicDNS hostname exactly.
- Check `CLAUDE_MEM_HTTPS_CERT_DIR` if using a custom cert location.

### High Sync Volume

If sync runs are taking too long or importing excessive data:

- Reduce `BATCH_SIZE` in `scripts/federation-sync.sh` (default: 500).
- Reduce `MAX_ROUNDS` (default: 50).
- Stagger cron schedules across machines to avoid simultaneous pulls.

### federation.json Not Found

The sync script exits cleanly (code 0) if no config file exists. Verify the path:

```bash
ls ~/.claude-mem/federation.json
```

If using a custom data directory, set `CLAUDE_MEM_DATA_DIR`:

```bash
export CLAUDE_MEM_DATA_DIR=/path/to/data
```
