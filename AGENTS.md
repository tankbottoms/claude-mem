# Claude-Mem: Agent Instructions

## Development Workflow

**Source of truth:** mepstudio (`~/Developer/claude-mem/`)

**Flow:**

```
mepstudio ~/Developer/claude-mem  ->  git push origin main
                                          |
all machines ~/.claude/plugins/...  <-  git pull origin main
```

**Rules:**

1. Never edit code in the plugins directory (`~/.claude/plugins/`).
2. Before editing, verify mepstudio has pushed all changes: `git fetch origin && git log origin/main..HEAD && git log HEAD..origin/main`
3. All development happens in `~/Developer/claude-mem/` on mepstudio.
4. Push to `main` when ready.
5. Pull into plugins directory on all machines after pushing.

## SSH Access

| Machine | SSH Command | User | LAN IP |
|---------|-------------|------|--------|
| mepstudio | `ssh mark.phillips@192.168.1.217` | mark.phillips | 192.168.1.217 |
| spark-1 | `ssh rooot@192.168.1.76` | rooot | 192.168.1.76 |
| spark-2 | `ssh rooot@192.168.1.63` | rooot | 192.168.1.63 |
| mepmbp2022 | `ssh mark.phillips@192.168.1.13` | mark.phillips | 192.168.1.13 |
| mepmbp2020 | `ssh rooot@192.168.1.205` | rooot | 192.168.1.205 |
| mepmbp2019 | `ssh mark.phillips@192.168.1.145` | mark.phillips | 192.168.1.145 |

## Worker Restart Procedure

```bash
# 1. Unload watchdog first (prevents auto-restart during maintenance)
launchctl unload ~/Library/LaunchAgents/com.claude-mem.network-watchdog.plist

# 2. Unload worker
launchctl unload ~/Library/LaunchAgents/com.claude-mem.worker.plist

# 3. Reload worker
launchctl load ~/Library/LaunchAgents/com.claude-mem.worker.plist

# 4. Reload watchdog
launchctl load ~/Library/LaunchAgents/com.claude-mem.network-watchdog.plist
```

On Linux (spark-1, spark-2), the worker runs as a systemd service or directly via Bun.

## Testing Across Machines

1. Make changes on mepstudio in `~/Developer/claude-mem/`
2. Build: `bun run build`
3. Test locally: verify worker starts, check `http://localhost:37777/api/health`
4. Push: `git push origin main`
5. Pull on target machine: `ssh <user>@<ip> "cd ~/.claude/plugins/<path> && git pull origin main"`
6. Restart worker on target machine
7. Verify: `curl http://<ip>:37777/api/health`

## Key Source Files

| File | Purpose |
|------|---------|
| `src/shared/SettingsDefaultsManager.ts` | All 42+ configuration defaults, env var overrides |
| `src/services/server/Server.ts` | Express app, HTTP/HTTPS listeners, route registration |
| `src/services/server/TlsCertResolver.ts` | TLS cert discovery (Tailscale auto-detect) |
| `src/shared/tailscale-utils.ts` | MagicDNS hostname detection |
| `src/services/sync/ChromaSync.ts` | SQLite -> ChromaDB vector sync |
| `src/services/search/strategies/ChromaSearchStrategy.ts` | Semantic search via Chroma |
| `src/services/worker-service.ts` | Main worker entry point |
| `plugin/hooks/hooks.json` | Lifecycle hook definitions |
| `scripts/federation-sync.sh` | Peer-to-peer observation sync |
| `src/ui/viewer/` | React web dashboard |

## LaunchAgent Plists

| File | Label | Purpose |
|------|-------|---------|
| `~/Library/LaunchAgents/com.claude-mem.worker.plist` | Worker service | Runs worker via Bun, KeepAlive |
| `~/Library/LaunchAgents/com.claude-mem.cleanup.plist` | Cleanup | Runs cleanup script every 120s |
| `~/Library/LaunchAgents/com.claude-mem.network-watchdog.plist` | Watchdog | Network monitoring every 300s |

## Ports

| Port | Protocol | Service |
|------|----------|---------|
| 37777 | HTTP | Worker API + Web UI |
| 37778 | HTTPS | Worker API (TLS, mepstudio only) |
| 8000 | HTTP | ChromaDB (most machines) |
| 8100 | HTTP | ChromaDB (spark-1 only) |
