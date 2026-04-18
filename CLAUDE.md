# Claude-Mem: AI Development Instructions

Claude-mem is a Claude Code plugin providing persistent memory across sessions. It captures tool usage, compresses observations using the Claude Agent SDK, and injects relevant context into future sessions.

## Architecture

**5 Lifecycle Hooks**: SessionStart → UserPromptSubmit → PostToolUse → Summary → SessionEnd

**Hooks** (`src/hooks/*.ts`) - TypeScript → ESM, built to `plugin/scripts/*-hook.js`

**Worker Service** (`src/services/worker-service.ts`) - Express API on port 37777, Bun-managed, handles AI processing asynchronously

**Database** (`src/services/sqlite/`) - SQLite3 at `~/.claude-mem/claude-mem.db`

**Search Skill** (`plugin/skills/mem-search/SKILL.md`) - HTTP API for searching past work, auto-invoked when users ask about history

**Planning Skill** (`plugin/skills/make-plan/SKILL.md`) - Orchestrator instructions for creating phased implementation plans with documentation discovery

**Execution Skill** (`plugin/skills/do/SKILL.md`) - Orchestrator instructions for executing phased plans using subagents

**Chroma** (`src/services/sync/ChromaSync.ts`) - Vector embeddings for semantic search

**Viewer UI** (`src/ui/viewer/`) - React interface at http://localhost:37777, built to `plugin/ui/viewer.html`

## Privacy Tags
- `<private>content</private>` - User-level privacy control (manual, prevents storage)

**Implementation**: Tag stripping happens at hook layer (edge processing) before data reaches worker/database. See `src/utils/tag-stripping.ts` for shared utilities.

## Build Commands

```bash
npm run build-and-sync        # Build, sync to marketplace, restart worker
```

## Configuration

Settings are managed in `~/.claude-mem/settings.json`. The file is auto-created with defaults on first run.

## File Locations

- **Source**: `<project-root>/src/`
- **Built Plugin**: `<project-root>/plugin/`
- **Installed Plugin**: `~/.claude/plugins/marketplaces/thedotmack/`
- **Database**: `~/.claude-mem/claude-mem.db`
- **Chroma**: `~/.claude-mem/chroma/`

## Exit Code Strategy

Claude-mem hooks use specific exit codes per Claude Code's hook contract:

- **Exit 0**: Success or graceful shutdown (Windows Terminal closes tabs)
- **Exit 1**: Non-blocking error (stderr shown to user, continues)
- **Exit 2**: Blocking error (stderr fed to Claude for processing)

**Philosophy**: Worker/hook errors exit with code 0 to prevent Windows Terminal tab accumulation. The wrapper/plugin layer handles restart logic. ERROR-level logging is maintained for diagnostics.

See `private/context/claude-code/exit-codes.md` for full hook behavior matrix.

## Requirements

- **Bun** (all platforms - auto-installed if missing)
- **uv** (all platforms - auto-installed if missing, provides Python for Chroma)
- Node.js

## Documentation

**Public Docs**: https://docs.claude-mem.ai (Mintlify)
**Source**: `docs/public/` - MDX files, edit `docs.json` for navigation
**Deploy**: Auto-deploys from GitHub on push to main

## Pro Features Architecture

Claude-mem is designed with a clean separation between open-source core functionality and optional Pro features.

**Open-Source Core** (this repository):

- All worker API endpoints on localhost:37777 remain fully open and accessible
- Pro features are headless - no proprietary UI elements in this codebase
- Pro integration points are minimal: settings for license keys, tunnel provisioning logic
- The architecture ensures Pro features extend rather than replace core functionality

**Pro Features** (coming soon, external):

- Enhanced UI (Memory Stream) connects to the same localhost:37777 endpoints as the open viewer
- Additional features like advanced filtering, timeline scrubbing, and search tools
- Access gated by license validation, not by modifying core endpoints
- Users without Pro licenses continue using the full open-source viewer UI without limitation

This architecture preserves the open-source nature of the project while enabling sustainable development through optional paid features.

## Terminal Display Format (DO NOT MODIFY WITHOUT EXPLICIT APPROVAL)

The session-start observation display uses a specific compact format with Font Awesome / Nerd Font icons. This format is intentional and must not be changed during upstream rebases, refactors, or "improvements."

**Protected files:**
- `plugin/modes/code.json` -- observation type icons (Font Awesome glyphs, NOT standard emojis)
- `src/services/context/formatters/ColorFormatter.ts` -- compact terminal layout: `#ID [glyph type] title file (time)`, Nerd Font summary glyphs with word-wrap
- `src/services/context/formatters/MarkdownFormatter.ts` -- table format with Nerd Font summary glyphs
- `src/services/context/sections/TimelineRenderer.ts` -- compact color timeline with inline date markers (`formatCompactDate`, `formatTime24`)
- `src/shared/timeline-formatting.ts` -- `formatCompactDate()` and `formatTime24()` helper functions

**Rules:**
- Never replace Font Awesome/Nerd Font icons with standard emojis
- Never remove the compact `glyph + type` layout from ColorFormatter
- Never remove Nerd Font summary field glyphs (Investigated/Learned/Completed/Next Steps)
- Never remove `formatCompactDate` or `formatTime24` from timeline-formatting.ts
- When rebasing onto upstream, always restore these files from our fork

## Federation Web-UI Endpoint Contract (DO NOT BREAK)

Every claude-mem node in the federation MUST expose the viewer/API on **two ports**:

| Scheme | Port | Required |
|--------|:----:|:--------:|
| HTTP   | 37777 | yes |
| HTTPS  | 37778 | yes |

This pairing is load-bearing: peer-to-peer federation discovery, the cross-machine viewer links, and external HTTPS access from off-network clients all assume `http://<host>:37777` and `https://<host>:37778` resolve to the same worker on every node.

**How the worker decides:**
- HTTP bind: `CLAUDE_MEM_WORKER_PORT` (default `37777`), `CLAUDE_MEM_WORKER_HOST` (default `0.0.0.0`).
- HTTPS bind: only enabled when `CLAUDE_MEM_HTTPS_ENABLED=true`. Listens on `CLAUDE_MEM_HTTPS_PORT` (default `37778`).
- Cert lookup order in `~/.claude-mem/certs/`: (1) `server.crt` + `server.key`, then (2) `<tailscale-hostname>.crt` + `<tailscale-hostname>.key`. If neither exists, the worker auto-runs `tailscale cert` to provision them. If that auto-provision fails, HTTPS is silently skipped — symlink `server.crt`/`server.key` at the provisioned cert files as a fallback.

**Settings every node must have:**
```json
"CLAUDE_MEM_WORKER_HOST": "0.0.0.0",
"CLAUDE_MEM_WORKER_PORT": "37777",
"CLAUDE_MEM_HTTPS_ENABLED": "true",
"CLAUDE_MEM_HTTPS_PORT": "37778"
```

**Things that break the contract — NEVER do these:**
- Do **not** add a `tailscale serve --https=37777` mapping (it hijacks plain HTTP on :37777 by forcing TLS).
- Do **not** bind the worker to `127.0.0.1` only — peers on the tailnet/LAN cannot reach it.
- Do **not** disable HTTPS on a node "because Tailscale already terminates TLS." Federation peers and the viewer expect the worker itself to serve :37778.

**Verifying after any install/upgrade/restart:**
```bash
curl -s  http://127.0.0.1:37777/api/version    # must return {"version":"..."}
curl -sk https://127.0.0.1:37778/api/version   # must return {"version":"..."}
```

If `:37778` is missing, check the worker log for `HTTPS cert/key not found, skipping HTTPS` — that means cert auto-provision failed; create `server.crt`/`server.key` symlinks in `~/.claude-mem/certs/` pointing at the provisioned cert files and restart.

## Federation Upgrade Workflow

Source of truth is the **mepstudio fork** at `~/Developer/claude-mem` (branch `main`, repo `tankbottoms/claude-mem`). All other federation nodes pull from there. Only mepstudio pushes upstream-merged code.

**Standard upgrade sequence:**

1. **Merge upstream on mepstudio.** From `~/Developer/claude-mem`:
   ```bash
   git fetch upstream
   git log --oneline HEAD..upstream/main      # review what's new
   git merge upstream/main                    # resolve conflicts, preserving fork customizations (formatters, FA icons, listenHttps, federation routes, machines.example.ts)
   ```

2. **Bump version + build + sync local marketplace.** Update version in `package.json`, `plugin/package.json`, `.claude-plugin/plugin.json` (suffix `-federation`), then:
   ```bash
   npm run build-and-sync
   ```

3. **Verify mepstudio dual-endpoint** (see contract above).

4. **Push to fork.**
   ```bash
   git push origin main
   git tag -a vX.Y.Z-federation -m "vX.Y.Z-federation: <summary>"
   git push origin vX.Y.Z-federation
   ```

5. **Pull + rebuild on each remote node** (mepmbp2022, spark-1, spark-2, …). On each: `cd ~/Developer/<fork-clone> && git pull --ff-only && npm run build-and-sync`. After sync, verify the systemd unit (Linux) or LaunchAgent plist (macOS) points at the new cache version path; update if pinned.

6. **Restart and verify each node's dual endpoint.** A node is not considered upgraded until both `:37777` HTTP and `:37778` HTTPS return the new version.

7. **Roll back if any node fails to expose both endpoints** — do not leave the fleet in a half-upgraded state.

## Important

No need to edit the changelog ever, it's generated automatically.
