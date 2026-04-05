#!/usr/bin/env bash
# federation-sync.sh - Lightweight cron-friendly federation sync
# Reads peers from ~/.claude-mem/federation.json, pulls from each enabled peer
# Loops per-peer until all observations are synced (batch_size per round)
# Usage: ./federation-sync.sh [--verbose]
# Cron:  */5 * * * * /path/to/federation-sync.sh >> /tmp/claude-mem-sync.log 2>&1

set -euo pipefail

VERBOSE="${1:-}"
LOCAL="http://127.0.0.1:37777"
CONFIG="${CLAUDE_MEM_DATA_DIR:-$HOME/.claude-mem}/federation.json"
TMPFILE=$(mktemp /tmp/claude-mem-sync-XXXXXX.json)
trap 'rm -f "$TMPFILE"' EXIT

BATCH_SIZE=500
MAX_ROUNDS=50  # safety cap: 50 rounds * 500 = 25,000 observations max per peer

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

  # Loop: export batches with escalating since_epoch until no new data
  SINCE_EPOCH=0
  TOTAL_IMPORTED=0
  TOTAL_SKIPPED=0
  ROUND=0

  while [ "$ROUND" -lt "$MAX_ROUNDS" ]; do
    ROUND=$((ROUND + 1))

    # Export from peer
    if ! curl -sf "$PEER_URL/api/sync/export?since_epoch=$SINCE_EPOCH&limit=$BATCH_SIZE" -o "$TMPFILE" 2>/dev/null; then
      log "  Export failed from $name (round $ROUND)"
      break
    fi

    # Check how many observations were exported
    OBS_COUNT=$(python3 -c "import json; d=json.load(open('$TMPFILE')); print(d.get('observations', len(d.get('data',{}).get('observations',[]))))" 2>/dev/null || echo "0")

    if [ "$OBS_COUNT" = "0" ]; then
      log "  No more data from $name after round $((ROUND - 1))"
      break
    fi

    # Import to local
    RESULT=$(curl -sf -X POST -H "Content-Type: application/json" -d @"$TMPFILE" "$LOCAL/api/sync/import" 2>/dev/null) || { log "  Import failed from $name (round $ROUND)"; break; }

    IMPORTED=$(echo "$RESULT" | python3 -c "import json,sys; r=json.load(sys.stdin); o=r.get('observations',{}); print(o.get('imported',0) if isinstance(o,dict) else 0)" 2>/dev/null || echo "0")
    SKIPPED=$(echo "$RESULT" | python3 -c "import json,sys; r=json.load(sys.stdin); o=r.get('observations',{}); print(o.get('skipped',0) if isinstance(o,dict) else 0)" 2>/dev/null || echo "0")

    TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))

    # Get max created_at_epoch from this batch to advance the cursor
    NEW_EPOCH=$(python3 -c "
import json
d = json.load(open('$TMPFILE'))
obs = d.get('data', {}).get('observations', [])
if obs:
    print(max(o.get('created_at_epoch', 0) for o in obs))
else:
    print(0)
" 2>/dev/null || echo "0")

    if [ "$NEW_EPOCH" = "0" ] || [ "$NEW_EPOCH" = "$SINCE_EPOCH" ]; then
      break  # no progress
    fi

    SINCE_EPOCH="$NEW_EPOCH"
    log "  Round $ROUND: +$IMPORTED imported, $SKIPPED skipped (cursor=$SINCE_EPOCH)"

    # If we got fewer than batch_size, we've reached the end
    if [ "$OBS_COUNT" -lt "$BATCH_SIZE" ]; then
      break
    fi
  done

  log "  $name: total $TOTAL_IMPORTED imported, $TOTAL_SKIPPED skipped ($ROUND rounds)"
  SYNCED=$((SYNCED + 1))
done <<< "$PEERS"

log "Sync complete ($SYNCED peers)"
