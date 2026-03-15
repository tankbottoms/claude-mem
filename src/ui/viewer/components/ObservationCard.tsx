import React, { useState } from 'react';
import { Observation } from '../types';
import { formatDate } from '../utils/formatters';
import { getMachineColor, TYPE_ICONS } from '../utils/machines';
import { SensitiveText } from './SensitiveText';

interface ObservationCardProps {
  observation: Observation;
  onMachineFilter?: (machine: string) => void;
  localHostname?: string;
  projectMachines?: Record<string, Array<{ machine: string; count: number }>>;
}

// Helper to strip project root from file paths
function stripProjectRoot(filePath: string): string {
  const markers = ['/Scripts/', '/src/', '/plugin/', '/docs/'];
  for (const marker of markers) {
    const index = filePath.indexOf(marker);
    if (index !== -1) return filePath.substring(index + 1);
  }
  const projectIndex = filePath.indexOf('claude-mem/');
  if (projectIndex !== -1) return filePath.substring(projectIndex + 'claude-mem/'.length);
  const parts = filePath.split('/');
  return parts.length > 3 ? parts.slice(-3).join('/') : filePath;
}

export function ObservationCard({ observation, onMachineFilter, localHostname, projectMachines }: ObservationCardProps) {
  const [showFacts, setShowFacts] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const date = formatDate(observation.created_at_epoch);

  const facts = observation.facts ? JSON.parse(observation.facts) : [];
  const concepts = observation.concepts ? JSON.parse(observation.concepts) : [];
  const filesRead = observation.files_read ? JSON.parse(observation.files_read).map(stripProjectRoot) : [];
  const filesModified = observation.files_modified ? JSON.parse(observation.files_modified).map(stripProjectRoot) : [];
  const hasFactsContent = facts.length > 0 || concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0;

  const sourceMachine = observation.source_machine || localHostname || '';
  const machineColor = sourceMachine ? getMachineColor(sourceMachine) : null;
  const typeIcon = TYPE_ICONS[observation.type];

  // Other machines with the same project (for hover popup)
  const otherMachines = projectMachines?.[observation.project]
    ?.filter(pm => pm.machine !== sourceMachine) || [];

  return (
    <div
      className="card"
      style={machineColor ? {
        borderLeft: `3px solid ${machineColor.border}`,
      } : undefined}
    >
      {/* Header with toggle buttons in top right */}
      <div className="card-header">
        <div className="card-header-left">
          <span className={`card-type type-${observation.type}`}>
            {typeIcon && (
              <i className={typeIcon.icon} style={{ color: typeIcon.color, marginRight: '4px', fontSize: '0.7rem' }}></i>
            )}
            {observation.type}
          </span>
          <span className="card-project">{observation.project}</span>
          <div className="machine-badge-wrapper">
            <span
              onClick={() => onMachineFilter?.(observation.source_machine || '__local__')}
              className="machine-source-badge"
              style={machineColor ? {
                background: machineColor.bg,
                color: machineColor.text,
                borderColor: machineColor.border,
              } : undefined}
              title={`Filter by ${sourceMachine || 'this machine'}`}
            >
              {sourceMachine || '...'}
            </span>
            {otherMachines.length > 0 && (
              <div className="related-machines-popup">
                <div className="related-machines-label">Also on:</div>
                {otherMachines.map(pm => {
                  const c = getMachineColor(pm.machine);
                  return (
                    <span
                      key={pm.machine}
                      className="related-machine-badge"
                      onClick={(e) => { e.stopPropagation(); onMachineFilter?.(pm.machine); }}
                      style={{ background: c.bg, color: c.text, borderColor: c.border }}
                      title={`${pm.machine}: ${pm.count} observations`}
                    >
                      {pm.machine} <span style={{ opacity: 0.6 }}>{pm.count}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="view-mode-toggles">
          {hasFactsContent && (
            <button
              className={`view-mode-toggle ${showFacts ? 'active' : ''}`}
              onClick={() => {
                setShowFacts(!showFacts);
                if (!showFacts) setShowNarrative(false);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              <span>facts</span>
            </button>
          )}
          {observation.narrative && (
            <button
              className={`view-mode-toggle ${showNarrative ? 'active' : ''}`}
              onClick={() => {
                setShowNarrative(!showNarrative);
                if (!showNarrative) setShowFacts(false);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <span>narrative</span>
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="card-title">
        <SensitiveText text={observation.title || 'Untitled'} />
      </div>

      {/* Content based on toggle state */}
      <div className="view-mode-content">
        {!showFacts && !showNarrative && observation.subtitle && (
          <div className="card-subtitle"><SensitiveText text={observation.subtitle} /></div>
        )}
        {showFacts && facts.length > 0 && (
          <ul className="facts-list">
            {facts.map((fact: string, i: number) => (
              <li key={i}><SensitiveText text={fact} /></li>
            ))}
          </ul>
        )}
        {showNarrative && observation.narrative && (
          <div className="narrative">
            <SensitiveText text={observation.narrative} />
          </div>
        )}
      </div>

      {/* Metadata footer */}
      <div className="card-meta">
        <span className="meta-date">#{observation.id} • {date} • {(
          (observation.title || '').length +
          (observation.subtitle || '').length +
          (observation.narrative || '').length +
          (observation.facts || '').length
        ).toLocaleString()} chars</span>
        {showFacts && (concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {concepts.map((concept: string, i: number) => (
              <span key={i} style={{
                padding: '2px 8px',
                background: 'var(--color-type-badge-bg)',
                color: 'var(--color-type-badge-text)',
                borderRadius: '3px',
                fontWeight: '500',
                fontSize: '10px'
              }}>
                {concept}
              </span>
            ))}
            {filesRead.length > 0 && (
              <span className="meta-files">
                <span className="file-label">read:</span> {filesRead.join(', ')}
              </span>
            )}
            {filesModified.length > 0 && (
              <span className="meta-files">
                <span className="file-label">modified:</span> {filesModified.join(', ')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
