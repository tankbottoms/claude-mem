# Claude-Mem: Agent Instructions

## Development Workflow

**Source of truth:** one designated development machine (`~/Developer/claude-mem/`).

**Flow:**

```
dev-machine ~/Developer/claude-mem  ->  git push origin main
                                           |
all peers ~/.claude/plugins/...       <-  git pull origin main
```

**Rules:**

1. Never edit code in the plugins directory (`~/.claude/plugins/`).
2. Before editing, verify the dev machine has pushed all changes:
   ```
   git fetch origin && git log origin/main..HEAD && git log HEAD..origin/main
   ```
3. All development happens in `~/Developer/claude-mem/` on the dev machine.
4. Push to `main` when ready.
5. Pull into the plugins directory on all peers after pushing.

## Federation Topology

This plugin supports running across multiple machines (a "federation"). The
specific hostnames, IPs, and SSH access patterns for any given federation are
operator-local and should be kept in a file outside of source control (for
example, `~/.claude/federation.json` or similar). **Do not commit per-operator
host lists, SSH usernames, LAN IPs, or tailnet hostnames to this repository.**

## Worker Restart Procedure (macOS)

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

On Linux peers, the worker runs as a systemd service or directly via Bun.

## Testing Across Machines

1. Make changes on the dev machine in `~/Developer/claude-mem/`
2. Build: `bun run build`
3. Test locally: verify worker starts, check `http://localhost:37777/api/health`
4. Push: `git push origin main`
5. Pull on each peer and restart the worker
6. Verify each peer's dual endpoint:
   ```
   curl -s  http://<peer>:37777/api/version
   curl -sk https://<peer>:37778/api/version
   ```

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
| 37778 | HTTPS | Worker API (TLS) |
| 8000 | HTTP | ChromaDB (default) |
