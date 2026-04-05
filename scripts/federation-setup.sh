#!/usr/bin/env bash
set -euo pipefail

# federation-setup.sh -- Interactive federation setup wizard for claude-mem
# Validates config, tests peers, installs cron, optionally sets up HTTPS.

# ── Colors ────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { printf "${BLUE}[INFO]${NC}  %s\n" "$*"; }
ok()      { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
err()     { printf "${RED}[ERROR]${NC} %s\n" "$*"; }
header()  { printf "\n${BOLD}── %s ──${NC}\n\n" "$*"; }

# ── Constants ─────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${CLAUDE_MEM_DATA_DIR:-$HOME/.claude-mem}"
FEDERATION_JSON="$DATA_DIR/federation.json"
SYNC_SCRIPT="$SCRIPT_DIR/federation-sync.sh"
MACHINES_EXAMPLE="$REPO_ROOT/src/ui/viewer/utils/machines.example.ts"
MACHINES_TS="$REPO_ROOT/src/ui/viewer/utils/machines.ts"
WORKER_URL="http://127.0.0.1:37777"

# ── Help ──────────────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
federation-setup.sh -- Interactive federation setup wizard for claude-mem

Usage: ./scripts/federation-setup.sh [--help]

Steps (each is opt-in with y/n confirmation):

  1. Validate prerequisites (worker, jq, python3)
  2. Create or validate ~/.claude-mem/federation.json
  3. Test peer connectivity
  4. Install cron job for federation-sync.sh
  5. Generate machines.ts for the viewer UI (optional)
  6. Set up HTTPS via Tailscale certs (optional)
  7. Print summary

Environment variables:
  CLAUDE_MEM_DATA_DIR   Override data directory (default: ~/.claude-mem)

USAGE
  exit 0
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

confirm() {
  local prompt="${1:-Continue?}"
  local reply
  printf "${BOLD}%s [y/N]${NC} " "$prompt"
  read -r reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# ── Step 1: Validate prerequisites ────────────────────────────────────────────

header "Step 1: Validate prerequisites"

PREREQ_OK=true

# Check jq
if command -v jq &>/dev/null; then
  ok "jq found: $(command -v jq)"
else
  err "jq is not installed. Install it with: brew install jq (macOS) or apt install jq (Linux)"
  PREREQ_OK=false
fi

# Check python3
if command -v python3 &>/dev/null; then
  ok "python3 found: $(command -v python3)"
else
  warn "python3 not found. Some optional features may be unavailable."
fi

# Check worker health
if curl -sf --max-time 3 "$WORKER_URL/api/health" >/dev/null 2>&1; then
  ok "Worker is running at $WORKER_URL"
else
  warn "Worker is NOT reachable at $WORKER_URL"
  warn "Federation sync requires the worker. Start it before syncing."
fi

# Check federation-sync.sh exists
if [[ -x "$SYNC_SCRIPT" ]]; then
  ok "Sync script found: $SYNC_SCRIPT"
elif [[ -f "$SYNC_SCRIPT" ]]; then
  warn "Sync script exists but is not executable: $SYNC_SCRIPT"
  chmod +x "$SYNC_SCRIPT" && ok "Made sync script executable"
else
  err "Sync script not found at $SYNC_SCRIPT"
  PREREQ_OK=false
fi

# Check data directory
if [[ -d "$DATA_DIR" ]]; then
  ok "Data directory exists: $DATA_DIR"
else
  info "Data directory does not exist: $DATA_DIR"
  if confirm "Create $DATA_DIR?"; then
    mkdir -p "$DATA_DIR"
    ok "Created $DATA_DIR"
  else
    err "Data directory is required. Aborting."
    exit 1
  fi
fi

if [[ "$PREREQ_OK" == false ]]; then
  err "Some prerequisites are missing. Fix them before continuing."
  exit 1
fi

ok "All prerequisites satisfied."

# ── Step 2: Create / validate federation.json ─────────────────────────────────

header "Step 2: Federation config ($FEDERATION_JSON)"

if [[ -f "$FEDERATION_JSON" ]]; then
  info "Existing federation.json found."

  # Validate JSON syntax
  if jq empty "$FEDERATION_JSON" 2>/dev/null; then
    ok "JSON syntax is valid."
  else
    err "federation.json has invalid JSON syntax!"
    err "Fix it manually or delete it and re-run this wizard."
    exit 1
  fi

  # Validate structure
  PEER_COUNT=$(jq '.peers | length' "$FEDERATION_JSON" 2>/dev/null || echo 0)
  if [[ "$PEER_COUNT" -eq 0 ]]; then
    warn "No peers defined in federation.json."
  else
    ok "$PEER_COUNT peer(s) defined."
  fi

  # Validate each peer
  VALIDATION_ERRORS=0
  for i in $(seq 0 $((PEER_COUNT - 1))); do
    PEER_NAME=$(jq -r ".peers[$i].name // empty" "$FEDERATION_JSON")
    PEER_URLS=$(jq -r ".peers[$i].urls // empty" "$FEDERATION_JSON")
    PEER_ENABLED=$(jq -r ".peers[$i].enabled // empty" "$FEDERATION_JSON")

    if [[ -z "$PEER_NAME" ]]; then
      warn "Peer $i: missing 'name' field"
      VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi

    if [[ -z "$PEER_URLS" || "$PEER_URLS" == "null" ]]; then
      # Check for legacy single 'url' field
      PEER_URL=$(jq -r ".peers[$i].url // empty" "$FEDERATION_JSON")
      if [[ -n "$PEER_URL" ]]; then
        warn "Peer '$PEER_NAME': uses legacy 'url' field instead of 'urls' array"
      else
        warn "Peer '$PEER_NAME': missing 'urls' field"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
      fi
    fi

    if [[ -z "$PEER_ENABLED" ]]; then
      warn "Peer '$PEER_NAME': missing 'enabled' field (defaults to false)"
    fi
  done

  if [[ "$VALIDATION_ERRORS" -gt 0 ]]; then
    warn "$VALIDATION_ERRORS validation warning(s) found."
  else
    ok "All peers have required fields."
  fi

  # Show current config summary
  echo ""
  info "Current peers:"
  for i in $(seq 0 $((PEER_COUNT - 1))); do
    PEER_NAME=$(jq -r ".peers[$i].name" "$FEDERATION_JSON")
    PEER_ENABLED=$(jq -r ".peers[$i].enabled // false" "$FEDERATION_JSON")
    URL_COUNT=$(jq ".peers[$i].urls | length // 0" "$FEDERATION_JSON" 2>/dev/null || echo 1)
    STATUS="enabled"
    [[ "$PEER_ENABLED" != "true" ]] && STATUS="disabled"
    printf "  %-20s  %s  (%s URL(s))\n" "$PEER_NAME" "$STATUS" "$URL_COUNT"
  done

else
  info "No federation.json found."

  if confirm "Create a template federation.json?"; then
    echo ""
    info "Enter peer details (press Enter with empty name to finish):"
    PEERS_JSON="[]"
    while true; do
      printf "${BOLD}  Peer name:${NC} "
      read -r PEER_NAME
      [[ -z "$PEER_NAME" ]] && break

      printf "${BOLD}  URL (e.g., http://192.168.1.100:37777):${NC} "
      read -r PEER_URL
      if [[ -z "$PEER_URL" ]]; then
        warn "Skipping peer '$PEER_NAME' -- no URL provided."
        continue
      fi

      PEERS_JSON=$(echo "$PEERS_JSON" | jq \
        --arg name "$PEER_NAME" \
        --arg url "$PEER_URL" \
        '. + [{"name": $name, "urls": [$url], "enabled": true}]')
    done

    PEER_COUNT=$(echo "$PEERS_JSON" | jq 'length')
    if [[ "$PEER_COUNT" -eq 0 ]]; then
      warn "No peers added. Creating template with placeholder."
      PEERS_JSON='[{"name": "example-machine", "urls": ["http://192.168.1.100:37777"], "enabled": false}]'
    fi

    FULL_JSON=$(jq -n \
      --argjson peers "$PEERS_JSON" \
      '{"peers": $peers, "intervalSeconds": 300, "batchSize": 500}')

    echo "$FULL_JSON" | jq . > "$FEDERATION_JSON"
    ok "Created $FEDERATION_JSON"
    echo ""
    info "Contents:"
    jq . "$FEDERATION_JSON"

    PEER_COUNT=$(jq '.peers | length' "$FEDERATION_JSON")
  else
    warn "Skipping federation.json creation."
    PEER_COUNT=0
  fi
fi

# ── Step 3: Test peer connectivity ────────────────────────────────────────────

header "Step 3: Test peer connectivity"

if [[ ! -f "$FEDERATION_JSON" ]] || [[ "$PEER_COUNT" -eq 0 ]]; then
  warn "No peers to test. Skipping."
else
  if confirm "Test connectivity to all enabled peers?"; then
    REACHABLE=0
    UNREACHABLE=0

    for i in $(seq 0 $((PEER_COUNT - 1))); do
      PEER_NAME=$(jq -r ".peers[$i].name" "$FEDERATION_JSON")
      PEER_ENABLED=$(jq -r ".peers[$i].enabled // false" "$FEDERATION_JSON")

      if [[ "$PEER_ENABLED" != "true" ]]; then
        info "$PEER_NAME: skipped (disabled)"
        continue
      fi

      # Get URLs -- support both 'urls' array and legacy 'url' string
      URL_COUNT=$(jq ".peers[$i].urls | length" "$FEDERATION_JSON" 2>/dev/null || echo 0)
      if [[ "$URL_COUNT" -eq 0 ]]; then
        URLS=$(jq -r ".peers[$i].url // empty" "$FEDERATION_JSON")
        [[ -z "$URLS" ]] && { warn "$PEER_NAME: no URLs configured"; continue; }
        URLS=("$URLS")
      else
        mapfile -t URLS < <(jq -r ".peers[$i].urls[]" "$FEDERATION_JSON")
      fi

      PEER_REACHABLE=false
      for URL in "${URLS[@]}"; do
        HEALTH_URL="$URL/api/health"
        if curl -sf --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
          ok "$PEER_NAME: reachable via $URL"
          PEER_REACHABLE=true
          break
        else
          warn "$PEER_NAME: failed $URL"
        fi
      done

      if $PEER_REACHABLE; then
        REACHABLE=$((REACHABLE + 1))
      else
        err "$PEER_NAME: UNREACHABLE (all URLs failed)"
        UNREACHABLE=$((UNREACHABLE + 1))
      fi
    done

    echo ""
    info "Results: $REACHABLE reachable, $UNREACHABLE unreachable"
  else
    info "Skipping connectivity test."
  fi
fi

# ── Step 4: Install cron job ──────────────────────────────────────────────────

header "Step 4: Install cron job"

CRON_LINE="*/5 * * * * $SYNC_SCRIPT >> /tmp/claude-mem-sync.log 2>&1"

if confirm "Install cron job for federation sync (every 5 minutes)?"; then
  # Check if already installed
  EXISTING_CRON=$(crontab -l 2>/dev/null || true)
  if echo "$EXISTING_CRON" | grep -qF "federation-sync.sh"; then
    ok "Cron job already exists. No changes needed."
    info "Existing entry:"
    echo "$EXISTING_CRON" | grep "federation-sync" | sed 's/^/  /'
  else
    info "Will add:"
    echo "  $CRON_LINE"
    echo ""
    if confirm "Add this cron entry?"; then
      (echo "$EXISTING_CRON"; echo "$CRON_LINE") | crontab -
      ok "Cron job installed."
      info "View with: crontab -l"
      info "Logs at: /tmp/claude-mem-sync.log"
    else
      info "Skipped cron installation."
    fi
  fi
else
  info "Skipping cron installation."
fi

# ── Step 5: Viewer machine config (machines.ts) ──────────────────────────────

header "Step 5: Viewer machine config (optional)"

if [[ ! -f "$MACHINES_EXAMPLE" ]]; then
  warn "machines.example.ts not found at $MACHINES_EXAMPLE. Skipping."
elif [[ -f "$MACHINES_TS" ]]; then
  info "machines.ts already exists at $MACHINES_TS"
  if ! confirm "Overwrite machines.ts from federation.json?"; then
    info "Keeping existing machines.ts."
  else
    REGENERATE_MACHINES=true
  fi
else
  REGENERATE_MACHINES=false
  if confirm "Generate machines.ts from federation.json peers?"; then
    REGENERATE_MACHINES=true
  fi
fi

if [[ "${REGENERATE_MACHINES:-false}" == true ]] && [[ -f "$FEDERATION_JSON" ]]; then
  printf "${BOLD}  Tailscale domain (e.g., chihuahua-aeolian.ts.net):${NC} "
  read -r TS_DOMAIN

  # Color palette for machines
  COLORS=(
    "rgba(96, 165, 250, 0.15)|#60a5fa|rgba(96, 165, 250, 0.3)"    # blue
    "rgba(52, 211, 153, 0.15)|#34d399|rgba(52, 211, 153, 0.3)"    # emerald
    "rgba(251, 146, 60, 0.15)|#fb923c|rgba(251, 146, 60, 0.3)"    # orange
    "rgba(219, 171, 255, 0.15)|#d2a8ff|rgba(219, 171, 255, 0.3)"  # lavender
    "rgba(255, 123, 114, 0.15)|#ff7b72|rgba(255, 123, 114, 0.3)"  # coral
    "rgba(126, 231, 135, 0.15)|#7ee687|rgba(126, 231, 135, 0.3)"  # mint
    "rgba(255, 215, 0, 0.15)|#ffd700|rgba(255, 215, 0, 0.3)"      # gold
    "rgba(165, 180, 252, 0.15)|#a5b4fc|rgba(165, 180, 252, 0.3)"  # indigo
  )

  # Build MACHINE_IPS entries
  IP_ENTRIES=""
  COLOR_ENTRIES=""
  COLOR_IDX=0
  for i in $(seq 0 $((PEER_COUNT - 1))); do
    PEER_NAME=$(jq -r ".peers[$i].name" "$FEDERATION_JSON")
    # Extract LAN IP from urls (last URL is typically LAN)
    PEER_IP=$(jq -r ".peers[$i].urls[-1]" "$FEDERATION_JSON" 2>/dev/null | sed -E 's|https?://([^:]+):.*|\1|')
    if [[ -n "$PEER_IP" && "$PEER_IP" != "null" ]]; then
      IP_ENTRIES="${IP_ENTRIES}  '${PEER_NAME}': '${PEER_IP}',\n"
    fi

    # Assign color
    IFS='|' read -r BG TEXT BORDER <<< "${COLORS[$((COLOR_IDX % ${#COLORS[@]}))]}"
    COLOR_ENTRIES="${COLOR_ENTRIES}  '${PEER_NAME}': { bg: '${BG}', text: '${TEXT}', border: '${BORDER}' },\n"
    COLOR_IDX=$((COLOR_IDX + 1))
  done

  # Read template and generate
  {
    echo "// Auto-generated by federation-setup.sh on $(date +%Y-%m-%d)"
    echo "// Source: $FEDERATION_JSON"
    echo "const TAILSCALE_DOMAIN = '${TS_DOMAIN}';"
    echo ""
    echo "const MACHINE_IPS: Record<string, string> = {"
    printf "$IP_ENTRIES"
    echo "};"
    echo ""
    echo "const MACHINE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {"
    printf "$COLOR_ENTRIES"
    echo "};"
    echo ""
    # Copy the rest of the template (functions, fallback colors, type icons)
    sed -n '/\/\*\* Fallback palette/,$p' "$MACHINES_EXAMPLE"
  } > "$MACHINES_TS"

  ok "Generated $MACHINES_TS with $PEER_COUNT peer(s)"
  [[ -n "$TS_DOMAIN" ]] && ok "Tailscale domain: $TS_DOMAIN" || warn "No Tailscale domain set -- viewer will use HTTP URLs"
fi

# ── Step 6: HTTPS setup (optional) ────────────────────────────────────────────

header "Step 6: HTTPS setup (optional)"

if confirm "Set up HTTPS via Tailscale?"; then
  # Check Tailscale
  if ! command -v tailscale &>/dev/null; then
    err "Tailscale is not installed. Install from https://tailscale.com/download"
    info "Skipping HTTPS setup."
  else
    TS_STATUS=$(tailscale status --json 2>/dev/null || echo "{}")
    TS_SELF=$(echo "$TS_STATUS" | jq -r '.Self.DNSName // empty' 2>/dev/null | sed 's/\.$//')

    if [[ -z "$TS_SELF" ]]; then
      warn "Could not determine Tailscale hostname. Is Tailscale running?"
      info "Run: tailscale status"
    else
      ok "Tailscale hostname: $TS_SELF"

      # Determine cert directory
      if [[ "$(uname)" == "Darwin" ]]; then
        CERT_DIR="$HOME/.local/share/tailscale/certs"
      else
        CERT_DIR="/var/lib/tailscale/certs"
      fi

      # Check existing certs
      CERT_FILE="$CERT_DIR/${TS_SELF}.crt"
      KEY_FILE="$CERT_DIR/${TS_SELF}.key"

      if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
        ok "Certs already exist:"
        info "  $CERT_FILE"
        info "  $KEY_FILE"
        # Check expiry
        if command -v openssl &>/dev/null; then
          EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
          [[ -n "$EXPIRY" ]] && info "  Expires: $EXPIRY"
        fi
      else
        info "Certs not found. Generating..."
        info "This requires sudo and a running Tailscale connection."
        echo ""
        if confirm "Run: sudo tailscale cert --cert-file $CERT_FILE --key-file $KEY_FILE $TS_SELF"; then
          mkdir -p "$CERT_DIR"
          if sudo tailscale cert --cert-file "$CERT_FILE" --key-file "$KEY_FILE" "$TS_SELF"; then
            ok "Certs generated successfully."
          else
            err "Cert generation failed. Check Tailscale status and try again."
          fi
        fi
      fi

      echo ""
      info "To enable HTTPS in claude-mem, set these environment variables:"
      echo ""
      echo "  export CLAUDE_MEM_HTTPS_ENABLED=true"
      echo "  export CLAUDE_MEM_HTTPS_PORT=37778"
      [[ -n "${CERT_DIR:-}" ]] && echo "  export CLAUDE_MEM_HTTPS_CERT_DIR=$CERT_DIR"
      echo ""
      info "Or add them to your LaunchAgent plist / systemd unit."
    fi
  fi
else
  info "Skipping HTTPS setup."
fi

# ── Step 7: Summary ──────────────────────────────────────────────────────────

header "Summary"

echo "  Configuration:"
[[ -f "$FEDERATION_JSON" ]] \
  && ok "federation.json: $FEDERATION_JSON ($(jq '.peers | length' "$FEDERATION_JSON") peers)" \
  || warn "federation.json: not created"

CRON_INSTALLED=$(crontab -l 2>/dev/null | grep -c "federation-sync" || true)
[[ "$CRON_INSTALLED" -gt 0 ]] \
  && ok "Cron job: installed (every 5 minutes)" \
  || warn "Cron job: not installed"

[[ -f "$MACHINES_TS" ]] \
  && ok "machines.ts: generated" \
  || info "machines.ts: not generated (optional)"

echo ""
echo "  Next steps:"
info "1. Ensure the worker is running on all machines"
info "2. Verify federation sync: $SYNC_SCRIPT --verbose"
info "3. Check sync logs: tail -f /tmp/claude-mem-sync.log"
info "4. View federation status in the web UI: http://localhost:37777"
echo ""
ok "Federation setup complete."
