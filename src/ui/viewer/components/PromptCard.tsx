import React from 'react';
import { UserPrompt } from '../types';
import { formatDate } from '../utils/formatters';
import { getMachineColor } from '../utils/machines';
import { SensitiveText } from './SensitiveText';

interface PromptCardProps {
  prompt: UserPrompt;
  localHostname?: string;
  onMachineFilter?: (machine: string) => void;
  projectMachines?: Record<string, Array<{ machine: string; count: number }>>;
}

export function PromptCard({ prompt, localHostname, onMachineFilter, projectMachines }: PromptCardProps) {
  const date = formatDate(prompt.created_at_epoch);
  const sourceMachine = localHostname || '';
  const machineColor = sourceMachine ? getMachineColor(sourceMachine) : null;

  const otherMachines = projectMachines?.[prompt.project]
    ?.filter(pm => pm.machine !== sourceMachine) || [];

  return (
    <div
      className="card prompt-card"
      style={machineColor ? { borderLeft: `3px solid ${machineColor.border}` } : undefined}
    >
      <div className="card-header">
        <div className="card-header-left">
          <span className="card-type">Prompt</span>
          <span className="card-project">{prompt.project}</span>
          {sourceMachine && (
            <div className="machine-badge-wrapper">
              <span
                onClick={() => onMachineFilter?.('__local__')}
                className="machine-source-badge"
                style={machineColor ? {
                  background: machineColor.bg,
                  color: machineColor.text,
                  borderColor: machineColor.border,
                } : undefined}
                title={`Filter by ${sourceMachine}`}
              >
                {sourceMachine}
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
          )}
        </div>
      </div>
      <div className="card-content">
        <SensitiveText text={prompt.prompt_text} />
      </div>
      <div className="card-meta">
        <span className="meta-date">#{prompt.id} • {date}</span>
      </div>
    </div>
  );
}
