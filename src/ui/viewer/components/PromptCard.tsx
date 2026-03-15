import React from 'react';
import { UserPrompt } from '../types';
import { formatDate } from '../utils/formatters';

interface PromptCardProps {
  prompt: UserPrompt;
  localHostname?: string;
  onMachineFilter?: (machine: string) => void;
  projectMachines?: Record<string, Array<{ machine: string; count: number }>>;
}

export function PromptCard({ prompt, localHostname, onMachineFilter, projectMachines }: PromptCardProps) {
  const date = formatDate(prompt.created_at_epoch);

  return (
    <div className="card prompt-card">
      <div className="card-header">
        <div className="card-header-left">
          <span className="card-type">Prompt</span>
          <span className="card-project">{prompt.project}</span>
          {localHostname && (
            <span
              onClick={() => onMachineFilter?.('__local__')}
              style={{
                fontSize: '0.7rem',
                padding: '2px 6px',
                borderRadius: '3px',
                background: 'var(--color-type-badge-bg)',
                color: 'var(--color-type-badge-text)',
                fontFamily: 'monospace',
                cursor: onMachineFilter ? 'pointer' : 'default',
              }}
              title={`Filter by ${localHostname}`}
            >
              {localHostname}
            </span>
          )}
          {/* Show other machines that also have this project */}
          {projectMachines?.[prompt.project]
            ?.filter(pm => pm.machine !== localHostname)
            .map(pm => (
              <span
                key={pm.machine}
                onClick={() => onMachineFilter?.(pm.machine)}
                style={{
                  fontSize: '0.65rem',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  background: 'transparent',
                  border: '1px solid var(--color-border, #30363d)',
                  color: 'var(--color-secondary, #8b949e)',
                  fontFamily: 'monospace',
                  cursor: onMachineFilter ? 'pointer' : 'default',
                  opacity: 0.7,
                }}
                title={`Also on ${pm.machine} (${pm.count} observations)`}
              >
                {pm.machine}
              </span>
            ))}
        </div>
      </div>
      <div className="card-content">
        {prompt.prompt_text}
      </div>
      <div className="card-meta">
        <span className="meta-date">#{prompt.id} • {date}</span>
      </div>
    </div>
  );
}
