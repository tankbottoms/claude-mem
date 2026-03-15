import React, { useState, useEffect, useCallback } from 'react';
import type { Stats } from '../types';
import { API_ENDPOINTS } from '../constants/api';

interface FederationStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  const d = new Date(epoch);
  const now = Date.now();
  const diff = now - epoch;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export function FederationStatsModal({ isOpen, onClose }: FederationStatsModalProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="federation-stats-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="fed-stats-header">
          <div className="fed-stats-title">
            <i className="fas fa-network-wired" style={{ marginRight: '8px', color: 'var(--color-accent-primary)' }}></i>
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
            {/* Overview row */}
            <div className="fed-stats-overview">
              <div className="fed-stat-card">
                <div className="fed-stat-value">{totalObs.toLocaleString()}</div>
                <div className="fed-stat-label">Observations</div>
              </div>
              <div className="fed-stat-card">
                <div className="fed-stat-value">{machines.length}</div>
                <div className="fed-stat-label">Machines</div>
              </div>
              <div className="fed-stat-card">
                <div className="fed-stat-value">{stats?.database?.sessions?.toLocaleString() || '0'}</div>
                <div className="fed-stat-label">Sessions</div>
              </div>
              <div className="fed-stat-card">
                <div className="fed-stat-value">{stats?.database?.summaries?.toLocaleString() || '0'}</div>
                <div className="fed-stat-label">Summaries</div>
              </div>
              <div className="fed-stat-card">
                <div className="fed-stat-value">{formatUptime(stats?.worker?.uptime || 0)}</div>
                <div className="fed-stat-label">Uptime</div>
              </div>
              <div className="fed-stat-card">
                <div className="fed-stat-value">{formatBytes(stats?.database?.size || 0)}</div>
                <div className="fed-stat-label">DB Size</div>
              </div>
            </div>

            {/* Machines table */}
            <div className="fed-section">
              <h3 className="fed-section-title">
                <i className="fas fa-server" style={{ marginRight: '6px' }}></i>
                Machines
              </h3>
              <table className="fed-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th style={{ textAlign: 'right' }}>Observations</th>
                    <th style={{ textAlign: 'right' }}>%</th>
                    <th style={{ textAlign: 'right' }}>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map(m => (
                    <tr key={m.machine}>
                      <td>
                        <span className="fed-machine-badge">
                          {m.machine === stats?.worker?.hostname ? (
                            <i className="fas fa-home" style={{ marginRight: '4px', fontSize: '0.7rem' }}></i>
                          ) : (
                            <i className="fas fa-satellite-dish" style={{ marginRight: '4px', fontSize: '0.7rem' }}></i>
                          )}
                          {m.machine}
                        </span>
                        {m.machine === stats?.worker?.hostname && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-secondary)', marginLeft: '6px' }}>local</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{m.count.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-secondary)' }}>
                        {totalObs > 0 ? ((m.count / totalObs) * 100).toFixed(1) : '0'}%
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-secondary)' }}>{formatTimestamp(m.last_seen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Projects × Machines */}
            <div className="fed-section">
              <h3 className="fed-section-title">
                <i className="fas fa-folder-open" style={{ marginRight: '6px' }}></i>
                Projects by Machine
              </h3>
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
                    .slice(0, 20)
                    .map(([project, pmachines]) => (
                    <tr key={project}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{project}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {pmachines.map(pm => (
                            <span key={pm.machine} className="fed-machine-badge" style={{ fontSize: '0.7rem' }}>
                              {pm.machine}
                              <span style={{ marginLeft: '4px', opacity: 0.6 }}>{pm.count}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
