// Machine config for federation setups.
// Populated with tailnet domain and machine metadata for link generation.
const TAILSCALE_DOMAIN = 'chihuahua-aeolian.ts.net';

const MACHINE_IPS: Record<string, string> = {
  'mepstudio': '192.168.1.217',
  'spark-1': '192.168.1.76',
  'spark-2': '192.168.1.63',
  'mepmbp2022': '192.168.1.13',
  'mepmbp2020': '192.168.1.205',
  'mepmbp2019': '192.168.1.145',
};

const MACHINE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'mepstudio':  { bg: 'rgba(96, 165, 250, 0.15)',  text: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)' },   // blue
  'spark-1':    { bg: 'rgba(251, 146, 60, 0.15)',   text: '#fb923c', border: 'rgba(251, 146, 60, 0.3)' },   // orange
  'spark-2':    { bg: 'rgba(74, 222, 128, 0.15)',    text: '#4ade80', border: 'rgba(74, 222, 128, 0.3)' },   // green
  'mepmbp2022': { bg: 'rgba(192, 132, 252, 0.15)',  text: '#c084fc', border: 'rgba(192, 132, 252, 0.3)' },  // purple
  'mepmbp2020': { bg: 'rgba(251, 191, 36, 0.15)',   text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },   // amber
  'mepmbp2019': { bg: 'rgba(248, 113, 113, 0.15)',  text: '#f87171', border: 'rgba(248, 113, 113, 0.3)' },  // red
};

/** Fallback palette for unknown machines */
const FALLBACK_COLORS = [
  { bg: 'rgba(219, 171, 255, 0.15)', text: '#d2a8ff', border: 'rgba(219, 171, 255, 0.3)' },  // lavender
  { bg: 'rgba(255, 123, 114, 0.15)', text: '#ff7b72', border: 'rgba(255, 123, 114, 0.3)' },   // coral
  { bg: 'rgba(126, 231, 135, 0.15)', text: '#7ee687', border: 'rgba(126, 231, 135, 0.3)' },   // mint
  { bg: 'rgba(255, 215, 0, 0.15)', text: '#ffd700', border: 'rgba(255, 215, 0, 0.3)' },       // gold
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getMachineColor(machine: string) {
  const key = machine.replace(/\.local$/, '');
  return MACHINE_COLOR_MAP[machine] || MACHINE_COLOR_MAP[key] || FALLBACK_COLORS[hashString(machine) % FALLBACK_COLORS.length];
}

/** HTTP URL (always works) */
export function getMachineHttpUrl(machine: string): string {
  const hostname = machine.replace(/\.local$/, '');
  const ip = MACHINE_IPS[hostname];
  if (ip) return `http://${ip}:37777`;
  return `http://${hostname}:37777`;
}

/** HTTPS URL via MagicDNS (requires Tailscale cert) */
export function getMachineHttpsUrl(machine: string): string {
  const hostname = machine.replace(/\.local$/, '');
  return `https://${hostname}.${TAILSCALE_DOMAIN}:37778`;
}

/** Default URL for links -- uses HTTP via LAN IP */
export function getMagicDnsUrl(machine: string): string {
  return getMachineHttpUrl(machine);
}

export function getMagicDnsHostname(machine: string): string {
  const hostname = machine.replace(/\.local$/, '');
  if (TAILSCALE_DOMAIN) {
    return `${hostname}.${TAILSCALE_DOMAIN}`;
  }
  return hostname;
}

export function getMachineIp(machine: string): string | undefined {
  return MACHINE_IPS[machine] || MACHINE_IPS[machine.replace(/\.local$/, '')];
}

/**
 * Probe a machine's HTTPS health endpoint.
 * Returns the HTTPS URL if reachable, null otherwise.
 */
export async function probeHttps(machine: string): Promise<string | null> {
  const url = getMachineHttpsUrl(machine);
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) return url;
  } catch {
    // HTTPS not available
  }
  return null;
}

/** FA icon and color for each observation type */
export const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  bugfix:    { icon: 'fas fa-bug', color: '#f85149' },
  feature:   { icon: 'fas fa-star', color: '#3fb950' },
  change:    { icon: 'fas fa-code-branch', color: '#58a6ff' },
  discovery: { icon: 'fas fa-search', color: '#58a6ff' },
  refactor:  { icon: 'fas fa-recycle', color: '#d2a8ff' },
  decision:  { icon: 'fas fa-balance-scale', color: '#d29922' },
};
