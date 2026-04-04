/**
 * Environment Sanitizer
 *
 * Strips CLAUDECODE_* and CLAUDE_CODE_* env vars from subprocess environments
 * to prevent nested Claude Code sessions. Preserves OAuth tokens and Git Bash paths.
 *
 * From Glucksberg/claude-mem PR #1370
 */

/** Env var prefixes that indicate a Claude Code parent session */
const CLAUDE_ENV_PREFIXES = ['CLAUDECODE_', 'CLAUDE_CODE_'];

/** Specific keys to preserve even if they match a prefix */
const PRESERVE_KEYS = new Set([
  'CLAUDE_CODE_OAUTH_TOKEN',     // Needed for API auth
  'CLAUDE_CODE_GIT_BASH_PATH',   // Needed for Windows git operations
]);

/**
 * Create a sanitized copy of environment variables, stripping Claude Code
 * session vars that would cause nested session issues (#1352).
 *
 * @param env - Source environment (defaults to process.env)
 * @returns New object with Claude Code session vars removed
 */
export function sanitizeEnv(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;

    // Check if this key matches any Claude Code prefix
    const isClaudeVar = CLAUDE_ENV_PREFIXES.some(prefix => key.startsWith(prefix));

    if (isClaudeVar && !PRESERVE_KEYS.has(key)) {
      continue; // Strip it
    }

    result[key] = value;
  }

  return result;
}
