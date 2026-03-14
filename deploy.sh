#!/usr/bin/env bash
set -euo pipefail

# deploy.sh - Pull latest and sync plugin artifacts + restart worker
# Usage: git pull && ./deploy.sh
#   or:  ./deploy.sh          (if you already pulled)

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS="$REPO_DIR/plugin/scripts"

echo "Deploying claude-mem from $REPO_DIR"

# Verify built artifacts exist
for f in context-generator.cjs mcp-server.cjs worker-service.cjs; do
  if [ ! -f "$SCRIPTS/$f" ]; then
    echo "ERROR: $SCRIPTS/$f not found. Run 'npm run build' first."
    exit 1
  fi
done

# Find all plugin script directories
TARGETS=()

# Plugin cache dirs
for d in "$HOME/.claude/plugins/cache/thedotmack/claude-mem"/*/scripts; do
  [ -d "$d" ] && TARGETS+=("$d")
done

# Marketplace dirs
for d in $(find "$HOME/.claude/plugins/marketplaces/thedotmack" -name scripts -type d 2>/dev/null); do
  TARGETS+=("$d")
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  echo "WARNING: No plugin directories found. Is claude-mem installed?"
  exit 1
fi

# Copy artifacts
for target in "${TARGETS[@]}"; do
  cp "$SCRIPTS/context-generator.cjs" "$target/"
  cp "$SCRIPTS/mcp-server.cjs" "$target/"
  cp "$SCRIPTS/worker-service.cjs" "$target/"
  echo "  -> $target"
done

# Kill any running worker first (critical: old process holds the port)
echo ""
echo "Stopping old worker..."
pkill -f worker-service.cjs 2>/dev/null && echo "  Killed old worker" || echo "  No worker running"
sleep 3

# Verify port is free
if curl -sf http://127.0.0.1:37777/api/health > /dev/null 2>&1; then
  echo "  WARNING: Port 37777 still occupied, force killing..."
  pkill -9 -f worker-service.cjs 2>/dev/null || true
  sleep 2
fi

# Start worker
echo "Starting worker..."
if systemctl --user is-active claude-mem-worker &>/dev/null 2>&1; then
  systemctl --user restart claude-mem-worker
  echo "  Restarted via systemd"
else
  # Use the highest version cache dir (most recent plugin version)
  WORKER=$(ls -d "$HOME/.claude/plugins/cache/thedotmack/claude-mem"/*/scripts/worker-service.cjs 2>/dev/null | sort -V | tail -1)
  [ -z "$WORKER" ] && WORKER="${TARGETS[0]}/worker-service.cjs"
  nohup bun run "$WORKER" > /tmp/claude-mem-worker.log 2>&1 &
  echo "  Started worker (pid $!) from $(dirname "$WORKER")"
fi

# Verify
sleep 5
if curl -sf http://127.0.0.1:37777/api/health > /dev/null 2>&1; then
  echo ""
  echo "Worker healthy. Deploy complete."
else
  echo ""
  echo "WARNING: Worker health check failed. Check /tmp/claude-mem-worker.log"
fi
