/**
 * Tailscale utilities shared across hooks and services.
 */

import { hostname } from 'os';
import { execSync } from 'child_process';

/**
 * Get MagicDNS hostname from Tailscale, falling back to os.hostname()
 */
export function getMagicDNSHostname(): string {
  try {
    // Linux: tailscale is in PATH; macOS: app bundle path
    const cmds = ['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'];
    for (const cmd of cmds) {
      try {
        const json = execSync(`${cmd} status --self --json 2>/dev/null`, { timeout: 3000 }).toString();
        const dnsName = JSON.parse(json)?.Self?.DNSName;
        if (dnsName) return dnsName.replace(/\.$/, ''); // strip trailing dot
      } catch { continue; }
    }
  } catch { /* fall through */ }
  return hostname();
}
