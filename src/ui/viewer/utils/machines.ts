const TAILSCALE_DOMAIN = 'example-tailnet.ts.net';

const MACHINE_IPS: Record<string, string> = {
  'spark-1': '192.168.1.76',
  'spark-2': '192.168.1.63',
  'studio': '10.0.0.1',
  'mbp2022': '10.0.0.2',
  'mbp2020': '10.0.0.3',
  'mbp2019': '10.0.0.4',
  'mbp2019.local': '10.0.0.4',
};

/** Explicit high-contrast color assignments for known machines */
const MACHINE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'spark-1':          { bg: 'rgba(56, 139, 253, 0.15)', text: '#58a6ff', border: 'rgba(56, 139, 253, 0.3)' },    // blue
  'spark-2':          { bg: 'rgba(63, 185, 80, 0.15)', text: '#3fb950', border: 'rgba(63, 185, 80, 0.3)' },       // green
  'studio':        { bg: 'rgba(255, 166, 87, 0.15)', text: '#ffa657', border: 'rgba(255, 166, 87, 0.3)' },     // orange
  'mbp2022':       { bg: 'rgba(121, 192, 255, 0.15)', text: '#79c0ff', border: 'rgba(121, 192, 255, 0.3)' },   // cyan
  'mbp2020':       { bg: 'rgba(248, 81, 73, 0.15)', text: '#f85149', border: 'rgba(248, 81, 73, 0.3)' },       // red
  'mbp2019':       { bg: 'rgba(210, 153, 34, 0.15)', text: '#d29922', border: 'rgba(210, 153, 34, 0.3)' },     // amber
  'mbp2019.local': { bg: 'rgba(210, 153, 34, 0.15)', text: '#d29922', border: 'rgba(210, 153, 34, 0.3)' },     // amber
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
  return `http://${hostname}.${TAILSCALE_DOMAIN}:37777`;
}

export function getMagicDnsHostname(machine: string): string {
  const hostname = machine.replace(/\.local$/, '');
  return `${hostname}.${TAILSCALE_DOMAIN}`;
}

export function getMachineIp(machine: string): string | undefined {
  return MACHINE_IPS[machine] || MACHINE_IPS[machine.replace(/\.local$/, '')];
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
