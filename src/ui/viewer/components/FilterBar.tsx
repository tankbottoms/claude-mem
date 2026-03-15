import React, { useState, useMemo } from 'react';
import { getMachineColor } from '../utils/machines';

interface FilterBarProps {
  projects: string[];
  currentFilter: string;
  machineFilter: string;
  searchQuery: string;
  onProjectFilter: (project: string) => void;
  onMachineFilter: (machine: string) => void;
  onSearchChange: (query: string) => void;
  projectMachines?: Record<string, Array<{ machine: string; count: number }>>;
  machines?: Array<{ machine: string; count: number }>;
  localHostname?: string;
}

export function FilterBar({
  projects,
  currentFilter,
  machineFilter,
  searchQuery,
  onProjectFilter,
  onMachineFilter,
  onSearchChange,
  projectMachines,
  machines,
  localHostname,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [pinnedProjects, setPinnedProjects] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('claude-mem-pinned-projects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Sort projects by observation count descending
  const sortedProjects = useMemo(() => {
    if (!projectMachines) return projects;
    return [...projects].sort((a, b) => {
      const aCount = (projectMachines[a] || []).reduce((s, m) => s + m.count, 0);
      const bCount = (projectMachines[b] || []).reduce((s, m) => s + m.count, 0);
      return bCount - aCount;
    });
  }, [projects, projectMachines]);

  // Pinned + top 10
  const pinnedList = sortedProjects.filter(p => pinnedProjects.has(p));
  const top10 = sortedProjects.slice(0, 10);
  const visibleProjects = expanded
    ? sortedProjects
    : [...new Set([...pinnedList, ...top10])];
  const hiddenCount = sortedProjects.length - new Set([...pinnedList, ...top10]).size;

  const togglePin = (project: string) => {
    const next = new Set(pinnedProjects);
    if (next.has(project)) next.delete(project);
    else next.add(project);
    setPinnedProjects(next);
    localStorage.setItem('claude-mem-pinned-projects', JSON.stringify([...next]));
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar-inner">
      {/* Search row */}
      <div className="filter-row">
        <span className="filter-label">Search:</span>
        <div className="filter-search-wrapper">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search observations by keyword..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      {/* Project filter row */}
      <div className="filter-row">
        <span className="filter-label">
          Project(s):
        </span>
        <div className="filter-pills">
          <span
            className={`filter-pill ${!currentFilter ? 'active' : ''}`}
            onClick={() => onProjectFilter('')}
          >
            All
          </span>
          {visibleProjects.map(project => (
            <span
              key={project}
              className={`filter-pill ${currentFilter === project ? 'active' : ''} ${pinnedProjects.has(project) ? 'pinned' : ''}`}
              onClick={() => onProjectFilter(currentFilter === project ? '' : project)}
            >
              {project}
              {expanded && (
                <span
                  className="pin-icon"
                  onClick={e => { e.stopPropagation(); togglePin(project); }}
                  title={pinnedProjects.has(project) ? 'Unpin' : 'Pin'}
                >
                  <i className={`fas fa-thumbtack`} style={pinnedProjects.has(project) ? { color: 'var(--color-accent-primary)' } : undefined}></i>
                </span>
              )}
            </span>
          ))}
          {hiddenCount > 0 && !expanded && (
            <span className="filter-pill expand-pill" onClick={() => setExpanded(true)}>
              <i className="fas fa-caret-down" style={{ marginRight: '3px' }}></i>
              {hiddenCount} more
            </span>
          )}
          {expanded && (
            <span className="filter-pill expand-pill" onClick={() => setExpanded(false)}>
              <i className="fas fa-caret-up" style={{ marginRight: '3px' }}></i>
              collapse
            </span>
          )}
        </div>
      </div>

      {/* Machine filter row */}
      {machines && machines.length > 0 && (
        <div className="filter-row">
          <span className="filter-label">
            Machine(s):
          </span>
          <div className="filter-pills">
            <span
              className={`filter-pill ${!machineFilter ? 'active' : ''}`}
              onClick={() => onMachineFilter('')}
            >
              All
            </span>
            {machines.map(m => {
              const color = getMachineColor(m.machine);
              const isActive = machineFilter === m.machine;
              const isLocal = m.machine === localHostname;
              return (
                <span
                  key={m.machine}
                  className={`filter-pill machine-pill ${isActive ? 'active' : ''}`}
                  onClick={() => onMachineFilter(isActive ? '' : m.machine)}
                  style={{
                    background: isActive ? color.border : color.bg,
                    color: isActive ? '#fff' : color.text,
                    borderColor: color.border,
                  }}
                  title={`${m.count.toLocaleString()} observations`}
                >
                  {isLocal && <i className="fas fa-star" style={{ fontSize: '8px', marginRight: '3px', color: isActive ? '#fff' : '#d29922' }}></i>}
                  {m.machine}
                </span>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
