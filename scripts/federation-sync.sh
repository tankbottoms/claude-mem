#!/usr/bin/env bash
# federation-sync.sh - Lightweight cron-friendly federation sync
# Reads peers from ~/.claude-mem/federation.json, pulls from each enabled peer
# Usage: ./federation-sync.sh [--verbose]
# Cron:  */5 * * * * /path/to/federation-sync.sh >> /tmp/claude-mem-sync.log 2>&1

set -euo pipefail

VERBOSE="${1:-}"
LOCAL="http://127.0.0.1:37777"
CONFIG="${CLAUDE_MEM_DATA_DIR:-$HOME/.claude-mem}/federation.json"
TMPFILE=$(mktemp /tmp/claude-mem-sync-XXXXXX.json)
trap 'rm -f "$TMPFILE"' EXIT

log() { [ "$VERBOSE" = "--verbose" ] && echo "$(date +%H:%M:%S) $*" || true; }

if [ ! -f "$CONFIG" ]; then
  echo "No federation config at $CONFIG"
  exit 0
fi

# Check worker is up
if ! curl -sf "$LOCAL/api/health" > /dev/null 2>&1; then
  log "Worker not running, skipping sync"
  exit 0
fi

# Parse peers from JSON
PEERS=$(python3 -c "
import json
with open('$CONFIG') as f:
    cfg = json.load(f)
for p in cfg.get('peers', []):
    if p.get('enabled', True):
        print(p['name'] + '|' + p['url'])
" 2>/dev/null)

if [ -z "$PEERS" ]; then
  log "No enabled peers"
  exit 0
fi

SYNCED=0
while IFS='|' read -r name url; do
  log "Syncing from $name ($url)..."

  # Check peer is reachable
  if ! curl -sf "$url/api/health" > /dev/null 2>&1; then
    log "  $name unreachable, skipping"
    continue
  fi

  # Export from peer to temp file
  if ! curl -sf "$url/api/sync/export?since_epoch=0&batch_size=500" -o "$TMPFILE" 2>/dev/null; then
    log "  Export failed from $name"
    continue
  fi

  # Import to local from temp file
  RESULT=$(curl -sf -X POST -H "Content-Type: application/json" -d @"$TMPFILE" "$LOCAL/api/sync/import" 2>/dev/null) || { log "  Import failed from $name"; continue; }

  IMPORTED=$(echo "$RESULT" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r.get('imported_observations',0))" 2>/dev/null || echo "?")
  log "  $name: imported $IMPORTED observations"
  SYNCED=$((SYNCED + 1))
done <<< "$PEERS"

log "Sync complete ($SYNCED peers)"
