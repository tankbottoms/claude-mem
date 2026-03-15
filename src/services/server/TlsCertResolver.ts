/**
 * TlsCertResolver - Discovers and loads TLS certificates for HTTPS.
 *
 * Supports Tailscale-issued certs (via `tailscale cert`) and custom cert directories.
 * Cert files are expected as <hostname>.crt and <hostname>.key.
 */

import https from 'https';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getMagicDNSHostname } from '../../shared/tailscale-utils.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { logger } from '../../utils/logger.js';

export interface CertPaths {
  cert: string;
  key: string;
  hostname: string;
}

/**
 * Resolve TLS certificate and key file paths.
 *
 * Search order:
 *   1. CLAUDE_MEM_HTTPS_CERT_DIR setting (explicit)
 *   2. ~/.local/share/tailscale/certs/ (macOS default)
 *   3. /var/lib/tailscale/certs/ (Linux default)
 *
 * Returns null if no valid cert/key pair is found.
 */
export function resolveCertPaths(): CertPaths | null {
  const host = getMagicDNSHostname();

  const certDir = SettingsDefaultsManager.get('CLAUDE_MEM_HTTPS_CERT_DIR');
  const searchDirs: string[] = [];

  if (certDir) {
    searchDirs.push(certDir);
  } else {
    // Tailscale default cert locations
    searchDirs.push(
      join(homedir(), '.local', 'share', 'tailscale', 'certs'),
      '/var/lib/tailscale/certs'
    );
  }

  for (const dir of searchDirs) {
    const certFile = join(dir, `${host}.crt`);
    const keyFile = join(dir, `${host}.key`);

    if (existsSync(certFile) && existsSync(keyFile)) {
      logger.info('SYSTEM', 'Found certificates', { dir, hostname: host });
      return { cert: certFile, key: keyFile, hostname: host };
    }
  }

  logger.warn('SYSTEM', 'No certificates found', {
    hostname: host,
    searchedDirs: searchDirs
  });
  return null;
}

/**
 * Load TLS options suitable for https.createServer().
 * Returns null if certs cannot be found or read.
 */
export function loadTlsOptions(): https.ServerOptions | null {
  const paths = resolveCertPaths();
  if (!paths) return null;

  try {
    return {
      cert: readFileSync(paths.cert),
      key: readFileSync(paths.key),
    };
  } catch (error) {
    logger.error('SYSTEM', 'Failed to read certificate files', {
      cert: paths.cert,
      key: paths.key,
    }, error as Error);
    return null;
  }
}
