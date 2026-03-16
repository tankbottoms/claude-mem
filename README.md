<h1 align="center">
  <br>
  <a href="https://github.com/tankbottoms/claude-mem">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/tankbottoms/claude-mem/main/docs/public/claude-mem-logo-for-dark-mode.webp">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/tankbottoms/claude-mem/main/docs/public/claude-mem-logo-for-light-mode.webp">
      <img src="https://raw.githubusercontent.com/tankbottoms/claude-mem/main/docs/public/claude-mem-logo-for-light-mode.webp" alt="Claude-Mem" width="400">
    </picture>
  </a>
  <br>
</h1>

<p align="center">
  <a href="docs/i18n/README.zh.md">🇨🇳 中文</a> •
  <a href="docs/i18n/README.zh-tw.md">🇹🇼 繁體中文</a> •
  <a href="docs/i18n/README.ja.md">🇯🇵 日本語</a> •
  <a href="docs/i18n/README.pt.md">🇵🇹 Português</a> •
  <a href="docs/i18n/README.pt-br.md">🇧🇷 Português</a> •
  <a href="docs/i18n/README.ko.md">🇰🇷 한국어</a> •
  <a href="docs/i18n/README.es.md">🇪🇸 Español</a> •
  <a href="docs/i18n/README.de.md">🇩🇪 Deutsch</a> •
  <a href="docs/i18n/README.fr.md">🇫🇷 Français</a> •
  <a href="docs/i18n/README.he.md">🇮🇱 עברית</a> •
  <a href="docs/i18n/README.ar.md">🇸🇦 العربية</a> •
  <a href="docs/i18n/README.ru.md">🇷🇺 Русский</a> •
  <a href="docs/i18n/README.pl.md">🇵🇱 Polski</a> •
  <a href="docs/i18n/README.cs.md">🇨🇿 Čeština</a> •
  <a href="docs/i18n/README.nl.md">🇳🇱 Nederlands</a> •
  <a href="docs/i18n/README.tr.md">🇹🇷 Türkçe</a> •
  <a href="docs/i18n/README.uk.md">🇺🇦 Українська</a> •
  <a href="docs/i18n/README.vi.md">🇻🇳 Tiếng Việt</a> •
  <a href="docs/i18n/README.tl.md">🇵🇭 Tagalog</a> •
  <a href="docs/i18n/README.id.md">🇮🇩 Indonesia</a> •
  <a href="docs/i18n/README.th.md">🇹🇭 ไทย</a> •
  <a href="docs/i18n/README.hi.md">🇮🇳 हिन्दी</a> •
  <a href="docs/i18n/README.bn.md">🇧🇩 বাংলা</a> •
  <a href="docs/i18n/README.ur.md">🇵🇰 اردو</a> •
  <a href="docs/i18n/README.ro.md">🇷🇴 Română</a> •
  <a href="docs/i18n/README.sv.md">🇸🇪 Svenska</a> •
  <a href="docs/i18n/README.it.md">🇮🇹 Italiano</a> •
  <a href="docs/i18n/README.el.md">🇬🇷 Ελληνικά</a> •
  <a href="docs/i18n/README.hu.md">🇭🇺 Magyar</a> •
  <a href="docs/i18n/README.fi.md">🇫🇮 Suomi</a> •
  <a href="docs/i18n/README.da.md">🇩🇰 Dansk</a> •
  <a href="docs/i18n/README.no.md">🇳🇴 Norsk</a>
</p>

<h4 align="center">Persistent memory compression system built for <a href="https://claude.com/claude-code" target="_blank">Claude Code</a>.</h4>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL%203.0-blue.svg" alt="License">
  </a>
  <a href="package.json">
    <img src="https://img.shields.io/badge/version-10.5.6-green.svg" alt="Version">
  </a>
  <a href="package.json">
    <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg" alt="Node">
  </a>
  <a href="https://github.com/thedotmack/awesome-claude-code">
    <img src="https://awesome.re/mentioned-badge.svg" alt="Mentioned in Awesome Claude Code">
  </a>
</p>

---

> **Fork notice** -- This is an enhanced fork of [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) with HTTPS/TLS, ChromaDB vector search, multi-provider AI, machine federation, and multi-machine deployment support. Upstream compatibility is maintained; all original features work as documented.

---

## Fork vs Upstream

| Feature | Upstream | This Fork |
|---------|----------|-----------|
| Core memory system | ✓ | ✓ |
| SQLite + FTS5 search | ✓ | ✓ |
| MCP search tools | ✓ | ✓ |
| Web viewer UI | ✓ | ✓ |
| HTTPS/TLS (Tailscale certs) | -- | ✓ |
| ChromaDB vector search | -- | ✓ |
| Multi-provider AI (Claude/Gemini/OpenRouter) | -- | ✓ |
| Machine federation & sync | -- | ✓ |
| LaunchAgent management (macOS) | -- | ✓ |
| Multi-machine deployment | -- | ✓ |
| SettingsDefaultsManager (42 config vars) | -- | ✓ |

## Screenshots

![Federation Dashboard](docs/screenshots/federation-screenshot.png)

![Claude-Mem Dashboard](docs/screenshots/claude-mem-dashboard-screenshot.png)

## Quick Start

```bash
# Install from this fork
claude plugin add tankbottoms/claude-mem
```

Or install from source:

```bash
git clone https://github.com/tankbottoms/claude-mem.git
cd claude-mem
bun install
bun run build
```

After installation, Claude Code automatically loads the plugin via lifecycle hooks. No additional configuration is required for basic usage -- the worker service starts on `http://127.0.0.1:37777` and the SQLite database is created at `~/.claude-mem/claude-mem.db`.

## Architecture

### Lifecycle Hooks

Claude-Mem integrates with Claude Code through 5 lifecycle hooks plus a setup phase:

| Hook | Trigger | Purpose |
|------|---------|---------|
| **Setup** | Plugin load | Run `setup.sh` for initial configuration |
| **SessionStart** | `startup\|clear\|compact` | Smart install, start worker service, inject session context |
| **UserPromptSubmit** | Every user prompt | Initialize session tracking |
| **PostToolUse** | Every tool call | Record observations (code reads, edits, searches, decisions) |
| **Stop** | Response complete | Generate session summary with AI |
| **SessionEnd** | Session close | Finalize session, cleanup |

### Core Components

1. **Worker Service** -- Express HTTP API on port 37777 (HTTP) / 37778 (HTTPS), managed by Bun
2. **SQLite Database** -- Stores sessions, observations, summaries with FTS5 full-text search
3. **ChromaDB** -- Vector embeddings for hybrid semantic + keyword search
4. **mem-search Skill** -- Natural language queries with progressive disclosure (3-layer workflow)
5. **Web Viewer UI** -- React dashboard at `http://localhost:37777`

### Data Flow

```
Claude Code  -->  Lifecycle Hooks  -->  Worker Service (:37777)
                                            |
                                     +------+------+
                                     |             |
                                  SQLite        ChromaDB
                                  (FTS5)       (vectors)
                                     |             |
                                     +------+------+
                                            |
                                     Federation Sync
                                      (peer-to-peer)
```

## HTTPS/TLS with Tailscale

The fork adds native HTTPS support using Tailscale-issued TLS certificates. This enables secure inter-machine communication across the tailnet.

### How It Works

1. **`getMagicDNSHostname()`** (`src/shared/tailscale-utils.ts`) detects the machine's Tailscale MagicDNS name by running `tailscale status --self --json` and extracting `Self.DNSName`
2. **`TlsCertResolver`** (`src/services/server/TlsCertResolver.ts`) searches for certificate files matching `<hostname>.crt` and `<hostname>.key` in this order:
   - `CLAUDE_MEM_HTTPS_CERT_DIR` (explicit override)
   - `~/.local/share/tailscale/certs/` (macOS default)
   - `/var/lib/tailscale/certs/` (Linux default)
3. The `Server` class creates an HTTPS listener on a separate port sharing the same Express app

### Enable HTTPS

Set via environment variable or launchd plist:

```bash
export CLAUDE_MEM_HTTPS_ENABLED=true
export CLAUDE_MEM_HTTPS_PORT=37778  # default
```

Generate certificates with Tailscale:

```bash
sudo tailscale cert <your-machine>.your-tailnet.ts.net
# Copies .crt and .key to the appropriate cert directory
```

## ChromaDB Vector Search

The fork integrates ChromaDB for hybrid semantic + keyword search, providing significantly better recall than FTS5 alone.

### How It Works

- **ChromaSync** (`src/services/sync/ChromaSync.ts`) automatically syncs observations and session summaries from SQLite into ChromaDB collections
- **ChromaSearchStrategy** queries Chroma for semantically similar documents, filters by recency (90-day window), and hydrates results from SQLite
- Communication with ChromaDB happens via MCP protocol through `ChromaMcpManager`

### Configuration

```bash
CLAUDE_MEM_CHROMA_ENABLED=true       # Enable ChromaDB (default: true)
CLAUDE_MEM_CHROMA_MODE=local         # 'local' or 'remote'
CLAUDE_MEM_CHROMA_HOST=127.0.0.1     # ChromaDB host
CLAUDE_MEM_CHROMA_PORT=8000          # ChromaDB port (default: 8000)
CLAUDE_MEM_CHROMA_SSL=false          # Use SSL for Chroma connection
CLAUDE_MEM_CHROMA_API_KEY=           # API key (if using authenticated Chroma)
CLAUDE_MEM_CHROMA_TENANT=default_tenant
CLAUDE_MEM_CHROMA_DATABASE=default_database
```

## Multi-Provider AI

The fork supports three AI providers for observation summarization and context generation:

| Provider | Setting | Default Model | Auth |
|----------|---------|---------------|------|
| **Claude** | `CLAUDE_MEM_PROVIDER=claude` | `claude-sonnet-4-5` | CLI subscription (`cli`) or API key (`api`) |
| **Gemini** | `CLAUDE_MEM_PROVIDER=gemini` | `gemini-2.5-flash-lite` | `CLAUDE_MEM_GEMINI_API_KEY` |
| **OpenRouter** | `CLAUDE_MEM_PROVIDER=openrouter` | `xiaomi/mimo-v2-flash:free` | `CLAUDE_MEM_OPENROUTER_API_KEY` |

OpenRouter supports LiteLLM proxy via `CLAUDE_MEM_OPENROUTER_API_BASE` for self-hosted model routing.

## Machine Federation

Federation enables peer-to-peer observation sync across machines. Each machine's worker service exposes a `/api/federation/pull` endpoint that peers can query.

### federation.json

The federation config lives at `~/.claude-mem/federation.json`:

```json
{
  "peers": [
    {
      "name": "spark-1",
      "urls": ["http://192.168.1.76:37777"],
      "enabled": true
    },
    {
      "name": "studio",
      "urls": [
        "http://192.168.1.217:37777",
        "https://studio.example-tailnet.ts.net:37778"
      ],
      "enabled": true
    }
  ]
}
```

The `urls` array supports fallback -- if the first URL fails, the sync script tries the next.

### federation-sync.sh

The sync script (`scripts/federation-sync.sh`) runs via cron every 5 minutes:

```bash
# Add to crontab
*/5 * * * * /path/to/federation-sync.sh >> /tmp/claude-mem-sync.log 2>&1
```

- Batch size: 500 observations per round
- Safety cap: 50 rounds (25,000 observations max per peer per run)
- Reads config from `~/.claude-mem/federation.json`

## Machine Deployment

| Machine | Role | LAN IP | HTTP | HTTPS | Chroma |
|---------|------|--------|------|-------|--------|
| studio | Dev, source of truth | 192.168.1.217 | :37777 | :37778 | :8000 |
| spark-1 | Production (GPU) | 192.168.1.76 | :37777 | -- | :8100 |
| spark-2 | Production (GPU) | 192.168.1.63 | :37777 | -- | :8000 |
| mbp2022 | Laptop | 192.168.1.13 | :37777 | -- | :8000 |
| mbp2020 | Laptop | 192.168.1.205 | :37777 | -- | :8000 |
| mbp2019 | Laptop | 192.168.1.145 | :37777 | -- | :8000 |

All machines run version 10.5.6. studio is the only machine that pushes to git; all others pull from `origin main`.

## LaunchAgent Management (macOS)

Three LaunchAgent plists manage the worker lifecycle:

| Plist | Label | Purpose | Interval |
|-------|-------|---------|----------|
| `com.claude-mem.worker.plist` | Worker | Runs `worker-service.cjs` via Bun, `KeepAlive: true` | Always |
| `com.claude-mem.cleanup.plist` | Cleanup | Runs `claude-mem-cleanup.sh` | 120s |
| `com.claude-mem.network-watchdog.plist` | Watchdog | Runs `network-watchdog.sh` | 300s |

The worker plist sets HTTPS env vars via `EnvironmentVariables` dict:

```xml
<key>EnvironmentVariables</key>
<dict>
    <key>CLAUDE_MEM_HTTPS_ENABLED</key>
    <string>true</string>
    <key>CLAUDE_MEM_HTTPS_PORT</key>
    <string>37778</string>
</dict>
```

### Worker Restart Procedure

```bash
# Unload watchdog first (prevents auto-restart during maintenance)
launchctl unload ~/Library/LaunchAgents/com.claude-mem.network-watchdog.plist

# Unload worker
launchctl unload ~/Library/LaunchAgents/com.claude-mem.worker.plist

# Reload worker
launchctl load ~/Library/LaunchAgents/com.claude-mem.worker.plist

# Reload watchdog
launchctl load ~/Library/LaunchAgents/com.claude-mem.network-watchdog.plist
```

## Configuration Reference

All settings are managed through `SettingsDefaultsManager` (`src/shared/SettingsDefaultsManager.ts`). Settings can be configured via environment variables, the `~/.claude-mem/settings.json` file, or launchd `EnvironmentVariables`.

> **Known issue:** `SettingsDefaultsManager.get()` reads `process.env > hardcoded defaults` only, skipping file-loaded settings. The full priority chain (`process.env > settings file > defaults`) is only available via `loadFromFile()`. For reliable overrides, use environment variables or launchd `EnvironmentVariables` dict.

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MEM_MODEL` | `claude-sonnet-4-5` | AI model for summarization |
| `CLAUDE_MEM_CONTEXT_OBSERVATIONS` | `50` | Number of observations in context window |
| `CLAUDE_MEM_WORKER_PORT` | `37777` | HTTP listen port |
| `CLAUDE_MEM_WORKER_HOST` | `127.0.0.1` | HTTP listen host |
| `CLAUDE_MEM_SKIP_TOOLS` | `ListMcpResourcesTool,...` | Tool names to skip observing |
| `CLAUDE_MEM_DATA_DIR` | `~/.claude-mem` | Data directory |
| `CLAUDE_MEM_LOG_LEVEL` | *(default)* | Log verbosity |
| `CLAUDE_MEM_MODE` | *(default)* | Operating mode |

### AI Provider Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MEM_PROVIDER` | `claude` | AI provider: `claude`, `gemini`, or `openrouter` |
| `CLAUDE_MEM_CLAUDE_AUTH_METHOD` | `cli` | Claude auth: `cli` (subscription) or `api` (key) |
| `CLAUDE_MEM_GEMINI_API_KEY` | *(empty)* | Gemini API key |
| `CLAUDE_MEM_GEMINI_MODEL` | `gemini-2.5-flash-lite` | Gemini model |
| `CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED` | `true` | Rate limiting for free tier |
| `CLAUDE_MEM_OPENROUTER_API_KEY` | *(empty)* | OpenRouter API key |
| `CLAUDE_MEM_OPENROUTER_API_BASE` | *(empty)* | Custom API base (for LiteLLM proxy) |
| `CLAUDE_MEM_OPENROUTER_MODEL` | `xiaomi/mimo-v2-flash:free` | OpenRouter model |
| `CLAUDE_MEM_OPENROUTER_MAX_CONTEXT_MESSAGES` | `20` | Max context messages |
| `CLAUDE_MEM_OPENROUTER_MAX_TOKENS` | *(default)* | Max output tokens |

### Display & Context Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS` | *(default)* | Show read token counts |
| `CLAUDE_MEM_CONTEXT_SHOW_WORK_TOKENS` | *(default)* | Show work token counts |
| `CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_AMOUNT` | *(default)* | Show savings amount |
| `CLAUDE_MEM_CONTEXT_SHOW_SAVINGS_PERCENT` | *(default)* | Show savings percentage |
| `CLAUDE_MEM_CONTEXT_FULL_COUNT` | *(default)* | Full context observation count |
| `CLAUDE_MEM_CONTEXT_FULL_FIELD` | *(default)* | Full context field |
| `CLAUDE_MEM_CONTEXT_SESSION_COUNT` | `10` | Session context count |
| `CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY` | `true` | Show last session summary |
| `CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE` | `false` | Show last user message |
| `CLAUDE_MEM_CONTEXT_SHOW_TERMINAL_OUTPUT` | `true` | Show terminal output |

### HTTPS/TLS Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MEM_HTTPS_ENABLED` | `false` | Enable HTTPS listener |
| `CLAUDE_MEM_HTTPS_PORT` | `37778` | HTTPS listen port |
| `CLAUDE_MEM_HTTPS_CERT_DIR` | *(empty)* | Cert directory (empty = auto-detect from Tailscale) |

### ChromaDB Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MEM_CHROMA_ENABLED` | `true` | Enable ChromaDB integration |
| `CLAUDE_MEM_CHROMA_MODE` | `local` | `local` or `remote` |
| `CLAUDE_MEM_CHROMA_HOST` | `127.0.0.1` | ChromaDB host |
| `CLAUDE_MEM_CHROMA_PORT` | `8000` | ChromaDB port |
| `CLAUDE_MEM_CHROMA_SSL` | `false` | Use SSL for Chroma |
| `CLAUDE_MEM_CHROMA_API_KEY` | *(empty)* | Chroma API key |
| `CLAUDE_MEM_CHROMA_TENANT` | `default_tenant` | Chroma tenant |
| `CLAUDE_MEM_CHROMA_DATABASE` | `default_database` | Chroma database |

### Process & Feature Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_MEM_MAX_CONCURRENT_AGENTS` | `2` | Max concurrent Claude SDK agent subprocesses |
| `CLAUDE_MEM_EXCLUDED_PROJECTS` | *(empty)* | Comma-separated glob patterns for excluded projects |
| `CLAUDE_MEM_FOLDER_MD_EXCLUDE` | `[]` | JSON array of folder paths to exclude from CLAUDE.md generation |
| `CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED` | `false` | Enable per-folder CLAUDE.md generation |

## MCP Search Tools

The worker exposes search via MCP protocol with a 3-layer progressive disclosure workflow:

1. **`search(query)`** -- Returns an index with observation IDs (~50-100 tokens per result)
2. **`timeline(anchor=ID)`** -- Returns context around interesting results
3. **`get_observations([IDs])`** -- Fetches full details only for filtered IDs

Additional tools: `smart_search` (tree-sitter AST), `smart_unfold` (expand symbols), `smart_outline` (file structure).

## System Requirements

- **Node.js** >= 18.0.0
- **Bun** (recommended for worker service)
- **Claude Code** CLI
- **Tailscale** (optional, for HTTPS/TLS and MagicDNS)
- **ChromaDB** (optional, for vector search -- install via `pip install chromadb` or run as Docker container)

## Development

```bash
bun install
bun run build        # Build all components
bun run build:watch  # Watch mode
bun run test         # Run tests
```

## Troubleshooting

- **Worker not starting**: Check `~/.claude-mem/logs/` and `/tmp/claude-mem-worker.log`
- **HTTPS not working**: Verify Tailscale certs exist at the expected path with `ls ~/.local/share/tailscale/certs/`
- **ChromaDB connection failed**: Ensure ChromaDB is running on the configured host:port
- **Federation sync failing**: Check `~/.claude-mem/federation.json` peer URLs and verify worker is running on remote machines

## Bug Reports

If you encounter issues, please file a report at [github.com/tankbottoms/claude-mem/issues](https://github.com/tankbottoms/claude-mem/issues).

## Contributing

Contributions welcome. Please review the existing code style and architecture before submitting PRs.

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the [AGPL-3.0 License](LICENSE).

---

**Built with Claude Agent SDK** | **Powered by Claude Code** | **Made with TypeScript**
