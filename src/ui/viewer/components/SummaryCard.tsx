import React from "react";
import { Summary } from "../types";
import { formatDate } from "../utils/formatters";
import { getMachineColor } from "../utils/machines";
import { SensitiveText } from "./SensitiveText";

interface SummaryCardProps {
  summary: Summary;
  localHostname?: string;
  onMachineFilter?: (machine: string) => void;
  projectMachines?: Record<string, Array<{ machine: string; count: number }>>;
}

export function SummaryCard({ summary, localHostname, onMachineFilter, projectMachines }: SummaryCardProps) {
  const date = formatDate(summary.created_at_epoch);
  const sourceMachine = localHostname || '';
  const machineColor = sourceMachine ? getMachineColor(sourceMachine) : null;

  const otherMachines = projectMachines?.[summary.project]
    ?.filter(pm => pm.machine !== sourceMachine) || [];

  const sections = [
    { key: "investigated", label: "Investigated", content: summary.investigated, icon: "/icon-thick-investigated.svg" },
    { key: "learned", label: "Learned", content: summary.learned, icon: "/icon-thick-learned.svg" },
    { key: "completed", label: "Completed", content: summary.completed, icon: "/icon-thick-completed.svg" },
    { key: "next_steps", label: "Next Steps", content: summary.next_steps, icon: "/icon-thick-next-steps.svg" },
  ].filter((section) => section.content);

  return (
    <article
      className="card summary-card"
      style={machineColor ? { borderLeft: `3px solid ${machineColor.border}` } : undefined}
    >
      <header className="summary-card-header">
        <div className="summary-badge-row">
          <span className="card-type summary-badge">Session Summary</span>
          <span className="summary-project-badge">{summary.project}</span>
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
        {summary.request && (
          <h2 className="summary-title"><SensitiveText text={summary.request} /></h2>
        )}
      </header>

      <div className="summary-sections">
        {sections.map((section, index) => (
          <section
            key={section.key}
            className="summary-section"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="summary-section-header">
              <img
                src={section.icon}
                alt={section.label}
                className={`summary-section-icon summary-section-icon--${section.key}`}
              />
              <h3 className="summary-section-label">{section.label}</h3>
            </div>
            <div className="summary-section-content">
              <SensitiveText text={section.content!} />
            </div>
          </section>
        ))}
      </div>

      <footer className="summary-card-footer">
        <span className="summary-meta-id">Session #{summary.id}</span>
        <span className="summary-meta-divider">•</span>
        <time className="summary-meta-date" dateTime={new Date(summary.created_at_epoch).toISOString()}>
          {date}
        </time>
      </footer>
    </article>
  );
}
