import React, { useState, useEffect, useCallback } from 'react';
import type { Stats } from '../types';
import { API_ENDPOINTS } from '../constants/api';
import { getMachineColor, getMagicDnsUrl, getMagicDnsHostname, getMachineIp, probeHttps } from '../utils/machines';

interface FederationStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterByProjectMachine?: (project: string, machine: string) => void;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatTimestamp(epoch: number): string {
  const now = Date.now();
  const diff = now - epoch;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(epoch).toLocaleDateString();
}

export function FederationStatsModal({ isOpen, onClose, onFilterByProjectMachine }: FederationStatsModalProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [httpsUrls, setHttpsUrls] = useState<Record<string, string>>({});

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.STATS}`);
      const data = await res.json();
      setStats(data);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) fetchStats();
  }, [isOpen, fetchStats]);

  // Probe HTTPS availability for each machine when stats load
  useEffect(() => {
    const machines = stats?.federation?.machines;
    if (!machines || machines.length === 0) return;
    const urls: Record<string, string> = {};
    let cancelled = false;
    Promise.all(
      machines.map(async (m: { machine: string }) => {
        const httpsUrl = await probeHttps(m.machine);
        if (httpsUrl && !cancelled) {
          urls[m.machine] = httpsUrl;
        }
      })
    ).then(() => {
      if (!cancelled) setHttpsUrls({ ...urls });
    });
    return () => { cancelled = true; };
  }, [stats]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const machines = stats?.federation?.machines || [];
  const totalObs = stats?.database?.observations || 0;
  const projectMachines = stats?.federation?.projectMachines || {};
  const projectCount = stats?.database?.projectCount || 0;
  const avgChars = stats?.database?.avgChars || 0;
  const avgTokens = stats?.database?.avgDiscoveryTokens || 0;
  const syncCount = stats?.database?.syncCount || 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="federation-stats-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="fed-stats-header">
          <div className="fed-stats-title">
            <i className="fas fa-project-diagram" style={{ marginRight: '8px', color: 'var(--color-accent-primary)' }}></i>
            Federation
          </div>
          <button onClick={onClose} className="modal-close-btn" title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-secondary)' }}>Loading...</div>
        ) : (
          <div className="fed-stats-body">
            {/* Overview badges - two rows with pastel colors */}
            <div className="fed-stats-badges">
              <span className="fed-badge" title="Total observations across all federated machines" style={{ background: 'rgba(96, 165, 250, 0.15)', borderColor: 'rgba(96, 165, 250, 0.3)', color: '#60a5fa' }}>
                <i className="fas fa-eye" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {totalObs.toLocaleString()} obs
              </span>
              <span className="fed-badge" title="Number of machines in the federation" style={{ background: 'rgba(74, 222, 128, 0.15)', borderColor: 'rgba(74, 222, 128, 0.3)', color: '#4ade80' }}>
                <i className="fas fa-server" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {machines.length} machines
              </span>
              <span className="fed-badge" title="Distinct projects tracked" style={{ background: 'rgba(251, 191, 36, 0.15)', borderColor: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24' }}>
                <i className="fas fa-folder-open" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {projectCount} projects
              </span>
              <span className="fed-badge" title="Total Claude Code sessions recorded" style={{ background: 'rgba(192, 132, 252, 0.15)', borderColor: 'rgba(192, 132, 252, 0.3)', color: '#c084fc' }}>
                <i className="fas fa-link" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {stats?.database?.sessions?.toLocaleString() || '0'} sessions
              </span>
              <span className="fed-badge" title="AI-generated session summaries" style={{ background: 'rgba(251, 146, 60, 0.15)', borderColor: 'rgba(251, 146, 60, 0.3)', color: '#fb923c' }}>
                <i className="fas fa-compress-alt" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {stats?.database?.summaries?.toLocaleString() || '0'} summaries
              </span>
              <span className="fed-badge" title="Federation sync operations" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
                <i className="fas fa-sync-alt" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {syncCount.toLocaleString()} syncs
              </span>
              <span className="fed-badge" title="Average characters per observation" style={{ background: 'rgba(248, 113, 113, 0.15)', borderColor: 'rgba(248, 113, 113, 0.3)', color: '#f87171' }}>
                <i className="fas fa-text-width" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {avgChars.toLocaleString()} avg chars
              </span>
              <span className="fed-badge" title="Average discovery tokens per observation" style={{ background: 'rgba(45, 212, 191, 0.15)', borderColor: 'rgba(45, 212, 191, 0.3)', color: '#2dd4bf' }}>
                <i className="fas fa-coins" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {avgTokens.toLocaleString()} avg tokens
              </span>
              <span className="fed-badge" title="Worker process uptime since last restart" style={{ background: 'rgba(167, 139, 250, 0.15)', borderColor: 'rgba(167, 139, 250, 0.3)', color: '#a78bfa' }}>
                <i className="fas fa-clock" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {formatUptime(stats?.worker?.uptime || 0)}
              </span>
              <span className="fed-badge" title="SQLite database file size on disk" style={{ background: 'rgba(156, 163, 175, 0.15)', borderColor: 'rgba(156, 163, 175, 0.3)', color: '#9ca3af' }}>
                <i className="fas fa-database" style={{ marginRight: '5px', opacity: 0.7 }}></i>
                {formatBytes(stats?.database?.size || 0)}
              </span>
            </div>

            {/* Machines section */}
            <div className="fed-section">
              <h3 className="fed-section-title">
                <i className="fas fa-server" style={{ marginRight: '6px' }}></i>
                Machines
              </h3>
              <div className="fed-machines-grid">
                {[...machines].sort((a, b) => { const aL = a.machine === stats?.worker?.hostname; const bL = b.machine === stats?.worker?.hostname; if (aL && !bL) return -1; if (!aL && bL) return 1; return a.machine.localeCompare(b.machine); }).map(m => {
                  const color = getMachineColor(m.machine);
                  const magicDns = getMagicDnsHostname(m.machine);
                  const ip = getMachineIp(m.machine);
                  const isLocal = m.machine === stats?.worker?.hostname;
                  const pct = totalObs > 0 ? ((m.count / totalObs) * 100).toFixed(1) : '0';
                  const machineUrl = httpsUrls[m.machine] || getMagicDnsUrl(m.machine);
                  const isHttps = !!httpsUrls[m.machine];
                  return (
                    <a
                      key={m.machine}
                      className="fed-machine-card"
                      href={machineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${magicDns}${ip ? ` (${ip})` : ''}${isHttps ? ' [HTTPS]' : ''}\nClick to open viewer`}
                      style={{ borderColor: color.border }}
                    >
                      <div className="fed-machine-card-header">
                        <span
                          className="fed-machine-name-badge"
                          style={{ background: color.bg, color: color.text, borderColor: color.border }}
                        >
                          {isLocal ? (
                            <i className="fas fa-star" style={{ marginRight: '4px', fontSize: '0.7rem', color: '#d29922' }}></i>
                          ) : (
                            <i className="fas fa-satellite-dish" style={{ marginRight: '4px', fontSize: '0.7rem' }}></i>
                          )}
                          {m.machine}
                        </span>
                        {isHttps && (
                          <i className="fas fa-lock" style={{ fontSize: '0.6rem', color: '#4ade80', marginLeft: '4px' }} title="HTTPS available"></i>
                        )}
                      </div>
                      <div className="fed-machine-card-stats">
                        <span className="fed-machine-count">{m.count.toLocaleString()}</span>
                        <span className="fed-machine-pct">{pct}%</span>
                      </div>
                      <div className="fed-machine-card-meta">
                        {formatTimestamp(m.last_seen)}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Projects x Machines */}
            <div className="fed-section">
              <h3 className="fed-section-title">
                <i className="fas fa-folder-open" style={{ marginRight: '6px' }}></i>
                Projects by Machine
              </h3>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <table className="fed-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Machines</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(projectMachines)
                    .sort((a, b) => {
                      const aTotal = a[1].reduce((s, m) => s + m.count, 0);
                      const bTotal = b[1].reduce((s, m) => s + m.count, 0);
                      return bTotal - aTotal;
                    })
                    .map(([project, pmachines]) => (
                    <tr key={project}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{project}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {pmachines.map(pm => {
                            const c = getMachineColor(pm.machine);
                            return (
                              <span
                                key={pm.machine}
                                className="fed-project-machine-badge"
                                onClick={() => onFilterByProjectMachine?.(project, pm.machine)}
                                style={{ background: c.bg, color: c.text, borderColor: c.border }}
                                title={`Filter by ${project} on ${pm.machine}`}
                              >
                                {pm.machine}
                                <span style={{ marginLeft: '4px', opacity: 0.6 }}>{pm.count}</span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
