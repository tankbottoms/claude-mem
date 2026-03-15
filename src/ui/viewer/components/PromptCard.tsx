import React from 'react';
import { UserPrompt } from '../types';
import { formatDate } from '../utils/formatters';

interface PromptCardProps {
  prompt: UserPrompt;
  localHostname?: string;
  onMachineFilter?: (machine: string) => void;
}

export function PromptCard({ prompt, localHostname, onMachineFilter }: PromptCardProps) {
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
