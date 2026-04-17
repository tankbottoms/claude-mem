// Machine config for federation setups.
// Copy this file to machines.ts and populate with your tailnet domain and machine metadata.
// machines.ts is gitignored -- your local config will never be committed.
const TAILSCALE_DOMAIN = '';

const MACHINE_IPS: Record<string, string> = {
  // 'my-machine': '192.168.1.100',
};

const MACHINE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  // 'my-machine': { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa', border: 'rgba(96, 165, 250, 0.3)' },
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

export function getMagicDnsUrl(machine: string): string {
  const hostname = machine.replace(/\.local$/, '');
  if (TAILSCALE_DOMAIN) {
    return `https://${hostname}.${TAILSCALE_DOMAIN}:37778`;
  }
  return `http://${hostname}:37777`;
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

/** FA icon and color for each observation type */
export const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  bugfix:    { icon: 'fat fa-bug', color: '#f85149' },
  feature:   { icon: 'fat fa-star', color: '#3fb950' },
  change:    { icon: 'fat fa-code-branch', color: '#58a6ff' },
  discovery: { icon: 'fat fa-search', color: '#58a6ff' },
  refactor:  { icon: 'fat fa-recycle', color: '#d2a8ff' },
  decision:  { icon: 'fat fa-balance-scale', color: '#d29922' },
};
