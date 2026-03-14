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
# Supports both single url and urls array with fallback:
#   {"name": "x", "url": "http://..."}                    -- single URL
#   {"name": "x", "urls": ["http://a", "http://b", ...]}  -- fallback list
PEERS=$(python3 -c "
import json
with open('$CONFIG') as f:
    cfg = json.load(f)
for p in cfg.get('peers', []):
    if not p.get('enabled', True):
        continue
    urls = p.get('urls', [])
    if not urls and 'url' in p:
        urls = [p['url']]
    print(p['name'] + '|' + ','.join(urls))
" 2>/dev/null)

if [ -z "$PEERS" ]; then
  log "No enabled peers"
  exit 0
fi

SYNCED=0
while IFS='|' read -r name urls_csv; do
  log "Syncing from $name..."

  # Try each URL in order until one works
  PEER_URL=""
  IFS=',' read -ra URLS <<< "$urls_csv"
  for candidate in "${URLS[@]}"; do
    if curl -sf --max-time 3 "$candidate/api/health" > /dev/null 2>&1; then
      PEER_URL="$candidate"
      break
    fi
    log "  $candidate unreachable, trying next..."
  done

  if [ -z "$PEER_URL" ]; then
    log "  $name: all URLs unreachable, skipping"
    continue
  fi
  log "  Using $PEER_URL"

  # Export from peer to temp file
  if ! curl -sf "$PEER_URL/api/sync/export?since_epoch=0&batch_size=500" -o "$TMPFILE" 2>/dev/null; then
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
